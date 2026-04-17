const express = require('express');
const { authMiddleware } = require('./auth');
const mongoose = require('mongoose');
const { User, TrustEvent, FraudLog, Transaction } = require('../config/database');
const router = express.Router();

const normalizeTrustScore = (score) => {
  const numeric = Number(score || 0);
  if (!Number.isFinite(numeric)) return 0;
  const normalized = numeric > 100 ? numeric / 10 : numeric;
  return Math.round(Math.max(0, Math.min(100, normalized)));
};

/**
 * @route   GET /api/trust/score
 * @desc    Get trust score for current authenticated user
 * @access  Private
 */
router.get('/score', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const user = await User.findById(userId)
      .select('username verification_tier status reputation_score trust_score')
      .lean();

    if (!user || user.status !== 'active') {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Calculate trust score using TrustEngine if available
    let trustScoreData;
    if (req.trustEngine) {
      trustScoreData = await req.trustEngine.calculateTrustScore(userId);
    } else {
      // Fallback calculation
      const rawBaseScore = Number(user.trust_score ?? user.reputation_score ?? 75);
      const baseScore = Math.max(0, Math.min(100, rawBaseScore > 100 ? rawBaseScore / 10 : rawBaseScore));
      trustScoreData = {
        score: baseScore,
        level: baseScore >= 90 ? 'Elite' : baseScore >= 75 ? 'Pro' : baseScore >= 50 ? 'Advanced' : 'Basic',
        components: {
          verification_level: Number(user.verification_tier || 1) / 4,
          transaction_success: 0.5,
          response_time: 0.5,
          dispute_resolution: 0.5,
          longevity: 0.5
        }
      };
    }

    // Ensure score is a clean integer (0-100)
    const rawScore = Number(trustScoreData?.score);
    const fallbackScore = Number(user.trust_score ?? user.reputation_score ?? 75);
    const normalizedScore = Number.isFinite(rawScore)
      ? (rawScore > 100 ? rawScore / 10 : rawScore)
      : (fallbackScore > 100 ? fallbackScore / 10 : fallbackScore);
    const finalScore = Math.round(Math.min(100, Math.max(0, normalizedScore)));

    const responseComponent = Number(trustScoreData?.components?.response_time);
    const completionComponent = Number(trustScoreData?.components?.transaction_success);
    const responseRate = Number.isFinite(responseComponent)
      ? Math.round(responseComponent <= 1 ? responseComponent * 100 : responseComponent)
      : null;
    const completionRate = Number.isFinite(completionComponent)
      ? Math.round(completionComponent <= 1 ? completionComponent * 100 : completionComponent)
      : null;
    const reputationScore = Number(user.reputation_score || 0);
    const customerSatisfaction = Number.isFinite(reputationScore)
      ? Number(Math.max(1, Math.min(5, reputationScore / 20)).toFixed(1))
      : null;

    const level = finalScore >= 90 ? 'Elite' : finalScore >= 75 ? 'Pro' : finalScore >= 50 ? 'Advanced' : 'Basic';

    res.json({
      success: true,
      username: user.username,
      verificationTier: user.verification_tier,
      score: finalScore,
      level: level,
      nextLevel: getNextLevel(level),
      pointsToNext: getPointsToNext(finalScore),
      responseRate,
      completionRate,
      customerSatisfaction,
      badges: [],
      trustScore: {
        ...trustScoreData,
        score: finalScore,
        scale: '0-100'
      }
    });

  } catch (error) {
    console.error('Get trust score error:', error);
    res.status(500).json({
      success: false, error: 'Failed to get trust score'
    });
  }
});

// Helper functions
function getNextLevel(currentLevel) {
  const levels = ['Basic', 'Advanced', 'Pro', 'Elite'];
  const index = levels.indexOf(currentLevel);
  return index < levels.length - 1 ? levels[index + 1] : 'Elite';
}

function getPointsToNext(score) {
  if (score >= 90) return 0;
  if (score >= 75) return 90 - score;
  if (score >= 50) return 75 - score;
  return 50 - score;
}

/**
 * @route   GET /api/trust/score/:userId
 * @desc    Get detailed trust score for user
 * @access  Public
 */
router.get('/score/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const user = await User.findById(userId).select('username verification_tier status trust_score').lean();

    if (!user || user.status !== 'active') {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Calculate trust score
    const trustScoreData = req.trustEngine
      ? await req.trustEngine.calculateTrustScore(userId)
      : { score: Number(user.trust_score || 0), components: {}, tier: 'New' };

    const rawScore = Number(trustScoreData?.score);
    const finalScore = Math.round(
      Math.min(100, Math.max(0, Number.isFinite(rawScore) ? (rawScore > 100 ? rawScore / 10 : rawScore) : 0))
    );

    res.json({
      success: true,
      username: user.username,
      verificationTier: user.verification_tier,
      trustScore: {
        ...trustScoreData,
        score: finalScore,
        scale: '0-100'
      }
    });

  } catch (error) {
    console.error('Get trust score error:', error);
    res.status(500).json({
      success: false, error: 'Failed to get trust score'
    });
  }
});

/**
 * @route   GET /api/trust/events
 * @desc    Get trust events for current user
 * @access  Private
 */
