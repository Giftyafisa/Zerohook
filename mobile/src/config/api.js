// Mobile App API Configuration
// Update these URLs when deploying to production

// Production URLs (Render.com)
export const PRODUCTION_API_URL = 'https://zerohook-api.onrender.com/api';
export const PRODUCTION_SOCKET_URL = 'https://zerohook-api.onrender.com';

// Development URLs (Local)
// Replace 192.168.x.x with your computer's local IP address
// Find it with: ipconfig (Windows) or ifconfig (Mac/Linux)
export const DEV_API_URL = 'http://192.168.1.100:5000/api';
export const DEV_SOCKET_URL = 'http://192.168.1.100:5000';

// Auto-select based on environment
const __DEV__ = process.env.NODE_ENV !== 'production';

export const API_URL = __DEV__ ? DEV_API_URL : PRODUCTION_API_URL;
export const SOCKET_URL = __DEV__ ? DEV_SOCKET_URL : PRODUCTION_SOCKET_URL;

// API Configuration
export const API_CONFIG = {
  baseURL: API_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
};

// Socket Configuration
export const SOCKET_CONFIG = {
  url: SOCKET_URL,
  options: {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  },
};

// Paystack Configuration
export const PAYSTACK_CONFIG = {
  publicKey: 'pk_test_7f3cabce055cc9cb562103752d9348c39d7fde9b',
};

// Feature Flags
export const FEATURES = {
  enableVideoCalls: true,
  enableCryptoPayments: true,
  enableTrustSystem: true,
};

// Country Configuration
export const COUNTRY_CONFIG = {
  defaultCountry: 'NG',
  supportedCountries: ['NG', 'GH', 'KE', 'ZA', 'UG', 'TZ', 'RW', 'BW', 'ZM', 'MW'],
};

export default {
  API_URL,
  SOCKET_URL,
  API_CONFIG,
  SOCKET_CONFIG,
  PAYSTACK_CONFIG,
  FEATURES,
  COUNTRY_CONFIG,
};
