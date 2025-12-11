const express = require('express');
const { authMiddleware } = require('./auth');
const router = express.Router();

/**
 * @route   GET /api/bookings
 * @desc    Get user's bookings (as client or provider)
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const { query } = require('../config/database');
    
    let whereClause = 'WHERE (t.client_id = $1 OR t.provider_id = $1)';
    let params = [userId];
    let paramIndex = 2;
    
    if (status) {
      whereClause += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    // Get bookings from transactions table
    const result = await query(`
      SELECT 
        t.id,
        t.service_id,
        t.client_id,
        t.provider_id,
        t.amount as price,
        t.status,
        t.scheduled_time,
        t.created_at,
        t.updated_at,
        COALESCE(s.title, 'Service') as service,
        COALESCE(s.description, '') as description,
        COALESCE(s.location_data->>'city', 'Not specified') as location,
        CASE 
          WHEN t.client_id = $1 THEN provider.username
          ELSE client.username
        END as other_party_name,
        CASE 
          WHEN t.client_id = $1 THEN 'client'
          ELSE 'provider'
        END as user_role,
        TO_CHAR(t.scheduled_time, 'YYYY-MM-DD') as date,
        TO_CHAR(t.scheduled_time, 'HH24:MI') as time
      FROM transactions t
      LEFT JOIN adult_services s ON t.service_id = s.id
      LEFT JOIN users client ON t.client_id = client.id
      LEFT JOIN users provider ON t.provider_id = provider.id
      ${whereClause}
      ORDER BY t.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    // Transform to frontend format
    const bookings = result.rows.map(row => ({
      id: row.id,
      service: row.service,
      provider: row.other_party_name || 'Provider',
      date: row.date || new Date().toISOString().split('T')[0],
      time: row.time || '00:00',
      price: parseFloat(row.price) || 0,
      location: row.location,
      status: mapStatus(row.status),
      userRole: row.user_role
    }));

    res.json({
      success: true,
      bookings,
      count: bookings.length
    });

  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      error: 'Failed to fetch bookings',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   POST /api/bookings
 * @desc    Create a new booking (creates escrow transaction)
 * @access  Private
 */
router.post('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { serviceId, providerId, amount, scheduledTime, location, notes } = req.body;
    const { query } = require('../config/database');

    // Create transaction/booking
    const result = await query(`
      INSERT INTO transactions (
        client_id, provider_id, service_id, amount, currency,
        status, scheduled_time, metadata, created_at
      ) VALUES ($1, $2, $3, $4, 'NGN', 'pending', $5, $6, NOW())
      RETURNING id
    `, [
      userId,
      providerId,
      serviceId,
      amount,
      scheduledTime,
      JSON.stringify({ location, notes })
    ]);

    res.json({
      success: true,
      bookingId: result.rows[0].id,
      message: 'Booking created successfully'
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      error: 'Failed to create booking',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   PUT /api/bookings/:id/cancel
 * @desc    Cancel a booking
 * @access  Private
 */
router.put('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { query } = require('../config/database');

    // Verify user is part of this booking
    const checkResult = await query(`
      SELECT * FROM transactions 
      WHERE id = $1 AND (client_id = $2 OR provider_id = $2)
    `, [id, userId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Update status to cancelled
    await query(`
      UPDATE transactions SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
    `, [id]);

    res.json({
      success: true,
      message: 'Booking cancelled'
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// Helper function to map transaction status to booking status
function mapStatus(status) {
  switch (status) {
    case 'pending':
    case 'held':
    case 'escrow_held':
      return 'upcoming';
    case 'in_progress':
      return 'pending';
    case 'completed':
    case 'released':
      return 'completed';
    case 'cancelled':
    case 'refunded':
      return 'cancelled';
    case 'disputed':
      return 'disputed';
    default:
      return 'pending';
  }
}

module.exports = router;
