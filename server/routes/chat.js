const express = require('express');
const { Message, Conversation, User, isDatabaseAvailable } = require('../config/database');
const { authMiddleware } = require('./auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const NotificationService = require('../services/NotificationService');

// Maximum unique contacts for non-subscribers
const FREE_TIER_MAX_CONTACTS = 3;

/**
 * Check if user can message new contacts (subscription limit)
 * @param {string} userId - Current user ID
 * @returns {Object} { canMessage: boolean, uniqueContacts: number, maxContacts: number, requiresSubscription: boolean }
 */
const checkMessagingLimit = async (userId, targetUserId) => {
  try {
    // Get user to check subscription status
    const user = await User.findById(userId).select('is_subscribed subscription_expires_at');
    
    // Subscribed users have unlimited messaging
    if (user?.is_subscribed) {
      const expiresAt = user.subscription_expires_at ? new Date(user.subscription_expires_at) : null;
      if (!expiresAt || expiresAt > new Date()) {
        return { canMessage: true, uniqueContacts: 0, maxContacts: Infinity, requiresSubscription: false };
      }
    }

    // Check existing conversations for this user
    const existingConversations = await Conversation.find({
      $or: [
        { participant1Id: userId },
        { participant2Id: userId }
      ]
    }).select('participant1Id participant2Id');

    // Get unique contact IDs
    const uniqueContactIds = new Set();
    existingConversations.forEach(conv => {
      const contactId = conv.participant1Id?.toString() === userId 
        ? conv.participant2Id?.toString() 
        : conv.participant1Id?.toString();
      if (contactId) uniqueContactIds.add(contactId);
    });

    // Check if already in conversation with this target
    const alreadyInConversation = uniqueContactIds.has(targetUserId);
    
    // If already in conversation, can continue messaging
    if (alreadyInConversation) {
      return { 
        canMessage: true, 
        uniqueContacts: uniqueContactIds.size, 
        maxContacts: FREE_TIER_MAX_CONTACTS, 
        requiresSubscription: false,
        isExistingContact: true
      };
    }

    // Check if trying to add new contact exceeds limit
    if (uniqueContactIds.size >= FREE_TIER_MAX_CONTACTS) {
      return { 
        canMessage: false, 
        uniqueContacts: uniqueContactIds.size, 
        maxContacts: FREE_TIER_MAX_CONTACTS, 
        requiresSubscription: true,
        message: `Free users can only message ${FREE_TIER_MAX_CONTACTS} unique people. Subscribe to message unlimited contacts.`
      };
    }

    return { 
      canMessage: true, 
      uniqueContacts: uniqueContactIds.size, 
      maxContacts: FREE_TIER_MAX_CONTACTS, 
      requiresSubscription: false,
      remainingContacts: FREE_TIER_MAX_CONTACTS - uniqueContactIds.size
    };
  } catch (error) {
    console.error('Error checking messaging limit:', error);
    // Default to allowing message on error
    return { canMessage: true, uniqueContacts: 0, maxContacts: FREE_TIER_MAX_CONTACTS, requiresSubscription: false };
  }
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

    // Get all conversations the user is part of
    const conversations = await Conversation.find({
      $or: [
        { participant1Id: userId },
        { participant2Id: userId }
      ]
    }).select('_id');

    const conversationIds = conversations.map(c => c._id);

    // Count unread messages where user is recipient (not sender)
    const unreadCount = await Message.countDocuments({
      conversationId: { $in: conversationIds },
      senderId: { $ne: userId },
      readAt: null
    });
    
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
    
    if (!isDatabaseAvailable()) {
      return res.json({ conversations: [] });
    }

    // Try to get conversations, return empty array if user doesn't exist or query fails
    let conversations;
    try {
      conversations = await Conversation.find({
        $or: [
          { participant1Id: userId },
          { participant2Id: userId }
        ]
      })
      .populate('participant1Id', 'username verification_tier profile_data')
      .populate('participant2Id', 'username verification_tier profile_data')
      .sort({ lastMessageTime: -1 });
    } catch (dbError) {
      console.log('Conversations query failed:', dbError.message);
      return res.json({ conversations: [] });
    }

    res.json({
      conversations: conversations.map(conv => {
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
        
        console.log(`📸 Profile picture for ${otherParticipant?.username}:`, profilePicture);
        
        return {
          id: conv._id,
          otherUser: {
            id: otherParticipant?._id,
            username: otherParticipant?.username,
            verificationTier: otherParticipant?.verification_tier,
            profilePicture: profilePicture
          },
          lastMessage: conv.lastMessage,
          lastMessageTime: conv.lastMessageTime,
          createdAt: conv.createdAt,
          status: conv.status || 'active'
        };
      })
    });

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
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
    
    console.log(`📨 Fetching messages for conversation ${conversationId}, user ${userId}`);
    
    if (!isDatabaseAvailable()) {
      return res.status(503).json({ error: 'Database not available' });
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
        isMember = (p1 === userIdStr || p2 === userIdStr);
        console.log(`🔍 Member check: user=${userIdStr}, p1=${p1}, p2=${p2}, isMember=${isMember}`);
      }
    } catch (memberErr) {
      console.error('Member check error:', memberErr);
      // Return error instead of silently failing
      return res.status(500).json({ error: 'Failed to verify conversation access' });
    }
    
    if (!isMember) {
      console.log(`⛔ User ${userId} not member of conversation ${conversationId}`);
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }
    
    const messages = await Message.find({ conversationId })
      .populate('senderId', 'username verificationTier')
      .sort({ createdAt: 1 });
    
    res.json({
      messages: messages.map(msg => ({
        id: msg._id,
        senderId: msg.senderId?._id,
        senderName: msg.senderId?.username,
        senderTier: msg.senderId?.verificationTier,
        content: msg.content,
        messageType: msg.messageType,
        metadata: msg.metadata || {},
        createdAt: msg.createdAt,
        readAt: msg.readAt,
        isOwn: msg.senderId?._id?.toString() === userId
      }))
    });

  } catch (error) {
    console.error('❌ Get messages error:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch messages',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/chat/send
 * @desc    Send a message
 * @access  Private
 */
router.post('/send', authMiddleware, [
  body('conversationId').custom(isMongoIdOrUUID).withMessage('Invalid conversation ID format'),
  body('content').isLength({ min: 1, max: 2000 }),
  body('messageType').optional().isIn(['text', 'image', 'video', 'file', 'location', 'contact'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { conversationId, content, messageType = 'text', metadata = {} } = req.body;
    const senderId = req.user.userId;
    
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
        console.log(`📤 Send member check: sender=${senderIdStr}, p1=${p1}, p2=${p2}, isMember=${isMember2}`);
      }
    } catch (memberErr) {
      console.error('Member check error:', memberErr);
      return res.status(500).json({ error: 'Failed to verify conversation access' });
    }
    if (!isMember2) return res.status(403).json({ error: 'Access denied to this conversation' });

    // Content moderation / fraud detection
    try {
      if (req.fraudDetection && typeof req.fraudDetection.analyzeMessageRisk === 'function') {
        const modResult = await req.fraudDetection.analyzeMessageRisk({
          senderId,
          conversationId,
          content,
          messageType,
          metadata
        });
        // If risk is above threshold, block or flag. Threshold is configurable via env
        const riskThreshold = parseFloat(process.env.MESSAGE_RISK_BLOCK_THRESHOLD || '0.7');
        if (modResult && typeof modResult.score === 'number' && modResult.score >= riskThreshold) {
          // Optionally log to fraud_logs via service; here we return 403
          return res.status(403).json({ error: 'Message blocked due to policy violation' });
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
        message = await req.conversationService.insertMessageTx({ conversationId, senderId, content, messageType, metadata });
      } else {
        // Fallback: direct insert with MongoDB
        const newMessage = await Message.create({
          conversationId,
          senderId,
          content,
          messageType,
          metadata: metadata || {}
        });
        message = newMessage;
        
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessage: content,
          lastMessageTime: newMessage.createdAt,
          updatedAt: new Date()
        });
      }

      const payload = {
        id: message._id,
        conversationId,
        senderId,
        content,
        messageType,
        metadata: message.metadata || metadata || {},
        createdAt: message.createdAt
      };

      // Emit after successful commit
      req.io.to(`conversation_${conversationId}`).emit('new_message', payload);

      // Get the recipient (other participant) and save notification
      try {
        const conv = await Conversation.findById(conversationId).select('participant1Id participant2Id');
        
        if (conv) {
          const recipientId = conv.participant1Id?.toString() === senderId ? conv.participant2Id : conv.participant1Id;
          
          // Get sender name for notification
          const sender = await User.findById(senderId).select('username');
          const senderName = sender?.username || 'Someone';
          
          // Truncate message for notification preview
          const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
          
          await NotificationService.createAndEmit(req.io, {
            userId: recipientId,
            type: 'message',
            title: `New message from ${senderName}`,
            message: preview,
            data: { conversationId, senderId, messageId: message._id }
          });
        }
      } catch (notifErr) {
        console.error('Failed to save message notification:', notifErr);
        // Don't fail the message send if notification fails
      }

      res.json({ message: payload });
    } catch (txErr) {
      console.error('Send message transaction error:', txErr);
      res.status(500).json({ error: 'Failed to send message' });
    }

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
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
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { otherUserId } = req.body;
    const userId = req.user.userId;
    
    if (userId === otherUserId) {
      return res.status(400).json({ error: 'Cannot create conversation with yourself' });
    }
    
    // Check messaging limit for non-subscribers
    const limitCheck = await checkMessagingLimit(userId, otherUserId);
    if (!limitCheck.canMessage) {
      return res.status(403).json({ 
        error: 'subscription_required',
        message: limitCheck.message,
        uniqueContacts: limitCheck.uniqueContacts,
        maxContacts: limitCheck.maxContacts,
        requiresSubscription: true
      });
    }
    
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
      if (req.conversationService && typeof req.conversationService.createOrGetConversation === 'function') {
        conversationData = await req.conversationService.createOrGetConversation(userId, otherUserId);
      } else {
        // Fallback: direct insert
        const newConv = await Conversation.create({
          participant1Id: userId,
          participant2Id: otherUserId
        });
        conversationData = { id: newConv._id, created_at: newConv.createdAt };
      }
    } else {
      conversationData = { id: existingConv._id, created_at: existingConv.createdAt };
    }
    
    res.json({
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
    res.status(500).json({ error: 'Failed to create conversation' });
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
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    // Support multiple field names for flexibility
    const otherUserId = req.body.otherUserId || req.body.recipientId || req.body.userId;
    const userId = req.user.userId;
    
    if (!otherUserId) {
      return res.status(400).json({ error: 'otherUserId, recipientId, or userId is required' });
    }
    
    if (userId === otherUserId) {
      return res.status(400).json({ error: 'Cannot create conversation with yourself' });
    }
    
    // Check messaging limit for non-subscribers
    const limitCheck = await checkMessagingLimit(userId, otherUserId);
    if (!limitCheck.canMessage) {
      return res.status(403).json({ 
        error: 'subscription_required',
        message: limitCheck.message,
        uniqueContacts: limitCheck.uniqueContacts,
        maxContacts: limitCheck.maxContacts,
        requiresSubscription: true
      });
    }
    
    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      $or: [
        { participant1Id: userId, participant2Id: otherUserId },
        { participant1Id: otherUserId, participant2Id: userId }
      ]
    });
    
    if (!conversation) {
      // Create new conversation
      conversation = await Conversation.create({
        participant1Id: userId,
        participant2Id: otherUserId
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
    res.status(500).json({ error: 'Failed to start conversation' });
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
    
    // Mark unread messages as read
    await Message.updateMany(
      {
        conversationId,
        senderId: { $ne: userId },
        readAt: null
      },
      { readAt: new Date() }
    );
    
    res.json({ message: 'Messages marked as read' });

  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

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
      return res.status(400).json({
        error: 'Validation failed',
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
      return res.status(403).json({ error: 'Access denied to this conversation' });
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
    res.status(500).json({ error: 'Failed to handle video call' });
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
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { userId: blockedUserId } = req.body;
    const currentUserId = req.user.userId;
    
    if (currentUserId === blockedUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }
    
    try {
      const result = await req.conversationService.blockUser(currentUserId, blockedUserId);
      res.json(result);
    } catch (err) {
      console.error('Block user error:', err);
      res.status(500).json({ error: 'Failed to block user' });
    }

  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

/**
 * @route   DELETE /api/chat/conversation/:conversationId
 * @route   DELETE /api/chat/conversations/:conversationId (alias)
 * @desc    Delete a conversation
 * @access  Private
 */
const deleteConversationHandler = async (req, res) => {
  try {
    const { conversationId } = req.params;
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
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }
    
    // Soft delete conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      status: 'deleted',
      updatedAt: new Date()
    });
    
    res.json({ message: 'Conversation deleted successfully' });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
};

router.delete('/conversation/:conversationId', authMiddleware, deleteConversationHandler);
router.delete('/conversations/:conversationId', authMiddleware, deleteConversationHandler);

/**
 * @route   GET /api/chat/messaging-limit
 * @desc    Get user's messaging limit status (for non-subscribers)
 * @access  Private
 */
router.get('/messaging-limit', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user subscription status
    const user = await User.findById(userId).select('is_subscribed subscription_expires_at');
    
    const isSubscribed = user?.is_subscribed && 
      (!user.subscription_expires_at || new Date(user.subscription_expires_at) > new Date());
    
    if (isSubscribed) {
      return res.json({
        success: true,
        isSubscribed: true,
        uniqueContacts: 0,
        maxContacts: Infinity,
        remainingContacts: Infinity,
        requiresSubscription: false
      });
    }

    // Count unique contacts for non-subscribers
    const existingConversations = await Conversation.find({
      $or: [
        { participant1Id: userId },
        { participant2Id: userId }
      ]
    }).select('participant1Id participant2Id');

    const uniqueContactIds = new Set();
    existingConversations.forEach(conv => {
      const contactId = conv.participant1Id?.toString() === userId 
        ? conv.participant2Id?.toString() 
        : conv.participant1Id?.toString();
      if (contactId) uniqueContactIds.add(contactId);
    });

    const uniqueContacts = uniqueContactIds.size;
    const remainingContacts = Math.max(0, FREE_TIER_MAX_CONTACTS - uniqueContacts);

    res.json({
      success: true,
      isSubscribed: false,
      uniqueContacts,
      maxContacts: FREE_TIER_MAX_CONTACTS,
      remainingContacts,
      requiresSubscription: remainingContacts === 0
    });

  } catch (error) {
    console.error('Get messaging limit error:', error);
    res.status(500).json({ error: 'Failed to get messaging limit' });
  }
});

module.exports = { router };
