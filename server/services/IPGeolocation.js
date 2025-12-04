/**
 * IP Geolocation Service
 * Uses ipgeolocation.io API for accurate IP-based location detection
 * Used for fraud detection, location verification, and user analytics
 */

class IPGeolocation {
  constructor() {
    this.apiKey = process.env.IP_GEOLOCATION_API_KEY || '1d24707d2a554ee697b852f28dd6533e';
    this.baseUrl = 'https://api.ipgeolocation.io';
    this.cache = new Map(); // Simple in-memory cache
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 hours cache
    this.initialized = false;
  }

  async initialize() {
    try {
      console.log('🌍 Initializing IP Geolocation Service...');
      // Test the API connection
      const testResult = await this.lookup('8.8.8.8');
      if (testResult && testResult.ip) {
        this.initialized = true;
        console.log('✅ IP Geolocation Service initialized successfully');
        return true;
      }
      throw new Error('API test failed');
    } catch (error) {
      console.error('❌ IP Geolocation initialization failed:', error.message);
      // Continue without IP geolocation - graceful degradation
      this.initialized = false;
      return false;
    }
  }

  isHealthy() {
    return this.initialized;
  }

  /**
   * Look up IP address information
   * @param {string} ip - IP address to look up
   * @returns {Object} Geolocation data
   */
  async lookup(ip) {
    try {
      // Skip lookup for local/private IPs
      if (this.isPrivateIP(ip)) {
        return this.getLocalIPResponse(ip);
      }

      // Check cache first
      const cached = this.getFromCache(ip);
      if (cached) {
        return cached;
      }

      // Make API request
      const response = await fetch(
        `${this.baseUrl}/ipgeo?apiKey=${this.apiKey}&ip=${ip}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();

      // Transform and cache the response
      const result = this.transformResponse(data);
      this.setCache(ip, result);

      return result;
    } catch (error) {
      console.error(`IP lookup failed for ${ip}:`, error.message);
      return this.getFallbackResponse(ip);
    }
  }

  /**
   * Get security threat information for an IP
   * @param {string} ip - IP address to check
   * @returns {Object} Security assessment
   */
  async getSecurityInfo(ip) {
    try {
      if (this.isPrivateIP(ip)) {
        return { 
          isThreat: false, 
          isProxy: false, 
          isVpn: false, 
          isTor: false,
          threatLevel: 'low'
        };
      }

      const response = await fetch(
        `${this.baseUrl}/ipgeo?apiKey=${this.apiKey}&ip=${ip}&include=security`,
        {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }
      );

      if (!response.ok) {
        throw new Error(`Security API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        isThreat: data.security?.is_known_attacker || false,
        isProxy: data.security?.is_proxy || false,
        isVpn: data.security?.is_vpn || false,
        isTor: data.security?.is_tor || false,
        isBot: data.security?.is_bot || false,
        isSpam: data.security?.is_spam || false,
        threatLevel: this.calculateThreatLevel(data.security),
        raw: data.security
      };
    } catch (error) {
      console.error(`Security check failed for ${ip}:`, error.message);
      return {
        isThreat: false,
        isProxy: false,
        isVpn: false,
        isTor: false,
        threatLevel: 'unknown'
      };
    }
  }

  /**
   * Analyze IP for fraud risk
   * @param {string} ip - IP address
   * @param {string} expectedCountry - Expected country code
   * @returns {Object} Risk assessment
   */
  async analyzeIPRisk(ip, expectedCountry = null) {
    try {
      const [geoData, securityData] = await Promise.all([
        this.lookup(ip),
        this.getSecurityInfo(ip)
      ]);

      const riskFactors = [];
      let riskScore = 0;

      // Check for VPN/Proxy/Tor
      if (securityData.isVpn) {
        riskFactors.push('vpn_detected');
        riskScore += 0.3;
      }
      if (securityData.isProxy) {
        riskFactors.push('proxy_detected');
        riskScore += 0.4;
      }
      if (securityData.isTor) {
        riskFactors.push('tor_exit_node');
        riskScore += 0.6;
      }
      if (securityData.isThreat) {
        riskFactors.push('known_attacker');
        riskScore += 0.8;
      }
      if (securityData.isBot) {
        riskFactors.push('bot_detected');
        riskScore += 0.5;
      }

      // Check for country mismatch
      if (expectedCountry && geoData.countryCode) {
        if (geoData.countryCode.toLowerCase() !== expectedCountry.toLowerCase()) {
          riskFactors.push(`country_mismatch: expected ${expectedCountry}, got ${geoData.countryCode}`);
          riskScore += 0.4;
        }
      }

      // Check for high-risk countries (configurable)
      const highRiskCountries = process.env.HIGH_RISK_COUNTRIES?.split(',') || [];
      if (highRiskCountries.includes(geoData.countryCode)) {
        riskFactors.push('high_risk_country');
        riskScore += 0.3;
      }

      return {
        ip,
        location: geoData,
        security: securityData,
        riskFactors,
        riskScore: Math.min(riskScore, 1.0),
        riskLevel: riskScore >= 0.6 ? 'high' : riskScore >= 0.3 ? 'medium' : 'low',
        isSuspicious: riskScore >= 0.5
      };
    } catch (error) {
      console.error(`IP risk analysis failed for ${ip}:`, error.message);
      return {
        ip,
        riskFactors: ['analysis_failed'],
        riskScore: 0.2,
        riskLevel: 'low',
        isSuspicious: false
      };
    }
  }

