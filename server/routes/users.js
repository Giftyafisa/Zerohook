const express = require('express');
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('./auth');
const { query, isDatabaseAvailable } = require('../config/database');
const router = express.Router();

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
 * @desc    Get all user profiles for browsing (public) with advanced filtering and pagination
 * @access  Public
 */
router.get('/profiles', async (req, res) => {
  try {
    // Check if database is available - return mock data if not
    if (!isDatabaseAvailable()) {
      console.log('⚠️  Database unavailable, returning mock profiles');
      return res.json({
        success: true,
        users: mockProfiles, // Client expects 'users' not 'profiles'
        pagination: { page: 1, limit: 20, total: mockProfiles.length, pages: 1 },
        metadata: { mockData: true, message: 'Database temporarily unavailable' }
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
      availability
    } = req.query;

    // Get current user ID if authenticated (for filtering out own profile)
    const authHeader = req.headers.authorization;
    let currentUserId = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        currentUserId = decoded.userId;
        console.log('🔒 Filtering out profile for authenticated user:', currentUserId);
      } catch (tokenError) {
        // Token invalid, continue as unauthenticated user
        console.log('Invalid token in profiles request, continuing as unauthenticated');
      }
    }

    // ENHANCED: More lenient validation - only require basic identifying fields
    let whereClause = `WHERE u.profile_data IS NOT NULL 
      AND (u.profile_data ? 'firstName' OR u.profile_data ? 'username')
      AND u.profile_data ? 'age'`;
    
    const params = [];
    let paramIndex = 1;
    
    // Filter out current user if authenticated
    if (currentUserId) {
      whereClause += ` AND u.id != $${paramIndex++}`;
      params.push(currentUserId);
    }

    // Build dynamic filters
    if (country) {
      whereClause += ` AND (u.profile_data->'location'->>'country') = $${paramIndex++}`;
      params.push(country);
    }

    if (city) {
      whereClause += ` AND (u.profile_data->'location'->>'city') ILIKE $${paramIndex++}`;
      params.push(`%${city}%`);
    }

    if (minAge || maxAge) {
      if (minAge && maxAge) {
        whereClause += ` AND (u.profile_data->>'age')::int BETWEEN $${paramIndex++} AND $${paramIndex++}`;
        params.push(minAge, maxAge);
      } else if (minAge) {
        whereClause += ` AND (u.profile_data->>'age')::int >= $${paramIndex++}`;
        params.push(minAge);
      } else if (maxAge) {
        whereClause += ` AND (u.profile_data->>'age')::int <= $${paramIndex++}`;
        params.push(maxAge);
      }
    }

    if (verificationTier) {
      whereClause += ` AND u.verification_tier = $${paramIndex++}`;
      params.push(verificationTier);
    }

    if (minTrustScore || maxTrustScore) {
      if (minTrustScore && maxTrustScore) {
        whereClause += ` AND u.reputation_score BETWEEN $${paramIndex++} AND $${paramIndex++}`;
        params.push(minTrustScore, maxTrustScore);
      } else if (minTrustScore) {
        whereClause += ` AND u.reputation_score >= $${paramIndex++}`;
        params.push(minTrustScore);
      } else if (maxTrustScore) {
        whereClause += ` AND u.reputation_score <= $${paramIndex++}`;
        params.push(maxTrustScore);
      }
    }

    if (category) {
      whereClause += ` AND u.profile_data->'serviceCategories' ? $${paramIndex++}`;
      params.push(category);
    }

    if (minPrice || maxPrice) {
      if (minPrice && maxPrice) {
        whereClause += ` AND (u.profile_data->>'basePrice')::numeric BETWEEN $${paramIndex++} AND $${paramIndex++}`;
        params.push(minPrice, maxPrice);
      } else if (minPrice) {
        whereClause += ` AND (u.profile_data->>'basePrice')::numeric >= $${paramIndex++}`;
        params.push(minPrice);
      } else if (maxPrice) {
        whereClause += ` AND (u.profile_data->>'basePrice')::numeric <= $${paramIndex++}`;
        params.push(maxPrice);
      }
    }

    if (availability) {
      whereClause += ` AND u.profile_data->'availability' ? $${paramIndex++}`;
      params.push(availability);
    }

    const offset = (page - 1) * limit;
    params.push(limit, offset);

    // Get total count with filters
    const countResult = await query(`
      SELECT COUNT(*) FROM users u ${whereClause}
    `, params.slice(0, -2));
    
    const totalCount = parseInt(countResult.rows[0].count);

    // Get filtered results with enhanced validation
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
      ${whereClause}
      ORDER BY u.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `, params);

    // ENHANCED: More lenient validation to ensure basic data integrity
    const validProfiles = result.rows.filter(user => {
      const profileData = user.profile_data;
      return profileData && 
             (profileData.firstName || profileData.username) && 
             profileData.age;
    });

    // Add subscription status indicators for better user differentiation
    const enhancedProfiles = validProfiles.map(user => ({
      ...user,
      subscriptionStatus: user.is_subscribed ? 'subscribed' : 'free',
      subscriptionTier: user.subscription_tier || 'basic',
      isPremium: user.is_subscribed && (user.subscription_tier === 'premium' || user.subscription_tier === 'elite')
    }));

    res.json({
      success: true,
      users: enhancedProfiles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: enhancedProfiles.length,
        pages: Math.ceil(enhancedProfiles.length / limit)
      },
      filters: {
        country, city, minAge, maxAge, verificationTier,
        minTrustScore, maxTrustScore, category, minPrice, maxPrice, availability
      }
    });
  } catch (error) {
    console.error('Get profiles error:', error);
    
    // Return mock data on database error
    if (error.message.includes('Connection') || error.message.includes('timeout') || error.message.includes('unavailable')) {
      return res.json({
        success: true,
        users: mockProfiles, // Client expects 'users' not 'profiles'
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
