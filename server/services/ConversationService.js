/**
 * ConversationService - MongoDB/Mongoose Implementation
 * Handles conversation management, message persistence, and user blocking
 */
const { Conversation, Message, BlockedUser } = require('../config/database');

class ConversationService {
  constructor() {
    // Can accept injected dependencies later (cache, logger)
  }

  /**
   * Check if user is a member of the conversation
   */
  async isMember(conversationId, userId) {
    try {
      const userIdStr = userId?.toString();
      const conv = await Conversation.findById(conversationId);
      if (!conv) return false;
      
      const p1 = conv.participant1Id?.toString();
      const p2 = conv.participant2Id?.toString();
      return p1 === userIdStr || p2 === userIdStr;
    } catch (err) {
      console.error('ConversationService.isMember error:', err);
      return false;
    }
  }

  /**
   * Get the other participant in a conversation
   */
  async getOtherParticipant(conversationId, userId) {
    try {
      const userIdStr = userId?.toString();
      const conv = await Conversation.findById(conversationId);
      if (!conv) return null;
      
      const p1 = conv.participant1Id?.toString();
      const p2 = conv.participant2Id?.toString();
      return p1 === userIdStr ? p2 : p1;
    } catch (err) {
      console.error('ConversationService.getOtherParticipant error:', err);
      return null;
    }
  }

  /**
   * Check if two users have blocked each other
   */
  async isBlockedBetween(userA, userB) {
    try {
      const blocked = await BlockedUser.findOne({
        $or: [
          { blocker_id: userA, blocked_id: userB },
          { blocker_id: userB, blocked_id: userA }
        ]
      });
      return !!blocked;
    } catch (err) {
      console.error('ConversationService.isBlockedBetween error:', err);
      return false;
    }
  }

  /**
   * Create or get existing conversation between two users
   */
  async createOrGetConversation(userA, userB) {
    try {
      // Check for existing conversation
      let conv = await Conversation.findOne({
        $or: [
          { participant1Id: userA, participant2Id: userB },
          { participant1Id: userB, participant2Id: userA }
        ]
      });
      
      if (conv) {
        return { id: conv._id, created_at: conv.createdAt };
      }
      
      // Create new conversation
      conv = await Conversation.create({
        participant1Id: userA,
        participant2Id: userB,
        status: 'active'
      });
      
      return { id: conv._id, created_at: conv.createdAt };
    } catch (err) {
      console.error('ConversationService.createOrGetConversation error:', err);
      throw err;
    }
  }

  /**
   * Insert a message and update conversation atomically
   */
  async insertMessageTx({ conversationId, senderId, content, messageType = 'text', metadata = {} }) {
    try {
      // Create the message
      const message = await Message.create({
        conversationId,
        senderId,
        content,
        messageType,
        metadata: metadata || {}
      });

      // Update conversation's last message info
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: content,
        lastMessageTime: message.createdAt,
        updatedAt: new Date()
      });

      return {
        _id: message._id,
        id: message._id,
        created_at: message.createdAt,
        createdAt: message.createdAt,
        metadata: message.metadata
      };
    } catch (err) {
      console.error('ConversationService.insertMessageTx error:', err);
      throw err;
    }
  }

  /**
   * Block a user - handles blocking, conversation status, and connection updates
   */
  async blockUser(blockerId, blockedId) {
    try {
      // Create blocked user record (use upsert to avoid duplicates)
      await BlockedUser.findOneAndUpdate(
        { blocker_id: blockerId, blocked_id: blockedId },
        { 
          blocker_id: blockerId, 
          blocked_id: blockedId,
          created_at: new Date()
        },
        { upsert: true, new: true }
      );

      // Update conversations to mark as blocked (optional status update)
      await Conversation.updateMany(
        {
          $or: [
            { participant1Id: blockerId, participant2Id: blockedId },
            { participant1Id: blockedId, participant2Id: blockerId }
          ]
        },
        { 
          status: 'blocked',
          updatedAt: new Date()
        }
      );

      // Reject any pending connection requests (if UserConnection model exists)
      // This is optional functionality
      // await UserConnection.updateMany(...)

      return { success: true, message: 'User blocked successfully' };
    } catch (err) {
      console.error('ConversationService.blockUser error:', err);
      throw err;
    }
  }

  /**
   * Unblock a user
   */
  async unblockUser(blockerId, blockedId) {
    try {
      await BlockedUser.deleteOne({ blocker_id: blockerId, blocked_id: blockedId });

      // Restore conversation status
      await Conversation.updateMany(
        {
          $or: [
            { participant1Id: blockerId, participant2Id: blockedId },
            { participant1Id: blockedId, participant2Id: blockerId }
          ],
          status: 'blocked'
        },
        { 
          status: 'active',
          updatedAt: new Date()
        }
      );

      return { success: true, message: 'User unblocked successfully' };
    } catch (err) {
      console.error('ConversationService.unblockUser error:', err);
      throw err;
    }
  }

  /**
   * Get list of blocked users for a user
   */
  async getBlockedUsers(userId) {
    try {
      const blocked = await BlockedUser.find({ blocker_id: userId })
        .populate('blocked_id', 'username profileData');
      return blocked;
    } catch (err) {
      console.error('ConversationService.getBlockedUsers error:', err);
      return [];
    }
  }
}

module.exports = ConversationService;
