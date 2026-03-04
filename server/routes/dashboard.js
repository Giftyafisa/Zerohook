const express = require('express');
const router = express.Router();
const { User, Service, Transaction, Review } = require('../config/database');
const { authMiddleware } = require('./auth');

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get user dashboard statistics
 * @access  Private
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user profile data
    const user = await User.findById(userId).select(
      'username email verification_tier reputation_score profile_data created_at last_active'
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Get user services count
    const serviceStats = await Service.aggregate([
      { $match: { provider_id: user._id } },
      {
        $group: {
          _id: null,
          total_services: { $sum: 1 },
          active_services: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          inactive_services: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } }
        }
      }
    ]);

    // Get user transactions count (as client or provider)
    const transactionStats = await Transaction.aggregate([
      { $match: { $or: [{ client_id: user._id }, { provider_id: user._id }] } },
      {
        $group: {
          _id: null,
          total_transactions: { $sum: 1 },
          completed_transactions: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          pending_transactions: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }
        }
      }
    ]);

    // Get user earnings (as provider only)
    const earningsStats = await Transaction.aggregate([
      { $match: { provider_id: user._id, status: 'completed' } },
      {
        $group: {
          _id: null,
          total_earnings: { $sum: '$amount' },
          completed_earnings: { $sum: '$amount' }
        }
      }
    ]);

    // Get user reviews count
    const reviewStats = await Review.aggregate([
      { $match: { reviewee_id: user._id } },
      {
        $group: {
          _id: null,
          total_reviews: { $sum: 1 },
          average_rating: { $avg: '$rating' }
        }
      }
    ]);

    const services = serviceStats[0] || { total_services: 0, active_services: 0, inactive_services: 0 };
    const transactions = transactionStats[0] || { total_transactions: 0, completed_transactions: 0, pending_transactions: 0 };
    const earnings = earningsStats[0] || { total_earnings: 0, completed_earnings: 0 };
    const reviews = reviewStats[0] || { total_reviews: 0, average_rating: 0 };

    // Calculate wallet balance: earnings as provider minus spending as client
    const spendingStats = await Transaction.aggregate([
      { $match: { client_id: user._id, status: { $in: ['completed', 'held'] } } },
      { $group: { _id: null, total_spent: { $sum: '$amount' } } }
    ]);
    const spending = spendingStats[0] || { total_spent: 0 };
    const walletBalance = (parseFloat(earnings.total_earnings) || 0) - (parseFloat(spending.total_spent) || 0);

    // Calculate escrow held: sum of transactions currently in 'held' status for this user
    const escrowStats = await Transaction.aggregate([
      { $match: { $or: [{ client_id: user._id }, { provider_id: user._id }], status: 'held' } },
      { $group: { _id: null, total_held: { $sum: '$amount' } } }
    ]);
    const escrowHeld = parseFloat(escrowStats[0]?.total_held) || 0;

    // Unread messages count
    const { Conversation, Message } = require('../config/database');
    const userConversations = await Conversation.find({
      $or: [{ participant1Id: user._id }, { participant2Id: user._id }]
    }).select('_id').lean();
    const conversationIds = userConversations.map(c => c._id);
    const unreadMessages = conversationIds.length > 0
      ? await Message.countDocuments({
          conversationId: { $in: conversationIds },
          senderId: { $ne: user._id },
          read: false
        })
      : 0;

    // Calculate dashboard statistics
    const dashboardStats = {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        verificationTier: user.verification_tier,
        trustScore: parseFloat(user.reputation_score) || 0,
        memberSince: new Date(user.created_at).getFullYear(),
        lastActive: user.last_active || user.created_at
      },
      stats: {
        totalEarnings: parseFloat(earnings.total_earnings) || 0,
        activeServices: parseInt(services.active_services) || 0,
        totalServices: parseInt(services.total_services) || 0,
        completedTransactions: parseInt(transactions.completed_transactions) || 0,
        totalTransactions: parseInt(transactions.total_transactions) || 0,
        pendingTransactions: parseInt(transactions.pending_transactions) || 0,
        totalReviews: parseInt(reviews.total_reviews) || 0,
        averageRating: parseFloat(reviews.average_rating) || 0
      },
      walletBalance: Math.max(0, walletBalance),
      escrowHeld,
      unreadMessages,
      profile: user.profile_data || {}
    };

    res.json({ success: true, ...dashboardStats });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard statistics',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
