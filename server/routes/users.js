const express = require('express');
const jwt = require('jsonwebtoken');
const { authMiddleware } = require('./auth');
const { User, BlockedUser, Conversation, SugarAccessPayment, isDatabaseAvailable } = require('../config/database');
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
    
    const user = await User.findById(userId).select(
      'username email verificationTier reputationScore profileData profileVisibility isSubscribed subscriptionTier subscriptionExpiresAt createdAt lastActive'
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Transform to match expected format
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      verification_tier: user.verificationTier,
      reputation_score: user.reputationScore,
      profile_data: user.profileData,
      profile_visibility: user.profileVisibility,
      is_subscribed: user.isSubscribed,
      subscription_tier: user.subscriptionTier,
      subscription_expires_at: user.subscriptionExpiresAt,
      created_at: user.createdAt,
      last_active: user.lastActive
    };
    
    res.json({
      user: userResponse
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
    
    const user = await User.findById(userId).select(
      'username email verificationTier reputationScore profileData profileVisibility isSubscribed subscriptionTier subscriptionExpiresAt createdAt lastActive'
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Transform to match expected format
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      verification_tier: user.verificationTier,
      reputation_score: user.reputationScore,
      profile_data: user.profileData,
      profile_visibility: user.profileVisibility,
      is_subscribed: user.isSubscribed,
      subscription_tier: user.subscriptionTier,
      subscription_expires_at: user.subscriptionExpiresAt,
      created_at: user.createdAt,
      last_active: user.lastActive
    };
    
    res.json({
      success: true,
      user: userResponse
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

    // Build the update object
    const updateObj = { updatedAt: new Date() };

    // Update profile_data if provided (merge with existing)
    if (profile_data) {
      const existingUser = await User.findById(userId);
      if (existingUser) {
        updateObj.profileData = { ...existingUser.profileData, ...profile_data };
      } else {
        updateObj.profileData = profile_data;
      }
    }

    // Update profile_visibility if provided
    if (profile_visibility && ['public', 'authenticated'].includes(profile_visibility)) {
      updateObj.profileVisibility = profile_visibility;
    }

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateObj,
      { new: true }
    ).select('username email verificationTier reputationScore profileData profileVisibility isSubscribed subscriptionTier subscriptionExpiresAt');

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Transform to match expected format
    const userResponse = {
      id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      verification_tier: updatedUser.verificationTier,
      reputation_score: updatedUser.reputationScore,
      profile_data: updatedUser.profileData,
      profile_visibility: updatedUser.profileVisibility,
      is_subscribed: updatedUser.isSubscribed,
      subscription_tier: updatedUser.subscriptionTier,
      subscription_expires_at: updatedUser.subscriptionExpiresAt
    };

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: userResponse
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

    // Get existing user to merge profile data
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Merge existing profile_data with new data
    const mergedProfileData = { ...existingUser.profileData, ...(profile_data || {}) };

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        profileData: mergedProfileData,
        updatedAt: new Date()
      },
      { new: true }
    ).select('username email verificationTier reputationScore profileData isSubscribed subscriptionTier subscriptionExpiresAt');

    // Transform to match expected format
    const userResponse = {
      id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      verification_tier: updatedUser.verificationTier,
      reputation_score: updatedUser.reputationScore,
      profile_data: updatedUser.profileData,
      is_subscribed: updatedUser.isSubscribed,
      subscription_tier: updatedUser.subscriptionTier,
      subscription_expires_at: updatedUser.subscriptionExpiresAt
    };

    res.json({
      message: 'Profile updated successfully',
      user: userResponse
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
        const currentUserDoc = await User.findById(currentUserId).select('username isSubscribed subscriptionTier subscriptionExpiresAt');
        
        if (currentUserDoc) {
          currentUser = {
            id: currentUserDoc._id,
            username: currentUserDoc.username,
            is_subscribed: currentUserDoc.isSubscribed,
            subscription_tier: currentUserDoc.subscriptionTier,
            subscription_expires_at: currentUserDoc.subscriptionExpiresAt
          };
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
        const userDoc = await User.findById(currentUserId).select('profileData');
        if (userDoc) {
          currentUserProfile = userDoc.profileData || {};
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

    // Use ACCOUNT-TYPE-AWARE recommendation engine for advanced ranking
    // This routes to the correct method based on user's accountType:
    // - sugar_daddy/sugar_mommy → getSugarRecommendations (verified providers, opposite sex, young)
    // - client → getRecommendedProfiles (all providers)
    // - provider → getRecommendedProfiles (all clients/providers for networking)
    const result = await recommendationEngine.getAccountTypeAwareRecommendations({
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
    const user = await User.findOne({
      _id: userId,
      profileData: { $exists: true, $ne: null }
    }).select('username email profileData verificationTier reputationScore isSubscribed subscriptionTier profileVisibility createdAt lastActive');

    if (!user) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Transform to expected format
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      profile_data: user.profileData,
      verification_tier: user.verificationTier,
      reputation_score: user.reputationScore,
      is_subscribed: user.isSubscribed,
      subscription_tier: user.subscriptionTier,
      profile_visibility: user.profileVisibility,
      created_at: user.createdAt,
      last_active: user.lastActive || user.createdAt
    };
    
    // Check profile visibility
    // If profile is 'authenticated' only, require authentication
    if (userResponse.profile_visibility === 'authenticated' && !isAuthenticated) {
      return res.status(403).json({ 
        error: 'This profile is only visible to authenticated users',
        requiresAuth: true
      });
    }
    
    // Validate profile data
    if (!userResponse.profile_data || !userResponse.profile_data.firstName) {
      return res.status(404).json({ error: 'Profile data incomplete' });
    }

    res.json({
      success: true,
      user: userResponse
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
    const existingBlock = await BlockedUser.findOne({
      blockerId,
      blockedId
    });
    
    if (existingBlock) {
      return res.json({ message: 'User already blocked' });
    }
    
    // Insert block record
    await BlockedUser.create({
      blockerId,
      blockedId
    });
    
    // Update any conversations to blocked status
    await Conversation.updateMany(
      {
        $or: [
          { participant1Id: blockerId, participant2Id: blockedId },
          { participant1Id: blockedId, participant2Id: blockerId }
        ]
      },
      { status: 'blocked', updatedAt: new Date() }
    );
    
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

// ============================================
// SUGAR ACCOUNT MANAGEMENT ROUTES
// ============================================

/**
 * @route   PUT /api/users/sugar-visibility
 * @desc    Toggle sugar account visibility to providers
 * @access  Private (Sugar Daddy/Mommy only)
 */
router.put('/sugar-visibility', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { visible } = req.body;

    // Get user's account type
    const userDoc = await User.findById(userId).select('profileData');

    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accountType = userDoc.profileData?.accountType;
    
    // Only sugar accounts can toggle visibility
    if (accountType !== 'sugar_daddy' && accountType !== 'sugar_mommy') {
      return res.status(403).json({ 
        error: 'Only Sugar Daddy/Mommy accounts can toggle visibility settings' 
      });
    }

    // Update the sugarSettings.visibleToProviders field
    const currentSugarSettings = userDoc.profileData?.sugarSettings || {};
    const updatedSugarSettings = { ...currentSugarSettings, visibleToProviders: visible };
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        'profileData.sugarSettings': updatedSugarSettings,
        updatedAt: new Date()
      },
      { new: true }
    ).select('username profileData');

    res.json({
      success: true,
      message: `Profile visibility ${visible ? 'enabled' : 'disabled'} for providers`,
      visibleToProviders: visible,
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        profile_data: updatedUser.profileData
      }
    });

  } catch (error) {
    console.error('Toggle sugar visibility error:', error);
    res.status(500).json({
      error: 'Failed to update visibility settings',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   PUT /api/users/sugar-preferences
 * @desc    Update sugar account preferences (age range, gender preference)
 * @access  Private (Sugar Daddy/Mommy only)
 */
router.put('/sugar-preferences', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { preferredAgeRange, preferredGender } = req.body;

    // Get user's account type
    const userDoc = await User.findById(userId).select('profileData');

    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accountType = userDoc.profileData?.accountType;
    
    // Only sugar accounts can update these preferences
    if (accountType !== 'sugar_daddy' && accountType !== 'sugar_mommy') {
      return res.status(403).json({ 
        error: 'Only Sugar Daddy/Mommy accounts can update these preferences' 
      });
    }

    // Build the update object
    const currentProfileData = userDoc.profileData || {};
    const currentSugarSettings = currentProfileData.sugarSettings || {};
    
    const updatedSugarSettings = {
      ...currentSugarSettings,
      ...(preferredAgeRange && { preferredAgeRange }),
      ...(preferredGender && { preferredGender })
    };

    // Update the sugarSettings
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        'profileData.sugarSettings': updatedSugarSettings,
        updatedAt: new Date()
      },
      { new: true }
    ).select('username profileData');

    res.json({
      success: true,
      message: 'Sugar preferences updated successfully',
      sugarSettings: updatedSugarSettings,
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        profile_data: updatedUser.profileData
      }
    });

  } catch (error) {
    console.error('Update sugar preferences error:', error);
    res.status(500).json({
      error: 'Failed to update preferences',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/users/sugar-access-status
 * @desc    Check if a provider has access to view sugar profiles
 * @access  Private (Providers only)
 */
router.get('/sugar-access-status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's account type
    const userDoc = await User.findById(userId).select('profileData');

    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accountType = userDoc.profileData?.accountType;
    
    // Only providers need sugar access
    if (accountType !== 'provider') {
      return res.json({
        success: true,
        hasSugarDaddyAccess: accountType === 'sugar_daddy' || accountType === 'sugar_mommy' || accountType === 'client',
        hasSugarMommyAccess: accountType === 'sugar_daddy' || accountType === 'sugar_mommy' || accountType === 'client',
        message: 'Non-provider accounts do not need sugar access payments'
      });
    }

    // Check for active sugar access payments
    const accessRecords = await SugarAccessPayment.find({
      providerId: userId,
      paymentStatus: 'completed',
      accessExpiresAt: { $gt: new Date() }
    }).sort({ accessExpiresAt: -1 });

    const hasAccess = accessRecords.reduce((acc, record) => {
      if (record.accessType === 'sugar_daddy' || record.accessType === 'both') {
        acc.hasSugarDaddyAccess = true;
        acc.sugarDaddyExpiresAt = record.accessExpiresAt;
      }
      if (record.accessType === 'sugar_mommy' || record.accessType === 'both') {
        acc.hasSugarMommyAccess = true;
        acc.sugarMommyExpiresAt = record.accessExpiresAt;
      }
      return acc;
    }, { hasSugarDaddyAccess: false, hasSugarMommyAccess: false });

    res.json({
      success: true,
      ...hasAccess,
      accessRecords: accessRecords.map(r => ({
        access_type: r.accessType,
        access_starts_at: r.accessStartsAt,
        access_expires_at: r.accessExpiresAt,
        payment_status: r.paymentStatus
      }))
    });

  } catch (error) {
    console.error('Check sugar access status error:', error);
    res.status(500).json({
      error: 'Failed to check sugar access status',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/users/sugar-profiles
 * @desc    Get sugar profiles for providers with access
 * @access  Private (Providers with sugar access only)
 */
router.get('/sugar-profiles', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type = 'all', page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Get user's account type
    const userDoc = await User.findById(userId).select('profileData');

    if (!userDoc) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accountType = userDoc.profileData?.accountType;
    
    // Only providers can access this endpoint (they need to pay)
    if (accountType !== 'provider') {
      return res.status(403).json({ 
        error: 'Only providers can access sugar profiles' 
      });
    }

    // Check for active sugar access
    const accessRecords = await SugarAccessPayment.find({
      providerId: userId,
      paymentStatus: 'completed',
      accessExpiresAt: { $gt: new Date() }
    });

    if (accessRecords.length === 0) {
      return res.status(403).json({
        error: 'Sugar access required',
        message: 'You need to purchase sugar access to view these profiles',
        requiresPayment: true
      });
    }

    // Determine what access types the provider has
    const accessTypes = accessRecords.map(r => r.accessType);
    const hasDaddyAccess = accessTypes.includes('sugar_daddy') || accessTypes.includes('both');
    const hasMommyAccess = accessTypes.includes('sugar_mommy') || accessTypes.includes('both');

    // Build query based on access and requested type
    let accountTypeFilter = [];
    if ((type === 'all' || type === 'sugar_daddy') && hasDaddyAccess) {
      accountTypeFilter.push('sugar_daddy');
    }
    if ((type === 'all' || type === 'sugar_mommy') && hasMommyAccess) {
      accountTypeFilter.push('sugar_mommy');
    }

    if (accountTypeFilter.length === 0) {
      return res.status(403).json({
        error: 'No access to requested sugar profile type',
        hasSugarDaddyAccess: hasDaddyAccess,
        hasSugarMommyAccess: hasMommyAccess
      });
    }

    // Fetch sugar profiles that are visible to providers
    const profiles = await User.find({
      'profileData.accountType': { $in: accountTypeFilter },
      verificationTier: { $gte: 2 },
      'profileData.sugarSettings.visibleToProviders': true
    })
    .sort({ lastActive: -1 })
    .skip(parseInt(offset))
    .limit(parseInt(limit))
    .select('username profileData verificationTier reputationScore createdAt lastActive');

    // Get total count
    const total = await User.countDocuments({
      'profileData.accountType': { $in: accountTypeFilter },
      verificationTier: { $gte: 2 },
      'profileData.sugarSettings.visibleToProviders': true
    });

    res.json({
      success: true,
      profiles: profiles.map(p => ({
        id: p._id,
        username: p.username,
        profile_data: {
          ...p.profileData,
          registration_ip: undefined,
          registration_user_agent: undefined
        },
        verification_tier: p.verificationTier,
        reputation_score: p.reputationScore,
        created_at: p.createdAt,
        last_active: p.lastActive
      })),
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      hasSugarDaddyAccess: hasDaddyAccess,
      hasSugarMommyAccess: hasMommyAccess
    });

  } catch (error) {
    console.error('Get sugar profiles error:', error);
    res.status(500).json({
      error: 'Failed to get sugar profiles',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
