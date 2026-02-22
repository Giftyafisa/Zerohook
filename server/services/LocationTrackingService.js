/**
 * Advanced Location Tracking Service
 * 
 * FEATURES:
 * - Multi-tier location detection with fallback cascade
 * - GPS coordinates (highest accuracy)
 * - User's profile location (city/country from registration)
 * - IP-based geolocation (automatic for guests)
 * - Location history tracking
 * - Accurate Haversine distance calculations
 * - Global support with validation
 * - Caching for performance
 * 
 * PRIORITY ORDER:
 * 1. GPS coordinates (if provided by frontend)
 * 2. User's saved location in profile (city/country)
 * 3. IP-based geolocation
 * 4. Fallback to default
 */

const IPGeolocation = require('./IPGeolocation');
const { GLOBAL_CITIES } = require('../../shared/utils/globalCityData');
const mongoose = require('mongoose');
const { User, UserActivityLog } = require('../config/database');

// Simple Levenshtein distance for fuzzy city matching
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);

  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

class LocationTrackingService {
  constructor() {
    this.ipGeoService = new IPGeolocation();
    this.locationCache = new Map();
    this.cacheExpiry = 10 * 60 * 1000; // 10 minutes
    this.maxCacheSize = 5000;
    
    // Global city coordinates database (expandable)
    this.cityCoordinates = this.loadGlobalCityCoordinates();
  }

  async initialize() {
    console.log('📍 Initializing Location Tracking Service...');
    await this.ipGeoService.initialize();
    
    // Periodic cache cleanup every 5 minutes
    setInterval(() => this.cleanupExpiredCache(), 5 * 60 * 1000);
    
    console.log('✅ Location Tracking Service initialized');
  }

  /**
   * MAIN METHOD: Get user's location with full fallback cascade
   * 
   * @param {Object} options
   * @param {string} options.userId - User ID (if registered)
   * @param {Object} options.providedCoords - GPS coordinates from frontend { lat, lng }
   * @param {Object} options.userProfile - User's profile data with location
   * @param {boolean} options.preferProfileLocation - User preference to prioritize profile location over live GPS
   * @param {string} options.ipAddress - User's IP address
   * @param {string} options.sessionId - Session ID for guests
   * @returns {Object} Location data with confidence level
   */
  async getUserLocation(options) {
    const { userId, providedCoords, userProfile, ipAddress, sessionId, preferProfileLocation = false } = options;
    
    console.log(`\n📍 Location Detection Started for ${userId || sessionId || 'guest'}`);
    const profilePreference = preferProfileLocation || userProfile?.location?.preferProfileLocation;

    // If user prefers profile location, elevate it above live GPS
    if (profilePreference && userProfile && (userProfile.location || userProfile.city || userProfile.country)) {
      const preferredProfileLocation = await this.processProfileLocation(userProfile);
      if (preferredProfileLocation) {
        console.log(`✅ Profile-first Location: ${preferredProfileLocation.city}, ${preferredProfileLocation.country}`);
        // Fire-and-forget: don't block response on DB write
        this.saveLocationHistory(userId, preferredProfileLocation, 'profile_preferred').catch(e => console.error('Location save error:', e));
        this.setCachedLocation(userId || sessionId, preferredProfileLocation);
        return preferredProfileLocation;
      }
    }

    // TIER 1: GPS Coordinates (highest accuracy) unless profile override
    if (!profilePreference && providedCoords && providedCoords.lat && providedCoords.lng) {
      const gpsLocation = await this.processGPSCoordinates(providedCoords);
      if (gpsLocation) {
        console.log(`✅ GPS Location: ${gpsLocation.city}, ${gpsLocation.country} (${gpsLocation.lat.toFixed(4)}, ${gpsLocation.lng.toFixed(4)})`);
        this.saveLocationHistory(userId, gpsLocation, 'gps').catch(e => console.error('Location save error:', e));
        this.setCachedLocation(userId || sessionId, gpsLocation);
        return gpsLocation;
      }
    }

    // TIER 2: User's Profile Location (city/country set during registration)
    if (userProfile && (userProfile.location || userProfile.city || userProfile.country)) {
      const profileLocation = await this.processProfileLocation(userProfile);
      if (profileLocation) {
        console.log(`✅ Profile Location: ${profileLocation.city}, ${profileLocation.country}`);
        this.saveLocationHistory(userId, profileLocation, 'profile').catch(e => console.error('Location save error:', e));
        this.setCachedLocation(userId || sessionId, profileLocation);
        return profileLocation;
      }
    }

    // TIER 3: IP-Based Geolocation
    if (ipAddress && !this.ipGeoService.isPrivateIP(ipAddress)) {
      const ipLocation = await this.processIPLocation(ipAddress);
      if (ipLocation) {
        console.log(`✅ IP Location: ${ipLocation.city}, ${ipLocation.country} (from IP: ${ipAddress})`);
        this.saveLocationHistory(userId, ipLocation, 'ip').catch(e => console.error('Location save error:', e));
        this.setCachedLocation(userId || sessionId, ipLocation);
        return ipLocation;
      }
    }

    // TIER 4: Fallback to cached or default
    const cachedLocation = await this.getCachedLocation(userId || sessionId);
    if (cachedLocation) {
      console.log(`⚠️ Using cached location: ${cachedLocation.city}, ${cachedLocation.country}`);
      return cachedLocation;
    }

    // Final fallback
    console.log('⚠️ Using default fallback location');
    return this.getDefaultLocation();
  }

