const express = require('express');
const { authMiddleware } = require('./auth');
const mongoose = require('mongoose');
const router = express.Router();

/**
 * @route   POST /api/escrow/create
 * @desc    Create escrow for transaction (hold money for a service)
 * @access  Private
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const clientId = req.user.userId;
    const { serviceId, providerId, amount, scheduledTime, locationData, paymentMethod = 'wallet' } = req.body;

    // Validate required fields
    if (!providerId) {
      return res.status(400).json({ error: 'Provider ID is required' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }

    // Get client's country for currency
    const userCountry = await req.countryManager?.getUserCountry(clientId);
    const currency = userCountry?.country?.currency || 'NGN';

    // Risk assessment (now using MongoDB)
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

    // Create escrow (now using MongoDB)
    const escrowResult = await req.escrowManager.createEscrow({
      clientId,
      providerId,
      serviceId,
      amount,
      currency,
      scheduledTime,
      locationData,
      paymentMethod
    });

    // Notify provider via socket
    if (req.io) {
      req.io.to(`user_${providerId}`).emit('escrow_created', {
        escrowId: escrowResult.id || escrowResult.transactionId,
        amount,
        currency,
        clientId,
        message: `New payment of ${currency}${amount} held for your service!`
      });
    }

    res.json({
      success: true,
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
 * @desc    Confirm service completion and release escrow
 * @access  Private
 */
