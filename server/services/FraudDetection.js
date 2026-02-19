const mongoose = require('mongoose');
const {
  User,
  UserSession,
  Service,
  ServiceCategory,
  TrustEvent,
  Transaction,
  FraudLog
} = require('../config/database');
const IPGeolocation = require('./IPGeolocation');

class FraudDetection {
  constructor() {
    this.initialized = false;
    this.ipGeolocation = new IPGeolocation();
    this.riskThresholds = {
      low: 0.3,
      medium: 0.6,
      high: 0.8
    };
    
    this.fraudPatterns = {
      // Behavioral patterns that indicate potential fraud
      rapid_account_creation: {
        timeWindow: 24 * 60 * 60 * 1000, // 24 hours
        threshold: 5, // Max accounts per IP/device
        riskScore: 0.7
      },
      price_manipulation: {
        deviationThreshold: 0.5, // 50% deviation from market rate
        riskScore: 0.6
      },
      location_spoofing: {
        velocityThreshold: 1000, // km/hour max realistic travel
        riskScore: 0.8
      },
      communication_patterns: {
        urgencyKeywords: ['urgent', 'now', 'immediately', 'cash only', 'no questions'],
        suspiciousKeywords: ['gift card', 'wire transfer', 'bitcoin', 'untraceable'],
        riskScore: 0.9
      }
    };
  }

  async initialize() {
    try {
      console.log('🛡️ Initializing Fraud Detection System...');
      
      // Initialize IP Geolocation service
      await this.ipGeolocation.initialize();
      
      // In production, load ML models here
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Fraud Detection initialization failed:', error);
      return false;
    }
  }

  isHealthy() {
    return this.initialized;
  }

  /**
   * Get IP Geolocation service instance
   */
  getIPGeolocation() {
    return this.ipGeolocation;
  }

  /**
   * Comprehensive fraud analysis for a user action
   */
  async analyzeFraudRisk(userId, actionType, actionData, context = {}) {
    try {
      const riskFactors = [];
      let totalRiskScore = 0;
      
      // Get user profile and history
      const user = userId ? await this.getUserProfile(userId) : null;
      
      switch (actionType) {
        case 'registration':
          const registrationRisk = await this.analyzeRegistrationRisk(actionData, context);
          riskFactors.push(...registrationRisk.factors);
          totalRiskScore += registrationRisk.score;
          break;
          
        case 'login':
          const loginRisk = await this.analyzeLoginRisk(userId, actionData, context);
          riskFactors.push(...loginRisk.factors);
          totalRiskScore += loginRisk.score;
          break;
          
        case 'service_creation':
          const serviceRisk = await this.analyzeServiceCreationRisk(userId, actionData, user);
          riskFactors.push(...serviceRisk.factors);
          totalRiskScore += serviceRisk.score;
          break;
          
        case 'booking_request':
          const bookingRisk = await this.analyzeBookingRisk(userId, actionData, user);
          riskFactors.push(...bookingRisk.factors);
          totalRiskScore += bookingRisk.score;
          break;
          
        case 'message':
          const messageRisk = await this.analyzeMessageRisk(actionData);
          riskFactors.push(...messageRisk.factors);
          totalRiskScore += messageRisk.score;
          break;
          
        case 'profile_update':
          const profileRisk = await this.analyzeProfileUpdateRisk(userId, actionData, user);
          riskFactors.push(...profileRisk.factors);
          totalRiskScore += profileRisk.score;
          break;
      }
      
      // Cross-check with known fraud patterns
      const patternRisk = await this.checkFraudPatterns(userId, actionType, actionData);
      riskFactors.push(...patternRisk.factors);
      totalRiskScore += patternRisk.score;
      
      // Behavioral analysis
      const behaviorRisk = await this.analyzeBehavioralAnomalies(userId, actionType, context);
      riskFactors.push(...behaviorRisk.factors);
      totalRiskScore += behaviorRisk.score;
      
      // Network analysis
      const networkRisk = await this.analyzeNetworkConnections(userId, context);
      riskFactors.push(...networkRisk.factors);
      totalRiskScore += networkRisk.score;
      
      // Normalize risk score (0-1)
      totalRiskScore = Math.min(1.0, totalRiskScore);
      
      const riskLevel = this.getRiskLevel(totalRiskScore);
      const recommendation = this.getRecommendation(riskLevel, riskFactors);
      
      // Log fraud analysis
      await this.logFraudAnalysis(userId, actionType, {
        riskScore: totalRiskScore,
        riskLevel,
        riskFactors,
        recommendation
      });
      
      return {
        riskScore: totalRiskScore,
        riskLevel,
        riskFactors,
        recommendation,
        shouldBlock: riskLevel === 'high' && totalRiskScore > 0.85,
        requiresVerification: riskLevel === 'medium' || totalRiskScore > 0.5
      };
      
    } catch (error) {
      console.error('Fraud analysis failed:', error);
      // Return safe default in case of analysis failure
      return {
        riskScore: 0.5,
        riskLevel: 'medium',
        riskFactors: ['analysis_failed'],
        recommendation: 'Manual review required',
        shouldBlock: false,
        requiresVerification: true
      };
    }
  }

