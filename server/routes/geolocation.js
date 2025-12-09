const express = require('express');
const { authMiddleware } = require('./auth');
const LocationTrackingService = require('../services/LocationTrackingService');

// Shared location service instance for geolocation utilities
const locationTrackingService = new LocationTrackingService();
locationTrackingService.initialize().catch((err) => {
  console.error('LocationTrackingService init failed (non-fatal):', err.message);
});
const router = express.Router();

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
router.get('/lookup-city', async (req, res) => {
  try {
    const { city, country } = req.query;
    if (!city) {
      return res.status(400).json({ error: 'city is required' });
    }

    const result = await locationTrackingService.getCityCoordinates(city, country);
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

    const ipLocation = await locationTrackingService.processIPLocation(ip);
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
    
    // Check if user is admin
    if (req.user.verificationTier !== 'admin') {
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

module.exports = router;
