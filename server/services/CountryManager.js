const mongoose = require('mongoose');
const { User, isDatabaseAvailable } = require('../config/database');
const axios = require('axios');
const IPGeolocation = require('./IPGeolocation');

class CountryManager {
  constructor() {
    this.initialized = false;
    this.supportedCountries = this.getSupportedAfricanCountries();
    this.defaultCountry = 'NG'; // Nigeria as default
    this.ipGeolocation = new IPGeolocation(); // Use the new ipgeolocation.io service
  }

  async initialize() {
    try {
      console.log('🌍 Initializing Country Manager...');
      
      // Initialize IP Geolocation service
      await this.ipGeolocation.initialize();
      
      // Initialize country data in database if needed
      await this.initializeCountryData();
      
      this.initialized = true;
      console.log('✅ Country Manager initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Country Manager initialization failed:', error);
      return false;
    }
  }

  isHealthy() {
    return this.initialized;
  }

  /**
   * Get supported African countries (crypto-only payments)
   */
  getSupportedAfricanCountries() {
    return [
      {
        code: 'NG',
        name: 'Nigeria',
        flag: '🇳🇬',
        currency: 'NGN',
        currencySymbol: '₦',
        timezone: 'Africa/Lagos',
        phoneCode: '+234',
        paymentMethod: 'crypto',
        localBanks: true,
        mobileMoney: false
      },
      {
        code: 'GH',
        name: 'Ghana',
        flag: '🇬🇭',
        currency: 'GHS',
        currencySymbol: '₵',
        timezone: 'Africa/Accra',
        phoneCode: '+233',
        paymentMethod: 'crypto',
        localBanks: true,
        mobileMoney: true
      },
      {
        code: 'KE',
        name: 'Kenya',
        flag: '🇰🇪',
        currency: 'KES',
        currencySymbol: 'KSh',
        timezone: 'Africa/Nairobi',
        phoneCode: '+254',
        paymentMethod: 'crypto',
        localBanks: true,
        mobileMoney: true
      },
      {
        code: 'ZA',
        name: 'South Africa',
        flag: '🇿🇦',
        currency: 'ZAR',
        currencySymbol: 'R',
        timezone: 'Africa/Johannesburg',
        phoneCode: '+27',
        paymentMethod: 'crypto',
        localBanks: true,
        mobileMoney: false
      },
      {
        code: 'UG',
        name: 'Uganda',
        flag: '🇺🇬',
        currency: 'UGX',
        currencySymbol: 'USh',
        timezone: 'Africa/Kampala',
        phoneCode: '+256',
        paymentMethod: 'crypto',
        localBanks: true,
        mobileMoney: true
      },
      {
        code: 'TZ',
        name: 'Tanzania',
        flag: '🇹🇿',
        currency: 'TZS',
        currencySymbol: 'TSh',
        timezone: 'Africa/Dar_es_Salaam',
        phoneCode: '+255',
        paymentMethod: 'crypto',
        localBanks: true,
        mobileMoney: true
      },
      {
        code: 'RW',
        name: 'Rwanda',
        flag: '🇷🇼',
        currency: 'RWF',
        currencySymbol: 'FRw',
        timezone: 'Africa/Kigali',
        phoneCode: '+250',
        paymentMethod: 'crypto',
        localBanks: true,
        mobileMoney: true
      },
      {
        code: 'BW',
        name: 'Botswana',
        flag: '🇧🇼',
        currency: 'BWP',
        currencySymbol: 'P',
        timezone: 'Africa/Gaborone',
        phoneCode: '+267',
        paymentMethod: 'crypto',
        localBanks: true,
        mobileMoney: false
      },
      {
        code: 'ZM',
        name: 'Zambia',
        flag: '🇿🇲',
        currency: 'ZMW',
        currencySymbol: 'ZK',
        timezone: 'Africa/Lusaka',
        phoneCode: '+260',
        paymentMethod: 'crypto',
        localBanks: true,
        mobileMoney: true
      },
      {
        code: 'MW',
        name: 'Malawi',
        flag: '🇲🇼',
        currency: 'MWK',
        currencySymbol: 'MK',
        timezone: 'Africa/Blantyre',
        phoneCode: '+265',
        paymentMethod: 'crypto',
        localBanks: true,
        mobileMoney: true
      }
    ];
  }

