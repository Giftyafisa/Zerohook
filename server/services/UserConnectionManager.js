const mongoose = require('mongoose');
const {
  User,
  BlockedUser,
  Service,
  Conversation,
  Message,
  UserConnection,
  SugarAccessPayment
} = require('../config/database');
const { getAccountType, SUGAR_TYPES } = require('../utils/accountTypeUtils');
const ConversationService = require('./ConversationService');
const NotificationService = require('./NotificationService');

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const buildActiveConnectionWindowQuery = (now = new Date()) => ({
  $or: [
    { connection_expires_at: { $exists: false } },
    { connection_expires_at: null },
    { connection_expires_at: { $gt: now } }
  ]
});

class UserConnectionManager {
  constructor() {
    this.connectionTypes = {
      MESSAGE: 'message',
      CONTACT_REQUEST: 'contact_request',
      VIDEO_CALL: 'video_call',
      SERVICE_INQUIRY: 'service_inquiry'
    };
  }

  async resolveSugarConnectionPolicy(fromUser, toUser) {
    const fromType = getAccountType(fromUser) || 'client';
    const toType = getAccountType(toUser) || 'client';
    const eligibleViewerTypes = new Set(['provider']);

    const viewerToSugar = eligibleViewerTypes.has(fromType) && SUGAR_TYPES.includes(toType);
    const sugarToViewer = eligibleViewerTypes.has(toType) && SUGAR_TYPES.includes(fromType);

    if (!viewerToSugar && !sugarToViewer) {
      return {
        connectionPolicy: 'standard',
        connectionExpiresAt: null,
        sugarAccessType: null,
        sugarAccessPaymentId: null
      };
    }

    const viewerUser = viewerToSugar ? fromUser : toUser;
    const sugarUser = viewerToSugar ? toUser : fromUser;
    const sugarType = getAccountType(sugarUser);
    const now = new Date();

    const requiredAccessTypes = sugarType === 'sugar_daddy'
      ? ['sugar_daddy', 'both']
      : ['sugar_mommy', 'both'];

    const activePayment = await SugarAccessPayment.findOne({
      providerId: viewerUser._id,
      paymentStatus: 'completed',
      accessType: { $in: requiredAccessTypes },
      accessExpiresAt: { $gt: now }
    })
      .sort({ accessExpiresAt: -1 })
      .select('_id accessType accessExpiresAt')
      .lean();

    if (!activePayment) {
      throw new Error('Active sugar access payment required to connect with this VVIP profile');
    }

    const oneYearFromNow = new Date(Date.now() + ONE_YEAR_MS);
    const paymentExpiry = new Date(activePayment.accessExpiresAt);
    const connectionExpiresAt = paymentExpiry < oneYearFromNow ? paymentExpiry : oneYearFromNow;

    return {
      connectionPolicy: 'sugar_limited',
      connectionExpiresAt,
      sugarAccessType: activePayment.accessType,
      sugarAccessPaymentId: activePayment._id
    };
  }

