const express = require('express');
const { authMiddleware } = require('./auth');
const mongoose = require('mongoose');
const { Transaction, User, SugarAccessPayment } = require('../config/database');
const { getAccountType, isRolePairAllowed, SUGAR_TYPES } = require('../utils/accountTypeUtils');
const router = express.Router();
const SUGAR_BOOKING_VIEWERS = new Set(['provider']);

const hasActiveSugarBookingAccess = async (viewerId, sugarTargetType) => {
  if (!viewerId || !mongoose.Types.ObjectId.isValid(viewerId)) {
    return false;
  }

  const normalizedTargetType = String(sugarTargetType || '').toLowerCase();
  const requiredAccessTypes = normalizedTargetType === 'sugar_daddy'
    ? ['sugar_daddy', 'both']
    : ['sugar_mommy', 'both'];

  const activeAccess = await SugarAccessPayment.findOne({
    providerId: viewerId,
    paymentStatus: 'completed',
    accessType: { $in: requiredAccessTypes },
    accessExpiresAt: { $gt: new Date() }
  })
    .select('_id')
    .lean();

  return !!activeAccess;
};

/**
 * @route   GET /api/bookings
 * @desc    Get user's bookings (as client or provider)
 * @access  Private
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, page = 1, limit = 20 } = req.query;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;

    const filter = { $or: [{ client_id: new mongoose.Types.ObjectId(userId) }, { provider_id: new mongoose.Types.ObjectId(userId) }] };
    if (status) {
      filter.status = status;
    }

    const transactions = await Transaction.find(filter)
      .populate({ path: 'provider_id', select: 'username' })
      .populate({ path: 'client_id', select: 'username' })
      .populate({ path: 'service_id', select: 'title description location_data' })
      .sort({ created_at: -1 })
      .skip(offset)
      .limit(limitNum)
      .lean();

    // Transform to frontend format
    const bookings = transactions.map((transaction) => {
      const isClient = transaction.client_id?._id?.toString() === userId;
      const scheduled = transaction.scheduled_time ? new Date(transaction.scheduled_time) : null;
      return {
        id: transaction._id.toString(),
        service: transaction.service_id?.title || 'Service',
        provider: isClient
          ? (transaction.provider_id?.username || 'Provider')
          : (transaction.client_id?.username || 'Client'),
        date: scheduled ? scheduled.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        time: scheduled
          ? `${String(scheduled.getHours()).padStart(2, '0')}:${String(scheduled.getMinutes()).padStart(2, '0')}`
          : '00:00',
        price: Number(transaction.amount) || 0,
        location: transaction.service_id?.location_data?.city || 'Not specified',
        status: mapStatus(transaction.status),
        userRole: isClient ? 'client' : 'provider'
      };
    });

    const total = await Transaction.countDocuments(filter);

    res.json({
      success: true,
      bookings,
      count: bookings.length,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });

  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bookings',
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
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(providerId)) {
      return res.status(400).json({ success: false, error: 'Invalid user or provider ID' });
    }

    if (serviceId && !mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ success: false, error: 'Invalid service ID' });
    }

    if (String(userId) === String(providerId)) {
      return res.status(400).json({ success: false, error: 'Cannot create a booking with yourself' });
    }

    const [requesterUser, providerUser] = await Promise.all([
      User.findById(userId).select('accountType account_type profile_data profileData').lean(),
      User.findById(providerId).select('accountType account_type profile_data profileData').lean()
    ]);

    if (!requesterUser || !providerUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const requesterType = getAccountType(requesterUser) || 'client';
    const targetType = getAccountType(providerUser) || 'client';

    if (!isRolePairAllowed('booking', requesterType, targetType)) {
      return res.status(403).json({
        success: false,
        error: 'Booking not allowed for this account type pair',
        message: 'Booking not allowed for this account type pair',
        requesterAccountType: requesterType,
        targetAccountType: targetType
      });
    }

    if (SUGAR_TYPES.includes(targetType)) {
      if (!SUGAR_BOOKING_VIEWERS.has(requesterType)) {
        return res.status(403).json({
          success: false,
          error: 'Only provider accounts can book sugar profiles',
          requesterAccountType: requesterType,
          targetAccountType: targetType
        });
      }

      const hasSugarAccess = await hasActiveSugarBookingAccess(userId, targetType);
      if (!hasSugarAccess) {
        return res.status(403).json({
          success: false,
          error: 'Sugar access required',
          message: 'Active sugar access payment required to book this profile',
          requiresPayment: true,
          requiredAccessType: targetType,
          requesterAccountType: requesterType,
          targetAccountType: targetType
        });
      }
    }

    // Validate amount
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0 || parsedAmount > 10000000) {
      return res.status(400).json({ success: false, error: 'Amount must be between 0.01 and 10,000,000' });
    }

    // Get user's country for currency
    let currency = 'NGN';
    try {
      const userCountry = await req.countryManager?.getUserCountry(userId);
      if (userCountry?.success && userCountry?.country?.currency) {
        currency = userCountry.country.currency;
      }
    } catch (e) { /* use default */ }

    // Create transaction/booking
    const booking = await Transaction.create({
      client_id: new mongoose.Types.ObjectId(userId),
      provider_id: new mongoose.Types.ObjectId(providerId),
      service_id: serviceId ? new mongoose.Types.ObjectId(serviceId) : undefined,
      amount: parsedAmount,
      currency,
      status: 'pending',
      scheduled_time: scheduledTime ? new Date(scheduledTime) : undefined,
      metadata: { location, notes }
    });

    res.json({
      success: true,
      bookingId: booking._id.toString(),
      message: 'Booking created successfully'
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ success: false, error: 'Failed to create booking',
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
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid booking or user ID' });
    }

    // Verify user is part of this booking
    const booking = await Transaction.findOne({
      _id: id,
      $or: [{ client_id: new mongoose.Types.ObjectId(userId) }, { provider_id: new mongoose.Types.ObjectId(userId) }]
    });

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found' });
    }

    // Update status to cancelled
    booking.status = 'cancelled';
    await booking.save();

    res.json({
      success: true,
      message: 'Booking cancelled'
    });

  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel booking' });
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
