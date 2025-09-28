const express = require('express');
const { query } = require('../config/database');
const { authMiddleware } = require('./auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

/**
 * @route   GET /api/chat/conversations
 * @desc    Get user's conversations
 * @access  Private
 */
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const conversations = await query(`
      SELECT DISTINCT 
        c.id,
        c.participant1_id,
        c.participant2_id,
        c.last_message,
        c.last_message_time,
        c.created_at,
        c.status,
        u1.username as participant1_name,
        u2.username as participant2_name,
        u1.verification_tier as participant1_tier,
        u2.verification_tier as participant2_tier,
        u1.profile_data->>'profile_picture' as participant1_picture,
        u2.profile_data->>'profile_picture' as participant2_picture
      FROM conversations c
      JOIN users u1 ON c.participant1_id = u1.id
      JOIN users u2 ON c.participant2_id = u2.id
      WHERE c.participant1_id = $1 OR c.participant2_id = $1
      ORDER BY c.last_message_time DESC
    `, [userId]);

    res.json({
      conversations: conversations.rows.map(conv => ({
        id: conv.id,
        otherUser: {
          id: conv.participant1_id === userId ? conv.participant2_id : conv.participant1_id,
          username: conv.participant1_id === userId ? conv.participant2_name : conv.participant1_name,
          verificationTier: conv.participant1_id === userId ? conv.participant2_tier : conv.participant1_tier,
          profilePicture: conv.participant1_id === userId ? conv.participant2_picture : conv.participant1_picture
        },
        lastMessage: conv.last_message,
        lastMessageTime: conv.last_message_time,
        createdAt: conv.created_at,
        status: conv.status
      }))
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
    
    // Verify user is part of this conversation
    const conversation = await query(`
      SELECT id FROM conversations 
      WHERE id = $1 AND (participant1_id = $2 OR participant2_id = $2)
    `, [conversationId, userId]);
    
    if (conversation.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }
    
    const messages = await query(`
      SELECT 
        m.id,
        m.sender_id,
        m.content,
        m.message_type,
        m.created_at,
        m.read_at,
        m.metadata,
        u.username as sender_name,
        u.verification_tier as sender_tier
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = $1
      ORDER BY m.created_at ASC
    `, [conversationId]);
    
    res.json({
      messages: messages.rows.map(msg => ({
        id: msg.id,
        senderId: msg.sender_id,
        senderName: msg.sender_name,
        senderTier: msg.sender_tier,
        content: msg.content,
        messageType: msg.message_type,
        metadata: msg.metadata || {},
        createdAt: msg.created_at,
        readAt: msg.read_at,
        isOwn: msg.sender_id === userId
      }))
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * @route   POST /api/chat/send
 * @desc    Send a message
 * @access  Private
 */
router.post('/send', authMiddleware, [
  body('conversationId').isUUID(),
  body('content').isLength({ min: 1, max: 2000 }),
  body('messageType').isIn(['text', 'image', 'video', 'file', 'location', 'contact'])
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
    const conversation = await query(`
      SELECT id FROM conversations 
      WHERE id = $1 AND (participant1_id = $2 OR participant2_id = $2)
    `, [conversationId, senderId]);
    
    if (conversation.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }
    
    // Insert message
    const messageResult = await query(`
      INSERT INTO messages (conversation_id, sender_id, content, message_type, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, created_at
    `, [conversationId, senderId, content, messageType, JSON.stringify(metadata)]);
    
    const message = messageResult.rows[0];
    
    // Update conversation last message
    await query(`
      UPDATE conversations 
      SET last_message = $1, last_message_time = $2
      WHERE id = $3
    `, [content, message.created_at, conversationId]);
    
    // Emit to socket.io for real-time delivery
    req.io.to(`conversation_${conversationId}`).emit('new_message', {
      id: message.id,
      conversationId,
      senderId,
      content,
      messageType,
      metadata,
      createdAt: message.created_at
    });
    
    res.json({
      message: 'Message sent successfully',
      messageId: message.id,
      createdAt: message.created_at
    });

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
  body('otherUserId').isUUID()
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
    
    // Check if conversation already exists
    let conversation = await query(`
      SELECT id FROM conversations 
      WHERE (participant1_id = $1 AND participant2_id = $2) 
         OR (participant1_id = $2 AND participant2_id = $1)
    `, [userId, otherUserId]);
    
    if (conversation.rows.length === 0) {
      // Create new conversation
      conversation = await query(`
        INSERT INTO conversations (participant1_id, participant2_id, status)
        VALUES ($1, $2, 'active')
        RETURNING id, created_at
      `, [userId, otherUserId]);
    }
    
    res.json({
      conversationId: conversation.rows[0].id,
      createdAt: conversation.rows[0].created_at
    });

  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
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
    await query(`
      UPDATE messages 
      SET read_at = CURRENT_TIMESTAMP
      WHERE conversation_id = $1 
        AND sender_id != $2 
        AND read_at IS NULL
    `, [conversationId, userId]);
    
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
  body('conversationId').isUUID(),
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
    const conversation = await query(`
      SELECT id FROM conversations 
      WHERE id = $1 AND (participant1_id = $2 OR participant2_id = $2)
    `, [conversationId, userId]);
    
    if (conversation.rows.length === 0) {
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
  body('userId').isUUID()
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
    
    // Add to blocked users table or update existing block
    await query(`
      INSERT INTO blocked_users (blocker_id, blocked_id, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (blocker_id, blocked_id) DO NOTHING
    `, [currentUserId, blockedUserId]);
    
    // Close any existing conversations
    await query(`
      UPDATE conversations 
      SET status = 'blocked'
      WHERE (participant1_id = $1 AND participant2_id = $2) 
         OR (participant1_id = $2 AND participant2_id = $1)
    `, [currentUserId, blockedUserId]);
    
    res.json({ message: 'User blocked successfully' });

  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

/**
 * @route   DELETE /api/chat/conversation/:conversationId
 * @desc    Delete a conversation
 * @access  Private
 */
router.delete('/conversation/:conversationId', authMiddleware, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.userId;
    
    // Verify user is part of this conversation
    const conversation = await query(`
      SELECT id FROM conversations 
      WHERE id = $1 AND (participant1_id = $2 OR participant2_id = $2)
    `, [conversationId, userId]);
    
    if (conversation.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }
    
    // Soft delete conversation
    await query(`
      UPDATE conversations 
      SET status = 'deleted', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [conversationId]);
    
    res.json({ message: 'Conversation deleted successfully' });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

module.exports = { router };