router.post('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const transactionId = req.params.id;
    const { completionProof } = req.body;
    const userId = req.user.userId;

    // Verify user is part of this transaction using MongoDB
    const { Transaction } = require('../config/database');
    
    const transactionObjId = mongoose.Types.ObjectId.isValid(transactionId) ? 
      new mongoose.Types.ObjectId(transactionId) : null;
    
    if (!transactionObjId) {
      return res.status(400).json({ error: 'Invalid transaction ID' });
    }
    
    const userObjId = mongoose.Types.ObjectId.createFromHexString(userId);
    
    const transaction = await Transaction.findOne({
      _id: transactionObjId,
      $or: [
        { client_id: userObjId },
        { provider_id: userObjId }
      ]
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found or not authorized' });
    }

    // Confirm completion
    const result = await req.escrowManager.confirmCompletion(
      transactionId,
      completionProof
    );

    // Notify other party
    const otherPartyId = transaction.client_id.toString() === userId ? 
      transaction.provider_id.toString() : transaction.client_id.toString();
    
    if (req.io) {
      req.io.to(`user_${otherPartyId}`).emit('escrow_completed', {
        escrowId: transactionId,
        amount: result.amount,
        message: 'Service completed and payment released!'
      });
    }

    res.json({
      success: true,
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

    // Verify user access using MongoDB
    const { Transaction } = require('../config/database');
    
    const transactionObjId = mongoose.Types.ObjectId.isValid(transactionId) ? 
      new mongoose.Types.ObjectId(transactionId) : null;
    const userObjId = mongoose.Types.ObjectId.createFromHexString(userId);
    
    if (!transactionObjId) {
      return res.status(400).json({ error: 'Invalid transaction ID' });
    }
    
    const transaction = await Transaction.findOne({
      _id: transactionObjId,
      $or: [
        { client_id: userObjId },
        { provider_id: userObjId }
      ]
    });

    if (!transaction) {
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
    const { Transaction, User } = require('../config/database');
    
    const userObjId = mongoose.Types.ObjectId.createFromHexString(userId);
    
    // Get all escrows where user is client or provider using MongoDB
    const escrows = await Transaction.find({
      $or: [
        { client_id: userObjId },
        { provider_id: userObjId }
      ],
      type: 'escrow_hold',
      status: { $in: ['pending', 'escrow_held', 'in_progress', 'held'] }
    }).sort({ created_at: -1 });

    // Get user details for each escrow
    const transformedEscrows = await Promise.all(escrows.map(async (escrow) => {
      let clientName = 'Client';
      let clientAvatar = null;
      let providerName = 'Provider';
      let providerAvatar = null;

      try {
        if (escrow.client_id) {
          const client = await User.findById(escrow.client_id).select('username profileData profile_data');
          if (client) {
            clientName = client.username;
            clientAvatar = client.profileData?.profilePicture || client.profile_data?.profilePicture;
          }
        }
        if (escrow.provider_id) {
          const provider = await User.findById(escrow.provider_id).select('username profileData profile_data');
          if (provider) {
            providerName = provider.username;
            providerAvatar = provider.profileData?.profilePicture || provider.profile_data?.profilePicture;
          }
        }
      } catch (e) {
        // Use defaults
      }

      const userRole = escrow.client_id?.toString() === userId ? 'client' : 'provider';

      return {
        id: escrow._id.toString(),
        amount: parseFloat(escrow.amount),
        currency: escrow.currency || 'NGN',
        status: escrow.status === 'escrow_held' || escrow.status === 'in_progress' ? 'held' : escrow.status,
        providerName,
        providerAvatar,
        providerId: escrow.provider_id?.toString(),
        clientName,
        clientAvatar,
        clientId: escrow.client_id?.toString(),
        serviceTitle: escrow.metadata?.serviceTitle || 'Service',
        createdAt: escrow.created_at,
        description: escrow.metadata?.description,
        userRole
      };
    }));

    res.json({
      success: true,
      escrows: transformedEscrows,
      count: transformedEscrows.length
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
    const { Transaction } = require('../config/database');

    const escrowObjId = mongoose.Types.ObjectId.isValid(escrowId) ? 
      new mongoose.Types.ObjectId(escrowId) : null;
    const userObjId = mongoose.Types.ObjectId.createFromHexString(userId);

    if (!escrowObjId) {
      return res.status(400).json({ error: 'Invalid escrow ID' });
    }

    // Verify user is the client for this escrow
    const escrow = await Transaction.findOne({
      _id: escrowObjId,
      client_id: userObjId,
      type: 'escrow_hold'
    });

    if (!escrow) {
      return res.status(403).json({ error: 'Only the client can release payment' });
    }

    // Use EscrowManager to properly release the escrow
    const result = await req.escrowManager.confirmCompletion(escrowId, {
      type: 'client_release',
      releasedBy: userId,
      timestamp: new Date().toISOString()
    });

    // Notify provider via socket
    if (req.io && escrow.provider_id) {
      req.io.to(`user_${escrow.provider_id.toString()}`).emit('escrow_released', {
        escrowId,
        amount: result.amount,
        currency: escrow.currency,
        message: `Payment of ${escrow.currency}${result.amount} released! Funds added to your wallet.`
      });
    }

    // Record trust event
    if (req.trustEngine) {
      try {
        await req.trustEngine.recordTrustEvent(
          userId,
          'escrow_released',
          { transactionId: escrowId },
          5 // Positive trust impact
        );
      } catch (e) {
        console.log('Trust event recording failed:', e.message);
      }
    }

    res.json({
      success: true,
      message: 'Payment released successfully',
      result
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
    const { Transaction } = require('../config/database');

    const escrowObjId = mongoose.Types.ObjectId.isValid(escrowId) ? 
      new mongoose.Types.ObjectId(escrowId) : null;
    const userObjId = mongoose.Types.ObjectId.createFromHexString(userId);

    if (!escrowObjId) {
      return res.status(400).json({ error: 'Invalid escrow ID' });
    }

    // Verify user is part of this escrow
    const escrow = await Transaction.findOne({
      _id: escrowObjId,
      $or: [
        { client_id: userObjId },
        { provider_id: userObjId }
      ]
    });

    if (!escrow) {
      return res.status(403).json({ error: 'Access denied to this escrow' });
    }

    // Use EscrowManager to initiate dispute
    await req.escrowManager.initiateDispute(escrowId, { reason, evidence: [] }, userId);

    // Notify both parties via socket
    if (req.io) {
      // Notify the other party
      const otherUserId = escrow.client_id?.toString() === userId ? 
        escrow.provider_id?.toString() : escrow.client_id?.toString();
      
      if (otherUserId) {
        req.io.to(`user_${otherUserId}`).emit('escrow_disputed', {
          escrowId,
          amount: escrow.amount,
          currency: escrow.currency,
          reason,
          message: 'A dispute has been opened. Support will contact you.'
        });
      }
    }

    // Record trust event (negative for disputed transactions)
    if (req.trustEngine) {
      try {
        await req.trustEngine.recordTrustEvent(
          userId,
          'escrow_disputed',
          { transactionId: escrowId, reason },
          -2 // Slight negative trust impact for opening dispute
        );
      } catch (e) {
        console.log('Trust event recording failed:', e.message);
      }
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