router.get('/events', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    const events = await TrustEvent.find({ user_id: userId })
      .select('event_type event_data trust_delta reputation_delta created_at transaction_id')
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limitNum)
      .lean();

    res.json({
      success: true,
      events,
      pagination: {
        page: pageNum,
        limit: limitNum,
        hasMore: events.length === limitNum
      }
    });

  } catch (error) {
    console.error('Get trust events error:', error);
    res.status(500).json({
      success: false, error: 'Failed to get trust events'
    });
  }
});

/**
 * @route   POST /api/trust/assess-risk
 * @desc    Assess transaction risk between users
 * @access  Private
 */
router.post('/assess-risk', authMiddleware, async (req, res) => {
  try {
    const clientId = req.user.userId;
    const { providerId, amount, serviceType } = req.body;

    if (!providerId || !amount) {
      return res.status(400).json({ success: false, error: 'Provider ID and amount are required' });
    }

    // Assess transaction risk
    const riskAssessment = await req.trustEngine.assessTransactionRisk(
      clientId, providerId, amount, serviceType || 'service'
    );

    res.json({
      success: true,
      riskAssessment
    });

  } catch (error) {
    console.error('Assess risk error:', error);
    res.status(500).json({
      success: false, error: 'Failed to assess transaction risk',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/trust/verification-requirements/:tier
 * @desc    Get verification requirements for specific tier
 * @access  Public
 */
router.get('/verification-requirements/:tier', (req, res) => {
  try {
    const tier = parseInt(req.params.tier, 10);

    if (isNaN(tier) || tier < 1 || tier > 4) {
      return res.status(400).json({ success: false, error: 'Invalid tier. Must be between 1 and 4.' });
    }

    const requirements = req.trustEngine.verificationTiers[tier];

    if (!requirements) {
      return res.status(404).json({ success: false, error: 'Tier not found' });
    }

    res.json({
      success: true,
      tier,
      requirements,
      description: {
        1: 'Basic verification with phone and email',
        2: 'Advanced verification with government ID and facial biometrics',
        3: 'Pro verification with behavioral analysis',
        4: 'Elite verification with decentralized identity'
      }[tier]
    });

  } catch (error) {
    console.error('Get verification requirements error:', error);
    res.status(500).json({
      success: false, error: 'Failed to get verification requirements'
    });
  }
});

/**
 * @route   POST /api/trust/report-fraud
 * @desc    Report potential fraud
 * @access  Private
 */
router.post('/report-fraud', authMiddleware, async (req, res) => {
  try {
    const reporterId = req.user.userId;
    const { reportedUserId, transactionId, reason, evidence } = req.body;

    if (!reportedUserId || !reason) {
      return res.status(400).json({ success: false, error: 'Reported user ID and reason are required' });
    }

    if (!mongoose.Types.ObjectId.isValid(reportedUserId)) {
      return res.status(400).json({ success: false, error: 'Invalid reported user ID' });
    }

    await FraudLog.create({
      user_id: new mongoose.Types.ObjectId(reportedUserId),
      transaction_id: transactionId && mongoose.Types.ObjectId.isValid(transactionId)
        ? new mongoose.Types.ObjectId(transactionId)
        : undefined,
      fraud_type: `user_report_${reason}`,
      confidence_score: 0.8,
      evidence: {
        reporter_id: reporterId,
        reason,
        evidence: evidence || {},
        timestamp: new Date().toISOString()
      },
      action_taken: 'pending_review'
    });

    // Record trust event for reported user (negative impact)
    await req.trustEngine.recordTrustEvent(
      reportedUserId,
      'fraud_reported',
      { 
        reporter_id: reporterId,
        reason,
        transaction_id: transactionId
      },
      -20, // Significant negative trust impact
      -10   // Reputation impact
    );

    res.json({
      success: true,
      message: 'Fraud report submitted successfully. It will be reviewed by our team.'
    });

  } catch (error) {
    console.error('Report fraud error:', error);
    res.status(500).json({
      success: false, error: 'Failed to submit fraud report'
    });
  }
});

/**
 * @route   GET /api/trust/leaderboard
 * @desc    Get trust score leaderboard
 * @access  Public
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

    const users = await User.find({ status: 'active', trust_score: { $gt: 0 } })
      .select('username verification_tier trust_score reputation_score')
      .sort({ trust_score: -1, reputation_score: -1 })
      .limit(limitNum)
      .lean();

    // Batch: 2 aggregations instead of N individual countDocuments (N+1 fix)
    const userIds = users.map(u => u._id);
    const [providerCounts, clientCounts] = await Promise.all([
      Transaction.aggregate([
        { $match: { provider_id: { $in: userIds } } },
        { $group: { _id: '$provider_id', count: { $sum: 1 } } }
      ]),
      Transaction.aggregate([
        { $match: { client_id: { $in: userIds } } },
        { $group: { _id: '$client_id', count: { $sum: 1 } } }
      ])
    ]);
    const txCountMap = new Map();
    for (const { _id, count } of providerCounts) {
      txCountMap.set(_id.toString(), count);
    }
    for (const { _id, count } of clientCounts) {
      const key = _id.toString();
      txCountMap.set(key, (txCountMap.get(key) || 0) + count);
    }

    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      verification_tier: user.verification_tier,
      trust_score: normalizeTrustScore(user.trust_score),
      reputation_score: user.reputation_score,
      total_transactions: txCountMap.get(user._id.toString()) || 0
    }));

    res.json({
      success: true,
      leaderboard
    });

  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      success: false, error: 'Failed to get trust leaderboard'
    });
  }
});

module.exports = router;