  /**
   * Process GPS coordinates with reverse geocoding
   */
  async processGPSCoordinates(coords) {
    try {
      const lat = parseFloat(coords.lat);
      const lng = parseFloat(coords.lng);

      // Validate coordinates
      if (!this.validateCoordinates(lat, lng)) {
        console.warn('⚠️ Invalid GPS coordinates:', coords);
        return null;
      }

      // Try to find nearest city from our database
      const nearestCity = this.findNearestCity(lat, lng);
      
      return {
        lat,
        lng,
        city: nearestCity?.city || coords.city || 'Unknown',
        country: nearestCity?.country || coords.country || 'Unknown',
        countryCode: nearestCity?.countryCode || null,
        district: nearestCity?.district || null,
        region: nearestCity?.region || null,
        accuracy: coords.accuracy || 'high',
        source: 'gps',
        confidence: 1.0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ GPS processing error:', error.message);
      return null;
    }
  }

  /**
   * Process user's profile location (city/country from registration)
   */
  async processProfileLocation(userProfile) {
    try {
      const location = userProfile.location || {};
      const city = location.city || userProfile.city;
      const country = location.country || userProfile.country;
      
      if (!city && !country) {
        return null;
      }

      // Try to get coordinates from our city database
      const coordinates = await this.getCityCoordinates(city, country);
      const hasCoords = Boolean(coordinates?.lat && coordinates?.lng);
      
      return {
        lat: coordinates?.lat || location.coordinates?.lat || null,
        lng: coordinates?.lng || location.coordinates?.lng || null,
        city: city || 'Unknown',
        country: country || 'Unknown',
        countryCode: coordinates?.countryCode || location.countryCode || null,
        district: location.district || coordinates?.district || null,
        region: location.region || coordinates?.region || null,
        accuracy: hasCoords ? 'city' : 'country',
        source: 'profile',
        confidence: hasCoords ? 0.9 : 0.7,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Profile location processing error:', error.message);
      return null;
    }
  }

  /**
   * Process IP-based geolocation
   */
  async processIPLocation(ipAddress) {
    try {
      const ipData = await this.ipGeoService.lookup(ipAddress);
      
      if (!ipData || ipData.error) {
        return null;
      }

      return {
        lat: ipData.latitude,
        lng: ipData.longitude,
        city: ipData.city || 'Unknown',
        country: ipData.country || 'Unknown',
        countryCode: ipData.countryCode,
        district: ipData.district,
        region: ipData.region,
        accuracy: 'city',
        source: 'ip',
        confidence: 0.6,
        ipAddress,
        isp: ipData.isp,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ IP location processing error:', error.message);
      return null;
    }
  }

  /**
   * Calculate distance between two locations using Haversine formula
   */
  calculateDistance(location1, location2) {
    // Handle different location formats
    const lat1 = location1.lat || location1.latitude;
    const lng1 = location1.lng || location1.longitude;
    const lat2 = location2.lat || location2.latitude;
    const lng2 = location2.lng || location2.longitude;

    if (!this.validateCoordinates(lat1, lng1) || !this.validateCoordinates(lat2, lng2)) {
      console.warn('⚠️ Invalid coordinates for distance calculation');
      return null;
    }

    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lng2 - lng1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return Math.round(distance * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Validate coordinates are within valid ranges
   */
  validateCoordinates(lat, lng) {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }

  /**
   * Find nearest city from coordinates
   */
  findNearestCity(lat, lng) {
    if (!this.cityCoordinates || this.cityCoordinates.length === 0) {
      return null;
    }

    let nearestCity = null;
    let minDistance = Infinity;

    for (const city of this.cityCoordinates) {
      const distance = this.calculateDistance(
        { lat, lng },
        { lat: city.lat, lng: city.lng }
      );

      if (distance !== null && distance < minDistance) {
        minDistance = distance;
        nearestCity = { ...city, distance };
      }
    }

    // Only return if city is within reasonable distance (100km)
    return minDistance <= 100 ? nearestCity : null;
  }

  /**
   * Get coordinates for a city/country combination
   */
  async getCityCoordinates(city, country) {
    if (!city || !this.cityCoordinates) {
      return null;
    }

    const cityLower = city.toLowerCase().trim();
    const countryLower = country?.toLowerCase().trim();

    const exactMatch = this.cityCoordinates.find((c) => {
      const cityMatch = c.city.toLowerCase() === cityLower || c.aliases?.some((a) => a.toLowerCase() === cityLower);
      const countryMatch = !countryLower || c.country.toLowerCase() === countryLower || c.countryCode?.toLowerCase() === countryLower;
      return cityMatch && countryMatch;
    });
    if (exactMatch) return exactMatch;

    // Fuzzy alias/partial match
    let bestMatch = null;
    let bestDistance = Infinity;
    for (const candidate of this.cityCoordinates) {
      const namesToCheck = [candidate.city, ...(candidate.aliases || [])];
      for (const name of namesToCheck) {
        const dist = levenshtein(cityLower, name.toLowerCase());
        if (dist < bestDistance) {
          const countryMatch = !countryLower || candidate.country.toLowerCase() === countryLower || candidate.countryCode?.toLowerCase() === countryLower;
          if (countryMatch) {
            bestDistance = dist;
            bestMatch = candidate;
          }
        }
      }
    }

    // Accept fuzzy match only if distance is reasonable (<=2 for short strings or ratio)
    const acceptable = bestMatch && (bestDistance <= 2 || bestDistance / Math.max(cityLower.length, bestMatch.city.length) <= 0.25);
    if (acceptable) {
      return bestMatch;
    }

    // Country capital fallback if provided country
    if (countryLower) {
      const capital = this.cityCoordinates.find((c) => c.isCapital && (c.country.toLowerCase() === countryLower || c.countryCode?.toLowerCase() === countryLower));
      if (capital) return capital;
    }

    // External fallback: Nominatim (OpenStreetMap) without API key
    const external = await this.lookupWithNominatim(city, country);
    if (external) {
      // cache in memory for future calls
      this.cityCoordinates.push(external);
      return external;
    }

    return null;
  }

  /**
   * Save location history for tracking
   */
  async saveLocationHistory(userId, location, source) {
    if (!userId) return;

    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) return;

      // Persist GPS coordinates to user profile (C4 fix)
      // This ensures the recommendation engine has up-to-date locations
      if (location.lat && location.lng && (source === 'gps' || source === 'ip')) {
        await this.persistLocationToProfile(userId, location);
      }

      await UserActivityLog.create({
        userId: new mongoose.Types.ObjectId(userId),
        actionType: 'location_update',
        actionData: {
          latitude: location.lat,
          longitude: location.lng,
          city: location.city,
          country: location.country,
          source,
          accuracy: location.accuracy,
          confidence: location.confidence,
          detectedAt: new Date().toISOString()
        },
        success: true,
        responseTimeMs: 0
      });
    } catch (error) {
      console.error('Location history save error:', error.message);
    }
  }

  /**
   * Persist location data to user's profile_data.location
   * This ensures the recommendation engine and other services
   * have access to the user's latest coordinates.
   */
  async persistLocationToProfile(userId, location) {
    try {
      if (!mongoose.Types.ObjectId.isValid(userId)) return;

      const updateData = {
        'profile_data.location.coordinates': {
          lat: location.lat,
          lng: location.lng
        },
        'profile_data.location.geoPoint': {
          type: 'Point',
          coordinates: [location.lng, location.lat]
        },
        'profile_data.location.lastUpdated': new Date(),
        last_active: new Date()
      };

      // Also update city/country if available and confident
      if (location.city && location.city !== 'Unknown') {
        updateData['profile_data.location.city'] = location.city;
      }
      if (location.country && location.country !== 'Unknown') {
        updateData['profile_data.location.country'] = location.country;
      }
      if (location.countryCode) {
        updateData['profile_data.location.countryCode'] = location.countryCode;
      }
      if (location.region) {
        updateData['profile_data.location.region'] = location.region;
      }

      await User.findByIdAndUpdate(userId, { $set: updateData });
      console.log(`📍 Persisted location to profile for user ${userId}: ${location.city}, ${location.country}`);
    } catch (error) {
      console.error('Location profile persist error:', error.message);
    }
  }

  /**
   * Get cached location
   */
  async getCachedLocation(identifier) {
    if (!identifier) return null;

    const cached = this.locationCache.get(identifier);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return {
        ...cached.data,
        confidence: Math.max(cached.data?.confidence || 0.4, 0.4),
        source: cached.data?.source || 'cache'
      };
    }
    
    // Remove expired entry
    if (cached) {
      this.locationCache.delete(identifier);
    }

    return null;
  }

  /**
   * Set cached location
   */
  setCachedLocation(identifier, location) {
    if (!identifier) return;
    
    // Evict oldest entries if cache is full
    if (this.locationCache.size >= this.maxCacheSize) {
      const excess = this.locationCache.size - this.maxCacheSize + 1;
      const keys = this.locationCache.keys();
      for (let i = 0; i < excess; i++) {
        this.locationCache.delete(keys.next().value);
      }
    }

    this.locationCache.set(identifier, {
      data: location,
      timestamp: Date.now()
    });
  }

  /**
   * Clean up all expired cache entries
   */
  cleanupExpiredCache() {
    const now = Date.now();
    for (const [key, entry] of this.locationCache) {
      if (now - entry.timestamp >= this.cacheExpiry) {
        this.locationCache.delete(key);
      }
    }
  }

  /**
   * Get default fallback location
   */
  getDefaultLocation() {
    return {
      lat: null,
      lng: null,
      city: 'Unknown',
      country: 'Unknown',
      countryCode: null,
      accuracy: 'none',
      source: 'default',
      confidence: 0.1,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Convert degrees to radians
   */
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * External geocoding fallback using Nominatim (OpenStreetMap)
   */
  async lookupWithNominatim(city, country) {
    try {
      const queryParts = [city, country].filter(Boolean).join(', ');
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(queryParts)}`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Zerohook-LocationService/1.0 (+https://zerohook.example)',
          'Accept-Language': 'en'
        }
      });

      if (!response.ok) {
        console.warn('⚠️ Nominatim request failed:', response.status);
        return null;
      }

      const results = await response.json();
      if (!Array.isArray(results) || results.length === 0) {
        return null;
      }

      const top = results[0];
      return {
        city,
        country: country || top.display_name?.split(',').pop()?.trim() || 'Unknown',
        countryCode: top.address?.country_code?.toUpperCase() || null,
        lat: Number(top.lat),
        lng: Number(top.lon),
        region: top.address?.state || null,
        timezone: null,
        aliases: [city],
        isCapital: false
      };
    } catch (error) {
      console.error('Nominatim lookup failed:', error.message);
      return null;
    }
  }

  /**
   * Load global city coordinates database
   * This can be expanded to include cities worldwide
   */
  loadGlobalCityCoordinates() {
    // Normalize incoming dataset (remove non-ASCII noise and ensure numeric coords)
    return GLOBAL_CITIES.map((entry) => {
      const clean = (val) => (typeof val === 'string' ? val.replace(/[^\x20-\x7E]/g, '') : val);
      return {
        city: clean(entry.city),
        country: clean(entry.country),
        countryCode: clean(entry.countryCode),
        lat: Number(entry.lat),
        lng: Number(entry.lng),
        region: clean(entry.region),
        timezone: clean(entry.timezone) || null,
        aliases: (entry.aliases || []).map(clean),
        isCapital: Boolean(entry.isCapital)
      };
    });
  }

  /**
   * Add custom city coordinates (for expanding database)
   */
  addCityCoordinates(cities) {
    if (Array.isArray(cities)) {
      this.cityCoordinates.push(...cities);
    }
  }
}

module.exports = LocationTrackingService;
