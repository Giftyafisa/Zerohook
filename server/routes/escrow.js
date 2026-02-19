const express = require('express');
const crypto = require('crypto');
const { authMiddleware } = require('./auth');
const mongoose = require('mongoose');
const { Transaction, User } = require('../config/database');
const EscrowManager = require('../services/EscrowManager');
const router = express.Router();

/**
 * @route   POST /api/escrow/create
 * @desc    Create escrow for transaction (hold money for a service) - generates completion PIN
 * @access  Private
 */
router.post('/create', authMiddleware, async (req, res) => {
  try {
    const clientId = req.user.userId;
    const { serviceId, providerId, amount, scheduledTime, locationData, paymentMethod = 'wallet' } = req.body;

    // Validate required fields
    if (!providerId) {
      return res.status(400).json({ success: false, error: 'Provider ID is required' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Valid amount is required' });
    }

    // Get client's country for currency
    const userCountry = await req.countryManager?.getUserCountry(clientId);
    const currency = userCountry?.country?.currency || 'NGN';

    // Risk assessment (now using MongoDB)
    const riskAssessment = await req.trustEngine.assessTransactionRisk(
      clientId, providerId, amount, 'service_booking'
    );

    if (riskAssessment.riskLevel === 'high') {
      return res.status(403).json({ success: false, error: 'Transaction blocked due to high risk',
        riskFactors: riskAssessment.riskFactors,
        recommendations: riskAssessment.recommendations
      });
    }

    // Create escrow with PIN (now using MongoDB)
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

    // Notify provider via socket (but DON'T send PIN - only client sees PIN)
    if (req.io) {
      req.io.to(`user_${providerId}`).emit('escrow_created', {
        escrowId: escrowResult.id || escrowResult.transactionId,
        amount,
        currency,
        clientId,
        message: `New payment of ${currency}${amount} held for your service! Ask client for completion PIN after service.`
      });
    }

    res.json({
      success: true,
      message: 'Escrow created successfully. Share the PIN with provider ONLY after service is complete.',
      transaction: escrowResult,
      completionPin: escrowResult.completionPin, // Only sent to client
      riskAssessment
    });

  } catch (error) {
    console.error('Create escrow error:', error);
    res.status(500).json({ success: false, error: 'Failed to create escrow',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/escrow/enter-pin
 * @desc    Provider enters PIN to confirm service was delivered (Uber-style)
 * @access  Private (Provider only)
 */
router.post('/enter-pin', authMiddleware, async (req, res) => {
  try {
    const providerId = req.user.userId;
    const { escrowId, pin } = req.body;

    if (!escrowId || !pin) {
      return res.status(400).json({ success: false, error: 'Escrow ID and PIN are required' });
    }

    const result = await req.escrowManager.enterCompletionPin(escrowId, pin, providerId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        attemptsRemaining: result.attemptsRemaining
      });
    }

    // Get escrow details to notify client
    const escrow = await Transaction.findById(escrowId);
    if (req.io && escrow?.client_id) {
      req.io.to(`user_${escrow.client_id.toString()}`).emit('pin_entered', {
        escrowId,
        amount: escrow.amount,
        currency: escrow.currency,
        confirmationDeadline: result.confirmationDeadline,
        message: `Provider entered completion PIN. Please confirm the service was delivered within 48 hours, or funds will auto-release.`
      });
    }

    res.json({
      success: true,
      message: result.message,
      confirmationDeadline: result.confirmationDeadline,
      autoReleaseAt: result.autoReleaseAt
    });

  } catch (error) {
    console.error('Enter PIN error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify PIN',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/escrow/confirm
 * @desc    Client confirms service was delivered - releases funds
 * @access  Private (Client only)
 */
router.post('/confirm', authMiddleware, async (req, res) => {
  try {
    const clientId = req.user.userId;
    const { escrowId } = req.body;

    if (!escrowId) {
      return res.status(400).json({ success: false, error: 'Escrow ID is required' });
    }

    const result = await req.escrowManager.clientConfirmService(escrowId, clientId);

    // Get escrow details to notify provider
    const escrow = await Transaction.findById(escrowId);

    // Notify provider that payment was released
    if (req.io && escrow?.provider_id) {
      req.io.to(`user_${escrow.provider_id.toString()}`).emit('escrow_released', {
        escrowId,
        amount: result.amount,
        currency: escrow.currency,
        message: `Payment of ${escrow.currency}${result.amount} released! Funds added to your wallet.`
      });
    }

    // Record positive trust event
    if (req.trustEngine) {
      try {
        await req.trustEngine.recordTrustEvent(clientId, 'escrow_confirmed', { escrowId }, 5);
      } catch (e) {}
    }

    res.json({
      success: true,
      message: 'Service confirmed! Payment released to provider.',
      result
    });

  } catch (error) {
    console.error('Confirm service error:', error);
    res.status(500).json({ success: false, error: 'Failed to confirm service',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/escrow/claim-complete
 * @desc    Provider claims service was completed (when client refuses to share PIN)
 * @access  Private (Provider only)
 */
router.post('/claim-complete', authMiddleware, async (req, res) => {
  try {
    const providerId = req.user.userId;
    const { escrowId, evidenceDescription, evidenceFiles } = req.body;

    if (!escrowId) {
      return res.status(400).json({ success: false, error: 'Escrow ID is required' });
    }

    const result = await req.escrowManager.providerClaimServiceComplete(escrowId, providerId, {
      evidenceDescription: evidenceDescription || 'Service completed as agreed',
      evidenceFiles: evidenceFiles || []
    });

    // Get escrow details to notify client
    const escrow = await Transaction.findById(escrowId);

    // Notify client that provider claims completion - they need to respond
    if (req.io && escrow?.client_id) {
      req.io.to(`user_${escrow.client_id.toString()}`).emit('provider_claimed_complete', {
        escrowId,
        amount: escrow.amount,
        currency: escrow.currency,
        clientResponseDeadline: result.clientResponseDeadline,
        message: `Provider claims the service was delivered. Please share the PIN, confirm, or dispute within 24 hours. If you don't respond, payment will auto-release to the provider.`,
        urgency: 'high'
      });
    }

    res.json({
      success: true,
      message: result.message,
      clientResponseDeadline: result.clientResponseDeadline,
      nextSteps: result.nextSteps
    });

  } catch (error) {
    console.error('Claim complete error:', error);
    res.status(500).json({ success: false, error: 'Failed to claim service completion',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/escrow/dispute
 * @desc    Open dispute on escrow
 * @access  Private
 */
router.post('/dispute', authMiddleware, async (req, res) => {
  try {
    const { escrowId, reason } = req.body;
    const userId = req.user.userId;

    if (!escrowId || !reason) {
      return res.status(400).json({ success: false, error: 'Escrow ID and reason are required' });
    }

    const escrowObjId = mongoose.Types.ObjectId.isValid(escrowId) ? 
      new mongoose.Types.ObjectId(escrowId) : null;
    const userObjId = mongoose.Types.ObjectId.createFromHexString(userId);

    if (!escrowObjId) {
      return res.status(400).json({ success: false, error: 'Invalid escrow ID' });
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
      return res.status(403).json({ success: false, error: 'Access denied to this escrow' });
    }

    // Use EscrowManager to initiate dispute
    const result = await req.escrowManager.initiateDispute(escrowId, { reason, evidence: [] }, userId);

    // Notify the other party via socket
    if (req.io) {
      const otherUserId = escrow.client_id?.toString() === userId ? 
        escrow.provider_id?.toString() : escrow.client_id?.toString();
      
      if (otherUserId) {
        req.io.to(`user_${otherUserId}`).emit('escrow_disputed', {
          escrowId,
          amount: escrow.amount,
          currency: escrow.currency,
          reason,
          message: 'A dispute has been opened. You can upload evidence to support your case. Admin will review within 24-48 hours.'
        });
      }
    }

    // Record trust event (slight negative for opening dispute)
    if (req.trustEngine) {
      try {
        await req.trustEngine.recordTrustEvent(userId, 'escrow_disputed', { escrowId, reason }, -1);
      } catch (e) {}
    }

    res.json({
      success: true,
      message: result.message,
      disputeId: result.disputeId
    });

  } catch (error) {
    console.error('Dispute escrow error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit dispute',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/escrow/:id/evidence
 * @desc    Upload evidence for a dispute
 * @access  Private
 */
router.post('/:id/evidence', authMiddleware, async (req, res) => {
  try {
    const transactionId = req.params.id;
    const userId = req.user.userId;
    const { fileUrl, fileType, description } = req.body;

    if (!fileUrl) {
      return res.status(400).json({ success: false, error: 'File URL is required' });
    }

    const result = await req.escrowManager.addDisputeEvidence(transactionId, userId, {
      fileUrl,
      fileType,
      description
    });

    res.json({
      success: true,
      message: 'Evidence uploaded successfully'
    });

  } catch (error) {
    console.error('Upload evidence error:', error);
    res.status(500).json({ success: false, error: 'Failed to upload evidence',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/escrow/:id/pin
 * @desc    Get completion PIN for an escrow (client only)
 * @access  Private (Client only)
 */
router.get('/:id/pin', authMiddleware, async (req, res) => {
  try {
    const transactionId = req.params.id;
    const userId = req.user.userId;

    const transactionObjId = mongoose.Types.ObjectId.isValid(transactionId) ? 
      new mongoose.Types.ObjectId(transactionId) : null;
    const userObjId = mongoose.Types.ObjectId.createFromHexString(userId);

    if (!transactionObjId) {
      return res.status(400).json({ success: false, error: 'Invalid transaction ID' });
    }

    // Only the CLIENT can see the PIN
    const escrow = await Transaction.findOne({
      _id: transactionObjId,
      client_id: userObjId,
      type: 'escrow_hold'
    });

    if (!escrow) {
      return res.status(403).json({ success: false, error: 'Access denied. Only the client can view the PIN.' });
    }

    res.json({
      success: true,
      completionPin: escrow.completion_pin,
      status: escrow.status,
      pinEntered: !!escrow.pin_entered_at,
      message: escrow.pin_entered_at 
        ? 'PIN has been entered. Please confirm the service was delivered.' 
        : 'Share this PIN with the provider ONLY after the service is complete.'
    });

  } catch (error) {
    console.error('Get PIN error:', error);
    res.status(500).json({ success: false, error: 'Failed to get PIN',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/escrow/dispute-status
 * @desc    Get user's dispute/ban status
 * @access  Private
 */
router.get('/dispute-status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const status = await req.escrowManager.getUserDisputeStatus(userId);

    res.json({
      success: true,
      ...status
    });

  } catch (error) {
    console.error('Get dispute status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get dispute status',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/escrow/request-unban
 * @desc    Request account unban (for banned users)
 * @access  Private (banned users can still auth, just can't transact)
 */
router.post('/request-unban', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, error: 'Reason is required' });
    }

    // We need to instantiate escrowManager or use a static method
    const escrowManager = new EscrowManager();
    
    const result = await escrowManager.requestUnban(userId, reason);

    res.json(result);

  } catch (error) {
    console.error('Request unban error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit unban request',
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
    const transactionObjId = mongoose.Types.ObjectId.isValid(transactionId) ? 
      new mongoose.Types.ObjectId(transactionId) : null;
    
    if (!transactionObjId) {
      return res.status(400).json({ success: false, error: 'Invalid transaction ID' });
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
      return res.status(404).json({ success: false, error: 'Transaction not found or not authorized' });
    }

    // Confirm completion (pass userId for authorization check)
    const result = await req.escrowManager.confirmCompletion(
      transactionId,
      completionProof,
      userId
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
    res.status(500).json({ success: false, error: 'Failed to complete transaction',
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
    res.status(500).json({ success: false, error: 'Failed to initiate dispute',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/escrow/:id/status
 * @desc    Get escrow status (PIN visible only to client)
 * @access  Private
 */
router.get('/:id/status', authMiddleware, async (req, res) => {
  try {
    const transactionId = req.params.id;
    const userId = req.user.userId;

    // Verify user access using MongoDB
    const transactionObjId = mongoose.Types.ObjectId.isValid(transactionId) ? 
      new mongoose.Types.ObjectId(transactionId) : null;
    const userObjId = mongoose.Types.ObjectId.createFromHexString(userId);
    
    if (!transactionObjId) {
      return res.status(400).json({ success: false, error: 'Invalid transaction ID' });
    }
    
    const transaction = await Transaction.findOne({
      _id: transactionObjId,
      $or: [
        { client_id: userObjId },
        { provider_id: userObjId }
      ]
    });

    if (!transaction) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Pass userId so PIN visibility can be determined
    const status = await req.escrowManager.getEscrowStatus(transactionId, userId);

    res.json({ status });

  } catch (error) {
    console.error('Get escrow status error:', error);
    res.status(500).json({ success: false, error: 'Failed to get escrow status'
    });
  }
});

/**
 * @route   GET /api/escrow/list
 * @desc    Get user's escrows (as client or provider) - includes PIN verification status
 * @access  Private
 */
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const userObjId = mongoose.Types.ObjectId.createFromHexString(userId);
    
    // Get all escrows where user is client or provider using MongoDB
    // Include more statuses to show completed/disputed escrows too
    const escrows = await Transaction.find({
      $or: [
        { client_id: userObjId },
        { provider_id: userObjId }
      ],
      type: 'escrow_hold'
    }).sort({ created_at: -1 }).limit(50);

    // Batch load all users referenced in escrows to avoid N+1 queries
    const userIds = new Set();
    escrows.forEach(e => {
      if (e.client_id) userIds.add(e.client_id.toString());
      if (e.provider_id) userIds.add(e.provider_id.toString());
    });
    const users = await User.find({ _id: { $in: [...userIds] } }).select('username profileData profile_data').lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u; });

    // Get user details for each escrow
    const transformedEscrows = await Promise.all(escrows.map(async (escrow) => {
      let clientName = 'Client';
      let clientAvatar = null;
      let providerName = 'Provider';
      let providerAvatar = null;

      try {
        if (escrow.client_id) {
          const client = userMap[escrow.client_id.toString()];
          if (client) {
            clientName = client.username;
            clientAvatar = client.profileData?.profilePicture || client.profile_data?.profilePicture;
          }
        }
        if (escrow.provider_id) {
          const provider = userMap[escrow.provider_id.toString()];
          if (provider) {
            providerName = provider.username;
            providerAvatar = provider.profileData?.profilePicture || provider.profile_data?.profilePicture;
          }
        }
      } catch (e) {
        // Use defaults
      }

      const userRole = escrow.client_id?.toString() === userId ? 'client' : 'provider';
      const isClient = userRole === 'client';

      // Normalize status for frontend
      let displayStatus = escrow.status;
      if (escrow.status === 'escrow_held' || escrow.status === 'in_progress') {
        displayStatus = 'held';
      }

      // Generate PIN for old escrows that don't have one (migration for pre-PIN escrows)
      // Use atomic update to avoid race condition
      let completionPin = escrow.completion_pin;
      if (!completionPin && (displayStatus === 'held' || displayStatus === 'escrow_held' || displayStatus === 'in_progress')) {
        const newPin = crypto.randomInt(100000, 999999).toString();
        
        const confirmationDeadline = new Date();
        confirmationDeadline.setHours(confirmationDeadline.getHours() + 48);
        
        // Atomic: only set PIN if it doesn't exist yet
        const atomicResult = await Transaction.findOneAndUpdate(
          { _id: escrow._id, completion_pin: { $exists: false } },
          { 
            $set: { 
              completion_pin: newPin,
              confirmation_deadline: confirmationDeadline,
              auto_release_at: confirmationDeadline
            }
          },
          { new: true }
        );
        
        if (atomicResult) {
          completionPin = newPin;
          console.log(`🔐 Generated PIN for old escrow ${escrow._id}`);
        } else {
          // Another request already set the PIN - re-read
          const refreshed = await Transaction.findById(escrow._id).select('completion_pin');
          completionPin = refreshed?.completion_pin;
        }
      }

      return {
        id: escrow._id.toString(),
        amount: parseFloat(escrow.amount),
        currency: escrow.currency || 'NGN',
        status: displayStatus,
        providerName,
        providerAvatar,
        providerId: escrow.provider_id?.toString(),
        clientName,
        clientAvatar,
        clientId: escrow.client_id?.toString(),
        serviceTitle: escrow.metadata?.serviceTitle || 'Service',
        createdAt: escrow.created_at,
        description: escrow.metadata?.description,
        userRole,
        // PIN verification status
        completionPin: isClient ? completionPin : null, // Only client sees PIN
        pinEntered: !!escrow.pin_entered_at,
        pinEnteredAt: escrow.pin_entered_at,
        providerConfirmed: escrow.provider_confirmed || false,
        clientConfirmed: escrow.client_confirmed || false,
        confirmationDeadline: escrow.confirmation_deadline,
        autoReleaseAt: escrow.auto_release_at,
        // Dispute info
        isDisputed: escrow.status === 'disputed',
        disputeData: escrow.dispute_data
      };
    }));

    res.json({
      success: true,
      escrows: transformedEscrows,
      count: transformedEscrows.length
    });

  } catch (error) {
    console.error('Get escrows list error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch escrows',
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

    const escrowObjId = mongoose.Types.ObjectId.isValid(escrowId) ? 
      new mongoose.Types.ObjectId(escrowId) : null;
    const userObjId = mongoose.Types.ObjectId.createFromHexString(userId);

    if (!escrowObjId) {
      return res.status(400).json({ success: false, error: 'Invalid escrow ID' });
    }

    // Verify user is the client for this escrow
    const escrow = await Transaction.findOne({
      _id: escrowObjId,
      client_id: userObjId,
      type: 'escrow_hold'
    });

    if (!escrow) {
      return res.status(403).json({ success: false, error: 'Only the client can release payment' });
    }

    // Use EscrowManager to properly release the escrow (pass userId as 3rd arg for auth)
    const result = await req.escrowManager.confirmCompletion(escrowId, {
      type: 'client_release',
      releasedBy: userId,
      timestamp: new Date().toISOString()
    }, userId);

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
    res.status(500).json({ success: false, error: 'Failed to release payment',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * (Duplicate /dispute endpoint removed - use POST /api/escrow/dispute above or POST /api/escrow/:id/dispute)
 */

module.exports = router;
