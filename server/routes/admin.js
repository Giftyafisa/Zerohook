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
    
    // Check if user is admin using dedicated field ONLY (not verification_tier which users could potentially manipulate)
    const isAdmin = user?.is_admin === true || user?.role === 'admin';
    
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

    // Batch-load all referenced users to avoid N+1 queries
    const userIds = new Set();
    disputes.forEach(d => {
      if (d.client_id) userIds.add(d.client_id.toString());
      if (d.provider_id) userIds.add(d.provider_id.toString());
    });
    const users = await User.find({ _id: { $in: [...userIds] } })
      .select('username email dispute_strikes')
      .lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    const enrichedDisputes = disputes.map((dispute) => {
      const client = dispute.client_id ? userMap[dispute.client_id.toString()] : null;
      const provider = dispute.provider_id ? userMap[dispute.provider_id.toString()] : null;
      
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
          id: client?._id?.toString() ?? null,
          username: client?.username ?? 'Deleted User',
          email: client?.email ?? null,
          disputeStrikes: client?.dispute_strikes || 0
        },
        provider: {
          id: provider?._id?.toString() ?? null,
          username: provider?.username ?? 'Deleted User',
          email: provider?.email ?? null,
          disputeStrikes: provider?.dispute_strikes || 0
        }
      };
    });

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
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
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
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
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
    
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
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

// ============ PLATFORM FEE & REVENUE DASHBOARD ============

/**
 * @route   GET /api/admin/revenue
 * @desc    Platform revenue dashboard - shows fees collected, subscription revenue, totals
 * @access  Admin only
 */
