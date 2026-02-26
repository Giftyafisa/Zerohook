/**
 * MongoRecommendationEngine - MongoDB-Native Profile Recommendation System
 * 
 * UBER/BOLT-STYLE ALGORITHM:
 * ===========================
 * Step 1: Filter to ONLY providers (accountType = 'provider')
 * Step 2: Show providers in user's CURRENT COUNTRY first
 * Step 3: Within country, prioritize by PROXIMITY (closest first like Uber)
 * Step 4: Apply quality factors (ratings, verification, activity)
 * Step 5: Penalize profiles with incomplete location data
 * Step 6: When nearby providers are exhausted, expand to further ones
 * Step 7: If searching specific profile, NO location limits
 * 
 * USER TYPE ROUTING:
 * - client → sees ONLY providers
 * - provider → sees ONLY clients
 * - sugar_daddy/mommy → sees verified providers (with paid access for providers)
 * - unauthenticated → sees public providers only
 * 
 * MIGRATED FROM PostgreSQL to MongoDB Mongoose
 */

const { User, UserActivityLog, SugarAccessPayment, Transaction, Conversation, Message, UserEngagementMetric } = require('../config/database');
const ProfileCompletenessService = require('./ProfileCompletenessService');
const LocationVerificationService = require('./LocationVerificationService');

// Environment-gated debug logger
const isDev = (process.env.NODE_ENV || 'development') === 'development';
const debugLog = isDev ? (...args) => console.log(...args) : () => {};

class MongoRecommendationEngine {
  constructor() {
    // Initialize helper services
    this.profileCompletenessService = new ProfileCompletenessService();
    this.locationVerificationService = new LocationVerificationService();
    
    // Uber/Bolt-style weights - Country + Distance are MOST important
    this.weights = {
      countryMatch: 0.30,    // Same country = priority (like Uber shows drivers in your country)
      distance: 0.25,        // Location proximity (closest first - like Uber)
      quality: 0.15,         // Verification + reputation (trust & rating)
      freshness: 0.10,       // Online/active status (current availability)
      engagement: 0.10,      // Response rate, success rate (reliability)
      beauty: 0.05,          // Profile completeness, photos (attractiveness)
      popularity: 0.05       // Reviews, bookings (demand)
    };
    
    // Elo rating configuration (Tinder-inspired)
    this.eloConfig = {
      k_factor: 32,
      initialRating: 1200,
      minRating: 400,
      maxRating: 3000
    };
    
    // Cache for user preferences (bounded LRU-style)
    this.userPreferencesCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    this.maxCacheSize = 5000; // Max cached user entries
  }

