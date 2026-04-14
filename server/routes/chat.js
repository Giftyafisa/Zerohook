const express = require('express');
const mongoose = require('mongoose');
const { Message, Conversation, isDatabaseAvailable } = require('../config/database');
const { authMiddleware } = require('./auth');
const { inferMessageType } = require('../utils/inferMessageType');
const { formatMessagePreview } = require('../utils/messagePreview');
const { body, validationResult } = require('express-validator');
const { createDistributedLimiter } = require('../utils/rateLimiters');
const router = express.Router();
const NotificationService = require('../services/NotificationService');

// Per-route rate limiter: 30 messages per minute per IP
const chatSendLimiter = createDistributedLimiter({ points: 30, duration: 60, keyPrefix: 'chat_send' });
const chatSendRateLimit = async (req, res, next) => {
  const userScopedKey = req.user?.userId ? `u:${req.user.userId}` : `ip:${req.ip}`;
  try { await chatSendLimiter.consume(userScopedKey); next(); }
  catch { res.status(429).json({ success: false, error: 'Message rate limit reached, please slow down.' }); }
};

// Environment-gated debug logger
const isDev = (process.env.NODE_ENV || 'development') === 'development';
const debugLog = isDev ? (...args) => console.log(...args) : () => {};

/**
 * Normalise a lastMessage value so the inbox never shows raw URLs.
 * Converts http(s) / /uploads/ / data: URIs to friendly labels.
 * CRITICAL: Handles both already-formatted previews and raw content.
 */
const normalizeLastMessagePreview = (content = '', messageType = 'text') => formatMessagePreview(content, messageType);

const decodeConversationCursor = (rawCursor) => {
  if (!rawCursor || typeof rawCursor !== 'string') return null;

  if (mongoose.Types.ObjectId.isValid(rawCursor)) {
    return {
      id: new mongoose.Types.ObjectId(rawCursor),
      updatedAt: null
    };
  }

  try {
    const decoded = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
    if (!decoded || typeof decoded !== 'object') return null;
    if (!decoded.id || !mongoose.Types.ObjectId.isValid(decoded.id)) return null;

    const parsedDate = decoded.u ? new Date(decoded.u) : null;
    const hasValidDate = parsedDate && !Number.isNaN(parsedDate.getTime());

    return {
      id: new mongoose.Types.ObjectId(decoded.id),
      updatedAt: hasValidDate ? parsedDate : null
    };
  } catch {
    return null;
  }
};

const buildVisibleConversationFilter = (userId) => ({
  status: { $ne: 'deleted' },
  $or: [
    { participant1Id: userId, participant1Hidden: { $ne: true } },
    { participant2Id: userId, participant2Hidden: { $ne: true } }
  ]
});

/**
 * Messaging is temporarily unrestricted for all authenticated users.
 * Keep the response shape stable for existing clients that expect limit metadata.
 */
const checkMessagingLimit = async () => {
  return {
    canMessage: true,
    uniqueContacts: 0,
    maxContacts: null,
    remainingContacts: null,
    requiresSubscription: false,
    unlimited: true
  };
};

// Custom validator for MongoDB ObjectId or UUID
const isMongoIdOrUUID = (value) => {
  if (!value) return true; // Let optional() handle this
  // MongoDB ObjectId: 24 hex characters
  const isMongoId = /^[0-9a-fA-F]{24}$/.test(value);
  // UUID: 8-4-4-4-12 hex format
  const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i.test(value);
  return isMongoId || isUUID;
};

