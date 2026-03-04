const express = require('express');
const { authMiddleware } = require('./auth');
const mongoose = require('mongoose');
const { User, Review, Transaction } = require('../config/database');
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

    if (!mongoose.Types.ObjectId.isValid(reviewerId) || !mongoose.Types.ObjectId.isValid(transactionId)) {
      return res.status(400).json({ success: false, error: 'Invalid reviewer or transaction ID' });
    }

    // Validate transaction exists and reviewer was part of it
    const transaction = await Transaction.findOne({
      _id: transactionId,
      status: 'completed',
      $or: [{ client_id: reviewerId }, { provider_id: reviewerId }]
    }).lean();

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found or not eligible for review' 
      });
    }

    const revieweeId = transaction.client_id?.toString() === reviewerId
      ? transaction.provider_id?.toString()
      : transaction.client_id?.toString();

    // Check if review already exists
    const existingReview = await Review.findOne({ transaction_id: transactionId, reviewer_id: reviewerId })
      .select('_id')
      .lean();

    if (existingReview) {
      return res.status(400).json({ success: false, error: 'Review already submitted' });
    }

    // Create review
    const review = await Review.create({
      transaction_id: new mongoose.Types.ObjectId(transactionId),
      reviewer_id: new mongoose.Types.ObjectId(reviewerId),
      reviewee_id: new mongoose.Types.ObjectId(revieweeId),
      rating: Number(rating),
      comment,
      anonymous: Boolean(anonymous)
    });

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
      review
    });

  } catch (error) {
    console.error('Submit review error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit review'
    });
  }
});

/**
 * @route   GET /api/reputation/:userId
 * @desc    Get user reputation data
 * @access  Public
 */
router.get('/:userId', async (req, res, next) => {
  try {
    const userId = req.params.userId;
    if (userId === 'reviews') {
      return next();
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    // Get user basic info
    const user = await User.findOne({ _id: userId, status: 'active' })
      .select('username verification_tier reputation_score trust_score created_at')
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Get review statistics
    const reviewAgg = await Review.aggregate([
      { $match: { reviewee_id: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          total_reviews: { $sum: 1 },
          average_rating: { $avg: '$rating' },
          five_star: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          four_star: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          three_star: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          two_star: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          one_star: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
        }
      }
    ]);

    const reviewStats = reviewAgg[0] || {
      total_reviews: 0,
      average_rating: 0,
      five_star: 0,
      four_star: 0,
      three_star: 0,
      two_star: 0,
      one_star: 0
    };

    // Get recent reviews (non-anonymous only for privacy)
    const recentReviewsRaw = await Review.find({ reviewee_id: userId, anonymous: false })
      .populate({ path: 'reviewer_id', select: 'username' })
      .sort({ created_at: -1 })
      .limit(10)
      .select('rating comment created_at reviewer_id')
      .lean();

    const recentReviews = recentReviewsRaw.map((review) => ({
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      reviewer_username: review.reviewer_id?.username || null
    }));

    // Get transaction statistics
    const txAgg = await Transaction.aggregate([
      {
        $match: {
          $or: [
            { provider_id: new mongoose.Types.ObjectId(userId) },
            { client_id: new mongoose.Types.ObjectId(userId) }
          ]
        }
      },
      {
        $group: {
          _id: null,
          total_transactions: { $sum: 1 },
          completed_transactions: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          disputed_transactions: { $sum: { $cond: [{ $eq: ['$status', 'disputed'] }, 1, 0] } }
        }
      }
    ]);

    const transactionStats = txAgg[0] || {
      total_transactions: 0,
      completed_transactions: 0,
      disputed_transactions: 0
    };

    // Get trust score breakdown
    let trustScoreBreakdown = null;
    try {
      trustScoreBreakdown = await req.trustEngine.calculateTrustScore(userId);
    } catch (error) {
      console.warn('Failed to calculate trust score:', error.message);
    }

    res.json({
      user,
      reviewStats,
      recentReviews,
      transactionStats,
      trustScoreBreakdown
    });

  } catch (error) {
    console.error('Get reputation error:', error);
    res.status(500).json({ success: false, error: 'Failed to get reputation data'
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
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const reviewsRaw = await Review.find({ reviewee_id: userId })
      .populate({ path: 'reviewer_id', select: 'username' })
      .populate({ path: 'transaction_id', select: 'amount' })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limitNum)
      .lean();

    const reviews = reviewsRaw.map((review) => ({
      ...review,
      reviewer_username: review.reviewer_id?.username || null,
      transaction_amount: review.transaction_id?.amount || 0
    }));

    res.json({
      reviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        hasMore: reviews.length === limitNum
      }
    });

  } catch (error) {
    console.error('Get received reviews error:', error);
    res.status(500).json({ success: false, error: 'Failed to get received reviews'
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
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const reviewsRaw = await Review.find({ reviewer_id: userId })
      .populate({ path: 'reviewee_id', select: 'username' })
      .populate({ path: 'transaction_id', select: 'amount' })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limitNum)
      .lean();

    const reviews = reviewsRaw.map((review) => ({
      ...review,
      reviewee_username: review.reviewee_id?.username || null,
      transaction_amount: review.transaction_id?.amount || 0
    }));

    res.json({
      reviews,
      pagination: {
        page: pageNum,
        limit: limitNum,
        hasMore: reviews.length === limitNum
      }
    });

  } catch (error) {
    console.error('Get given reviews error:', error);
    res.status(500).json({ success: false, error: 'Failed to get given reviews'
    });
  }
});

module.exports = router;
