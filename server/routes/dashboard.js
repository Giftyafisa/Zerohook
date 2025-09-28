const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
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
    const userResult = await query(`
      SELECT 
        id, username, email, verification_tier, 
        reputation_score, profile_data, 
        created_at, last_active
      FROM users 
      WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    
    // Get user services count
    const servicesResult = await query(`
      SELECT 
        COUNT(*) as total_services,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_services,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_services
      FROM services 
      WHERE provider_id = $1
    `, [userId]);

    // Get user transactions count (as client or provider)
    const transactionsResult = await query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions
      FROM transactions 
      WHERE client_id = $1 OR provider_id = $1
    `, [userId]);

    // Get user earnings (as provider only)
    const earningsResult = await query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_earnings,
        COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0) as completed_earnings
      FROM transactions 
      WHERE provider_id = $1 AND status = 'completed'
    `, [userId]);

    // Get user reviews count
    const reviewsResult = await query(`
      SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating
      FROM reviews 
      WHERE reviewee_id = $1
    `, [userId]);

    const services = servicesResult.rows[0] || { total_services: 0, active_services: 0, inactive_services: 0 };
    const transactions = transactionsResult.rows[0] || { total_transactions: 0, completed_transactions: 0, pending_transactions: 0 };
    const earnings = earningsResult.rows[0] || { total_earnings: 0, completed_earnings: 0 };
    const reviews = reviewsResult.rows[0] || { total_reviews: 0, average_rating: 0 };

    // Calculate dashboard statistics
    const dashboardStats = {
      user: {
        id: user.id,
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
      profile: user.profile_data || {}
    };

    res.json(dashboardStats);

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      error: 'Failed to get dashboard statistics',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
