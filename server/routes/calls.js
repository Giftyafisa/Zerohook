const express = require('express');
const mongoose = require('mongoose');
const { User, Call } = require('../config/database');
const { authMiddleware } = require('./auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

/**
 * @route   POST /api/calls/request
 * @desc    Request a call with another user
 * @access  Private
 */
router.post('/request', authMiddleware, [
  body('targetUserId').isString().notEmpty(),
  body('type').isIn(['audio', 'video']).notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { targetUserId, type } = req.body;
    const callerId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(targetUserId) || !mongoose.Types.ObjectId.isValid(callerId)) {
      return res.status(400).json({ error: 'Invalid caller or target user ID' });
    }

    // Check if target user exists and is online
    const targetUser = await User.findById(targetUserId).select('_id').lean();

    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Check if there's already an active call (auto-expire stale "calling" records > 60s)
    await Call.updateMany(
      { status: 'calling', created_at: { $lt: new Date(Date.now() - 60000) } },
      { $set: { status: 'missed', ended_at: new Date() } }
    );

    const activeCall = await Call.findOne({
      $or: [{ caller_id: callerId }, { target_user_id: callerId }],
      status: { $in: ['calling', 'connected'] }
    }).select('_id').lean();

    if (activeCall) {
      return res.status(400).json({ error: 'You already have an active call' });
    }

    // Create call record
    const call = await Call.create({
      caller_id: new mongoose.Types.ObjectId(callerId),
      target_user_id: new mongoose.Types.ObjectId(targetUserId),
      type,
      status: 'calling'
    });

    // Emit call request via Socket.io
    req.io.to(`user_${targetUserId}`).emit('incoming_call', {
      id: call._id.toString(),
      callId: call._id.toString(),
      callerId,
      callerName: req.user.username || req.user.profileData?.firstName || 'User',
      type,
      callType: type,
      timestamp: call.created_at
    });

    res.json({
      success: true,
      callId: call._id.toString(),
      message: 'Call request sent successfully'
    });

  } catch (error) {
    console.error('Call request error:', error);
    res.status(500).json({ error: 'Failed to send call request' });
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { callId } = req.body;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(callId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid call or user ID' });
    }

    // Verify call exists and user is the target
    const call = await Call.findOne({ _id: callId, target_user_id: userId, status: 'calling' });

    if (!call) {
      return res.status(404).json({ error: 'Call not found or already processed' });
    }

    // Update call status
    call.status = 'connected';
    call.connected_at = new Date();
    await call.save();

    // Emit call accepted via Socket.io
    req.io.to(`user_${call.caller_id.toString()}`).emit('call_accepted', {
      id: callId,
      callId,
      targetUserId: userId,
      peerUserId: userId,
      callType: call.type,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Call accepted successfully'
    });

  } catch (error) {
    console.error('Call accept error:', error);
    res.status(500).json({ error: 'Failed to accept call' });
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { callId } = req.body;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(callId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid call or user ID' });
    }

    // Verify call exists and user is the target
    const call = await Call.findOne({ _id: callId, target_user_id: userId, status: 'calling' });

    if (!call) {
      return res.status(404).json({ error: 'Call not found or already processed' });
    }

    // Update call status
    call.status = 'rejected';
    call.ended_at = new Date();
    await call.save();

    // Emit call rejected via Socket.io
    req.io.to(`user_${call.caller_id.toString()}`).emit('call_rejected', {
      id: callId,
      callId,
      targetUserId: userId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Call rejected successfully'
    });

  } catch (error) {
    console.error('Call reject error:', error);
    res.status(500).json({ error: 'Failed to reject call' });
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
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { callId } = req.body;
    const userId = req.user.userId;

    if (!mongoose.Types.ObjectId.isValid(callId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid call or user ID' });
    }

    // Verify call exists and user is a participant
    const call = await Call.findOne({
      _id: callId,
      $or: [{ caller_id: userId }, { target_user_id: userId }],
      status: 'connected'
    });

    if (!call) {
      return res.status(404).json({ error: 'Call not found or not active' });
    }

    // Update call status
    call.status = 'ended';
    call.ended_at = new Date();
    await call.save();

    // Emit call ended via Socket.io
    const callerId = call.caller_id.toString();
    const targetId = call.target_user_id.toString();
    const otherUserId = callerId === userId ? targetId : callerId;
    
    req.io.to(`user_${otherUserId}`).emit('call_ended', {
      id: callId,
      callId,
      endedBy: userId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Call ended successfully'
    });

  } catch (error) {
    console.error('Call end error:', error);
    res.status(500).json({ error: 'Failed to end call' });
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
      return {
        id: call._id.toString(),
        type: call.type,
        status: call.status,
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
      calls: mappedCalls,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

module.exports = router;

