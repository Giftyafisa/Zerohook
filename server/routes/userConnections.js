const express = require('express');
const { body, validationResult } = require('express-validator');
const { authMiddleware } = require('./auth');
const mongoose = require('mongoose');
const { UserConnection } = require('../config/database');
const UserConnectionManager = require('../services/UserConnectionManager');
const NotificationService = require('../services/NotificationService');

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

    // Validate ID format - accept both UUID and MongoDB ObjectId (24 hex chars)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    
    if (!uuidRegex.test(otherUserId) && !objectIdRegex.test(otherUserId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID format'
      });
    }

    const result = await connectionManager.checkConnectionStatus(currentUserId, otherUserId);
    res.json(result);

  } catch (error) {
    console.error('Check connection status error:', error);
    res.status(500).json({ success: false, error: 'Failed to check connection status',
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
  body('toUserId').isString().matches(/^[0-9a-fA-F]{24}$/).withMessage('Invalid user ID format'),
  body('message').optional().isLength({ max: 500 }),
  body('connectionType').optional().isIn(['contact_request', 'service_inquiry', 'video_call'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed',
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

    // Emit socket event for real-time notification
    if (req.io && result.success) {
      req.io.to(`user_${toUserId}`).emit('connection_request', {
        connectionId: result.connectionId,
        fromUserId,
        fromUsername: req.user.username,
        message,
        connectionType,
        timestamp: new Date().toISOString()
      });
      
      // Save notification to database AND emit via socket
      await NotificationService.createAndEmit(
        req.io,
        toUserId,
        'connection_request',
        'New Connection Request',
        `${req.user.username || 'Someone'} wants to connect with you`,
        { connectionId: result.connectionId, fromUserId, fromUsername: req.user.username, message }
      );
    }

    res.json(result);

  } catch (error) {
    console.error('Contact request error:', error);
    
    // Return appropriate HTTP status codes based on error type
    if (error.message === 'Users are already connected') {
      return res.status(409).json({ success: false, error: 'Users are already connected',
        message: 'A connection already exists between these users'
      });
    }
    
    if (error.message === 'Cannot connect with blocked user') {
      return res.status(403).json({ success: false, error: 'Connection blocked',
        message: 'Cannot connect with this user due to blocking'
      });
    }
    
    if (error.message === 'One or both users not found') {
      return res.status(404).json({ success: false, error: 'User not found',
        message: 'One or both users could not be found'
      });
    }
    
    // Default to 500 for unexpected errors
    res.status(500).json({ success: false, error: 'Failed to send contact request',
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
  body('connectionId').isString().matches(/^[0-9a-fA-F]{24}$/).withMessage('Invalid connection ID format'),
  body('action').isIn(['accept', 'reject'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed',
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
    res.status(500).json({ success: false, error: 'Failed to respond to contact request',
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
    res.status(500).json({ success: false, error: 'Failed to fetch user connections',
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
  body('toUserId').isString().matches(/^[0-9a-fA-F]{24}$/).withMessage('Invalid user ID format'),
  body('serviceId').isString().matches(/^[0-9a-fA-F]{24}$/).withMessage('Invalid service ID format'),
  body('message').isLength({ min: 1, max: 1000 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed',
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

    // Emit socket event for real-time notification
    if (req.io && result.success) {
      // Save notification to database AND emit via socket
      await NotificationService.createAndEmit(
        req.io,
        toUserId,
        'service_inquiry',
        'New Service Inquiry',
        `You have a new inquiry about your service`,
        {
          fromUserId,
          fromUsername: req.user.username,
          serviceId,
          conversationId: result.conversationId,
          serviceTitle: result.serviceTitle
        }
      );
    }

    res.json(result);

  } catch (error) {
    console.error('Service inquiry error:', error);
    res.status(500).json({ success: false, error: 'Failed to send service inquiry',
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
    res.status(500).json({ success: false, error: 'Failed to fetch pending requests',
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
  body('userId').isString().matches(/^[0-9a-fA-F]{24}$/).withMessage('Invalid user ID format')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed',
        details: errors.array()
      });
    }

    const { userId: blockedUserId } = req.body;
    const blockerId = req.user.userId;

    if (blockerId === blockedUserId) {
      return res.status(400).json({ success: false, error: 'Cannot block yourself' });
    }

    const result = await connectionManager.blockUser(blockerId, blockedUserId);
    res.json(result);

  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ success: false, error: 'Failed to block user',
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

    if (!mongoose.Types.ObjectId.isValid(connectionId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid connection or user ID' });
    }

    // Verify ownership and delete connection
    const result = await UserConnection.findOneAndDelete({
      _id: connectionId,
      $or: [{ from_user_id: userId }, { to_user_id: userId }]
    }).select('_id').lean();

    if (!result) {
      return res.status(404).json({ success: false, error: 'Connection not found or access denied' });
    }

    res.json({
      success: true,
      message: 'Connection deleted successfully'
    });

  } catch (error) {
    console.error('Delete connection error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete connection',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
