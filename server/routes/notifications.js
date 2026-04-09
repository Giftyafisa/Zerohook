const express = require('express');
const mongoose = require('mongoose');
const { authMiddleware } = require('./auth');
const { Notification, DeviceToken } = require('../config/database');

const router = express.Router();

const normalizeWebPushSubscription = (subscription) => {
  if (!subscription) return null;

  let parsedSubscription = subscription;
  if (typeof parsedSubscription === 'string') {
    try {
      parsedSubscription = JSON.parse(parsedSubscription);
    } catch (_) {
      return null;
    }
  }

  if (!parsedSubscription || typeof parsedSubscription !== 'object') return null;

  const endpoint = typeof parsedSubscription.endpoint === 'string'
    ? parsedSubscription.endpoint.trim()
    : '';
  const keys = parsedSubscription.keys && typeof parsedSubscription.keys === 'object'
    ? {
        p256dh: typeof parsedSubscription.keys.p256dh === 'string' ? parsedSubscription.keys.p256dh.trim() : '',
        auth: typeof parsedSubscription.keys.auth === 'string' ? parsedSubscription.keys.auth.trim() : ''
      }
    : null;

  if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
    return null;
  }

  return {
    endpoint,
    expirationTime: parsedSubscription.expirationTime ?? null,
    keys
  };
};

const normalizeDeviceRegistration = (body = {}) => {
  const platform = String(body.platform || 'android').toLowerCase();
  const subscription = normalizeWebPushSubscription(body.subscription);
  let provider = String(body.provider || 'fcm').toLowerCase();

  if (platform === 'web' && subscription) {
    provider = 'webpush';
  }

  const token = typeof body.token === 'string' ? body.token.trim() : '';

  return {
    platform,
    provider,
    token: platform === 'web' && provider === 'webpush' ? (subscription?.endpoint || token) : token,
    subscription,
    deviceId: body.deviceId || null,
    appVersion: body.appVersion || null,
    active: body.active !== false
  };
};

const persistDeviceToken = async ({ userId, token, platform, provider, subscription = null, deviceId = null, appVersion = null, active = true }) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const now = new Date();

  await DeviceToken.updateMany(
    {
      user_id: { $ne: userObjectId },
      platform,
      token
    },
    {
      $set: {
        active: false,
        last_seen_at: now,
        updated_at: now
      }
    }
  );

  return DeviceToken.findOneAndUpdate(
    {
      user_id: userObjectId,
      platform,
      token
    },
    {
      $set: {
        provider,
        subscription,
        device_id: deviceId,
        app_version: appVersion,
        active,
        last_seen_at: now,
        updated_at: now
      },
      $setOnInsert: {
        created_at: now
      }
    },
    {
      upsert: true,
      new: true,
      runValidators: true
    }
  );
};

const setDeviceTokenActiveState = async ({ userId, token, platform, active }) => {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const now = new Date();

  return DeviceToken.findOneAndUpdate(
    {
      user_id: userObjectId,
      platform,
      token
    },
    {
      $set: {
        active,
        last_seen_at: now,
        updated_at: now
      }
    },
    {
      new: true,
      runValidators: true
    }
  );
};

/**
 * @route   POST /api/notifications/register-device
 * @desc    Register/update mobile or browser push token
 * @access  Private
 */
