const express = require('express');
const rateLimit = require('express-rate-limit');
const { authMiddleware } = require('./auth');

// Services are injected via middleware (req.locationTrackingService, req.locationVerificationService)
// No module-level instantiation needed — this avoids initialization before DB is ready.

const router = express.Router();

// Rate limiter for unauthenticated public routes
const publicRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per window
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @route   GET /api/geolocation/lookup
 * @desc    Get IP geolocation data for current user's IP
 * @access  Private
 */
router.get('/lookup', authMiddleware, async (req, res) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || req.connection?.remoteAddress;
    
    if (!req.fraudDetection || !req.fraudDetection.getIPGeolocation) {
      return res.status(503).json({ error: 'IP Geolocation service not available' });
    }
    
    const ipGeolocation = req.fraudDetection.getIPGeolocation();
    const geoData = await ipGeolocation.lookup(ip);
    
    res.json({
      status: 'success',
      data: {
        ip: geoData.ip,
        country: geoData.country,
        countryCode: geoData.countryCode,
        city: geoData.city,
        region: geoData.region,
        timezone: geoData.timezone,
        coordinates: {
          latitude: geoData.latitude,
          longitude: geoData.longitude
        },
        isp: geoData.isp,
        currency: geoData.currency
      }
    });
  } catch (error) {
    console.error('Geolocation lookup error:', error);
    res.status(500).json({ error: 'Failed to get location data' });
  }
});

/**
 * @route   GET /api/geolocation/lookup-city
 * @desc    Lookup city coordinates and metadata (public)
 */
router.get('/lookup-city', publicRateLimiter, async (req, res) => {
  try {
    const { city, country } = req.query;
    if (!city) {
      return res.status(400).json({ error: 'city is required' });
    }

    const result = await req.locationTrackingService.getCityCoordinates(city, country);
    if (!result) {
      return res.status(404).json({ error: 'City not found' });
    }

    res.json({
      status: 'success',
      data: {
        city: result.city,
        country: result.country,
        countryCode: result.countryCode,
        lat: result.lat,
        lng: result.lng,
        region: result.region,
        timezone: result.timezone || null,
        isCapital: result.isCapital || false,
        source: result.source || 'database'
      }
    });
  } catch (error) {
    console.error('City lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup city' });
  }
});

/**
 * @route   POST /api/geolocation/ip-detect
 * @desc    Proxy IP geolocation lookup (frontend-safe)
 * @access  Public
 */
router.post('/ip-detect', async (req, res) => {
  try {
    const bodyIp = req.body?.ipAddress;
    const forwarded = req.headers['x-forwarded-for']?.split(',')[0];
    const ip = bodyIp || forwarded || req.ip || req.connection?.remoteAddress;

    const ipLocation = await req.locationTrackingService.processIPLocation(ip);
    if (!ipLocation) {
      return res.status(503).json({ error: 'IP lookup failed' });
    }

    res.json({
      status: 'success',
      data: {
        ...ipLocation,
        source: 'ip_proxy'
      }
    });
  } catch (error) {
    console.error('IP detect proxy error:', error);
    res.status(500).json({ error: 'Failed to detect IP location' });
  }
});

/**
 * @route   GET /api/geolocation/ip/:ip
 * @desc    Look up specific IP address (admin only)
 * @access  Private (Admin)
 */
router.get('/ip/:ip', authMiddleware, async (req, res) => {
  try {
    const { ip } = req.params;
    
    // Check if user is admin using DB lookup (verificationTier is unreliable)
    const { User } = require('../config/database');
    const adminUser = await User.findById(req.user.userId).select('is_admin role').lean();
    if (!adminUser || (adminUser.is_admin !== true && adminUser.role !== 'admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    if (!req.fraudDetection || !req.fraudDetection.getIPGeolocation) {
      return res.status(503).json({ error: 'IP Geolocation service not available' });
    }
    
    const ipGeolocation = req.fraudDetection.getIPGeolocation();
    const [geoData, securityData] = await Promise.all([
      ipGeolocation.lookup(ip),
      ipGeolocation.getSecurityInfo(ip)
    ]);
    
    res.json({
      status: 'success',
      data: {
        ...geoData,
        security: securityData
      }
    });
  } catch (error) {
    console.error('IP lookup error:', error);
    res.status(500).json({ error: 'Failed to lookup IP' });
  }
});

/**
 * @route   GET /api/geolocation/risk
 * @desc    Get IP risk assessment for current user
 * @access  Private
 */
router.get('/risk', authMiddleware, async (req, res) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || req.connection?.remoteAddress;
    
    if (!req.fraudDetection || !req.fraudDetection.getIPGeolocation) {
      return res.status(503).json({ error: 'IP Geolocation service not available' });
    }
    
    const ipGeolocation = req.fraudDetection.getIPGeolocation();
    const riskData = await ipGeolocation.analyzeIPRisk(ip);
    
    res.json({
      status: 'success',
      data: {
        ip: riskData.ip,
        riskLevel: riskData.riskLevel,
        riskScore: riskData.riskScore,
        isSuspicious: riskData.isSuspicious,
        factors: riskData.riskFactors,
        location: riskData.location ? {
          country: riskData.location.country,
          city: riskData.location.city
        } : null
      }
    });
  } catch (error) {
    console.error('Risk assessment error:', error);
    res.status(500).json({ error: 'Failed to assess risk' });
  }
});

