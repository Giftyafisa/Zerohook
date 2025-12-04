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

// Major cities for African countries (for autocomplete)
const AFRICAN_CITIES = {
  NG: ['Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt', 'Benin City', 'Kaduna', 'Enugu', 'Onitsha', 'Calabar', 'Warri', 'Aba', 'Jos', 'Ilorin', 'Abeokuta', 'Oyo', 'Owerri', 'Uyo', 'Asaba', 'Akure', 'Maiduguri', 'Sokoto', 'Zaria', 'Lokoja', 'Makurdi', 'Ado-Ekiti', 'Osogbo', 'Bauchi', 'Yola', 'Lafia'],
  GH: ['Accra', 'Kumasi', 'Tamale', 'Takoradi', 'Sekondi', 'Cape Coast', 'Koforidua', 'Tema', 'Ho', 'Sunyani', 'Techiman', 'Wa', 'Bolgatanga', 'Obuasi', 'Teshie', 'Madina', 'Kasoa', 'Dunkwa', 'Nkawkaw', 'Winneba', 'Aflao', 'Agona Swedru', 'Berekum', 'Ejura', 'Hohoe', 'Nsawam', 'Kintampo', 'Akim Oda', 'Bawku', 'Elmina'],
  KE: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret', 'Thika', 'Malindi', 'Kitale', 'Garissa', 'Nyeri', 'Machakos', 'Meru', 'Lamu', 'Naivasha', 'Kakamega', 'Kericho', 'Nanyuki', 'Bungoma', 'Isiolo', 'Embu', 'Kiambu', 'Ruiru', 'Kangundo', 'Kilifi', 'Voi', 'Migori', 'Homa Bay', 'Wote', 'Kajiado', 'Kerugoya'],
  ZA: ['Johannesburg', 'Cape Town', 'Durban', 'Pretoria', 'Port Elizabeth', 'Bloemfontein', 'East London', 'Nelspruit', 'Kimberley', 'Polokwane', 'Pietermaritzburg', 'Rustenburg', 'Witbank', 'Welkom', 'Vereeniging', 'Benoni', 'Springs', 'Boksburg', 'Alberton', 'George', 'Stellenbosch', 'Sandton', 'Soweto', 'Centurion', 'Midrand', 'Randburg', 'Roodepoort', 'Germiston', 'Krugersdorp', 'Tembisa'],
  UG: ['Kampala', 'Gulu', 'Lira', 'Mbarara', 'Jinja', 'Mbale', 'Mukono', 'Masaka', 'Kasese', 'Hoima', 'Entebbe', 'Fort Portal', 'Soroti', 'Arua', 'Kabale', 'Iganga', 'Tororo', 'Mityana', 'Njeru', 'Wakiso', 'Lugazi', 'Masindi', 'Busia', 'Pallisa', 'Kitgum', 'Moroto', 'Moyo', 'Kotido', 'Kalangala', 'Kayunga'],
  TZ: ['Dar es Salaam', 'Mwanza', 'Arusha', 'Dodoma', 'Mbeya', 'Zanzibar City', 'Morogoro', 'Tanga', 'Kigoma', 'Moshi', 'Tabora', 'Iringa', 'Shinyanga', 'Singida', 'Sumbawanga', 'Mtwara', 'Lindi', 'Bukoba', 'Musoma', 'Songea', 'Mpanda', 'Babati', 'Njombe', 'Bagamoyo', 'Kahama', 'Kibaha', 'Kondoa', 'Korogwe', 'Makambako', 'Same'],
  RW: ['Kigali', 'Butare', 'Gitarama', 'Ruhengeri', 'Gisenyi', 'Byumba', 'Cyangugu', 'Kibuye', 'Nyanza', 'Kabuga', 'Rwamagana', 'Muhanga', 'Huye', 'Musanze', 'Rubavu', 'Nyagatare', 'Rusizi', 'Karongi', 'Bugesera', 'Kayonza', 'Gicumbi', 'Gatsibo', 'Kirehe', 'Ngoma', 'Ruhango', 'Burera', 'Gakenke', 'Rutsiro', 'Nyamasheke', 'Nyaruguru'],
  BW: ['Gaborone', 'Francistown', 'Maun', 'Molepolole', 'Serowe', 'Selibe Phikwe', 'Kanye', 'Mahalapye', 'Mogoditshane', 'Mochudi', 'Lobatse', 'Palapye', 'Ramotswa', 'Jwaneng', 'Kasane', 'Tlokweng', 'Letlhakane', 'Orapa', 'Sowa Town', 'Tonota', 'Thamaga', 'Bobonong', 'Tutume', 'Nata', 'Tshabong', 'Shakawe', 'Ghanzi', 'Gumare', 'Hukuntsi', 'Kang'],
  ZM: ['Lusaka', 'Kitwe', 'Ndola', 'Kabwe', 'Chingola', 'Mufulira', 'Livingstone', 'Luanshya', 'Kasama', 'Chipata', 'Choma', 'Solwezi', 'Mansa', 'Mongu', 'Mazabuka', 'Kafue', 'Monze', 'Chililabombwe', 'Kalulushi', 'Kapiri Mposhi', 'Petauke', 'Sesheke', 'Siavonga', 'Mpika', 'Nakonde', 'Mbala', 'Nchelenge', 'Senanga', 'Kaoma', 'Kawambwa'],
  MW: ['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu', 'Mangochi', 'Karonga', 'Salima', 'Nkhotakota', 'Liwonde', 'Nsanje', 'Rumphi', 'Dedza', 'Ntcheu', 'Mchinji', 'Chitipa', 'Thyolo', 'Mulanje', 'Phalombe', 'Machinga', 'Balaka', 'Ntchisi', 'Dowa', 'Nkhata Bay', 'Likoma', 'Chiradzulu', 'Mwanza', 'Chikwawa', 'Neno', 'Luchenza']
};

