const express = require('express');
const mongoose = require('mongoose');
const { User, Call } = require('../config/database');
const { authMiddleware } = require('./auth');
const { body, validationResult } = require('express-validator');
const { createDistributedLimiter } = require('../utils/rateLimiters');
const NotificationService = require('../services/NotificationService');
const router = express.Router();

const getCallRoomId = (userId1, userId2) => {
  const sorted = [String(userId1), String(userId2)].sort();
  return `call_${sorted[0]}_${sorted[1]}`;
};

const normalizeCallType = (rawType) => (String(rawType || '').toLowerCase() === 'audio' ? 'audio' : 'video');

const buildIncomingCallPayload = ({ callId, callerId, targetUserId, callerName, callType, timestamp }) => {
  const normalizedType = normalizeCallType(callType);
  return {
    id: String(callId),
    callId: String(callId),
    callerId: String(callerId),
    targetUserId: String(targetUserId),
    peerUserId: String(callerId),
    callerName,
    type: normalizedType,
    callType: normalizedType,
    timestamp: new Date(timestamp || Date.now()).toISOString()
  };
};

const parsedRingingWindow = parseInt(process.env.CALL_RINGING_WINDOW_MS || '300000', 10);
const ACTIVE_RINGING_WINDOW_MS = Number.isFinite(parsedRingingWindow) && parsedRingingWindow > 0
  ? Math.min(parsedRingingWindow, 15 * 60 * 1000) // hard cap: 15 minutes
  : 5 * 60 * 1000;

// Distributed call action limits (Redis-backed with memory fallback)
const callRequestLimiter = createDistributedLimiter({ points: 10, duration: 60, keyPrefix: 'call_request' });
const callActionLimiter = createDistributedLimiter({ points: 30, duration: 60, keyPrefix: 'call_action' });

/**
 * @route   POST /api/calls/request
 * @desc    Request a call with another user
 * @access  Private
 */
router.post('/request', authMiddleware, [
  body('targetUserId').isString().notEmpty(),
  body('type').optional().isIn(['audio', 'video']),
  body('callType').optional().isIn(['audio', 'video'])
], async (req, res) => {
  try {
    const requestKey = req.user?.userId ? `u:${req.user.userId}` : `ip:${req.ip}`;
    await callRequestLimiter.consume(requestKey);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed',
        details: errors.array()
      });
    }

    const { targetUserId, type, callType } = req.body;
    const requestedType = type || callType;
    if (!requestedType) {
      return res.status(400).json({ success: false, error: 'Either type or callType is required' });
    }
    const callerId = req.user.userId;
    const normalizedType = normalizeCallType(requestedType);

    if (!mongoose.Types.ObjectId.isValid(targetUserId) || !mongoose.Types.ObjectId.isValid(callerId)) {
      return res.status(400).json({ success: false, error: 'Invalid caller or target user ID' });
    }

    // Check if target user exists and is online
    const targetUser = await User.findById(targetUserId).select('_id').lean();

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'Target user not found' });
    }

    // Check if there's already an active call (auto-expire stale "calling" records > 60s)
    await Call.updateMany(
      { status: 'calling', created_at: { $lt: new Date(Date.now() - 60000) } },
      { $set: { status: 'missed', ended_at: new Date() } }
    );

    const ringingCutoff = new Date(Date.now() - ACTIVE_RINGING_WINDOW_MS);
    const activeCall = await Call.findOne({
      $or: [
        {
          status: 'connected',
          $or: [
            { caller_id: callerId },
            { target_user_id: callerId },
            { caller_id: targetUserId },
            { target_user_id: targetUserId }
          ]
        },
        {
          status: 'calling',
          created_at: { $gte: ringingCutoff },
          $or: [
            { caller_id: callerId },
            { target_user_id: callerId },
            { caller_id: targetUserId },
            { target_user_id: targetUserId }
          ]
        }
      ]
    }).select('_id caller_id target_user_id status created_at').lean();

    if (activeCall) {
      return res.status(409).json({ success: false, error: 'One of the users already has an active call' });
    }

    // Create call record
    const call = await Call.create({
      caller_id: new mongoose.Types.ObjectId(callerId),
      target_user_id: new mongoose.Types.ObjectId(targetUserId),
      type: normalizedType,
      status: 'calling'
    });

    const callId = String(call._id);
    const timestamp = call.created_at || call.createdAt || new Date();
    const incomingCallPayload = buildIncomingCallPayload({
      callId,
      callerId,
      targetUserId,
      callerName: req.user.username || req.user.profileData?.firstName || 'User',
      callType: normalizedType,
      timestamp
    });

    // Emit call request via Socket.io
    req.io.to(`user_${targetUserId}`).emit('incoming_call', incomingCallPayload);

    try {
      await NotificationService.createAndEmit(req.io, {
        userId: String(targetUserId),
        type: 'call',
        title: `Incoming ${normalizedType} call`,
        message: `${req.user.username || req.user.profileData?.firstName || 'Someone'} is calling...`,
        data: {
          callId,
          callerId: String(callerId),
          callerName: req.user.username || req.user.profileData?.firstName || 'Someone',
          callType: normalizedType,
          targetUserId: String(targetUserId)
        }
      });
    } catch (notificationError) {
      console.error('Call request notification error:', notificationError.message);
    }

    // Keep REST and socket flows aligned for caller-side listeners (multi-device support)
    req.io.to(`user_${callerId}`).emit('call_request_sent', {
      id: callId,
      callId,
      targetUserId: String(targetUserId),
      type: normalizedType,
      callType: normalizedType,
      timestamp: new Date(timestamp).toISOString()
    });

    res.json({
      success: true,
      data: {
        callId,
        callType: normalizedType,
        type: normalizedType,
        status: 'calling',
        timestamp: new Date(timestamp).toISOString()
      },
      callId,
      message: 'Call request sent successfully'
    });

  } catch (error) {
    if (error && Object.prototype.hasOwnProperty.call(error, 'msBeforeNext')) {
      return res.status(429).json({ success: false, error: 'Too many call requests. Please try again shortly.' });
    }
    console.error('Call request error:', error);
    res.status(500).json({ success: false, error: 'Failed to send call request' });
  }
});

