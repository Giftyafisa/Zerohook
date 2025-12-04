const { query } = require('../config/database');
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
      const user = await this.getUserProfile(userId);
      
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
    
    const message = messageData.content.toLowerCase();
    
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
      const recentRegistrations = await query(`
        SELECT COUNT(*) as count 
        FROM users u 
        JOIN user_sessions s ON u.id = s.user_id 
        WHERE s.ip_address = $1 
        AND u.created_at > NOW() - INTERVAL '24 hours'
      `, [context.ip]);
      
      const count = parseInt(recentRegistrations.rows[0]?.count || 0);
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
    const accountAge = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (accountAge < 7 && serviceData.price > 200) {
      factors.push('new_account_high_value_service');
      score += 0.5;
    }
    
    // Check for suspicious descriptions
    const description = serviceData.description.toLowerCase();
    const suspiciousTerms = ['no questions asked', 'discrete', 'cash only', 'quick money'];
    const matchedTerms = suspiciousTerms.filter(term => description.includes(term));
    if (matchedTerms.length > 0) {
      factors.push(`suspicious_description: ${matchedTerms.join(', ')}`);
      score += 0.7;
    }
    
    // Check for excessive service creation
    const recentServices = await query(`
      SELECT COUNT(*) as count 
      FROM services 
      WHERE provider_id = $1 
      AND created_at > NOW() - INTERVAL '24 hours'
    `, [userId]);
    
    const serviceCount = parseInt(recentServices.rows[0]?.count || 0);
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
    const accountAge = (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (accountAge < 3 && bookingData.amount > 300) {
      factors.push('new_account_expensive_booking');
      score += 0.6;
    }
    
    // Check for unusual booking patterns
    const recentBookings = await query(`
      SELECT COUNT(*) as count 
      FROM transactions 
      WHERE client_id = $1 
      AND created_at > NOW() - INTERVAL '1 hour'
    `, [userId]);
    
    const bookingCount = parseInt(recentBookings.rows[0]?.count || 0);
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
    const result = await query(`
      SELECT * FROM users WHERE id = $1
    `, [userId]);
    return result.rows[0] || null;
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
    // Get average price for similar services
    const result = await query(`
      SELECT AVG(price) as avg_price 
      FROM services s
      JOIN service_categories c ON s.category_id = c.id
      WHERE c.name = $1 
      AND s.duration_minutes = $2
      AND s.created_at > NOW() - INTERVAL '30 days'
      AND s.status = 'active'
    `, [category, duration]);
    
    return parseFloat(result.rows[0]?.avg_price) || null;
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
    const recentUpdates = await query(`
      SELECT COUNT(*) as count 
      FROM trust_events 
      WHERE user_id = $1 
      AND event_type = 'profile_update'
      AND created_at > NOW() - INTERVAL '24 hours'
    `, [userId]);
    
    const updateCount = parseInt(recentUpdates.rows[0]?.count || 0);
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
      const failedLogins = await query(`
        SELECT COUNT(*) as count 
        FROM trust_events 
        WHERE user_id = $1 
        AND event_type = 'login_failed'
        AND created_at > NOW() - INTERVAL '1 hour'
      `, [userId]);
      
      const failedCount = parseInt(failedLogins.rows[0]?.count || 0);
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
        const lastLogin = await query(`
          SELECT ip_address, created_at 
          FROM user_sessions 
          WHERE user_id = $1 
          AND ip_address IS NOT NULL
          ORDER BY created_at DESC 
          LIMIT 1 OFFSET 1
        `, [userId]);
        
        if (lastLogin.rows.length > 0 && lastLogin.rows[0].ip_address) {
          const previousIP = lastLogin.rows[0].ip_address;
          const timeDiff = Date.now() - new Date(lastLogin.rows[0].created_at).getTime();
          
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
      const recentLogins = await query(`
        SELECT COUNT(*) as count 
        FROM trust_events 
        WHERE user_id = $1 
        AND event_type = 'login'
        AND created_at > NOW() - INTERVAL '5 minutes'
      `, [userId]);
      
      const recentCount = parseInt(recentLogins.rows[0]?.count || 0);
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
      await query(`
        INSERT INTO fraud_logs (
          user_id, fraud_type, confidence_score, evidence, action_taken
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        userId,
        actionType,
        analysisResult.riskScore,
        JSON.stringify({
          riskFactors: analysisResult.riskFactors,
          riskLevel: analysisResult.riskLevel
        }),
        analysisResult.recommendation
      ]);
    } catch (error) {
      console.error('Failed to log fraud analysis:', error);
    }
  }
}

module.exports = FraudDetection;