const express = require('express');
const { authMiddleware } = require('./auth');
const { query } = require('../config/database');
const router = express.Router();

/**
 * Milestone Request System
 * 
 * Allows clients and providers to request payment holds (milestones) in chat
 * 
 * Flow:
 * 1. Provider sends payment request to client (provider_request)
 * 2. Client can accept/decline
 * 3. If accepted, client pays and money is held in escrow
 * 
 * OR:
 * 1. Client requests provider to set up payment (client_request)
 * 2. Provider accepts and sends amount
 * 3. Client pays and money is held
 */

/**
 * @route   POST /api/milestone/request
 * @desc    Send a milestone/payment request
 * @access  Private
 */
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const senderId = req.user.userId;
    const { recipientId, amount, description, requestType } = req.body;

    if (!recipientId || !amount) {
      return res.status(400).json({ error: 'Recipient and amount are required' });
    }

    if (amount < 500) {
      return res.status(400).json({ error: 'Minimum amount is ₦500' });
    }

    // Create milestone request
    const result = await query(`
      INSERT INTO milestone_requests 
        (sender_id, recipient_id, amount, description, request_type, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
      RETURNING *
    `, [senderId, recipientId, amount, description || '', requestType || 'provider_request']);

    const request = result.rows[0];

    // Get sender info
    const senderInfo = await query(`
      SELECT username, profile_data->>'profilePicture' as avatar 
      FROM users WHERE id = $1
    `, [senderId]);

    // Notify recipient via socket
    if (req.io) {
      req.io.to(`user_${recipientId}`).emit('milestone_request', {
        id: request.id,
        senderId,
        senderName: senderInfo.rows[0]?.username || 'User',
        senderAvatar: senderInfo.rows[0]?.avatar,
        amount,
        description,
        requestType,
        status: 'pending',
        createdAt: request.created_at
      });
    }

    res.json({
      success: true,
      request: {
        id: request.id,
        senderId,
        recipientId,
        amount: parseFloat(request.amount),
        description: request.description,
        requestType: request.request_type,
        status: request.status,
        createdAt: request.created_at
      }
    });

  } catch (error) {
    console.error('Create milestone request error:', error);
    res.status(500).json({
      error: 'Failed to create request',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/milestone/respond
 * @desc    Accept or decline a milestone request
 * @access  Private
 */
router.post('/respond', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { requestId, action } = req.body; // action: 'accept' or 'decline'

    if (!requestId || !['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    // Verify user is recipient
    const requestResult = await query(`
      SELECT * FROM milestone_requests 
      WHERE id = $1 AND recipient_id = $2 AND status = 'pending'
    `, [requestId, userId]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }

    const request = requestResult.rows[0];
    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    // Update status
    await query(`
      UPDATE milestone_requests 
      SET status = $1, updated_at = NOW()
      WHERE id = $2
    `, [newStatus, requestId]);

    // Notify sender via socket
    if (req.io) {
      req.io.to(`user_${request.sender_id}`).emit('milestone_response', {
        requestId,
        status: newStatus,
        responderId: userId
      });
    }

    res.json({
      success: true,
      status: newStatus
    });

  } catch (error) {
    console.error('Respond to milestone error:', error);
    res.status(500).json({
      error: 'Failed to respond to request',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/milestone/pay
 * @desc    Pay and hold money for an accepted milestone request
 * @access  Private
 */
router.post('/pay', authMiddleware, async (req, res) => {
  try {
    const clientId = req.user.userId;
    const { requestId, paymentMethod } = req.body;

    // Get the accepted request
    const requestResult = await query(`
      SELECT * FROM milestone_requests 
      WHERE id = $1 AND recipient_id = $2 AND status = 'accepted'
    `, [requestId, clientId]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found or not accepted' });
    }

    const request = requestResult.rows[0];
    const providerId = request.sender_id;
    const amount = parseFloat(request.amount);

    // Create escrow transaction
    const escrowResult = await query(`
      INSERT INTO transactions 
        (client_id, provider_id, amount, status, description, created_at)
      VALUES ($1, $2, $3, 'held', $4, NOW())
      RETURNING *
    `, [clientId, providerId, amount, request.description || 'Service payment']);

    // Update milestone request status
    await query(`
      UPDATE milestone_requests 
      SET status = 'paid', escrow_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [escrowResult.rows[0].id, requestId]);

    // Notify provider
    if (req.io) {
      req.io.to(`user_${providerId}`).emit('escrow_created', {
        escrowId: escrowResult.rows[0].id,
        amount,
        clientId,
        message: `₦${amount.toLocaleString()} has been held for your service!`
      });
    }

    res.json({
      success: true,
      escrow: {
        id: escrowResult.rows[0].id,
        amount,
        status: 'held'
      }
    });

  } catch (error) {
    console.error('Pay milestone error:', error);
    res.status(500).json({
      error: 'Failed to process payment',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/milestone/pending
 * @desc    Get pending milestone requests for a conversation
 * @access  Private
 */
router.get('/pending/:otherUserId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { otherUserId } = req.params;

    // Get pending requests between these two users
    const result = await query(`
      SELECT 
        mr.*,
        sender.username as sender_name,
        sender.profile_data->>'profilePicture' as sender_avatar,
        recipient.username as recipient_name
      FROM milestone_requests mr
      LEFT JOIN users sender ON mr.sender_id = sender.id
      LEFT JOIN users recipient ON mr.recipient_id = recipient.id
      WHERE (
        (mr.sender_id = $1 AND mr.recipient_id = $2) OR
        (mr.sender_id = $2 AND mr.recipient_id = $1)
      )
      AND mr.status IN ('pending', 'accepted')
      ORDER BY mr.created_at DESC
    `, [userId, otherUserId]);

    res.json({
      success: true,
      requests: result.rows.map(r => ({
        id: r.id,
        senderId: r.sender_id,
        senderName: r.sender_name,
        senderAvatar: r.sender_avatar,
        recipientId: r.recipient_id,
        recipientName: r.recipient_name,
        amount: parseFloat(r.amount),
        description: r.description,
        requestType: r.request_type,
        status: r.status,
        createdAt: r.created_at
      }))
    });

  } catch (error) {
    console.error('Get pending milestones error:', error);
    res.status(500).json({
      error: 'Failed to fetch requests',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/milestone/list
 * @desc    Get all milestone requests for current user
 * @access  Private
 */
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await query(`
      SELECT 
        mr.*,
        sender.username as sender_name,
        sender.profile_data->>'profilePicture' as sender_avatar,
        recipient.username as recipient_name,
        recipient.profile_data->>'profilePicture' as recipient_avatar
      FROM milestone_requests mr
      LEFT JOIN users sender ON mr.sender_id = sender.id
      LEFT JOIN users recipient ON mr.recipient_id = recipient.id
      WHERE mr.sender_id = $1 OR mr.recipient_id = $1
      ORDER BY mr.created_at DESC
      LIMIT 50
    `, [userId]);

    res.json({
      success: true,
      requests: result.rows.map(r => ({
        id: r.id,
        senderId: r.sender_id,
        senderName: r.sender_name,
        senderAvatar: r.sender_avatar,
        recipientId: r.recipient_id,
        recipientName: r.recipient_name,
        recipientAvatar: r.recipient_avatar,
        amount: parseFloat(r.amount),
        description: r.description,
        requestType: r.request_type,
        status: r.status,
        escrowId: r.escrow_id,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }))
    });

  } catch (error) {
    console.error('Get milestone list error:', error);
    res.status(500).json({
      error: 'Failed to fetch requests'
    });
  }
});

module.exports = router;
