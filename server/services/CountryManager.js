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
   * Get supported African countries with Paystack support
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
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno'],
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
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno', 'bitnob'],
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
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno', 'pesaflow'],
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
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno', 'valr'],
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
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno'],
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
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno'],
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
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno'],
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
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno'],
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
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno'],
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
        paystackSupport: true,
        cryptoPlatforms: ['coinbase', 'binance', 'luno'],
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
   * Get countries by region or feature
   */
  getCountriesByFeature(feature) {
    switch (feature) {
      case 'mobile_money':
        return this.supportedCountries.filter(c => c.mobileMoney);
      case 'local_banks':
        return this.supportedCountries.filter(c => c.localBanks);
      case 'paystack':
        return this.supportedCountries.filter(c => c.paystackSupport);
      default:
        return this.supportedCountries;
    }
  }

  /**
   * Get crypto platforms for a specific country
   */
  getCryptoPlatforms(countryCode) {
    const country = this.getCountryByCode(countryCode);
    if (!country) return [];
    
    return country.cryptoPlatforms.map(platform => this.getCryptoPlatformInfo(platform));
  }

  /**
   * Get crypto platform information
   */
  getCryptoPlatformInfo(platformCode) {
    const platforms = {
      coinbase: {
        name: 'Coinbase',
        logo: '🪙',
        description: 'Global cryptocurrency exchange',
        website: 'https://coinbase.com',
        supportedCountries: ['NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW', 'BW', 'ZM', 'MW'],
        features: ['Buy/Sell', 'Wallet', 'Staking', 'NFTs']
      },
      binance: {
        name: 'Binance',
        logo: '🟡',
        description: 'World\'s largest crypto exchange',
        website: 'https://binance.com',
        supportedCountries: ['NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW', 'BW', 'ZM', 'MW'],
        features: ['Trading', 'P2P', 'Staking', 'Launchpad']
      },
      luno: {
        name: 'Luno',
        logo: '🌙',
        description: 'African-focused crypto platform',
        website: 'https://luno.com',
        supportedCountries: ['NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW', 'BW', 'ZM', 'MW'],
        features: ['Buy/Sell', 'Wallet', 'Savings', 'Education']
      },
      bitnob: {
        name: 'Bitnob',
        logo: '💎',
        description: 'Ghanaian crypto platform',
        website: 'https://bitnob.com',
        supportedCountries: ['GH', 'NG', 'KE'],
        features: ['Buy/Sell', 'Wallet', 'Savings', 'Local Payments'],
        localSupport: true,
        africanFocused: true
      },
      pesaflow: {
        name: 'PesaFlow',
        logo: '💱',
        description: 'Kenyan crypto and mobile money platform',
        website: 'https://pesaflow.com',
        supportedCountries: ['KE', 'UG', 'TZ'],
        features: ['Mobile Money', 'Crypto', 'Remittances', 'Local Payments'],
        localSupport: true,
        africanFocused: true
      },
      valr: {
        name: 'VALR',
        logo: '🦁',
        description: 'South African crypto exchange',
        website: 'https://valr.com',
        supportedCountries: ['ZA', 'BW'],
        features: ['Trading', 'Staking', 'Institutional', 'Local Support'],
        localSupport: true,
        africanFocused: true
      }
    };
    
    return platforms[platformCode] || null;
  }

  /**
   * Get Ghanaian-specific crypto platforms
   */
  getGhanaianCryptoPlatforms() {
    return [
      this.getCryptoPlatformInfo('bitnob'),
      this.getCryptoPlatformInfo('coinbase'),
      this.getCryptoPlatformInfo('binance'),
      this.getCryptoPlatformInfo('luno')
    ].filter(Boolean);
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
      const user = await User.findById(userId).select('profileData');
      
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      const countryCode = user.profileData?.country || this.defaultCountry;
      const detectedCountry = user.profileData?.detectedCountry || this.defaultCountry;
      const country = this.getCountryByCode(countryCode);

      return {
        success: true,
        country: country || null,
        detectedCountry: detectedCountry,
        preference: countryCode
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
        'profileData.country': countryCode,
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
        'profileData.detectedCountry': countryCode,
        updatedAt: new Date()
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to set detected country:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get country-specific payment methods
   */
  getCountryPaymentMethods(countryCode) {
    const country = this.getCountryByCode(countryCode);
    if (!country) return [];

    const methods = [];

    // Paystack is available for all supported countries
    methods.push({
      id: 'paystack',
      name: 'Paystack',
      description: `Local payments in ${country.currency}`,
      logo: '💳',
      priority: 1,
      features: ['Local Banks', 'Mobile Money', 'Cards']
    });

    // Crypto platforms
    const cryptoPlatforms = this.getCryptoPlatforms(countryCode);
    cryptoPlatforms.forEach((platform, index) => {
      methods.push({
        id: `crypto_${platform.name.toLowerCase()}`,
        name: platform.name,
        description: platform.description,
        logo: platform.logo,
        priority: 2 + index,
        features: platform.features,
        localSupport: platform.localSupport,
        africanFocused: platform.africanFocused
      });
    });

    return methods.sort((a, b) => a.priority - b.priority);
  }
}

module.exports = CountryManager;