/**
 * @route   GET /api/chat/unread-count
 * @desc    Get total unread message count across all conversations
 * @access  Private
 */
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    if (!isDatabaseAvailable()) {
      return res.json({ unreadCount: 0, success: false });
    }

    // Single aggregation pipeline — avoids a separate Conversation.find() round-trip.
    // Uses the compound index { conversationId, senderId, readAt } for efficiency.
    const userObjId = new mongoose.Types.ObjectId(userId);
    const pipeline = [
      // 1. Find conversations the user is in
      {
        $match: {
          status: { $ne: 'deleted' },
          $or: [
            { participant1Id: userObjId, participant1Hidden: { $ne: true } },
            { participant2Id: userObjId, participant2Hidden: { $ne: true } }
          ]
        }
      },
      // 2. Collect conversation IDs
      { $group: { _id: null, ids: { $push: '$_id' } } },
      // 3. Lookup unread messages across those conversations
      {
        $lookup: {
          from: 'messages',
          let: { convIds: '$ids' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ['$conversationId', '$$convIds'] },
                    { $ne: ['$senderId', userObjId] },
                    { $eq: [{ $ifNull: ['$readAt', null] }, null] }
                  ]
                }
              }
            },
            { $count: 'n' }
          ],
          as: 'unread'
        }
      },
      { $project: { count: { $ifNull: [{ $arrayElemAt: ['$unread.n', 0] }, 0] } } }
    ];

    const result = await Conversation.aggregate(pipeline);
    const unreadCount = result.length > 0 ? result[0].count : 0;
    
    res.json({ 
      unreadCount,
      success: true 
    });
    
  } catch (error) {
    console.error('Get unread count error:', error);
    // Return 0 instead of error to not break UI
    res.json({ unreadCount: 0, success: false });
  }
});

/**
 * @route   GET /api/chat/conversations
 * @desc    Get user's conversations
 * @access  Private
 */
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
    const cursor = req.query.cursor ? String(req.query.cursor) : null;
    const cursorToken = decodeConversationCursor(cursor);
    
    if (!isDatabaseAvailable()) {
      return res.json({ success: true, conversations: [], nextCursor: null, hasMore: false });
    }

    // Try to get conversations, return empty array if user doesn't exist or query fails
    let conversations;
    try {
      const baseVisibilityFilter = buildVisibleConversationFilter(userId);
      const query = {
        ...baseVisibilityFilter
      };

      if (cursorToken?.updatedAt && cursorToken?.id) {
        query.$and = [
          { $or: baseVisibilityFilter.$or },
          {
            $or: [
              { updatedAt: { $lt: cursorToken.updatedAt } },
              { updatedAt: cursorToken.updatedAt, _id: { $lt: cursorToken.id } }
            ]
          }
        ];
        delete query.$or;
      } else if (cursorToken?.id) {
        // Legacy fallback for old cursor format (ObjectId only)
        query._id = { $lt: cursorToken.id };
      }

      conversations = await Conversation.find(query)
      .populate('participant1Id', 'username verification_tier profile_data')
      .populate('participant2Id', 'username verification_tier profile_data')
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit + 1);
    } catch (dbError) {
      debugLog('Conversations query failed:', dbError.message);
      return res.json({ success: true, conversations: [], nextCursor: null, hasMore: false });
    }

    const hasMore = conversations.length > limit;
    const pageConversations = hasMore ? conversations.slice(0, limit) : conversations;
    let nextCursor = null;
    if (hasMore && pageConversations.length > 0) {
      const tailConversation = pageConversations[pageConversations.length - 1];
      const cursorPayload = {
        u: (tailConversation.updatedAt || tailConversation.createdAt || new Date(0)).toISOString(),
        id: tailConversation._id.toString()
      };
      nextCursor = Buffer.from(JSON.stringify(cursorPayload)).toString('base64url');
    }

    // Batch-fetch unread counts per conversation in a single aggregation
    let unreadMap = {};
    try {
      const convIds = pageConversations.map(c => c._id);
      if (convIds.length > 0) {
        const userObjId = new mongoose.Types.ObjectId(userId);
        const unreadAgg = await Message.aggregate([
          {
            $match: {
              conversationId: { $in: convIds },
              senderId: { $ne: userObjId },
              readAt: null
            }
          },
          { $group: { _id: '$conversationId', count: { $sum: 1 } } }
        ]);
        unreadAgg.forEach(row => { unreadMap[row._id.toString()] = row.count; });
      }
    } catch (unreadErr) {
      debugLog('Unread count aggregation failed (non-fatal):', unreadErr.message);
    }

    res.json({
      success: true,
      conversations: pageConversations.map(conv => {
        const isParticipant1 = conv.participant1Id?._id?.toString() === userId;
        const otherParticipant = isParticipant1 ? conv.participant2Id : conv.participant1Id;
        
        // Resolve profile picture - handle multiple formats from profile_data
        const profileData = otherParticipant?.profile_data || {};
        let profilePicture = profileData.profilePicture || null;
        
        // If profilePicture is empty but profile_picture exists as an object with url
        if (!profilePicture && profileData.profile_picture) {
          profilePicture = typeof profileData.profile_picture === 'object' 
            ? profileData.profile_picture.url 
            : profileData.profile_picture;
        }
        
        // Fallback to first photo in photos array
        if (!profilePicture && profileData.photos && profileData.photos.length > 0) {
          profilePicture = profileData.photos[0];
        }
        
        debugLog(`📸 Profile picture for ${otherParticipant?.username}:`, profilePicture);
        
        return {
          id: conv._id ? String(conv._id) : '',
          otherUser: {
            id: otherParticipant?._id ? String(otherParticipant._id) : '',
            username: otherParticipant?.username || 'Unknown User',
            verificationTier: otherParticipant?.verification_tier,
            profilePicture: profilePicture
          },
          // ✅ CRITICAL: Format preview on backend; frontend uses this directly
          lastMessage: normalizeLastMessagePreview(conv.lastMessage, conv.lastMessageType),
          lastMessageType: conv.lastMessageType || 'text',
          lastMessageTime: conv.lastMessageTime,
          unreadCount: unreadMap[conv._id.toString()] || 0,
          createdAt: conv.createdAt,
          status: conv.status || 'active'
        };
      }),
      nextCursor,
      hasMore
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch conversations' });
  }
});

