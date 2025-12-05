/**
 * RecommendationEngine - TikTok-style Advanced Profile Recommendation System
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

const { query } = require('../config/database');

class RecommendationEngine {
  constructor() {
    // "For You" algorithm weights - UBER/BOLT STYLE
    // Country + Distance are the MOST important (like Uber shows closest drivers)
    // Then quality factors kick in
    this.weights = {
      countryMatch: 0.30,    // CRITICAL: Same country = priority (like Uber)
      distance: 0.25,        // Location proximity (closest first - like Uber)
      quality: 0.15,         // Verification + reputation (trust & rating)
      freshness: 0.10,       // Online/active status (current)
      engagement: 0.10,      // Response rate, success rate (reliable)
      beauty: 0.05,          // Profile completeness, photos (attractive)
      popularity: 0.05       // Reviews, bookings (popular)
    };
    
    // Cache for user preferences
    this.userPreferencesCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
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
   * Get user's browsing/interaction history for preference learning
   */
  async getUserPreferences(userId) {
    // Check cache first
    const cached = this.userPreferencesCache.get(userId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      // Get user's interaction history
      const historyResult = await query(`
        SELECT 
          action_type,
          action_data,
          created_at
        FROM user_activity_logs
        WHERE user_id = $1
        AND action_type IN ('profile_view', 'contact_click', 'favorite', 'search', 'booking')
        AND created_at > NOW() - INTERVAL '30 days'
        ORDER BY created_at DESC
        LIMIT 100
      `, [userId]).catch(() => ({ rows: [] }));

      const preferences = {
        preferredAgeRange: [18, 50],
        preferredLocations: [],
        preferredCategories: [],
        preferredPriceRange: [0, 1000],
        viewedProfiles: [],
        contactedProfiles: [],
        favoritedProfiles: [],
        searchTerms: []
      };

      // Analyze history to build preferences
      for (const activity of historyResult.rows) {
        const data = activity.action_data || {};
        
        switch (activity.action_type) {
          case 'profile_view':
            if (data.profileId) preferences.viewedProfiles.push(data.profileId);
            if (data.age) this.updateAgePreference(preferences, data.age);
            if (data.location) preferences.preferredLocations.push(data.location);
            if (data.category) preferences.preferredCategories.push(data.category);
            break;
          case 'contact_click':
            if (data.profileId) preferences.contactedProfiles.push(data.profileId);
            break;
          case 'favorite':
            if (data.profileId) preferences.favoritedProfiles.push(data.profileId);
            break;
          case 'search':
            if (data.term) preferences.searchTerms.push(data.term);
            break;
        }
      }

      // Deduplicate and get most common preferences
      preferences.preferredLocations = this.getMostCommon(preferences.preferredLocations, 5);
      preferences.preferredCategories = this.getMostCommon(preferences.preferredCategories, 5);

      // Cache the result
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

  updateAgePreference(preferences, age) {
    // Dynamically adjust preferred age range based on viewed profiles
    const minAge = Math.max(18, age - 5);
    const maxAge = Math.min(60, age + 5);
    preferences.preferredAgeRange = [
      Math.min(preferences.preferredAgeRange[0], minAge),
      Math.max(preferences.preferredAgeRange[1], maxAge)
    ];
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
   * "For You" algorithm: Uber/Bolt-style - CLOSEST FIRST, then quality factors
   * 
   * PRIORITY ORDER:
   * 1. Same Country (MUST match for top ranking)
   * 2. Distance (Closest first - like Uber drivers)
   * 3. Quality (Verification, ratings, success rate)
   * 4. Activity (Online/recent = higher rank)
   * 5. Popularity (Reviews, bookings)
   * 6. Profile completeness
   */
  calculateProfileScore(profile, userLocation, userPreferences, allProfiles) {
    let scores = {
      countryMatch: 0,  // NEW: Country match is critical
      distance: 0,
      quality: 0,
      engagement: 0,
      preference: 0,
      freshness: 0,
      beauty: 0,
      popularity: 0
    };

    const profileData = profile.profile_data || {};
    const profileLocation = profileData.location || {};

    // 0. COUNTRY MATCH SCORE (Critical - like Uber only shows drivers in your country)
    if (userLocation && userLocation.country && profileLocation.country) {
      const userCountry = userLocation.country.toLowerCase().trim();
      const providerCountry = profileLocation.country.toLowerCase().trim();
      
      if (userCountry === providerCountry) {
        scores.countryMatch = 100; // Same country = full score
        profile.sameCountry = true;
      } else {
        scores.countryMatch = 0; // Different country = no bonus
        profile.sameCountry = false;
      }
    } else {
      scores.countryMatch = 50; // Unknown location = neutral
    }

    // 1. DISTANCE SCORE (UBER-STYLE: closer = MUCH higher score)
    if (userLocation && userLocation.lat && userLocation.lng && profileLocation.coordinates) {
      const distance = this.calculateDistance(
        userLocation.lat,
        userLocation.lng,
        profileLocation.coordinates.lat,
        profileLocation.coordinates.lng
      );
      profile.distance = Math.round(distance * 10) / 10; // Round to 1 decimal
      
      // Uber-style scoring: Very close = very high score, drops off quickly
      if (distance <= 2) {
        scores.distance = 100; // Within 2km = perfect score
      } else if (distance <= 5) {
        scores.distance = 90; // Within 5km = excellent
      } else if (distance <= 10) {
        scores.distance = 80; // Within 10km = great
      } else if (distance <= 20) {
        scores.distance = 60; // Within 20km = good
      } else if (distance <= 50) {
        scores.distance = 40; // Within 50km = acceptable
      } else {
        scores.distance = Math.max(0, 30 - (distance - 50) / 10); // Further = lower
      }
    } else if (userLocation && profileLocation.city) {
      // Fallback: same city gets bonus
      if (userLocation.city?.toLowerCase() === profileLocation.city?.toLowerCase()) {
        scores.distance = 80;
        profile.distance = 5; // Approximate
      } else if (userLocation.country?.toLowerCase() === profileLocation.country?.toLowerCase()) {
        scores.distance = 50;
        profile.distance = 50; // Approximate
      } else {
        scores.distance = 20;
        profile.distance = 200; // Approximate
      }
    }

    // 2. QUALITY SCORE (verification + reputation)
    const verificationScore = (profile.verification_tier || 1) * 25; // 25, 50, 75, 100
    const reputationScore = profile.reputation_score || 50;
    scores.quality = (verificationScore * 0.4) + (reputationScore * 0.6);

    // 3. ENGAGEMENT SCORE (response rate, booking success)
    const responseRate = profileData.responseRate || 80;
    const bookingSuccess = profileData.bookingSuccessRate || 70;
    const reviewCount = profileData.reviewCount || 0;
    scores.engagement = (responseRate * 0.4) + (bookingSuccess * 0.4) + Math.min(reviewCount * 2, 20);

    // 4. PREFERENCE MATCH SCORE (based on user history)
    if (userPreferences) {
      let prefScore = 0;
      const age = parseInt(profileData.age) || 25;
      
      // Age preference match
      if (age >= userPreferences.preferredAgeRange[0] && 
          age <= userPreferences.preferredAgeRange[1]) {
        prefScore += 25;
      }
      
      // Location preference match
      if (userPreferences.preferredLocations.includes(profileLocation.city)) {
        prefScore += 25;
      }
      
      // Category preference match
      const profileCategories = profileData.serviceCategories || [];
      const matchingCategories = profileCategories.filter(c => 
        userPreferences.preferredCategories.includes(c)
      );
      prefScore += matchingCategories.length * 10;
      
      // Avoid showing already contacted profiles at top
      if (userPreferences.contactedProfiles.includes(profile.id)) {
        prefScore -= 20; // Slight penalty to show variety
      }
      
      scores.preference = Math.min(100, prefScore);
    }

    // 5. FRESHNESS SCORE (recently active profiles rank higher)
    const lastActive = new Date(profile.last_active || profile.created_at);
    const hoursSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceActive < 1) {
      scores.freshness = 100; // Online now
      profile.isOnline = true;
    } else if (hoursSinceActive < 24) {
      scores.freshness = 80; // Active today
      profile.isOnline = false;
      profile.lastSeen = 'Today';
    } else if (hoursSinceActive < 72) {
      scores.freshness = 60; // Active this week
      profile.lastSeen = `${Math.floor(hoursSinceActive / 24)} days ago`;
    } else {
      scores.freshness = Math.max(20, 60 - (hoursSinceActive / 24));
      profile.lastSeen = `${Math.floor(hoursSinceActive / 24)} days ago`;
    }

    // 6. BEAUTY/COMPLETENESS SCORE (profile attractiveness)
    let beautyScore = 0;
    if (profileData.profilePicture) beautyScore += 35; // Has main photo
    if (profileData.photos && profileData.photos.length > 0) {
      beautyScore += Math.min(profileData.photos.length * 8, 25); // Multiple photos
    }
    if (profileData.bio && profileData.bio.length > 50) beautyScore += 15; // Good bio
    if (profileData.bio && profileData.bio.length > 150) beautyScore += 10; // Detailed bio
    if (profileData.services && profileData.services.length > 0) beautyScore += 10;
    if (profile.is_subscribed) beautyScore += 5; // Premium profiles
    scores.beauty = Math.min(100, beautyScore);

    // 7. POPULARITY SCORE (how popular/in-demand this profile is)
    const viewCount = profileData.viewCount || 0;
    const contactCount = profileData.contactCount || 0;
    const favoriteCount = profileData.favoriteCount || 0;
    
    let popularityScore = 0;
    popularityScore += Math.min(viewCount / 10, 30); // Views (max 30 for 300+ views)
    popularityScore += Math.min(contactCount * 2, 35); // Contacts (max 35)
    popularityScore += Math.min(favoriteCount * 3, 35); // Favorites (max 35)
    scores.popularity = Math.min(100, popularityScore);

    // Calculate weighted final score - UBER/BOLT STYLE algorithm
    // Country match and distance are weighted heavily (like Uber showing closest drivers)
    const finalScore = 
      (scores.countryMatch * this.weights.countryMatch) +
      (scores.distance * this.weights.distance) +
      (scores.quality * this.weights.quality) +
      (scores.engagement * this.weights.engagement) +
      (scores.freshness * this.weights.freshness) +
      (scores.beauty * this.weights.beauty) +
      (scores.popularity * this.weights.popularity);

    profile.recommendationScore = Math.round(finalScore * 10) / 10;
    profile.scoreBreakdown = scores;
    
    // Add success rate to profile for frontend display
    profile.successRate = bookingSuccess;

    return profile;
  }

  /**
   * Get recommended profiles with advanced ranking
   */
  async getRecommendedProfiles(options = {}) {
    const {
      userId = null,
      userLocation = null, // { lat, lng, city, country }
      limit = 20,
      offset = 0,
      filters = {}
    } = options;

    try {
      // Get user preferences if authenticated
      let userPreferences = null;
      if (userId) {
        userPreferences = await this.getUserPreferences(userId);
      }

      // Build query with filters
      // IMPORTANT: Only show providers (accountType = 'provider')
      let whereClause = `WHERE u.profile_data IS NOT NULL 
        AND u.profile_data->>'accountType' = 'provider'
        AND (u.profile_data ? 'firstName' OR u.profile_data ? 'username')`;
      const params = [];
      let paramIndex = 1;

      // Exclude current user
      if (userId) {
        whereClause += ` AND u.id != $${paramIndex++}`;
        params.push(userId);
      }

      // COUNTRY-FIRST FILTER (Like Uber - show same country first)
      // If user's country is detected, prioritize providers from that country
      let userCountry = null;
      if (userLocation && userLocation.country) {
        userCountry = userLocation.country;
        console.log(`🌍 User country detected: ${userCountry} - prioritizing local providers`);
      }

      // Apply filters
      if (filters.country && filters.country !== 'all') {
        whereClause += ` AND LOWER(u.profile_data->'location'->>'country') = LOWER($${paramIndex++})`;
        params.push(filters.country);
      }

      if (filters.city) {
        whereClause += ` AND LOWER(u.profile_data->'location'->>'city') ILIKE $${paramIndex++}`;
        params.push(`%${filters.city.toLowerCase()}%`);
      }

      if (filters.minAge && filters.maxAge) {
        whereClause += ` AND (u.profile_data->>'age')::int BETWEEN $${paramIndex++} AND $${paramIndex++}`;
        params.push(filters.minAge, filters.maxAge);
      }

      if (filters.category && filters.category !== 'all') {
        whereClause += ` AND u.profile_data->'serviceCategories' ? $${paramIndex++}`;
        params.push(filters.category);
      }

      // Handle frontend filter modes
      if (filters.filterMode === 'verified') {
        whereClause += ` AND u.verification_tier >= 2`;
      }
      if (filters.filterMode === 'online') {
        // Only profiles active in last 15 minutes
        whereClause += ` AND u.last_active > NOW() - INTERVAL '15 minutes'`;
      }

      // Handle search query
      if (filters.searchQuery && filters.searchQuery.trim()) {
        const searchTerm = filters.searchQuery.trim().toLowerCase();
        whereClause += ` AND (
          LOWER(u.username) ILIKE $${paramIndex++} OR
          LOWER(u.profile_data->>'firstName') ILIKE $${paramIndex++} OR
          LOWER(u.profile_data->>'bio') ILIKE $${paramIndex++} OR
          LOWER(u.profile_data->'location'->>'city') ILIKE $${paramIndex++}
        )`;
        const likePattern = `%${searchTerm}%`;
        params.push(likePattern, likePattern, likePattern, likePattern);
      }

      // Fetch profiles
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
        AND u.profile_data->>'accountType' = 'provider'
        ORDER BY u.last_active DESC NULLS LAST
        LIMIT 100
      `, params);

      // Calculate recommendation scores for all profiles
      let scoredProfiles = result.rows.map(profile => 
        this.calculateProfileScore(profile, userLocation, userPreferences, result.rows)
      );

      // UBER/BOLT-STYLE SORTING: Country first, then distance, then quality
      // Adjust sorting based on filter mode
      if (filters.filterMode === 'nearby' && userLocation) {
        // "Nearby" filter: Pure distance-based (like Uber closest drivers)
        scoredProfiles.sort((a, b) => {
          // Same country first
          if (a.sameCountry && !b.sameCountry) return -1;
          if (!a.sameCountry && b.sameCountry) return 1;
          // Online profiles first within similar distance
          if (a.isOnline && !b.isOnline) return -1;
          if (!a.isOnline && b.isOnline) return 1;
          // Then by distance (closest first)
          const distA = a.distance || 9999;
          const distB = b.distance || 9999;
          return distA - distB;
        });
      } else if (filters.filterMode === 'online') {
        // "Online" filter: Currently active providers
        scoredProfiles.sort((a, b) => {
          // Same country first
          if (a.sameCountry && !b.sameCountry) return -1;
          if (!a.sameCountry && b.sameCountry) return 1;
          // Online first
          if (a.isOnline && !b.isOnline) return -1;
          if (!a.isOnline && b.isOnline) return 1;
          // Then by distance
          const distA = a.distance || 9999;
          const distB = b.distance || 9999;
          return distA - distB;
        });
      } else if (filters.filterMode === 'trending') {
        // "Top Rated" filter: Best quality and success rate
        scoredProfiles.sort((a, b) => {
          // Same country first
          if (a.sameCountry && !b.sameCountry) return -1;
          if (!a.sameCountry && b.sameCountry) return 1;
          // Then by quality + engagement
          const scoreA = (a.scoreBreakdown?.quality || 0) + (a.scoreBreakdown?.engagement || 0);
          const scoreB = (b.scoreBreakdown?.quality || 0) + (b.scoreBreakdown?.engagement || 0);
          return scoreB - scoreA;
        });
      } else {
        // DEFAULT "For You": UBER-STYLE - Country → Distance → Quality
        // Shows closest providers in your country first, like Uber shows closest drivers
        scoredProfiles.sort((a, b) => {
          // 1. Same country ALWAYS comes first (like Uber only shows local drivers)
          if (a.sameCountry && !b.sameCountry) return -1;
          if (!a.sameCountry && b.sameCountry) return 1;
          
          // 2. Within same country, sort by combined score (distance + quality)
          // Recommendation score already weighs distance heavily
          const onlineBoostA = a.isOnline ? 5 : 0;
          const onlineBoostB = b.isOnline ? 5 : 0;
          return (b.recommendationScore + onlineBoostB) - (a.recommendationScore + onlineBoostA);
        });
      }

      // Apply diversity: ensure variety in top results (different locations)
      scoredProfiles = this.applyDiversityReranking(scoredProfiles);

      // Paginate
      const paginatedProfiles = scoredProfiles.slice(offset, offset + limit);

      // Log recommendation stats for debugging
      const sameCountryCount = paginatedProfiles.filter(p => p.sameCountry).length;
      const onlineCount = paginatedProfiles.filter(p => p.isOnline).length;
      const avgDistance = paginatedProfiles.reduce((sum, p) => sum + (p.distance || 0), 0) / paginatedProfiles.length;
      
      console.log(`📊 Recommendation Stats (Uber-Style):
        - Total providers: ${scoredProfiles.length}
        - User location: ${userLocation ? `${userLocation.city}, ${userLocation.country}` : 'Unknown'}
        - Same country: ${sameCountryCount}/${paginatedProfiles.length}
        - Online now: ${onlineCount}
        - Avg distance: ${avgDistance.toFixed(1)}km
        - Top score: ${paginatedProfiles[0]?.recommendationScore || 0}`);

      return {
        profiles: paginatedProfiles,
        total: scoredProfiles.length,
        metadata: {
          algorithm: 'recommendation_v1',
          userLocationDetected: !!userLocation,
          preferencesUsed: !!userPreferences,
          topScore: paginatedProfiles[0]?.recommendationScore || 0
        }
      };
    } catch (error) {
      console.error('Recommendation engine error:', error);
      throw error;
    }
  }

  /**
   * Apply diversity reranking to prevent similar profiles clustering
   */
  applyDiversityReranking(profiles) {
    if (profiles.length < 5) return profiles;

    const reranked = [profiles[0]]; // Keep top profile
    const remaining = profiles.slice(1);
    const usedLocations = new Set([profiles[0].profile_data?.location?.city]);
    const usedCategories = new Set(profiles[0].profile_data?.serviceCategories || []);

    while (remaining.length > 0 && reranked.length < profiles.length) {
      let bestIndex = 0;
      let bestDiversityBonus = 0;

      // Find profile that adds most diversity
      for (let i = 0; i < Math.min(10, remaining.length); i++) {
        const profile = remaining[i];
        let diversityBonus = 0;
        
        const location = profile.profile_data?.location?.city;
        const categories = profile.profile_data?.serviceCategories || [];

        // Bonus for different location
        if (location && !usedLocations.has(location)) {
          diversityBonus += 10;
        }

        // Bonus for different categories
        const newCategories = categories.filter(c => !usedCategories.has(c));
        diversityBonus += newCategories.length * 5;

        if (diversityBonus > bestDiversityBonus) {
          bestDiversityBonus = diversityBonus;
          bestIndex = i;
        }
      }

      const selected = remaining.splice(bestIndex, 1)[0];
      reranked.push(selected);

      // Track used attributes
      if (selected.profile_data?.location?.city) {
        usedLocations.add(selected.profile_data.location.city);
      }
      (selected.profile_data?.serviceCategories || []).forEach(c => usedCategories.add(c));
    }

    return reranked;
  }

  /**
   * Track user activity for preference learning
   */
  async trackActivity(userId, actionType, actionData) {
    try {
      await query(`
        INSERT INTO user_activity_logs (user_id, action_type, action_data, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [userId, actionType, JSON.stringify(actionData)]);
      
      // Invalidate cache
      this.userPreferencesCache.delete(userId);
    } catch (error) {
      console.error('Error tracking activity:', error);
    }
  }
}

module.exports = RecommendationEngine;