/**
 * @route   POST /api/calls/accept
 * @desc    Accept an incoming call
 * @access  Private
 */
router.post('/accept', authMiddleware, [
  body('callId').isString().notEmpty()
], async (req, res) => {
  try {
    const actionKey = req.user?.userId ? `u:${req.user.userId}` : `ip:${req.ip}`;
    await callActionLimiter.consume(actionKey);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed',
        details: errors.array()
      });
    }

    const { callId } = req.body;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(callId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid call or user ID' });
    }

    // Verify call exists and user is the target
    const call = await Call.findOne({ _id: callId, target_user_id: userId, status: 'calling' });

    if (!call) {
      return res.status(404).json({ success: false, error: 'Call not found or already processed' });
    }

    // Update call status
    call.status = 'connected';
    call.connected_at = new Date();
    await call.save();

    // Emit call accepted via Socket.io
    const callerId = String(call.caller_id);
    const targetUserId = String(call.target_user_id);
    const acceptedPayload = {
      id: String(callId),
      callId: String(callId),
      acceptedBy: String(userId),
      targetUserId: String(userId),
      peerUserId: String(userId),
      callerId,
      callType: normalizeCallType(call.type),
      type: normalizeCallType(call.type),
      timestamp: new Date().toISOString()
    };

    req.io.to(`user_${callerId}`).emit('call_accepted', acceptedPayload);
    req.io.to(getCallRoomId(callerId, targetUserId)).emit('call_accepted', acceptedPayload);

    res.json({
      success: true,
      data: {
        callId: String(callId),
        status: 'connected',
        acceptedBy: String(userId),
        callType: normalizeCallType(call.type)
      },
      message: 'Call accepted successfully'
    });

  } catch (error) {
    if (error && Object.prototype.hasOwnProperty.call(error, 'msBeforeNext')) {
      return res.status(429).json({ success: false, error: 'Too many call actions. Please slow down.' });
    }
    console.error('Call accept error:', error);
    res.status(500).json({ success: false, error: 'Failed to accept call' });
  }
});

/**
 * @route   POST /api/calls/reject
 * @desc    Reject an incoming call
 * @access  Private
 */
