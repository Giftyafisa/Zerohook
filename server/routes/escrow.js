const express = require('express');
const { authMiddleware } = require('./auth');
const router = express.Router();

/**
 * @route   POST /api/escrow/create
 * @desc    Create escrow for transaction
 * @access  Private
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const clientId = req.user.userId;
    const { serviceId, providerId, amount, scheduledTime, locationData, paymentMethodId } = req.body;

    // Risk assessment
    const riskAssessment = await req.trustEngine.assessTransactionRisk(
      clientId, providerId, amount, 'service_booking'
    );

    if (riskAssessment.riskLevel === 'high') {
      return res.status(403).json({
        error: 'Transaction blocked due to high risk',
        riskFactors: riskAssessment.riskFactors,
        recommendations: riskAssessment.recommendations
      });
    }

    // Create escrow
    const escrowResult = await req.escrowManager.createEscrow({
      clientId,
      providerId,
      serviceId,
      amount,
      scheduledTime,
      locationData,
      paymentMethodId
    });

    // Notify provider via socket
    if (req.io) {
      req.io.to(`user_${providerId}`).emit('escrow_created', {
        escrowId: escrowResult.id || escrowResult.transactionId,
        amount,
        clientId,
        message: 'New payment held for your service!'
      });
    }

    res.json({
      message: 'Escrow created successfully',
      transaction: escrowResult,
      riskAssessment
    });

  } catch (error) {
    console.error('Create escrow error:', error);
    res.status(500).json({
      error: 'Failed to create escrow',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/escrow/:id/complete
 * @desc    Confirm service completion
 * @access  Private
 */
