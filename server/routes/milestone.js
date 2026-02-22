const express = require('express');
const { authMiddleware } = require('./auth');
const mongoose = require('mongoose');
const { User, Transaction, MilestoneRequest } = require('../config/database');
const router = express.Router();

const getAvatar = (user) => user?.profile_data?.profilePicture || user?.profile_data?.avatar || null;

/**
 * Milestone Request System
 * 
 * Allows clients and providers to request payment holds (milestones) in chat
 * 
 * Flow:
 * 1. Provider sends payment request to client (provider_request)
 * 2. Client can accept/decline
 * 3. If accepted, client pays and money is held in escrow
 * 
 * OR:
 * 1. Client requests provider to set up payment (client_request)
 * 2. Provider accepts and sends amount
 * 3. Client pays and money is held
 */

/**
 * @route   POST /api/milestone/request
 * @desc    Send a milestone/payment request
 * @access  Private
 */
router.post('/request', authMiddleware, async (req, res) => {
  try {
    const senderId = req.user.userId;
    const { recipientId, amount, description, requestType } = req.body;

    if (!recipientId || !amount) {
      return res.status(400).json({ error: 'Recipient and amount are required' });
    }

    // Dynamic minimum based on currency (equivalent of ~$0.50 USD)
    const currencyMinimums = { NGN: 500, GHS: 10, KES: 100, ZAR: 15, UGX: 3000, TZS: 2000, USD: 1, GBP: 1, EUR: 1 };
    // Derive user currency from countryManager (req.user.currency is never set by auth middleware)
    let userCurrency = 'NGN'; // Default
    try {
      if (req.countryManager) {
        const userCountry = await req.countryManager.getUserCountry(senderId);
        if (userCountry?.success && userCountry?.country?.currency) {
          userCurrency = userCountry.country.currency;
        }
      }
    } catch (e) {
      // Use default currency
    }
    const minAmount = currencyMinimums[userCurrency] || 500;
    if (amount < minAmount) {
      return res.status(400).json({ error: `Minimum amount is ${minAmount} ${userCurrency}` });
    }

    if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({ error: 'Invalid sender or recipient' });
    }

    const request = await MilestoneRequest.create({
      sender_id: new mongoose.Types.ObjectId(senderId),
      recipient_id: new mongoose.Types.ObjectId(recipientId),
      amount: Number(amount),
      description: description || '',
      request_type: requestType || 'provider_request',
      status: 'pending'
    });

    const senderInfo = await User.findById(senderId).select('username profile_data').lean();

    // Notify recipient via socket
    if (req.io) {
      req.io.to(`user_${recipientId}`).emit('milestone_request', {
        id: request._id.toString(),
        senderId,
        senderName: senderInfo?.username || 'User',
        senderAvatar: getAvatar(senderInfo),
        amount,
        description,
        requestType,
        status: 'pending',
        createdAt: request.created_at
      });
    }

    res.json({
      success: true,
      request: {
        id: request._id.toString(),
        senderId,
        recipientId,
        amount: Number(request.amount),
        description: request.description,
        requestType: request.request_type,
        status: request.status,
        createdAt: request.created_at
      }
    });

  } catch (error) {
    console.error('Create milestone request error:', error);
    res.status(500).json({
      error: 'Failed to create request',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/milestone/respond
 * @desc    Accept or decline a milestone request
 * @access  Private
 */
router.post('/respond', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { requestId, action } = req.body; // action: 'accept' or 'decline'

    if (!requestId || !['accept', 'decline'].includes(action)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid request or user ID' });
    }

    const request = await MilestoneRequest.findOne({
      _id: requestId,
      recipient_id: userId,
      status: 'pending'
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found or already processed' });
    }

    const newStatus = action === 'accept' ? 'accepted' : 'declined';

    request.status = newStatus;
    await request.save();

    // Notify sender via socket
    if (req.io) {
      req.io.to(`user_${request.sender_id.toString()}`).emit('milestone_response', {
        requestId,
        status: newStatus,
        responderId: userId
      });
    }

    res.json({
      success: true,
      status: newStatus
    });

  } catch (error) {
    console.error('Respond to milestone error:', error);
    res.status(500).json({
      error: 'Failed to respond to request',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/milestone/pay
 * @desc    Pay and hold money for an accepted milestone request
 * @access  Private
 */
router.post('/pay', authMiddleware, async (req, res) => {
  try {
    const clientId = req.user.userId;
    const { requestId, paymentMethod } = req.body;

    if (!mongoose.Types.ObjectId.isValid(requestId) || !mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ error: 'Invalid request or client ID' });
    }

    const request = await MilestoneRequest.findOne({
      _id: requestId,
      recipient_id: clientId,
      status: 'accepted'
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found or not accepted' });
    }

    const providerId = request.sender_id.toString();
    const amount = Number(request.amount);

    // ── Wallet balance check: ensure client has enough funds ──
    const clientWallet = await Transaction.aggregate([
      { $match: { $or: [{ client_id: new mongoose.Types.ObjectId(clientId) }, { provider_id: new mongoose.Types.ObjectId(clientId) }] } },
      {
        $group: {
          _id: null,
          totalIn: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$provider_id', new mongoose.Types.ObjectId(clientId)] }, { $eq: ['$status', 'completed'] }] },
                '$amount', 0
              ]
            }
          },
          totalOut: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$client_id', new mongoose.Types.ObjectId(clientId)] }, { $in: ['$status', ['completed', 'held']] }] },
                '$amount', 0
              ]
            }
          }
        }
      }
    ]);
    const balance = (clientWallet[0]?.totalIn || 0) - (clientWallet[0]?.totalOut || 0);
    if (balance < amount) {
      return res.status(400).json({ error: 'Insufficient wallet balance', available: balance, required: amount });
    }

    // ── Fraud check (if service available) ──
    if (req.fraudDetection) {
      try {
        const risk = await req.fraudDetection.assessRisk({
          userId: clientId,
          action: 'escrow_create',
          amount,
          recipientId: providerId
        });
        if (risk && risk.blocked) {
          return res.status(403).json({ error: 'Transaction blocked by fraud detection', reason: risk.reason });
        }
      } catch (fraudErr) {
        console.warn('Fraud check skipped (non-fatal):', fraudErr.message);
      }
    }

    // ── Create escrow via EscrowManager if available, else direct ──
    let escrowTransaction;
    if (req.escrowManager) {
      escrowTransaction = await req.escrowManager.createEscrow({
        clientId,
        providerId,
        amount,
        description: request.description || 'Service payment',
        metadata: {
          request_id: request._id.toString(),
          payment_method: paymentMethod || 'wallet'
        }
      });
    } else {
      escrowTransaction = await Transaction.create({
        client_id: new mongoose.Types.ObjectId(clientId),
        provider_id: new mongoose.Types.ObjectId(providerId),
        amount,
        status: 'held',
        type: 'escrow_hold',
        metadata: {
          description: request.description || 'Service payment',
          request_id: request._id.toString(),
          payment_method: paymentMethod || 'wallet'
        }
      });
    }

    const escrowId = escrowTransaction._id || escrowTransaction.id;

    request.status = 'paid';
    request.escrow_id = escrowId;
    await request.save();

    // Notify provider
    if (req.io) {
      req.io.to(`user_${providerId}`).emit('escrow_created', {
        escrowId: escrowId.toString(),
        amount,
        clientId,
        message: `${amount.toLocaleString()} has been held for your service!`
      });
    }

    res.json({
      success: true,
      escrow: {
        id: escrowId.toString(),
        amount,
        status: 'held'
      }
    });

  } catch (error) {
    console.error('Pay milestone error:', error);
    res.status(500).json({
      error: 'Failed to process payment',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/milestone/pending
 * @desc    Get pending milestone requests for a conversation
 * @access  Private
 */
router.get('/pending/:otherUserId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { otherUserId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const requests = await MilestoneRequest.find({
      $or: [
        { sender_id: userId, recipient_id: otherUserId },
        { sender_id: otherUserId, recipient_id: userId }
      ],
      status: { $in: ['pending', 'accepted'] }
    })
      .populate({ path: 'sender_id', select: 'username profile_data' })
      .populate({ path: 'recipient_id', select: 'username profile_data' })
      .sort({ created_at: -1 })
      .lean();

    res.json({
      success: true,
      requests: requests.map(r => ({
        id: r._id.toString(),
        senderId: r.sender_id?._id?.toString() || null,
        senderName: r.sender_id?.username || 'User',
        senderAvatar: getAvatar(r.sender_id),
        recipientId: r.recipient_id?._id?.toString() || null,
        recipientName: r.recipient_id?.username || 'User',
        amount: Number(r.amount),
        description: r.description,
        requestType: r.request_type,
        status: r.status,
        createdAt: r.created_at
      }))
    });

  } catch (error) {
    console.error('Get pending milestones error:', error);
    res.status(500).json({
      error: 'Failed to fetch requests',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/milestone/list
 * @desc    Get all milestone requests for current user
 * @access  Private
 */
router.get('/list', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const requests = await MilestoneRequest.find({
      $or: [{ sender_id: userId }, { recipient_id: userId }]
    })
      .populate({ path: 'sender_id', select: 'username profile_data' })
      .populate({ path: 'recipient_id', select: 'username profile_data' })
      .sort({ created_at: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      requests: requests.map(r => ({
        id: r._id.toString(),
        senderId: r.sender_id?._id?.toString() || null,
        senderName: r.sender_id?.username || 'User',
        senderAvatar: getAvatar(r.sender_id),
        recipientId: r.recipient_id?._id?.toString() || null,
        recipientName: r.recipient_id?.username || 'User',
        recipientAvatar: getAvatar(r.recipient_id),
        amount: Number(r.amount),
        description: r.description,
        requestType: r.request_type,
        status: r.status,
        escrowId: r.escrow_id?.toString() || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }))
    });

  } catch (error) {
    console.error('Get milestone list error:', error);
    res.status(500).json({
      error: 'Failed to fetch requests'
    });
  }
});

module.exports = router;