router.get('/revenue', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { Transaction, Subscription } = require('../config/database');

    // 1. Platform fees from dedicated platform_fee transactions + legacy metadata
    const feeResult = await Transaction.aggregate([
      { $match: { type: 'platform_fee', status: 'completed' } },
      { $group: { 
        _id: null, 
        totalFees: { $sum: '$amount' },
        count: { $sum: 1 }
      }}
    ]);

    // Also count legacy fees stored only in metadata (for backward compatibility)
    const legacyFeeResult = await Transaction.aggregate([
      { $match: { type: 'escrow_release', status: 'completed', 'metadata.platformFee': { $gt: 0 } } },
      { $group: { 
        _id: null, 
        totalFees: { $sum: { $ifNull: ['$metadata.platformFee', 0] } },
        totalReleased: { $sum: '$amount' },
        count: { $sum: 1 }
      }}
    ]);

    // Check if there are corresponding platform_fee records — avoid double counting
    const platformFeeCount = feeResult[0]?.count || 0;
    const legacyCount = legacyFeeResult[0]?.count || 0;
    
    // Use platform_fee type if they exist; otherwise fall back to legacy metadata
    const feesFromDedicated = feeResult[0]?.totalFees || 0;
    const feesFromLegacy = platformFeeCount < legacyCount ? (legacyFeeResult[0]?.totalFees || 0) - feesFromDedicated : 0;
    const totalPlatformFees = feesFromDedicated + Math.max(0, feesFromLegacy);
    const totalReleasedToProviders = legacyFeeResult[0]?.totalReleased || 0;

    // 2. Subscription revenue
    const subscriptionResult = await Transaction.aggregate([
      { $match: { type: 'subscription', status: { $in: ['completed', 'confirmed'] } } },
      { $group: { 
        _id: null, 
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }}
    ]);

    // 3. Active subscriptions count
    const activeSubscriptions = await Subscription.countDocuments({
      status: 'active',
      expires_at: { $gt: new Date() }
    });

    // 4. Pending user withdrawals (need admin approval)
    const pendingWithdrawals = await Transaction.find({
      type: 'withdrawal',
      status: 'pending'
    }).sort({ created_at: -1 }).limit(50);

    const pendingWithdrawalTotal = pendingWithdrawals.reduce((sum, tx) => sum + tx.amount, 0);

    // 5. Total platform volume
    const volumeResult = await Transaction.aggregate([
      { $match: { status: { $in: ['completed', 'confirmed', 'released'] } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }
    ]);

    // 6. Fee breakdown by time period (last 30 days vs all-time)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentFeeResult = await Transaction.aggregate([
      { $match: { type: 'escrow_release', status: 'completed', created_at: { $gte: thirtyDaysAgo } } },
      { $group: { _id: null, totalFees: { $sum: { $ifNull: ['$metadata.platformFee', 0] } }, count: { $sum: 1 } } }
    ]);

    const fees = { totalFees: totalPlatformFees, totalReleased: totalReleasedToProviders, count: legacyCount };
    const subs = subscriptionResult[0] || { total: 0, count: 0 };
    const volume = volumeResult[0] || { total: 0, count: 0 };
    const recentFees = recentFeeResult[0] || { totalFees: 0, count: 0 };

    res.json({
      success: true,
      revenue: {
        platformFees: {
          allTime: fees.totalFees,
          last30Days: recentFees.totalFees,
          escrowsReleased: fees.count,
          totalReleasedToProviders: fees.totalReleased
        },
        subscriptions: {
          totalRevenue: subs.total,
          totalPurchased: subs.count,
          activeCount: activeSubscriptions
        },
        totalRevenue: fees.totalFees + subs.total,
        totalVolume: volume.total,
        totalTransactions: volume.count,
        pendingWithdrawals: {
          count: pendingWithdrawals.length,
          totalAmount: pendingWithdrawalTotal,
          items: pendingWithdrawals.map(w => ({
            id: w._id.toString(),
            userId: w.user_id?.toString(),
            amount: w.amount,
            currency: w.currency,
            destinationAddress: w.metadata?.destinationAddress,
            cryptoSymbol: w.metadata?.cryptoSymbol,
            createdAt: w.created_at,
            reference: w.reference
          }))
        }
      }
    });

  } catch (error) {
    console.error('Revenue dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

/**
 * @route   POST /api/admin/withdrawals/:id/approve
 * @desc    Approve and mark a user withdrawal as processing/completed
 * @access  Admin only
 */
router.post('/withdrawals/:id/approve', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { Transaction } = require('../config/database');
    const { id } = req.params;
    const { txHash, notes } = req.body; // txHash = blockchain transaction hash after admin sends funds

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const txObjId = mongoose.Types.ObjectId.createFromHexString(id);
    
    const withdrawal = await Transaction.findOneAndUpdate(
      { _id: txObjId, type: 'withdrawal', status: 'pending' },
      { 
        $set: { 
          status: txHash ? 'completed' : 'processing',
          'metadata.approvedBy': req.user.userId,
          'metadata.approvedAt': new Date().toISOString(),
          'metadata.txHash': txHash || null,
          'metadata.adminNotes': notes || '',
          completed_at: txHash ? new Date() : null
        } 
      },
      { new: true }
    );

    if (!withdrawal) {
      return res.status(404).json({ error: 'Pending withdrawal not found' });
    }

    res.json({
      success: true,
      message: txHash ? 'Withdrawal completed and marked with tx hash' : 'Withdrawal approved and being processed',
      withdrawal: {
        id: withdrawal._id.toString(),
        amount: withdrawal.amount,
        status: withdrawal.status,
        destinationAddress: withdrawal.metadata?.destinationAddress,
        txHash: withdrawal.metadata?.txHash
      }
    });

  } catch (error) {
    console.error('Withdrawal approval error:', error);
    res.status(500).json({ error: 'Failed to approve withdrawal' });
  }
});

/**
 * @route   POST /api/admin/withdrawals/:id/reject
 * @desc    Reject a user withdrawal and refund to wallet balance
 * @access  Admin only
 */
router.post('/withdrawals/:id/reject', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { Transaction } = require('../config/database');
    const { id } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const txObjId = mongoose.Types.ObjectId.createFromHexString(id);

    const withdrawal = await Transaction.findOneAndUpdate(
      { _id: txObjId, type: 'withdrawal', status: 'pending' },
      { 
        $set: { 
          status: 'rejected',
          'metadata.rejectedBy': req.user.userId,
          'metadata.rejectedAt': new Date().toISOString(),
          'metadata.rejectionReason': reason || 'Rejected by admin'
        } 
      },
      { new: true }
    );

    if (!withdrawal) {
      return res.status(404).json({ error: 'Pending withdrawal not found' });
    }

    // Create explicit refund ledger entry so the balance calculation credits back
    await Transaction.create({
      user_id: withdrawal.user_id,
      type: 'deposit',
      amount: withdrawal.amount,
      currency: withdrawal.currency || 'USD',
      status: 'completed',
      reference: `refund_${withdrawal._id}`,
      metadata: {
        reason: 'withdrawal_rejected_refund',
        originalWithdrawalId: withdrawal._id.toString(),
        rejectedBy: req.user.userId,
        rejectionReason: reason || 'Rejected by admin'
      },
      created_at: new Date()
    });

    res.json({
      success: true,
      message: 'Withdrawal rejected. Funds returned to user wallet balance.',
      withdrawal: {
        id: withdrawal._id.toString(),
        amount: withdrawal.amount,
        userId: withdrawal.user_id?.toString()
      }
    });

  } catch (error) {
    console.error('Withdrawal rejection error:', error);
    res.status(500).json({ error: 'Failed to reject withdrawal' });
  }
});

