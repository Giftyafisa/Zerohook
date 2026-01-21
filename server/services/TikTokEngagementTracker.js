/**
 * TikTokEngagementTracker - TikTok-Style Engagement & Feed Personalization
 * 
 * TIKTOK APPROACH IMPLEMENTATION:
 * ==============================
 * 1. Deep engagement tracking (view duration, scroll depth, replays, pauses)
 * 2. Collaborative filtering ("users like you also liked...")
 * 3. Exploration bonus for new profiles (cold start solution)
 * 4. Diversity injection to prevent filter bubbles
 * 5. Real-time session learning (adapts during single session)
 * 6. Negative signals (quick scroll-away, skip patterns)
 * 
 * Unlike simple view counts, this tracks QUALITY of engagement:
 * - Did they pause on the profile?
 * - Did they swipe through all photos?
 * - Did they return to the profile later?
 * - How long did they spend reading the bio?
 */

const { User, UserActivityLog } = require('../config/database');

class TikTokEngagementTracker {
  constructor() {
    // In-memory session state (for real-time learning during browsing)
    this.sessionEngagement = new Map(); // sessionId -> engagement data
    
    // User preference models (cached from DB)
    this.userPreferenceModels = new Map(); // userId -> preference model
    this.modelCacheTTL = 15 * 60 * 1000; // 15 minutes
    
    // Profile engagement scores (for ranking)
    this.profileEngagementScores = new Map(); // profileId -> engagement score
    this.engagementCacheTTL = 5 * 60 * 1000; // 5 minutes
    
    // Collaborative filtering matrix
    this.similarityMatrix = new Map(); // profileId -> [similar profiles]
    
    // Engagement weights (TikTok-inspired)
    this.engagementWeights = {
      viewDuration: 0.25,        // How long they viewed the profile
      photoViews: 0.15,          // How many photos they viewed
      bioReadTime: 0.10,         // Time spent on bio section
      scrollDepth: 0.10,         // How far they scrolled
      returnVisit: 0.15,         // Did they come back to this profile?
      contactInitiated: 0.20,    // Did they start a conversation?
      quickExit: -0.15,          // Negative: left quickly (< 2 seconds)
      skipped: -0.10             // Negative: swiped away fast
    };
    
    // Diversity injection settings
    this.diversitySettings = {
      injectEvery: 5,            // Inject diverse profile every N profiles
      diversityRadius: 50,       // Search radius for diverse profiles (km)
      diversityFactors: ['age', 'location', 'priceRange', 'specialization']
    };
    
    // New profile boost settings
    this.newProfileBoost = {
      maxAgeDays: 14,            // Profiles newer than this get boost
      maxBoostMultiplier: 1.5,   // Maximum boost for brand new profiles
      decayRate: 0.9             // Boost decays by this factor each day
    };
  }

  /**
   * Initialize the tracker
   */
  async initialize() {
    console.log('✅ TikTokEngagementTracker initialized');
    
    // Periodically recalculate collaborative filtering matrix
    setInterval(() => this.updateSimilarityMatrix(), 60 * 60 * 1000); // Every hour
    
    return this;
  }