router.post('/reject', authMiddleware, [
  body('callId').isString().notEmpty()
], async (req, res) => {
  try {
    const actionKey = req.user?.userId ? `u:${req.user.userId}` : `ip:${req.ip}`;
    await callActionLimiter.consume(actionKey);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed',
        details: errors.array()
      });
    }

    const { callId } = req.body;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(callId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid call or user ID' });
    }

    // Verify call exists and user is the target
    const call = await Call.findOne({ _id: callId, target_user_id: userId, status: 'calling' });

    if (!call) {
      return res.status(404).json({ success: false, error: 'Call not found or already processed' });
    }

    // Update call status
    call.status = 'rejected';
    call.ended_at = new Date();
    await call.save();

    // Emit call rejected via Socket.io
    const callerId = String(call.caller_id);
    const targetUserId = String(call.target_user_id);
    const rejectedPayload = {
      id: String(callId),
      callId: String(callId),
      callerId: String(userId),
      targetUserId: String(userId),
      reason: 'rejected',
      timestamp: new Date().toISOString()
    };

    req.io.to(`user_${callerId}`).emit('call_rejected', rejectedPayload);
    req.io.to(getCallRoomId(callerId, targetUserId)).emit('call_rejected', rejectedPayload);

    res.json({
      success: true,
      data: {
        callId: String(callId),
        status: 'rejected',
        rejectedBy: String(userId)
      },
      message: 'Call rejected successfully'
    });

  } catch (error) {
    if (error && Object.prototype.hasOwnProperty.call(error, 'msBeforeNext')) {
      return res.status(429).json({ success: false, error: 'Too many call actions. Please slow down.' });
    }
    console.error('Call reject error:', error);
    res.status(500).json({ success: false, error: 'Failed to reject call' });
  }
});

/**
 * @route   POST /api/calls/end
 * @desc    End an active call
 * @access  Private
 */
router.post('/end', authMiddleware, [
  body('callId').isString().notEmpty()
], async (req, res) => {
  try {
    const actionKey = req.user?.userId ? `u:${req.user.userId}` : `ip:${req.ip}`;
    await callActionLimiter.consume(actionKey);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed',
        details: errors.array()
      });
    }

    const { callId } = req.body;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(callId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid call or user ID' });
    }

    // Verify call exists and user is a participant
    const call = await Call.findOne({
      _id: callId,
      $or: [{ caller_id: userId }, { target_user_id: userId }],
      status: { $in: ['calling', 'connected'] }
    });

    if (!call) {
      return res.status(404).json({ success: false, error: 'Call not found or not active' });
    }

    // Update call status
    call.status = 'ended';
    call.ended_at = new Date();
    if (call.connected_at) {
      call.duration = Math.max(0, Math.floor((call.ended_at.getTime() - call.connected_at.getTime()) / 1000));
    }
    await call.save();

    // Emit call ended via Socket.io
    const callerId = call.caller_id.toString();
    const targetId = call.target_user_id.toString();
    const otherUserId = callerId === userId ? targetId : callerId;
    
    const endPayload = {
      id: String(callId),
      callId: String(callId),
      endedBy: String(userId),
      callerId: String(userId),
      targetUserId: String(otherUserId),
      reason: 'ended',
      timestamp: new Date().toISOString()
    };

    req.io.to(`user_${otherUserId}`).emit('call_ended', endPayload);
    req.io.to(getCallRoomId(callerId, targetId)).emit('call_ended', endPayload);

    res.json({
      success: true,
      data: {
        callId: String(callId),
        status: 'ended',
        endedBy: String(userId),
        callType: normalizeCallType(call.type),
        duration: call.duration || 0
      },
      message: 'Call ended successfully'
    });

  } catch (error) {
    if (error && Object.prototype.hasOwnProperty.call(error, 'msBeforeNext')) {
      return res.status(429).json({ success: false, error: 'Too many call actions. Please slow down.' });
    }
    console.error('Call end error:', error);
    res.status(500).json({ success: false, error: 'Failed to end call' });
  }
});

/**
 * @route   POST /api/calls/cancel
 * @desc    Cancel an outgoing ringing call (caller side)
 * @access  Private
 */
