import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const countryAPI = {
  async detectCountry() {
    try {
      console.log('🌍 countryAPI.detectCountry() called');
      
      // In development mode, try to get real public IP first
      if (process.env.NODE_ENV === 'development' || window.location.hostname === 'localhost') {
        try {
          console.log('🔍 Development mode: attempting to get real public IP...');
          const ipResponse = await fetch('https://api.ipgeolocation.io/ipgeo?apiKey=1d24707d2a554ee697b852f28dd6533e');
          
          if (ipResponse.ok) {
            const ipData = await ipResponse.json();
            console.log('✅ Real IP detected:', ipData.country_name, `(${ipData.ip})`);
            
            // Send the detected IP to backend for processing
            const response = await api.post('/countries/detect', {
              ipAddress: ipData.ip,
              detectedLocation: {
                country: ipData.country_name,
                countryCode: ipData.country_code2,
                city: ipData.city,
                lat: parseFloat(ipData.latitude),
                lng: parseFloat(ipData.longitude)
              }
            });
            console.log('🌍 countryAPI response (with real IP):', response.data);
            return response.data;
          }
        } catch (ipError) {
          console.log('⚠️ Could not get real IP, falling back to backend detection:', ipError.message);
        }
      }
      
      // Normal flow: Backend will auto-detect IP from request headers
      const response = await api.post('/countries/detect', {});
      console.log('🌍 countryAPI response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Error detecting country:', error);
      console.error('❌ Error details:', error.response?.data || error.message);
      // Return fallback country on error
      return {
        success: true,
        detectedCountry: { code: 'NG', name: 'Nigeria', currency: 'NGN', currencySymbol: '₦', flag: '🇳🇬' },
        method: 'fallback',
        confidence: 'low'
      };
    }
  },

  async getSupportedCountries() {
    try {
      const response = await api.get('/countries');
      return response.data;
    } catch (error) {
      console.error('Error getting supported countries:', error);
      throw error;
    }
  },

  async getUserCountryPreference() {
    try {
      const response = await api.get('/countries/user/preference');
      return response.data;
    } catch (error) {
      console.error('Error getting user country preference:', error);
      throw error;
    }
  },

  async setPreference(countryCode) {
    try {
      const response = await api.put('/countries/user/preference', { countryCode });
      return response.data;
    } catch (error) {
      console.error('Error setting country preference:', error);
      throw error;
    }
  }
};

export default countryAPI;