/**
 * @route   GET /api/chat/messages/:conversationId
 * @desc    Get messages for a conversation
 * @access  Private
 */
router.get('/messages/:conversationId', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    
    debugLog(`📨 Fetching messages for conversation ${conversationId}, user ${userId}`);
    
    if (!isDatabaseAvailable()) {
      return res.status(503).json({ success: false, error: 'Database not available' });
    }

    // Verify user is part of this conversation
    let isMember = false;
    try {
      // Normalize userId for comparison (handle both string and ObjectId)
      const userIdStr = userId?.toString();
      
      // Get the conversation first
      const conv = await Conversation.findById(conversationId);
      if (conv) {
        // Check if user is participant (compare as strings to handle ObjectId vs string)
        const p1 = conv.participant1Id?.toString();
        const p2 = conv.participant2Id?.toString();
        const isParticipant1 = p1 === userIdStr;
        const isParticipant2 = p2 === userIdStr;
        const hiddenForUser =
          (isParticipant1 && conv.participant1Hidden === true) ||
          (isParticipant2 && conv.participant2Hidden === true);

        isMember = (isParticipant1 || isParticipant2) && !hiddenForUser;
        debugLog(`🔍 Member check: user=${userIdStr}, p1=${p1}, p2=${p2}, isMember=${isMember}`);
      }
    } catch (memberErr) {
      console.error('Member check error:', memberErr);
      // Return error instead of silently failing
      return res.status(500).json({ success: false, error: 'Failed to verify conversation access' });
    }
    
    if (!isMember) {
      debugLog(`⛔ User ${userId} not member of conversation ${conversationId}`);
      return res.status(403).json({ success: false, error: 'Access denied to this conversation' });
    }
    
    // Cursor-based pagination for efficient message loading
    // ?before=<messageId>  → load older messages (scroll up)
    // ?after=<messageId>   → load newer messages (real-time catch-up)
    // ?limit=N             → max messages per page (default 50, max 100)
    const { before, after, limit: rawLimit } = req.query;
    const pageLimit = Math.min(parseInt(rawLimit) || 50, 100);

    const query = { conversationId };
    let sortOrder = 1; // ascending by default (oldest → newest)

    if (before) {
      // Loading older messages — get messages created before the cursor
      query._id = { $lt: before };
      sortOrder = -1; // fetch newest-first, then reverse on client
    } else if (after) {
      // Loading newer messages — get messages created after the cursor
      query._id = { $gt: after };
    }

    let messages = await Message.find(query)
      .populate('senderId', 'username verificationTier')
      .sort({ createdAt: sortOrder })
      .limit(pageLimit);

    // When loading older messages (before cursor), reverse so messages arrive oldest→newest
    if (before) {
      messages = messages.reverse();
    }

    const hasMore = messages.length === pageLimit;
    
    res.json({
      success: true,
      messages: messages.map(msg => ({
        id: msg._id ? String(msg._id) : '',
        senderId: msg.senderId?._id ? String(msg.senderId._id) : '',
        senderName: msg.senderId?.username,
        senderTier: msg.senderId?.verificationTier,
        content: msg.content,
        messageType: msg.messageType,
        metadata: msg.metadata || {},
        createdAt: msg.createdAt,
        readAt: msg.readAt,
        isOwn: msg.senderId?._id?.toString() === userId
      })),
      pagination: {
        hasMore,
        limit: pageLimit,
        oldestId: messages.length > 0 ? String(messages[0]._id) : null,
        newestId: messages.length > 0 ? String(messages[messages.length - 1]._id) : null
      }
    });

  } catch (error) {
    console.error('❌ Get messages error:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch messages',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/chat/send
 * @desc    Send a message
 * @access  Private
 */
router.post('/send', authMiddleware, chatSendRateLimit, [
  body('conversationId').custom(isMongoIdOrUUID).withMessage('Invalid conversation ID format'),
  body('content').isLength({ min: 1, max: 2000 }),
  body('messageType').optional().isIn(['text', 'image', 'video', 'file', 'location', 'contact'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed',
        details: errors.array()
      });
    }

    const { conversationId, content, messageType = 'text', metadata = {} } = req.body;
    const senderId = req.user.userId;
    const resolvedMessageType = inferMessageType({ messageType, content, metadata });
    
    // Verify user is part of this conversation
    let isMember2 = false;
    let recipientId = null;
    try {
      const senderIdStr = senderId?.toString();
      const conv = await Conversation.findById(conversationId);
      if (conv) {
        const p1 = conv.participant1Id?.toString();
        const p2 = conv.participant2Id?.toString();
        isMember2 = (p1 === senderIdStr || p2 === senderIdStr);
        // Also get recipient ID for later use
        recipientId = (p1 === senderIdStr) ? p2 : p1;
        debugLog(`📤 Send member check: sender=${senderIdStr}, p1=${p1}, p2=${p2}, isMember=${isMember2}`);
      }
    } catch (memberErr) {
      console.error('Member check error:', memberErr);
      return res.status(500).json({ success: false, error: 'Failed to verify conversation access' });
    }
    if (!isMember2) return res.status(403).json({ success: false, error: 'Access denied to this conversation' });

    // Check if either user has blocked the other
    try {
      if (req.conversationService && typeof req.conversationService.isBlockedBetween === 'function') {
        const isBlocked = await req.conversationService.isBlockedBetween(senderId, recipientId);
        if (isBlocked) {
          return res.status(403).json({ success: false, error: 'Cannot send messages in this conversation' });
        }
      }
    } catch (blockErr) {
      console.error('Block check error:', blockErr);
      // Fail closed — if we can't verify block status, deny the message
      return res.status(500).json({ success: false, error: 'Failed to verify messaging permissions' });
    }

    // Content moderation / fraud detection
    try {
      if (req.fraudDetection && typeof req.fraudDetection.analyzeMessageRisk === 'function') {
        const modResult = await req.fraudDetection.analyzeMessageRisk({
          senderId,
          conversationId,
          content,
          messageType: resolvedMessageType,
          metadata
        });
        // If risk is above threshold, block or flag. Threshold is configurable via env
        const riskThreshold = parseFloat(process.env.MESSAGE_RISK_BLOCK_THRESHOLD || '0.7');
        if (modResult && typeof modResult.score === 'number' && modResult.score >= riskThreshold) {
          // Optionally log to fraud_logs via service; here we return 403
          return res.status(403).json({ success: false, error: 'Message blocked due to policy violation' });
        }
      }
    } catch (modErr) {
      console.error('Message moderation error:', modErr);
      // Proceed with caution - if moderation service fails, allow message but log
    }

    // Persist message and update conversation atomically via ConversationService
    try {
      let message;
      if (req.conversationService && typeof req.conversationService.insertMessageTx === 'function') {
        message = await req.conversationService.insertMessageTx({ conversationId, senderId, content, messageType: resolvedMessageType, metadata });
      } else {
        // Fallback: direct insert with MongoDB
        const newMessage = await Message.create({
          conversationId,
          senderId,
          content,
          messageType: resolvedMessageType,
          metadata: metadata || {}
        });
        message = newMessage;
        
        // Format a human-readable preview for the conversation sidebar
        const lastMessagePreview = formatMessagePreview(content, resolvedMessageType, metadata || {});

        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: lastMessagePreview,
          lastMessageType: resolvedMessageType,
          lastMessageTime: newMessage.createdAt,
          updatedAt: new Date()
        });
      }

      const canonicalMessageId = String(message._id || message.id || '');
      const canonicalConversationId = String(conversationId);
      const canonicalSenderId = String(senderId);

      const payload = {
        id: canonicalMessageId,
        conversationId: canonicalConversationId,
        senderId: canonicalSenderId,
        senderName: req.user.username || 'Someone',
        content,
        messageType: resolvedMessageType,
        metadata: message.metadata || metadata || {},
        createdAt: message.createdAt
      };

      // Emit after successful commit
      req.io.to(`conversation_${canonicalConversationId}`).emit('new_message', payload);

      // Also emit to recipient's user room so they get it even when viewing a different conversation
      if (recipientId) {
        req.io.to(`user_${recipientId}`).emit('new_message', payload);
      }

      // Notify the recipient — reuse recipientId computed during membership check above
      try {
        if (recipientId) {
          const senderName = req.user.username || 'Someone';
          
          // Format notification preview based on message type — never show raw URLs for media
          const preview = formatMessagePreview(content, resolvedMessageType, metadata, 50);
          
          await NotificationService.createAndEmit(req.io, {
            userId: recipientId,
            type: 'message',
            title: `New message from ${senderName}`,
            message: preview,
            data: { conversationId: canonicalConversationId, senderId: canonicalSenderId, messageId: canonicalMessageId }
          });
        }
      } catch (notifErr) {
        console.error('Failed to save message notification:', notifErr);
        // Don't fail the message send if notification fails
      }

      res.json({ success: true, message: payload });
    } catch (txErr) {
      console.error('Send message transaction error:', txErr);
      res.status(500).json({ success: false, error: 'Failed to send message' });
    }

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

/**
 * @route   POST /api/chat/conversation
 * @desc    Create or get existing conversation with another user
 * @access  Private
 */
router.post('/conversation', authMiddleware, [
  body('otherUserId').custom(isMongoIdOrUUID).withMessage('Invalid user ID format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed',
        details: errors.array()
      });
    }

    const { otherUserId } = req.body;
    const userId = req.user.userId;
    
    if (userId === otherUserId) {
      return res.status(400).json({ success: false, error: 'Cannot create conversation with yourself' });
    }
    
    const limitCheck = await checkMessagingLimit();
    
    // Check if conversation already exists
    let existingConv = await Conversation.findOne({
      $or: [
        { participant1Id: userId, participant2Id: otherUserId },
        { participant1Id: otherUserId, participant2Id: userId }
      ]
    });
    
    let conversationData;
    if (!existingConv) {
      // Create new conversation via service or direct insert
      // Normalize participant order to prevent duplicates (lower ID always goes first)
      const [p1, p2] = [userId, otherUserId].sort();
      if (req.conversationService && typeof req.conversationService.createOrGetConversation === 'function') {
        conversationData = await req.conversationService.createOrGetConversation(p1, p2);
      } else {
        // Fallback: atomic upsert to prevent race condition duplicates
        const conv = await Conversation.findOneAndUpdate(
          { participant1Id: p1, participant2Id: p2 },
          {
            $setOnInsert: {
              participant1Id: p1,
              participant2Id: p2,
              status: 'active',
              participant1Hidden: false,
              participant2Hidden: false
            }
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        conversationData = { id: conv._id, created_at: conv.createdAt };
      }
    } else {
      const senderIsParticipant1 = String(existingConv.participant1Id) === String(userId);
      await Conversation.findByIdAndUpdate(existingConv._id, {
        status: 'active',
        ...(senderIsParticipant1
          ? { participant1Hidden: false, participant1HiddenAt: null }
          : { participant2Hidden: false, participant2HiddenAt: null }),
        updatedAt: new Date()
      });
      conversationData = { id: existingConv._id, created_at: existingConv.createdAt };
    }
    
    res.json({
      success: true,
      conversationId: conversationData.id,
      createdAt: conversationData.created_at,
      messagingLimit: {
        uniqueContacts: limitCheck.uniqueContacts,
        maxContacts: limitCheck.maxContacts,
        remainingContacts: limitCheck.remainingContacts
      }
    });

  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create conversation' });
  }
});

