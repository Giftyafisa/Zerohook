const express = require('express');
const { authMiddleware } = require('./auth');
const { query } = require('../config/database');
const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user notifications from the database
    const notificationsResult = await query(`
      SELECT 
        id, type, title, message, is_read, created_at, metadata
      FROM user_notifications 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT 50
    `, [userId]);

    // If notifications table doesn't exist, return empty array
    if (notificationsResult.rows) {
      res.json({
        notifications: notificationsResult.rows
      });
    } else {
      res.json({
        notifications: []
      });
    }

  } catch (error) {
    console.error('Get notifications error:', error);
    
    // If table doesn't exist, return empty notifications
    if (error.message.includes('relation "user_notifications" does not exist')) {
      res.json({
        notifications: []
      });
    } else {
      res.status(500).json({
        error: 'Failed to get notifications'
      });
    }
  }
});

/**
 * @route   POST /api/notifications/mark-read
 * @desc    Mark notification as read
 * @access  Private
 */
router.post('/mark-read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { notificationId } = req.body;

    if (!notificationId) {
      return res.status(400).json({
        error: 'Notification ID is required'
      });
    }

    await query(`
      UPDATE user_notifications 
      SET is_read = true 
      WHERE id = $1 AND user_id = $2
    `, [notificationId, userId]);

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      error: 'Failed to mark notification as read'
    });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a notification
 * @access  Private
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    await query(`
      DELETE FROM user_notifications 
      WHERE id = $1 AND user_id = $2
    `, [id, userId]);

    res.json({
      success: true,
      message: 'Notification deleted'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      error: 'Failed to delete notification'
    });
  }
});

module.exports = router;
