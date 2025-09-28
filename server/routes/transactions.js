const express = require('express');
const { authMiddleware } = require('./auth');
const { query } = require('../config/database');
const router = express.Router();

/**
 * @route   GET /api/transactions
 * @desc    Get user transactions (as client or provider)
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Get user transactions (as client or provider)
    const transactionsResult = await query(`
      SELECT 
        t.id,
        t.service_id,
        t.client_id,
        t.provider_id,
        t.amount,
        t.status,
        t.scheduled_time,
        t.location_data,
        t.created_at,
        t.updated_at,
        t.completed_at,
        s.title as service_title,
        s.description as service_description,
        c.display_name as category_name,
        CASE 
          WHEN t.client_id = $1 THEN 'client'
          WHEN t.provider_id = $1 THEN 'provider'
        END as user_role
      FROM transactions t
      JOIN services s ON t.service_id = s.id
      JOIN service_categories c ON s.category_id = c.id
      WHERE t.client_id = $1 OR t.provider_id = $1
      ORDER BY t.created_at DESC
    `, [userId]);

    // Calculate summary statistics
    const summaryResult = await query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_transactions,
        COALESCE(SUM(CASE WHEN status = 'completed' AND provider_id = $1 THEN amount ELSE 0 END), 0) as total_earnings,
        COALESCE(SUM(CASE WHEN status = 'completed' AND client_id = $1 THEN amount ELSE 0 END), 0) as total_spent
      FROM transactions 
      WHERE client_id = $1 OR provider_id = $1
    `, [userId]);

    const summary = summaryResult.rows[0] || {
      total_transactions: 0,
      completed_transactions: 0,
      pending_transactions: 0,
      cancelled_transactions: 0,
      total_earnings: 0,
      total_spent: 0
    };

    res.json({
      success: true,
      transactions: transactionsResult.rows,
      summary: {
        totalTransactions: parseInt(summary.total_transactions),
        completedTransactions: parseInt(summary.completed_transactions),
        pendingTransactions: parseInt(summary.pending_transactions),
        cancelledTransactions: parseInt(summary.cancelled_transactions),
        totalEarnings: parseFloat(summary.total_earnings),
        totalSpent: parseFloat(summary.total_spent)
      },
      count: transactionsResult.rows.length
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      error: 'Failed to fetch transactions',
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
    
    const transactionResult = await query(`
      SELECT 
        t.*,
        s.title as service_title,
        s.description as service_description,
        c.display_name as category_name,
        u_client.username as client_username,
        u_provider.username as provider_username
      FROM transactions t
      JOIN services s ON t.service_id = s.id
      JOIN service_categories c ON s.category_id = c.id
      JOIN users u_client ON t.client_id = u_client.id
      JOIN users u_provider ON t.provider_id = u_provider.id
      WHERE t.id = $1 AND (t.client_id = $2 OR t.provider_id = $2)
    `, [transactionId, userId]);

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      success: true,
      transaction: transactionResult.rows[0]
    });

  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      error: 'Failed to fetch transaction',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
