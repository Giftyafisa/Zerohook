/**
 * Logger Utility - Environment-aware logging with levels
 * 
 * In production: All logging is disabled (no-op)
 * In development: Full logging enabled with levels
 * 
 * Usage:
 *   import logger from '../utils/logger';
 *   logger.debug('Debug message', { data });
 *   logger.info('Info message');
 *   logger.warn('Warning message');
 *   logger.error('Error message', error);
 * 
 * @module utils/logger
 */

const isDevelopment = process.env.NODE_ENV !== 'production';

// No-op function for production
const noop = () => {};

/**
 * Logger with environment gating
 * All methods are no-ops in production to prevent performance degradation and data leakage
 */
const logger = {
  /**
   * Debug level - verbose development information
   * Use for: state changes, function calls, data flow tracing
   */
  debug: isDevelopment 
    ? (message, ...args) => console.log(`🔍 ${message}`, ...args)
    : noop,

  /**
   * Info level - general information
   * Use for: successful operations, user actions, navigation
   */
  info: isDevelopment
    ? (message, ...args) => console.info(`ℹ️ ${message}`, ...args)
    : noop,

  /**
   * Warn level - potential issues that don't break functionality
   * Use for: deprecation warnings, fallback behavior, missing optional data
   */
  warn: isDevelopment
    ? (message, ...args) => console.warn(`⚠️ ${message}`, ...args)
    : noop,

  /**
   * Error level - actual errors that need attention
   * In production, this still logs to console but without sensitive data
   * Consider wiring to Sentry/Datadog in production
   */
  error: (message, error = null) => {
    if (isDevelopment) {
      console.error(`🚨 ${message}`, error);
    } else {
      // Production: Log minimal error info (no stack traces or sensitive data)
      // TODO: Wire to error reporting service (Sentry/Datadog)
      console.error(`Error: ${message}`);
    }
  },

  /**
   * Performance timing helper
   * Use for: measuring operation duration
   */
  time: isDevelopment
    ? (label) => console.time(`⏱️ ${label}`)
    : noop,

  timeEnd: isDevelopment
    ? (label) => console.timeEnd(`⏱️ ${label}`)
    : noop,

  /**
   * Group related logs
   */
  group: isDevelopment
    ? (label) => console.group(`📁 ${label}`)
    : noop,

  groupEnd: isDevelopment
    ? () => console.groupEnd()
    : noop,

  /**
   * Table display for arrays/objects
   */
  table: isDevelopment
    ? (data) => console.table(data)
    : noop,
};

export default logger;

/**
 * Mask sensitive data for logging
 * @param {string} value - Value to mask
 * @param {number} visibleChars - Number of characters to show at start/end
 * @returns {string} Masked value
 */
export const maskSensitive = (value, visibleChars = 4) => {
  if (!value || typeof value !== 'string') return '***';
  if (value.length <= visibleChars * 2) return '***';
  return `${value.slice(0, visibleChars)}...${value.slice(-visibleChars)}`;
};

/**
 * Mask coordinates for logging
 * @param {Object} coords - { lat, lng } object
 * @returns {string} Masked coordinates
 */
export const maskCoordinates = (coords) => {
  if (!coords || coords.lat == null || coords.lng == null) return 'unknown';
  // Show only integer part for privacy
  return `~${Math.round(coords.lat)},${Math.round(coords.lng)}`;
};
