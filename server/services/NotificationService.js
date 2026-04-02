/**
 * NotificationService - Handles creating and saving notifications
 * Zerohook Platform
 */

const mongoose = require('mongoose');
// Use the canonical Notification model from database.js to avoid
// duplicate/conflicting schema definitions (the model is already
// registered by the time this module loads).
const { Notification, DeviceToken } = require('../config/database');

let firebaseAdmin = null;
let firebaseMessaging = null;

try {
  // Optional dependency: app continues to work without firebase-admin.
  // Push delivery is enabled only when dependency + env config exist.
  firebaseAdmin = require('firebase-admin');

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountRaw && !firebaseAdmin.apps.length) {
    const serviceAccount = JSON.parse(serviceAccountRaw);
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    });
  }

  if (firebaseAdmin.apps.length > 0) {
    firebaseMessaging = firebaseAdmin.messaging();
  }
} catch (error) {
  // firebase-admin is optional; keep runtime resilient.
  firebaseMessaging = null;
}

class NotificationService {
  /**
   * Create a new notification and save to database
   * @param {string} userId - User ID to receive notification
   * @param {string} type - Notification type (message, connection, payment, etc.)
   * @param {string} title - Notification title
   * @param {string} message - Notification message/body
   * @param {object} data - Additional metadata (optional)
   * @returns {object} Created notification
   */
  static async create(userId, type, title, message, data = {}) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return null;
      }

      const notification = await Notification.create({
        user_id: new mongoose.Types.ObjectId(userId),
        type,
        title,
        message,
        data,
        read: false
      });
      
      console.log(`📬 Notification created for user ${userId}: ${type} - ${title}`);
      return {
        id: notification._id.toString(),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        is_read: notification.read,
        created_at: notification.created_at
      };
    } catch (error) {
      console.error('Failed to create notification:', error);
      // Don't throw - notifications should not break main functionality
      return null;
    }
  }
  
  /**
   * Create notification and emit via socket
   * @param {object} io - Socket.io instance
   * @param {object} options - Notification options
  /**
   * Create notification and emit via socket
   * Supports two calling conventions:
   *   createAndEmit(io, { userId, type, title, message, data })
   *   createAndEmit(io, userId, type, title, message, data)
   */
  static async createAndEmit(io, optionsOrUserId, typeArg, titleArg, messageArg, dataArg) {
    try {
      let userId, type, title, message, data = {};

      if (typeof optionsOrUserId === 'object' && optionsOrUserId !== null) {
        ({ userId, type, title, message, data = {} } = optionsOrUserId);
      } else {
        userId = optionsOrUserId;
        type = typeArg;
        title = titleArg;
        message = messageArg;
        data = dataArg || {};
      }
      
      // Save to database
      const notification = await this.create(userId, type, title, message, data);
      
      // Emit via socket if io instance available
      if (io && notification) {
        io.to(`user_${userId}`).emit('new_notification', {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          read: false,
          createdAt: notification.created_at,
          data: data
        });
      }

      if (notification) {
        await this.sendPushToDevices(userId, notification);
      }
      
      return notification;
    } catch (error) {
      console.error('Failed to create and emit notification:', error);
      return null;
    }
  }
  
  /**
   * Get user's unread notification count
   * @param {string} userId - User ID
   * @returns {number} Unread count
   */
  static async getUnreadCount(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return 0;
      }

      return await Notification.countDocuments({
        user_id: new mongoose.Types.ObjectId(userId),
        read: false
      });
    } catch (error) {
      console.error('Failed to get unread count:', error);
      return 0;
    }
  }
  
  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for security check)
   */
  static async markAsRead(notificationId, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(notificationId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return false;
      }

      const result = await Notification.updateOne(
        {
          _id: new mongoose.Types.ObjectId(notificationId),
          user_id: new mongoose.Types.ObjectId(userId)
        },
        { $set: { read: true } }
      );
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      return false;
    }
  }
  
  /**
   * Mark all user notifications as read
   * @param {string} userId - User ID
   */
  static async markAllAsRead(userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return false;
      }

      await Notification.updateMany(
        {
          user_id: new mongoose.Types.ObjectId(userId),
          read: false
        },
        { $set: { read: true } }
      );
      return true;
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
      return false;
    }
  }
  
  /**
   * Delete a notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (for security check)
   */
  static async delete(notificationId, userId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(notificationId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return false;
      }

      const result = await Notification.findOneAndDelete({
        _id: new mongoose.Types.ObjectId(notificationId),
        user_id: new mongoose.Types.ObjectId(userId)
      }).select('_id').lean();

      return Boolean(result);
    } catch (error) {
      console.error('Failed to delete notification:', error);
      return false;
    }
  }

  static async sendPushToDevices(userId, notification) {
    try {
      if (!firebaseMessaging) return;
      if (!mongoose.Types.ObjectId.isValid(userId)) return;

      const devices = await DeviceToken.find({
        user_id: new mongoose.Types.ObjectId(userId),
        active: true,
        provider: 'fcm',
        platform: 'android'
      }).select('token').lean();

      const tokens = devices.map(d => d.token).filter(Boolean);
      if (tokens.length === 0) return;

      const payload = {
        data: {
          type: String(notification.type || 'system'),
          title: String(notification.title || 'Zerohook'),
          body: String(notification.message || ''),
          message: String(notification.message || ''),
          conversationId: String(notification.data?.conversationId || ''),
          senderId: String(notification.data?.senderId || ''),
          messageId: String(notification.data?.messageId || ''),
          senderName: String(notification.data?.senderName || ''),
          callId: String(notification.data?.callId || ''),
          callerId: String(notification.data?.callerId || ''),
          callerName: String(notification.data?.callerName || ''),
          callType: String(notification.data?.callType || ''),
          targetUserId: String(notification.data?.targetUserId || '')
        },
        android: {
          priority: 'high'
        },
        tokens
      };

      const result = await firebaseMessaging.sendEachForMulticast(payload);

      if (result.failureCount > 0) {
        const invalidTokens = [];
        result.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const code = resp.error?.code || '';
            if (
              code.includes('registration-token-not-registered') ||
              code.includes('invalid-registration-token')
            ) {
              invalidTokens.push(tokens[idx]);
            }
          }
        });

        if (invalidTokens.length > 0) {
          await DeviceToken.updateMany(
            { token: { $in: invalidTokens } },
            { $set: { active: false, last_seen_at: new Date() } }
          );
        }
      }
    } catch (error) {
      console.error('Push dispatch failed:', error.message);
    }
  }
}

module.exports = NotificationService;