/**
 * @route   POST /api/chat/start
 * @desc    Alias for /conversation - Start or get conversation with another user (mobile app compatibility)
 * @access  Private
 */
router.post('/start', authMiddleware, [
  body('otherUserId').optional().custom(isMongoIdOrUUID).withMessage('Invalid user ID format'),
  body('recipientId').optional().custom(isMongoIdOrUUID).withMessage('Invalid recipient ID format'),
  body('userId').optional().custom(isMongoIdOrUUID).withMessage('Invalid user ID format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed',
        details: errors.array()
      });
    }

    // Support multiple field names for flexibility
    const otherUserId = req.body.otherUserId || req.body.recipientId || req.body.userId;
    const userId = req.user.userId;
    
    if (!otherUserId) {
      return res.status(400).json({ success: false, error: 'otherUserId, recipientId, or userId is required' });
    }
    
    if (userId === otherUserId) {
      return res.status(400).json({ success: false, error: 'Cannot create conversation with yourself' });
    }
    
    const limitCheck = await checkMessagingLimit();
    
    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      $or: [
        { participant1Id: userId, participant2Id: otherUserId },
        { participant1Id: otherUserId, participant2Id: userId }
      ]
    });
    
    if (!conversation) {
      // Normalize participant order to prevent duplicates (lower ID always goes first)
      const [p1, p2] = [userId, otherUserId].sort();
      // Atomic upsert to prevent race condition duplicates
      conversation = await Conversation.findOneAndUpdate(
        { participant1Id: p1, participant2Id: p2 },
        {
          $setOnInsert: {
            participant1Id: p1,
            participant2Id: p2,
            status: 'active',
            participant1Hidden: false,
            participant2Hidden: false
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } else {
      const senderIsParticipant1 = String(conversation.participant1Id) === String(userId);
      await Conversation.findByIdAndUpdate(conversation._id, {
        status: 'active',
        ...(senderIsParticipant1
          ? { participant1Hidden: false, participant1HiddenAt: null }
          : { participant2Hidden: false, participant2HiddenAt: null }),
        updatedAt: new Date()
      });
    }
    
    res.json({
      success: true,
      conversationId: conversation._id,
      createdAt: conversation.createdAt,
      messagingLimit: {
        uniqueContacts: limitCheck.uniqueContacts,
        maxContacts: limitCheck.maxContacts,
        remainingContacts: limitCheck.remainingContacts
      }
    });

  } catch (error) {
    console.error('Start conversation error:', error);
    res.status(500).json({ success: false, error: 'Failed to start conversation' });
  }
});

