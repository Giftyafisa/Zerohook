const express = require('express');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('./auth');
const { query } = require('../config/database');
const UserConnectionManager = require('../services/UserConnectionManager');

const router = express.Router();
const connectionManager = new UserConnectionManager();

/**
 * @route   GET /api/connections/check-status/:otherUserId
 * @desc    Check connection status with another user
 * @access  Private
 */
router.get('/check-status/:otherUserId', authMiddleware, async (req, res) => {
  try {
    const { otherUserId } = req.params;
    const currentUserId = req.user.userId;

    // Validate UUID format
    if (!otherUserId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({
        error: 'Invalid user ID format'
      });
    }

    const result = await connectionManager.checkConnectionStatus(currentUserId, otherUserId);
    res.json(result);

  } catch (error) {
    console.error('Check connection status error:', error);
    res.status(500).json({
      error: 'Failed to check connection status',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/connections/contact-request
 * @desc    Send a contact request to another user
 * @access  Private
 */
router.post('/contact-request', authMiddleware, [
  body('toUserId').isUUID(),
  body('message').optional().isLength({ max: 500 }),
  body('connectionType').optional().isIn(['contact_request', 'service_inquiry', 'video_call'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { toUserId, message = '', connectionType = 'contact_request' } = req.body;
    const fromUserId = req.user.userId;

    const result = await connectionManager.sendContactRequest(
      fromUserId, 
      toUserId, 
      message, 
      connectionType
    );

    res.json(result);

  } catch (error) {
    console.error('Contact request error:', error);
    
    // Return appropriate HTTP status codes based on error type
    if (error.message === 'Users are already connected') {
      return res.status(409).json({
        error: 'Users are already connected',
        message: 'A connection already exists between these users'
      });
    }
    
    if (error.message === 'Cannot connect with blocked user') {
      return res.status(403).json({
        error: 'Connection blocked',
        message: 'Cannot connect with this user due to blocking'
      });
    }
    
    if (error.message === 'One or both users not found') {
      return res.status(404).json({
        error: 'User not found',
        message: 'One or both users could not be found'
      });
    }
    
    // Default to 500 for unexpected errors
    res.status(500).json({
      error: 'Failed to send contact request',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/connections/respond
 * @desc    Accept or reject a contact request
 * @access  Private
 */
router.post('/respond', authMiddleware, [
  body('connectionId').isUUID(),
  body('action').isIn(['accept', 'reject'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { connectionId, action } = req.body;
    const userId = req.user.userId;

    const result = await connectionManager.respondToContactRequest(
      connectionId, 
      userId, 
      action
    );

    res.json(result);

  } catch (error) {
    console.error('Respond to contact request error:', error);
    res.status(500).json({
      error: 'Failed to respond to contact request',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/connections/user-connections
 * @desc    Get user's connections and pending requests
 * @access  Private
 */
router.get('/user-connections', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await connectionManager.getUserConnections(userId);
    res.json(result);

  } catch (error) {
    console.error('Get user connections error:', error);
    res.status(500).json({
      error: 'Failed to fetch user connections',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/connections/service-inquiry
 * @desc    Send a service inquiry message
 * @access  Private
 */
router.post('/service-inquiry', authMiddleware, [
  body('toUserId').isUUID(),
  body('serviceId').isUUID(),
  body('message').isLength({ min: 1, max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { toUserId, serviceId, message } = req.body;
    const fromUserId = req.user.userId;

    const result = await connectionManager.sendServiceInquiry(
      fromUserId, 
      toUserId, 
      serviceId, 
      message
    );

    res.json(result);

  } catch (error) {
    console.error('Service inquiry error:', error);
    res.status(500).json({
      error: 'Failed to send service inquiry',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/connections/pending-requests
 * @desc    Get user's pending contact requests
 * @access  Private
 */
router.get('/pending-requests', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const result = await connectionManager.getPendingRequests(userId);
    res.json(result);

  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({
      error: 'Failed to fetch pending requests',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/connections/block-user
 * @desc    Block a user
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
    const blockerId = req.user.userId;

    if (blockerId === blockedUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    const result = await connectionManager.blockUser(blockerId, blockedUserId);
    res.json(result);

  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({
      error: 'Failed to block user',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   DELETE /api/connections/:connectionId
 * @desc    Delete a connection
 * @access  Private
 */
router.delete('/:connectionId', authMiddleware, async (req, res) => {
  try {
    const { connectionId } = req.params;
    const userId = req.user.userId;

    // Verify ownership and delete connection
    const result = await query(`
      DELETE FROM user_connections 
      WHERE id = $1 AND (from_user_id = $2 OR to_user_id = $2)
      RETURNING id
    `, [connectionId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found or access denied' });
    }

    res.json({
      success: true,
      message: 'Connection deleted successfully'
    });

  } catch (error) {
    console.error('Delete connection error:', error);
    res.status(500).json({
      error: 'Failed to delete connection',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