/**
 * @route   GET /api/geolocation/african-check
 * @desc    Check if user is in African region
 * @access  Private
 */
router.get('/african-check', authMiddleware, async (req, res) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || req.connection?.remoteAddress;
    
    if (!req.fraudDetection || !req.fraudDetection.getIPGeolocation) {
      return res.status(503).json({ error: 'IP Geolocation service not available' });
    }
    
    const ipGeolocation = req.fraudDetection.getIPGeolocation();
    const africanCheck = await ipGeolocation.checkAfricanRegion(ip);
    
    res.json({
      status: 'success',
      data: africanCheck
    });
  } catch (error) {
    console.error('African region check error:', error);
    res.status(500).json({ error: 'Failed to check region' });
  }
});

/**
 * @route   GET /api/geolocation/health
 * @desc    Check IP Geolocation service health
 * @access  Public
 */
router.get('/health', async (req, res) => {
  try {
    if (!req.fraudDetection || !req.fraudDetection.getIPGeolocation) {
      return res.json({
        status: 'unavailable',
        message: 'IP Geolocation service not initialized'
      });
    }
    
    const ipGeolocation = req.fraudDetection.getIPGeolocation();
    const isHealthy = ipGeolocation.isHealthy();
    
    res.json({
      status: isHealthy ? 'healthy' : 'degraded',
      initialized: isHealthy
    });
  } catch (error) {
    res.json({
      status: 'error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/geolocation/nearest-city
 * @desc    Find nearest city to given coordinates
 * @access  Public
 */
router.get('/nearest-city', async (req, res) => {
  try {
    const { lat, lng, country } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        success: false,
        error: 'lat and lng query parameters are required' 
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ 
        success: false,
        error: 'lat and lng must be valid numbers' 
      });
    }

    const nearestCity = req.locationVerificationService.findNearestCity(
      latitude, 
      longitude, 
      country || null
    );

    if (!nearestCity) {
      return res.status(404).json({ 
        success: false,
        error: 'No city found near these coordinates' 
      });
    }

    res.json({
      success: true,
      city: nearestCity.city,
      country: nearestCity.country,
      distance: nearestCity.distance,
      lat: nearestCity.lat,
      lng: nearestCity.lng,
      region: nearestCity.region,
      population: nearestCity.population
    });
  } catch (error) {
    console.error('Nearest city lookup error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to find nearest city' 
    });
  }
});

/**
 * @route   GET /api/geolocation/cities/:countryCode
 * @desc    Get all cities for a country (for dropdowns)
 * @access  Public
 */
router.get('/cities/:countryCode', async (req, res) => {
  try {
    const { countryCode } = req.params;

    if (!countryCode) {
      return res.status(400).json({ 
        success: false,
        error: 'countryCode is required' 
      });
    }

    const cities = req.locationVerificationService.getCitiesForCountry(countryCode.toUpperCase());

    res.json({
      success: true,
      countryCode: countryCode.toUpperCase(),
      count: cities.length,
      cities
    });
  } catch (error) {
    console.error('Cities list error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get cities list' 
    });
  }
});

/**
 * @route   GET /api/geolocation/supported-countries
 * @desc    Get list of supported countries
 * @access  Public
 */
router.get('/supported-countries', async (req, res) => {
  try {
    const countries = req.locationVerificationService.getSupportedCountries();

    res.json({
      success: true,
      count: countries.length,
      countries
    });
  } catch (error) {
    console.error('Supported countries error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get supported countries' 
    });
  }
});

/**
 * @route   POST /api/geolocation/check-location-change
 * @desc    Check if user's location has changed significantly
 * @access  Private
 */
router.post('/check-location-change', authMiddleware, async (req, res) => {
  try {
    const { currentLat, currentLng } = req.body;
    const user = req.user;

    if (!currentLat || !currentLng) {
      return res.status(400).json({ 
        success: false,
        error: 'currentLat and currentLng are required' 
      });
    }

    // Get user's stored location from profile
    const profileData = user.profile_data || user.profileData || {};
    const storedLocation = profileData.location || {};

    const changeResult = req.locationVerificationService.detectLocationChange(
      { lat: parseFloat(currentLat), lng: parseFloat(currentLng) },
      storedLocation
    );

    res.json({
      success: true,
      ...changeResult
    });
  } catch (error) {
    console.error('Location change check error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to check location change' 
    });
  }
});

module.exports = router;
