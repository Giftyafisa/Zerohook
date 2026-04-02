/**
 * ProfileCompletenessService
 * 
 * Manages profile completeness scoring, reminders, and enforcement.
 * Ensures users complete their profiles for better matching and platform quality.
 */

class ProfileCompletenessService {
  constructor() {
    // Define required fields and their weights for completeness score
    this.fieldWeights = {
      // CRITICAL FIELDS (40% total) - These are essential for matching
      location: {
        weight: 15,
        fields: ['profile_data.location.city', 'profile_data.location.country'],
        description: 'Your location helps us show you to nearby users',
        category: 'critical'
      },
      coordinates: {
        weight: 10,
        fields: ['profile_data.location.coordinates'],
        description: 'Precise location improves your visibility to nearby users',
        category: 'critical'
      },
      profilePhoto: {
        weight: 15,
        fields: ['profile_image', 'profile_image_url', 'profile_data.profile_picture', 'profile_data.profilePicture', 'profile_data.photos'],
        description: 'Profiles with photos get 10x more messages',
        category: 'critical'
      },
      
      // IMPORTANT FIELDS (35% total) - These improve matching quality
      basicInfo: {
        weight: 10,
        fields: ['profile_data.firstName', 'profile_data.lastName'],
        description: 'Your name helps others identify you',
        category: 'important'
      },
      age: {
        weight: 5,
        fields: ['profile_data.age'],
        description: 'Age is important for matching',
        category: 'important'
      },
      bio: {
        weight: 10,
        fields: ['profile_data.bio'],
        description: 'Tell others about yourself',
        category: 'important'
      },
      accountType: {
        weight: 5,
        fields: ['account_type'],
        description: 'Let others know if you\'re a provider or client',
        category: 'important'
      },
      phoneVerified: {
        weight: 5,
        fields: ['phone_verified', 'phoneVerified'],
        description: 'Verify your phone for trust',
        category: 'important'
      },
      
      // OPTIONAL FIELDS (25% total) - Nice to have
      galleryPhotos: {
        weight: 10,
        fields: ['gallery_images', 'profile_data.gallery_images', 'profile_data.photos'],
        minCount: 3,
        description: 'More photos increase your visibility',
        category: 'optional'
      },
      services: {
        weight: 5,
        fields: ['profile_data.services', 'profile_data.specializations'],
        description: 'List your services or interests',
        category: 'optional'
      },
      availability: {
        weight: 5,
        fields: ['profile_data.availability'],
        description: 'Set your availability hours',
        category: 'optional'
      },
      pricing: {
        weight: 5,
        fields: ['profile_data.basePrice'],
        description: 'Set your rates',
        category: 'optional'
      }
    };

    // Minimum completeness thresholds
    this.thresholds = {
      minimum: 30,      // Below this, profile is hidden from feed
      warning: 50,      // Below this, show persistent reminders
      good: 70,         // Acceptable but could improve
      excellent: 90     // Profile is well completed
    };

    // Reminder intervals (in hours)
    this.reminderIntervals = {
      critical: 24,     // Remind daily for critical missing fields
      important: 72,    // Remind every 3 days for important fields
      optional: 168     // Remind weekly for optional fields
    };
  }

