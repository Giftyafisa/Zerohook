const express = require('express');
const { authMiddleware } = require('./auth');
const { body, validationResult } = require('express-validator');
const router = express.Router();

/**
 * @route   GET /api/countries
 * @desc    Get all supported African countries
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const CountryManager = require('../services/CountryManager');
    const countryManager = new CountryManager();
    
    const countries = countryManager.getAllCountries();
    
    res.json({
      success: true,
      countries: countries.map(country => ({
        code: country.code,
        name: country.name,
        flag: country.flag,
        currency: country.currency,
        currencySymbol: country.currencySymbol,
        timezone: country.timezone,
        phoneCode: country.phoneCode,
        paystackSupport: country.paystackSupport,
        localBanks: country.localBanks,
        mobileMoney: country.mobileMoney,
        cryptoPlatforms: country.cryptoPlatforms
      }))
    });
  } catch (error) {
    console.error('Get countries error:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

/**
 * @route   GET /api/countries/:code
 * @desc    Get specific country details
 * @access  Public
 */
router.get('/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const CountryManager = require('../services/CountryManager');
    const countryManager = new CountryManager();
    
    const country = countryManager.getCountryByCode(code);
    
    if (!country) {
      return res.status(404).json({ error: 'Country not found' });
    }
    
    res.json({
      success: true,
      country: {
        code: country.code,
        name: country.name,
        flag: country.flag,
        currency: country.currency,
        currencySymbol: country.currencySymbol,
        timezone: country.timezone,
        phoneCode: country.phoneCode,
        paystackSupport: country.paystackSupport,
        localBanks: country.localBanks,
        mobileMoney: country.mobileMoney,
        cryptoPlatforms: country.cryptoPlatforms
      }
    });
  } catch (error) {
    console.error('Get country error:', error);
    res.status(500).json({ error: 'Failed to fetch country' });
  }
});

/**
 * @route   POST /api/countries/detect
 * @desc    Detect user's country based on IP address
 * @access  Private
 */
router.post('/detect', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { ipAddress } = req.body;
    
    if (!ipAddress) {
      return res.status(400).json({ error: 'IP address is required' });
    }
    
    const CountryManager = require('../services/CountryManager');
    const countryManager = new CountryManager();
    
    const detectionResult = await countryManager.detectUserCountry(ipAddress);
    
    if (detectionResult.success) {
      // Store detected country for user
      await countryManager.setDetectedCountry(userId, detectionResult.country.code);
      
      res.json({
        success: true,
        detectedCountry: detectionResult.country,
        method: detectionResult.method,
        confidence: detectionResult.confidence,
        message: `Country detected: ${detectionResult.country.name}`
      });
    } else {
      res.status(400).json({ error: 'Country detection failed' });
    }
  } catch (error) {
    console.error('Country detection error:', error);
    res.status(500).json({ error: 'Failed to detect country' });
  }
});

/**
 * @route   GET /api/countries/user/preference
 * @desc    Get user's country preference
 * @access  Private
 */
router.get('/user/preference', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const CountryManager = require('../services/CountryManager');
    const countryManager = new CountryManager();
    
    const userCountry = await countryManager.getUserCountry(userId);
    
    if (userCountry.success) {
      res.json({
        success: true,
        preference: userCountry.country,
        detected: userCountry.detectedCountry,
        availableCountries: countryManager.getAllCountries()
      });
    } else {
      res.status(404).json({ error: userCountry.error });
    }
  } catch (error) {
    console.error('Get user country error:', error);
    res.status(500).json({ error: 'Failed to fetch user country' });
  }
});

/**
 * @route   PUT /api/countries/user/preference
 * @desc    Update user's country preference
 * @access  Private
 */
router.put('/user/preference', authMiddleware, [
  body('countryCode').isLength({ min: 2, max: 2 }).withMessage('Country code must be 2 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { countryCode } = req.body;
    const userId = req.user.userId;
    
    const CountryManager = require('../services/CountryManager');
    const countryManager = new CountryManager();
    
    const updateResult = await countryManager.updateUserCountry(userId, countryCode);
    
    if (updateResult.success) {
      res.json({
        success: true,
        message: updateResult.message,
        country: updateResult.country
      });
    } else {
      res.status(400).json({ error: updateResult.error });
    }
  } catch (error) {
    console.error('Update user country error:', error);
    res.status(500).json({ error: 'Failed to update user country' });
  }
});

/**
 * @route   GET /api/countries/:code/payment-methods
 * @desc    Get country-specific payment methods
 * @access  Public
 */