  // Escape special regex characters from user input
  escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * SERVER-AUTHORITATIVE ENGAGEMENT STATS
   * Batch-fetch real engagement data from Transaction, Conversation, and
   * UserEngagementMetric collections so the scoring function never trusts
   * user-editable profile_data fields for these metrics.
   *
   * Returns Map<string, { bookingSuccessRate, responseRate, viewCount, contactCount }>
   */
  async batchFetchEngagementStats(profileIds) {
    const statsMap = new Map();
    if (!profileIds || profileIds.length === 0) return statsMap;

    try {
      // 1. Booking success rate from Transaction collection
      //    completed / (completed + cancelled + disputed) per provider
      const [bookingStats, viewStats, contactStats] = await Promise.all([
        Transaction.aggregate([
          { $match: { provider_id: { $in: profileIds }, type: 'service' } },
          { $group: {
            _id: '$provider_id',
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
          }}
        ]),
        // 2. View counts from UserEngagementMetric
        UserEngagementMetric.find(
          { userId: { $in: profileIds } },
          { userId: 1, totalProfileViews: 1 }
        ).lean(),
        // 3. Contact count from Conversation (how many unique people initiated with this user)
        Conversation.aggregate([
          { $match: { $or: [
            { participant1Id: { $in: profileIds } },
            { participant2Id: { $in: profileIds } }
          ]}},
          { $project: {
            profileId: { $cond: [
              { $in: ['$participant1Id', profileIds] },
              '$participant1Id',
              '$participant2Id'
            ]}
          }},
          { $group: { _id: '$profileId', contactCount: { $sum: 1 } } }
        ])
      ]);

      // Build stats map from booking data
      for (const b of bookingStats) {
        const id = b._id.toString();
        const rate = b.total > 0 ? Math.round((b.completed / b.total) * 100) : 50;
        statsMap.set(id, { bookingSuccessRate: rate, responseRate: 50, viewCount: 0, contactCount: 0 });
      }

      // Merge view counts
      for (const v of viewStats) {
        const id = v.userId.toString();
        const entry = statsMap.get(id) || { bookingSuccessRate: 50, responseRate: 50, viewCount: 0, contactCount: 0 };
        entry.viewCount = v.totalProfileViews || 0;
        statsMap.set(id, entry);
      }

      // Merge contact counts
      for (const c of contactStats) {
        const id = c._id.toString();
        const entry = statsMap.get(id) || { bookingSuccessRate: 50, responseRate: 50, viewCount: 0, contactCount: 0 };
        entry.contactCount = c.contactCount || 0;
        statsMap.set(id, entry);
      }

      // 4. Response rate = % of conversations where this user sent at least one reply
      //    (only compute for users we already have in the statsMap or profileIds)
      const conversationCounts = await Conversation.aggregate([
        { $match: { $or: [
          { participant1Id: { $in: profileIds } },
          { participant2Id: { $in: profileIds } }
        ]}},
        { $lookup: {
          from: 'messages',
          let: { convId: '$_id', p1: '$participant1Id', p2: '$participant2Id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$conversationId', '$$convId'] } } },
            { $group: { _id: '$senderId' } }
          ],
          as: 'senders'
        }},
        { $project: {
          participant1Id: 1,
          participant2Id: 1,
          senderIds: { $map: { input: '$senders', as: 's', in: '$$s._id' } }
        }}
      ]);

      // For each profile, count conversations they were in vs conversations they replied to
      const responseData = new Map(); // profileId -> { total, replied }
      for (const conv of conversationCounts) {
        for (const pid of profileIds) {
          const pidStr = pid.toString();
          const isParticipant = conv.participant1Id.toString() === pidStr || conv.participant2Id.toString() === pidStr;
          if (!isParticipant) continue;
          const data = responseData.get(pidStr) || { total: 0, replied: 0 };
          data.total++;
          if (conv.senderIds.some(s => s.toString() === pidStr)) {
            data.replied++;
          }
          responseData.set(pidStr, data);
        }
      }

      for (const [id, data] of responseData) {
        const entry = statsMap.get(id) || { bookingSuccessRate: 50, responseRate: 50, viewCount: 0, contactCount: 0 };
        entry.responseRate = data.total > 0 ? Math.round((data.replied / data.total) * 100) : 50;
        statsMap.set(id, entry);
      }
    } catch (err) {
      debugLog('⚠️  batchFetchEngagementStats error (falling back to defaults):', err.message);
    }

    return statsMap;
  }

  /**
   * Get user's browsing history for preference learning (MongoDB version)
   */
  async getUserPreferences(userId) {
    const cached = this.userPreferencesCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const history = await UserActivityLog.find({
        userId: userId,
        actionType: { $in: ['profile_view', 'contact_click', 'favorite', 'search', 'booking'] },
        createdAt: { $gt: thirtyDaysAgo }
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

      const preferences = {
        preferredAgeRange: [18, 50],
        preferredLocations: [],
        preferredCategories: [],
        viewedProfiles: [],
        contactedProfiles: [],
        searchTerms: []
      };

      for (const activity of history) {
        const data = activity.actionData || {};
        
        switch (activity.actionType) {
          case 'profile_view':
            if (data.profileId) preferences.viewedProfiles.push(data.profileId);
            if (data.location) preferences.preferredLocations.push(data.location);
            if (data.category) preferences.preferredCategories.push(data.category);
            break;
          case 'contact_click':
            if (data.profileId) preferences.contactedProfiles.push(data.profileId);
            break;
          case 'search':
            if (data.term) preferences.searchTerms.push(data.term);
            break;
        }
      }

      // Get most common locations and categories
      preferences.preferredLocations = this.getMostCommon(preferences.preferredLocations, 5);
      preferences.preferredCategories = this.getMostCommon(preferences.preferredCategories, 5);

      // Evict oldest entries if cache exceeds max size
      if (this.userPreferencesCache.size >= this.maxCacheSize) {
        const firstKey = this.userPreferencesCache.keys().next().value;
        this.userPreferencesCache.delete(firstKey);
      }

      this.userPreferencesCache.set(userId, {
        data: preferences,
        timestamp: Date.now()
      });

      return preferences;
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return null;
    }
  }

  getMostCommon(arr, limit) {
    const counts = {};
    arr.forEach(item => {
      counts[item] = (counts[item] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([item]) => item);
  }

  /**
   * Calculate recommendation score for a profile
   * UBER/BOLT-STYLE: Country first, then CLOSEST FIRST, then quality factors
   * NEW: Uses fallback coordinates if profile has city but no GPS coordinates
   */
  calculateProfileScore(profile, userLocation, userPreferences = null, serverStats = null) {
    let scores = {
      countryMatch: 0,
      distance: 0,
      quality: 0,
      engagement: 0,
      freshness: 0,
      beauty: 0,
      popularity: 0,
      completeness: 0
    };

    const profileData = profile.profile_data || profile.profileData || {};
    const profileLocation = profileData.location || {};

    // PROFILE COMPLETENESS CHECK
    // Get completeness score and penalty for incomplete profiles
    const completeness = this.profileCompletenessService.calculateCompleteness(profile);
    const completenessPenalty = this.profileCompletenessService.getRankingPenalty(profile);
    profile.completenessScore = completeness.score;
    profile.completenessLevel = completeness.level;
    profile.canAppearInFeed = completeness.canAppearInFeed;
    scores.completeness = completeness.score;

    // FALLBACK COORDINATES - If profile has city but no GPS, use city coordinates
    let profileLat = profileLocation.coordinates?.lat;
    let profileLng = profileLocation.coordinates?.lng;
    let coordinateSource = 'gps';

    if ((!profileLat || !profileLng) && profileLocation.city && profileLocation.country) {
      // Try to get coordinates from city name using LocationVerificationService
      const fallbackCoords = this.locationVerificationService.assignFallbackCoordinates(profile);
      if (fallbackCoords.coordinates) {
        profileLat = fallbackCoords.coordinates.lat;
        profileLng = fallbackCoords.coordinates.lng;
        coordinateSource = fallbackCoords.source;
        profile.coordinatesFallback = true;
        profile.coordinateSource = coordinateSource;
      }
    }

    // DEBUG: Log location data for first few profiles
    if (!this._debugLogged) {
      this._debugLogged = 0;
    }
    if (this._debugLogged < 5) {
      debugLog(`🔍 DEBUG Profile ${profile.username}:`);
      debugLog(`   userLocation: lat=${userLocation?.lat}, lng=${userLocation?.lng}, country=${userLocation?.country}`);
      debugLog(`   profileLocation: city=${profileLocation.city}, country=${profileLocation.country}`);
      debugLog(`   profileCoords: lat=${profileLat}, lng=${profileLng} (source: ${coordinateSource})`);
      debugLog(`   completeness: ${completeness.score}% (${completeness.level}), penalty: ${completenessPenalty}`);
      this._debugLogged++;
    }

    // 1. COUNTRY MATCH SCORE (Critical - Uber only shows drivers in your country)
    if (userLocation && userLocation.country && profileLocation.country) {
      const userCountry = (userLocation.country || '').toLowerCase().trim();
      const providerCountry = (profileLocation.country || '').toLowerCase().trim();
      
      if (userCountry === providerCountry) {
        scores.countryMatch = 100;
        profile.sameCountry = true;
      } else {
        scores.countryMatch = 0;
        profile.sameCountry = false;
      }
    } else {
      scores.countryMatch = 50; // Unknown
      profile.sameCountry = null;
    }

    // 2. DISTANCE SCORE (UBER-STYLE: closer = MUCH higher score)
    // Now uses fallback coordinates if available
    if (userLocation && userLocation.lat && userLocation.lng && profileLat && profileLng) {
      const profLat = parseFloat(profileLat);
      const profLng = parseFloat(profileLng);
      
      if (!isNaN(profLat) && !isNaN(profLng) && 
          profLat >= -90 && profLat <= 90 && 
          profLng >= -180 && profLng <= 180) {
        
        const distance = this.calculateDistance(
          userLocation.lat,
          userLocation.lng,
          profLat,
          profLng
        );
        profile.distance = Math.round(distance * 10) / 10;
        profile.distanceEstimated = coordinateSource !== 'gps';
        
        // Uber-style scoring: Very close = very high score, drops off quickly
        if (distance <= 2) scores.distance = 100;
        else if (distance <= 5) scores.distance = 90;
        else if (distance <= 10) scores.distance = 80;
        else if (distance <= 20) scores.distance = 60;
        else if (distance <= 50) scores.distance = 40;
        else scores.distance = Math.max(0, 30 - (distance - 50) / 10);
      }
    } else if (userLocation && profileLocation.city) {
      // City-level fallback
      const sameCity = (userLocation.city || '').toLowerCase() === (profileLocation.city || '').toLowerCase();
      const sameCountry = (userLocation.country || '').toLowerCase() === (profileLocation.country || '').toLowerCase();

      if (sameCity) {
        scores.distance = 70;
        profile.distance = 5;
        profile.distanceEstimated = true;
      } else if (sameCountry) {
        scores.distance = 40;
        profile.distance = 50;
        profile.distanceEstimated = true;
      } else {
        scores.distance = 0;
        profile.distance = null;
        profile.distanceEstimated = true;
      }
    } else {
      profile.distance = null;
      profile.distanceEstimated = true;
    }

    // 3. QUALITY SCORE (verification + reputation)
    const verificationTier = profile.verification_tier || profile.verificationTier || 1;
    const reputationScore = profile.reputation_score || profile.reputationScore || 50;
    // Use server-authoritative booking success rate when available
    const profileId = (profile._id || profile.id || '').toString();
    const srvStats = serverStats ? serverStats.get(profileId) : null;
    const reliabilityScore = srvStats ? srvStats.bookingSuccessRate : (profileData.bookingSuccessRate || 70);
    scores.quality = (verificationTier * 25 * 0.35) + (reputationScore * 0.35) + (reliabilityScore * 0.30);

    // 4. ENGAGEMENT SCORE (response rate, booking success)
    // Use server-authoritative stats; fall back to clamped profile values
    const responseRate = srvStats
      ? Math.min(100, Math.max(0, srvStats.responseRate))
      : Math.min(100, Math.max(0, Number(profileData.responseRate) || 50));
    const bookingSuccess = srvStats
      ? Math.min(100, Math.max(0, srvStats.bookingSuccessRate))
      : Math.min(100, Math.max(0, Number(profileData.bookingSuccessRate) || 50));
    scores.engagement = (responseRate * 0.5) + (bookingSuccess * 0.5);

    // 5. FRESHNESS SCORE (recently active profiles rank higher)
    const lastActive = new Date(profile.last_active || profile.lastActive || profile.created_at || profile.createdAt);
    const hoursSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceActive < 1) {
      scores.freshness = 100;
      profile.isOnline = true;
      profile.lastSeen = 'Online now';
    } else if (hoursSinceActive < 6) {
      scores.freshness = 85;
      profile.isOnline = false;
      profile.lastSeen = 'Recently active';
    } else if (hoursSinceActive < 24) {
      scores.freshness = 70;
      profile.lastSeen = 'Today';
    } else if (hoursSinceActive < 72) {
      scores.freshness = 50;
      profile.lastSeen = `${Math.floor(hoursSinceActive / 24)} days ago`;
    } else {
      scores.freshness = Math.max(10, 50 - (hoursSinceActive / 24));
      profile.lastSeen = `${Math.floor(hoursSinceActive / 24)} days ago`;
    }

    // 6. BEAUTY/COMPLETENESS SCORE
    let beautyScore = 0;
    if (profileData.profilePicture || profileData.avatar) beautyScore += 35;
    if (profileData.photos && profileData.photos.length > 0) {
      beautyScore += Math.min(profileData.photos.length * 8, 25);
    }
    if (profileData.bio && profileData.bio.length > 50) beautyScore += 15;
    if (profileData.bio && profileData.bio.length > 150) beautyScore += 10;
    if (profileData.services && profileData.services.length > 0) beautyScore += 10;
    if (profile.is_subscribed || profile.isSubscribed) beautyScore += 5;
    scores.beauty = Math.min(100, beautyScore);

    // 7. POPULARITY SCORE (server-authoritative when available)
    const viewCount = srvStats ? srvStats.viewCount : (profileData.viewCount || 0);
    const contactCount = srvStats ? srvStats.contactCount : (profileData.contactCount || 0);
    scores.popularity = Math.min(viewCount / 5, 50) + Math.min(contactCount * 3, 50);

    // 8. NEW PROFILE BOOST (TikTok-style cold start solution)
    // New profiles get a boost to prevent them from being buried
    const createdAt = new Date(profile.created_at || profile.createdAt || Date.now());
    const ageInDays = (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000);
    let newProfileBoost = 1.0;
    if (ageInDays <= 14) {
      // Boost: starts at 1.5x for brand new profiles, linearly decays to 1.0x over 14 days
      newProfileBoost = 1.0 + 0.5 * Math.max(0, 1 - ageInDays / 14);
      profile.isNewProfile = true;
      profile.profileAgeDays = Math.round(ageInDays);
    }

    // 9. TIKTOK-STYLE ENGAGEMENT SCORE
    // This would integrate with TikTokEngagementTracker if available
    const tiktokEngagementScore = profileData.engagementScore || 50;
    scores.tiktokEngagement = tiktokEngagementScore;

    // Calculate weighted final score
    let finalScore = 
      (scores.countryMatch * this.weights.countryMatch) +
      (scores.distance * this.weights.distance) +
      (scores.quality * this.weights.quality) +
      (scores.engagement * this.weights.engagement) +
      (scores.freshness * this.weights.freshness) +
      (scores.beauty * this.weights.beauty) +
      (scores.popularity * this.weights.popularity);

    // Apply new profile boost (multiplicative)
    finalScore = finalScore * newProfileBoost;

    // Add TikTok engagement as bonus within existing weights (not additive)
    // Renormalize: use tiktokEngagement to further boost engagement factor
    finalScore = finalScore + (tiktokEngagementScore * 0.03);

    // 10. APPLY PROFILE COMPLETENESS PENALTY
    // Incomplete profiles get deprioritized in recommendations
    // This encourages users to complete their profiles
    finalScore = finalScore * (1 - completenessPenalty);
    
    // If profile has no location at all, apply additional penalty
    if (!profileLat && !profileLng && !profileLocation.city) {
      finalScore = finalScore * 0.5; // 50% additional penalty for no location data
      profile.noLocationPenalty = true;
    }

    profile.recommendationScore = Math.round(finalScore * 10) / 10;
    profile.scoreBreakdown = scores;
    profile.completenessPenalty = completenessPenalty > 0 ? Math.round(completenessPenalty * 100) : 0;
    profile.newProfileBoost = newProfileBoost > 1.0 ? Math.round(newProfileBoost * 100) / 100 : null;
    profile.successRate = profileData.bookingSuccessRate || 70;

    return profile;
  }

  /**
   * UBER/BOLT-STYLE SORTING
   * 1. Same country ALWAYS first
   * 2. Within country, CLOSEST first (like Uber shows closest drivers)
   * 3. Quality factors break ties at similar distances
   */
  sortUberBoltStyle(profiles, filterMode = 'forYou') {
    return profiles.sort((a, b) => {
      // NEARBY mode: distance is the sole sorting factor
      if (filterMode === 'nearby') {
        const distA = a.distance ?? 9999;
        const distB = b.distance ?? 9999;
        return distA - distB;
      }

      // TRENDING / TOP-RATED mode: reputation & score first
      if (filterMode === 'trending') {
        const scoreA = (a.trustScore || 0) + (a.recommendationScore || 0);
        const scoreB = (b.trustScore || 0) + (b.recommendationScore || 0);
        if (scoreA !== scoreB) return scoreB - scoreA;
        // Break ties by distance
        return (a.distance ?? 9999) - (b.distance ?? 9999);
      }

      // ONLINE mode: already filtered to active users; sort by last-active then distance
      if (filterMode === 'online') {
        const activeA = a.lastActive ? new Date(a.lastActive).getTime() : 0;
        const activeB = b.lastActive ? new Date(b.lastActive).getTime() : 0;
        if (activeA !== activeB) return activeB - activeA; // most recent first
        return (a.distance ?? 9999) - (b.distance ?? 9999);
      }

      // DEFAULT (forYou / all): Uber/Bolt-style
      // 1. Same country ALWAYS first
      if (a.sameCountry && !b.sameCountry) return -1;
      if (!a.sameCountry && b.sameCountry) return 1;

      // 2. DISTANCE IS PRIMARY (closest first - UBER style)
      const distA = a.distance ?? 9999;
      const distB = b.distance ?? 9999;
      
      if (Math.abs(distA - distB) > 1) { // If distance difference > 1km
        return distA - distB; // Closer comes first
      }

      // 3. At similar distances, use recommendation score (quality factors)
      return (b.recommendationScore || 0) - (a.recommendationScore || 0);
    });
  }

  /**
   * MAIN RECOMMENDATION METHOD - MongoDB Native
   * Implements Uber/Bolt-style: Country first, then distance, then quality
   * Supports both offset pagination and cursor pagination.
   */
  async getRecommendedProfiles(options = {}) {
    const {
      userId = null,
      userLocation = null,
      limit = 20,
      offset = 0,
      cursor = null, // Base64 cursor for cursor-based pagination
      filters = {},
      accountTypeFilter = 'provider' // Default: show providers
    } = options;

    try {
      debugLog('🔍 MongoRecommendationEngine.getRecommendedProfiles called');
      debugLog('   User location:', userLocation);
      debugLog('   Account type filter:', accountTypeFilter);
      debugLog('   Filters:', filters);

      // Build MongoDB query
      const mongoQuery = {
        $or: [
          { 'profile_data.accountType': accountTypeFilter },
          { 'profileData.accountType': accountTypeFilter }
        ]
      };

      // Exclude current user
      if (userId) {
        const mongoose = require('mongoose');
        mongoQuery._id = { $ne: new mongoose.Types.ObjectId(userId) };
      }

      // Apply country filter (UBER-STYLE: prioritize same country)
      if (filters.country && filters.country !== 'all') {
        const escapedCountry = this.escapeRegExp(filters.country);
        mongoQuery.$and = mongoQuery.$and || [];
        mongoQuery.$and.push({
          $or: [
            { 'profile_data.location.country': new RegExp(escapedCountry, 'i') },
            { 'profileData.location.country': new RegExp(escapedCountry, 'i') }
          ]
        });
      }

      // Apply city filter
      if (filters.city) {
        const escapedCity = this.escapeRegExp(filters.city);
        mongoQuery.$and = mongoQuery.$and || [];
        mongoQuery.$and.push({
          $or: [
            { 'profile_data.location.city': new RegExp(escapedCity, 'i') },
            { 'profileData.location.city': new RegExp(escapedCity, 'i') }
          ]
        });
      }

      // Apply verification filter
      if (filters.filterMode === 'verified') {
        mongoQuery.$and = mongoQuery.$and || [];
        mongoQuery.$and.push({
          $or: [
            { verification_tier: { $gte: 2 } },
            { verificationTier: { $gte: 2 } }
          ]
        });
      }

      // Apply online filter
      if (filters.filterMode === 'online') {
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        mongoQuery.$and = mongoQuery.$and || [];
        mongoQuery.$and.push({
          $or: [
            { last_active: { $gte: fifteenMinutesAgo } },
            { lastActive: { $gte: fifteenMinutesAgo } }
          ]
        });
      }

      // Apply nearby filter — only include profiles that have location data
      // so distance-based sorting can work meaningfully
      if (filters.filterMode === 'nearby') {
        mongoQuery.$and = mongoQuery.$and || [];
        mongoQuery.$and.push({
          $or: [
            { 'profile_data.location': { $exists: true, $ne: null } },
            { 'profileData.location': { $exists: true, $ne: null } }
          ]
        });
      }

      // Apply trending / top-rated filter — show highly-rated profiles
      if (filters.filterMode === 'trending') {
        mongoQuery.$and = mongoQuery.$and || [];
        mongoQuery.$and.push({
          $or: [
            { reputation_score: { $gte: 50 } },
            { reputationScore: { $gte: 50 } }
          ]
        });
      }

      // Apply search filter
      if (filters.searchQuery && filters.searchQuery.trim()) {
        const searchTerm = this.escapeRegExp(filters.searchQuery.trim());
        mongoQuery.$and = mongoQuery.$and || [];
        mongoQuery.$and.push({
          $or: [
            { username: new RegExp(searchTerm, 'i') },
            { 'profile_data.firstName': new RegExp(searchTerm, 'i') },
            { 'profileData.firstName': new RegExp(searchTerm, 'i') },
            { 'profile_data.bio': new RegExp(searchTerm, 'i') },
            { 'profileData.bio': new RegExp(searchTerm, 'i') }
          ]
        });
      }

      // Fetch profiles — cap deep pagination to prevent memory bloat.
      // For offsets beyond 500, clamp fetchLimit to offset + limit to avoid
      // pulling thousands of documents into memory for in-memory re-ranking.
      const MAX_FETCH_POOL = 500;
      const fetchLimit = offset < MAX_FETCH_POOL
        ? Math.max(offset + limit * 3, offset + 60)
        : offset + limit;
      const profiles = await User.find(mongoQuery)
        .select('username email verification_tier verificationTier reputation_score reputationScore profile_data profileData is_subscribed isSubscribed subscription_tier subscriptionTier created_at createdAt last_active lastActive')
        .sort({ last_active: -1, lastActive: -1 })
        .limit(fetchLimit)
        .lean();

      debugLog(`   Found ${profiles.length} raw profiles`);

      // Reset debug counter for each request
      this._debugLogged = 0;

      // Batch-fetch server-authoritative engagement stats
      const profileIds = profiles.map(p => p._id);
      const serverStats = await this.batchFetchEngagementStats(profileIds);

      // Normalize and calculate scores for each profile
      let scoredProfiles = profiles.map(profile => {
        const normalized = this.normalizeProfile(profile);
        return this.calculateProfileScore(normalized, userLocation, null, serverStats);
      });

      // Enforce minimum profile completeness for feed inclusion
      // Profiles below the threshold are excluded unless user is searching
      if (!filters.searchQuery || !filters.searchQuery.trim()) {
        const beforeCount = scoredProfiles.length;
        scoredProfiles = scoredProfiles.filter(p => p.canAppearInFeed !== false);
        if (beforeCount !== scoredProfiles.length) {
          debugLog(`   🚫 Excluded ${beforeCount - scoredProfiles.length} incomplete profiles from feed`);
        }
      }

      // Apply UBER/BOLT-STYLE SORTING
      scoredProfiles = this.sortUberBoltStyle(scoredProfiles, filters.filterMode);

      // Calculate metadata
      const sameCountryCount = scoredProfiles.filter(p => p.sameCountry).length;
      const onlineCount = scoredProfiles.filter(p => p.isOnline).length;
      const nearbyCount = {
        within5km: scoredProfiles.filter(p => p.sameCountry && p.distance != null && p.distance <= 5).length,
        within10km: scoredProfiles.filter(p => p.sameCountry && p.distance != null && p.distance <= 10).length,
        within25km: scoredProfiles.filter(p => p.sameCountry && p.distance != null && p.distance <= 25).length,
        within50km: scoredProfiles.filter(p => p.sameCountry && p.distance != null && p.distance <= 50).length
      };

      // Log sorting results
      debugLog(`📊 Recommendation Stats:`);
      debugLog(`   Same country: ${sameCountryCount}/${scoredProfiles.length}`);
      debugLog(`   Online: ${onlineCount}/${scoredProfiles.length}`);
      debugLog(`   Within 5km: ${nearbyCount.within5km}, 10km: ${nearbyCount.within10km}, 25km: ${nearbyCount.within25km}`);
      
      if (scoredProfiles.length > 0) {
        debugLog(`   Top 5 profiles:`);
        scoredProfiles.slice(0, 5).forEach((p, i) => {
          const city = (p.profile_data?.location?.city || p.profileData?.location?.city || 'Unknown');
          debugLog(`      ${i+1}. ${p.username} - ${city} - ${p.distance?.toFixed(1) || '?'}km - Score: ${p.recommendationScore}`);
        });
      }

      // Paginate — cursor-based if cursor is provided, else offset-based
      let startIndex = offset;

      if (cursor) {
        try {
          const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
          const cursorScore = decoded.s;
          const cursorId = decoded.id;
          // Find the first profile after the cursor position
          startIndex = scoredProfiles.findIndex((p, idx) => {
            const id = (p._id || p.id || '').toString();
            // Same sort order: sameCountry → distance → score.
            // Simplification: find by id match then take next item.
            return id === cursorId;
          });
          if (startIndex >= 0) {
            startIndex += 1; // Start after the cursor item
          } else {
            startIndex = 0; // Cursor invalid, start from beginning
          }
        } catch {
          startIndex = offset; // Malformed cursor, fall back to offset
        }
      }

      const paginatedProfiles = scoredProfiles.slice(startIndex, startIndex + limit);

      // Build next cursor from the last profile in this page
      let nextCursor = null;
      if (paginatedProfiles.length === limit && startIndex + limit < scoredProfiles.length) {
        const lastProfile = paginatedProfiles[paginatedProfiles.length - 1];
        const cursorData = {
          s: lastProfile.recommendationScore || 0,
          id: (lastProfile._id || lastProfile.id || '').toString()
        };
        nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64url');
      }

      return {
        profiles: paginatedProfiles,
        total: scoredProfiles.length,
        nextCursor,
        metadata: {
          algorithm: 'uber_bolt_style_v1',
          userLocationDetected: !!userLocation,
          sameCountryCount,
          onlineCount,
          nearbyCount,
          topScore: paginatedProfiles[0]?.recommendationScore || 0
        }
      };

    } catch (error) {
      console.error('❌ MongoRecommendationEngine error:', error);
      return {
        profiles: [],
        total: 0,
        error: error.message
      };
    }
  }

  /**
   * Normalize profile data (handle both camelCase and snake_case)
   */
  normalizeProfile(profile) {
    return {
      id: profile._id,
      _id: profile._id,
      username: profile.username,
      email: profile.email,
      verification_tier: profile.verification_tier || profile.verificationTier || 1,
      verificationTier: profile.verification_tier || profile.verificationTier || 1,
      reputation_score: profile.reputation_score || profile.reputationScore || 50,
      reputationScore: profile.reputation_score || profile.reputationScore || 50,
      profile_data: profile.profile_data || profile.profileData || {},
      profileData: profile.profile_data || profile.profileData || {},
      is_subscribed: profile.is_subscribed || profile.isSubscribed || false,
      isSubscribed: profile.is_subscribed || profile.isSubscribed || false,
      subscription_tier: profile.subscription_tier || profile.subscriptionTier || 'free',
      subscriptionTier: profile.subscription_tier || profile.subscriptionTier || 'free',
      created_at: profile.created_at || profile.createdAt,
      createdAt: profile.created_at || profile.createdAt,
      last_active: profile.last_active || profile.lastActive,
      lastActive: profile.last_active || profile.lastActive
    };
  }

  /**
   * Get recommendations based on viewer's account type
   * Routes to appropriate method automatically
   */
  async getAccountTypeAwareRecommendations(options = {}) {
    const { userId, viewerAccountType, ...restOptions } = options;

    debugLog(`🎯 Account-type-aware recommendations for: ${viewerAccountType || 'anonymous'}`);

    if (!userId || !viewerAccountType) {
      // Unauthenticated - show public providers only
      return this.getRecommendedProfiles({
        ...options,
        accountTypeFilter: 'provider'
      });
    }

    switch (viewerAccountType) {
      case 'client':
        // Clients see only providers
        return this.getRecommendedProfiles({
          ...options,
          accountTypeFilter: 'provider'
        });
      
      case 'provider':
        // Providers see only clients
        return this.getRecommendedProfiles({
          ...options,
          accountTypeFilter: 'client'
        });
      
      case 'sugar_daddy':
      case 'sugar_mommy':
        // Sugar accounts see verified providers
        return this.getSugarRecommendations(options);
      
      default:
        // Default to showing providers
        return this.getRecommendedProfiles({
          ...options,
          accountTypeFilter: 'provider'
        });
    }
  }

  /**
   * Sugar Daddy/Mommy recommendations
   * Only shows well-verified providers matching their preferences
   */
  async getSugarRecommendations(options = {}) {
    const { userId, userLocation, limit = 20, offset = 0, filters = {}, viewerAccountType } = options;

    try {
      // Get sugar user's preferences
      const sugarUser = await User.findById(userId).select('profile_data profileData').lean();
      
      if (!sugarUser) {
        throw new Error('User not found');
      }

      const userData = sugarUser.profile_data || sugarUser.profileData || {};
      const sugarSettings = userData.sugarSettings || {};
      
      // Default preferences for sugar accounts
      const preferredGender = sugarSettings.preferredGender || 
        (viewerAccountType === 'sugar_daddy' ? 'female' : 'male');
      const preferredAgeRange = sugarSettings.preferredAgeRange || { min: 18, max: 30 };

      debugLog(`👑 Sugar recommendations - Gender: ${preferredGender}, Age: ${preferredAgeRange.min}-${preferredAgeRange.max}`);

      // Build query for verified providers
      const mongoQuery = {
        $and: [
          {
            $or: [
              { 'profile_data.accountType': 'provider' },
              { 'profileData.accountType': 'provider' }
            ]
          },
          {
            $or: [
              { verification_tier: { $gte: 2 } },
              { verificationTier: { $gte: 2 } }
            ]
          }
        ]
      };

      // Exclude self
      if (userId) {
        const mongoose = require('mongoose');
        mongoQuery._id = { $ne: new mongoose.Types.ObjectId(userId) };
      }

      // Apply gender filter
      if (preferredGender && preferredGender !== 'any') {
        mongoQuery.$and.push({
          $or: [
            { 'profile_data.gender': preferredGender },
            { 'profileData.gender': preferredGender }
          ]
        });
      }

      // Fetch profiles
      const profiles = await User.find(mongoQuery)
        .select('username email verification_tier verificationTier reputation_score reputationScore profile_data profileData is_subscribed isSubscribed subscription_tier subscriptionTier created_at createdAt last_active lastActive')
        .sort({ verification_tier: -1, verificationTier: -1, last_active: -1 })
        .limit(200)
        .lean();

      // Batch-fetch server-authoritative engagement stats for sugar profiles
      const sugarProfileIds = profiles.map(p => p._id);
      const sugarServerStats = await this.batchFetchEngagementStats(sugarProfileIds);

      // Filter by age and score
      let scoredProfiles = profiles
        .map(profile => {
          const normalized = this.normalizeProfile(profile);
          const profileData = normalized.profile_data || {};
          
          // Check age
          const age = parseInt(profileData.age) || 25;
          if (age < preferredAgeRange.min || age > preferredAgeRange.max) {
            return null; // Filter out
          }
          
          return this.calculateProfileScore(normalized, userLocation, null, sugarServerStats);
        })
        .filter(Boolean);

      // Sort by verification then distance
      scoredProfiles.sort((a, b) => {
        // Verification tier first
        if (b.verificationTier !== a.verificationTier) {
          return b.verificationTier - a.verificationTier;
        }
        // Then distance
        const distA = a.distance ?? 9999;
        const distB = b.distance ?? 9999;
        return distA - distB;
      });

      return {
        profiles: scoredProfiles.slice(offset, offset + limit),
        total: scoredProfiles.length,
        metadata: {
          forSugarAccount: true,
          preferredGender,
          preferredAgeRange
        }
      };

    } catch (error) {
      console.error('Sugar recommendations error:', error);
      return { profiles: [], total: 0, error: error.message };
    }
  }

  /**
   * Track user activity for preference learning (MongoDB version)
   */
  async trackActivity(userId, actionType, actionData) {
    try {
      await UserActivityLog.create({
        userId: userId,
        actionType: actionType,
        actionData: actionData || {}
      });
      
      // Invalidate cache
      this.userPreferencesCache.delete(userId);
      
      return true;
    } catch (error) {
      console.error('Error tracking activity:', error);
      return false;
    }
  }
}

module.exports = MongoRecommendationEngine;
