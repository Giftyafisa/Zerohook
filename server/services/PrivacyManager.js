const { User, UserPrivacySettings, PrivacyConsent } = require('../config/database');

class PrivacyManager {
  constructor() {
    // No pool needed - using Mongoose models
  }

  // Privacy Levels
  getPrivacyLevels() {
    return [
      {
        id: 'minimal',
        name: 'Minimal',
        description: 'Only username and verification tier visible',
        visibleFields: ['username', 'verification_tier', 'trust_score_range'],
        dataSharing: 'minimal'
      },
      {
        id: 'standard',
        name: 'Standard',
        description: 'Add photos and basic bio',
        visibleFields: ['username', 'verification_tier', 'trust_score_range', 'photos', 'bio', 'age'],
        dataSharing: 'standard'
      },
      {
        id: 'enhanced',
        name: 'Enhanced',
        description: 'Add location and detailed preferences',
        visibleFields: ['username', 'verification_tier', 'trust_score_range', 'photos', 'bio', 'age', 'location', 'preferences'],
        dataSharing: 'enhanced'
      },
      {
        id: 'premium',
        name: 'Premium',
        description: 'Full profile with contact options',
        visibleFields: ['username', 'verification_tier', 'trust_score_range', 'photos', 'bio', 'age', 'location', 'preferences', 'contact_options'],
        dataSharing: 'premium'
      }
    ];
  }

  // Consent Types
  getConsentTypes() {
    return [
      {
        id: 'profile_visibility',
        name: 'Profile Visibility',
        description: 'Control who can see your profile information',
        required: true
      },
      {
        id: 'data_sharing',
        name: 'Data Sharing',
        description: 'Control how your data is shared with other users',
        required: true
      },
      {
        id: 'marketing',
        name: 'Marketing Communications',
        description: 'Receive promotional messages and updates',
        required: false
      },
      {
        id: 'analytics',
        name: 'Analytics & Research',
        description: 'Help improve the platform through data analysis',
        required: false
      },
      {
        id: 'third_party',
        name: 'Third-Party Services',
        description: 'Share data with trusted third-party services',
        required: false
      }
    ];
  }

  // Create or update user privacy settings
  async updatePrivacySettings(userId, privacyData) {
    const {
      privacyLevel,
      profileVisibility,
      dataSharingPreferences,
      locationSharing,
      photoSharing,
      contactSharing
    } = privacyData;

    try {
      const settings = await UserPrivacySettings.findOneAndUpdate(
        { user_id: userId },
        {
          $set: {
            privacy_level: privacyLevel || 'minimal',
            profile_visibility: profileVisibility || 'public',
            data_sharing_preferences: dataSharingPreferences || 'minimal',
            location_sharing: locationSharing || false,
            photo_sharing: photoSharing || false,
            contact_sharing: contactSharing || false
          }
        },
        { upsert: true, new: true }
      );

      return settings;
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      throw new Error('Failed to update privacy settings');
    }
  }

  // Get user privacy settings
  async getUserPrivacySettings(userId) {
    try {
      const settings = await UserPrivacySettings.findOne({ user_id: userId });
      if (!settings) {
        return this.getDefaultPrivacySettings();
      }
      return settings.toObject();
    } catch (error) {
      console.error('Error getting user privacy settings:', error);
      return this.getDefaultPrivacySettings();
    }
  }

  // Get default privacy settings
  getDefaultPrivacySettings() {
    return {
      privacy_level: 'minimal',
      profile_visibility: 'public',
      data_sharing_preferences: 'minimal',
      location_sharing: false,
      photo_sharing: false,
      contact_sharing: false
    };
  }

  // Update consent for specific data sharing
  async updateConsent(userId, consentType, granted) {
    try {
      const updateData = {
        user_id: userId,
        consent_type: consentType,
        granted: granted
      };

      if (granted) {
        updateData.granted_at = new Date();
      } else {
        updateData.revoked_at = new Date();
      }

      const consent = await PrivacyConsent.findOneAndUpdate(
        { user_id: userId, consent_type: consentType },
        { $set: updateData },
        { upsert: true, new: true }
      );

      return consent;
    } catch (error) {
      console.error('Error updating consent:', error);
      throw new Error('Failed to update consent');
    }
  }

