const express = require('express');
const { authMiddleware } = require('./auth');
const { query } = require('../config/database');
const router = express.Router();

/**
 * @route   POST /api/reputation/review
 * @desc    Submit review for completed transaction
 * @access  Private
 */
router.post('/review', authMiddleware, async (req, res) => {
  try {
    const reviewerId = req.user.userId;
    const { transactionId, rating, comment, anonymous = false } = req.body;

    // Validate transaction exists and reviewer was part of it
    const transactionResult = await query(`
      SELECT 
        t.*,
        CASE 
          WHEN t.client_id = $1 THEN t.provider_id 
          ELSE t.client_id 
        END as reviewee_id
      FROM transactions t
      WHERE t.id = $2 
      AND t.status = 'completed'
      AND (t.client_id = $1 OR t.provider_id = $1)
    `, [reviewerId, transactionId]);

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Transaction not found or not eligible for review' 
      });
    }

    const transaction = transactionResult.rows[0];
    const revieweeId = transaction.reviewee_id;

    // Check if review already exists
    const existingReview = await query(`
      SELECT id FROM reviews 
      WHERE transaction_id = $1 AND reviewer_id = $2
    `, [transactionId, reviewerId]);

    if (existingReview.rows.length > 0) {
      return res.status(400).json({ error: 'Review already submitted' });
    }

    // Create review
    const reviewResult = await query(`
      INSERT INTO reviews (transaction_id, reviewer_id, reviewee_id, rating, comment, anonymous)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [transactionId, reviewerId, revieweeId, rating, comment, anonymous]);

    // Update reviewee's reputation score
    const reputationDelta = rating >= 4 ? 5 : rating >= 3 ? 0 : -5;
    await req.trustEngine.recordTrustEvent(
      revieweeId,
      'review_received',
      { rating, comment: comment ? 'provided' : 'none' },
      0, // No trust delta for reviews
      reputationDelta
    );

    // Recalculate trust score for reviewee
    await req.trustEngine.calculateTrustScore(revieweeId);

    res.json({
      message: 'Review submitted successfully',
      review: reviewResult.rows[0]
    });

  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({
      error: 'Failed to submit review'
    });
  }
});

/**
 * @route   GET /api/reputation/:userId
 * @desc    Get user reputation data
 * @access  Public
 */
router.get('/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    // Get user basic info
    const userResult = await query(`
      SELECT username, verification_tier, reputation_score, trust_score, created_at
      FROM users WHERE id = $1 AND status = 'active'
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get review statistics
    const reviewStats = await query(`
      SELECT 
        COUNT(*) as total_reviews,
        AVG(rating) as average_rating,
        COUNT(CASE WHEN rating = 5 THEN 1 END) as five_star,
        COUNT(CASE WHEN rating = 4 THEN 1 END) as four_star,
        COUNT(CASE WHEN rating = 3 THEN 1 END) as three_star,
        COUNT(CASE WHEN rating = 2 THEN 1 END) as two_star,
        COUNT(CASE WHEN rating = 1 THEN 1 END) as one_star
      FROM reviews 
      WHERE reviewee_id = $1
    `, [userId]);

    // Get recent reviews (non-anonymous only for privacy)
    const recentReviews = await query(`
      SELECT 
        r.rating, r.comment, r.created_at,
        u.username as reviewer_username
      FROM reviews r
      LEFT JOIN users u ON r.reviewer_id = u.id
      WHERE r.reviewee_id = $1 AND r.anonymous = false
      ORDER BY r.created_at DESC
      LIMIT 10
    `, [userId]);

    // Get transaction statistics
    const transactionStats = await query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
        COUNT(CASE WHEN status = 'disputed' THEN 1 END) as disputed_transactions
      FROM transactions 
      WHERE provider_id = $1 OR client_id = $1
    `, [userId]);

    // Get trust score breakdown
    let trustScoreBreakdown = null;
    try {
      trustScoreBreakdown = await req.trustEngine.calculateTrustScore(userId);
    } catch (error) {
      console.warn('Failed to calculate trust score:', error.message);
    }

    res.json({
      user: userResult.rows[0],
      reviewStats: reviewStats.rows[0],
      recentReviews: recentReviews.rows,
      transactionStats: transactionStats.rows[0],
      trustScoreBreakdown
    });

  } catch (error) {
    console.error('Get reputation error:', error);
    res.status(500).json({
      error: 'Failed to get reputation data'
    });
  }
});

/**
 * @route   GET /api/reputation/reviews/received
 * @desc    Get reviews received by current user
 * @access  Private
 */
router.get('/reviews/received', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const reviewsResult = await query(`
      SELECT 
        r.*, 
        u.username as reviewer_username,
        t.amount as transaction_amount
      FROM reviews r
      LEFT JOIN users u ON r.reviewer_id = u.id
      JOIN transactions t ON r.transaction_id = t.id
      WHERE r.reviewee_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    res.json({
      reviews: reviewsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: reviewsResult.rows.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get received reviews error:', error);
    res.status(500).json({
      error: 'Failed to get received reviews'
    });
  }
});

/**
 * @route   GET /api/reputation/reviews/given
 * @desc    Get reviews given by current user
 * @access  Private
 */
router.get('/reviews/given', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const reviewsResult = await query(`
      SELECT 
        r.*, 
        u.username as reviewee_username,
        t.amount as transaction_amount
      FROM reviews r
      LEFT JOIN users u ON r.reviewee_id = u.id
      JOIN transactions t ON r.transaction_id = t.id
      WHERE r.reviewer_id = $1
      ORDER BY r.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    res.json({
      reviews: reviewsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: reviewsResult.rows.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get given reviews error:', error);
    res.status(500).json({
      error: 'Failed to get given reviews'
    });
  }
});

module.exports = router;