  /**
   * Real-time message analysis for suspicious content
   */
  async analyzeMessageRisk(messageData) {
    const factors = [];
    let score = 0;
    
    const message = String(messageData?.content || '').toLowerCase();

    if (!message) {
      return { factors: ['empty_message'], score: 0.1 };
    }
    
    // Check for urgency indicators
    const urgencyWords = this.fraudPatterns.communication_patterns.urgencyKeywords;
    const urgencyMatches = urgencyWords.filter(word => message.includes(word));
    if (urgencyMatches.length > 0) {
      factors.push(`urgency_language: ${urgencyMatches.join(', ')}`);
      score += 0.3;
    }
    
    // Check for suspicious payment methods
    const suspiciousWords = this.fraudPatterns.communication_patterns.suspiciousKeywords;
    const suspiciousMatches = suspiciousWords.filter(word => message.includes(word));
    if (suspiciousMatches.length > 0) {
      factors.push(`suspicious_payment: ${suspiciousMatches.join(', ')}`);
      score += 0.6;
    }
    
    // Check for external contact requests (phone numbers, emails, social media)
    const contactPatterns = [
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Emails
      /\b(?:instagram|snapchat|telegram|whatsapp|kik)\b/i // Social media
    ];
    
    for (const pattern of contactPatterns) {
      if (pattern.test(message)) {
        factors.push('external_contact_request');
        score += 0.4;
        break;
      }
    }
    
    // Check message length and complexity (very short or overly complex messages can be suspicious)
    if (message.length < 10) {
      factors.push('suspicious_message_length');
      score += 0.2;
    }
    
    // Check for excessive capitalization
    const capitalRatio = (message.match(/[A-Z]/g) || []).length / message.length;
    if (capitalRatio > 0.5 && message.length > 20) {
      factors.push('excessive_capitalization');
      score += 0.3;
    }
    
    return { factors, score: Math.min(score, 1.0) };
  }

  /**
   * Analyze registration for suspicious activity
   */
  async analyzeRegistrationRisk(registrationData, context) {
    const factors = [];
    let score = 0;
    
    // Check for suspicious email patterns
    const email = registrationData.email.toLowerCase();
    const suspiciousEmailPatterns = [
      /\+\d+@/, // Email with numbers after +
      /\d{5,}/, // Long sequences of numbers
      /^[a-z]+\d+@(gmail|yahoo|hotmail)\.com$/ // Simple username + numbers
    ];
    
    for (const pattern of suspiciousEmailPatterns) {
      if (pattern.test(email)) {
        factors.push('suspicious_email_pattern');
        score += 0.3;
        break;
      }
    }
    
    // Check IP reputation
    if (context.ip) {
      const ipRisk = await this.checkIPReputation(context.ip);
      if (ipRisk.isSuspicious) {
        factors.push(`suspicious_ip: ${ipRisk.reason}`);
        score += ipRisk.riskScore;
      }
    }
    
    // Check for rapid registrations from same IP
    if (context.ip) {
      const registrationsWindowStart = new Date(Date.now() - (24 * 60 * 60 * 1000));

      const distinctRecentUsers = await UserSession.distinct('userId', {
        ipAddress: context.ip,
        createdAt: { $gte: registrationsWindowStart }
      });

      const count = distinctRecentUsers.length;
      if (count > this.fraudPatterns.rapid_account_creation.threshold) {
        factors.push('rapid_account_creation');
        score += this.fraudPatterns.rapid_account_creation.riskScore;
      }
    }
    
    // Check username patterns
    const username = registrationData.username.toLowerCase();
    if (/^user\d+$/.test(username) || /^[a-z]+\d{5,}$/.test(username)) {
      factors.push('generic_username_pattern');
      score += 0.2;
    }
    
    return { factors, score: Math.min(score, 1.0) };
  }