  /**
   * Calculate profile completeness score (0-100)
   * @param {Object} user - User document from MongoDB
   * @returns {Object} - Score, missing fields, and recommendations
   */
  calculateCompleteness(user) {
    if (!user) {
      return {
        score: 0,
        percentage: '0%',
        level: 'incomplete',
        missingFields: Object.keys(this.fieldWeights),
        recommendations: ['Please complete your profile to get started']
      };
    }

    let totalScore = 0;
    let maxScore = 0;
    const missingFields = [];
    const completedFields = [];
    const recommendations = [];

    for (const [fieldName, config] of Object.entries(this.fieldWeights)) {
      maxScore += config.weight;
      const isComplete = this.checkFieldComplete(user, config);
      
      if (isComplete) {
        totalScore += config.weight;
        completedFields.push(fieldName);
      } else {
        missingFields.push({
          name: fieldName,
          category: config.category,
          weight: config.weight,
          description: config.description,
          fields: config.fields
        });
        
        // Add to recommendations based on priority
        if (config.category === 'critical') {
          recommendations.unshift(`⚠️ ${config.description}`);
        } else if (config.category === 'important') {
          recommendations.push(`📝 ${config.description}`);
        }
      }
    }

    const score = Math.round((totalScore / maxScore) * 100);
    const level = this.getCompletenessLevel(score);

    return {
      score,
      percentage: `${score}%`,
      level,
      missingFields,
      completedFields,
      recommendations: recommendations.slice(0, 5), // Top 5 recommendations
      thresholds: this.thresholds,
      canAppearInFeed: score >= this.thresholds.minimum,
      needsReminder: score < this.thresholds.warning,
      breakdown: {
        critical: this.getCategoryScore(user, 'critical'),
        important: this.getCategoryScore(user, 'important'),
        optional: this.getCategoryScore(user, 'optional')
      }
    };
  }

  /**
   * Check if a specific field configuration is complete
   */
  checkFieldComplete(user, config) {
    const profileData = user.profile_data || {};
    
    for (const fieldPath of config.fields) {
      const value = this.getNestedValue(user, fieldPath);
      
      // Check for arrays with minimum count
      if (config.minCount && Array.isArray(value)) {
        if (value.length >= config.minCount) return true;
        continue;
      }
      
      // Check for coordinates
      if (fieldPath.includes('coordinates')) {
        if (value && value.lat && value.lng) return true;
        if (value && value.latitude && value.longitude) return true;
        if (Array.isArray(value) && value.length === 2) return true;
        continue;
      }
      
      // Check for boolean fields (like phone_verified)
      if (fieldPath.includes('verified')) {
        if (value === true) return true;
        continue;
      }
      
      // Standard value check
      if (value && value !== '' && value !== null && value !== undefined) {
        // For arrays, check if not empty
        if (Array.isArray(value) && value.length > 0) return true;
        // For strings, check if not just whitespace
        if (typeof value === 'string' && value.trim() !== '') return true;
        // For numbers, accept any value
        if (typeof value === 'number') return true;
        // For objects, check if has properties
        if (typeof value === 'object' && Object.keys(value).length > 0) return true;
      }
    }
    
    return false;
  }

  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  /**
   * Get completeness level label
   */
  getCompletenessLevel(score) {
    if (score >= this.thresholds.excellent) return 'excellent';
    if (score >= this.thresholds.good) return 'good';
    if (score >= this.thresholds.warning) return 'fair';
    if (score >= this.thresholds.minimum) return 'poor';
    return 'incomplete';
  }

  /**
   * Calculate score for a specific category
   */
  getCategoryScore(user, category) {
    let earned = 0;
    let possible = 0;
    
    for (const [fieldName, config] of Object.entries(this.fieldWeights)) {
      if (config.category === category) {
        possible += config.weight;
        if (this.checkFieldComplete(user, config)) {
          earned += config.weight;
        }
      }
    }
    
    return {
      earned,
      possible,
      percentage: possible > 0 ? Math.round((earned / possible) * 100) : 0
    };
  }

  /**
   * Check if user needs a reminder based on last reminder time
   */
  shouldSendReminder(user, lastReminderTime) {
    const completeness = this.calculateCompleteness(user);
    
    if (completeness.score >= this.thresholds.warning) {
      return { shouldRemind: false, reason: 'Profile is sufficiently complete' };
    }
    
    const now = Date.now();
    const timeSinceLastReminder = lastReminderTime ? now - new Date(lastReminderTime).getTime() : Infinity;
    
    // Check critical fields first
    const criticalMissing = completeness.missingFields.filter(f => f.category === 'critical');
    if (criticalMissing.length > 0) {
      const intervalMs = this.reminderIntervals.critical * 60 * 60 * 1000;
      if (timeSinceLastReminder >= intervalMs) {
        return {
          shouldRemind: true,
          reason: 'Critical fields missing',
          missingFields: criticalMissing,
          urgency: 'high'
        };
      }
    }
    
    // Check important fields
    const importantMissing = completeness.missingFields.filter(f => f.category === 'important');
    if (importantMissing.length > 0) {
      const intervalMs = this.reminderIntervals.important * 60 * 60 * 1000;
      if (timeSinceLastReminder >= intervalMs) {
        return {
          shouldRemind: true,
          reason: 'Important fields missing',
          missingFields: importantMissing,
          urgency: 'medium'
        };
      }
    }
    
    return { shouldRemind: false, reason: 'Not due for reminder yet' };
  }

