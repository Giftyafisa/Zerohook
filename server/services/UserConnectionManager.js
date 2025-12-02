const { query } = require('../config/database');
const ConversationService = require('./ConversationService');

class UserConnectionManager {
  constructor() {
    this.connectionTypes = {
      MESSAGE: 'message',
      CONTACT_REQUEST: 'contact_request',
      VIDEO_CALL: 'video_call',
      SERVICE_INQUIRY: 'service_inquiry'
    };
  }

  /**
   * Check connection status between two users
   */
  async checkConnectionStatus(userId1, userId2) {
    try {
      const connection = await query(`
        SELECT id, status, connection_type, created_at
        FROM user_connections 
        WHERE (from_user_id = $1 AND to_user_id = $2) 
           OR (from_user_id = $2 AND to_user_id = $1)
      `, [userId1, userId2]);

      if (connection.rows.length === 0) {
        return {
          exists: false,
          status: null,
          connectionType: null,
          createdAt: null
        };
      }

      const conn = connection.rows[0];
      return {
        exists: true,
        status: conn.status,
        connectionType: conn.connection_type,
        createdAt: conn.created_at,
        connectionId: conn.id
      };
    } catch (error) {
      console.error('Check connection status error:', error);
      throw error;
    }
  }

  /**
   * Send a contact request to another user
   */
  async sendContactRequest(fromUserId, toUserId, message = '', connectionType = 'contact_request') {
    try {
      // Check if users exist and are not blocked
      const userCheck = await query(`
        SELECT u1.id as from_user_id, u1.username as from_username, u1.verification_tier as from_tier,
               u2.id as to_user_id, u2.username as to_username, u2.verification_tier as to_tier
        FROM users u1, users u2
        WHERE u1.id = $1 AND u2.id = $2
      `, [fromUserId, toUserId]);

      if (userCheck.rows.length === 0) {
        throw new Error('One or both users not found');
      }

      // Check if already connected
      const existingConnection = await query(`
        SELECT id FROM user_connections 
        WHERE (from_user_id = $1 AND to_user_id = $2) 
           OR (from_user_id = $2 AND to_user_id = $1)
      `, [fromUserId, toUserId]);

      if (existingConnection.rows.length > 0) {
        throw new Error('Users are already connected');
      }

      // Check if blocked
      const blockedCheck = await query(`
        SELECT id FROM blocked_users 
        WHERE (blocker_id = $1 AND blocked_id = $2) 
           OR (blocker_id = $2 AND blocked_id = $1)
      `, [fromUserId, toUserId]);

      if (blockedCheck.rows.length > 0) {
        throw new Error('Cannot connect with blocked user');
      }

      // Create connection request
      const connectionResult = await query(`
        INSERT INTO user_connections (
          from_user_id, to_user_id, connection_type, message, status, created_at
        ) VALUES ($1, $2, $3, $4, 'pending', CURRENT_TIMESTAMP)
        RETURNING id, created_at
      `, [fromUserId, toUserId, connectionType, message]);

      // Create notification for recipient
      await query(`
        INSERT INTO notifications (
          user_id, type, title, message, data, created_at
        ) VALUES ($1, 'contact_request', 'New Contact Request', $2, $3, CURRENT_TIMESTAMP)
      `, [
        toUserId, 
        `You have a new contact request from ${userCheck.rows[0].from_username}`,
        JSON.stringify({
          connectionId: connectionResult.rows[0].id,
          fromUserId,
          fromUsername: userCheck.rows[0].from_username,
          message,
          connectionType
        })
      ]);

      return {
        success: true,
        connectionId: connectionResult.rows[0].id,
        message: 'Contact request sent successfully'
      };

    } catch (error) {
      console.error('Send contact request error:', error);
      throw error;
    }
  }

