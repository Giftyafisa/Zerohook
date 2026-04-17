const express = require('express');
const jwt = require('jsonwebtoken');
const { authMiddleware, optionalAuthMiddleware } = require('./auth');
const { User, BlockedUser, Conversation, SugarAccessPayment, isDatabaseAvailable } = require('../config/database');
const MongoRecommendationEngine = require('../services/MongoRecommendationEngine');
const {
  getAccountType,
  buildAccountTypeQuery,
  buildAccountTypeInQuery,
  buildPublicVisibilityFilter,
  buildSugarVisibleToProvidersFilter,
  isSugarProfileVisibleToProviders
} = require('../utils/accountTypeUtils');
const { safePagination } = require('../utils/routeHelpers');
const router = express.Router();

// Environment-gated debug logger
const isDev = (process.env.NODE_ENV || 'development') === 'development';
const debugLog = isDev ? (...args) => console.log(...args) : () => {};

function getLastSeenLabel(lastSeenDate) {
  if (!lastSeenDate) return null;
  const diffMs = Date.now() - new Date(lastSeenDate).getTime();
  if (diffMs < 0) return null;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 5) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 7)}w ago`;
}

function normalizeBrowseSort(sort, sortBy) {
  const requestedSort = String(sort || sortBy || 'recommendation').trim();

  switch (requestedSort) {
    case 'forYou':
    case 'distance':
      return 'recommendation';
    case 'trustScore':
    case 'popularity':
      return 'rating';
    case 'verificationTier':
      return 'verification';
    case 'recent':
      return 'newest';
    default:
      return requestedSort;
  }
}

function normalizeDiscoverySurface(surface) {
  const requestedSurface = String(surface || 'providers').trim().toLowerCase();
  if (requestedSurface === 'clients') return 'clients';
  if (requestedSurface === 'auto') return 'auto';
  return 'providers';
}

function readRuntimeFlag(req, flagName, fallback) {
  if (!req?.featureFlags || typeof req.featureFlags.isEnabled !== 'function') {
    return fallback;
  }
  return req.featureFlags.isEnabled(flagName, fallback);
}

// In-memory dedup cache for engagement events (prevents socket + REST double-counting)
let engagementDedup = null; // Lazy-init Map in engagement route

// ── Whitelist constants (shared by PUT /me and PUT /profile) ────────────
const ALLOWED_PROFILE_FIELDS = [
  'firstName', 'lastName', 'bio', 'age', 'dateOfBirth', 'gender',
  'location', 'photos', 'services', 'availability', 'specializations',
  'languages', 'basePrice', 'currency', 'contactInfo', 'socialLinks',
  'preferences', 'settings', 'bodyType', 'height', 'ethnicity', 'interests',
  'profilePhoto', 'coverPhoto', 'gallery', 'accountType'
];
const VALID_ACCOUNT_TYPES = ['client', 'provider', 'sugar_daddy', 'sugar_mommy'];
const SUGAR_ACCESS_ELIGIBLE_TYPES = new Set(['provider']);
const SUGAR_PROFILE_ACCOUNT_TYPES = new Set(['sugar_daddy', 'sugar_mommy']);
const SUGAR_ACCESS_REQUIREMENTS = Object.freeze({
  sugar_daddy: ['sugar_daddy', 'both'],
  sugar_mommy: ['sugar_mommy', 'both']
});
const VISITOR_FIELD_VISIBILITY_DEFAULTS = Object.freeze({
  showPhotos: true,
  showAge: true,
  showLocation: true,
  showContactInfo: false,
  showVerificationStatus: true,
  showTrustScore: true,
  showReviews: true,
  showPriceOnProfile: true
});

function resolveVisitorVisibilitySettings(profileData) {
  if (!profileData || typeof profileData !== 'object') {
    return VISITOR_FIELD_VISIBILITY_DEFAULTS;
  }

  const rawSettings = profileData.settings;
  if (!rawSettings || typeof rawSettings !== 'object' || Array.isArray(rawSettings)) {
    return VISITOR_FIELD_VISIBILITY_DEFAULTS;
  }

  return {
    ...VISITOR_FIELD_VISIBILITY_DEFAULTS,
    ...rawSettings
  };
}

function maskLocationForVisitors(location) {
  if (!location || typeof location !== 'object' || Array.isArray(location)) {
    return location;
  }

  const masked = { ...location };
  delete masked.coordinates;
  delete masked.geoPoint;
  delete masked.lat;
  delete masked.lng;
  delete masked.latitude;
  delete masked.longitude;
  delete masked.address;
  delete masked.street;
  delete masked.postalCode;

  return masked;
}

function applyVisitorProfileMask(payload) {
  if (!payload || typeof payload !== 'object') {
    return payload;
  }

  const profileData = payload.profile_data || payload.profileData;
  if (!profileData || typeof profileData !== 'object' || Array.isArray(profileData)) {
    return payload;
  }

  const visibility = resolveVisitorVisibilitySettings(profileData);
  const maskedProfileData = { ...profileData };

  // Never expose internal visibility preferences to visitors.
  delete maskedProfileData.settings;
  delete maskedProfileData.sugarSettings;

  if (!visibility.showPhotos) {
    delete maskedProfileData.photos;
    delete maskedProfileData.gallery;
    delete maskedProfileData.profilePhoto;
    delete maskedProfileData.coverPhoto;
    delete maskedProfileData.profilePicture;
    delete maskedProfileData.avatar;
    delete maskedProfileData.profile_image;
    delete maskedProfileData.profile_image_url;
  }

  if (!visibility.showAge) {
    delete maskedProfileData.age;
    delete maskedProfileData.dateOfBirth;
  }

  if (!visibility.showLocation) {
    delete maskedProfileData.location;
  } else if (maskedProfileData.location) {
    maskedProfileData.location = maskLocationForVisitors(maskedProfileData.location);
  }

  if (!visibility.showContactInfo) {
    delete maskedProfileData.contactInfo;
    delete maskedProfileData.socialLinks;
    delete maskedProfileData.email;
    delete maskedProfileData.phone;
    delete maskedProfileData.phoneNumber;
    delete maskedProfileData.whatsapp;
  }

  if (!visibility.showPriceOnProfile) {
    delete maskedProfileData.basePrice;
    delete maskedProfileData.currency;
    delete maskedProfileData.price;
    delete maskedProfileData.priceRange;
  }

  if (!visibility.showReviews) {
    delete maskedProfileData.reviews;
    delete maskedProfileData.reviewCount;
    delete maskedProfileData.rating;
    delete maskedProfileData.ratings;
    delete maskedProfileData.testimonials;
  }

  if (!visibility.showVerificationStatus) {
    delete maskedProfileData.verificationStatus;
    delete maskedProfileData.verificationBadge;
  }

  if (!visibility.showTrustScore) {
    delete maskedProfileData.trustScore;
    delete maskedProfileData.reputationScore;
  }

  const maskedPayload = {
    ...payload,
    profile_data: maskedProfileData,
    profileData: maskedProfileData
  };

  if (!visibility.showVerificationStatus) {
    maskedPayload.verification_tier = null;
    maskedPayload.verificationTier = null;
  }

  if (!visibility.showTrustScore) {
    maskedPayload.reputation_score = null;
    maskedPayload.reputationScore = null;
    maskedPayload.trustScore = null;
  }

  return maskedPayload;
}

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
  const objectFields = ['location', 'contactInfo', 'socialLinks', 'preferences', 'settings'];
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
      'username email verification_tier verificationTier reputation_score reputationScore profile_data profileData accountType account_type profile_visibility profileVisibility is_subscribed isSubscribed subscription_tier subscriptionTier subscription_expires_at subscriptionExpiresAt created_at createdAt last_active lastActive'
    ).lean();

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
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
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to get profile',
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
      'username email verification_tier verificationTier reputation_score reputationScore profile_data profileData accountType account_type profile_visibility profileVisibility is_subscribed isSubscribed subscription_tier subscriptionTier subscription_expires_at subscriptionExpiresAt created_at createdAt last_active lastActive'
    ).lean();

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
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
    res.status(500).json({ success: false, error: 'Failed to get profile',
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

    // Validate accountType if being changed
    if (incomingData?.accountType && !VALID_ACCOUNT_TYPES.includes(incomingData.accountType)) {
      return res.status(400).json({ success: false, error: 'Invalid account type', validTypes: VALID_ACCOUNT_TYPES });
    }

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

        // AUTO-GENERATE GeoJSON geoPoint for 2dsphere index (Uber-style proximity)
        const loc = updateObj.profile_data.location;
        if (loc) {
          const lat = parseFloat(loc.coordinates?.lat);
          const lng = parseFloat(loc.coordinates?.lng);
          if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            updateObj.profile_data.location.geoPoint = { type: 'Point', coordinates: [lng, lat] };
          }
        }
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
      return res.status(404).json({ success: false, error: 'User not found' });
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
    res.status(500).json({ success: false, error: 'Failed to update profile',
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
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Merge existing profile_data with new data (support both naming conventions)
    // Apply whitelist to prevent privilege escalation
    if (incomingData?.accountType && !VALID_ACCOUNT_TYPES.includes(incomingData.accountType)) {
      return res.status(400).json({ success: false, error: 'Invalid account type', validTypes: VALID_ACCOUNT_TYPES });
    }
    const existingProfileData = existingUser.profile_data || existingUser.profileData || {};
    const whitelisted = {};
    for (const key of ALLOWED_PROFILE_FIELDS) {
      if (key in incomingData) whitelisted[key] = incomingData[key];
    }
    const sanitizedData = sanitizeProfileValues(whitelisted);
    const mergedProfileData = { ...existingProfileData, ...sanitizedData };

    // AUTO-GENERATE GeoJSON geoPoint for 2dsphere index (Uber-style proximity)
    // If location has coordinates, ensure geoPoint is set for MongoDB geospatial queries
    const loc = mergedProfileData.location;
    if (loc) {
      const lat = parseFloat(loc.coordinates?.lat);
      const lng = parseFloat(loc.coordinates?.lng);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        mergedProfileData.location.geoPoint = { type: 'Point', coordinates: [lng, lat] };
      }
    }

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
      success: true,
      message: 'Profile updated successfully',
      user: userResponse
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile',
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
 * DISCOVERY SURFACES:
 * - default (/profiles): providers only (all viewers, including providers)
 * - provider client discovery (/client-discovery or ?surface=clients): clients only
 * - sugar_daddy/mommy: provider feed uses sugar preference-aware provider ranking
 * - unauthenticated: public providers only
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

      currentUserDoc = await User.findById(currentUserId).select('username is_subscribed isSubscribed subscription_tier subscriptionTier subscription_expires_at subscriptionExpiresAt profile_data profileData accountType account_type');
      
      if (currentUserDoc) {
        const profileData = currentUserDoc.profile_data || currentUserDoc.profileData || {};
        currentUser = {
          id: currentUserDoc._id,
          username: currentUserDoc.username,
          is_subscribed: currentUserDoc.is_subscribed || currentUserDoc.isSubscribed || false,
          subscription_tier: currentUserDoc.subscription_tier || currentUserDoc.subscriptionTier || 'free',
          subscription_expires_at: currentUserDoc.subscription_expires_at || currentUserDoc.subscriptionExpiresAt,
          accountType: getAccountType(currentUserDoc) || 'client',
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
      cursor: cursorParam, // Cursor-based pagination token
      surface,
      country,
      city,
      minAge,
      maxAge,
      verificationTier,
      filter,
      search,
      sort = 'recommendation',
      sortBy,
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

    const pg = safePagination(req.query, 50);
    const sortMode = normalizeBrowseSort(sort, sortBy);
    const runtimeFlags = {
      recommendationV2Enabled: readRuntimeFlag(req, 'recommendationV2Enabled', true),
      recommendationRollbackEnabled: readRuntimeFlag(req, 'recommendationRollbackEnabled', false),
      dynamicTrustFloorEnabled: readRuntimeFlag(req, 'dynamicTrustFloorEnabled', true),
      rankingReasonsEnabled: readRuntimeFlag(req, 'rankingReasonsEnabled', true)
    };
    const recommendationEngineEnabled = runtimeFlags.recommendationV2Enabled && !runtimeFlags.recommendationRollbackEnabled;

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

    // Priority 5: CountryManager IP fallback (especially useful for visitors)
    if (!userLocation && req.countryManager) {
      try {
        const rawIp = req.headers['x-forwarded-for'] || req.ip || '';
        const ipAddress = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : req.ip;
        const detectedCountry = await req.countryManager.detectUserCountry(ipAddress);

        if (detectedCountry?.success && detectedCountry?.country) {
          userLocation = {
            country: detectedCountry.country.name || detectedCountry.country.code || null,
            countryCode: detectedCountry.country.code || null,
            city: detectedCountry.ipInfo?.city || null,
            source: detectedCountry.method || 'ip_country_fallback',
            confidence: detectedCountry.confidence || 'medium'
          };
          debugLog(`📍 Location from CountryManager: ${userLocation.country || 'Unknown'} (${userLocation.source})`);
        }
      } catch (countryError) {
        debugLog('⚠️ CountryManager IP fallback failed:', countryError.message);
      }
    }

    // ============================================
    // STEP 4: DETERMINE ACCOUNT TYPE FILTER
    // ============================================
    // accountType can be at top-level OR inside profile_data depending on how it was saved
    const viewerAccountType = getAccountType(currentUser) || (isAuthenticated ? 'client' : 'anonymous');
    const requestedDiscoverySurface = normalizeDiscoverySurface(surface);
    const discoverySurface = requestedDiscoverySurface;
    let accountTypeFilter = 'provider'; // Default ProfileFeed surface: providers only

    if (discoverySurface === 'clients') {
      if (!isAuthenticated || viewerAccountType !== 'provider') {
        return res.status(403).json({
          success: false,
          error: 'Client discovery is only available to provider accounts',
          discoverySurface,
          accountType: viewerAccountType
        });
      }
      accountTypeFilter = 'client';
      debugLog('🔍 Provider client-discovery surface: showing CLIENTS');
    } else if (discoverySurface === 'auto') {
      if (viewerAccountType === 'provider') {
        accountTypeFilter = 'client';
        debugLog('🔍 Legacy auto surface (provider): showing CLIENTS');
      } else {
        accountTypeFilter = 'provider';
        debugLog('🔍 Legacy auto surface: showing PROVIDERS');
      }
    } else {
      accountTypeFilter = 'provider';
      debugLog(`🔍 ${viewerAccountType} on provider-feed surface: showing PROVIDERS`);
    }

    // ============================================
    // STEP 5: BUILD FILTERS FOR RECOMMENDATION ENGINE
    // ============================================
    const filters = {
      country: country && country !== 'all' ? country : null,
      city: city || null,
      minAge: minAge ? (parseInt(minAge, 10) || null) : null,
      maxAge: maxAge ? (parseInt(maxAge, 10) || null) : null,
      filterMode: filter, // 'all', 'nearby', 'online', 'verified', 'trending'
      searchQuery: search || null
    };

    // ============================================
    // STEP 6: USE MONGO RECOMMENDATION ENGINE (UBER/BOLT-STYLE)
    // ============================================
    let result;
    const recommendationRequested = sortMode === 'recommendation' || !sortMode;
    
    if (recommendationRequested && recommendationEngineEnabled) {
      // Use the Uber/Bolt-style algorithm
      debugLog('🎯 Using UBER/BOLT-STYLE recommendation algorithm');
      
      result = await mongoRecommendationEngine.getAccountTypeAwareRecommendations({
        userId: currentUserId,
        viewerAccountType,
        userLocation,
        limit: pg.limit,
        offset: pg.skip,
        cursor: cursorParam || null,
        filters,
        accountTypeFilter,
        featureFlags: {
          dynamicTrustFloorEnabled: runtimeFlags.dynamicTrustFloorEnabled,
          rankingReasonsEnabled: runtimeFlags.rankingReasonsEnabled
        }
      });
      
    } else {
      // Use simple MongoDB sort for non-recommendation sorts
      if (recommendationRequested && !recommendationEngineEnabled) {
        debugLog('🛟 Recommendation rollback switch active: using simple sort fallback');
      }

      result = await getSimpleSortedProfiles({
        currentUserId,
        isAuthenticated,
        accountTypeFilter,
        filters,
        sort: recommendationRequested ? 'online' : sortMode,
        limitNum: pg.limit,
        offset: pg.skip
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

      const baseProfilePayload = {
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
        scoreBreakdown: profile.scoreBreakdown || null,
        hasProfileImage: profile.hasProfileImage || false,
        lastSeen: profile.lastSeen,
        lastSeenLabel: profile.lastSeenLabel || profile.lastSeen || null,
        successRate: profile.successRate,
        rankingReasons: Array.isArray(profile.rankingReasons) ? profile.rankingReasons : [],
        exactSearchMatch: !!profile.exactSearchMatch,
        trustFloorApplied: profile.trustFloorApplied ?? null
      };

      if (!isAuthenticated) {
        return applyVisitorProfileMask(baseProfilePayload);
      }

      return baseProfilePayload;
    });

    const totalPages = Math.ceil((result.total || 0) / pg.limit);
    
    debugLog(`📊 Returning ${enhancedProfiles.length} profiles (page ${pg.page}/${totalPages})`);
    if (enhancedProfiles.length > 0 && enhancedProfiles[0].distance !== undefined) {
      debugLog(`   Top result: ${enhancedProfiles[0].username} - ${enhancedProfiles[0].distance?.toFixed(1) || '?'}km - Score: ${enhancedProfiles[0].recommendationScore || 'N/A'}`);
    }

    const responsePayload = {
      users: enhancedProfiles,
      pagination: {
        page: pg.page,
        limit: pg.limit,
        total: result.total || enhancedProfiles.length,
        pages: totalPages || 1,
        nextCursor: result.nextCursor || null
      },
      metadata: {
        authenticated: isAuthenticated,
        viewerAccountType,
        filterMode: filter || 'all',
        sortMode,
        discoverySurface,
        accountTypeFilter,
        algorithm: recommendationRequested
          ? (result?.metadata?.algorithm || (recommendationEngineEnabled ? 'uber_bolt_style_v1' : 'fallback_simple_sort_v1'))
          : `simple_sort_${sortMode || 'online'}_v1`,
        recommendationRollbackActive: runtimeFlags.recommendationRollbackEnabled,
        runtimeFlags,
        userLocationDetected: !!userLocation,
        userCountry: userLocation?.country || null,
        userLocationSource: userLocation?.source || null,
        userLocationConfidence: userLocation?.confidence ?? null,
        ...(result.metadata || {})
      }
    };

    res.json({
      success: true,
      message: 'Profiles fetched successfully',
      data: responsePayload,
      ...responsePayload
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
    
    res.status(500).json({ success: false, error: 'Failed to fetch profiles',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Helper function for simple sorted queries (non-recommendation)
 */
async function getSimpleSortedProfiles({ currentUserId, isAuthenticated, accountTypeFilter, filters, sort, limitNum, offset }) {
  const mongoose = require('mongoose');

  const queryParts = [buildAccountTypeQuery(accountTypeFilter || 'provider')];

  if (currentUserId && mongoose.Types.ObjectId.isValid(currentUserId)) {
    queryParts.push({ _id: { $ne: new mongoose.Types.ObjectId(currentUserId) } });
  }

  if (!isAuthenticated) {
    queryParts.push(buildPublicVisibilityFilter());
  }
  
  // Apply filters
  if (filters.country) {
    const escapedCountry = filters.country.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    queryParts.push({
      $or: [
        { 'profile_data.location.country': new RegExp(escapedCountry, 'i') },
        { 'profileData.location.country': new RegExp(escapedCountry, 'i') }
      ]
    });
  }
  
  if (filters.searchQuery) {
    const escapedSearch = filters.searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    queryParts.push({
      $or: [
        { username: new RegExp(escapedSearch, 'i') },
        { 'profile_data.firstName': new RegExp(escapedSearch, 'i') },
        { 'profileData.firstName': new RegExp(escapedSearch, 'i') },
        { 'profile_data.bio': new RegExp(escapedSearch, 'i') },
        { 'profileData.bio': new RegExp(escapedSearch, 'i') },
        { 'profile_data.location.city': new RegExp(escapedSearch, 'i') },
        { 'profileData.location.city': new RegExp(escapedSearch, 'i') }
      ]
    });
  }

  const mongoQuery = queryParts.length === 1 ? queryParts[0] : { $and: queryParts };
  
  // Build sort
  let sortOptions = {};
  switch (sort) {
    case 'newest':
      sortOptions = { created_at: -1, createdAt: -1 };
      break;
    case 'verification':
      sortOptions = { verification_tier: -1, verificationTier: -1, reputation_score: -1, reputationScore: -1 };
      break;
    case 'rating':
    case 'trustScore':
    case 'popularity':
      sortOptions = { reputation_score: -1, reputationScore: -1 };
      break;
    case 'online':
      sortOptions = { last_active: -1, lastActive: -1 };
      break;
    case 'price':
      sortOptions = { 'profile_data.basePrice': 1, 'profileData.basePrice': 1 };
      break;
    case 'priceHigh':
      sortOptions = { 'profile_data.basePrice': -1, 'profileData.basePrice': -1 };
      break;
    case 'age':
      sortOptions = { 'profile_data.age': 1, 'profileData.age': 1 };
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

  // Always prioritize profiles that have images, even in non-recommendation sorts.
  const withImage = [];
  const withoutImage = [];
  for (const p of profiles) {
    const pd = p.profile_data || p.profileData || {};
    const hasImage = !!(
      p.profile_image ||
      p.profile_image_url ||
      pd.profilePicture ||
      pd.avatar ||
      (Array.isArray(pd.photos) && pd.photos.length > 0)
    );
    if (hasImage) withImage.push(p);
    else withoutImage.push(p);
  }
  const prioritizedProfiles = [...withImage, ...withoutImage];
  
  return { profiles: prioritizedProfiles, total };
}

// Register both routes with the same handler — optionalAuth populates req.user without requiring login
router.get('/profiles', optionalAuthMiddleware, handleBrowseProfiles);
router.get('/browse', optionalAuthMiddleware, handleBrowseProfiles);

/**
 * @route   GET /api/users/client-discovery
 * @desc    Provider-only client discovery surface
 * @access  Private (Provider accounts)
 */
router.get('/client-discovery', authMiddleware, (req, res, next) => {
  req.query.surface = 'clients';
  return handleBrowseProfiles(req, res, next);
});

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
 * @route   GET /api/users/presence
 * @desc    Presence snapshot for user IDs (socket fallback + initial hydration)
 * @access  Optional auth; chat context requires auth and conversation linkage
 */
router.get('/presence', optionalAuthMiddleware, async (req, res) => {
  try {
    const parseIds = (value) => {
      if (Array.isArray(value)) {
        return value.flatMap((v) => String(v || '').split(',')).map((v) => v.trim()).filter(Boolean);
      }
      if (typeof value === 'string') {
        return value.split(',').map((v) => v.trim()).filter(Boolean);
      }
      return [];
    };

    const requestedUserIds = [...new Set([
      ...parseIds(req.query.ids),
      ...parseIds(req.query.userIds)
    ])].slice(0, 200);

    if (requestedUserIds.length === 0) {
      return res.json({ success: true, users: [], timestamp: new Date().toISOString() });
    }

    const context = String(req.query.context || 'browse');
    const isPublicContext = context === 'browse' || context === 'feed';
    const requesterId = req.user?.userId ? String(req.user.userId) : null;

    if (!isPublicContext && !requesterId) {
      return res.status(401).json({ success: false, error: 'Authentication required for chat presence' });
    }

    let allowedUserSet = null;
    if (!isPublicContext) {
      const allowedConversations = await Conversation.find({
        $or: [
          { participant1Id: requesterId, participant2Id: { $in: requestedUserIds } },
          { participant1Id: { $in: requestedUserIds }, participant2Id: requesterId }
        ],
        status: { $ne: 'deleted' }
      }).select('participant1Id participant2Id').lean();

      allowedUserSet = new Set();
      allowedConversations.forEach((conversation) => {
        const p1 = String(conversation.participant1Id || '');
        const p2 = String(conversation.participant2Id || '');
        if (p1 && p1 !== requesterId) allowedUserSet.add(p1);
        if (p2 && p2 !== requesterId) allowedUserSet.add(p2);
      });
    }

    const io = req.io;
    const statusInfo = requestedUserIds.map((targetUserId) => {
      if (allowedUserSet && !allowedUserSet.has(targetUserId)) {
        return { userId: targetUserId, isOnline: false, blocked: true };
      }
      const roomSize = io?.sockets?.adapter?.rooms?.get(`user_${targetUserId}`)?.size || 0;
      return { userId: targetUserId, isOnline: roomSize > 0, blocked: false };
    });

    const mongoose = require('mongoose');
    const offlineIds = statusInfo.filter((s) => !s.isOnline && !s.blocked).map((s) => s.userId);
    const validOfflineObjectIds = offlineIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    let lastActiveMap = {};

    if (validOfflineObjectIds.length > 0) {
      const offlineUsers = await User.find({ _id: { $in: validOfflineObjectIds } })
        .select('_id last_active lastActive')
        .lean();
      offlineUsers.forEach((u) => {
        lastActiveMap[String(u._id)] = u.last_active || u.lastActive || null;
      });
    }

    const users = statusInfo.map(({ userId, isOnline, blocked }) => {
      if (blocked) {
        return {
          userId,
          isOnline: false,
          status: 'offline',
          restricted: true,
          lastSeen: null,
          lastSeenLabel: null
        };
      }

      const lastSeen = isOnline ? null : (lastActiveMap[userId] || null);
      return {
        userId,
        isOnline,
        status: isOnline ? 'online' : 'offline',
        restricted: false,
        lastSeen,
        lastSeenLabel: isOnline ? null : getLastSeenLabel(lastSeen)
      };
    });

    return res.json({
      success: true,
      users,
      context,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Presence snapshot error:', error);
    return res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
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
      swipeDirection,
      eventId
    } = req.body;

    // Input validation
    if (!profileId || typeof profileId !== 'string' || profileId.length > 50) {
      return res.status(400).json({ success: false, error: 'Valid profileId is required' });
    }

    const VALID_ACTIONS = ['view', 'contact', 'favorite', 'skip', 'exit'];
    if (action && !VALID_ACTIONS.includes(action)) {
      return res.status(400).json({ success: false, error: `action must be one of: ${VALID_ACTIONS.join(', ')}` });
    }

    // Idempotent deduplication — if eventId was already processed, skip
    if (eventId && typeof eventId === 'string' && eventId.length <= 30) {
      if (!engagementDedup) {
        engagementDedup = new Map();
      }
      if (engagementDedup.has(eventId)) {
        return res.json({ success: true, deduplicated: true });
      }
      engagementDedup.set(eventId, Date.now());
      // Prune old entries every 100 inserts (keep last 5 minutes)
      if (engagementDedup.size % 100 === 0) {
        const cutoff = Date.now() - 5 * 60 * 1000;
        for (const [k, v] of engagementDedup) {
          if (v < cutoff) engagementDedup.delete(k);
        }
      }
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
    res.status(500).json({ success: false, error: 'Failed to track engagement' });
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
    res.status(500).json({ success: false, error: 'Failed to track activity' });
  }
});

/**
 * @route   GET /api/users/:id
 * @desc    Get individual user profile by ID (visibility-aware)
 * @access  Public/Private depending on profile visibility setting
 */
router.get('/:id([0-9a-fA-F]{24})', optionalAuthMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Validate user ID - must be a valid MongoDB ObjectId (24 hex chars)
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    
    // Check if it's a valid ObjectId format (24 hex characters)
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid user ID format',
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
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    debugLog(`[GET /:id] Found user: ${user.username}, accountType: ${user.accountType}`);

    const requesterId = req.user?.userId || req.user?.id || null;
    const isSelfRequest = requesterId && String(requesterId) === String(user._id);
    const targetAccountType = getAccountType(user) || 'client';
    const isSugarProfile = SUGAR_PROFILE_ACCOUNT_TYPES.has(targetAccountType);

    // Sugar profiles are privacy-first and only visible to paid provider viewers.
    if (isSugarProfile && !isSelfRequest) {
      if (!isAuthenticated) {
        return res.status(403).json({
          success: false,
          error: 'Sugar profiles require authenticated paid-viewer access',
          requiresAuth: true
        });
      }

      const requester = requesterId
        ? await User.findById(requesterId)
          .select('profile_data profileData accountType account_type')
          .lean()
        : null;

      const requesterAccountType = getAccountType(requester) || 'client';
      if (!SUGAR_ACCESS_ELIGIBLE_TYPES.has(requesterAccountType)) {
        return res.status(403).json({
          success: false,
          error: 'Only provider accounts with active sugar access can view sugar profiles'
        });
      }

      if (!isSugarProfileVisibleToProviders(user)) {
        return res.status(403).json({
          success: false,
          error: 'This sugar profile is currently hidden from paid viewers'
        });
      }

      const requiredAccessTypes = SUGAR_ACCESS_REQUIREMENTS[targetAccountType] || ['both'];
      const activeSugarAccess = await SugarAccessPayment.findOne({
        providerId: requesterId,
        paymentStatus: 'completed',
        accessType: { $in: requiredAccessTypes },
        accessExpiresAt: { $gt: new Date() }
      })
        .select('_id')
        .lean();

      if (!activeSugarAccess) {
        return res.status(403).json({
          success: false,
          error: 'Sugar access required to view this profile',
          requiresPayment: true
        });
      }
    }

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
      accountType: targetAccountType,
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
      return res.status(403).json({ success: false, error: 'This profile is only visible to authenticated users',
        requiresAuth: true
      });
    }
    
    // Don't require firstName - use username as fallback
    if (!profileData.firstName && !user.username) {
      return res.status(404).json({ success: false, error: 'Profile data incomplete' });
    }

    const responseUser = !isAuthenticated
      ? applyVisitorProfileMask(userResponse)
      : userResponse;

    res.json({
      success: true,
      user: responseUser
    });

  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch profile',
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
      return res.status(400).json({ success: false, error: 'Cannot block yourself' });
    }
    
    // Check if already blocked — use schema field names (blocker_id / blocked_id)
    const existingBlock = await BlockedUser.findOne({
      blocker_id: blockerId,
      blocked_id: blockedId
    });
    
    if (existingBlock) {
      return res.json({ success: true, message: 'User already blocked' });
    }
    
    // Insert block record — match schema fields
    await BlockedUser.create({
      blocker_id: blockerId,
      blocked_id: blockedId
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
    res.status(500).json({ success: false, error: 'Failed to block user',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ============================================
// SUGAR ACCOUNT MANAGEMENT ROUTES
// ============================================

/**
 * @route   PUT /api/users/sugar-visibility
 * @desc    Toggle sugar account visibility to paid viewers
 * @access  Private (Sugar Daddy/Mommy only)
 */
router.put('/sugar-visibility', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { visible } = req.body;

    if (typeof visible !== 'boolean') {
      return res.status(400).json({ success: false, error: 'visible must be a boolean value' });
    }

    // Get user's account type
    const userDoc = await User.findById(userId).select('profile_data profileData accountType account_type');

    if (!userDoc) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const profileData = userDoc.profile_data || userDoc.profileData || {};
    const accountType = getAccountType(userDoc) || 'client';
    
    // Only sugar accounts can toggle visibility
    if (accountType !== 'sugar_daddy' && accountType !== 'sugar_mommy') {
      return res.status(403).json({ success: false, error: 'Only Sugar Daddy/Mommy accounts can toggle visibility settings' 
      });
    }

    // Update the sugarSettings.visibleToProviders field
    const currentSugarSettings = profileData.sugarSettings || {};
    const updatedSugarSettings = { ...currentSugarSettings, visibleToProviders: visible };
    
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        'profile_data.sugarSettings': updatedSugarSettings,
        updated_at: new Date()
      },
      { new: true }
    ).select('username profile_data profileData');

    res.json({
      success: true,
      message: `Profile visibility ${visible ? 'enabled' : 'disabled'} for paid viewers`,
      visibleToProviders: visible,
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        profile_data: updatedUser.profile_data || updatedUser.profileData || {}
      }
    });

  } catch (error) {
    console.error('Toggle sugar visibility error:', error);
    res.status(500).json({ success: false, error: 'Failed to update visibility settings',
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
    const userDoc = await User.findById(userId).select('profile_data profileData accountType account_type');

    if (!userDoc) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const profileData = userDoc.profile_data || userDoc.profileData || {};
    const accountType = getAccountType(userDoc) || 'client';
    
    // Only sugar accounts can update these preferences
    if (accountType !== 'sugar_daddy' && accountType !== 'sugar_mommy') {
      return res.status(403).json({ success: false, error: 'Only Sugar Daddy/Mommy accounts can update these preferences' 
      });
    }

    if (preferredGender && !['male', 'female', 'any'].includes(String(preferredGender).toLowerCase())) {
      return res.status(400).json({ success: false, error: 'preferredGender must be one of: male, female, any' });
    }

    let normalizedPreferredAgeRange = null;
    if (preferredAgeRange) {
      const min = parseInt(preferredAgeRange.min, 10);
      const max = parseInt(preferredAgeRange.max, 10);

      if (Number.isNaN(min) || Number.isNaN(max) || min < 18 || max > 99 || min > max) {
        return res.status(400).json({
          success: false,
          error: 'preferredAgeRange must include valid min/max values between 18 and 99'
        });
      }

      normalizedPreferredAgeRange = { min, max };
    }

    // Build the update object
    const currentProfileData = profileData || {};
    const currentSugarSettings = currentProfileData.sugarSettings || {};
    
    const updatedSugarSettings = {
      ...currentSugarSettings,
      ...(normalizedPreferredAgeRange && { preferredAgeRange: normalizedPreferredAgeRange }),
      ...(preferredGender && { preferredGender: String(preferredGender).toLowerCase() })
    };

    // Update the sugarSettings
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { 
        'profile_data.sugarSettings': updatedSugarSettings,
        updated_at: new Date()
      },
      { new: true }
    ).select('username profile_data profileData');

    res.json({
      success: true,
      message: 'Sugar preferences updated successfully',
      sugarSettings: updatedSugarSettings,
      user: {
        id: updatedUser._id,
        username: updatedUser.username,
        profile_data: updatedUser.profile_data || updatedUser.profileData || {}
      }
    });

  } catch (error) {
    console.error('Update sugar preferences error:', error);
    res.status(500).json({ success: false, error: 'Failed to update preferences',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/users/sugar-access-status
 * @desc    Check if an eligible user has access to view sugar profiles
 * @access  Private
 */
router.get('/sugar-access-status', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user's account type
    const userDoc = await User.findById(userId).select('profile_data profileData accountType account_type');

    if (!userDoc) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const accountType = getAccountType(userDoc) || 'client';
    
    const isEligibleSugarViewer = SUGAR_ACCESS_ELIGIBLE_TYPES.has(accountType);

    if (!isEligibleSugarViewer) {
      return res.json({
        success: true,
        accountType,
        requiresPayment: false,
        hasSugarDaddyAccess: false,
        hasSugarMommyAccess: false,
        accessRecords: [],
        message: 'Only provider accounts can purchase sugar access'
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
      accountType,
      isEligibleSugarViewer,
      requiresPayment: true,
      ...hasAccess,
      accessRecords: accessRecords.map(r => ({
        access_type: r.accessType,
        billing_cycle: r.billingCycle || 'monthly',
        access_starts_at: r.accessStartsAt,
        access_expires_at: r.accessExpiresAt,
        payment_status: r.paymentStatus
      }))
    });

  } catch (error) {
    console.error('Check sugar access status error:', error);
    res.status(500).json({ success: false, error: 'Failed to check sugar access status',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

/**
 * @route   GET /api/users/sugar-profiles
 * @desc    Get sugar profiles for eligible paid viewers
 * @access  Private (Provider with sugar access)
 */
router.get('/sugar-profiles', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type = 'all' } = req.query;
    const pg = safePagination(req.query);

    // Get user's account type
    const userDoc = await User.findById(userId).select('profile_data profileData accountType account_type');

    if (!userDoc) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const accountType = getAccountType(userDoc) || 'client';
    const isEligibleSugarViewer = SUGAR_ACCESS_ELIGIBLE_TYPES.has(accountType);
    
    if (!isEligibleSugarViewer) {
      return res.status(403).json({ success: false, error: 'Only provider accounts can access sugar profiles' 
      });
    }

    // Check for active sugar access
    const accessRecords = await SugarAccessPayment.find({
      providerId: userId,
      paymentStatus: 'completed',
      accessExpiresAt: { $gt: new Date() }
    });

    if (accessRecords.length === 0) {
      return res.status(403).json({ success: false, error: 'Sugar access required',
        message: 'You need to purchase sugar access to view these profiles',
        requiresPayment: true,
        accountType,
        isEligibleSugarViewer
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
      return res.status(403).json({ success: false, error: 'No access to requested sugar profile type',
        hasSugarDaddyAccess: hasDaddyAccess,
        hasSugarMommyAccess: hasMommyAccess
      });
    }

    const sugarProfilesQuery = {
      $and: [
        buildAccountTypeInQuery(accountTypeFilter),
        buildSugarVisibleToProvidersFilter()
      ]
    };

    // Fetch sugar profiles that are visible to paid viewers
    const profiles = await User.find(sugarProfilesQuery)
    .sort({ last_active: -1 })
    .skip(pg.skip)
    .limit(pg.limit)
    .select('username profile_data profileData verification_tier verificationTier reputation_score reputationScore created_at createdAt last_active lastActive');

    // Get total count
    const total = await User.countDocuments(sugarProfilesQuery);

    res.json({
      success: true,
      accountType,
      isEligibleSugarViewer,
      profiles: profiles.map(p => ({
        id: p._id,
        username: p.username,
        profile_data: {
          ...(p.profile_data || p.profileData || {}),
          registration_ip: undefined,
          registration_user_agent: undefined
        },
        verification_tier: p.verification_tier || p.verificationTier,
        reputation_score: p.reputation_score || p.reputationScore,
        created_at: p.created_at || p.createdAt,
        last_active: p.last_active || p.lastActive
      })),
      total,
      page: pg.page,
      limit: pg.limit,
      hasSugarDaddyAccess: hasDaddyAccess,
      hasSugarMommyAccess: hasMommyAccess
    });

  } catch (error) {
    console.error('Get sugar profiles error:', error);
    res.status(500).json({ success: false, error: 'Failed to get sugar profiles',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