  /**
   * Analyze service creation for pricing anomalies and suspicious patterns
   */
  async analyzeServiceCreationRisk(userId, serviceData, user) {
    const factors = [];
    let score = 0;
    
    // Check for unusual pricing
    const marketPrice = await this.getMarketPrice(serviceData.category, serviceData.duration);
    if (marketPrice) {
      const priceDeviation = Math.abs(serviceData.price - marketPrice) / marketPrice;
      if (priceDeviation > this.fraudPatterns.price_manipulation.deviationThreshold) {
        factors.push(`unusual_pricing: ${(priceDeviation * 100).toFixed(0)}% deviation`);
        score += this.fraudPatterns.price_manipulation.riskScore * Math.min(priceDeviation, 1.0);
      }
    }
    
    // Check for new account creating high-value services
    const accountCreatedAt = user?.created_at ? new Date(user.created_at) : new Date();
    const accountAge = (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (accountAge < 7 && serviceData.price > 200) {
      factors.push('new_account_high_value_service');
      score += 0.5;
    }
    
    // Check for suspicious descriptions
    const description = String(serviceData?.description || '').toLowerCase();
    const suspiciousTerms = ['no questions asked', 'discrete', 'cash only', 'quick money'];
    const matchedTerms = suspiciousTerms.filter(term => description.includes(term));
    if (matchedTerms.length > 0) {
      factors.push(`suspicious_description: ${matchedTerms.join(', ')}`);
      score += 0.7;
    }
    
    // Check for excessive service creation
    const serviceWindowStart = new Date(Date.now() - (24 * 60 * 60 * 1000));
    const serviceCount = await Service.countDocuments({
      provider_id: this.toObjectId(userId),
      created_at: { $gte: serviceWindowStart }
    });
    if (serviceCount > 5) {
      factors.push('excessive_service_creation');
      score += 0.4;
    }
    
    return { factors, score: Math.min(score, 1.0) };
  }

  /**
   * Analyze booking requests for suspicious patterns
   */
  async analyzeBookingRisk(userId, bookingData, user) {
    const factors = [];
    let score = 0;
    
    // Check for new account making expensive bookings
    const accountCreatedAt = user?.created_at ? new Date(user.created_at) : new Date();
    const accountAge = (Date.now() - accountCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (accountAge < 3 && bookingData.amount > 300) {
      factors.push('new_account_expensive_booking');
      score += 0.6;
    }
    
    // Check for unusual booking patterns
    const bookingWindowStart = new Date(Date.now() - (60 * 60 * 1000));
    const bookingCount = await Transaction.countDocuments({
      client_id: this.toObjectId(userId),
      created_at: { $gte: bookingWindowStart }
    });
    if (bookingCount > 3) {
      factors.push('rapid_booking_pattern');
      score += 0.5;
    }
    
    // Check for location anomalies
    if (bookingData.location && user.profile_data?.typical_locations) {
      const isLocationAnomalous = await this.checkLocationAnomaly(
        bookingData.location, 
        user.profile_data.typical_locations
      );
      if (isLocationAnomalous) {
        factors.push('location_anomaly');
        score += 0.3;
      }
    }
    
    return { factors, score: Math.min(score, 1.0) };
  }

  // Helper methods

  async getUserProfile(userId) {
    const userObjId = this.toObjectId(userId);
    if (!userObjId) return null;
    return await User.findById(userObjId).lean();
  }

  async checkIPReputation(ip) {
    try {
      // Use IP Geolocation service for comprehensive IP analysis
      const ipRisk = await this.ipGeolocation.analyzeIPRisk(ip);
      
      return { 
        isSuspicious: ipRisk.isSuspicious,
        reason: ipRisk.riskFactors.join(', ') || null,
        riskScore: ipRisk.riskScore,
        location: ipRisk.location,
        security: ipRisk.security
      };
    } catch (error) {
      console.error('IP reputation check failed:', error);
      return { 
        isSuspicious: false,
        reason: null,
        riskScore: 0
      };
    }
  }

  async getMarketPrice(category, duration) {
    const categoryDoc = await ServiceCategory.findOne({ name: category }).select('_id').lean();
    if (!categoryDoc) return null;

    const marketWindowStart = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000));
    const result = await Service.aggregate([
      {
        $match: {
          category_id: categoryDoc._id,
          duration_minutes: Number(duration),
          status: 'active',
          created_at: { $gte: marketWindowStart }
        }
      },
      {
        $group: {
          _id: null,
          avg_price: { $avg: '$price' }
        }
      }
    ]);

    return parseFloat(result[0]?.avg_price) || null;
  }

  async checkLocationAnomaly(currentLocation, typicalLocations) {
    // Simple distance-based anomaly detection
    const distances = typicalLocations.map(loc => 
      this.calculateDistance(currentLocation, loc)
    );
    const minDistance = Math.min(...distances);
    
    // If more than 50km from any typical location, consider anomalous
    return minDistance > 50;
  }