router.get('/:code/payment-methods', async (req, res) => {
  try {
    const { code } = req.params;
    const CountryManager = require('../services/CountryManager');
    const countryManager = new CountryManager();
    
    const paymentMethods = countryManager.getCountryPaymentMethods(code);
    
    res.json({
      success: true,
      countryCode: code,
      paymentMethods: paymentMethods
    });
  } catch (error) {
    console.error('Get country payment methods error:', error);
    res.status(500).json({ error: 'Failed to fetch payment methods' });
  }
});

/**
 * @route   GET /api/countries/:code/crypto-platforms
 * @desc    Get country-specific crypto platforms
 * @access  Public
 */
router.get('/:code/crypto-platforms', async (req, res) => {
  try {
    const { code } = req.params;
    const CountryManager = require('../services/CountryManager');
    const countryManager = new CountryManager();
    
    const cryptoPlatforms = countryManager.getCryptoPlatforms(code);
    
    res.json({
      success: true,
      countryCode: code,
      cryptoPlatforms: cryptoPlatforms
    });
  } catch (error) {
    console.error('Get country crypto platforms error:', error);
    res.status(500).json({ error: 'Failed to fetch crypto platforms' });
  }
});

/**
 * @route   GET /api/countries/ghana/crypto-platforms
 * @desc    Get Ghanaian-specific crypto platforms
 * @access  Public
 */
router.get('/ghana/crypto-platforms', async (req, res) => {
  try {
    const CountryManager = require('../services/CountryManager');
    const countryManager = new CountryManager();
    
    const ghanaianPlatforms = countryManager.getGhanaianCryptoPlatforms();
    
    res.json({
      success: true,
      country: 'Ghana',
      flag: '🇬🇭',
      currency: 'GHS',
      cryptoPlatforms: ghanaianPlatforms,
      specialFeatures: {
        bitnob: 'Ghanaian crypto platform with local bank integration',
        mobileMoney: 'MTN, Vodafone, AirtelTigo support',
        localBanks: 'All major Ghanaian banks supported',
        localSupport: '24/7 Ghanaian customer support'
      }
    });
  } catch (error) {
    console.error('Get Ghanaian crypto platforms error:', error);
    res.status(500).json({ error: 'Failed to fetch Ghanaian crypto platforms' });
  }
});

/**
 * @route   GET /api/countries/features/:feature
 * @desc    Get countries by specific feature
 * @access  Public
 */
router.get('/features/:feature', async (req, res) => {
  try {
    const { feature } = req.params;
    const CountryManager = require('../services/CountryManager');
    const countryManager = new CountryManager();
    
    const countries = countryManager.getCountriesByFeature(feature);
    
    res.json({
      success: true,
      feature: feature,
      countries: countries.map(country => ({
        code: country.code,
        name: country.name,
        flag: country.flag,
        currency: country.currency,
        currencySymbol: country.currencySymbol
      }))
    });
  } catch (error) {
    console.error('Get countries by feature error:', error);
    res.status(500).json({ error: 'Failed to fetch countries by feature' });
  }
});

/**
 * @route   GET /api/countries/ghana/bitnob/features
 * @desc    Get Bitnob Ghanaian-specific features
 * @access  Public
 */
router.get('/ghana/bitnob/features', async (req, res) => {
  try {
    const BitnobManager = require('../services/BitnobManager');
    const bitnob = new BitnobManager();
    
    const features = bitnob.getGhanaianFeatures();
    
    res.json({
      success: true,
      platform: 'Bitnob',
      country: 'Ghana',
      features: features
    });
  } catch (error) {
    console.error('Get Bitnob features error:', error);
    res.status(500).json({ error: 'Failed to fetch Bitnob features' });
  }
});

/**
 * @route   GET /api/countries/ghana/bitnob/banks
 * @desc    Get Ghanaian banks supported by Bitnob
 * @access  Public
 */
router.get('/ghana/bitnob/banks', async (req, res) => {
  try {
    const BitnobManager = require('../services/BitnobManager');
    const bitnob = new BitnobManager();
    
    const banks = await bitnob.getGhanaianBanks();
    
    res.json({
      success: true,
      country: 'Ghana',
      platform: 'Bitnob',
      banks: banks
    });
  } catch (error) {
    console.error('Get Ghanaian banks error:', error);
    res.status(500).json({ error: 'Failed to fetch Ghanaian banks' });
  }
});

module.exports = router;