/**
 * @route   POST /api/chat/read/:conversationId
 * @desc    Mark messages as read
 * @access  Private
 */
router.post('/read/:conversationId', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    
    // Verify user is a participant of this conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      $or: [
        { participant1Id: userId, participant1Hidden: { $ne: true } },
        { participant2Id: userId, participant2Hidden: { $ne: true } }
      ]
    });
    if (!conversation) {
      return res.status(403).json({ success: false, error: 'Not a participant of this conversation' });
    }
    
    // Mark unread messages as read
    await Message.updateMany(
      {
        conversationId,
        senderId: { $ne: userId },
        readAt: null
      },
      { readAt: new Date() }
    );

    // Emit read receipt via socket so sender gets real-time tick updates
    if (req.io) {
      const readPayload = {
        userId,
        conversationId,
        timestamp: new Date().toISOString()
      };
      req.io.to(`conversation_${conversationId}`).emit('message_read', readPayload);

      const otherUserId = conversation.participant1Id?.toString() === userId
        ? conversation.participant2Id?.toString()
        : conversation.participant1Id?.toString();
      if (otherUserId) {
        req.io.to(`user_${otherUserId}`).emit('message_read', readPayload);
      }
    }
    
    res.json({ success: true, message: 'Messages marked as read' });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark messages as read' });
  }
});

