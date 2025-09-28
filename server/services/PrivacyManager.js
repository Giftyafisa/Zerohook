const { Pool } = require('pg');

class PrivacyManager {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
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
      // Check if privacy settings exist
      const checkQuery = 'SELECT id FROM user_privacy_settings WHERE user_id = $1';
      const existing = await this.pool.query(checkQuery, [userId]);

      if (existing.rows.length > 0) {
        // Update existing settings
        const updateQuery = `
          UPDATE user_privacy_settings 
          SET 
            privacy_level = $2,
            profile_visibility = $3,
            data_sharing_preferences = $4,
            location_sharing = $5,
            photo_sharing = $6,
            contact_sharing = $7,
            updated_at = NOW()
          WHERE user_id = $1
          RETURNING *
        `;

        const values = [
          userId, privacyLevel, profileVisibility, 
          dataSharingPreferences, locationSharing, 
          photoSharing, contactSharing
        ];

        const result = await this.pool.query(updateQuery, values);
        return result.rows[0];
      } else {
        // Create new settings
        const insertQuery = `
          INSERT INTO user_privacy_settings (
            user_id, privacy_level, profile_visibility, 
            data_sharing_preferences, location_sharing, 
            photo_sharing, contact_sharing, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          RETURNING *
        `;

        const values = [
          userId, privacyLevel, profileVisibility, 
          dataSharingPreferences, locationSharing, 
          photoSharing, contactSharing
        ];

        const result = await this.pool.query(insertQuery, values);
        return result.rows[0];
      }
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      throw new Error('Failed to update privacy settings');
    }
  }

  // Get user privacy settings
  async getUserPrivacySettings(userId) {
    try {
      const query = `
        SELECT * FROM user_privacy_settings 
        WHERE user_id = $1
      `;

      const result = await this.pool.query(query, [userId]);
      return result.rows[0] || this.getDefaultPrivacySettings();
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
      const query = `
        INSERT INTO privacy_consents (user_id, consent_type, granted, granted_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, consent_type) 
        DO UPDATE SET 
          granted = $3,
          granted_at = CASE WHEN $3 = true THEN NOW() ELSE granted_at END,
          revoked_at = CASE WHEN $3 = false THEN NOW() ELSE revoked_at END
        RETURNING *
      `;

      const result = await this.pool.query(query, [userId, consentType, granted]);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating consent:', error);
      throw new Error('Failed to update consent');
    }
  }

  // Get user consent status
  async getUserConsents(userId) {
    try {
      const query = `
        SELECT * FROM privacy_consents 
        WHERE user_id = $1
        ORDER BY consent_type
      `;

      const result = await this.pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting user consents:', error);
      return [];
    }
  }

  // Check if user has consented to specific data sharing
  async hasConsent(userId, consentType) {
    try {
      const query = `
        SELECT granted FROM privacy_consents 
        WHERE user_id = $1 AND consent_type = $2
      `;

      const result = await this.pool.query(query, [userId, consentType]);
      return result.rows.length > 0 ? result.rows[0].granted : false;
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
      
      // Get user's basic profile
      const profileQuery = `
        SELECT 
          u.id, u.username, u.verification_tier, u.trust_score,
          u.avatar, u.is_verified, u.created_at
        FROM users u 
        WHERE u.id = $1
      `;
      
      const profileResult = await this.pool.query(profileQuery, [userId]);
      const profile = profileResult.rows[0];

      if (!profile) {
        throw new Error('User not found');
      }

      // Determine what data is visible based on privacy level
      const visibleData = {
        id: profile.id,
        username: profile.username,
        verification_tier: profile.verification_tier,
        trust_score_range: this.getTrustScoreRange(profile.trust_score),
        is_verified: profile.is_verified,
        user_joined: profile.created_at
      };

      // Add additional fields based on privacy level
      if (privacySettings.privacy_level === 'standard' || 
          privacySettings.privacy_level === 'enhanced' || 
          privacySettings.privacy_level === 'premium') {
        
        const extendedQuery = `
          SELECT bio, age, photos FROM user_profiles WHERE user_id = $1
        `;
        const extendedResult = await this.pool.query(extendedQuery, [userId]);
        
        if (extendedResult.rows.length > 0) {
          const extended = extendedResult.rows[0];
          if (privacySettings.photo_sharing) {
            visibleData.photos = extended.photos;
          }
          visibleData.bio = extended.bio;
          visibleData.age = extended.age;
        }
      }

      // Add location if enhanced or premium and location sharing is enabled
      if ((privacySettings.privacy_level === 'enhanced' || 
           privacySettings.privacy_level === 'premium') && 
          privacySettings.location_sharing) {
        
        const locationQuery = `
          SELECT city, region FROM user_locations WHERE user_id = $1
        `;
        const locationResult = await this.pool.query(locationQuery, [userId]);
        
        if (locationResult.rows.length > 0) {
          const location = locationResult.rows[0];
          visibleData.location = {
            city: location.city,
            region: location.region
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
      // Mark user for deletion
      const markQuery = `
        UPDATE users 
        SET deletion_requested = true, deletion_requested_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await this.pool.query(markQuery, [userId]);
      
      // Schedule actual deletion for 30 days later (GDPR compliance)
      // This would typically be handled by a cron job or queue system
      
      return result.rows[0];
    } catch (error) {
      console.error('Error requesting data deletion:', error);
      throw new Error('Failed to request data deletion');
    }
  }

  // Export user data
  async exportUserData(userId) {
    try {
      // Get all user data
      const userQuery = `
        SELECT * FROM users WHERE id = $1
      `;
      
      const profileQuery = `
        SELECT * FROM user_profiles WHERE user_id = $1
      `;
      
      const privacyQuery = `
        SELECT * FROM user_privacy_settings WHERE user_id = $1
      `;
      
      const consentsQuery = `
        SELECT * FROM privacy_consents WHERE user_id = $1
      `;

      const [userResult, profileResult, privacyResult, consentsResult] = await Promise.all([
        this.pool.query(userQuery, [userId]),
        this.pool.query(profileQuery, [userId]),
        this.pool.query(privacyQuery, [userId]),
        this.pool.query(consentsQuery, [userId])
      ]);

      return {
        user: userResult.rows[0],
        profile: profileResult.rows[0],
        privacy: privacyResult.rows[0],
        consents: consentsResult.rows,
        exported_at: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error exporting user data:', error);
      throw new Error('Failed to export user data');
    }
  }
}

module.exports = PrivacyManager;
