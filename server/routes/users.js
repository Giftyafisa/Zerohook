const express = require('express');
const jwt = require('jsonwebtoken');
const { authMiddleware, optionalAuthMiddleware } = require('./auth');
const { User, BlockedUser, Conversation, SugarAccessPayment, isDatabaseAvailable } = require('../config/database');
const MongoRecommendationEngine = require('../services/MongoRecommendationEngine');
const router = express.Router();

// Environment-gated debug logger
const isDev = (process.env.NODE_ENV || 'development') === 'development';
const debugLog = isDev ? (...args) => console.log(...args) : () => {};

/**
 * Sanitize profile field values to enforce types, lengths, and safe ranges.
 * Keys are already whitelisted by ALLOWED_PROFILE_FIELDS; this validates VALUES.
 */
function sanitizeProfileValues(data) {
  if (!data || typeof data !== 'object') return {};
  const clean = {};

  // String fields with max lengths
  const stringFields = { firstName: 50, lastName: 50, bio: 2000, gender: 30,
    bodyType: 30, height: 20, ethnicity: 50, currency: 10 };
  for (const [key, maxLen] of Object.entries(stringFields)) {
    if (key in data) {
      if (typeof data[key] === 'string') {
        clean[key] = data[key].slice(0, maxLen);
      } // else: silently drop non-string value
    }
  }

  // Numeric fields with min/max
  if ('age' in data) {
    const age = parseInt(data.age, 10);
    if (!isNaN(age) && age >= 18 && age <= 120) clean.age = age;
  }
  if ('basePrice' in data) {
    const price = parseFloat(data.basePrice);
    if (!isNaN(price) && price >= 0 && price <= 999999) clean.basePrice = price;
  }

  // Date field
  if ('dateOfBirth' in data) {
    const d = new Date(data.dateOfBirth);
    if (!isNaN(d.getTime())) clean.dateOfBirth = d.toISOString();
  }

  // Array fields with max length
  const arrayFields = { photos: 20, services: 50, availability: 30,
    specializations: 20, languages: 20, interests: 30, gallery: 30 };
  for (const [key, maxItems] of Object.entries(arrayFields)) {
    if (key in data && Array.isArray(data[key])) {
      clean[key] = data[key].slice(0, maxItems);
    }
  }

  // Object fields (shallow — keep as-is but limit depth risk by only accepting plain objects)
  const objectFields = ['location', 'contactInfo', 'socialLinks', 'preferences'];
  for (const key of objectFields) {
    if (key in data && typeof data[key] === 'object' && data[key] !== null && !Array.isArray(data[key])) {
      // Stringify+parse to strip prototypes/functions, limit size
      const serialized = JSON.stringify(data[key]);
      if (serialized.length <= 5000) {
        clean[key] = JSON.parse(serialized);
      }
    }
  }

  // URL/path string fields
  const urlFields = ['profilePhoto', 'coverPhoto'];
  for (const key of urlFields) {
    if (key in data && typeof data[key] === 'string') {
      clean[key] = data[key].slice(0, 500);
    }
  }

  return clean;
}

// Initialize MongoDB-native engine with Uber/Bolt-style algorithm
const mongoRecommendationEngine = new MongoRecommendationEngine();

