const express = require('express');
const { authMiddleware } = require('./auth');
const mongoose = require('mongoose');
const { Notification } = require('../config/database');
const router = express.Router();

/**
 * @route   GET /api/notifications
 * @desc    Get user notifications
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }
    
    const notifications = await Notification.find({ user_id: userId })
      .sort({ created_at: -1 })
      .limit(50)
      .lean();

    // Count total unread for badge display
    const unreadCount = await Notification.countDocuments({ user_id: userId, read: false });

    res.json({
      success: true,
      notifications: notifications.map((notification) => ({
        id: notification._id.toString(),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        is_read: Boolean(notification.read),
        created_at: notification.created_at,
        metadata: notification.data || {}
      })),
      unreadCount
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false, error: 'Failed to get notifications'
    });
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
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid user or notification ID' });
    }

    await Notification.updateOne({ _id: id, user_id: userId }, { read: true });

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false, error: 'Failed to mark notification as read'
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
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    await Notification.updateMany({ user_id: userId, read: false }, { read: true });

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      success: false, error: 'Failed to mark all notifications as read'
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
        success: false, error: 'Notification ID is required'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ success: false, error: 'Invalid user or notification ID' });
    }

    await Notification.updateOne({ _id: notificationId, user_id: userId }, { read: true });

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false, error: 'Failed to mark notification as read'
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
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid user or notification ID' });
    }

    await Notification.deleteOne({ _id: id, user_id: userId });

    res.json({
      success: true,
      message: 'Notification deleted'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false, error: 'Failed to delete notification'
    });
  }
});

// ==================== BACKWARD COMPAT ====================
// Android clients (pre-v2) send POST instead of PUT. Accept both verbs.
router.post('/:id/read', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid user or notification ID' });
    }
    await Notification.updateOne({ _id: id, user_id: userId }, { read: true });
    res.json({ success: true, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read (POST compat) error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
});

router.post('/read-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }
    await Notification.updateMany({ user_id: userId, read: false }, { read: true });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read (POST compat) error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' });
  }
});

module.exports = router;
