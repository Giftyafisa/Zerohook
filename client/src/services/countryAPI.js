import apiClient from './apiClient';

// Cache keys and TTLs
const COUNTRY_CACHE_KEY = 'zerohook_detected_country';
const SUPPORTED_COUNTRIES_CACHE_KEY = 'zerohook_supported_countries';
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache

const countryAPI = {
  async detectCountry() {
    try {
      // Check cache first to avoid redundant API calls
      const cached = sessionStorage.getItem(COUNTRY_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('🌍 Using cached country detection');
          }
          return data;
        }
      }

      // Gate logging in production
      if (process.env.NODE_ENV !== 'production') {
        console.log('🌍 countryAPI.detectCountry() called');
      }
      
      // SECURITY FIX: Route all IP detection through backend to avoid exposing API keys
      // Backend handles IP detection via request headers or server-side API calls
      const response = await apiClient.post('/countries/detect', {});
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('🌍 countryAPI response:', response.data);
      }

      // Cache the result
      sessionStorage.setItem(COUNTRY_CACHE_KEY, JSON.stringify({
        data: response.data,
        timestamp: Date.now()
      }));

      return response.data;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('❌ Error detecting country:', error);
        console.error('❌ Error details:', error.response?.data || error.message);
      }
      // Return fallback country on error
      return {
        success: true,
        detectedCountry: { code: 'US', name: 'United States', currency: 'USD', currencySymbol: '$', flag: '🇺🇸' },
        method: 'fallback',
        confidence: 'low'
      };
    }
  },

  async getSupportedCountries() {
    try {
      // Check cache first
      const cached = sessionStorage.getItem(SUPPORTED_COUNTRIES_CACHE_KEY);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_TTL) {
          return data;
        }
      }

      const response = await apiClient.get('/countries');
      
      // Cache the result
      sessionStorage.setItem(SUPPORTED_COUNTRIES_CACHE_KEY, JSON.stringify({
        data: response.data,
        timestamp: Date.now()
      }));

      return response.data;
    } catch (error) {
      console.error('Error getting supported countries:', error);
      throw error;
    }
  },

  async getUserCountryPreference() {
    try {
      const response = await apiClient.get('/countries/user/preference');
      return response.data;
    } catch (error) {
      console.error('Error getting user country preference:', error);
      throw error;
    }
  },

  async setPreference(countryCode) {
    try {
      const response = await apiClient.put('/countries/user/preference', { countryCode });
      return response.data;
    } catch (error) {
      console.error('Error setting country preference:', error);
      throw error;
    }
  }
};

export default countryAPI;
