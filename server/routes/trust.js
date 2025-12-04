const express = require('express');
const { authMiddleware } = require('./auth');
const { query } = require('../config/database');
const router = express.Router();

/**
 * @route   GET /api/trust/score
 * @desc    Get trust score for current authenticated user
 * @access  Private
 */
router.get('/score', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Verify user exists
    const userResult = await query(
      'SELECT username, verification_tier, status, reputation_score FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].status !== 'active') {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Calculate trust score using TrustEngine if available
    let trustScoreData;
    if (req.trustEngine) {
      trustScoreData = await req.trustEngine.calculateTrustScore(userId);
    } else {
      // Fallback calculation
      const baseScore = user.reputation_score || 75;
      trustScoreData = {
        score: baseScore,
        level: baseScore >= 90 ? 'Elite' : baseScore >= 75 ? 'Pro' : baseScore >= 50 ? 'Advanced' : 'Basic',
        components: {
          verification: user.verification_tier === 'verified' ? 100 : user.verification_tier === 'basic' ? 50 : 25,
          transactions: 0,
          reviews: 0,
          behavior: 75
        }
      };
    }

    // Ensure score is a clean integer (0-100)
    const finalScore = Math.round(Math.min(100, Math.max(0, trustScoreData.score || user.reputation_score || 75)));
    const level = finalScore >= 90 ? 'Elite' : finalScore >= 75 ? 'Pro' : finalScore >= 50 ? 'Advanced' : 'Basic';

    res.json({
      username: user.username,
      verificationTier: user.verification_tier,
      score: finalScore,
      level: level,
      nextLevel: getNextLevel(level),
      pointsToNext: getPointsToNext(finalScore),
      responseRate: 95,
      completionRate: 98,
      customerSatisfaction: 4.8,
      badges: [],
      trustScore: {
        ...trustScoreData,
        score: finalScore
      }
    });

  } catch (error) {
    console.error('Get trust score error:', error);
    res.status(500).json({
      error: 'Failed to get trust score'
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

    // Verify user exists
    const userResult = await query(
      'SELECT username, verification_tier, status FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0 || userResult.rows[0].status !== 'active') {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Calculate trust score
    const trustScoreData = await req.trustEngine.calculateTrustScore(userId);

    res.json({
      username: user.username,
      verificationTier: user.verification_tier,
      trustScore: trustScoreData
    });

  } catch (error) {
    console.error('Get trust score error:', error);
    res.status(500).json({
      error: 'Failed to get trust score'
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
    const offset = (page - 1) * limit;

    const eventsResult = await query(`
      SELECT 
        event_type, event_data, trust_delta, reputation_delta, 
        created_at, transaction_id
      FROM trust_events 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    res.json({
      events: eventsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        hasMore: eventsResult.rows.length === parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Get trust events error:', error);
    res.status(500).json({
      error: 'Failed to get trust events'
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
      return res.status(400).json({ error: 'Provider ID and amount are required' });
    }

    // Assess transaction risk
    const riskAssessment = await req.trustEngine.assessTransactionRisk(
      clientId, providerId, amount, serviceType || 'service'
    );

    res.json({
      riskAssessment
    });

  } catch (error) {
    console.error('Assess risk error:', error);
    res.status(500).json({
      error: 'Failed to assess transaction risk',
      message: error.message
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
    const tier = parseInt(req.params.tier);

    if (tier < 1 || tier > 4) {
      return res.status(400).json({ error: 'Invalid tier. Must be between 1 and 4.' });
    }

    const requirements = req.trustEngine.verificationTiers[tier];

    if (!requirements) {
      return res.status(404).json({ error: 'Tier not found' });
    }

    res.json({
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
      error: 'Failed to get verification requirements'
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
      return res.status(400).json({ error: 'Reported user ID and reason are required' });
    }

    // Record fraud report
    await query(`
      INSERT INTO fraud_logs (user_id, transaction_id, fraud_type, confidence_score, evidence, action_taken)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      reportedUserId,
      transactionId || null,
      `user_report_${reason}`,
      0.8, // High confidence for user reports
      JSON.stringify({
        reporter_id: reporterId,
        reason,
        evidence: evidence || {},
        timestamp: new Date().toISOString()
      }),
      'pending_review'
    ]);

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
      message: 'Fraud report submitted successfully. It will be reviewed by our team.'
    });

  } catch (error) {
    console.error('Report fraud error:', error);
    res.status(500).json({
      error: 'Failed to submit fraud report'
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

    const leaderboardResult = await query(`
      SELECT 
        u.username, u.verification_tier, u.trust_score, u.reputation_score,
        COUNT(t.id) as total_transactions
      FROM users u
      LEFT JOIN transactions t ON (u.id = t.provider_id OR u.id = t.client_id)
      WHERE u.status = 'active' AND u.trust_score > 0
      GROUP BY u.id, u.username, u.verification_tier, u.trust_score, u.reputation_score
      ORDER BY u.trust_score DESC, u.reputation_score DESC
      LIMIT $1
    `, [parseInt(limit)]);

    res.json({
      leaderboard: leaderboardResult.rows.map((user, index) => ({
        rank: index + 1,
        ...user
      }))
    });

  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({
      error: 'Failed to get trust leaderboard'
    });
  }
});

module.exports = router;
