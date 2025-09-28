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
      const response = await api.post('/countries/detect');
      return response.data;
    } catch (error) {
      console.error('Error detecting country:', error);
      throw error;
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
