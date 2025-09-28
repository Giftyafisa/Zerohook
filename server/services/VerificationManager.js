const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

class VerificationManager {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  // Verification Tiers
  getVerificationTiers() {
    return [
      {
        id: 1,
        name: 'Basic',
        description: 'Phone + Email OTP + Age Verification',
        requirements: ['phone_verified', 'email_verified', 'age_verified'],
        benefits: ['Basic profile access', 'Browse services'],
        icon: '🔐',
        color: '#4CAF50'
      },
      {
        id: 2,
        name: 'Advanced',
        description: 'Government ID + Facial Biometrics + Address Verification',
        requirements: ['basic_tier', 'id_verified', 'facial_verified', 'address_verified'],
        benefits: ['Enhanced profile features', 'Contact other users', 'Create service listings'],
        icon: '🆔',
        color: '#2196F3'
      },
      {
        id: 3,
        name: 'Pro',
        description: 'Behavioral Biometrics + Device DNA + Social Media Verification',
        requirements: ['advanced_tier', 'behavioral_verified', 'device_verified', 'social_verified'],
        benefits: ['Priority support', 'Advanced search filters', 'Trust score boost'],
        icon: '⭐',
        color: '#FF9800'
      },
      {
        id: 4,
        name: 'Elite',
        description: 'Decentralized ID + Zero-Knowledge Proofs + Background Checks',
        requirements: ['pro_tier', 'decentralized_id', 'zkp_verified', 'background_verified'],
        benefits: ['VIP features', 'Exclusive services', 'Highest trust score', 'Premium support'],
        icon: '👑',
        color: '#9C27B0'
      }
    ];
  }

  // Get user's current verification tier
  async getUserVerificationTier(userId) {
    try {
      const query = `
        SELECT 
          verification_tier,
          verification_score,
          documents_verified,
          verified_at,
          expires_at
        FROM verification_tiers 
        WHERE user_id = $1
        ORDER BY verification_tier DESC
        LIMIT 1
      `;

      const result = await this.pool.query(query, [userId]);
      
      if (result.rows.length === 0) {
        return {
          tier: 0,
          score: 0,
          documents: {},
          verified_at: null,
          expires_at: null,
          next_tier: this.getVerificationTiers()[0]
        };
      }

      const currentTier = result.rows[0];
      const nextTier = this.getNextTier(currentTier.verification_tier);

      return {
        tier: currentTier.verification_tier,
        score: currentTier.verification_score,
        documents: currentTier.documents_verified || {},
        verified_at: currentTier.verified_at,
        expires_at: currentTier.expires_at,
        next_tier: nextTier
      };
    } catch (error) {
      console.error('Error getting user verification tier:', error);
      throw new Error('Failed to get verification tier');
    }
  }

  // Get next tier requirements
  getNextTier(currentTier) {
    const tiers = this.getVerificationTiers();
    const nextTier = tiers.find(t => t.id === currentTier + 1);
    return nextTier || null;
  }

  // Verify phone number
  async verifyPhone(userId, phoneNumber, otpCode) {
    try {
      // In a real implementation, you would verify the OTP
      // For now, we'll simulate successful verification
      const isVerified = otpCode === '123456'; // Demo OTP

      if (isVerified) {
        await this.updateVerificationStatus(userId, 'phone_verified', true);
        return { success: true, message: 'Phone number verified successfully' };
      } else {
        return { success: false, message: 'Invalid OTP code' };
      }
    } catch (error) {
      console.error('Error verifying phone:', error);
      throw new Error('Failed to verify phone number');
    }
  }

  // Verify email
  async verifyEmail(userId, email, otpCode) {
    try {
      // In a real implementation, you would verify the OTP
      const isVerified = otpCode === '123456'; // Demo OTP

      if (isVerified) {
        await this.updateVerificationStatus(userId, 'email_verified', true);
        return { success: true, message: 'Email verified successfully' };
      } else {
        return { success: false, message: 'Invalid OTP code' };
      }
    } catch (error) {
      console.error('Error verifying email:', error);
      throw new Error('Failed to verify email');
    }
  }