  calculateDistance(coord1, coord2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
    const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  async checkFraudPatterns(userId, actionType, actionData) {
    // Implement pattern matching against known fraud signatures
    return { factors: [], score: 0 };
  }

  async analyzeBehavioralAnomalies(userId, actionType, context) {
    // Implement behavioral analysis
    return { factors: [], score: 0 };
  }

  async analyzeNetworkConnections(userId, context) {
    // Analyze user's network of connections for suspicious patterns
    return { factors: [], score: 0 };
  }

  async analyzeProfileUpdateRisk(userId, updateData, user) {
    const factors = [];
    let score = 0;
    
    // Check for frequent profile updates
    const updateWindowStart = new Date(Date.now() - (24 * 60 * 60 * 1000));
    const updateCount = await TrustEvent.countDocuments({
      user_id: this.toObjectId(userId),
      event_type: 'profile_update',
      created_at: { $gte: updateWindowStart }
    });
    if (updateCount > 5) {
      factors.push('frequent_profile_updates');
      score += 0.3;
    }
    
    return { factors, score: Math.min(score, 1.0) };
  }

  async analyzeLoginRisk(userId, actionData, context) {
    const factors = [];
    let score = 0;
    
    try {
      // Check for multiple failed login attempts
      const userObjId = this.toObjectId(userId);
      const failedWindowStart = new Date(Date.now() - (60 * 60 * 1000));
      const failedCount = await TrustEvent.countDocuments({
        user_id: userObjId,
        event_type: 'login_failed',
        created_at: { $gte: failedWindowStart }
      });
      if (failedCount > 3) {
        factors.push('multiple_failed_logins');
        score += 0.4;
      }
      
      // Comprehensive IP-based risk assessment using IP Geolocation
      if (context.ip && context.ip !== '::1' && context.ip !== '127.0.0.1') {
        const ipRisk = await this.ipGeolocation.analyzeIPRisk(context.ip);
        
        if (ipRisk.isSuspicious) {
          factors.push(...ipRisk.riskFactors);
          score += ipRisk.riskScore;
        }
        
        // Log IP location for user
        if (ipRisk.location) {
          console.log(`📍 Login from: ${ipRisk.location.city}, ${ipRisk.location.country} (${context.ip})`);
        }
        
        // Check for impossible travel (if we have previous login IP)
        const lastLogin = await UserSession.find({
          userId: userObjId,
          ipAddress: { $exists: true, $ne: null }
        })
          .select('ipAddress createdAt')
          .sort({ createdAt: -1 })
          .skip(1)
          .limit(1)
          .lean();

        if (lastLogin.length > 0 && lastLogin[0].ipAddress) {
          const previousIP = lastLogin[0].ipAddress;
          const timeDiff = Date.now() - new Date(lastLogin[0].createdAt).getTime();
          
          // Only check if the IPs are different
          if (previousIP !== context.ip) {
            const velocity = await this.ipGeolocation.calculateTravelVelocity(
              previousIP, 
              context.ip, 
              timeDiff
            );
            
            if (velocity.isImpossibleTravel) {
              factors.push(`impossible_travel: ${velocity.velocityKmH}km/h from ${velocity.location1} to ${velocity.location2}`);
              score += 0.8;
            } else if (velocity.isSuspiciousTravel) {
              factors.push(`suspicious_travel: ${velocity.velocityKmH}km/h`);
              score += 0.4;
            }
          }
        }
      }
      
      // Check for rapid successive logins
      const rapidLoginWindowStart = new Date(Date.now() - (5 * 60 * 1000));
      const recentCount = await TrustEvent.countDocuments({
        user_id: userObjId,
        event_type: 'login',
        created_at: { $gte: rapidLoginWindowStart }
      });
      if (recentCount > 2) {
        factors.push('rapid_successive_logins');
        score += 0.2;
      }
      
    } catch (error) {
      console.error('Login risk analysis failed:', error);
      // Return safe default
      factors.push('analysis_failed');
      score = 0.1;
    }
    
    return { factors, score: Math.min(score, 1.0) };
  }

  getRiskLevel(score) {
    if (score >= this.riskThresholds.high) return 'high';
    if (score >= this.riskThresholds.medium) return 'medium';
    return 'low';
  }

  getRecommendation(riskLevel, riskFactors) {
    switch (riskLevel) {
      case 'high':
        return 'Block action and require manual review';
      case 'medium':
        return 'Require additional verification before proceeding';
      case 'low':
        return 'Proceed with normal monitoring';
      default:
        return 'Unknown risk level';
    }
  }

  async logFraudAnalysis(userId, actionType, analysisResult) {
    try {
      const userObjId = this.toObjectId(userId);
      if (!userObjId) return;

      await FraudLog.create({
        user_id: userObjId,
        fraud_type: actionType,
        confidence_score: analysisResult.riskScore,
        evidence: {
          riskFactors: analysisResult.riskFactors,
          riskLevel: analysisResult.riskLevel
        },
        action_taken: analysisResult.recommendation
      });
    } catch (error) {
      console.error('Failed to log fraud analysis:', error);
    }
  }

  toObjectId(value) {
    if (!value || !mongoose.Types.ObjectId.isValid(value)) {
      return null;
    }
    return new mongoose.Types.ObjectId(value);
  }
}

module.exports = FraudDetection;