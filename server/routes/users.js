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
        reputation_score, profile_data, profile_visibility,
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
        reputation_score, profile_data, profile_visibility,
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
    const { profile_data, profile_visibility } = req.body;

    // Build the update query dynamically
    let updateFields = [];
    let params = [];
    let paramIndex = 1;

    // Update profile_data if provided
    if (profile_data) {
      updateFields.push(`profile_data = COALESCE(profile_data, '{}'::jsonb) || $${paramIndex}::jsonb`);
      params.push(JSON.stringify(profile_data));
      paramIndex++;
    }

    // Update profile_visibility if provided
    if (profile_visibility && ['public', 'authenticated'].includes(profile_visibility)) {
      updateFields.push(`profile_visibility = $${paramIndex}`);
      params.push(profile_visibility);
      paramIndex++;
    }

    // Always update timestamp
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add userId
    params.push(userId);

    // Update user profile
    const updateResult = await query(`
      UPDATE users 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, email, verification_tier, 
               reputation_score, profile_data, profile_visibility,
               is_subscribed, subscription_tier, subscription_expires_at
    `, params);

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
 * @access  Public (public profiles) / Private (all profiles for authenticated users)
 * 
 * VISIBILITY RULES:
 * - Unauthenticated users: See only 'public' profiles
 * - Authenticated users: See all profiles (public + authenticated-only)
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
    // OPTIONAL AUTHENTICATION CHECK
    // ============================================
    const authHeader = req.headers.authorization;
    let currentUserId = null;
    let currentUser = null;
    let isAuthenticated = false;
    
    // Try to authenticate if token provided (but don't require it)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        currentUserId = decoded.userId;
        isAuthenticated = true;
        
        // Get user info
        const userResult = await query(`
          SELECT id, username, is_subscribed, subscription_tier, subscription_expires_at
          FROM users WHERE id = $1
        `, [currentUserId]);
        
        if (userResult.rows.length > 0) {
          currentUser = userResult.rows[0];
          console.log('🔒 Authenticated user browsing profiles:', currentUser.username);
        }
      } catch (tokenError) {
        // Token invalid, treat as unauthenticated (don't fail)
        console.log('⚠️ Invalid token, showing public profiles only');
        isAuthenticated = false;
        currentUserId = null;
      }
    } else {
      console.log('👁️ Unauthenticated user browsing public profiles');
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

    // Use advanced location tracking service (injected from server)
    const locationService = req.locationTrackingService;
    
    // Get current user's profile data for fallback location
    let currentUserProfile = null;
    if (currentUserId) {
      try {
        const userResult = await query('SELECT profile_data FROM users WHERE id = $1', [currentUserId]);
        if (userResult.rows.length > 0) {
          currentUserProfile = userResult.rows[0].profile_data || {};
        }
      } catch (e) {
        console.log('Could not fetch user profile for location');
      }
    }
    
    // Use userLat/userLng if provided, otherwise fall back to lat/lng
    const latitude = userLat || lat;
    const longitude = userLng || lng;
    
    // Get user's IP address
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                      req.headers['x-real-ip'] ||
                      req.ip ||
                      req.connection?.remoteAddress;

    // Build user location using advanced tracking service with full fallback cascade
    let userLocation = null;
    try {
      userLocation = await locationService.getUserLocation({
        userId: currentUserId,
        providedCoords: (latitude && longitude) ? {
          lat: parseFloat(latitude),
          lng: parseFloat(longitude),
          city: userCity,
          country: userCountry
        } : null,
        userProfile: currentUserProfile,
        ipAddress: ipAddress,
        sessionId: req.sessionID || null
      });
      
      // Cache the location
      if (userLocation && currentUserId) {
        locationService.setCachedLocation(currentUserId, userLocation);
      }
    } catch (error) {
      console.error('⚠️ Location tracking error:', error.message);
      // Fallback to basic parsing
      if (latitude && longitude) {
        const parsedLat = parseFloat(latitude);
        const parsedLng = parseFloat(longitude);
        if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
          userLocation = {
            lat: parsedLat,
            lng: parsedLng,
            city: userCity || null,
            country: userCountry || null
          };
        }
      } else if (userCity || userCountry) {
        userLocation = {
          city: userCity,
          country: userCountry
        };
      }
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
      distanceEstimated: profile.distanceEstimated,
      distanceSource: profile.distanceSource,
      distanceConfidence: profile.distanceConfidence,
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
 * @desc    Get individual user profile by ID (visibility-aware)
 * @access  Public/Private depending on profile visibility setting
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Validate user ID - allow UUID format
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if requester is authenticated
    let isAuthenticated = false;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        jwt.verify(token, process.env.JWT_SECRET);
        isAuthenticated = true;
      } catch (tokenError) {
        // Token invalid, treat as unauthenticated
        isAuthenticated = false;
      }
    }

    // Get user profile with visibility check
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
        u.profile_visibility,
        u.created_at,
        COALESCE(u.last_active, u.created_at) as last_active
      FROM users u
      WHERE u.id = $1 AND u.profile_data IS NOT NULL
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    const user = result.rows[0];
    
    // Check profile visibility
    // If profile is 'authenticated' only, require authentication
    if (user.profile_visibility === 'authenticated' && !isAuthenticated) {
      return res.status(403).json({ 
        error: 'This profile is only visible to authenticated users',
        requiresAuth: true
      });
    }
    
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

/**
 * @route   POST /api/users/block/:userId
 * @desc    Block a user
 * @access  Private
 */
router.post('/block/:userId', authMiddleware, async (req, res) => {
  try {
    const blockerId = req.user.userId;
    const blockedId = req.params.userId;
    
    if (blockerId === blockedId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }
    
    // Check if already blocked
    const existingBlock = await query(`
      SELECT id FROM blocked_users 
      WHERE blocker_id = $1 AND blocked_id = $2
    `, [blockerId, blockedId]);
    
    if (existingBlock.rows.length > 0) {
      return res.json({ message: 'User already blocked' });
    }
    
    // Insert block record
    await query(`
      INSERT INTO blocked_users (blocker_id, blocked_id, created_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
    `, [blockerId, blockedId]);
    
    // Update any conversations to blocked status
    await query(`
      UPDATE conversations 
      SET status = 'blocked', updated_at = CURRENT_TIMESTAMP
      WHERE (participant1_id = $1 AND participant2_id = $2)
         OR (participant1_id = $2 AND participant2_id = $1)
    `, [blockerId, blockedId]);
    
    res.json({ 
      success: true,
      message: 'User blocked successfully' 
    });
    
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ 
      error: 'Failed to block user',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;
