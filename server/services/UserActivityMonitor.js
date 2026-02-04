const { UserSession, UserPresence, User, UserActivityLog, UserEngagementMetric, UserEngagementEvent, isDatabaseAvailable } = require('../config/database');
const crypto = require('crypto');

class UserActivityMonitor {
  constructor() {
    this.initialized = false;
    this.sessionTimeout = parseInt(process.env.SESSION_TIMEOUT_MS) || 30 * 60 * 1000; // 30 minutes
    this.heartbeatInterval = parseInt(process.env.HEARTBEAT_INTERVAL_MS) || 5 * 60 * 1000; // 5 minutes
    this.activeSessions = new Map(); // In-memory session tracking
    this.cleanupInterval = null;
  }

  async initialize() {
    try {
      console.log('🔄 Initializing UserActivityMonitor...');
      
      // Clean up expired sessions
      await this.cleanupExpiredSessions();
      
      // Set up periodic cleanup
      this.cleanupInterval = setInterval(async () => {
        await this.cleanupExpiredSessions();
      }, this.heartbeatInterval);
      
      this.initialized = true;
      console.log('✅ UserActivityMonitor initialized successfully');
    } catch (error) {
      console.error('❌ UserActivityMonitor initialization failed:', error);
      throw error;
    }
  }

  isHealthy() {
    return this.initialized;
  }

  /**
   * Create a new user session
   */
  async createUserSession(userId, socketId, ipAddress, userAgent) {
    try {
      if (!isDatabaseAvailable()) {
        console.log('⚠️ Database not available for createUserSession');
        const sessionToken = crypto.randomBytes(32).toString('hex');
        this.activeSessions.set(sessionToken, {
          userId, socketId, ipAddress, userAgent, expiresAt: new Date(Date.now() + this.sessionTimeout), lastActivity: new Date()
        });
        return sessionToken;
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + this.sessionTimeout);
      
      // Use findOneAndUpdate with upsert to avoid duplicate key errors
      const session = await UserSession.findOneAndUpdate(
        { userId, socketId },
        {
          $set: {
            sessionToken,
            ipAddress,
            userAgent,
            expiresAt,
            isActive: true,
            lastActivity: new Date()
          }
        },
        { upsert: true, new: true }
      );
      
      // Update user presence to online
      await this.updateUserPresence(userId, 'online', socketId);
      
      // Track in memory for quick access
      this.activeSessions.set(sessionToken, {
        id: session._id,
        userId,
        socketId,
        ipAddress,
        userAgent,
        expiresAt,
        lastActivity: new Date()
      });

      console.log(`✅ User session created for user ${userId}`);
      return sessionToken;
    } catch (error) {
      console.error('Error creating user session:', error);
      throw error;
    }
  }

  /**
   * Update user presence status
   */
  async updateUserPresence(userId, status, socketId = null) {
    try {
      if (!isDatabaseAvailable()) {
        console.log('⚠️ Database not available for updateUserPresence');
        return null;
      }

      const now = new Date();
      
      // Update or create presence record using upsert
      await UserPresence.findOneAndUpdate(
        { userId },
        { 
          userId,
          status, 
          lastSeen: now, 
          updatedAt: now 
        },
        { upsert: true, new: true }
      );

      // Update users table last_active
      await User.findByIdAndUpdate(userId, { lastActive: now });

      // Update session if socketId provided - FIX: Avoid duplicate key errors
      if (socketId) {
        // First, deactivate any OTHER active sessions for this user (prevents duplicate socketId issues)
        await UserSession.updateMany(
          { userId, isActive: true, socketId: { $ne: socketId } },
          { isActive: false, disconnectedAt: now }
        );
        
        // Then upsert the current session (using findOneAndUpdate avoids E11000 errors)
        await UserSession.findOneAndUpdate(
          { userId, socketId },
          { $set: { lastActivity: now, isActive: true } },
          { upsert: true }
        );
      }

      console.log(`✅ User ${userId} presence updated to: ${status}`);
      return { userId, status };
    } catch (error) {
      console.error('Error updating user presence:', error);
      throw error;
    }
  }