router.post('/register-device', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const registration = normalizeDeviceRegistration(req.body || {});

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, data: null, message: 'Invalid user ID', error: 'Invalid user ID' });
    }

    if (!registration.token || registration.token.length < 20) {
      return res.status(400).json({ success: false, data: null, message: 'Valid device token is required', error: 'Valid device token is required' });
    }

    if (!['android', 'ios', 'web'].includes(registration.platform)) {
      return res.status(400).json({ success: false, data: null, message: 'Unsupported platform', error: 'Unsupported platform' });
    }

    if (registration.platform === 'web' && registration.provider === 'webpush' && !registration.subscription) {
      return res.status(400).json({
        success: false,
        data: null,
        message: 'Browser push subscription is required',
        error: 'Browser push subscription is required'
      });
    }

    const persistedToken = await persistDeviceToken({
      userId,
      token: registration.token,
      platform: registration.platform,
      provider: registration.provider,
      subscription: registration.subscription,
      deviceId: registration.deviceId,
      appVersion: registration.appVersion,
      active: registration.active
    });

    res.json({
      success: true,
      data: {
        platform: registration.platform,
        provider: registration.provider,
        active: Boolean(persistedToken?.active)
      },
      message: 'Device token registered'
    });
  } catch (error) {
    console.error('Register device token error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/notifications/unregister-device
 * @desc    Deactivate a previously registered device/browser push token
 * @access  Private
 */
router.post('/unregister-device', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const registration = normalizeDeviceRegistration(req.body || {});

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, data: null, message: 'Invalid user ID', error: 'Invalid user ID' });
    }

    if (!registration.token || registration.token.length < 20) {
      return res.status(400).json({ success: false, data: null, message: 'Valid device token is required', error: 'Valid device token is required' });
    }

    if (!['android', 'ios', 'web'].includes(registration.platform)) {
      return res.status(400).json({ success: false, data: null, message: 'Unsupported platform', error: 'Unsupported platform' });
    }

    const updatedToken = await setDeviceTokenActiveState({
      userId,
      token: registration.token,
      platform: registration.platform,
      active: false
    });

    res.json({
      success: true,
      data: {
        platform: registration.platform,
        provider: registration.provider,
        active: Boolean(updatedToken ? updatedToken.active : false)
      },
      message: 'Device token unregistered'
    });
  } catch (error) {
    console.error('Unregister device token error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
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
      return res.status(400).json({ success: false, data: null, message: 'Invalid user ID', error: 'Invalid user ID' });
    }

    const limitRaw = parseInt(req.query.limit, 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
    const cursor = req.query.cursor ? String(req.query.cursor) : null;

    const query = { user_id: userId };
    if (cursor && mongoose.Types.ObjectId.isValid(cursor)) {
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
    const payload = {
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
    };

    res.json({
      success: true,
      data: payload,
      ...payload,
      message: 'Notifications fetched'
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to get notifications',
      error: 'Failed to get notifications'
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
      return res.status(400).json({ success: false, data: null, message: 'Invalid user or notification ID', error: 'Invalid user or notification ID' });
    }

    await Notification.updateOne({ _id: id, user_id: userId }, { $set: { read: true } });

    res.json({
      success: true,
      data: { id, read: true },
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to mark notification as read',
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
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, data: null, message: 'Invalid user ID', error: 'Invalid user ID' });
    }

    await Notification.updateMany({ user_id: userId, read: false }, { $set: { read: true } });

    res.json({
      success: true,
      data: { read: true },
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to mark all notifications as read',
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
    const { notificationId } = req.body || {};

    if (!notificationId) {
      return res.status(400).json({ success: false, data: null, message: 'Notification ID is required', error: 'Notification ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(notificationId)) {
      return res.status(400).json({ success: false, data: null, message: 'Invalid user or notification ID', error: 'Invalid user or notification ID' });
    }

    await Notification.updateOne({ _id: notificationId, user_id: userId }, { $set: { read: true } });

    res.json({
      success: true,
      data: { notificationId, read: true },
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to mark notification as read',
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

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, data: null, message: 'Invalid user or notification ID', error: 'Invalid user or notification ID' });
    }

    await Notification.deleteOne({ _id: id, user_id: userId });

    res.json({
      success: true,
      data: { id },
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      data: null,
      message: 'Failed to delete notification',
      error: 'Failed to delete notification'
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
      return res.status(400).json({ success: false, data: null, message: 'Invalid user or notification ID', error: 'Invalid user or notification ID' });
    }

    await Notification.updateOne({ _id: id, user_id: userId }, { $set: { read: true } });
    res.json({ success: true, data: { id, read: true }, message: 'Notification marked as read' });
  } catch (error) {
    console.error('Mark notification read (POST compat) error:', error);
    res.status(500).json({ success: false, data: null, message: 'Failed to mark notification as read', error: 'Failed to mark notification as read' });
  }
});

router.post('/read-all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, data: null, message: 'Invalid user ID', error: 'Invalid user ID' });
    }

    await Notification.updateMany({ user_id: userId, read: false }, { $set: { read: true } });
    res.json({ success: true, data: { read: true }, message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark all notifications read (POST compat) error:', error);
    res.status(500).json({ success: false, data: null, message: 'Failed to mark all notifications as read', error: 'Failed to mark all notifications as read' });
  }
});

module.exports = router;
