const express = require('express');
const { authMiddleware } = require('./auth');
const mongoose = require('mongoose');
const router = express.Router();

/**
 * Admin middleware - checks if user has admin role
 */
const adminMiddleware = async (req, res, next) => {
  try {
    const { User } = require('../config/database');
    const user = await User.findById(req.user.userId);
    
    // Check if user is admin using dedicated field (not profile_data which users can modify)
    const isAdmin = user?.is_admin === true || 
                    user?.verification_tier >= 5; // Or use high verification tier
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    res.status(500).json({ error: 'Admin verification failed' });
  }
};

/**
 * @route   GET /api/admin/disputes
 * @desc    Get all open disputes for admin review
 * @access  Admin only
 */
router.get('/disputes', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { Transaction, User } = require('../config/database');
    const { status = 'disputed', page = 1, limit = 20 } = req.query;
    
    const skip = (page - 1) * limit;
    
    // Find all disputed escrows
    const disputes = await Transaction.find({
      type: 'escrow_hold',
      status: status
    })
    .sort({ 'dispute_data.timestamp': -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await Transaction.countDocuments({
      type: 'escrow_hold',
      status: status
    });

    // Enrich with user details
    const enrichedDisputes = await Promise.all(disputes.map(async (dispute) => {
      const client = await User.findById(dispute.client_id).select('username email dispute_strikes');
      const provider = await User.findById(dispute.provider_id).select('username email dispute_strikes');
      
      return {
        id: dispute._id.toString(),
        reference: dispute.reference,
        amount: dispute.amount,
        currency: dispute.currency,
        status: dispute.status,
        createdAt: dispute.created_at,
        disputeData: dispute.dispute_data,
        evidence: dispute.evidence || [],
        pinEntered: !!dispute.pin_entered_at,
        providerConfirmed: dispute.provider_confirmed,
        clientConfirmed: dispute.client_confirmed,
        client: {
          id: client?._id.toString(),
          username: client?.username,
          email: client?.email,
          disputeStrikes: client?.dispute_strikes || 0
        },
        provider: {
          id: provider?._id.toString(),
          username: provider?.username,
          email: provider?.email,
          disputeStrikes: provider?.dispute_strikes || 0
        }
      };
    }));

    res.json({
      success: true,
      disputes: enrichedDisputes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get disputes error:', error);
    res.status(500).json({ error: 'Failed to fetch disputes' });
  }
});

/**
 * @route   POST /api/admin/disputes/:id/resolve
 * @desc    Admin resolves a dispute (applies strike to loser)
 * @access  Admin only
 */
router.post('/disputes/:id/resolve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const disputeId = req.params.id;
    const adminId = req.user.userId;
    const { winner, reasoning, adminNotes } = req.body;

    if (!winner || !['client', 'provider'].includes(winner)) {
      return res.status(400).json({ error: 'Winner must be either "client" or "provider"' });
    }

    if (!reasoning) {
      return res.status(400).json({ error: 'Reasoning is required' });
    }

    const result = await req.escrowManager.resolveDispute(disputeId, {
      winner,
      reasoning,
      adminNotes
    }, adminId);

    // Get transaction details for notifications
    const { Transaction } = require('../config/database');
    const transaction = await Transaction.findById(disputeId);

    // Notify both parties
    if (req.io && transaction) {
      const winnerUserId = winner === 'client' ? 
        transaction.client_id.toString() : transaction.provider_id.toString();
      const loserUserId = winner === 'client' ? 
        transaction.provider_id.toString() : transaction.client_id.toString();

      // Notify winner
      req.io.to(`user_${winnerUserId}`).emit('dispute_resolved', {
        escrowId: disputeId,
        result: 'won',
        amount: transaction.amount,
        currency: transaction.currency,
        message: winner === 'client' 
          ? 'Dispute resolved in your favor. Funds have been refunded.'
          : 'Dispute resolved in your favor. Funds have been released to your wallet.'
      });

      // Notify loser
      req.io.to(`user_${loserUserId}`).emit('dispute_resolved', {
        escrowId: disputeId,
        result: 'lost',
        strikeCount: result.loserStrikeCount,
        isBanned: result.loserBanned,
        warning: result.warning,
        message: result.loserBanned 
          ? '🚫 Your account has been banned due to multiple fraudulent disputes.'
          : `⚠️ Dispute resolved against you. Strike ${result.loserStrikeCount}/3.`
      });
    }

    res.json({
      success: true,
      message: `Dispute resolved in favor of ${winner}`,
      result
    });

  } catch (error) {
    console.error('Resolve dispute error:', error);
    res.status(500).json({ 
      error: 'Failed to resolve dispute',
      message: error.message 
    });
  }
});