  // Get user consent status
  async getUserConsents(userId) {
    try {
      const consents = await PrivacyConsent.find({ user_id: userId }).sort({ consent_type: 1 });
      return consents;
    } catch (error) {
      console.error('Error getting user consents:', error);
      return [];
    }
  }

  // Check if user has consented to specific data sharing
  async hasConsent(userId, consentType) {
    try {
      const consent = await PrivacyConsent.findOne({ user_id: userId, consent_type: consentType });
      return consent ? consent.granted : false;
    } catch (error) {
      console.error('Error checking consent:', error);
      return false;
    }
  }

  // Get visible profile data based on privacy settings
  async getVisibleProfileData(userId, viewerId = null) {
    try {
      // Get user's privacy settings
      const privacySettings = await this.getUserPrivacySettings(userId);
      
      // Get user's basic profile from User model
      const user = await User.findById(userId).select('username verification_tier trust_score profile_data created_at');

      if (!user) {
        throw new Error('User not found');
      }

      // Determine what data is visible based on privacy level
      const visibleData = {
        id: user._id,
        username: user.username,
        verification_tier: user.verification_tier,
        trust_score_range: this.getTrustScoreRange(user.trust_score || 0),
        is_verified: user.verification_tier > 1,
        user_joined: user.created_at
      };

      // Add additional fields based on privacy level
      if (privacySettings.privacy_level === 'standard' || 
          privacySettings.privacy_level === 'enhanced' || 
          privacySettings.privacy_level === 'premium') {
        
        // Extract from profile_data
        if (user.profile_data) {
          if (privacySettings.photo_sharing && user.profile_data.photos) {
            visibleData.photos = user.profile_data.photos;
          }
          if (user.profile_data.profilePicture) {
            visibleData.avatar = user.profile_data.profilePicture;
          }
          if (user.profile_data.bio) {
            visibleData.bio = user.profile_data.bio;
          }
          if (user.profile_data.age) {
            visibleData.age = user.profile_data.age;
          }
        }
      }

      // Add location if enhanced or premium and location sharing is enabled
      if ((privacySettings.privacy_level === 'enhanced' || 
           privacySettings.privacy_level === 'premium') && 
          privacySettings.location_sharing) {
        
        if (user.profile_data && user.profile_data.location) {
          visibleData.location = {
            city: user.profile_data.location.city,
            region: user.profile_data.location.region || user.profile_data.location.country
          };
        }
      }

      return visibleData;
    } catch (error) {
      console.error('Error getting visible profile data:', error);
      throw new Error('Failed to get visible profile data');
    }
  }

  // Get trust score range instead of exact score
  getTrustScoreRange(trustScore) {
    if (trustScore >= 90) return 'Excellent (90-100)';
    if (trustScore >= 80) return 'Very Good (80-89)';
    if (trustScore >= 70) return 'Good (70-79)';
    if (trustScore >= 60) return 'Fair (60-69)';
    if (trustScore >= 50) return 'Poor (50-59)';
    return 'Very Poor (0-49)';
  }

  // Request data deletion
  async requestDataDeletion(userId) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { 
          $set: { 
            deletion_requested: true, 
            deletion_requested_at: new Date() 
          } 
        },
        { new: true }
      );
      
      return user;
    } catch (error) {
      console.error('Error requesting data deletion:', error);
      throw new Error('Failed to request data deletion');
    }
  }

  // Export user data
  async exportUserData(userId) {
    try {
      const [user, privacy, consents] = await Promise.all([
        User.findById(userId).lean(),
        UserPrivacySettings.findOne({ user_id: userId }).lean(),
        PrivacyConsent.find({ user_id: userId }).lean()
      ]);

      return {
        user: user,
        profile: user?.profile_data || {},
        privacy: privacy || this.getDefaultPrivacySettings(),
        consents: consents || [],
        exported_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw new Error('Failed to export user data');
    }
  }
}

module.exports = PrivacyManager;