  /**
   * Get ranking penalty for incomplete profiles
   * Used by recommendation engine to deprioritize incomplete profiles
   */
  getRankingPenalty(user) {
    const completeness = this.calculateCompleteness(user);
    
    // No penalty for excellent profiles
    if (completeness.score >= this.thresholds.excellent) return 0;
    
    // Small penalty for good profiles
    if (completeness.score >= this.thresholds.good) return 0.05;
    
    // Medium penalty for fair profiles
    if (completeness.score >= this.thresholds.warning) return 0.15;
    
    // Large penalty for poor profiles
    if (completeness.score >= this.thresholds.minimum) return 0.30;
    
    // Maximum penalty for incomplete profiles (but still visible)
    return 0.50;
  }

  /**
   * Check if profile has valid location data for recommendations
   */
  hasValidLocation(user) {
    const profileData = user.profile_data || {};
    const location = profileData.location || {};
    
    // Best: Has coordinates
    if (location.coordinates) {
      const coords = location.coordinates;
      if (coords.lat && coords.lng) return { valid: true, source: 'coordinates', quality: 'high' };
      if (coords.latitude && coords.longitude) return { valid: true, source: 'coordinates', quality: 'high' };
      if (Array.isArray(coords) && coords.length === 2) return { valid: true, source: 'coordinates', quality: 'high' };
    }
    
    // Good: Has city and country
    if (location.city && location.country) {
      return { valid: true, source: 'city_country', quality: 'medium' };
    }
    
    // Fair: Has only country
    if (location.country) {
      return { valid: true, source: 'country_only', quality: 'low' };
    }
    
    // Check root level country
    if (user.country) {
      return { valid: true, source: 'root_country', quality: 'low' };
    }
    
    return { valid: false, source: 'none', quality: 'none' };
  }

  /**
   * Generate profile completion prompt message
   */
  getCompletionPrompt(user) {
    const completeness = this.calculateCompleteness(user);
    
    if (completeness.level === 'excellent') {
      return {
        type: 'success',
        title: '🌟 Profile Complete!',
        message: 'Your profile is fully optimized. You\'re getting maximum visibility!',
        showPrompt: false
      };
    }
    
    if (completeness.level === 'good') {
      return {
        type: 'info',
        title: '👍 Almost There!',
        message: `Your profile is ${completeness.percentage} complete. Add a few more details to boost visibility.`,
        showPrompt: true,
        priority: 'low'
      };
    }
    
    if (completeness.level === 'fair') {
      return {
        type: 'warning',
        title: '⚠️ Complete Your Profile',
        message: `Your profile is only ${completeness.percentage} complete. You're missing out on connections!`,
        showPrompt: true,
        priority: 'medium',
        missingFields: completeness.missingFields.filter(f => f.category !== 'optional')
      };
    }
    
    if (completeness.level === 'poor') {
      return {
        type: 'warning',
        title: '🔴 Profile Needs Attention',
        message: `Your profile is ${completeness.percentage} complete. Complete critical fields to appear in search results!`,
        showPrompt: true,
        priority: 'high',
        missingFields: completeness.missingFields
      };
    }
    
    // Incomplete
    return {
      type: 'error',
      title: '❌ Profile Hidden',
      message: 'Your profile is too incomplete to show in search results. Please add basic information.',
      showPrompt: true,
      priority: 'critical',
      missingFields: completeness.missingFields,
      isHidden: true
    };
  }
}

module.exports = ProfileCompletenessService;
