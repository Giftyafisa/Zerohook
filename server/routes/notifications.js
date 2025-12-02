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
    // Table: notifications, columns: id, user_id, type, title, message, data (jsonb), read (boolean), created_at
    const notificationsResult = await query(`
      SELECT 
        id, type, title, message, read as is_read, created_at, data as metadata
      FROM notifications 
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
    if (error.message.includes('relation "notifications" does not exist')) {
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
 * @route   PUT /api/notifications/:id/read
 * @desc    Mark specific notification as read (RESTful pattern)
 * @access  Private
 */
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    await query(`
      UPDATE notifications 
      SET read = true 
      WHERE id = $1 AND user_id = $2
    `, [id, userId]);

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
 * @route   PUT /api/notifications/mark-all-read
 * @desc    Mark all notifications as read
 * @access  Private
 */
router.put('/mark-all-read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    await query(`
      UPDATE notifications 
      SET read = true 
      WHERE user_id = $1 AND read = false
    `, [userId]);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      error: 'Failed to mark all notifications as read'
    });
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

    // Table: notifications, column: read (not is_read)
    await query(`
      UPDATE notifications 
      SET read = true 
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
      DELETE FROM notifications 
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