/**
 * @route   GET /api/users/profile
 * @desc    Get user profile
 * @access  Private
 */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId).select(
      'username email verification_tier verificationTier reputation_score reputationScore profile_data profileData profile_visibility profileVisibility is_subscribed isSubscribed subscription_tier subscriptionTier subscription_expires_at subscriptionExpiresAt created_at createdAt last_active lastActive'
    ).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Transform to match expected format - support both naming conventions
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      verification_tier: user.verification_tier || user.verificationTier || 0,
      verificationTier: user.verification_tier || user.verificationTier || 0,
      reputation_score: user.reputation_score || user.reputationScore || 0,
      reputationScore: user.reputation_score || user.reputationScore || 0,
      profile_data: user.profile_data || user.profileData || {},
      profileData: user.profile_data || user.profileData || {},
      profile_visibility: user.profile_visibility || user.profileVisibility || 'public',
      profileVisibility: user.profile_visibility || user.profileVisibility || 'public',
      is_subscribed: user.is_subscribed || user.isSubscribed || false,
      isSubscribed: user.is_subscribed || user.isSubscribed || false,
      subscription_tier: user.subscription_tier || user.subscriptionTier || 'free',
      subscriptionTier: user.subscription_tier || user.subscriptionTier || 'free',
      subscription_expires_at: user.subscription_expires_at || user.subscriptionExpiresAt,
      created_at: user.created_at || user.createdAt,
      last_active: user.last_active || user.lastActive
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
      'username email verification_tier verificationTier reputation_score reputationScore profile_data profileData profile_visibility profileVisibility is_subscribed isSubscribed subscription_tier subscriptionTier subscription_expires_at subscriptionExpiresAt created_at createdAt last_active lastActive'
    ).lean();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Transform to match expected format - support both naming conventions
    const userResponse = {
      id: user._id,
      username: user.username,
      email: user.email,
      verification_tier: user.verification_tier || user.verificationTier || 0,
      verificationTier: user.verification_tier || user.verificationTier || 0,
      reputation_score: user.reputation_score || user.reputationScore || 0,
      reputationScore: user.reputation_score || user.reputationScore || 0,
      profile_data: user.profile_data || user.profileData || {},
      profileData: user.profile_data || user.profileData || {},
      profile_visibility: user.profile_visibility || user.profileVisibility || 'public',
      profileVisibility: user.profile_visibility || user.profileVisibility || 'public',
      is_subscribed: user.is_subscribed || user.isSubscribed || false,
      isSubscribed: user.is_subscribed || user.isSubscribed || false,
      subscription_tier: user.subscription_tier || user.subscriptionTier || 'free',
      subscriptionTier: user.subscription_tier || user.subscriptionTier || 'free',
      subscription_expires_at: user.subscription_expires_at || user.subscriptionExpiresAt,
      created_at: user.created_at || user.createdAt,
      last_active: user.last_active || user.lastActive
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
    const { profile_data, profileData: frontendProfileData, profile_visibility } = req.body;
    const incomingData = profile_data || frontendProfileData;

    // Whitelist allowed profile_data fields to prevent privilege escalation
    const ALLOWED_PROFILE_FIELDS = [
      'firstName', 'lastName', 'bio', 'age', 'dateOfBirth', 'gender',
      'location', 'photos', 'services', 'availability', 'specializations',
      'languages', 'basePrice', 'currency', 'contactInfo', 'socialLinks',
      'preferences', 'bodyType', 'height', 'ethnicity', 'interests',
      'profilePhoto', 'coverPhoto', 'gallery'
    ];

    // Build the update object
    const updateObj = { updated_at: new Date() };

    // Update profile_data if provided (merge with existing, whitelist fields + validate values)
    if (incomingData) {
      const existingUser = await User.findById(userId).lean();
      if (existingUser) {
        const existingProfileData = existingUser.profile_data || existingUser.profileData || {};
        const whitelisted = {};
        for (const key of ALLOWED_PROFILE_FIELDS) {
          if (key in incomingData) whitelisted[key] = incomingData[key];
        }
        const sanitizedData = sanitizeProfileValues(whitelisted);
        updateObj.profile_data = { ...existingProfileData, ...sanitizedData };
      } else {
        const whitelisted = {};
        for (const key of ALLOWED_PROFILE_FIELDS) {
          if (key in incomingData) whitelisted[key] = incomingData[key];
        }
        updateObj.profile_data = sanitizeProfileValues(whitelisted);
      }
    }

    // Update profile_visibility if provided
    if (profile_visibility && ['public', 'authenticated'].includes(profile_visibility)) {
      updateObj.profile_visibility = profile_visibility;
    }

    // Update user profile
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateObj,
      { new: true }
    ).select('username email verification_tier reputation_score profile_data profile_visibility is_subscribed subscription_tier subscription_expires_at').lean();

    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Transform to match expected format - provide both naming conventions
    const userResponse = {
      id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      verification_tier: updatedUser.verification_tier || 0,
      verificationTier: updatedUser.verification_tier || 0,
      reputation_score: updatedUser.reputation_score || 0,
      reputationScore: updatedUser.reputation_score || 0,
      profile_data: updatedUser.profile_data || {},
      profileData: updatedUser.profile_data || {},
      profile_visibility: updatedUser.profile_visibility || 'public',
      profileVisibility: updatedUser.profile_visibility || 'public',
      is_subscribed: updatedUser.is_subscribed || false,
      isSubscribed: updatedUser.is_subscribed || false,
      subscription_tier: updatedUser.subscription_tier || 'free',
      subscriptionTier: updatedUser.subscription_tier || 'free',
      subscription_expires_at: updatedUser.subscription_expires_at
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
    const { profile_data, profileData: frontendProfileData } = req.body;
    const incomingData = profile_data || frontendProfileData || {};

    // Get existing user to merge profile data
    const existingUser = await User.findById(userId).lean();
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Merge existing profile_data with new data (support both naming conventions)
    // Apply whitelist to prevent privilege escalation
    const ALLOWED_PROFILE_FIELDS = [
      'firstName', 'lastName', 'bio', 'age', 'dateOfBirth', 'gender',
      'location', 'photos', 'services', 'availability', 'specializations',
      'languages', 'basePrice', 'currency', 'contactInfo', 'socialLinks',
      'preferences', 'bodyType', 'height', 'ethnicity', 'interests',
      'profilePhoto', 'coverPhoto', 'gallery'
    ];
    const existingProfileData = existingUser.profile_data || existingUser.profileData || {};
    const whitelisted = {};
    for (const key of ALLOWED_PROFILE_FIELDS) {
      if (key in incomingData) whitelisted[key] = incomingData[key];
    }
    const sanitizedData = sanitizeProfileValues(whitelisted);
    const mergedProfileData = { ...existingProfileData, ...sanitizedData };

    debugLog('📝 Profile update:', { userId, incoming: Object.keys(incomingData), merged: Object.keys(mergedProfileData) });

    // Update user profile - use snake_case for MongoDB
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        profile_data: mergedProfileData,
        updated_at: new Date()
      },
      { new: true }
    ).select('username email verification_tier reputation_score profile_data is_subscribed subscription_tier subscription_expires_at').lean();

    // Transform to match expected format - provide both naming conventions
    const userResponse = {
      id: updatedUser._id,
      username: updatedUser.username,
      email: updatedUser.email,
      verification_tier: updatedUser.verification_tier || 0,
      verificationTier: updatedUser.verification_tier || 0,
      reputation_score: updatedUser.reputation_score || 0,
      reputationScore: updatedUser.reputation_score || 0,
      profile_data: updatedUser.profile_data || {},
      profileData: updatedUser.profile_data || {},
      is_subscribed: updatedUser.is_subscribed || false,
      isSubscribed: updatedUser.is_subscribed || false,
      subscription_tier: updatedUser.subscription_tier || 'free',
      subscriptionTier: updatedUser.subscription_tier || 'free',
      subscription_expires_at: updatedUser.subscription_expires_at
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
 * @desc    Get recommended user profiles with UBER/BOLT-STYLE algorithm
 * @access  Public (public profiles) / Private (all profiles for authenticated users)
 * 
 * UBER/BOLT-STYLE ALGORITHM:
 * ===========================
 * Step 1: Filter to ONLY providers (accountType = 'provider') for clients
 * Step 2: Show providers in user's CURRENT COUNTRY first
 * Step 3: Within country, prioritize by PROXIMITY (closest first like Uber)
 * Step 4: Apply quality factors (ratings, verification, activity)
 * Step 5: When nearby providers are exhausted, expand to further ones
 * Step 6: If searching specific profile, NO location limits
 * 
 * USER TYPE ROUTING:
 * - client → sees ONLY providers
 * - provider → sees ONLY clients
 * - sugar_daddy/mommy → sees verified providers
 * - unauthenticated → sees public providers only
 */

// Shared handler for /profiles and /browse routes - MongoDB Native Implementation
const handleBrowseProfiles = async (req, res) => {
  try {
    debugLog('🚀 ProfileFeed API called - Using UBER/BOLT-STYLE Algorithm');
    
    // ============================================
    // STEP 1: AUTHENTICATION CHECK (via optionalAuthMiddleware)
    // ============================================
    let currentUserId = null;
    let currentUser = null;
    let currentUserDoc = null;
    let isAuthenticated = false;
    
    if (req.user) {
      currentUserId = req.user.userId;
      isAuthenticated = true;

      currentUserDoc = await User.findById(currentUserId).select('username is_subscribed isSubscribed subscription_tier subscriptionTier subscription_expires_at subscriptionExpiresAt profile_data profileData');
      
      if (currentUserDoc) {
        const profileData = currentUserDoc.profile_data || currentUserDoc.profileData || {};
        currentUser = {
          id: currentUserDoc._id,
          username: currentUserDoc.username,
          is_subscribed: currentUserDoc.is_subscribed || currentUserDoc.isSubscribed || false,
          subscription_tier: currentUserDoc.subscription_tier || currentUserDoc.subscriptionTier || 'free',
          subscription_expires_at: currentUserDoc.subscription_expires_at || currentUserDoc.subscriptionExpiresAt,
          accountType: profileData.accountType || 'client',
          location: profileData.location || null
        };
        debugLog(`🔒 Authenticated: ${currentUser.username} (${currentUser.accountType})`);
      }
    } else {
      debugLog('👁️ Unauthenticated user browsing public profiles');
    }

    // ============================================
    // STEP 2: PARSE REQUEST PARAMETERS
    // ============================================
    const {
      page = 1,
      limit = 20,
      country,
      city,
      minAge,
      maxAge,
      verificationTier,
      filter,
      search,
      sort = 'recommendation',
      lat,
      lng,
      // Frontend sends these parameter names - support both naming conventions
      userLat,
      userLng,
      userCity,
      userCountry,
      locationSource,
      locationConfidence,
      locationAccuracy
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);
    const offset = (pageNum - 1) * limitNum;

    // ============================================
    // STEP 3: DETECT USER LOCATION (UBER/BOLT-STYLE)
    // ============================================
    let userLocation = null;
    
    // Priority 1: Client-provided coordinates (GPS)
    // Support both naming conventions: lat/lng and userLat/userLng
    const providedLat = userLat ? parseFloat(userLat) : (lat ? parseFloat(lat) : null);
    const providedLng = userLng ? parseFloat(userLng) : (lng ? parseFloat(lng) : null);
    const providedCity = userCity || city || null;
    const providedCountry = userCountry || country || null;
    
    if (providedLat != null && providedLng != null && !isNaN(providedLat) && !isNaN(providedLng)) {
      userLocation = {
        lat: providedLat,
        lng: providedLng,
        city: providedCity,
        country: providedCountry,
        source: locationSource || 'gps',
        confidence: locationConfidence ? parseFloat(locationConfidence) : 1.0,
        accuracy: locationAccuracy ? parseFloat(locationAccuracy) : null
      };
      debugLog(`📍 Location from client GPS: ${providedLat.toFixed(4)}, ${providedLng.toFixed(4)} (${providedCity || 'unknown city'}, ${providedCountry || 'unknown country'})`);
    }
    
    // Priority 2: Use LocationTrackingService if available
    if (!userLocation && req.locationTrackingService) {
      try {
        const userProfileData = currentUserDoc ? (currentUserDoc.profile_data || currentUserDoc.profileData || {}) : null;
        const rawIp = req.headers['x-forwarded-for'] || req.ip || '';
        const ipAddress = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : req.ip;
        
        userLocation = await req.locationTrackingService.getUserLocation({
          userId: currentUserId,
          providedCoords: null,
          userProfile: userProfileData,
          ipAddress,
          sessionId: req.headers['x-session-id']
        });
        
        if (userLocation) {
          debugLog(`📍 Location from service: ${userLocation.city || 'Unknown'}, ${userLocation.country || 'Unknown'} (${userLocation.source || 'unknown'})`);
        }
      } catch (locError) {
        debugLog('⚠️ Location detection failed:', locError.message);
      }
    }
    
    // Priority 3: Use user's profile location
    if (!userLocation && currentUser?.location) {
      userLocation = {
        city: currentUser.location.city,
        country: currentUser.location.country,
        lat: currentUser.location.coordinates?.lat,
        lng: currentUser.location.coordinates?.lng,
        source: 'profile'
      };
      debugLog(`📍 Location from profile: ${userLocation.city || 'Unknown'}, ${userLocation.country || 'Unknown'}`);
    }
    
    // Priority 4: Use country filter if provided
    if (!userLocation && country && country !== 'all') {
      userLocation = { country, source: 'filter' };
      debugLog(`📍 Location from filter: ${country}`);
    }

    // ============================================
    // STEP 4: DETERMINE ACCOUNT TYPE FILTER
    // ============================================
    const viewerAccountType = currentUser?.accountType || 'client';
    let accountTypeFilter = 'provider'; // Default: show providers
    
    if (viewerAccountType === 'provider') {
      accountTypeFilter = 'client'; // Providers see clients
      debugLog('🔍 Provider viewing: showing CLIENTS');
    } else if (viewerAccountType === 'sugar_daddy' || viewerAccountType === 'sugar_mommy') {
      accountTypeFilter = 'provider'; // Sugar accounts see providers
      debugLog(`🔍 Sugar ${viewerAccountType} viewing: showing verified PROVIDERS`);
    } else {
      debugLog('🔍 Client/Anonymous viewing: showing PROVIDERS');
    }

    // ============================================
    // STEP 5: BUILD FILTERS FOR RECOMMENDATION ENGINE
    // ============================================
    const filters = {
      country: country && country !== 'all' ? country : null,
      city: city || null,
      minAge: minAge ? parseInt(minAge) : null,
      maxAge: maxAge ? parseInt(maxAge) : null,
      filterMode: filter, // 'all', 'nearby', 'online', 'verified', 'trending'
      searchQuery: search || null
    };

    // ============================================
    // STEP 6: USE MONGO RECOMMENDATION ENGINE (UBER/BOLT-STYLE)
    // ============================================
    let result;
    
    if (sort === 'recommendation' || sort === 'forYou' || !sort) {
      // Use the Uber/Bolt-style algorithm
      debugLog('🎯 Using UBER/BOLT-STYLE recommendation algorithm');
      
      result = await mongoRecommendationEngine.getAccountTypeAwareRecommendations({
        userId: currentUserId,
        viewerAccountType,
        userLocation,
        limit: limitNum,
        offset,
        filters,
        accountTypeFilter
      });
      
    } else {
      // Use simple MongoDB sort for non-recommendation sorts
      result = await getSimpleSortedProfiles({
        currentUserId,
        isAuthenticated,
        accountTypeFilter,
        filters,
        sort,
        limitNum,
        offset
      });
    }

    // ============================================
    // STEP 7: FORMAT RESPONSE
    // ============================================
    const enhancedProfiles = (result.profiles || []).map(profile => {
      const profileData = profile.profile_data || profile.profileData || {};
      const verificationTier = profile.verification_tier || profile.verificationTier || 0;
      const reputationScore = profile.reputation_score || profile.reputationScore || 0;
      const isSubscribed = profile.is_subscribed || profile.isSubscribed || false;
      const subscriptionTier = profile.subscription_tier || profile.subscriptionTier || 'free';

      return {
        id: profile._id || profile.id,
        username: profile.username,
        profile_data: profileData,
        profileData: profileData,
        verification_tier: verificationTier,
        verificationTier: verificationTier,
        reputation_score: reputationScore,
        reputationScore: reputationScore,
        trustScore: profile.trustScore || reputationScore || 75,
        is_subscribed: isSubscribed,
        isSubscribed: isSubscribed,
        subscription_tier: subscriptionTier,
        subscriptionTier: subscriptionTier,
        created_at: profile.created_at || profile.createdAt,
        createdAt: profile.created_at || profile.createdAt,
        last_active: profile.last_active || profile.lastActive,
        lastActive: profile.last_active || profile.lastActive,
        isOnline: profile.isOnline || profile.is_online || false,
        is_online: profile.isOnline || profile.is_online || false,
        subscriptionStatus: isSubscribed ? 'subscribed' : 'free',
        isPremium: isSubscribed && (subscriptionTier === 'premium' || subscriptionTier === 'elite'),
        // Uber/Bolt-style distance info
        distance: profile.distance,
        distanceEstimated: profile.distanceEstimated,
        sameCountry: profile.sameCountry,
        recommendationScore: profile.recommendationScore,
        lastSeen: profile.lastSeen,
        successRate: profile.successRate
      };
    });

    const totalPages = Math.ceil((result.total || 0) / limitNum);
    
    debugLog(`📊 Returning ${enhancedProfiles.length} profiles (page ${pageNum}/${totalPages})`);
    if (enhancedProfiles.length > 0 && enhancedProfiles[0].distance !== undefined) {
      debugLog(`   Top result: ${enhancedProfiles[0].username} - ${enhancedProfiles[0].distance?.toFixed(1) || '?'}km - Score: ${enhancedProfiles[0].recommendationScore || 'N/A'}`);
    }

    res.json({
      success: true,
      users: enhancedProfiles,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total || enhancedProfiles.length,
        pages: totalPages || 1
      },
      metadata: {
        authenticated: isAuthenticated,
        filterMode: filter || 'all',
        sortMode: sort,
        algorithm: 'uber_bolt_style_v1',
        userLocationDetected: !!userLocation,
        userCountry: userLocation?.country || null,
        ...(result.metadata || {})
      }
    });
    
  } catch (error) {
    console.error('❌ Get profiles error:', error);
    
    // Return 503 for connection errors in all environments
    if (error.message.includes('Connection') || error.message.includes('timeout') || error.message.includes('unavailable')) {
      return res.status(503).json({
        success: false,
        error: 'Profile service temporarily unavailable'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch profiles',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Helper function for simple sorted queries (non-recommendation)
 */
async function getSimpleSortedProfiles({ currentUserId, isAuthenticated, accountTypeFilter, filters, sort, limitNum, offset }) {
  const mongoose = require('mongoose');
  
  // Build MongoDB query
  const mongoQuery = {
    $or: [
      { 'profile_data.accountType': accountTypeFilter },
      { 'profileData.accountType': accountTypeFilter }
    ]
  };
  
  if (currentUserId) {
    mongoQuery._id = { $ne: new mongoose.Types.ObjectId(currentUserId) };
  }
  
  if (!isAuthenticated) {
    mongoQuery.$and = mongoQuery.$and || [];
    mongoQuery.$and.push({
      $or: [
        { profileVisibility: 'public' },
        { profileVisibility: { $exists: false } },
        { profile_visibility: 'public' },
        { profile_visibility: { $exists: false } }
      ]
    });
  }
  
  // Apply filters
  if (filters.country) {
    const escapedCountry = filters.country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    mongoQuery.$and = mongoQuery.$and || [];
    mongoQuery.$and.push({
      $or: [
        { 'profile_data.location.country': new RegExp(escapedCountry, 'i') },
        { 'profileData.location.country': new RegExp(escapedCountry, 'i') }
      ]
    });
  }
  
  if (filters.searchQuery) {
    const escapedSearch = filters.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    mongoQuery.$and = mongoQuery.$and || [];
    mongoQuery.$and.push({
      $or: [
        { username: new RegExp(escapedSearch, 'i') },
        { 'profile_data.firstName': new RegExp(escapedSearch, 'i') },
        { 'profileData.firstName': new RegExp(escapedSearch, 'i') }
      ]
    });
  }
  
  // Build sort
  let sortOptions = {};
  switch (sort) {
    case 'newest':
      sortOptions = { created_at: -1, createdAt: -1 };
      break;
    case 'rating':
      sortOptions = { reputation_score: -1, reputationScore: -1 };
      break;
    case 'online':
      sortOptions = { last_active: -1, lastActive: -1 };
      break;
    default:
      sortOptions = { last_active: -1, lastActive: -1 };
  }
  
  const [profiles, total] = await Promise.all([
    User.find(mongoQuery)
      .select('username verification_tier verificationTier reputation_score reputationScore profile_data profileData is_subscribed isSubscribed subscription_tier subscriptionTier created_at createdAt last_active lastActive')
      .sort(sortOptions)
      .skip(offset)
      .limit(limitNum)
      .lean(),
    User.countDocuments(mongoQuery)
  ]);
  
  return { profiles, total };
}

// Register both routes with the same handler — optionalAuth populates req.user without requiring login
router.get('/profiles', optionalAuthMiddleware, handleBrowseProfiles);
router.get('/browse', optionalAuthMiddleware, handleBrowseProfiles);

/**
 * @route   GET /api/users/search
 * @desc    Search profiles (alias for browse with search param for mobile clients)
 * @access  Public / Optional auth
 */
router.get('/search', optionalAuthMiddleware, (req, res, next) => {
  // Map ?q= to ?search= for backward compat with mobile clients
  if (req.query.q && !req.query.search) {
    req.query.search = req.query.q;
  }
  return handleBrowseProfiles(req, res, next);
});

/**
 * @route   POST /api/users/engagement
 * @desc    Track TikTok-style profile engagement for algorithm learning
 * @access  Semi-public (optional auth, rate-limited)
 */
router.post('/engagement', optionalAuthMiddleware, async (req, res) => {
  try {
    const {
      profileId,
      viewDuration,
      photoViews,
      scrollDepth,
      bioExpanded,
      bioReadTime,
      isReturnVisit,
      action, // 'view', 'contact', 'favorite', 'skip', 'exit'
      swipeDirection
    } = req.body;

    // Input validation
    if (!profileId || typeof profileId !== 'string' || profileId.length > 50) {
      return res.status(400).json({ error: 'Valid profileId is required' });
    }

    const VALID_ACTIONS = ['view', 'contact', 'favorite', 'skip', 'exit'];
    if (action && !VALID_ACTIONS.includes(action)) {
      return res.status(400).json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
    }

    // Sanitise numeric inputs
    const safeViewDuration = Math.min(Math.max(parseInt(viewDuration) || 0, 0), 3600000);
    const safePhotoViews  = Math.min(Math.max(parseInt(photoViews)  || 0, 0), 1000);
    const safeScrollDepth = Math.min(Math.max(parseInt(scrollDepth) || 0, 0), 100);
    const safeBioReadTime = Math.min(Math.max(parseInt(bioReadTime)  || 0, 0), 600000);

    // Get user ID from middleware (set by optionalAuthMiddleware)
    const userId = req.user?.userId || req.user?.id || null;

    // Use the TikTok engagement tracker if available
    if (req.tiktokEngagementTracker) {
      const result = await req.tiktokEngagementTracker.trackProfileEngagement({
        userId: userId || 'anonymous',
        sessionId: req.headers['x-session-id'] || `anon_${Date.now()}`,
        profileId,
        viewDuration: safeViewDuration,
        photoViews: safePhotoViews,
        scrollDepth: safeScrollDepth,
        bioExpanded: Boolean(bioExpanded),
        bioReadTime: safeBioReadTime,
        isReturnVisit: Boolean(isReturnVisit),
        action: action || 'view'
      });

      return res.json({ success: true, ...result });
    }

    // Fallback: Track with recommendation engine
    const actionData = {
      profileId,
      viewDuration: safeViewDuration,
      photoViews: safePhotoViews,
      scrollDepth: safeScrollDepth,
      bioExpanded: Boolean(bioExpanded),
      bioReadTime: safeBioReadTime,
      isReturnVisit: Boolean(isReturnVisit),
      action: action || 'view',
      swipeDirection,
      timestamp: new Date().toISOString()
    };

    if (userId) {
      await mongoRecommendationEngine.trackActivity(userId, 'profile_engagement', actionData);
    }

    res.json({ success: true, tracked: true });
  } catch (error) {
    console.error('Engagement tracking error:', error);
    res.status(500).json({ error: 'Failed to track engagement' });
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

    // Track with MongoDB-native recommendation engine
    await mongoRecommendationEngine.trackActivity(userId, actionType, actionData);

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
router.get('/:id', optionalAuthMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Validate user ID - must be a valid MongoDB ObjectId (24 hex chars)
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    // Check if it's a valid ObjectId format (24 hex characters)
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(userId)) {
      return res.status(400).json({ 
        error: 'Invalid user ID format',
        message: 'User ID must be a valid 24-character hex string'
      });
    }

    // Authentication already handled by optionalAuthMiddleware
    const isAuthenticated = !!req.user;

    // Get user profile - don't require profileData to exist
    const user = await User.findById(userId)
      .select('username profileData profile_data verificationTier verification_tier reputationScore reputation_score isSubscribed is_subscribed subscriptionTier subscription_tier profileVisibility profile_visibility createdAt lastActive accountType');

    if (!user) {
      debugLog(`[GET /:id] User not found for ID: ${userId}`);
      return res.status(404).json({ error: 'Profile not found' });
    }

    debugLog(`[GET /:id] Found user: ${user.username}, accountType: ${user.accountType}`);

    // Handle both camelCase and snake_case field names
    const rawProfileData = user.profileData || user.profile_data || {};
    // Sanitize: strip sensitive metadata that should never be exposed to clients
    const { registration_ip, registration_user_agent, registrationIp, registrationUserAgent, ip_address, ipAddress, ...profileData } = rawProfileData.toObject ? rawProfileData.toObject() : { ...rawProfileData };
    const verificationTier = user.verificationTier ?? user.verification_tier ?? 1;
    const reputationScore = user.reputationScore ?? user.reputation_score ?? 50;
    const isSubscribed = user.isSubscribed ?? user.is_subscribed ?? false;
    const subscriptionTier = user.subscriptionTier ?? user.subscription_tier ?? 'free';
    const profileVisibility = user.profileVisibility ?? user.profile_visibility ?? 'public';

    // Transform to expected format (send BOTH formats for compatibility)
    const userResponse = {
      id: user._id,
      username: user.username,
      accountType: user.accountType,
      // Snake case (for backward compat)
      profile_data: profileData,
      verification_tier: verificationTier,
      reputation_score: reputationScore,
      is_subscribed: isSubscribed,
      subscription_tier: subscriptionTier,
      profile_visibility: profileVisibility,
      created_at: user.createdAt,
      last_active: user.lastActive || user.createdAt,
      // CamelCase (for frontend)
      profileData: profileData,
      verificationTier: verificationTier,
      reputationScore: reputationScore,
      isSubscribed: isSubscribed,
      subscriptionTier: subscriptionTier,
      profileVisibility: profileVisibility,
      createdAt: user.createdAt,
      lastActive: user.lastActive || user.createdAt
    };
    
    // Check profile visibility
    // If profile is 'authenticated' only, require authentication
    if (profileVisibility === 'authenticated' && !isAuthenticated) {
      return res.status(403).json({ 
        error: 'This profile is only visible to authenticated users',
        requiresAuth: true
      });
    }
    
    // Don't require firstName - use username as fallback
    if (!profileData.firstName && !user.username) {
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