  /**
   * Detect country from phone number using country code
   * This is the PRIMARY method for registered users
   */
  detectCountryFromPhone(phoneNumber) {
    if (!phoneNumber) return null;
    
    // Clean the phone number
    const cleanPhone = phoneNumber.replace(/\s+/g, '').replace(/-/g, '');
    
    // Phone code to country mapping (ordered by specificity - longer codes first)
    const phoneCodeMap = {
      '+234': 'NG',  // Nigeria
      '+233': 'GH',  // Ghana
      '+254': 'KE',  // Kenya
      '+27': 'ZA',   // South Africa
      '+256': 'UG',  // Uganda
      '+255': 'TZ',  // Tanzania
      '+250': 'RW',  // Rwanda
      '+267': 'BW',  // Botswana
      '+260': 'ZM',  // Zambia
      '+265': 'MW',  // Malawi
    };
    
    // Check each phone code
    for (const [code, countryCode] of Object.entries(phoneCodeMap)) {
      if (cleanPhone.startsWith(code)) {
        const country = this.supportedCountries.find(c => c.code === countryCode);
        if (country) {
          return {
            success: true,
            country: country,
            method: 'phone_number_detection',
            confidence: 'high',
            phoneCode: code
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Detect user's country based on IP address using ipgeolocation.io
   * This is for VISITORS/GUESTS who are not registered
   */
  async detectUserCountry(ipAddress) {
    try {
      // Skip localhost/private IPs - return null to indicate we can't detect
      if (this.ipGeolocation.isPrivateIP(ipAddress)) {
        console.log('🌍 Local/private IP detected, cannot determine country from IP');
        return {
          success: false,
          method: 'ip_local',
          message: 'Cannot detect country from local IP address'
        };
      }

      // Use ipgeolocation.io service for accurate detection
      const geoData = await this.ipGeolocation.lookup(ipAddress);
      
      if (geoData && geoData.countryCode && geoData.countryCode !== 'XX') {
        const countryCode = geoData.countryCode;
        const detectedCountry = this.supportedCountries.find(c => c.code === countryCode);
        
        console.log(`🌍 IP Geolocation detected: ${geoData.city}, ${geoData.country} (${countryCode})`);
        
        if (detectedCountry) {
          return {
            success: true,
            country: detectedCountry,
            method: 'ipgeolocation_io',
            confidence: 'high',
            ipInfo: {
              ip: ipAddress,
              country: geoData.country,
              countryCode: geoData.countryCode,
              region: geoData.region,
              city: geoData.city,
              latitude: geoData.latitude,
              longitude: geoData.longitude,
              timezone: geoData.timezone,
              isp: geoData.isp
            }
          };
        } else {
          // Country detected but not in supported list - return detected info with default
          console.log(`🌍 Detected country ${countryCode} not in supported list, using default`);
          const defaultCountry = this.supportedCountries.find(c => c.code === this.defaultCountry);
          return {
            success: true,
            country: defaultCountry,
            method: 'ipgeolocation_io_unsupported',
            confidence: 'medium',
            detectedCountryCode: countryCode,
            detectedCountryName: geoData.country,
            ipInfo: {
              ip: ipAddress,
              country: geoData.country,
              countryCode: geoData.countryCode,
              region: geoData.region,
              city: geoData.city
            },
            message: `Your country (${geoData.country}) is not yet fully supported. Using Nigeria as default.`
          };
        }
      }
      
      throw new Error('IP geolocation lookup failed');
    } catch (error) {
      console.error('Country detection failed:', error.message);
      
      // Fallback to default country
      const defaultCountry = this.supportedCountries.find(c => c.code === this.defaultCountry);
      return {
        success: true,
        country: defaultCountry,
        method: 'fallback',
        confidence: 'low',
        error: error.message
      };
    }
  }

  /**
   * Get country by code
   */
  getCountryByCode(countryCode) {
    return this.supportedCountries.find(c => c.code === countryCode.toUpperCase());
  }

  /**
   * Get all supported countries
   */
  getAllCountries() {
    return this.supportedCountries;
  }

  /**
   * Get countries by feature
   */
  getCountriesByFeature(feature) {
    switch (feature) {
      case 'mobile_money':
        return this.supportedCountries.filter(c => c.mobileMoney);
      case 'local_banks':
        return this.supportedCountries.filter(c => c.localBanks);
      case 'crypto':
        return this.supportedCountries; // All countries support crypto
      default:
        return this.supportedCountries;
    }
  }

  /**
   * Get country-specific payment methods (crypto-only)
   */
  getCountryPaymentMethods(countryCode) {
    const country = this.getCountryByCode(countryCode);
    if (!country) return [];

    const methods = [
      {
        id: 'crypto',
        name: 'Cryptocurrency',
        description: `Pay with BTC, ETH, USDT, USDC and more`,
        logo: '🪙',
        priority: 1,
        features: ['Bitcoin', 'Ethereum', 'Stablecoins', 'No Fees']
      }
    ];

    return methods;
  }

  /**
   * Get country-specific crypto platforms (public info for onboarding/payment UI)
   */
  getCryptoPlatforms(countryCode) {
    const country = this.getCountryByCode(countryCode);
    const localCountry = country || this.getCountryByCode(this.defaultCountry);

    return [
      {
        id: 'direct_wallet',
        name: 'Direct Wallet Transfer',
        type: 'onchain',
        supportedCryptos: ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'LTC'],
        settlementCurrency: localCountry?.currency || 'USD',
        networkFees: 'Blockchain network fees only',
        recommended: true
      },
      {
        id: 'exchange_transfer',
        name: 'Crypto Exchange Transfer',
        type: 'exchange',
        supportedCryptos: ['BTC', 'ETH', 'USDT', 'USDC'],
        settlementCurrency: localCountry?.currency || 'USD',
        networkFees: 'Varies by exchange'
      }
    ];
  }

  /**
   * Initialize country data in database
   */
  async initializeCountryData() {
    try {
      // For MongoDB, we use in-memory country data from getSupportedAfricanCountries()
      // No need to create a separate collection - country data is static
      console.log('✅ Country data initialized (using in-memory data)');
    } catch (error) {
      console.error('Failed to initialize country data:', error);
      throw error;
    }
  }

  /**
   * Get user's country preferences
   * Priority: 1) User's explicitly set country preference
   *           2) Detected country from phone number (most reliable)
   *           3) Detected country from IP
   *           4) Default country (NG)
   */
  async getUserCountry(userId) {
    try {
      if (!isDatabaseAvailable()) {
        const country = this.getCountryByCode(this.defaultCountry);
        return {
          success: true,
          country: country || null,
          detectedCountry: this.defaultCountry,
          preference: this.defaultCountry,
          warning: 'Database unavailable, using default country'
        };
      }
      const user = await User.findById(userId).select('profile_data phone');
      
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Priority 1: Check if user has explicitly set a country preference
      // CRITICAL FIX: profile_data.country stores the NAME ('Ghana'), not the code ('GH')
      // Must check countryCode first, then location.countryCode, then try resolving the name
      let countryCode = user.profile_data?.countryCode 
        || user.profile_data?.location?.countryCode
        || user.profile_data?.detectedCountry;
      let source = 'user_profile';
      
      // If countryCode is still not found, try resolving from country name
      if (!countryCode && user.profile_data?.country) {
        const resolved = this.supportedCountries.find(
          c => c.name?.toLowerCase() === user.profile_data.country.toLowerCase()
             || c.code?.toLowerCase() === user.profile_data.country.toLowerCase()
        );
        if (resolved) {
          countryCode = resolved.code;
          source = 'user_profile_name_resolved';
        }
      }
      
      // Priority 2: If no explicit preference, detect from phone number
      if (!countryCode && user.phone) {
        const phoneDetection = this.detectCountryFromPhone(user.phone);
        if (phoneDetection && phoneDetection.success) {
          countryCode = phoneDetection.country.code;
          source = 'phone_detection';
          console.log(`🌍 Country detected from phone ${user.phone}: ${countryCode}`);
          
          // Save the detected country for future use
          await User.findByIdAndUpdate(userId, {
            'profile_data.detectedCountry': countryCode
          }).catch(err => console.error('Failed to save detected country:', err));
        }
      }
      
      // Priority 3: Use previously detected country from IP
      if (!countryCode) {
        countryCode = user.profile_data?.detectedCountry;
        source = 'ip_detection';
      }
      
      // Priority 4: Fall back to default
      if (!countryCode) {
        countryCode = this.defaultCountry;
        source = 'default';
      }

      const country = this.getCountryByCode(countryCode);

      console.log(`🌍 getUserCountry for ${userId}: ${countryCode} (${country?.name}) via ${source}`);

      return {
        success: true,
        country: country || null,
        detectedCountry: countryCode,
        preference: countryCode,
        source: source
      };
    } catch (error) {
      console.error('Failed to get user country:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update user's country preference
   */
  async updateUserCountry(userId, countryCode) {
    try {
      if (!isDatabaseAvailable()) {
        return { success: false, error: 'Database unavailable' };
      }
      const country = this.getCountryByCode(countryCode);
      if (!country) {
        return { success: false, error: 'Country not supported' };
      }

      await User.findByIdAndUpdate(userId, {
        'profile_data.country': countryCode,
        'profile_data.currency': country.currency,
        updatedAt: new Date()
      });

      return {
        success: true,
        country: country,
        message: `Country updated to ${country.name}`
      };
    } catch (error) {
      console.error('Failed to update user country:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Set user's detected country
   */
  async setDetectedCountry(userId, countryCode) {
    try {
      if (!isDatabaseAvailable()) {
        return { success: false, error: 'Database unavailable' };
      }
      await User.findByIdAndUpdate(userId, {
        'profile_data.detectedCountry': countryCode,
        updatedAt: new Date()
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to set detected country:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get country-specific payment options (crypto only, used by payment routes)
   */
  getPaymentOptions(countryCode) {
    const country = this.getCountryByCode(countryCode);
    return {
      country: country || null,
      methods: ['crypto'],
      supportedCryptos: ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'LTC'],
      localCurrency: country?.currency || 'USD',
      localCurrencySymbol: country?.currencySymbol || '$'
    };
  }
}

module.exports = CountryManager;