/**
 * @route   DELETE /api/chat/messages/:messageId
 * @desc    Delete a single message sent by the authenticated user
 * @access  Private
 */
router.delete('/messages/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.userId;

    if (!messageId) {
      return res.status(400).json({ success: false, error: 'Message ID is required' });
    }

    const message = await Message.findById(messageId).select('conversationId senderId createdAt');
    if (!message) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    // Sender-only delete to prevent tampering
    if (String(message.senderId) !== String(userId)) {
      return res.status(403).json({ success: false, error: 'You can only delete your own messages' });
    }

    // Verify user still belongs to conversation
    const conversation = await Conversation.findOne({
      _id: message.conversationId,
      $or: [
        { participant1Id: userId, participant1Hidden: { $ne: true } },
        { participant2Id: userId, participant2Hidden: { $ne: true } }
      ]
    }).select('_id participant1Id participant2Id');

    if (!conversation) {
      return res.status(403).json({ success: false, error: 'Access denied to this conversation' });
    }

    await Message.deleteOne({ _id: messageId });

    // Recompute conversation preview from latest remaining message
    const latest = await Message.findOne({ conversationId: message.conversationId })
      .sort({ createdAt: -1 })
      .select('content messageType metadata createdAt');

    let nextPreview = '';
    let nextTime = null;
    if (latest) {
      nextPreview = formatMessagePreview(latest.content, latest.messageType, latest.metadata || {});
      nextTime = latest.createdAt || null;
    }

    await Conversation.findByIdAndUpdate(message.conversationId, {
      lastMessage: nextPreview,
      lastMessageType: latest?.messageType || 'text',
      lastMessageTime: nextTime,
      updatedAt: new Date()
    });

    if (req.io) {
      const payload = {
        messageId,
        conversationId: String(message.conversationId),
        deletedBy: String(userId),
        timestamp: new Date().toISOString()
      };

      req.io.to(`conversation_${String(message.conversationId)}`).emit('message_deleted', payload);

      const otherUserId = String(conversation.participant1Id) === String(userId)
        ? String(conversation.participant2Id)
        : String(conversation.participant1Id);

      if (otherUserId) {
        req.io.to(`user_${otherUserId}`).emit('message_deleted', payload);
      }
    }

    res.json({ success: true, message: 'Message deleted' });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

/**
 * @route   DELETE /api/chat/conversations/:conversationId
 * @route   DELETE /api/chat/conversation/:conversationId (alias)
 * @desc    Delete a conversation for the current user (non-destructive soft-delete)
 * @access  Private
 */
const deleteConversationHandler = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;

    if (!isDatabaseAvailable()) {
      return res.status(503).json({ success: false, error: 'Database not available' });
    }

    // Verify user is part of this conversation
    const conv = await Conversation.findById(conversationId);
    if (!conv) {
      return res.status(404).json({ success: false, error: 'Conversation not found' });
    }

    const userIdStr = userId?.toString();
    const p1 = conv.participant1Id?.toString();
    const p2 = conv.participant2Id?.toString();
    const isMember = (p1 === userIdStr || p2 === userIdStr);
    if (!isMember) {
      return res.status(403).json({ success: false, error: 'Access denied to this conversation' });
    }

    const isParticipant1 = p1 === userIdStr;
    const hiddenField = isParticipant1 ? 'participant1Hidden' : 'participant2Hidden';
    const hiddenAtField = isParticipant1 ? 'participant1HiddenAt' : 'participant2HiddenAt';

    if (conv[hiddenField] === true) {
      return res.json({ success: true, message: 'Conversation already deleted for this user' });
    }

    conv[hiddenField] = true;
    conv[hiddenAtField] = new Date();
    conv.updatedAt = new Date();

    const bothHidden = Boolean(conv.participant1Hidden) && Boolean(conv.participant2Hidden);
    if (bothHidden) {
      await Message.deleteMany({ conversationId });
      await Conversation.deleteOne({ _id: conversationId });
      return res.json({ success: true, message: 'Conversation deleted for both participants' });
    }

    await conv.save();
    res.json({ success: true, message: 'Conversation deleted for you' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete conversation' });
  }
};

router.delete('/conversations/:conversationId', authMiddleware, deleteConversationHandler);
router.delete('/conversation/:conversationId', authMiddleware, deleteConversationHandler);

/**
 * @route   POST /api/chat/video-call
 * @desc    Initiate or join video call
 * @access  Private
 */
router.post('/video-call', authMiddleware, [
  body('conversationId').custom(isMongoIdOrUUID).withMessage('Invalid conversation ID format'),
  body('action').isIn(['initiate', 'join', 'leave']),
  body('roomId').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed',
        details: errors.array()
      });
    }

    const { conversationId, action, roomId } = req.body;
    const userId = req.user.userId;
    
    // Verify user is part of this conversation
    const conversation = await Conversation.findOne({
      _id: conversationId,
      $or: [
        { participant1Id: userId },
        { participant2Id: userId }
      ]
    });
    
    if (!conversation) {
      return res.status(403).json({ success: false, error: 'Access denied to this conversation' });
    }
    
    let generatedRoomId = roomId;
    if (action === 'initiate' && !roomId) {
      generatedRoomId = `video_${conversationId}_${Date.now()}`;
    }
    
    // Emit video call event to other participant
    req.io.to(`conversation_${conversationId}`).emit('video_call', {
      action,
      roomId: generatedRoomId,
      initiatorId: userId,
      conversationId
    });
    
    res.json({
      success: true,
      action,
      roomId: generatedRoomId
    });

  } catch (error) {
    console.error('Video call error:', error);
    res.status(500).json({ success: false, error: 'Failed to handle video call' });
  }
});

