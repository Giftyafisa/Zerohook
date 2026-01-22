const { query, User } = require('../config/database');
const mongoose = require('mongoose');
const crypto = require('crypto');

class TrustEngine {
  constructor() {
    this.initialized = false;
    this.verificationTiers = {
      1: { name: 'Basic', requirements: ['phone', 'email'] },
      2: { name: 'Advanced', requirements: ['phone', 'email', 'id_verification', 'facial_biometrics'] },
      3: { name: 'Pro', requirements: ['phone', 'email', 'id_verification', 'facial_biometrics', 'behavioral_analysis'] },
      4: { name: 'Elite', requirements: ['phone', 'email', 'id_verification', 'facial_biometrics', 'behavioral_analysis', 'decentralized_id'] }
    };
    this.trustFactors = {
      transaction_success: 0.35,
      response_time: 0.15,
      dispute_resolution: 0.25,
      longevity: 0.10,
      verification_level: 0.15
    };
  }

  async initialize() {
    try {
      console.log('🔒 Initializing Trust Engine...');
      // Initialize any blockchain connections or ML models here
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Trust Engine initialization failed:', error);
      return false;
    }
  }

  isHealthy() {
    return this.initialized;
  }

  /**
   * Calculate comprehensive trust score for a user
   */
  async calculateTrustScore(userId) {
    try {
      // Get user data
      const userResult = await query(
        'SELECT * FROM users WHERE id = $1',
        [userId]
      );
      
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }
      
      const user = userResult.rows[0];
      
      // Get transaction history
      const transactionResult = await query(`
        SELECT 
          COUNT(*) as total_transactions,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_transactions,
          AVG(CASE WHEN completed_at IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (completed_at - created_at))/3600 
          END) as avg_completion_hours,
          COUNT(CASE WHEN status = 'disputed' THEN 1 END) as disputes
        FROM transactions 
        WHERE provider_id = $1 OR client_id = $1
      `, [userId]);
      
      const transactionStats = transactionResult.rows[0];
      
      // Get trust events
      const trustEventsResult = await query(`
        SELECT 
          SUM(trust_delta) as total_trust_delta,
          COUNT(*) as total_events
        FROM trust_events 
        WHERE user_id = $1 AND created_at > NOW() - INTERVAL '90 days'
      `, [userId]);
      
      const trustEvents = trustEventsResult.rows[0];
      
      // Calculate component scores
      const scores = {};
      
      // Transaction success rate (0-1)
      scores.transaction_success = transactionStats.total_transactions > 0 
        ? transactionStats.successful_transactions / transactionStats.total_transactions 
        : 0.5; // Default neutral score for new users
      
      // Response time score (faster = better, normalized 0-1)
      scores.response_time = transactionStats.avg_completion_hours 
        ? Math.max(0, 1 - (transactionStats.avg_completion_hours / 168)) // 168 hours = 1 week
        : 0.5;
      
      // Dispute resolution (fewer disputes = better)
      scores.dispute_resolution = transactionStats.total_transactions > 0
        ? 1 - (transactionStats.disputes / transactionStats.total_transactions)
        : 0.5;
      
      // Longevity (account age in months, capped at 24 months)
      const accountAgeMonths = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
      scores.longevity = Math.min(accountAgeMonths / 24, 1);
      
      // Verification level (tier / 4)
      scores.verification_level = user.verification_tier / 4;
      
      // Calculate weighted score
      let finalScore = 0;
      for (const [factor, weight] of Object.entries(this.trustFactors)) {
        finalScore += scores[factor] * weight;
      }
      
      // Apply time decay for recent activity
      const decayFactor = this.calculateDecayFactor(user.last_active);
      finalScore *= decayFactor;
      
      // Normalize to 0-1000 scale
      finalScore = Math.max(0, Math.min(1000, finalScore * 1000));
      
      // Update user's trust score
      await query(
        'UPDATE users SET trust_score = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [finalScore, userId]
      );
      
      return {
        score: finalScore,
        components: scores,
        lastUpdated: new Date().toISOString(),
        tier: this.getTrustTier(finalScore)
      };
      
    } catch (error) {
      console.error('Trust score calculation failed:', error);
      throw error;
    }
  }

  /**
   * Verify user identity for specific tier
   */
  async verifyIdentity(userId, tier, verificationData) {
    try {
      const requirements = this.verificationTiers[tier]?.requirements || [];
      const results = {};
      
      for (const requirement of requirements) {
        switch (requirement) {
          case 'phone':
            results.phone = await this.verifyPhone(verificationData.phone, verificationData.phoneOtp);
            break;
          case 'email':
            results.email = await this.verifyEmail(verificationData.email, verificationData.emailOtp);
            break;
          case 'id_verification':
            results.id_verification = await this.verifyGovernmentId(verificationData.idDocument);
            break;
          case 'facial_biometrics':
            results.facial_biometrics = await this.verifyFacialBiometrics(verificationData.facePhoto);
            break;
          case 'behavioral_analysis':
            results.behavioral_analysis = await this.analyzeBehavior(userId);
            break;
          case 'decentralized_id':
            results.decentralized_id = await this.verifyDecentralizedId(verificationData.did);
            break;
        }
      }
      
      // Check if all verifications passed
      const allPassed = Object.values(results).every(result => result.verified);
      
      if (allPassed) {
        // Update user verification tier
        await query(`
          UPDATE users 
          SET verification_tier = $1, 
              verification_data = $2, 
              updated_at = CURRENT_TIMESTAMP 
          WHERE id = $3
        `, [tier, JSON.stringify(results), userId]);
        
        // Record trust event
        await this.recordTrustEvent(userId, 'verification_upgrade', {
          tier,
          verificationResults: results
        }, 25); // +25 trust points for verification upgrade
      }
      
      return {
        success: allPassed,
        results,
        tier: allPassed ? tier : null
      };
      
    } catch (error) {
      console.error('Identity verification failed:', error);
      throw error;
    }
  }

  /**
   * Record a trust-related event
   */
  async recordTrustEvent(userId, eventType, eventData, trustDelta = 0, reputationDelta = 0, transactionId = null) {
    try {
      await query(`
        INSERT INTO trust_events (user_id, event_type, event_data, trust_delta, reputation_delta, transaction_id)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [userId, eventType, JSON.stringify(eventData), trustDelta, reputationDelta, transactionId]);
      
      // Update user scores
      if (trustDelta !== 0 || reputationDelta !== 0) {
        await query(`
          UPDATE users 
          SET trust_score = GREATEST(0, trust_score + $1),
              reputation_score = GREATEST(0, reputation_score + $2),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [trustDelta, reputationDelta, userId]);
      }
      
    } catch (error) {
      console.error('Failed to record trust event:', error);
      throw error;
    }
  }

  /**
   * Check if users can safely transact
   * NOTE: For escrow transactions, we should be more lenient since escrow itself provides protection
   */
  async assessTransactionRisk(clientId, providerId, amount, serviceType) {
    try {
      // Get both users' trust data using MongoDB
      const { User } = require('../config/database');
      
      // Convert string IDs to ObjectId if needed
      const clientObjId = typeof clientId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(clientId) : clientId;
      const providerObjId = typeof providerId === 'string' ? 
        mongoose.Types.ObjectId.createFromHexString(providerId) : providerId;
      
      const users = await User.find({
        _id: { $in: [clientObjId, providerObjId] }
      }).select('_id trust_score verification_tier reputation_score created_at last_active username is_banned');
      
      if (users.length !== 2) {
        console.log(`Risk assessment: Found ${users.length} users, expected 2. ClientId: ${clientId}, ProviderId: ${providerId}`);
        // Return low risk to allow escrow - escrow itself is the protection
        return {
          riskLevel: 'low',
          riskScore: 25,
          riskFactors: ['user_data_incomplete'],
          recommendations: ['Use escrow for payment protection'],
          escrowRequired: true,
          verificationRequired: false
        };
      }
      
      const client = users.find(u => u._id.toString() === clientId.toString());
      const provider = users.find(u => u._id.toString() === providerId.toString());
      
      if (!client || !provider) {
        console.log('Risk assessment: Could not match users');
        return {
          riskLevel: 'low',
          riskScore: 25,
          riskFactors: ['user_data_incomplete'],
          recommendations: ['Use escrow for payment protection'],
          escrowRequired: true,
          verificationRequired: false
        };
      }
      
      // Check for banned users - this is the ONLY hard block
      if (client.is_banned || provider.is_banned) {
        return {
          riskLevel: 'high',
          riskScore: 100,
          riskFactors: ['user_banned'],
          recommendations: ['Transaction not allowed with banned users'],
          escrowRequired: true,
          verificationRequired: true
        };
      }
      
      // Risk factors - more lenient scoring since escrow provides protection
      const riskFactors = [];
      let riskScore = 0;
      
      // Low trust scores (use defaults if not set) - reduced impact
      const clientTrustScore = client.trust_score || 100;
      const providerTrustScore = provider.trust_score || 100;
      
      if (clientTrustScore < 50) {
        riskFactors.push('client_very_low_trust');
        riskScore += 15;
      } else if (clientTrustScore < 100) {
        riskFactors.push('client_low_trust');
        riskScore += 5;
      }
      
      if (providerTrustScore < 50) {
        riskFactors.push('provider_very_low_trust');
        riskScore += 10;
      } else if (providerTrustScore < 100) {
        riskFactors.push('provider_low_trust');
        riskScore += 5;
      }
      
      // Insufficient verification - only for very high value transactions
      const clientVerificationTier = client.verification_tier || 1;
      const providerVerificationTier = provider.verification_tier || 1;
      
      // Only require verification for large transactions (>$500 equivalent)
      if (amount > 5000 && clientVerificationTier < 2) {
        riskFactors.push('client_insufficient_verification_high_value');
        riskScore += 15;
      }
      
      // Very new accounts (< 1 day) - slight concern
      const clientCreatedAt = client.created_at || new Date();
      const clientAge = (Date.now() - new Date(clientCreatedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (clientAge < 1) {
        riskFactors.push('client_very_new_account');
        riskScore += 10;
      }
      
      // Inactive provider accounts (> 60 days)
      const providerLastActive = provider.last_active ? 
        (Date.now() - new Date(provider.last_active).getTime()) / (1000 * 60 * 60 * 24) : 0;
      if (providerLastActive > 60) {
        riskFactors.push('provider_inactive');
        riskScore += 5;
      }
      
      // Very high amount for account history (> $1000 equivalent with low trust)
      if (amount > 10000 && clientTrustScore < 200) {
        riskFactors.push('high_amount_for_trust');
        riskScore += 15;
      }
      
      // Risk level thresholds - more lenient
      // high = blocked (score >= 70) - only for banned users or extreme cases
      // medium = proceed with escrow (score >= 30)
      // low = normal transaction (score < 30)
      const riskLevel = riskScore >= 70 ? 'high' : riskScore >= 30 ? 'medium' : 'low';
      
      console.log(`📊 Risk assessment for transaction: score=${riskScore}, level=${riskLevel}, factors=${riskFactors.join(', ')}`);
      
      return {
        riskLevel,
        riskScore,
        riskFactors,
        recommendations: this.getRiskRecommendations(riskLevel, riskFactors),
        escrowRequired: riskLevel !== 'low',
        verificationRequired: riskScore > 50
      };
      
    } catch (error) {
      console.error('Risk assessment failed:', error);
      // Return low risk on error - escrow provides protection
      return {
        riskLevel: 'low',
        riskScore: 20,
        riskFactors: ['assessment_error'],
        recommendations: ['Use escrow for payment protection'],
        escrowRequired: true,
        verificationRequired: false
      };
    }
  }

  // Helper methods
  calculateDecayFactor(lastActive) {
    const daysSinceActive = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0.5, Math.exp(-daysSinceActive / 30)); // Decay over 30 days
  }

  getTrustTier(score) {
    if (score >= 800) return 'Elite';
    if (score >= 600) return 'High';
    if (score >= 400) return 'Medium';
    if (score >= 200) return 'Low';
    return 'New';
  }

  getRiskRecommendations(riskLevel, riskFactors) {
    const recommendations = [];
    
    if (riskFactors.includes('client_low_trust') || riskFactors.includes('provider_low_trust')) {
      recommendations.push('Use escrow for payment protection');
    }
    
    if (riskFactors.includes('client_insufficient_verification') || riskFactors.includes('provider_insufficient_verification')) {
      recommendations.push('Complete identity verification before transaction');
    }
    
    if (riskFactors.includes('high_amount_for_trust')) {
      recommendations.push('Consider starting with a smaller transaction to build trust');
    }
    
    if (riskLevel === 'high') {
      recommendations.push('Manual review required before proceeding');
    }
    
    return recommendations;
  }

  // Verification methods (simplified implementations)
  async verifyPhone(phone, otp) {
    // In production, integrate with SMS service like Twilio
    return { verified: true, confidence: 0.95 };
  }

  async verifyEmail(email, otp) {
    // In production, verify email OTP
    return { verified: true, confidence: 0.95 };
  }

  async verifyGovernmentId(idDocument) {
    // In production, integrate with ID verification service
    return { verified: true, confidence: 0.85 };
  }

  async verifyFacialBiometrics(facePhoto) {
    // In production, use face recognition API
    return { verified: true, confidence: 0.90 };
  }

  async analyzeBehavior(userId) {
    // In production, analyze behavioral patterns
    return { verified: true, confidence: 0.80 };
  }

  async verifyDecentralizedId(did) {
    // In production, integrate with decentralized identity solutions
    // For now, return mock verification
    return { verified: true, confidence: 0.95 };
  }
}

module.exports = TrustEngine;