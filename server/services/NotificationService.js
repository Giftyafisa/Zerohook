/**
 * NotificationService - Handles creating and saving notifications
 * Zerohook Platform
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  read: { type: Boolean, default: false }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

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
    
    return notification;
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
}

module.exports = NotificationService;