/**
 * @route   POST /api/chat/block-user
 * @desc    Block a user from messaging
 * @access  Private
 */
router.post('/block-user', authMiddleware, [
  body('userId').custom(isMongoIdOrUUID).withMessage('Invalid user ID format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed',
        details: errors.array()
      });
    }

    const { userId: blockedUserId } = req.body;
    const currentUserId = req.user.userId;
    
    if (currentUserId === blockedUserId) {
      return res.status(400).json({ success: false, error: 'Cannot block yourself' });
    }
    
    try {
      const result = await req.conversationService.blockUser(currentUserId, blockedUserId);
      res.json(result);
    } catch (err) {
      console.error('Block user error:', err);
      res.status(500).json({ success: false, error: 'Failed to block user' });
    }

  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ success: false, error: 'Failed to block user' });
  }
});

/**
 * @route   GET /api/chat/messaging-limit
 * @desc    Get current messaging access status
 * @access  Private
 */
router.get('/messaging-limit', authMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      isSubscribed: false,
      unlimited: true,
      uniqueContacts: 0,
      maxContacts: null,
      remainingContacts: null,
      requiresSubscription: false
    });

  } catch (error) {
    console.error('Get messaging limit error:', error);
    res.status(500).json({ success: false, error: 'Failed to get messaging limit' });
  }
});

module.exports = { router };