  // Verify age (must be 18+)
  async verifyAge(userId, birthDate) {
    try {
      const age = this.calculateAge(birthDate);
      
      if (age >= 18) {
        await this.updateVerificationStatus(userId, 'age_verified', true);
        return { success: true, message: 'Age verification successful' };
      } else {
        return { success: false, message: 'Must be 18 or older to use this platform' };
      }
    } catch (error) {
      console.error('Error verifying age:', error);
      throw new Error('Failed to verify age');
    }
  }

  // Calculate age from birth date
  calculateAge(birthDate) {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  // Verify government ID
  async verifyGovernmentID(userId, idData) {
    try {
      const { idType, idNumber, idImage, selfieImage } = idData;
      
      // In a real implementation, you would:
      // 1. Validate ID format
      // 2. Use OCR to extract information
      // 3. Compare with selfie for facial recognition
      // 4. Verify with government databases (if available)
      
      // For demo purposes, we'll simulate successful verification
      const isVerified = this.simulateIDVerification(idData);
      
      if (isVerified) {
        await this.updateVerificationStatus(userId, 'id_verified', true);
        await this.updateVerificationStatus(userId, 'facial_verified', true);
        
        return { 
          success: true, 
          message: 'Government ID verified successfully',
          verified_at: new Date()
        };
      } else {
        return { success: false, message: 'ID verification failed' };
      }
    } catch (error) {
      console.error('Error verifying government ID:', error);
      throw new Error('Failed to verify government ID');
    }
  }

  // Simulate ID verification (demo purposes)
  simulateIDVerification(idData) {
    // Basic validation
    if (!idData.idType || !idData.idNumber || !idData.idImage || !idData.selfieImage) {
      return false;
    }
    
    // Simulate 95% success rate
    return Math.random() > 0.05;
  }

  // Verify address
  async verifyAddress(userId, addressData) {
    try {
      const { street, city, state, zipCode, country } = addressData;
      
      // In a real implementation, you would:
      // 1. Validate address format
      // 2. Use geocoding services
      // 3. Verify with postal services
      // 4. Send verification mail if needed
      
      // For demo purposes, we'll simulate successful verification
      const isVerified = this.simulateAddressVerification(addressData);
      
      if (isVerified) {
        await this.updateVerificationStatus(userId, 'address_verified', true);
        return { 
          success: true, 
          message: 'Address verified successfully',
          verified_at: new Date()
        };
      } else {
        return { success: false, message: 'Address verification failed' };
      }
    } catch (error) {
      console.error('Error verifying address:', error);
      throw new Error('Failed to verify address');
    }
  }

  // Simulate address verification (demo purposes)
  simulateAddressVerification(addressData) {
    // Basic validation
    if (!addressData.street || !addressData.city || !addressData.state || !addressData.zipCode) {
      return false;
    }
    
    // Simulate 90% success rate
    return Math.random() > 0.1;
  }

  // Verify behavioral biometrics
  async verifyBehavioralBiometrics(userId, behavioralData) {
    try {
      // In a real implementation, you would:
      // 1. Collect typing patterns
      // 2. Analyze mouse movements
      // 3. Monitor device usage patterns
      // 4. Build behavioral profile
      
      // For demo purposes, we'll simulate successful verification
      const isVerified = this.simulateBehavioralVerification(behavioralData);
      
      if (isVerified) {
        await this.updateVerificationStatus(userId, 'behavioral_verified', true);
        return { 
          success: true, 
          message: 'Behavioral biometrics verified successfully',
          verified_at: new Date()
        };
      } else {
        return { success: false, message: 'Behavioral verification failed' };
      }
    } catch (error) {
      console.error('Error verifying behavioral biometrics:', error);
      throw new Error('Failed to verify behavioral biometrics');
    }
  }

  // Simulate behavioral verification (demo purposes)
  simulateBehavioralVerification(behavioralData) {
    // Simulate 85% success rate
    return Math.random() > 0.15;
  }

  // Update verification status
  async updateVerificationStatus(userId, verificationType, status) {
    try {
      // Check if verification record exists
      const checkQuery = 'SELECT id FROM verification_tiers WHERE user_id = $1';
      const existing = await this.pool.query(checkQuery, [userId]);

      if (existing.rows.length > 0) {
        // Update existing record
        const updateQuery = `
          UPDATE verification_tiers 
          SET 
            documents_verified = jsonb_set(
              COALESCE(documents_verified, '{}'::jsonb),
              '{${verificationType}}',
              '${JSON.stringify(status)}'::jsonb
            ),
            updated_at = NOW()
          WHERE user_id = $1
          RETURNING *
        `;

        await this.pool.query(updateQuery, [userId]);
      } else {
        // Create new record
        const insertQuery = `
          INSERT INTO verification_tiers (
            user_id, verification_tier, verification_score,
            documents_verified, created_at
          ) VALUES ($1, 0, 0, '{"${verificationType}": ${status}}'::jsonb, NOW())
        `;

        await this.pool.query(insertQuery, [userId]);
      }

      // Check if user can advance to next tier
      await this.checkTierAdvancement(userId);
      
    } catch (error) {
      console.error('Error updating verification status:', error);
      throw new Error('Failed to update verification status');
    }
  }

  // Check if user can advance to next tier
  async checkTierAdvancement(userId) {
    try {
      const currentTier = await this.getUserVerificationTier(userId);
      const nextTier = currentTier.next_tier;
      
      if (!nextTier) {
        return; // Already at highest tier
      }

      // Check if all requirements are met
      const allRequirementsMet = nextTier.requirements.every(req => {
        if (req === 'basic_tier') {
          return currentTier.tier >= 1;
        }
        return currentTier.documents[req] === true;
      });

      if (allRequirementsMet) {
        // Advance to next tier
        await this.advanceToTier(userId, nextTier.id);
      }
    } catch (error) {
      console.error('Error checking tier advancement:', error);
    }
  }

  // Advance user to specific tier
  async advanceToTier(userId, tierId) {
    try {
      const updateQuery = `
        UPDATE verification_tiers 
        SET 
          verification_tier = $2,
          verification_score = verification_score + 25,
          verified_at = NOW(),
          updated_at = NOW()
        WHERE user_id = $1
      `;

      await this.pool.query(updateQuery, [userId, tierId]);
      
      // Update user's verification tier in users table
      const userUpdateQuery = `
        UPDATE users 
        SET verification_tier = $2, updated_at = NOW()
        WHERE id = $1
      `;

      await this.pool.query(userUpdateQuery, [userId, tierId]);
      
    } catch (error) {
      console.error('Error advancing to tier:', error);
      throw new Error('Failed to advance to tier');
    }
  }

  // Get verification progress
  async getVerificationProgress(userId) {
    try {
      const currentTier = await this.getUserVerificationTier(userId);
      const nextTier = currentTier.next_tier;
      
      if (!nextTier) {
        return {
          current_tier: currentTier.tier,
          progress: 100,
          completed: true,
          next_tier: null
        };
      }

      const completedRequirements = nextTier.requirements.filter(req => {
        if (req === 'basic_tier') {
          return currentTier.tier >= 1;
        }
        return currentTier.documents[req] === true;
      }).length;

      const progress = Math.round((completedRequirements / nextTier.requirements.length) * 100);

      return {
        current_tier: currentTier.tier,
        progress: progress,
        completed: false,
        next_tier: nextTier,
        completed_requirements: completedRequirements,
        total_requirements: nextTier.requirements.length
      };
    } catch (error) {
      console.error('Error getting verification progress:', error);
      throw new Error('Failed to get verification progress');
    }
  }
}

module.exports = VerificationManager;
