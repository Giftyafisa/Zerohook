// API Configuration
// In production, REACT_APP_API_URL should be set to https://zerohook-api.onrender.com/api
// The fallback uses production URL to ensure API calls work even if env var is missing
export const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://zerohook-api.onrender.com/api' 
    : '/api');
export const SERVER_URL = process.env.REACT_APP_SOCKET_URL || 
  (process.env.NODE_ENV === 'production'
    ? 'https://zerohook-api.onrender.com'
    : 'http://localhost:5000');
export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 
  (process.env.NODE_ENV === 'production'
    ? 'https://zerohook-api.onrender.com'
    : 'http://localhost:5000');

/**
 * Get the full URL for uploaded files (profile pictures, service images, etc.)
 * Handles both relative paths (/uploads/...) and full URLs
 * @param {string} path - The file path or URL
 * @returns {string|null} - Full URL or null if no path provided
 */
export const getUploadUrl = (path) => {
  if (!path) return null;
  // If it's already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // If it's a relative path starting with /uploads, prepend the server URL
  if (path.startsWith('/uploads')) {
    return `${SERVER_URL}${path}`;
  }
  // If it's just a filename, add /uploads/ prefix
  if (!path.startsWith('/')) {
    return `${SERVER_URL}/uploads/${path}`;
  }
  return `${SERVER_URL}${path}`;
};

// Service Categories
export const SERVICE_CATEGORIES = [
  {
    name: 'dgy',
    displayName: 'Dgy Services',
    description: 'Premium personal services',
    icon: '💎',
    startingPrice: 100,
    color: '#DC143C'
  },
  {
    name: 'romans',
    displayName: 'Romans Experience', 
    description: 'Authentic cultural experiences',
    icon: '🏛️',
    startingPrice: 150,
    color: '#8B0000'
  },
  {
    name: 'ridin',
    displayName: 'Ridin Adventures',
    description: 'Exciting adventure services',
    icon: '🚗',
    startingPrice: 80,
    color: '#FF1493'
  },
  {
    name: 'bb_suk',
    displayName: 'Bb Suk Special',
    description: 'Exclusive premium offerings',
    icon: '⭐',
    startingPrice: 200,
    color: '#B22222'
  }
];

// Trust Tiers
export const TRUST_TIERS = {
  1: { name: 'Basic', color: '#808080' },
  2: { name: 'Advanced', color: '#FFA500' },
  3: { name: 'Pro', color: '#32CD32' },
  4: { name: 'Elite', color: '#FFD700' }
};

// Transaction Statuses
export const TRANSACTION_STATUS = {
  PENDING: 'pending',
  ESCROWED: 'escrowed',
  COMPLETED: 'completed',
  DISPUTED: 'disputed',
  RESOLVED: 'resolved',
  CANCELLED: 'cancelled'
};