/**
 * @route   GET /api/admin/banned-users
 * @desc    Get all banned users
 * @access  Admin only
 */
router.get('/banned-users', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { User } = require('../config/database');
    const { page = 1, limit = 20 } = req.query;
    
    const skip = (page - 1) * limit;
    
    const bannedUsers = await User.find({
      is_banned: true
    })
    .select('username email phone ban_data dispute_strikes dispute_warnings unban_requests created_at')
    .sort({ 'ban_data.banned_at': -1 })
    .skip(skip)
    .limit(parseInt(limit));

    const total = await User.countDocuments({ is_banned: true });

    res.json({
      success: true,
      users: bannedUsers.map(user => ({
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        phone: user.phone,
        disputeStrikes: user.dispute_strikes,
        banData: user.ban_data,
        warnings: user.dispute_warnings,
        hasPendingUnbanRequest: user.unban_requests?.some(r => r.status === 'pending'),
        unbanRequests: user.unban_requests,
        createdAt: user.created_at
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get banned users error:', error);
    res.status(500).json({ error: 'Failed to fetch banned users' });
  }
});

/**
 * @route   GET /api/admin/unban-requests
 * @desc    Get all pending unban requests
 * @access  Admin only
 */
router.get('/unban-requests', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { User } = require('../config/database');
    
    // Find users with pending unban requests
    const usersWithRequests = await User.find({
      is_banned: true,
      'unban_requests.status': 'pending'
    }).select('username email ban_data dispute_strikes dispute_warnings unban_requests');

    const requests = [];
    for (const user of usersWithRequests) {
      const pendingRequest = user.unban_requests.find(r => r.status === 'pending');
      if (pendingRequest) {
        requests.push({
          userId: user._id.toString(),
          username: user.username,
          email: user.email,
          banData: user.ban_data,
          disputeStrikes: user.dispute_strikes,
          warningHistory: user.dispute_warnings,
          request: {
            requestedAt: pendingRequest.requested_at,
            reason: pendingRequest.reason
          }
        });
      }
    }

    res.json({
      success: true,
      requests,
      count: requests.length
    });

  } catch (error) {
    console.error('Get unban requests error:', error);
    res.status(500).json({ error: 'Failed to fetch unban requests' });
  }
});

/**
 * @route   POST /api/admin/unban/:userId
 * @desc    Admin approves or rejects unban request
 * @access  Admin only
 */
router.post('/unban/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId;
    const adminId = req.user.userId;
    const { approved, adminNotes } = req.body;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: 'approved must be true or false' });
    }

    const result = await req.escrowManager.processUnbanRequest(
      userId, 
      adminId, 
      approved, 
      adminNotes
    );

    // Notify user
    if (req.io) {
      req.io.to(`user_${userId}`).emit('unban_result', {
        approved,
        message: approved 
          ? '✅ Your account has been unbanned! You can now use the platform again.'
          : '❌ Your unban request was rejected. You may appeal again in 30 days.'
      });
    }

    res.json(result);

  } catch (error) {
    console.error('Process unban error:', error);
    res.status(500).json({ 
      error: 'Failed to process unban request',
      message: error.message 
    });
  }
});

/**
 * @route   POST /api/admin/manual-ban/:userId
 * @desc    Admin manually bans a user (for other violations)
 * @access  Admin only
 */
