const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { User } = require('../config/database');

class VerificationManager {
  constructor() {
    // OTP store: userId -> { code, expiresAt, attempts }
    this.otpStore = new Map();
    this.maxOtpAttempts = 5;
    this.otpTTL = 10 * 60 * 1000; // 10 minutes
    // Tier advancement cooldown (minimum time between tier upgrades)
    this.tierCooldownMs = 24 * 60 * 60 * 1000; // 24 hours
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

  // Generate a cryptographically secure OTP
  generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
  }

  // Store OTP for a user (with expiry and rate limiting)
  storeOTP(userId, purpose) {
    const code = this.generateOTP();
    const key = `${userId}_${purpose}`;
    this.otpStore.set(key, {
      code,
      expiresAt: Date.now() + this.otpTTL,
      attempts: 0
    });
    // Cleanup expired OTPs periodically
    if (this.otpStore.size > 1000) {
      for (const [k, v] of this.otpStore) {
        if (Date.now() > v.expiresAt) this.otpStore.delete(k);
      }
    }
    return code;
  }

  // Validate an OTP
  validateOTP(userId, purpose, submittedCode) {
    const key = `${userId}_${purpose}`;
    const stored = this.otpStore.get(key);
    if (!stored) return { valid: false, error: 'No OTP found. Please request a new code.' };
    if (Date.now() > stored.expiresAt) {
      this.otpStore.delete(key);
      return { valid: false, error: 'OTP expired. Please request a new code.' };
    }
    stored.attempts++;
    if (stored.attempts > this.maxOtpAttempts) {
      this.otpStore.delete(key);
      return { valid: false, error: 'Too many attempts. Please request a new code.' };
    }
    if (stored.code !== submittedCode) {
      return { valid: false, error: `Invalid OTP. ${this.maxOtpAttempts - stored.attempts} attempts remaining.` };
    }
    this.otpStore.delete(key);
    return { valid: true };
  }

