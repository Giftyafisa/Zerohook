const { query } = require('../config/database');
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
   */
  async assessTransactionRisk(clientId, providerId, amount, serviceType) {
    try {
      // Get both users' trust data
      const usersResult = await query(`
        SELECT id, trust_score, verification_tier, reputation_score, 
               created_at, last_active
        FROM users 
        WHERE id IN ($1, $2)
      `, [clientId, providerId]);
      
      if (usersResult.rows.length !== 2) {
        throw new Error('One or both users not found');
      }
      
      const client = usersResult.rows.find(u => u.id === clientId);
      const provider = usersResult.rows.find(u => u.id === providerId);
      
      // Risk factors
      const riskFactors = [];
      let riskScore = 0;
      
      // Low trust scores
      if (client.trust_score < 200) {
        riskFactors.push('client_low_trust');
        riskScore += 30;
      }
      if (provider.trust_score < 200) {
        riskFactors.push('provider_low_trust');
        riskScore += 20;
      }
      
      // Insufficient verification for high-value transactions
      const requiredVerification = amount > 500 ? 3 : amount > 100 ? 2 : 1;
      if (client.verification_tier < requiredVerification) {
        riskFactors.push('client_insufficient_verification');
        riskScore += 25;
      }
      if (provider.verification_tier < requiredVerification) {
        riskFactors.push('provider_insufficient_verification');
        riskScore += 25;
      }
      
      // New accounts
      const clientAge = (Date.now() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (clientAge < 7) {
        riskFactors.push('client_new_account');
        riskScore += 15;
      }
      
      // Inactive accounts
      const providerLastActive = (Date.now() - new Date(provider.last_active).getTime()) / (1000 * 60 * 60 * 24);
      if (providerLastActive > 30) {
        riskFactors.push('provider_inactive');
        riskScore += 10;
      }
      
      // High amount for account history
      if (amount > Math.max(client.trust_score * 2, 100)) {
        riskFactors.push('high_amount_for_trust');
        riskScore += 20;
      }
      
      const riskLevel = riskScore < 20 ? 'low' : riskScore < 50 ? 'medium' : 'high';
      
      return {
        riskLevel,
        riskScore,
        riskFactors,
        recommendations: this.getRiskRecommendations(riskLevel, riskFactors),
        escrowRequired: riskLevel !== 'low',
        verificationRequired: riskScore > 40
      };
      
    } catch (error) {
      console.error('Risk assessment failed:', error);
      throw error;
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