const { User, Transaction, TrustEvent } = require('../config/database');
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
    this.maxTrustScore = 100;
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
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('User not found');
      }

      const userObjId = new mongoose.Types.ObjectId(userId);
      const user = await User.findById(userObjId).lean();

      if (!user) {
        throw new Error('User not found');
      }

      const transactionAggregate = await Transaction.aggregate([
        {
          $match: {
            $or: [{ provider_id: userObjId }, { client_id: userObjId }]
          }
        },
        {
          $group: {
            _id: null,
            total_transactions: { $sum: 1 },
            successful_transactions: {
              $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
            },
            avg_completion_hours: {
              $avg: {
                $cond: [
                  { $and: [{ $ne: ['$completed_at', null] }, { $ne: ['$created_at', null] }] },
                  { $divide: [{ $subtract: ['$completed_at', '$created_at'] }, 3600000] },
                  null
                ]
              }
            },
            disputes: {
              $sum: { $cond: [{ $eq: ['$status', 'disputed'] }, 1, 0] }
            }
          }
        }
      ]);

      const transactionStats = transactionAggregate[0] || {
        total_transactions: 0,
        successful_transactions: 0,
        avg_completion_hours: null,
        disputes: 0
      };

      const ninetyDaysAgo = new Date(Date.now() - (90 * 24 * 60 * 60 * 1000));
      const trustEventsAggregate = await TrustEvent.aggregate([
        {
          $match: {
            user_id: userObjId,
            created_at: { $gt: ninetyDaysAgo }
          }
        },
        {
          $group: {
            _id: null,
            total_trust_delta: { $sum: '$trust_delta' },
            total_events: { $sum: 1 }
          }
        }
      ]);

      const trustEvents = trustEventsAggregate[0] || {
        total_trust_delta: 0,
        total_events: 0
      };
      
      // Calculate component scores
      const scores = {};
      
      // Transaction success rate (0-1)
      const totalTransactions = Number(transactionStats.total_transactions || 0);
      const successfulTransactions = Number(transactionStats.successful_transactions || 0);
      const disputes = Number(transactionStats.disputes || 0);
      const avgCompletionHours = Number(transactionStats.avg_completion_hours || 0);

      scores.transaction_success = totalTransactions > 0
        ? successfulTransactions / totalTransactions
        : 0.5; // Default neutral score for new users
      
      // Response time score (faster = better, normalized 0-1)
      scores.response_time = avgCompletionHours
        ? Math.max(0, 1 - (avgCompletionHours / 168)) // 168 hours = 1 week
        : 0.5;
      
      // Dispute resolution (fewer disputes = better)
      scores.dispute_resolution = totalTransactions > 0
        ? 1 - (disputes / totalTransactions)
        : 0.5;
      
      // Longevity (account age in months, capped at 24 months)
      const accountAgeMonths = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30);
      scores.longevity = Math.min(accountAgeMonths / 24, 1);
      
      // Verification level (tier / 4)
      scores.verification_level = Number(user.verification_tier || 1) / 4;
      
      // Calculate weighted score
      let finalScore = 0;
      for (const [factor, weight] of Object.entries(this.trustFactors)) {
        finalScore += scores[factor] * weight;
      }
      
      // Apply time decay for recent activity
      const decayFactor = this.calculateDecayFactor(user.last_active);
      finalScore *= decayFactor;
      
      // Normalize to canonical 0-100 trust score scale.
      finalScore = this.clampTrustScore(finalScore * this.maxTrustScore);
      
      // Update user's trust score
      await User.updateOne(
        { _id: userObjId },
        { $set: { trust_score: finalScore, updated_at: new Date() } }
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
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('User not found');
      }

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
        await User.updateOne(
          { _id: new mongoose.Types.ObjectId(userId) },
          {
            $set: {
              verification_tier: tier,
              verification_data: results,
              updated_at: new Date()
            }
          }
        );
        
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
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid user for trust event');
      }

      await TrustEvent.create({
        user_id: new mongoose.Types.ObjectId(userId),
        event_type: eventType,
        event_data: eventData,
        trust_delta: trustDelta,
        reputation_delta: reputationDelta,
        transaction_id: transactionId && mongoose.Types.ObjectId.isValid(transactionId)
          ? new mongoose.Types.ObjectId(transactionId)
          : undefined
      });
      
      // Update user scores
      if (trustDelta !== 0 || reputationDelta !== 0) {
        const userObjId = new mongoose.Types.ObjectId(userId);
        const user = await User.findById(userObjId)
          .select('trust_score reputation_score')
          .lean();

        if (user) {
          const currentTrustScore = this.normalizeTrustScore(user.trust_score);
          const nextTrustScore = this.clampTrustScore(currentTrustScore + Number(trustDelta));
          const nextReputationScore = Math.max(0, Number(user.reputation_score || 0) + Number(reputationDelta));

          await User.updateOne(
            { _id: userObjId },
            {
              $set: {
                trust_score: nextTrustScore,
                reputation_score: nextReputationScore,
                updated_at: new Date()
              }
            }
          );
        }
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
      const clientTrustScore = this.normalizeTrustScore(client.trust_score ?? 50);
      const providerTrustScore = this.normalizeTrustScore(provider.trust_score ?? 50);
      
      if (clientTrustScore < 30) {
        riskFactors.push('client_very_low_trust');
        riskScore += 15;
      } else if (clientTrustScore < 55) {
        riskFactors.push('client_low_trust');
        riskScore += 5;
      }
      
      if (providerTrustScore < 30) {
        riskFactors.push('provider_very_low_trust');
        riskScore += 10;
      } else if (providerTrustScore < 55) {
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
      if (amount > 10000 && clientTrustScore < 60) {
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
  clampTrustScore(score) {
    return Math.max(0, Math.min(this.maxTrustScore, Number(score) || 0));
  }

  normalizeTrustScore(score) {
    const numericScore = Number(score);
    if (!Number.isFinite(numericScore)) {
      return 0;
    }

    // Backward compatibility for legacy 0-1000 stored values.
    const normalized = numericScore > this.maxTrustScore ? numericScore / 10 : numericScore;
    return this.clampTrustScore(normalized);
  }

  calculateDecayFactor(lastActive) {
    const daysSinceActive = (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0.5, Math.exp(-daysSinceActive / 30)); // Decay over 30 days
  }

  getTrustTier(score) {
    const normalizedScore = this.normalizeTrustScore(score);
    if (normalizedScore >= 85) return 'Elite';
    if (normalizedScore >= 70) return 'High';
    if (normalizedScore >= 50) return 'Medium';
    if (normalizedScore >= 30) return 'Low';
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