/**
 * @route   POST /api/admin/withdraw-fees
 * @desc    Admin withdraws platform fees to their own crypto wallet
 * @access  Admin only
 */
router.post('/withdraw-fees', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { Transaction } = require('../config/database');
    const { amount, destinationAddress, cryptoSymbol = 'USDT', notes } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    if (!destinationAddress) {
      return res.status(400).json({ error: 'Destination address required' });
    }

    // Calculate total available platform fees (from dedicated platform_fee transactions + legacy metadata)
    const feeResult = await Transaction.aggregate([
      { $match: { $or: [
        { type: 'platform_fee', status: 'completed' },
        { type: 'escrow_release', status: 'completed', 'metadata.platformFee': { $gt: 0 } }
      ]}},
      { $group: { _id: null, totalFees: { $sum: { 
        $cond: [{ $eq: ['$type', 'platform_fee'] }, '$amount', { $ifNull: ['$metadata.platformFee', 0] }] 
      }}}}
    ]);

    const adminWithdrawnResult = await Transaction.aggregate([
      { $match: { type: 'admin_fee_withdrawal', status: { $in: ['completed', 'pending'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const totalFees = feeResult[0]?.totalFees || 0;
    const alreadyWithdrawn = adminWithdrawnResult[0]?.total || 0;
    const availableFees = totalFees - alreadyWithdrawn;

    if (amount > availableFees) {
      return res.status(400).json({ 
        error: `Insufficient fee balance. Available: $${availableFees.toFixed(2)}, Requested: $${amount}` 
      });
    }

    // Create admin fee withdrawal transaction
    const reference = `ADMIN_FEE_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    let adminUserObjId;
    try {
      adminUserObjId = mongoose.Types.ObjectId.createFromHexString(req.user.userId);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }
    const withdrawal = await Transaction.create({
      user_id: adminUserObjId,
      amount,
      currency: 'USD',
      type: 'admin_fee_withdrawal',
      payment_method: 'crypto',
      reference,
      status: 'pending',
      metadata: {
        destinationAddress,
        cryptoSymbol,
        notes,
        requestedBy: req.user.userId,
        requestedAt: new Date().toISOString(),
        availableAtTime: availableFees
      }
    });

    res.json({
      success: true,
      message: `Fee withdrawal of $${amount} requested. Send ${cryptoSymbol} to your wallet manually from the platform hot wallet.`,
      withdrawal: {
        id: withdrawal._id.toString(),
        amount,
        reference,
        destinationAddress,
        availableFeeBalance: availableFees - amount
      }
    });

  } catch (error) {
    console.error('Admin fee withdrawal error:', error);
    res.status(500).json({ error: 'Failed to process fee withdrawal' });
  }
});

/**
 * @route   POST /api/admin/deposits/:id/confirm
 * @desc    Admin manually confirms a deposit (when blockchain verification is unavailable)
 * @access  Admin only
 */
router.post('/deposits/:id/confirm', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { Transaction } = require('../config/database');
    const { id } = req.params;
    const { txHash, notes } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    const txObjId = mongoose.Types.ObjectId.createFromHexString(id);
    
    const deposit = await Transaction.findOneAndUpdate(
      { _id: txObjId, type: { $in: ['deposit', 'wallet_topup'] }, status: 'pending' },
      { 
        $set: { 
          status: 'completed',
          confirmed_at: new Date(),
          completed_at: new Date(),
          'metadata.confirmedBy': req.user.userId,
          'metadata.confirmedAt': new Date().toISOString(),
          'metadata.txHash': txHash || 'manual_confirmation',
          'metadata.adminNotes': notes || 'Manually confirmed by admin',
          'metadata.blockchain_verification': { source: 'admin_manual', txHash: txHash || null }
        } 
      },
      { new: true }
    );

    if (!deposit) {
      return res.status(404).json({ error: 'Pending deposit not found' });
    }

    // Notify user via socket
    const NotificationService = require('../services/NotificationService');
    if (req.io && deposit.user_id) {
      const userId = deposit.user_id.toString();
      req.io.to(`user_${userId}`).emit('payment_confirmed', {
        transactionId: deposit._id.toString(),
        amount: deposit.amount,
        currency: deposit.currency,
        status: 'confirmed',
        timestamp: new Date().toISOString()
      });

      await NotificationService.createAndEmit(req.io, {
        userId,
        type: 'payment',
        title: 'Deposit Confirmed',
        message: `Your deposit of ${deposit.currency}${deposit.amount} has been confirmed and credited to your wallet.`,
        data: { transactionId: deposit._id.toString(), amount: deposit.amount, currency: deposit.currency }
      });
    }

    console.log(`✅ Admin manually confirmed deposit ${deposit.reference} for ${deposit.currency}${deposit.amount}`);

    res.json({
      success: true,
      message: `Deposit of ${deposit.currency}${deposit.amount} confirmed and credited`,
      deposit: {
        id: deposit._id.toString(),
        amount: deposit.amount,
        currency: deposit.currency,
        userId: deposit.user_id?.toString(),
        reference: deposit.reference
      }
    });

  } catch (error) {
    console.error('Manual deposit confirmation error:', error);
    res.status(500).json({ error: 'Failed to confirm deposit' });
  }
});

/**
 * @route   GET /api/admin/pending-deposits
 * @desc    Get all pending deposits awaiting confirmation
 * @access  Admin only
 */
router.get('/pending-deposits', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { Transaction, User } = require('../config/database');
    
    const deposits = await Transaction.find({
      type: { $in: ['deposit', 'wallet_topup'] },
      status: 'pending'
    }).sort({ created_at: -1 }).limit(50);

    // Batch user lookup
    const userIds = [...new Set(deposits.map(d => d.user_id?.toString()).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } }).select('username email').lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    res.json({
      success: true,
      deposits: deposits.map(d => ({
        id: d._id.toString(),
        userId: d.user_id?.toString(),
        username: userMap[d.user_id?.toString()]?.username || 'Unknown',
        email: userMap[d.user_id?.toString()]?.email || '',
        amount: d.amount,
        currency: d.currency,
        cryptoSymbol: d.metadata?.cryptoSymbol,
        cryptoAmount: d.metadata?.cryptoAmount,
        cryptoAddress: d.metadata?.cryptoAddress,
        reference: d.reference,
        createdAt: d.created_at
      })),
      count: deposits.length
    });

  } catch (error) {
    console.error('Get pending deposits error:', error);
    res.status(500).json({ error: 'Failed to fetch pending deposits' });
  }
});

/**
 * @route   POST /api/admin/subscriptions/:id/activate
 * @desc    Admin manually activates a subscription payment
 * @access  Admin only
 */
router.post('/subscriptions/:id/activate', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { Subscription, User, Transaction } = require('../config/database');
    const { id } = req.params;

    const subscription = await Subscription.findById(id);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000); // 6 months

    subscription.status = 'active';
    subscription.activated_at = now;
    subscription.expires_at = expiresAt;
    await subscription.save();

    // Update user
    await User.findByIdAndUpdate(subscription.user_id, {
      $set: {
        is_subscribed: true,
        subscription_tier: 'premium',
        subscription_expires_at: expiresAt
      }
    });

    // Record as subscription revenue
    await Transaction.create({
      user_id: subscription.user_id,
      amount: subscription.amount,
      currency: subscription.currency,
      type: 'subscription',
      status: 'completed',
      payment_method: 'crypto',
      reference: `SUB_MANUAL_${Date.now()}`,
      metadata: {
        subscriptionId: subscription._id.toString(),
        activatedBy: req.user.userId,
        description: 'Subscription activated by admin'
      }
    });

    const NotificationService = require('../services/NotificationService');
    if (req.io) {
      const userId = subscription.user_id.toString();
      req.io.to(`user_${userId}`).emit('subscription_updated', {
        isSubscribed: true,
        tier: 'premium',
        expiresAt: expiresAt.toISOString()
      });

      await NotificationService.createAndEmit(req.io, {
        userId,
        type: 'subscription',
        title: 'Subscription Activated!',
        message: 'Your premium subscription is now active. Enjoy all premium features!',
        data: { tier: 'premium', expiresAt: expiresAt.toISOString() }
      });
    }

    console.log(`✅ Admin activated subscription for user ${subscription.user_id}`);

    res.json({
      success: true,
      message: 'Subscription activated successfully',
      subscription: {
        id: subscription._id.toString(),
        userId: subscription.user_id.toString(),
        status: 'active',
        expiresAt: expiresAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Subscription activation error:', error);
    res.status(500).json({ error: 'Failed to activate subscription' });
  }
});

module.exports = router;
