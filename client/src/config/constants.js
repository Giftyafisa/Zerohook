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

const getOriginFromUrl = (value) => {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}`;
  } catch (_) {
    return null;
  }
};

const derivedServerFromApi = getOriginFromUrl(API_BASE_URL);

export const SERVER_URL = process.env.REACT_APP_SOCKET_URL ||
  derivedServerFromApi ||
  (process.env.NODE_ENV === 'production' ? PROD_SERVER_URL : window.location.origin);

export const SOCKET_URL = process.env.REACT_APP_SOCKET_URL ||
  derivedServerFromApi ||
  (process.env.NODE_ENV === 'production' ? PROD_SERVER_URL : window.location.origin);

const LEGACY_UPLOAD_HOSTS = new Set(['opue.me', 'www.opue.me']);
const ONRENDER_UPLOAD_HOST_PATTERN = /^zerohook-api-[a-z0-9-]+\.onrender\.com$/i;

const getServerHostname = () => {
  try {
    return new URL(SERVER_URL).hostname.toLowerCase();
  } catch (_) {
    return '';
  }
};

const shouldRewriteLegacyUploadHost = (hostname) => {
  const normalized = String(hostname || '').toLowerCase();
  if (!normalized) return false;

  if (LEGACY_UPLOAD_HOSTS.has(normalized)) {
    return true;
  }

  if (!ONRENDER_UPLOAD_HOST_PATTERN.test(normalized)) {
    return false;
  }

  const serverHostname = getServerHostname();
  return !serverHostname || normalized !== serverHostname;
};

export const normalizeLegacyUploadHostUrl = (value) => {
  if (typeof value !== 'string') return value;
  if (!value.startsWith('http://') && !value.startsWith('https://')) return value;

  try {
    const parsed = new URL(value);
    if (parsed.pathname.startsWith('/uploads/') && shouldRewriteLegacyUploadHost(parsed.hostname)) {
      return `${SERVER_URL}${parsed.pathname}${parsed.search}`;
    }
  } catch (_) {
    // If URL parsing fails, return the original value.
  }

  return value;
};

export const WEB_PUSH_VAPID_PUBLIC_KEY =
  process.env.REACT_APP_WEB_PUSH_VAPID_PUBLIC_KEY ||
  process.env.REACT_APP_WEB_PUSH_PUBLIC_KEY ||
  '';

const normalizeUploadPath = (value) => {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Preserve full URLs (they may still need host normalization elsewhere).
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Handle upload paths missing the leading slash.
  if (trimmed.startsWith('uploads/')) {
    return `/${trimmed}`;
  }

  if (trimmed.startsWith('/uploads/')) {
    return trimmed;
  }

  // Preserve rooted non-upload paths as-is.
  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  // Bare filename fallback.
  return `/uploads/${trimmed}`;
};

/**
 * Get the full URL for uploaded files (profile pictures, service images, etc.)
 * Handles both relative paths (/uploads/...) and full URLs
 * @param {string} path - The file path or URL
 * @returns {string|null} - Full URL or null if no path provided
 */
export const getUploadUrl = (path) => {
  const normalizedPath = normalizeUploadPath(path);
  if (!normalizedPath) return null;

  // If it's already a full URL, return as-is unless it points to a legacy uploads host.
  if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
    return normalizeLegacyUploadHostUrl(normalizedPath);
  }

  return `${SERVER_URL}${normalizedPath}`;
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