  /**
   * Accept or reject a contact request
   */
  async respondToContactRequest(connectionId, userId, action) {
    try {
      if (!['accept', 'reject'].includes(action)) {
        throw new Error('Invalid action. Must be accept or reject');
      }

      // Get connection details
      const connectionResult = await query(`
        SELECT uc.*, u.username as from_username
        FROM user_connections uc
        JOIN users u ON uc.from_user_id = u.id
        WHERE uc.id = $1 AND uc.to_user_id = $2 AND uc.status = 'pending'
      `, [connectionId, userId]);

      if (connectionResult.rows.length === 0) {
        throw new Error('Contact request not found or already processed');
      }

      const connection = connectionResult.rows[0];
      const newStatus = action === 'accept' ? 'accepted' : 'rejected';

      // Update connection status
      await query(`
        UPDATE user_connections 
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [newStatus, connectionId]);

      if (action === 'accept') {
        // Create conversation between users (conversations table has no 'status' column)
        await query(`
          INSERT INTO conversations (participant1_id, participant2_id, created_at, updated_at)
          VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          ON CONFLICT DO NOTHING
        `, [connection.from_user_id, connection.to_user_id]);

        // Send welcome message
        const welcomeMessage = `Hi! Thanks for accepting my contact request. How can I help you today?`;
        await query(`
          INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
          SELECT c.id, $1, $2, 'text', CURRENT_TIMESTAMP
          FROM conversations c
          WHERE (c.participant1_id = $1 AND c.participant2_id = $3)
             OR (c.participant1_id = $3 AND c.participant2_id = $1)
        `, [connection.from_user_id, welcomeMessage, connection.to_user_id]);
      }

      // Notify the requester
      await query(`
        INSERT INTO notifications (
          user_id, type, title, message, data, created_at
        ) VALUES ($1, 'contact_response', 'Contact Request Response', $2, $3, CURRENT_TIMESTAMP)
      `, [
        connection.from_user_id,
        `Your contact request was ${action}ed`,
        JSON.stringify({
          connectionId,
          action,
          toUserId: connection.to_user_id
        })
      ]);

      return {
        success: true,
        message: `Contact request ${action}ed successfully`,
        status: newStatus
      };

    } catch (error) {
      console.error('Respond to contact request error:', error);
      throw error;
    }
  }

  /**
   * Get user's connections and pending requests
   */
  async getUserConnections(userId) {
    try {
      const connections = await query(`
        SELECT 
          uc.id,
          uc.connection_type,
          uc.message,
          uc.status,
          uc.created_at,
          CASE 
            WHEN uc.from_user_id = $1 THEN uc.to_user_id
            ELSE uc.from_user_id
          END as other_user_id,
          CASE 
            WHEN uc.from_user_id = $1 THEN u2.username
            ELSE u1.username
          END as other_username,
          CASE 
            WHEN uc.from_user_id = $1 THEN u2.verification_tier
            ELSE u1.verification_tier
          END as other_tier,
          CASE 
            WHEN uc.from_user_id = $1 THEN u2.profile_data->>'profile_picture'
            ELSE u1.profile_data->>'profile_picture'
          END as other_picture
        FROM user_connections uc
        JOIN users u1 ON uc.from_user_id = u1.id
        JOIN users u2 ON uc.to_user_id = u2.id
        WHERE uc.from_user_id = $1 OR uc.to_user_id = $1
        ORDER BY uc.created_at DESC
      `, [userId]);

      return {
        success: true,
        connections: connections.rows.map(conn => ({
          id: conn.id,
          connectionType: conn.connection_type,
          message: conn.message,
          status: conn.status,
          createdAt: conn.created_at,
          otherUser: {
            id: conn.other_user_id,
            username: conn.other_username,
            verificationTier: conn.other_tier,
            profilePicture: conn.other_picture
          }
        }))
      };

    } catch (error) {
      console.error('Get user connections error:', error);
      throw error;
    }
  }

  /**
   * Send service inquiry message
   */
  async sendServiceInquiry(fromUserId, toUserId, serviceId, message) {
    try {
      // Check if service exists and belongs to the recipient
      const serviceCheck = await query(`
        SELECT id, title, provider_id FROM services WHERE id = $1
      `, [serviceId]);

      if (serviceCheck.rows.length === 0) {
        throw new Error('Service not found');
      }

      if (serviceCheck.rows[0].provider_id !== toUserId) {
        throw new Error('Service does not belong to the specified user');
      }

      // Create or get existing conversation
      let conversation = await query(`
        SELECT id FROM conversations 
        WHERE (participant1_id = $1 AND participant2_id = $2) 
           OR (participant1_id = $2 AND participant2_id = $1)
      `, [fromUserId, toUserId]);

      if (conversation.rows.length === 0) {
        // Create new conversation
        conversation = await query(`
          INSERT INTO conversations (participant1_id, participant2_id, created_at)
          VALUES ($1, $2, CURRENT_TIMESTAMP)
          RETURNING id
        `, [fromUserId, toUserId]);
      }

      const conversationId = conversation.rows[0].id;

      // Send service inquiry message
      const inquiryMessage = `Service Inquiry: ${serviceCheck.rows[0].title}\n\n${message}`;
      await query(`
        INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
        VALUES ($1, $2, $3, 'service_inquiry', CURRENT_TIMESTAMP)
      `, [
        conversationId, 
        fromUserId, 
        inquiryMessage
      ]);

      // Update conversation last message
      await query(`
        UPDATE conversations 
        SET last_message = $1, last_message_time = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [inquiryMessage, conversationId]);

      // Create notification for service provider
      await query(`
        INSERT INTO notifications (
          user_id, type, title, message, data, created_at
        ) VALUES ($1, 'service_inquiry', 'New Service Inquiry', $2, $3, CURRENT_TIMESTAMP)
      `, [
        toUserId,
        'You have a new service inquiry',
        JSON.stringify({
          conversationId,
          fromUserId,
          serviceId,
          serviceTitle: serviceCheck.rows[0].title
        })
      ]);

      return {
        success: true,
        conversationId,
        message: 'Service inquiry sent successfully'
      };

    } catch (error) {
      console.error('Send service inquiry error:', error);
      throw error;
    }
  }

  /**
   * Get user's pending contact requests
   */
  async getPendingRequests(userId) {
    try {
      const requests = await query(`
        SELECT 
          uc.id,
          uc.connection_type,
          uc.message,
          uc.created_at,
          u.username as from_username,
          u.verification_tier as from_tier,
          u.profile_data->>'profile_picture' as from_picture
        FROM user_connections uc
        JOIN users u ON uc.from_user_id = u.id
        WHERE uc.to_user_id = $1 AND uc.status = 'pending'
        ORDER BY uc.created_at DESC
      `, [userId]);

      return {
        success: true,
        requests: requests.rows.map(req => ({
          id: req.id,
          connectionType: req.connection_type,
          message: req.message,
          createdAt: req.created_at,
          fromUser: {
            username: req.from_username,
            verificationTier: req.from_tier,
            profilePicture: req.from_picture
          }
        }))
      };

    } catch (error) {
      console.error('Get pending requests error:', error);
      throw error;
    }
  }

  /**
   * Block a user
   */
  async blockUser(blockerId, blockedId) {
    try {
      // Delegate to ConversationService to centralize block behavior
      const cs = new ConversationService();
      return await cs.blockUser(blockerId, blockedId);

    } catch (error) {
      console.error('Block user error:', error);
      throw error;
    }
  }
}

module.exports = UserConnectionManager;