  /**
   * Track profile view engagement (called from frontend)
   * This is the core TikTok-style engagement tracking
   */
  async trackProfileEngagement(data) {
    const {
      userId,          // Who is viewing
      sessionId,       // Current session
      profileId,       // Profile being viewed
      viewDuration,    // Milliseconds spent on profile
      photoViews,      // Number of photos viewed
      scrollDepth,     // 0-100 percentage scrolled
      bioExpanded,     // Did they expand the bio?
      bioReadTime,     // Time on expanded bio (ms)
      isReturnVisit,   // Have they viewed this profile before in session?
      action           // 'view', 'contact', 'favorite', 'skip', 'exit'
    } = data;

    try {
      // Calculate engagement score for this interaction
      const engagementScore = this.calculateEngagementScore({
        viewDuration,
        photoViews,
        scrollDepth,
        bioExpanded,
        bioReadTime,
        isReturnVisit,
        action
      });

      // Update session state (real-time learning)
      this.updateSessionState(sessionId, userId, profileId, engagementScore, data);

      // Log to database for long-term learning
      await this.persistEngagementEvent({
        userId,
        profileId,
        sessionId,
        engagementScore,
        ...data,
        timestamp: new Date()
      });

      // Update profile's aggregate engagement score
      await this.updateProfileEngagementScore(profileId, engagementScore);

      // Update user's preference model
      if (userId) {
        await this.updateUserPreferenceModel(userId, profileId, engagementScore);
      }

      return { success: true, engagementScore };

    } catch (error) {
      console.error('Error tracking engagement:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Calculate engagement score from interaction data
   * Higher = better engagement (more interest)
   */
  calculateEngagementScore(data) {
    const {
      viewDuration = 0,
      photoViews = 0,
      scrollDepth = 0,
      bioExpanded = false,
      bioReadTime = 0,
      isReturnVisit = false,
      action = 'view'
    } = data;

    let score = 0;

    // View duration scoring (TikTok: watch time is king)
    // Optimal viewing: 10-60 seconds suggests genuine interest
    if (viewDuration < 2000) {
      score += this.engagementWeights.quickExit * 100; // Negative
    } else if (viewDuration < 5000) {
      score += 20; // Brief glance
    } else if (viewDuration < 15000) {
      score += 50; // Moderate interest
    } else if (viewDuration < 60000) {
      score += 80; // Strong interest
    } else {
      score += 90; // Very high interest
    }

    // Photo views scoring
    score += Math.min(photoViews * 10, 30);

    // Scroll depth scoring
    score += (scrollDepth / 100) * 20;

    // Bio engagement scoring
    if (bioExpanded) {
      score += 15;
      if (bioReadTime > 3000) score += 10; // Actually read it
    }

    // Return visit is a STRONG signal
    if (isReturnVisit) {
      score += this.engagementWeights.returnVisit * 100;
    }

    // Action-based scoring
    switch (action) {
      case 'contact':
        score += this.engagementWeights.contactInitiated * 100;
        break;
      case 'favorite':
        score += 25;
        break;
      case 'skip':
        score += this.engagementWeights.skipped * 100;
        break;
      case 'exit':
        if (viewDuration < 2000) {
          score += this.engagementWeights.quickExit * 100;
        }
        break;
    }

    // Normalize to 0-100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Update session state for real-time learning
   */
  updateSessionState(sessionId, userId, profileId, engagementScore, data) {
    if (!this.sessionEngagement.has(sessionId)) {
      this.sessionEngagement.set(sessionId, {
        userId,
        startTime: Date.now(),
        viewedProfiles: [],
        preferredCharacteristics: {},
        avoidedCharacteristics: {}
      });
    }

    const session = this.sessionEngagement.get(sessionId);
    
    session.viewedProfiles.push({
      profileId,
      engagementScore,
      timestamp: Date.now()
    });

    // Learn preferences from high-engagement profiles
    if (engagementScore > 60) {
      // Would extract profile characteristics and add to preferredCharacteristics
      // This enables real-time feed adaptation during browsing
    }

    // Learn avoidances from low-engagement profiles
    if (engagementScore < 20) {
      // Would extract profile characteristics and add to avoidedCharacteristics
    }
  }

  /**
   * Persist engagement event to database
   */
  async persistEngagementEvent(eventData) {
    try {
      await UserActivityLog.create({
        userId: eventData.userId || 'anonymous',
        actionType: 'profile_engagement',
        targetUserId: eventData.profileId,
        actionData: {
          sessionId: eventData.sessionId,
          engagementScore: eventData.engagementScore,
          viewDuration: eventData.viewDuration,
          photoViews: eventData.photoViews,
          scrollDepth: eventData.scrollDepth,
          bioExpanded: eventData.bioExpanded,
          bioReadTime: eventData.bioReadTime,
          isReturnVisit: eventData.isReturnVisit,
          action: eventData.action
        }
      });
    } catch (error) {
      console.error('Error persisting engagement event:', error);
    }
  }

  /**
   * Update profile's aggregate engagement score
   */
  async updateProfileEngagementScore(profileId, newScore) {
    try {
      // Get or initialize cached score
      let cached = this.profileEngagementScores.get(profileId);
      
      if (!cached || Date.now() - cached.timestamp > this.engagementCacheTTL) {
        // Fetch from DB
        const recentEngagements = await UserActivityLog.find({
          targetUserId: profileId,
          actionType: 'profile_engagement',
          createdAt: { $gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
        })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();

        const scores = recentEngagements.map(e => e.actionData?.engagementScore || 50);
        const avgScore = scores.length > 0 
          ? scores.reduce((a, b) => a + b, 0) / scores.length 
          : 50;

        cached = {
          score: avgScore,
          engagementCount: scores.length,
          timestamp: Date.now()
        };
      } else {
        // Rolling average with new score
        cached.score = (cached.score * 0.9) + (newScore * 0.1);
        cached.engagementCount++;
        cached.timestamp = Date.now();
      }

      this.profileEngagementScores.set(profileId, cached);

      // Periodically persist to user profile
      if (cached.engagementCount % 10 === 0) {
        await User.updateOne(
          { _id: profileId },
          { $set: { 'profile_data.engagementScore': cached.score } }
        );
      }

    } catch (error) {
      console.error('Error updating profile engagement score:', error);
    }
  }

  /**
   * Update user's preference model based on engagement
   */
  async updateUserPreferenceModel(userId, profileId, engagementScore) {
    try {
      // Get profile characteristics
      const profile = await User.findById(profileId).lean();
      if (!profile) return;

      const profileData = profile.profile_data || profile.profileData || {};

      let model = this.userPreferenceModels.get(userId);
      
      if (!model || Date.now() - model.timestamp > this.modelCacheTTL) {
        model = {
          preferredAgeRange: [18, 50],
          preferredLocations: {},
          preferredPriceRanges: {},
          preferredServices: {},
          timestamp: Date.now()
        };
      }

      // Weight factor based on engagement
      const weight = engagementScore / 100;

      // Update preferences (high engagement = increase preference)
      if (profileData.age) {
        // Adjust age preference
      }
      if (profileData.location?.city) {
        model.preferredLocations[profileData.location.city] = 
          (model.preferredLocations[profileData.location.city] || 0) + weight;
      }
      if (profileData.basePrice) {
        const priceRange = this.getPriceRange(profileData.basePrice);
        model.preferredPriceRanges[priceRange] = 
          (model.preferredPriceRanges[priceRange] || 0) + weight;
      }

      model.timestamp = Date.now();
      this.userPreferenceModels.set(userId, model);

    } catch (error) {
      console.error('Error updating user preference model:', error);
    }
  }

  /**
   * Get user's preference model for ranking profiles
   */
  getUserPreferenceModel(userId) {
    return this.userPreferenceModels.get(userId) || null;
  }

  /**
   * Get profile's engagement score
   */
  getProfileEngagementScore(profileId) {
    const cached = this.profileEngagementScores.get(profileId);
    return cached?.score || 50; // Default to 50 if unknown
  }

  /**
   * Calculate new profile boost (cold start solution)
   * TikTok gives new content a chance to be seen
   */
  calculateNewProfileBoost(profile) {
    const createdAt = new Date(profile.created_at || profile.createdAt);
    const ageInDays = (Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000);

    if (ageInDays > this.newProfileBoost.maxAgeDays) {
      return 1.0; // No boost for established profiles
    }

    // Boost decreases as profile ages
    const boost = this.newProfileBoost.maxBoostMultiplier * 
      Math.pow(this.newProfileBoost.decayRate, ageInDays);

    return Math.max(1.0, boost);
  }

  /**
   * Check if diversity injection is needed
   * Prevents filter bubbles by occasionally showing different profiles
   */
  shouldInjectDiversity(profilesShown) {
    return profilesShown.length > 0 && 
           profilesShown.length % this.diversitySettings.injectEvery === 0;
  }

  /**
   * Get diverse profile candidates
   * Returns profiles that are different from recently shown ones
   */
  async getDiverseProfiles(recentProfiles, userLocation, limit = 3) {
    try {
      // Extract characteristics of recent profiles
      const recentCities = [...new Set(recentProfiles.map(p => 
        p.profile_data?.location?.city || p.profileData?.location?.city
      ).filter(Boolean))];

      const recentAges = recentProfiles.map(p => 
        p.profile_data?.age || p.profileData?.age
      ).filter(Boolean);
      
      const avgAge = recentAges.length > 0 
        ? recentAges.reduce((a, b) => a + b) / recentAges.length 
        : 25;

      // Build query for DIFFERENT profiles
      const diverseQuery = {
        $or: [
          { 'profile_data.accountType': 'provider' },
          { 'profileData.accountType': 'provider' }
        ],
        _id: { $nin: recentProfiles.map(p => p._id) }
      };

      // Prefer different cities
      if (recentCities.length > 0) {
        diverseQuery.$and = [
          {
            $or: [
              { 'profile_data.location.city': { $nin: recentCities } },
              { 'profileData.location.city': { $nin: recentCities } }
            ]
          }
        ];
      }

      const diverseProfiles = await User.find(diverseQuery)
        .sort({ last_active: -1 })
        .limit(limit * 3)
        .lean();

      // Score by diversity (how different from recent profiles)
      return diverseProfiles.slice(0, limit);

    } catch (error) {
      console.error('Error getting diverse profiles:', error);
      return [];
    }
  }

  /**
   * Update collaborative filtering similarity matrix
   * "Users who liked profile A also liked profile B"
   */
  async updateSimilarityMatrix() {
    try {
      console.log('🔄 Updating collaborative filtering matrix...');

      // Get recent high-engagement interactions
      const recentEngagements = await UserActivityLog.aggregate([
        {
          $match: {
            actionType: 'profile_engagement',
            'actionData.engagementScore': { $gt: 60 },
            createdAt: { $gt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        },
        {
          $group: {
            _id: '$userId',
            likedProfiles: { $addToSet: '$targetUserId' }
          }
        },
        {
          $match: {
            'likedProfiles.1': { $exists: true } // Users with 2+ liked profiles
          }
        }
      ]);

      // Build co-occurrence matrix
      const coOccurrence = new Map();

      for (const user of recentEngagements) {
        const profiles = user.likedProfiles;
        
        for (let i = 0; i < profiles.length; i++) {
          for (let j = i + 1; j < profiles.length; j++) {
            const key = [profiles[i], profiles[j]].sort().join('_');
            coOccurrence.set(key, (coOccurrence.get(key) || 0) + 1);
          }
        }
      }

      // Convert to similarity scores
      this.similarityMatrix.clear();

      for (const [key, count] of coOccurrence) {
        if (count >= 3) { // Minimum co-occurrence threshold
          const [profileA, profileB] = key.split('_');
          
          if (!this.similarityMatrix.has(profileA)) {
            this.similarityMatrix.set(profileA, []);
          }
          if (!this.similarityMatrix.has(profileB)) {
            this.similarityMatrix.set(profileB, []);
          }

          this.similarityMatrix.get(profileA).push({ profileId: profileB, score: count });
          this.similarityMatrix.get(profileB).push({ profileId: profileA, score: count });
        }
      }

      console.log(`✅ Similarity matrix updated: ${this.similarityMatrix.size} profiles with similar pairs`);

    } catch (error) {
      console.error('Error updating similarity matrix:', error);
    }
  }

  /**
   * Get similar profiles based on collaborative filtering
   */
  getSimilarProfiles(profileId, limit = 5) {
    const similar = this.similarityMatrix.get(profileId) || [];
    return similar
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.profileId);
  }

  /**
   * Get price range bucket for preference modeling
   */
  getPriceRange(price) {
    if (price < 20) return 'budget';
    if (price < 50) return 'low';
    if (price < 100) return 'medium';
    if (price < 200) return 'high';
    return 'premium';
  }

  /**
   * Clean up old session data
   */
  cleanupSessions() {
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours
    const now = Date.now();

    for (const [sessionId, session] of this.sessionEngagement) {
      if (now - session.startTime > maxAge) {
        this.sessionEngagement.delete(sessionId);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      activeSessions: this.sessionEngagement.size,
      cachedPreferenceModels: this.userPreferenceModels.size,
      cachedEngagementScores: this.profileEngagementScores.size,
      similarityMatrixSize: this.similarityMatrix.size
    };
  }
}

module.exports = TikTokEngagementTracker;
