const express = require('express');
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('./auth');
const { query, isDatabaseAvailable } = require('../config/database');
const RecommendationEngine = require('../services/RecommendationEngine');
const router = express.Router();

// Initialize recommendation engine
const recommendationEngine = new RecommendationEngine();

// Mock profiles for when database is unavailable
const mockProfiles = [
  {
    id: 'mock-1',
    username: 'sarah_professional',
    profile_data: {
      firstName: 'Sarah',
      lastName: 'Johnson',
      age: 28,
      bio: 'Professional escort with 5+ years experience.',
      location: { city: 'Lagos', country: 'Nigeria' },
      languages: ['English', 'Yoruba'],
      basePrice: 250
    },
    verification_tier: 3,
    reputation_score: 95,
    is_subscribed: true,
    subscription_tier: 'premium',
    created_at: new Date().toISOString(),
    last_active: new Date().toISOString()
  },
  {
    id: 'mock-2',
    username: 'grace_elegant',
    profile_data: {
      firstName: 'Grace',
      lastName: 'Williams',
      age: 25,
      bio: 'Elegant companion for discerning clients.',
      location: { city: 'Accra', country: 'Ghana' },
      languages: ['English', 'Twi'],
      basePrice: 400
    },
    verification_tier: 2,
    reputation_score: 88,
    is_subscribed: true,
    subscription_tier: 'elite',
    created_at: new Date().toISOString(),
    last_active: new Date().toISOString()
  }
];

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const userResult = await query(`
      SELECT 
        id, username, email, verification_tier, 
        reputation_score, profile_data, 
        is_subscribed, subscription_tier, subscription_expires_at,
        created_at, last_active
      FROM users 
      WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    
    res.json({
      user: user
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get profile',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/users/me
 * @desc    Get current user profile (alias for /profile)
 * @access  Private
 */
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const userResult = await query(`
      SELECT 
        id, username, email, verification_tier, 
        reputation_score, profile_data, 
        is_subscribed, subscription_tier, subscription_expires_at,
        created_at, last_active
      FROM users 
      WHERE id = $1
    `, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    
    res.json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error('Get profile (me) error:', error);
    res.status(500).json({
      error: 'Failed to get profile',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   PUT /api/users/me
 * @desc    Update current user profile (alias for PUT /profile)
 * @access  Private
 */
router.put('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { profile_data } = req.body;

    // Update user profile - merge with existing data
    const updateResult = await query(`
      UPDATE users 
      SET profile_data = COALESCE(profile_data, '{}'::jsonb) || $1::jsonb,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, username, email, verification_tier, 
               reputation_score, profile_data, is_subscribed, subscription_tier, subscription_expires_at
    `, [JSON.stringify(profile_data || {}), userId]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Update profile (me) error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   PUT /api/users/profile
 * @desc    Update user profile
 * @access  Private
 */
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { profile_data } = req.body;

    // Update user profile
    const updateResult = await query(`
      UPDATE users 
      SET profile_data = COALESCE(profile_data, '{}') || $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, username, email, verification_tier, 
               reputation_score, profile_data, is_subscribed, subscription_tier, subscription_expires_at
    `, [JSON.stringify(profile_data || {}), userId]);

    res.json({
      message: 'Profile updated successfully',
      user: updateResult.rows[0]
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/users/profiles
 * @desc    Get recommended user profiles with advanced TikTok-style algorithm
 * @access  Private - Requires Authentication AND Active Subscription
 * 
 * ALGORITHM FEATURES:
 * 1. Geolocation-based proximity ranking (closest first)
 * 2. Quality scoring (verification, reviews, success rate)
 * 3. User preference learning from browsing history
 * 4. Engagement scoring (response rate, booking completion)
 * 5. Freshness boost for new/recently active profiles
 * 6. Diversity injection to prevent filter bubbles
 * 7. Real-time online status priority
 */
router.get('/profiles', async (req, res) => {
  try {
    // ============================================
    // AUTHENTICATION & SUBSCRIPTION CHECK
    // ============================================
    const authHeader = req.headers.authorization;
    let currentUserId = null;
    let currentUser = null;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        message: 'Please login to browse profiles'
      });
    }

    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      currentUserId = decoded.userId;
      
      // Get user's subscription status from database
      const userResult = await query(`
        SELECT id, username, is_subscribed, subscription_tier, subscription_expires_at
        FROM users WHERE id = $1
      `, [currentUserId]);
      
      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'User not found',
          message: 'Please login again'
        });
      }
      
      currentUser = userResult.rows[0];
      
      // Check subscription status
      const isSubscribed = currentUser.is_subscribed && (
        !currentUser.subscription_expires_at || 
        new Date(currentUser.subscription_expires_at) > new Date()
      );
      
      if (!isSubscribed) {
        return res.status(403).json({
          success: false,
          error: 'Subscription required',
          message: 'Please subscribe to browse profiles',
          requiresSubscription: true
        });
      }
      
      console.log('🔒 Subscribed user browsing profiles:', currentUser.username);
      
    } catch (tokenError) {
      console.log('Invalid token:', tokenError.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
        message: 'Please login again'
      });
    }
    const {
      page = 1,
      limit = 20,
      country,
      city,
      minAge,
      maxAge,
      verificationTier,
      minTrustScore,
      maxTrustScore,
      category,
      minPrice,
      maxPrice,
      availability,
      filter, // Frontend filter type (all, nearby, online, verified, trending)
      search, // Search query
      // Location parameters for recommendation (support both naming conventions)
      lat,
      lng,
      userLat,
      userLng,
      userCity,
      userCountry
    } = req.query;

    // Use userLat/userLng if provided, otherwise fall back to lat/lng
    const latitude = userLat || lat;
    const longitude = userLng || lng;

    // Build user location from request
    let userLocation = null;
    if (latitude && longitude) {
      userLocation = {
        lat: parseFloat(latitude),
        lng: parseFloat(longitude),
        city: userCity || null,
        country: userCountry || null
      };
      console.log('📍 User location from coordinates:', userLocation);
    } else if (userCity || userCountry) {
      userLocation = {
        city: userCity,
        country: userCountry
      };
      console.log('📍 User location from city/country:', userLocation);
    }

    // Build filters
    const filters = {
      country: country || 'all',
      city: city || null,
      minAge: minAge ? parseInt(minAge) : 18,
      maxAge: maxAge ? parseInt(maxAge) : 60,
      verificationTier: verificationTier || null,
      category: category || 'all',
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      availability: availability || null,
      // Frontend filter modes
      filterMode: filter || 'all', // all, nearby, online, verified, trending
      searchQuery: search || null
    };

    // Use recommendation engine for advanced ranking
    const result = await recommendationEngine.getRecommendedProfiles({
      userId: currentUserId,
      userLocation,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      filters
    });

    // Transform profiles for frontend
    const enhancedProfiles = result.profiles.map(profile => ({
      id: profile.id,
      username: profile.username,
      email: profile.email,
      profile_data: profile.profile_data,
      verification_tier: profile.verification_tier,
      reputation_score: profile.reputation_score,
      is_subscribed: profile.is_subscribed,
      subscription_tier: profile.subscription_tier,
      created_at: profile.created_at,
      last_active: profile.last_active,
      // Recommendation data
      distance: profile.distance,
      isOnline: profile.isOnline,
      lastSeen: profile.lastSeen,
      recommendationScore: profile.recommendationScore,
      // Status indicators
      subscriptionStatus: profile.is_subscribed ? 'subscribed' : 'free',
      isPremium: profile.is_subscribed && (profile.subscription_tier === 'premium' || profile.subscription_tier === 'elite')
    }));

    res.json({
      success: true,
      users: enhancedProfiles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.total,
        pages: Math.ceil(result.total / parseInt(limit))
      },
      metadata: result.metadata,
      filters
    });
  } catch (error) {
    console.error('Get profiles error:', error);
    
    // Return mock data on database error
    if (error.message.includes('Connection') || error.message.includes('timeout') || error.message.includes('unavailable')) {
      return res.json({
        success: true,
        users: mockProfiles,
        pagination: { page: 1, limit: 20, total: mockProfiles.length, pages: 1 },
        metadata: { mockData: true, message: 'Database temporarily unavailable' }
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch profiles',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * @route   POST /api/users/track-activity
 * @desc    Track user activity for recommendation learning
 * @access  Private
 */
router.post('/track-activity', authMiddleware, async (req, res) => {
  try {
    const { actionType, actionData } = req.body;
    const userId = req.user.userId;

    await recommendationEngine.trackActivity(userId, actionType, actionData);

    res.json({ success: true });
  } catch (error) {
    console.error('Track activity error:', error);
    res.status(500).json({ error: 'Failed to track activity' });
  }
});

/**
 * @route   GET /api/users/:id
 * @desc    Get individual user profile by ID (public)
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Validate user ID - allow UUID format
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get user profile
    const result = await query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.profile_data,
        u.verification_tier,
        u.reputation_score,
        u.is_subscribed,
        u.subscription_tier,
        u.created_at,
        COALESCE(u.last_active, u.created_at) as last_active
      FROM users u
      WHERE u.id = $1 AND u.profile_data IS NOT NULL
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const user = result.rows[0];
    
    // Validate profile data
    if (!user.profile_data || !user.profile_data.firstName) {
      return res.status(404).json({ error: 'Profile data incomplete' });
    }

    res.json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch profile',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
