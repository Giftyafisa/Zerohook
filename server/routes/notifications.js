const express = require('express');
const { authMiddleware } = require('./auth');
const mongoose = require('mongoose');
const { Notification, DeviceToken } = require('../config/database');
const router = express.Router();

/**
 * @route   POST /api/notifications/register-device
 * @desc    Register/update mobile device push token (FCM/APNs)
 * @access  Private
 */
router.post('/register-device', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      token,
      platform = 'android',
      provider = 'fcm',
      deviceId = null,
      appVersion = null
    } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    if (!token || typeof token !== 'string' || token.trim().length < 20) {
      return res.status(400).json({ success: false, error: 'Valid device token is required' });
    }

    const safePlatform = String(platform).toLowerCase();
    const safeProvider = String(provider).toLowerCase();
    if (!['android', 'ios', 'web'].includes(safePlatform)) {
      return res.status(400).json({ success: false, error: 'Unsupported platform' });
    }

    await DeviceToken.findOneAndUpdate(
      {
        user_id: userId,
        platform: safePlatform,
        token: token.trim()
      },
      {
        $set: {
          provider: safeProvider,
          device_id: deviceId,
          app_version: appVersion,
          active: true,
          last_seen_at: new Date(),
          updated_at: new Date()
        },
        $setOnInsert: {
          created_at: new Date()
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    res.json({
      success: true,
      data: { platform: safePlatform, provider: safeProvider },
      message: 'Device token registered'
    });
  } catch (error) {
    console.error('Register device token error:', error);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

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

    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
    const cursor = req.query.cursor ? String(req.query.cursor) : null;

    const query = { user_id: userId };
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
      // Keyset pagination: older items than cursor id (sorted by created_at desc / _id desc)
      query._id = { $lt: new mongoose.Types.ObjectId(cursor) };
    }
    
    const [notifications, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean(),
      Notification.countDocuments({ user_id: userId, read: false })
    ]);

    const hasMore = notifications.length > limit;
    const pageItems = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? String(pageItems[pageItems.length - 1]._id) : null;

    res.json({
      success: true,
      notifications: pageItems.map((notification) => ({
        id: notification._id.toString(),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        is_read: Boolean(notification.read),
        created_at: notification.created_at,
        metadata: notification.data || {}
      })),
      unreadCount,
      nextCursor,
      hasMore
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