/**
 * @route   GET /api/countries/:code/cities
 * @desc    Get cities for a specific country (for autocomplete)
 * @access  Public
 */
router.get('/:code/cities', async (req, res) => {
  try {
    const { code } = req.params;
    const { search = '' } = req.query;
    
    const countryCode = code.toUpperCase();
    const cities = AFRICAN_CITIES[countryCode] || [];
    
    // Filter cities by search term if provided
    let filteredCities = cities;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredCities = cities.filter(city => 
        city.toLowerCase().includes(searchLower)
      );
    }
    
    res.json({
      success: true,
      countryCode: countryCode,
      cities: filteredCities.slice(0, 20) // Limit to 20 results
    });
  } catch (error) {
    console.error('Get cities error:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
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
 * @desc    Detect user's country - uses phone number for registered users, IP for visitors
 * @access  Private (for registered users) or Public (for visitors)
 */
router.post('/detect', async (req, res) => {
  try {
    const { query } = require('../config/database');
    const CountryManager = require('../services/CountryManager');
    const countryManager = new CountryManager();
    
    // Check if user is authenticated (registered user)
    const token = req.header('Authorization')?.replace('Bearer ', '');
    let userId = null;
    let userPhone = null;
    
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'zerohook-secret-key-2024');
        userId = decoded.userId;
        
        // Get user's phone number from database
        // Special case for mock user
        if (userId === '00000000-0000-0000-0000-000000000001') {
          userPhone = '+233241234567'; // Mock user is Ghanaian
          console.log('🌍 Using mock user phone number:', userPhone);
        } else {
          const userResult = await query('SELECT phone, profile_data FROM users WHERE id = $1', [userId]);
          if (userResult.rows.length > 0) {
            userPhone = userResult.rows[0].phone || userResult.rows[0].profile_data?.phone;
          }
        }
      } catch (jwtError) {
        // Token invalid or expired - treat as visitor
        console.log('🌍 Invalid token, treating as visitor');
      }
    }
    
    // METHOD 1: For REGISTERED USERS - Use phone number country code
    if (userId && userPhone) {
      console.log(`🌍 Detecting country for registered user from phone: ${userPhone}`);
      const phoneDetection = countryManager.detectCountryFromPhone(userPhone);
      
      if (phoneDetection && phoneDetection.success) {
        // Store detected country for user
        try {
          await countryManager.setDetectedCountry(userId, phoneDetection.country.code);
        } catch (e) {
          console.log('Could not store detected country:', e.message);
        }
        
        return res.json({
          success: true,
          detectedCountry: phoneDetection.country,
          method: phoneDetection.method,
          confidence: phoneDetection.confidence,
          message: `Country detected from phone number: ${phoneDetection.country.name}`
        });
      }
    }
    
    // METHOD 2: For VISITORS/GUESTS - Use IP-based geolocation
    let ipAddress = req.body.ipAddress;
    if (!ipAddress) {
      ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
                  req.headers['x-real-ip'] ||
                  req.connection?.remoteAddress ||
                  req.socket?.remoteAddress ||
                  req.ip ||
                  '127.0.0.1';
      
      // Handle IPv6 localhost
      if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
        ipAddress = '127.0.0.1';
      }
    }
    
    console.log(`🌍 Detecting country for visitor from IP: ${ipAddress}`);
    
    const detectionResult = await countryManager.detectUserCountry(ipAddress);
    
    if (detectionResult.success) {
      // Store detected country for user if authenticated
      if (userId) {
        try {
          await countryManager.setDetectedCountry(userId, detectionResult.country.code);
        } catch (e) {
          console.log('Could not store detected country:', e.message);
        }
      }
      
      return res.json({
        success: true,
        detectedCountry: detectionResult.country,
        method: detectionResult.method,
        confidence: detectionResult.confidence,
        message: `Country detected: ${detectionResult.country.name}`
      });
    } else {
      // IP detection failed (localhost) - return default with notice
      const defaultCountry = countryManager.getCountryByCode('NG');
      return res.json({
        success: true,
        detectedCountry: defaultCountry,
        method: 'default_fallback',
        confidence: 'low',
        message: 'Could not detect country (local network). Using default: Nigeria. Please set your country preference.',
        requiresManualSelection: true
      });
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
