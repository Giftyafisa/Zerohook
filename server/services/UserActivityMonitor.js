const { query } = require('../config/database');
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
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + this.sessionTimeout);
      
      const result = await query(`
        INSERT INTO user_sessions (
          user_id, session_token, socket_id, ip_address, user_agent, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, created_at
      `, [userId, sessionToken, socketId, ipAddress, userAgent, expiresAt]);

      const session = result.rows[0];
      
      // Update user presence to online
      await this.updateUserPresence(userId, 'online', socketId);
      
      // Track in memory for quick access
      this.activeSessions.set(sessionToken, {
        id: session.id,
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
      const now = new Date();
      
      // Update or create presence record
      const result = await query(`
        INSERT INTO user_presence (user_id, status, last_seen, updated_at)
        VALUES ($1, $2, $3, $3)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          status = EXCLUDED.status,
          last_seen = EXCLUDED.last_seen,
          updated_at = EXCLUDED.updated_at
        RETURNING id
      `, [userId, status, now]);

      // Update users table last_active
      await query(`
        UPDATE users 
        SET last_active = $1 
        WHERE id = $2
      `, [now, userId]);

      // Update session if socketId provided
      if (socketId) {
        await query(`
          UPDATE user_sessions 
          SET socket_id = $1, last_activity = $2
          WHERE user_id = $3 AND is_active = true
        `, [socketId, now, userId]);
      }

      console.log(`✅ User ${userId} presence updated to: ${status}`);
      return result.rows[0];
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
      const {
        actionType,
        actionData: data,
        ipAddress,
        userAgent,
        responseTimeMs,
        success = true,
        errorMessage = null
      } = actionData;

      await query(`
        INSERT INTO user_activity_logs (
          user_id, action_type, action_data, ip_address, user_agent,
          response_time_ms, success, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [userId, actionType, JSON.stringify(data), ipAddress, userAgent, responseTimeMs, success, errorMessage]);

      // Update session last activity
      await query(`
        UPDATE user_sessions 
        SET last_activity = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND is_active = true
      `, [userId]);

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
      await query(`
        UPDATE user_presence 
        SET is_typing = $1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `, [isTyping, userId]);

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
      await query(`
        UPDATE user_presence 
        SET current_page = $1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $2
      `, [page, userId]);

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
      const result = await query(`
        SELECT status, last_seen, is_typing, current_page
        FROM user_presence 
        WHERE user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return { status: 'offline', lastSeen: null, isTyping: false, currentPage: null };
      }

      const presence = result.rows[0];
      return {
        status: presence.status,
        lastSeen: presence.last_seen,
        isTyping: presence.is_typing,
        currentPage: presence.current_page
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
      const result = await query(`
        SELECT COUNT(*) as count
        FROM user_presence 
        WHERE status = 'online' AND last_seen > NOW() - INTERVAL '5 minutes'
      `);

      return parseInt(result.rows[0].count);
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
      const result = await query(`
        SELECT id, session_token, socket_id, ip_address, user_agent, 
               last_activity, is_active, expires_at, created_at
        FROM user_sessions 
        WHERE user_id = $1 AND is_active = true
        ORDER BY created_at DESC
      `, [userId]);

      return result.rows;
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
      const result = await query(`
        SELECT us.*, u.username, u.email
        FROM user_sessions us
        JOIN users u ON us.user_id = u.id
        WHERE us.session_token = $1 AND us.is_active = true AND us.expires_at > NOW()
      `, [sessionToken]);

      if (result.rows.length === 0) {
        return null;
      }

      const session = result.rows[0];
      
      // Update last activity
      await query(`
        UPDATE user_sessions 
        SET last_activity = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [session.id]);

      return {
        userId: session.user_id,
        username: session.username,
        email: session.email,
        sessionId: session.id,
        socketId: session.socket_id
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
      await query(`
        UPDATE user_sessions 
        SET is_active = false
        WHERE session_token = $1
      `, [sessionToken]);

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
      // Get or create engagement metrics
      let result = await query(`
        SELECT id FROM user_engagement_metrics WHERE user_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        // Create new engagement metrics
        await query(`
          INSERT INTO user_engagement_metrics (user_id, last_engagement_date)
          VALUES ($1, CURRENT_DATE)
        `, [userId]);
      } else {
        // Update last engagement date
        await query(`
          UPDATE user_engagement_metrics 
          SET last_engagement_date = CURRENT_DATE
          WHERE user_id = $1
        `, [userId]);
      }

      // Log engagement event
      await query(`
        INSERT INTO user_engagement_events (user_id, event_type, event_metadata)
        VALUES ($1, $2, $3)
      `, [userId, actionType, JSON.stringify({ timestamp: new Date().toISOString() })]);

    } catch (error) {
      console.error('Error updating engagement metrics:', error);
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const result = await query(`
        UPDATE user_sessions 
        SET is_active = false
        WHERE expires_at < NOW() AND is_active = true
        RETURNING id, user_id
      `);

      if (result.rows.length > 0) {
        console.log(`🧹 Cleaned up ${result.rows.length} expired sessions`);
        
        // Update user presence to offline for users with no active sessions
        for (const row of result.rows) {
          const activeSessions = await this.getUserSessions(row.user_id);
          if (activeSessions.length === 0) {
            await this.updateUserPresence(row.user_id, 'offline');
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
      const result = await query(`
        SELECT 
          action_type,
          COUNT(*) as action_count,
          AVG(response_time_ms) as avg_response_time,
          COUNT(CASE WHEN success = false THEN 1 END) as error_count
        FROM user_activity_logs 
        WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${days} days'
        GROUP BY action_type
        ORDER BY action_count DESC
      `, [userId]);

      return result.rows;
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
      const result = await query(`
        SELECT 
          up.status,
          up.last_seen,
          CASE 
            WHEN us.user_id IS NOT NULL AND us.is_active = true THEN true
            ELSE false
          END as is_online
        FROM user_presence up
        LEFT JOIN user_sessions us ON up.user_id = us.user_id AND us.is_active = true
        WHERE up.user_id = $1
      `, [userId]);

      if (result.rows.length > 0) {
        const row = result.rows[0];
        return {
          status: row.status || 'offline',
          lastSeen: row.last_seen,
          isOnline: row.is_online || false
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
      const [onlineUsers, totalSessions, recentActivity] = await Promise.all([
        this.getOnlineUsersCount(),
        query('SELECT COUNT(*) as count FROM user_sessions WHERE is_active = true'),
        query(`
          SELECT COUNT(*) as count 
          FROM user_activity_logs 
          WHERE created_at > NOW() - INTERVAL '1 hour'
        `)
      ]);

      return {
        onlineUsers,
        totalSessions: parseInt(totalSessions.rows[0].count),
        recentActivity: parseInt(recentActivity.rows[0].count),
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
      
      // Mark all sessions as inactive
      await query(`
        UPDATE user_sessions 
        SET is_active = false
        WHERE is_active = true
      `);
      
      console.log('✅ UserActivityMonitor shutdown completed');
    } catch (error) {
      console.error('Error during UserActivityMonitor shutdown:', error);
    }
  }
}

module.exports = UserActivityMonitor;


