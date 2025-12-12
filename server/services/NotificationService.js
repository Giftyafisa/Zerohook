/**
 * NotificationService - Handles creating and saving notifications
 * Zerohook Platform
 */

const { query } = require('../config/database');

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
      const result = await query(`
        INSERT INTO notifications (user_id, type, title, message, data, read, created_at)
        VALUES ($1, $2, $3, $4, $5, false, CURRENT_TIMESTAMP)
        RETURNING id, type, title, message, data, read as is_read, created_at
      `, [userId, type, title, message, JSON.stringify(data)]);
      
      console.log(`📬 Notification created for user ${userId}: ${type} - ${title}`);
      return result.rows[0];
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
   * @param {string} options.userId - User ID
   * @param {string} options.type - Notification type
   * @param {string} options.title - Notification title
   * @param {string} options.message - Notification message
   * @param {object} options.data - Additional metadata
   */
  static async createAndEmit(io, options) {
    const { userId, type, title, message, data = {} } = options;
    
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
      const result = await query(`
        SELECT COUNT(*) as count
        FROM notifications
        WHERE user_id = $1 AND read = false
      `, [userId]);
      
      return parseInt(result.rows[0]?.count || 0, 10);
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
      await query(`
        UPDATE notifications
        SET read = true
        WHERE id = $1 AND user_id = $2
      `, [notificationId, userId]);
      return true;
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
      await query(`
        UPDATE notifications
        SET read = true
        WHERE user_id = $1 AND read = false
      `, [userId]);
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
      await query(`
        DELETE FROM notifications
        WHERE id = $1 AND user_id = $2
      `, [notificationId, userId]);
      return true;
    } catch (error) {
      console.error('Failed to delete notification:', error);
      return false;
    }
  }
}

module.exports = NotificationService;