  // Get user's current verification tier (MongoDB)
  async getUserVerificationTier(userId) {
    try {
      const user = await User.findById(userId).select('verification_tier verification_data profile_data');
      if (!user) {
        return {
          tier: 0,
          score: 0,
          documents: {},
          verified_at: null,
          expires_at: null,
          next_tier: this.getVerificationTiers()[0]
        };
      }

      const verData = user.verification_data || {};
      const currentTier = user.verification_tier || 0;
      const nextTier = this.getNextTier(currentTier);

      // Check expiry
      if (verData.expires_at && new Date(verData.expires_at) < new Date()) {
        // Verification expired - demote to basic
        await User.findByIdAndUpdate(userId, {
          verification_tier: 1,
          'verification_data.expired': true
        });
        return {
          tier: 1,
          score: verData.score || 0,
          documents: verData.documents || {},
          verified_at: verData.verified_at,
          expires_at: verData.expires_at,
          expired: true,
          next_tier: this.getVerificationTiers()[0]
        };
      }

      return {
        tier: currentTier,
        score: verData.score || 0,
        documents: verData.documents || {},
        verified_at: verData.verified_at,
        expires_at: verData.expires_at,
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

  // Request phone OTP (sends code - integrate with SMS provider in production)
  async requestPhoneOTP(userId, phoneNumber) {
    const code = this.storeOTP(userId, 'phone');
    // TODO: Integrate real SMS provider (e.g., Twilio, Africa's Talking)
    // For now, log the OTP in development only
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Phone OTP for ${userId}: ${code}`);
    }
    return { success: true, message: 'OTP sent to your phone number.' };
  }

  // Verify phone number with OTP
  async verifyPhone(userId, phoneNumber, otpCode) {
    try {
      const result = this.validateOTP(userId, 'phone', otpCode);
      if (!result.valid) {
        return { success: false, message: result.error };
      }
      await this.updateVerificationStatus(userId, 'phone_verified', true);
      return { success: true, message: 'Phone number verified successfully' };
    } catch (error) {
      console.error('Error verifying phone:', error);
      throw new Error('Failed to verify phone number');
    }
  }

  // Request email OTP
  async requestEmailOTP(userId, email) {
    const code = this.storeOTP(userId, 'email');
    // TODO: Integrate real email provider (e.g., SendGrid, SES)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEV] Email OTP for ${userId}: ${code}`);
    }
    return { success: true, message: 'OTP sent to your email address.' };
  }

  // Verify email with OTP
  async verifyEmail(userId, email, otpCode) {
    try {
      const result = this.validateOTP(userId, 'email', otpCode);
      if (!result.valid) {
        return { success: false, message: result.error };
      }
      await this.updateVerificationStatus(userId, 'email_verified', true);
      return { success: true, message: 'Email verified successfully' };
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

  // ID verification - requires admin approval in production
  simulateIDVerification(idData) {
    // Basic validation - all fields required
    if (!idData.idType || !idData.idNumber || !idData.idImage || !idData.selfieImage) {
      return false;
    }
    // In production, this should integrate with a real ID verification provider
    // (e.g., Smile Identity for African markets, Jumio, Onfido)
    // For now, queue for manual admin review
    return false; // Always require admin approval
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

  // Address verification - requires admin approval in production
  simulateAddressVerification(addressData) {
    if (!addressData.street || !addressData.city || !addressData.state || !addressData.zipCode) {
      return false;
    }
    // In production, integrate with postal/geocoding verification service
    return false; // Always require admin approval
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

  // Behavioral verification - requires admin approval in production
  simulateBehavioralVerification(behavioralData) {
    // In production, integrate with behavioral biometrics provider
    return false; // Always require admin approval
  }

  // Update verification status (MongoDB)
  async updateVerificationStatus(userId, verificationType, status) {
    try {
      // Whitelist allowed verification types to prevent injection
      const allowedTypes = [
        'phone_verified', 'email_verified', 'age_verified',
        'id_verified', 'facial_verified', 'address_verified',
        'behavioral_verified', 'device_verified', 'social_verified',
        'decentralized_id', 'zkp_verified', 'background_verified'
      ];
      if (!allowedTypes.includes(verificationType)) {
        throw new Error(`Invalid verification type: ${verificationType}`);
      }

      await User.findByIdAndUpdate(userId, {
        $set: {
          [`verification_data.documents.${verificationType}`]: status,
          'verification_data.updated_at': new Date()
        }
      });

      // Check if user can advance to next tier
      await this.checkTierAdvancement(userId);
    } catch (error) {
      console.error('Error updating verification status:', error);
      throw new Error('Failed to update verification status');
    }
  }

  // Check if user can advance to next tier (with cooldown)
  async checkTierAdvancement(userId) {
    try {
      const currentTier = await this.getUserVerificationTier(userId);
      const nextTier = currentTier.next_tier;
      
      if (!nextTier) {
        return; // Already at highest tier
      }

      // Enforce cooldown between tier advancements
      if (currentTier.verified_at) {
        const timeSinceLastAdvance = Date.now() - new Date(currentTier.verified_at).getTime();
        if (timeSinceLastAdvance < this.tierCooldownMs) {
          return; // Too soon for next advancement
        }
      }

      // Tiers >= 3 (Pro/Elite) require manual admin approval
      if (nextTier.id >= 3) {
        return; // Require admin approval for high tiers
      }

      // Check if all requirements are met
      const allRequirementsMet = nextTier.requirements.every(req => {
        if (req === 'basic_tier') return currentTier.tier >= 1;
        if (req === 'advanced_tier') return currentTier.tier >= 2;
        if (req === 'pro_tier') return currentTier.tier >= 3;
        return currentTier.documents[req] === true;
      });

      if (allRequirementsMet) {
        await this.advanceToTier(userId, nextTier.id);
      }
    } catch (error) {
      console.error('Error checking tier advancement:', error);
    }
  }

  // Advance user to specific tier (MongoDB)
  async advanceToTier(userId, tierId) {
    try {
      await User.findByIdAndUpdate(userId, {
        $set: {
          verification_tier: tierId,
          'verification_data.verified_at': new Date(),
          'verification_data.updated_at': new Date()
        },
        $inc: { 'verification_data.score': 25 }
      });
      
      console.log(`✅ User ${userId} advanced to verification tier ${tierId}`);
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
        if (req === 'basic_tier') return currentTier.tier >= 1;
        if (req === 'advanced_tier') return currentTier.tier >= 2;
        if (req === 'pro_tier') return currentTier.tier >= 3;
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
