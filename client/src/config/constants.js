// =============================================================================
// SINGLE SOURCE OF TRUTH for all API / Socket / Server URLs.
// Every file in the app should import from here — never define its own URL.
//
// To change the backend URL:
//   1. Set REACT_APP_API_URL in your .env (or Render env vars)
//      e.g. REACT_APP_API_URL=https://zerohook-api-f3ss.onrender.com/api
//   2. Optionally set REACT_APP_SOCKET_URL for the WebSocket host
//      e.g. REACT_APP_SOCKET_URL=https://zerohook-api-f3ss.onrender.com
//   3. If neither is set, the hardcoded production fallbacks below are used.
// =============================================================================

const PROD_API_URL    = 'https://zerohook-api-f3ss.onrender.com/api';
const PROD_SERVER_URL = 'https://zerohook-api-f3ss.onrender.com';

export const API_BASE_URL = process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? PROD_API_URL : '/api');

export const SERVER_URL = process.env.REACT_APP_SOCKET_URL ||
  (process.env.NODE_ENV === 'production' ? PROD_SERVER_URL : window.location.origin);

export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL ||
  (process.env.NODE_ENV === 'production' ? PROD_SERVER_URL : window.location.origin);

export const WEB_PUSH_VAPID_PUBLIC_KEY =
  process.env.REACT_APP_WEB_PUSH_VAPID_PUBLIC_KEY ||
  process.env.REACT_APP_WEB_PUSH_PUBLIC_KEY ||
  '';

/**
 * Get the full URL for uploaded files (profile pictures, service images, etc.)
 * Handles both relative paths (/uploads/...) and full URLs
 * @param {string} path - The file path or URL
 * @returns {string|null} - Full URL or null if no path provided
 */
export const getUploadUrl = (path) => {
  if (!path) return null;
  // If it's already a full URL, return as-is unless it points to a legacy uploads host.
  if (path.startsWith('http://') || path.startsWith('https://')) {
    try {
      const parsed = new URL(path);
      const legacyUploadHosts = new Set(['opue.me', 'www.opue.me']);
      if (legacyUploadHosts.has(parsed.hostname.toLowerCase()) && parsed.pathname.startsWith('/uploads/')) {
        return `${SERVER_URL}${parsed.pathname}`;
      }
    } catch (_) {
      // If URL parsing fails, fall back to returning the original path.
    }
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

// Telegram Payment Configuration
export const TELEGRAM_CONFIG = {
  botUsername: process.env.REACT_APP_TELEGRAM_BOT || 'ZerohookPayBot',
  adminUsername: process.env.REACT_APP_TELEGRAM_ADMIN || 'ZerohookAdmin',
  supportGroup: process.env.REACT_APP_TELEGRAM_GROUP || 'ZerohookSupport',
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