  /**
   * Check if user is accessing from expected African region
   * @param {string} ip - IP address
   * @returns {Object} African region check result
   */
  async checkAfricanRegion(ip) {
    const africanCountries = [
      'NG', 'GH', 'KE', 'ZA', 'EG', 'ET', 'TZ', 'UG', 'DZ', 'SD', 'MA', 'AO',
      'MZ', 'CM', 'CI', 'MG', 'NE', 'BF', 'MW', 'ML', 'ZM', 'SN', 'ZW', 'TD',
      'SO', 'GN', 'RW', 'BJ', 'BW', 'TN', 'SS', 'TG', 'SL', 'LY', 'CG', 'LR',
      'CF', 'MR', 'ER', 'GM', 'NA', 'BW', 'LS', 'GW', 'GA', 'SZ', 'MU', 'GQ',
      'DJ', 'KM', 'CV', 'ST', 'SC', 'RE', 'YT', 'SH'
    ];

    try {
      const geoData = await this.lookup(ip);
      const countryCode = geoData.countryCode?.toUpperCase();
      
      return {
        isAfrican: africanCountries.includes(countryCode),
        country: geoData.country,
        countryCode,
        city: geoData.city,
        region: geoData.region
      };
    } catch (error) {
      return {
        isAfrican: null,
        error: error.message
      };
    }
  }

  /**
   * Calculate velocity between two IP-based locations
   * Used to detect impossible travel patterns (fraud indicator)
   * @param {string} ip1 - First IP address
   * @param {string} ip2 - Second IP address
   * @param {number} timeDiffMs - Time difference in milliseconds
   * @returns {Object} Velocity analysis
   */
  async calculateTravelVelocity(ip1, ip2, timeDiffMs) {
    try {
      const [loc1, loc2] = await Promise.all([
        this.lookup(ip1),
        this.lookup(ip2)
      ]);

      if (!loc1.latitude || !loc2.latitude) {
        return { error: 'Unable to determine locations' };
      }

      const distance = this.haversineDistance(
        loc1.latitude, loc1.longitude,
        loc2.latitude, loc2.longitude
      );

      const hours = timeDiffMs / (1000 * 60 * 60);
      const velocity = distance / hours; // km/h

      // Max realistic travel speed: ~1000 km/h (commercial jet)
      const isImpossibleTravel = velocity > 1000;
      // Suspicious if > 500 km/h without at least 2 hours gap
      const isSuspiciousTravel = velocity > 500 && hours < 2;

      return {
        distance: Math.round(distance),
        timeDiffHours: hours.toFixed(2),
        velocityKmH: Math.round(velocity),
        isImpossibleTravel,
        isSuspiciousTravel,
        location1: `${loc1.city}, ${loc1.country}`,
        location2: `${loc2.city}, ${loc2.country}`
      };
    } catch (error) {
      return { error: error.message };
    }
  }

  // ============ Helper Methods ============

  isPrivateIP(ip) {
    if (!ip) return true;
    return (
      ip === '::1' ||
      ip === '127.0.0.1' ||
      ip === 'localhost' ||
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      ip.startsWith('172.16.') ||
      ip.startsWith('172.17.') ||
      ip.startsWith('172.18.') ||
      ip.startsWith('172.19.') ||
      ip.startsWith('172.2') ||
      ip.startsWith('172.30.') ||
      ip.startsWith('172.31.') ||
      ip.startsWith('fe80:') ||
      ip.startsWith('fc00:') ||
      ip.startsWith('fd00:')
    );
  }

  getLocalIPResponse(ip) {
    return {
      ip,
      country: 'Local Network',
      countryCode: 'LOCAL',
      city: 'Local',
      region: 'Local',
      latitude: null,
      longitude: null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isp: 'Local Network',
      isLocal: true
    };
  }

  getFallbackResponse(ip) {
    return {
      ip,
      country: 'Unknown',
      countryCode: 'XX',
      city: 'Unknown',
      region: 'Unknown',
      latitude: null,
      longitude: null,
      timezone: null,
      isp: 'Unknown',
      error: 'Lookup failed'
    };
  }

  transformResponse(data) {
    return {
      ip: data.ip,
      country: data.country_name,
      countryCode: data.country_code2,
      countryCode3: data.country_code3,
      city: data.city,
      region: data.state_prov,
      district: data.district,
      zipCode: data.zipcode,
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude),
      timezone: data.time_zone?.name,
      timezoneOffset: data.time_zone?.offset,
      isp: data.isp,
      organization: data.organization,
      asn: data.asn,
      connectionType: data.connection_type,
      currency: {
        code: data.currency?.code,
        name: data.currency?.name,
        symbol: data.currency?.symbol
      },
      callingCode: data.calling_code,
      countryFlag: data.country_flag,
      languages: data.languages,
      isEu: data.is_eu
    };
  }

  calculateThreatLevel(security) {
    if (!security) return 'unknown';
    
    let threatScore = 0;
    if (security.is_known_attacker) threatScore += 3;
    if (security.is_tor) threatScore += 2;
    if (security.is_proxy) threatScore += 1;
    if (security.is_vpn) threatScore += 0.5;
    if (security.is_bot) threatScore += 1;
    if (security.is_spam) threatScore += 1;

    if (threatScore >= 3) return 'high';
    if (threatScore >= 1.5) return 'medium';
    return 'low';
  }

  haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  getFromCache(ip) {
    const cached = this.cache.get(ip);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }
    return null;
  }

  setCache(ip, data) {
    this.cache.set(ip, {
      data,
      timestamp: Date.now()
    });

    // Clean old entries if cache gets too large
    if (this.cache.size > 10000) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = IPGeolocation;
