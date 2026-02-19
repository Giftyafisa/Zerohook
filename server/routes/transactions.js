const express = require('express');
const { authMiddleware } = require('./auth');
const mongoose = require('mongoose');
const { Transaction } = require('../config/database');
const router = express.Router();

/**
 * @route   GET /api/transactions
 * @desc    Get user transactions (as client or provider)
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    // Pagination params
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const status = req.query.status; // optional filter

    const filter = {
      $or: [{ client_id: userObjectId }, { provider_id: userObjectId }]
    };
    if (status && ['pending', 'completed', 'cancelled', 'in_progress', 'disputed'].includes(status)) {
      filter.status = status;
    }

    const [transactions, totalCount] = await Promise.all([
      Transaction.find(filter)
        .populate({
          path: 'service_id',
          select: 'title description category_id',
          populate: { path: 'category_id', model: 'ServiceCategory', select: 'display_name' }
        })
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter)
    ]);

    const formattedTransactions = transactions.map((transaction) => ({
      id: transaction._id.toString(),
      service_id: transaction.service_id?._id?.toString() || null,
      client_id: transaction.client_id?.toString() || null,
      provider_id: transaction.provider_id?.toString() || null,
      amount: transaction.amount,
      status: transaction.status,
      scheduled_time: transaction.scheduled_time || null,
      location_data: transaction.location_data || {},
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
      completed_at: transaction.completed_at || null,
      service_title: transaction.service_id?.title || null,
      service_description: transaction.service_id?.description || null,
      category_name: transaction.service_id?.category_id?.display_name || null,
      user_role: transaction.client_id?.toString() === userId ? 'client' : 'provider'
    }));

    const summary = formattedTransactions.reduce((acc, transaction) => {
      acc.total_transactions += 1;
      if (transaction.status === 'completed') {
        acc.completed_transactions += 1;
        if (transaction.provider_id === userId) acc.total_earnings += Number(transaction.amount || 0);
        if (transaction.client_id === userId) acc.total_spent += Number(transaction.amount || 0);
      }
      if (transaction.status === 'pending') acc.pending_transactions += 1;
      if (transaction.status === 'cancelled') acc.cancelled_transactions += 1;
      return acc;
    }, {
      total_transactions: 0,
      completed_transactions: 0,
      pending_transactions: 0,
      cancelled_transactions: 0,
      total_earnings: 0,
      total_spent: 0
    });

    res.json({
      success: true,
      transactions: formattedTransactions,
      summary: {
        totalTransactions: summary.total_transactions,
        completedTransactions: summary.completed_transactions,
        pendingTransactions: summary.pending_transactions,
        cancelledTransactions: summary.cancelled_transactions,
        totalEarnings: summary.total_earnings,
        totalSpent: summary.total_spent
      },
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount
      },
      count: formattedTransactions.length
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/transactions/:id
 * @desc    Get specific transaction details
 * @access  Private
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const transactionId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(transactionId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid transaction or user ID' });
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const transaction = await Transaction.findOne({
      _id: new mongoose.Types.ObjectId(transactionId),
      $or: [{ client_id: userObjectId }, { provider_id: userObjectId }]
    })
      .populate({
        path: 'service_id',
        select: 'title description category_id',
        populate: { path: 'category_id', model: 'ServiceCategory', select: 'display_name' }
      })
      .populate({ path: 'client_id', select: 'username' })
      .populate({ path: 'provider_id', select: 'username' })
      .lean();

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    res.json({
      success: true,
      transaction: {
        ...transaction,
        id: transaction._id.toString(),
        service_title: transaction.service_id?.title || null,
        service_description: transaction.service_id?.description || null,
        category_name: transaction.service_id?.category_id?.display_name || null,
        client_username: transaction.client_id?.username || null,
        provider_username: transaction.provider_id?.username || null
      }
    });

  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transaction',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