  /**
   * Log user activity
   */
  async logUserActivity(userId, actionData) {
    try {
      if (!isDatabaseAvailable()) {
        console.log('⚠️ Database not available for logUserActivity');
        return;
      }

      const {
        actionType,
        actionData: data,
        ipAddress,
        userAgent,
        responseTimeMs,
        success = true,
        errorMessage = null
      } = actionData;

      await UserActivityLog.create({
        userId,
        actionType,
        actionData: data,
        ipAddress,
        userAgent,
        responseTimeMs,
        success,
        errorMessage
      });

      // Update session last activity
      await UserSession.updateMany(
        { userId, isActive: true },
        { lastActivity: new Date() }
      );

      // Update user engagement metrics
      await this.updateEngagementMetrics(userId, actionType);

      console.log(`✅ User activity logged: ${userId} - ${actionType}`);
    } catch (error) {
      console.error('Error logging user activity:', error);
      // Don't throw error to avoid breaking user experience
    }
  }

  /**
   * Update typing status
   */
  async updateTypingStatus(userId, isTyping, conversationId = null) {
    try {
      if (!isDatabaseAvailable()) {
        console.log('⚠️ Database not available for updateTypingStatus');
        return;
      }

      await UserPresence.findOneAndUpdate(
        { userId },
        { isTyping, updatedAt: new Date() }
      );

      console.log(`✅ User ${userId} typing status: ${isTyping}`);
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }

  /**
   * Update user current page
   */
  async updateUserPage(userId, page) {
    try {
      if (!isDatabaseAvailable()) {
        console.log('⚠️ Database not available for updateUserPage');
        return;
      }

      await UserPresence.findOneAndUpdate(
        { userId },
        { currentPage: page, updatedAt: new Date() }
      );

      console.log(`✅ User ${userId} page updated: ${page}`);
    } catch (error) {
      console.error('Error updating user page:', error);
    }
  }

  /**
   * Get user presence status
   */
  async getUserPresence(userId) {
    try {
      if (!isDatabaseAvailable()) {
        return { status: 'offline', lastSeen: null, isTyping: false, currentPage: null };
      }

      const presence = await UserPresence.findOne({ userId });

      if (!presence) {
        return { status: 'offline', lastSeen: null, isTyping: false, currentPage: null };
      }

      return {
        status: presence.status,
        lastSeen: presence.lastSeen,
        isTyping: presence.isTyping,
        currentPage: presence.currentPage
      };
    } catch (error) {
      console.error('Error getting user presence:', error);
      return { status: 'offline', lastSeen: null, isTyping: false, currentPage: null };
    }
  }

  /**
   * Get online users count
   */
  async getOnlineUsersCount() {
    try {
      if (!isDatabaseAvailable()) {
        return 0;
      }

      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const count = await UserPresence.countDocuments({
        status: 'online',
        lastSeen: { $gt: fiveMinutesAgo }
      });

      return count;
    } catch (error) {
      console.error('Error getting online users count:', error);
      return 0;
    }
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId) {
    try {
      if (!isDatabaseAvailable()) {
        return [];
      }

      const sessions = await UserSession.find({ userId, isActive: true })
        .sort({ createdAt: -1 });

      return sessions.map(s => ({
        id: s._id,
        sessionToken: s.sessionToken,
        socketId: s.socketId,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        lastActivity: s.lastActivity,
        isActive: s.isActive,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt
      }));
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }

  /**
   * Validate session
   */
  async validateSession(sessionToken) {
    try {
      if (!isDatabaseAvailable()) {
        return null;
      }

      const session = await UserSession.findOne({
        sessionToken,
        isActive: true,
        expiresAt: { $gt: new Date() }
      });

      if (!session) {
        return null;
      }

      const user = await User.findById(session.userId);
      if (!user) {
        return null;
      }

      // Update last activity
      await UserSession.findByIdAndUpdate(session._id, { lastActivity: new Date() });

      return {
        userId: session.userId,
        username: user.username,
        email: user.email,
        sessionId: session._id,
        socketId: session.socketId
      };
    } catch (error) {
      console.error('Error validating session:', error);
      return null;
    }
  }

  /**
   * Invalidate session
   */
  async invalidateSession(sessionToken) {
    try {
      if (!isDatabaseAvailable()) {
        this.activeSessions.delete(sessionToken);
        return;
      }

      await UserSession.findOneAndUpdate(
        { sessionToken },
        { isActive: false }
      );

      // Remove from memory
      this.activeSessions.delete(sessionToken);

      console.log(`✅ Session invalidated: ${sessionToken}`);
    } catch (error) {
      console.error('Error invalidating session:', error);
    }
  }

  /**
   * Update engagement metrics
   */
  async updateEngagementMetrics(userId, actionType) {
    try {
      if (!isDatabaseAvailable()) {
        return;
      }

      // Get or create engagement metrics using upsert
      await UserEngagementMetric.findOneAndUpdate(
        { userId },
        { 
          userId,
          lastEngagementDate: new Date()
        },
        { upsert: true }
      );

      // Log engagement event
      await UserEngagementEvent.create({
        userId,
        eventType: actionType,
        eventMetadata: { timestamp: new Date().toISOString() }
      });

    } catch (error) {
      console.error('Error updating engagement metrics:', error);
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      if (!isDatabaseAvailable()) {
        console.log('⚠️ Database not available for cleanupExpiredSessions');
        return;
      }

      // Find expired sessions before updating
      const expiredSessions = await UserSession.find({
        expiresAt: { $lt: new Date() },
        isActive: true
      });

      // Mark them as inactive
      const result = await UserSession.updateMany(
        { expiresAt: { $lt: new Date() }, isActive: true },
        { isActive: false }
      );

      if (result.modifiedCount > 0) {
        console.log(`🧹 Cleaned up ${result.modifiedCount} expired sessions`);
        
        // Update user presence to offline for users with no active sessions
        for (const session of expiredSessions) {
          const activeSessions = await this.getUserSessions(session.userId);
          if (activeSessions.length === 0) {
            await this.updateUserPresence(session.userId, 'offline');
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(userId, days = 7) {
    try {
      if (!isDatabaseAvailable()) {
        return [];
      }

      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const summary = await UserActivityLog.aggregate([
        { 
          $match: { 
            userId: userId,
            createdAt: { $gt: startDate } 
          } 
        },
        {
          $group: {
            _id: '$actionType',
            actionCount: { $sum: 1 },
            avgResponseTime: { $avg: '$responseTimeMs' },
            errorCount: { 
              $sum: { $cond: [{ $eq: ['$success', false] }, 1, 0] } 
            }
          }
        },
        { $sort: { actionCount: -1 } }
      ]);

      return summary.map(s => ({
        action_type: s._id,
        action_count: s.actionCount,
        avg_response_time: s.avgResponseTime,
        error_count: s.errorCount
      }));
    } catch (error) {
      console.error('Error getting user activity summary:', error);
      return [];
    }
  }

  /**
   * Get user status (online/offline)
   */
  async getUserStatus(userId) {
    try {
      if (!isDatabaseAvailable()) {
        return { status: 'offline', lastSeen: null, isOnline: false };
      }

      const presence = await UserPresence.findOne({ userId });
      const activeSession = await UserSession.findOne({ userId, isActive: true });

      if (presence) {
        return {
          status: presence.status || 'offline',
          lastSeen: presence.lastSeen,
          isOnline: !!activeSession
        };
      }

      // Return default status if user not found
      return {
        status: 'offline',
        lastSeen: null,
        isOnline: false
      };
    } catch (error) {
      console.error('Error getting user status:', error);
      return {
        status: 'offline',
        lastSeen: null,
        isOnline: false
      };
    }
  }

  /**
   * Get system activity overview
   */
  async getSystemActivityOverview() {
    try {
      if (!isDatabaseAvailable()) {
        return {
          onlineUsers: 0,
          totalSessions: 0,
          recentActivity: 0,
          timestamp: new Date().toISOString()
        };
      }

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const [onlineUsers, totalSessions, recentActivity] = await Promise.all([
        this.getOnlineUsersCount(),
        UserSession.countDocuments({ isActive: true }),
        UserActivityLog.countDocuments({ createdAt: { $gt: oneHourAgo } })
      ]);

      return {
        onlineUsers,
        totalSessions,
        recentActivity,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting system activity overview:', error);
      return {
        onlineUsers: 0,
        totalSessions: 0,
        recentActivity: 0,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown() {
    try {
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
      }
      
      if (!isDatabaseAvailable()) {
        console.log('✅ UserActivityMonitor shutdown completed (no DB connection)');
        return;
      }

      // Mark all sessions as inactive
      await UserSession.updateMany(
        { isActive: true },
        { isActive: false }
      );
      
      console.log('✅ UserActivityMonitor shutdown completed');
    } catch (error) {
      console.error('Error during UserActivityMonitor shutdown:', error);
    }
  }
}

module.exports = UserActivityMonitor;


