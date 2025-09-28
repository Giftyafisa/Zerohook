const express = require('express');
const { query } = require('../config/database');
const { authMiddleware } = require('./auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

/**
 * @route   POST /api/calls/request
 * @desc    Request a call with another user
 * @access  Private
 */
router.post('/request', authMiddleware, [
  body('targetUserId').isUUID().notEmpty(),
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

    // Check if target user exists and is online
    const targetUser = await query(`
      SELECT id, username, profile_data->>'firstName' as firstName, profile_data->>'lastName' as lastName
      FROM users WHERE id = $1
    `, [targetUserId]);

    if (targetUser.rows.length === 0) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Check if there's already an active call
    const activeCall = await query(`
      SELECT id FROM calls 
      WHERE (caller_id = $1 OR target_user_id = $1) 
      AND status IN ('calling', 'connected')
    `, [callerId]);

    if (activeCall.rows.length > 0) {
      return res.status(400).json({ error: 'You already have an active call' });
    }

    // Create call record
    const callResult = await query(`
      INSERT INTO calls (caller_id, target_user_id, type, status, created_at)
      VALUES ($1, $2, $3, 'calling', CURRENT_TIMESTAMP)
      RETURNING id, created_at
    `, [callerId, targetUserId, type]);

    const call = callResult.rows[0];

    // Emit call request via Socket.io
    req.io.to(`user_${targetUserId}`).emit('incoming_call', {
      id: call.id,
      callerId,
      callerName: req.user.username || req.user.profileData?.firstName || 'User',
      type,
      timestamp: call.created_at
    });

    res.json({
      success: true,
      callId: call.id,
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
  body('callId').isUUID().notEmpty()
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

    // Verify call exists and user is the target
    const call = await query(`
      SELECT id, caller_id, target_user_id, type, status
      FROM calls WHERE id = $1 AND target_user_id = $2 AND status = 'calling'
    `, [callId, userId]);

    if (call.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found or already processed' });
    }

    // Update call status
    await query(`
      UPDATE calls SET status = 'connected', connected_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [callId]);

    // Emit call accepted via Socket.io
    req.io.to(`user_${call.rows[0].caller_id}`).emit('call_accepted', {
      callId,
      targetUserId: userId,
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
  body('callId').isUUID().notEmpty()
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

    // Verify call exists and user is the target
    const call = await query(`
      SELECT id, caller_id, target_user_id, status
      FROM calls WHERE id = $1 AND target_user_id = $2 AND status = 'calling'
    `, [callId, userId]);

    if (call.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found or already processed' });
    }

    // Update call status
    await query(`
      UPDATE calls SET status = 'rejected', ended_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [callId]);

    // Emit call rejected via Socket.io
    req.io.to(`user_${call.rows[0].caller_id}`).emit('call_rejected', {
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
  body('callId').isUUID().notEmpty()
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

    // Verify call exists and user is a participant
    const call = await query(`
      SELECT id, caller_id, target_user_id, status
      FROM calls WHERE id = $1 AND (caller_id = $2 OR target_user_id = $2) AND status = 'connected'
    `, [callId, userId]);

    if (call.rows.length === 0) {
      return res.status(404).json({ error: 'Call not found or not active' });
    }

    // Update call status
    await query(`
      UPDATE calls SET status = 'ended', ended_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [callId]);

    // Emit call ended via Socket.io
    const otherUserId = call.rows[0].caller_id === userId ? 
      call.rows[0].target_user_id : call.rows[0].caller_id;
    
    req.io.to(`user_${otherUserId}`).emit('call_ended', {
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
    const offset = (page - 1) * limit;

    const calls = await query(`
      SELECT 
        c.id,
        c.type,
        c.status,
        c.created_at,
        c.connected_at,
        c.ended_at,
        c.duration,
        CASE 
          WHEN c.caller_id = $1 THEN c.target_user_id
          ELSE c.caller_id
        END as other_user_id,
        CASE 
          WHEN c.caller_id = $1 THEN u2.username
          ELSE u1.username
        END as other_username,
        CASE 
          WHEN c.caller_id = $1 THEN u2.profile_data->>'firstName'
          ELSE u1.profile_data->>'firstName'
        END as other_first_name,
        CASE 
          WHEN c.caller_id = $1 THEN u2.profile_data->>'lastName'
          ELSE u1.profile_data->>'lastName'
        END as other_last_name
      FROM calls c
      JOIN users u1 ON c.caller_id = u1.id
      JOIN users u2 ON c.target_user_id = u2.id
      WHERE c.caller_id = $1 OR c.target_user_id = $1
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const totalCalls = await query(`
      SELECT COUNT(*) as total
      FROM calls 
      WHERE caller_id = $1 OR target_user_id = $1
    `, [userId]);

    res.json({
      success: true,
      calls: calls.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(totalCalls.rows[0].total),
        pages: Math.ceil(totalCalls.rows[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Get call history error:', error);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

module.exports = router;

