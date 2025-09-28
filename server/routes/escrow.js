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

module.exports = router;