  /**
   * Check connection status between two users
   */
  async checkConnectionStatus(userId1, userId2) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId1) || !mongoose.Types.ObjectId.isValid(userId2)) {
        return {
          exists: false,
          status: null,
          connectionType: null,
          createdAt: null
        };
      }

      const user1 = new mongoose.Types.ObjectId(userId1);
      const user2 = new mongoose.Types.ObjectId(userId2);
      const now = new Date();

      const basePairQuery = {
        $or: [
          { from_user_id: user1, to_user_id: user2 },
          { from_user_id: user2, to_user_id: user1 }
        ]
      };

      const connection = await UserConnection.findOne({
        $and: [
          basePairQuery,
          buildActiveConnectionWindowQuery(now)
        ]
      }).select('_id status connection_type created_at connection_expires_at').lean();

      if (connection) {
        return {
          exists: true,
          status: connection.status,
          connectionType: connection.connection_type,
          createdAt: connection.created_at,
          expiresAt: connection.connection_expires_at || null,
          connectionId: connection._id.toString()
        };
      }

      const historicalConnection = await UserConnection.findOne(basePairQuery)
        .sort({ updated_at: -1 })
        .select('_id status connection_type created_at connection_expires_at')
        .lean();

      if (historicalConnection?.connection_expires_at && new Date(historicalConnection.connection_expires_at) <= now) {
        return {
          exists: false,
          status: 'expired',
          connectionType: historicalConnection.connection_type,
          createdAt: historicalConnection.created_at,
          expiredAt: historicalConnection.connection_expires_at,
          connectionId: historicalConnection._id.toString()
        };
      }

      return {
        exists: false,
        status: null,
        connectionType: null,
        createdAt: null
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
      if (!mongoose.Types.ObjectId.isValid(fromUserId) || !mongoose.Types.ObjectId.isValid(toUserId)) {
        throw new Error('One or both users not found');
      }

      const fromObjId = new mongoose.Types.ObjectId(fromUserId);
      const toObjId = new mongoose.Types.ObjectId(toUserId);

      // Check if users exist and are not blocked
      const users = await User.find({ _id: { $in: [fromObjId, toObjId] } })
        .select('_id username verification_tier profile_data profileData accountType account_type')
        .lean();

      if (users.length !== 2) {
        throw new Error('One or both users not found');
      }

      const fromUser = users.find((u) => u._id.toString() === fromUserId.toString());
      const toUser = users.find((u) => u._id.toString() === toUserId.toString());

      if (!fromUser || !toUser) {
        throw new Error('One or both users not found');
      }

      // Check if already connected
      const now = new Date();
      const existingConnection = await UserConnection.findOne({
        $and: [
          {
            $or: [
              { from_user_id: fromObjId, to_user_id: toObjId },
              { from_user_id: toObjId, to_user_id: fromObjId }
            ]
          },
          buildActiveConnectionWindowQuery(now)
        ]
      }).select('_id').lean();

      if (existingConnection) {
        throw new Error('Users are already connected');
      }

      // Check if blocked
      const blockedCheck = await BlockedUser.findOne({
        $or: [
          { blocker_id: fromObjId, blocked_id: toObjId },
          { blocker_id: toObjId, blocked_id: fromObjId }
        ]
      }).select('_id').lean();

      if (blockedCheck) {
        throw new Error('Cannot connect with blocked user');
      }

      const connectionPolicy = await this.resolveSugarConnectionPolicy(fromUser, toUser);

      // Create connection request
      const connection = await UserConnection.create({
        from_user_id: fromObjId,
        to_user_id: toObjId,
        connection_type: connectionType,
        message,
        status: 'pending',
        connection_policy: connectionPolicy.connectionPolicy,
        connection_expires_at: connectionPolicy.connectionExpiresAt,
        sugar_access_type: connectionPolicy.sugarAccessType,
        sugar_access_payment_id: connectionPolicy.sugarAccessPaymentId
      });

      // Create notification for recipient
      await NotificationService.create(
        toUserId,
        'contact_request',
        'New Contact Request',
        `You have a new contact request from ${fromUser.username}`,
        {
          connectionId: connection._id.toString(),
          fromUserId,
          fromUsername: fromUser.username,
          message,
          connectionType
        }
      );

      return {
        success: true,
        connectionId: connection._id.toString(),
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

      if (!mongoose.Types.ObjectId.isValid(connectionId) || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Contact request not found or already processed');
      }

      const connectionObjId = new mongoose.Types.ObjectId(connectionId);
      const userObjId = new mongoose.Types.ObjectId(userId);
      const now = new Date();

      // Get connection details
      const connection = await UserConnection.findOne({
        $and: [
          {
            _id: connectionObjId,
            to_user_id: userObjId,
            status: 'pending'
          },
          buildActiveConnectionWindowQuery(now)
        ]
      })
        .populate('from_user_id', 'username')
        .lean();

      if (!connection) {
        throw new Error('Contact request not found or already processed');
      }

      const newStatus = action === 'accept' ? 'accepted' : 'rejected';

      // Update connection status
      await UserConnection.updateOne(
        { _id: connectionObjId },
        { $set: { status: newStatus, updated_at: new Date() } }
      );

      if (action === 'accept') {
        let conversation = await Conversation.findOne({
          $or: [
            { participant1Id: connection.from_user_id._id, participant2Id: connection.to_user_id },
            { participant1Id: connection.to_user_id, participant2Id: connection.from_user_id._id }
          ]
        }).select('_id').lean();

        if (!conversation) {
          conversation = await Conversation.create({
            participant1Id: connection.from_user_id._id,
            participant2Id: connection.to_user_id,
            status: 'active'
          });
        }

        // Send welcome message
        const welcomeMessage = `Hi! Thanks for accepting my contact request. How can I help you today?`;
        const conversationId = conversation._id || conversation.id;

        await Message.create({
          conversationId,
          senderId: connection.from_user_id._id,
          content: welcomeMessage,
          messageType: 'text',
          metadata: {}
        });

        await Conversation.updateOne(
          { _id: conversationId },
          {
            $set: {
              lastMessage: welcomeMessage,
              lastMessageTime: new Date(),
              updatedAt: new Date()
            }
          }
        );
      }

      // Notify the requester
      await NotificationService.create(
        connection.from_user_id._id.toString(),
        'contact_response',
        'Contact Request Response',
        `Your contact request was ${action}ed`,
        {
          connectionId,
          action,
          toUserId: connection.to_user_id.toString()
        }
      );

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
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return { success: true, connections: [] };
      }

      const userObjId = new mongoose.Types.ObjectId(userId);
      const now = new Date();

      const connections = await UserConnection.find({
        $and: [
          { $or: [{ from_user_id: userObjId }, { to_user_id: userObjId }] },
          buildActiveConnectionWindowQuery(now)
        ]
      })
        .populate('from_user_id', 'username verification_tier profile_data')
        .populate('to_user_id', 'username verification_tier profile_data')
        .sort({ created_at: -1 })
        .lean();

      return {
        success: true,
        connections: connections.map((conn) => {
          const isSender = conn.from_user_id?._id?.toString() === userId.toString();
          const otherUser = isSender ? conn.to_user_id : conn.from_user_id;

          return {
            id: conn._id.toString(),
            connectionType: conn.connection_type,
            connectionPolicy: conn.connection_policy || 'standard',
            message: conn.message,
            status: conn.status,
            createdAt: conn.created_at,
            expiresAt: conn.connection_expires_at || null,
            otherUser: {
              id: otherUser?._id?.toString(),
              username: otherUser?.username,
              verificationTier: otherUser?.verification_tier,
              profilePicture: otherUser?.profile_data?.profile_picture || null
            }
          };
        })
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
      if (!mongoose.Types.ObjectId.isValid(fromUserId) || !mongoose.Types.ObjectId.isValid(toUserId) || !mongoose.Types.ObjectId.isValid(serviceId)) {
        throw new Error('Service not found');
      }

      const fromObjId = new mongoose.Types.ObjectId(fromUserId);
      const toObjId = new mongoose.Types.ObjectId(toUserId);
      const serviceObjId = new mongoose.Types.ObjectId(serviceId);

      // Check if service exists and belongs to the recipient
      const service = await Service.findById(serviceObjId)
        .select('_id title provider_id')
        .lean();

      if (!service) {
        throw new Error('Service not found');
      }

      if (service.provider_id?.toString() !== toUserId.toString()) {
        throw new Error('Service does not belong to the specified user');
      }

      // Create or get existing conversation
      let conversation = await Conversation.findOne({
        $or: [
          { participant1Id: fromObjId, participant2Id: toObjId },
          { participant1Id: toObjId, participant2Id: fromObjId }
        ]
      }).select('_id').lean();

      if (!conversation) {
        // Create new conversation
        conversation = await Conversation.create({
          participant1Id: fromObjId,
          participant2Id: toObjId,
          status: 'active'
        });
      }

      const conversationId = conversation._id || conversation.id;

      // Send service inquiry message
      const inquiryMessage = `Service Inquiry: ${service.title}\n\n${message}`;
      await Message.create({
        conversationId,
        senderId: fromObjId,
        content: inquiryMessage,
        messageType: 'service_inquiry',
        metadata: { serviceId: serviceObjId }
      });

      // Update conversation last message
      await Conversation.updateOne(
        { _id: conversationId },
        {
          $set: {
            lastMessage: inquiryMessage,
            lastMessageTime: new Date(),
            updatedAt: new Date()
          }
        }
      );

      // Create notification for service provider
      await NotificationService.create(
        toUserId,
        'service_inquiry',
        'New Service Inquiry',
        'You have a new service inquiry',
        {
          conversationId: conversationId.toString(),
          fromUserId,
          serviceId,
          serviceTitle: service.title
        }
      );

      return {
        success: true,
        conversationId: conversationId.toString(),
        serviceTitle: service.title,
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
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return { success: true, requests: [] };
      }

      const userObjId = new mongoose.Types.ObjectId(userId);
      const now = new Date();

      const requests = await UserConnection.find({
        $and: [
          {
            to_user_id: userObjId,
            status: 'pending'
          },
          buildActiveConnectionWindowQuery(now)
        ]
      })
        .populate('from_user_id', 'username verification_tier profile_data')
        .sort({ created_at: -1 })
        .lean();

      return {
        success: true,
        requests: requests.map((req) => ({
          id: req._id.toString(),
          connectionType: req.connection_type,
          message: req.message,
          createdAt: req.created_at,
          fromUser: {
            id: req.from_user_id?._id?.toString(),
            username: req.from_user_id?.username,
            verificationTier: req.from_user_id?.verification_tier,
            profilePicture: req.from_user_id?.profile_data?.profile_picture || null
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