router.post('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const transactionId = req.params.id;
    const { completionProof } = req.body;
    const userId = req.user.userId;

    // Verify user is part of this transaction
    const { query } = require('../config/database');
    const transactionResult = await query(`
      SELECT * FROM transactions 
      WHERE id = $1 AND (client_id = $2 OR provider_id = $2)
    `, [transactionId, userId]);

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // Confirm completion
    const result = await req.escrowManager.confirmCompletion(
      transactionId,
      completionProof
    );

    res.json({
      message: 'Transaction completed successfully',
      result
    });

  } catch (error) {
    console.error('Complete escrow error:', error);
    res.status(500).json({
      error: 'Failed to complete transaction',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/escrow/:id/dispute
 * @desc    Initiate dispute
 * @access  Private
 */
router.post('/:id/dispute', authMiddleware, async (req, res) => {
  try {
    const transactionId = req.params.id;
    const { reason, evidence } = req.body;
    const userId = req.user.userId;

    const result = await req.escrowManager.initiateDispute(
      transactionId,
      { reason, evidence },
      userId
    );

    res.json({
      message: 'Dispute initiated successfully',
      result
    });

  } catch (error) {
    console.error('Initiate dispute error:', error);
    res.status(500).json({
      error: 'Failed to initiate dispute',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/escrow/:id/status
 * @desc    Get escrow status
 * @access  Private
 */
router.get('/:id/status', authMiddleware, async (req, res) => {
  try {
    const transactionId = req.params.id;
    const userId = req.user.userId;

    // Verify user access
    const { query } = require('../config/database');
    const accessResult = await query(`
      SELECT 1 FROM transactions 
      WHERE id = $1 AND (client_id = $2 OR provider_id = $2)
    `, [transactionId, userId]);

    if (accessResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const status = await req.escrowManager.getEscrowStatus(transactionId);

    res.json({ status });

  } catch (error) {
    console.error('Get escrow status error:', error);
    res.status(500).json({
      error: 'Failed to get escrow status'
    });
  }
});

/**
 * @route   GET /api/escrow/list
 * @desc    Get user's escrows (as client or provider)
 * @access  Private
 */
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { query } = require('../config/database');
    
    // Get all escrows where user is client or provider
    const escrowsResult = await query(`
      SELECT 
        t.id,
        t.service_id,
        t.client_id,
        t.provider_id,
        t.amount,
        t.status,
        t.scheduled_time,
        t.created_at,
        t.updated_at,
        s.title as service_title,
        s.description as service_description,
        client.username as client_name,
        client.profile_data->>'profilePicture' as client_avatar,
        provider.username as provider_name,
        provider.profile_data->>'profilePicture' as provider_avatar,
        CASE 
          WHEN t.client_id = $1 THEN 'client'
          WHEN t.provider_id = $1 THEN 'provider'
        END as user_role
      FROM transactions t
      LEFT JOIN services s ON t.service_id = s.id
      LEFT JOIN users client ON t.client_id = client.id
      LEFT JOIN users provider ON t.provider_id = provider.id
      WHERE (t.client_id = $1 OR t.provider_id = $1)
        AND t.status IN ('pending', 'escrow_held', 'in_progress', 'held')
      ORDER BY t.created_at DESC
    `, [userId]);

    // Transform to frontend format
    const escrows = escrowsResult.rows.map(row => ({
      id: row.id,
      amount: parseFloat(row.amount),
      currency: 'NGN',
      status: row.status === 'escrow_held' || row.status === 'in_progress' ? 'held' : row.status,
      providerName: row.provider_name,
      providerAvatar: row.provider_avatar,
      providerId: row.provider_id,
      clientName: row.client_name,
      clientAvatar: row.client_avatar,
      clientId: row.client_id,
      serviceTitle: row.service_title || 'Service',
      createdAt: row.created_at,
      description: row.service_description
    }));

    res.json({
      success: true,
      escrows,
      count: escrows.length
    });

  } catch (error) {
    console.error('Get escrows list error:', error);
    res.status(500).json({
      error: 'Failed to fetch escrows',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/escrow/complete
 * @desc    Release escrow payment (simple endpoint)
 * @access  Private
 */
router.post('/complete', authMiddleware, async (req, res) => {
  try {
    const { escrowId } = req.body;
    const userId = req.user.userId;
    const { query: dbQuery } = require('../config/database');

    // Verify user is the client for this escrow
    const escrowResult = await dbQuery(`
      SELECT * FROM transactions 
      WHERE id = $1 AND client_id = $2
    `, [escrowId, userId]);

    if (escrowResult.rows.length === 0) {
      return res.status(403).json({ error: 'Only the client can release payment' });
    }

    // Update status to completed
    await dbQuery(`
      UPDATE transactions 
      SET status = 'completed', completed_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [escrowId]);

    // Notify provider via socket
    const escrow = escrowResult.rows[0];
    if (req.io && escrow.provider_id) {
      req.io.to(`user_${escrow.provider_id}`).emit('escrow_released', {
        escrowId,
        amount: escrow.amount,
        message: 'Payment released! Funds added to your wallet.'
      });
    }

    // Record trust event
    if (req.trustEngine) {
      await req.trustEngine.recordTrustEvent(
        userId,
        'escrow_released',
        { transactionId: escrowId },
        5 // Positive trust impact
      );
    }

    res.json({
      success: true,
      message: 'Payment released successfully'
    });

  } catch (error) {
    console.error('Complete escrow error:', error);
    res.status(500).json({
      error: 'Failed to release payment',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/escrow/dispute
 * @desc    Open dispute on escrow (simple endpoint)
 * @access  Private
 */
router.post('/dispute', authMiddleware, async (req, res) => {
  try {
    const { escrowId, reason } = req.body;
    const userId = req.user.userId;
    const { query: dbQuery } = require('../config/database');

    // Verify user is part of this escrow
    const escrowResult = await dbQuery(`
      SELECT * FROM transactions 
      WHERE id = $1 AND (client_id = $2 OR provider_id = $2)
    `, [escrowId, userId]);

    if (escrowResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this escrow' });
    }

    // Update status to disputed
    await dbQuery(`
      UPDATE transactions 
      SET status = 'disputed', updated_at = NOW()
      WHERE id = $1
    `, [escrowId]);

    // Notify both parties via socket
    const escrow = escrowResult.rows[0];
    if (req.io) {
      // Notify the other party
      const otherUserId = escrow.client_id === userId ? escrow.provider_id : escrow.client_id;
      req.io.to(`user_${otherUserId}`).emit('escrow_disputed', {
        escrowId,
        amount: escrow.amount,
        reason,
        message: 'A dispute has been opened. Support will contact you.'
      });
    }

    // Record trust event (negative for disputed transactions)
    if (req.trustEngine) {
      await req.trustEngine.recordTrustEvent(
        userId,
        'escrow_disputed',
        { transactionId: escrowId, reason },
        -2 // Slight negative trust impact for opening dispute
      );
    }

    res.json({
      success: true,
      message: 'Dispute submitted. Our team will review within 24-48 hours.'
    });

  } catch (error) {
    console.error('Dispute escrow error:', error);
    res.status(500).json({
      error: 'Failed to submit dispute',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