router.post('/cancel', authMiddleware, [
  body('callId').isString().notEmpty()
], async (req, res) => {
  try {
    const actionKey = req.user?.userId ? `u:${req.user.userId}` : `ip:${req.ip}`;
    await callActionLimiter.consume(actionKey);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed',
        details: errors.array()
      });
    }

    const { callId } = req.body;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(callId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid call or user ID' });
    }

    const call = await Call.findOne({ _id: callId, caller_id: userId, status: 'calling' });
    if (!call) {
      return res.status(404).json({ success: false, error: 'Call not found or not cancellable' });
    }

    call.status = 'missed';
    call.ended_at = new Date();
    await call.save();

    const callerId = String(call.caller_id);
    const targetUserId = String(call.target_user_id);
    const cancelPayload = {
      id: String(callId),
      callId: String(callId),
      callerId,
      targetUserId,
      reason: 'cancelled',
      timestamp: new Date().toISOString()
    };

    req.io.to(`user_${targetUserId}`).emit('call_cancelled', cancelPayload);
    req.io.to(getCallRoomId(callerId, targetUserId)).emit('call_cancelled', cancelPayload);

    res.json({
      success: true,
      data: {
        callId: String(callId),
        status: 'missed',
        reason: 'cancelled',
        cancelledBy: String(userId)
      },
      message: 'Call cancelled successfully'
    });
  } catch (error) {
    if (error && Object.prototype.hasOwnProperty.call(error, 'msBeforeNext')) {
      return res.status(429).json({ success: false, error: 'Too many call actions. Please slow down.' });
    }
    console.error('Call cancel error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel call' });
  }
});

/**
 * @route   POST /api/calls/timeout
 * @desc    Mark an outgoing ringing call as timed out (caller side)
 * @access  Private
 */
router.post('/timeout', authMiddleware, [
  body('callId').isString().notEmpty()
], async (req, res) => {
  try {
    const actionKey = req.user?.userId ? `u:${req.user.userId}` : `ip:${req.ip}`;
    await callActionLimiter.consume(actionKey);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Validation failed',
        details: errors.array()
      });
    }

    const { callId } = req.body;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(callId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid call or user ID' });
    }

    const call = await Call.findOne({ _id: callId, caller_id: userId, status: 'calling' });
    if (!call) {
      return res.status(404).json({ success: false, error: 'Call not found or not timeout-eligible' });
    }

    call.status = 'missed';
    call.ended_at = new Date();
    await call.save();

    const callerId = String(call.caller_id);
    const targetUserId = String(call.target_user_id);
    const timeoutPayload = {
      id: String(callId),
      callId: String(callId),
      callerId,
      targetUserId,
      reason: 'timeout',
      timestamp: new Date().toISOString()
    };

    req.io.to(`user_${targetUserId}`).emit('call_cancelled', timeoutPayload);
    req.io.to(getCallRoomId(callerId, targetUserId)).emit('call_cancelled', timeoutPayload);

    res.json({
      success: true,
      data: {
        callId: String(callId),
        status: 'missed',
        reason: 'timeout',
        timeoutBy: String(userId)
      },
      message: 'Call timeout recorded successfully'
    });
  } catch (error) {
    if (error && Object.prototype.hasOwnProperty.call(error, 'msBeforeNext')) {
      return res.status(429).json({ success: false, error: 'Too many call actions. Please slow down.' });
    }
    console.error('Call timeout error:', error);
    res.status(500).json({ success: false, error: 'Failed to record call timeout' });
  }
});

/**
 * @route   GET /api/calls/history
 * @desc    Get user's call history
 * @access  Private
 */
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const calls = await Call.find({ $or: [{ caller_id: userId }, { target_user_id: userId }] })
      .populate({ path: 'caller_id', select: 'username profile_data' })
      .populate({ path: 'target_user_id', select: 'username profile_data' })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limitNum)
      .lean();

    const total = await Call.countDocuments({ $or: [{ caller_id: userId }, { target_user_id: userId }] });

    const mappedCalls = calls.map((call) => {
      const isCaller = call.caller_id?._id?.toString() === userId;
      const otherUser = isCaller ? call.target_user_id : call.caller_id;
      const normalizedCallType = normalizeCallType(call.type);
      return {
        id: call._id.toString(),
        callId: call._id.toString(),
        type: normalizedCallType,
        callType: normalizedCallType,
        status: call.status,
        timestamp: call.created_at,
        created_at: call.created_at,
        connected_at: call.connected_at,
        ended_at: call.ended_at,
        duration: call.duration,
        other_user_id: otherUser?._id?.toString() || null,
        other_username: otherUser?.username || null,
        other_first_name: otherUser?.profile_data?.firstName || null,
        other_last_name: otherUser?.profile_data?.lastName || null
      };
    });

    res.json({
      success: true,
      data: {
        calls: mappedCalls,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum)
        }
      },
      calls: mappedCalls,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      },
      message: 'Call history fetched successfully'
    });

  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch call history' });
  }
});

module.exports = router;