router.post('/manual-ban/:userId', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId;
    const adminId = req.user.userId;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Ban reason is required' });
    }

    const { User } = require('../config/database');
    
    await User.findByIdAndUpdate(userId, {
      $set: {
        is_banned: true,
        status: 'banned',
        ban_data: {
          banned_at: new Date(),
          ban_reason: reason,
          ban_type: 'manual',
          banned_by: adminId
        }
      }
    });

    // Notify user
    if (req.io) {
      req.io.to(`user_${userId}`).emit('account_banned', {
        reason,
        message: '🚫 Your account has been banned. Contact support if you believe this is an error.'
      });
    }

    console.log(`🔨 User ${userId} manually banned by admin ${adminId}`);

    res.json({
      success: true,
      message: 'User has been banned'
    });

  } catch (error) {
    console.error('Manual ban error:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

/**
 * @route   GET /api/admin/user/:userId/history
 * @desc    Get user's complete dispute and transaction history
 * @access  Admin only
 */
router.get('/user/:userId/history', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId;
    const { User, Transaction } = require('../config/database');
    
    const userObjId = mongoose.Types.ObjectId.createFromHexString(userId);
    
    const user = await User.findById(userObjId).select(
      'username email phone dispute_strikes dispute_warnings is_banned ban_data unban_requests reputation_score trust_score created_at'
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get all escrow transactions for this user
    const escrowHistory = await Transaction.find({
      type: 'escrow_hold',
      $or: [
        { client_id: userObjId },
        { provider_id: userObjId }
      ]
    })
    .sort({ created_at: -1 })
    .limit(50);

    res.json({
      success: true,
      user: {
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        phone: user.phone,
        disputeStrikes: user.dispute_strikes || 0,
        warnings: user.dispute_warnings || [],
        isBanned: user.is_banned || false,
        banData: user.ban_data,
        unbanRequests: user.unban_requests || [],
        reputationScore: user.reputation_score,
        trustScore: user.trust_score,
        accountCreated: user.created_at
      },
      escrowHistory: escrowHistory.map(tx => ({
        id: tx._id.toString(),
        reference: tx.reference,
        amount: tx.amount,
        currency: tx.currency,
        status: tx.status,
        role: tx.client_id.toString() === userId ? 'client' : 'provider',
        isDisputed: tx.status === 'disputed' || !!tx.dispute_data?.status,
        disputeData: tx.dispute_data,
        pinEntered: !!tx.pin_entered_at,
        createdAt: tx.created_at
      }))
    });

  } catch (error) {
    console.error('Get user history error:', error);
    res.status(500).json({ error: 'Failed to fetch user history' });
  }
});

/**
 * @route   GET /api/admin/stats
 * @desc    Get admin dashboard statistics
 * @access  Admin only
 */
router.get('/stats', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { User, Transaction } = require('../config/database');
    
    const [
      totalUsers,
      bannedUsers,
      pendingDisputes,
      resolvedDisputes,
      pendingUnbanRequests,
      totalEscrows,
      activeEscrows
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ is_banned: true }),
      Transaction.countDocuments({ type: 'escrow_hold', status: 'disputed' }),
      Transaction.countDocuments({ 
        type: 'escrow_hold', 
        'dispute_data.status': 'resolved' 
      }),
      User.countDocuments({ 
        is_banned: true, 
        'unban_requests.status': 'pending' 
      }),
      Transaction.countDocuments({ type: 'escrow_hold' }),
      Transaction.countDocuments({ 
        type: 'escrow_hold', 
        status: { $in: ['held', 'pin_entered'] } 
      })
    ]);

    res.json({
      success: true,
      stats: {
        users: {
          total: totalUsers,
          banned: bannedUsers
        },
        disputes: {
          pending: pendingDisputes,
          resolved: resolvedDisputes
        },
        unbanRequests: pendingUnbanRequests,
        escrows: {
          total: totalEscrows,
          active: activeEscrows
        }
      }
    });

  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
