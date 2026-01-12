/**
 * Error Reporter Service
 * Centralized error reporting for production monitoring
 * 
 * Usage:
 *   import { reportError, reportWarning } from '../services/errorReporter';
 *   reportError(error, { context: 'PaymentFlow', userId: user.id });
 */

const isProduction = process.env.NODE_ENV === 'production';

// Configuration for error reporting
const config = {
  maxErrorsPerMinute: 10,
  sampleRate: 1.0, // 1.0 = 100% of errors reported
  excludedErrors: [
    'ResizeObserver loop',
    'AbortError',
    'Script error',
    'Network request failed',
  ],
};

// Rate limiting state
let errorCount = 0;
let lastResetTime = Date.now();

/**
 * Check if error should be excluded from reporting
 */
const shouldExcludeError = (error) => {
  const message = error?.message || String(error);
  return config.excludedErrors.some(excluded => 
    message.toLowerCase().includes(excluded.toLowerCase())
  );
};

/**
 * Check rate limit for error reporting
 */
const checkRateLimit = () => {
  const now = Date.now();
  // Reset counter every minute
  if (now - lastResetTime > 60000) {
    errorCount = 0;
    lastResetTime = now;
  }
  
  if (errorCount >= config.maxErrorsPerMinute) {
    return false;
  }
  
  errorCount++;
  return true;
};

/**
 * Sample errors based on sample rate
 */
const shouldSample = () => {
  return Math.random() < config.sampleRate;
};

/**
 * Sanitize context data to remove PII
 */
const sanitizeContext = (context) => {
  const sanitized = { ...context };
  
  // Remove or mask sensitive fields
  const sensitiveFields = ['email', 'phone', 'password', 'token', 'ip', 'coordinates'];
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  // Reduce coordinate precision if present in location
  if (sanitized.location?.lat && sanitized.location?.lng) {
    sanitized.location = {
      lat: Math.round(sanitized.location.lat * 100) / 100,
      lng: Math.round(sanitized.location.lng * 100) / 100,
    };
  }
  
  return sanitized;
};

/**
 * Format error for reporting
 */
const formatError = (error, context = {}) => {
  const errorData = {
    message: error?.message || String(error),
    name: error?.name || 'Error',
    stack: isProduction ? undefined : error?.stack,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    context: sanitizeContext(context),
  };
  
  return errorData;
};

/**
 * Send error to reporting service
 * TODO: Replace with actual service (Sentry, Datadog, LogRocket, etc.)
 */
const sendToService = async (errorData, severity) => {
  if (isProduction) {
    // In production, this would send to your error reporting service
    // Example with fetch:
    // await fetch('/api/errors/report', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ ...errorData, severity }),
    // });
    
    // For now, log to console in a structured way
    console.error(`[${severity.toUpperCase()}]`, errorData.message, errorData.context);
  } else {
    // In development, always log full error
    console.error(`[${severity.toUpperCase()}]`, errorData);
  }
};

/**
 * Report an error
 * @param {Error|string} error - The error to report
 * @param {Object} context - Additional context (userId, component, action, etc.)
 */
export const reportError = async (error, context = {}) => {
  if (!error) return;
  
  // Skip excluded errors
  if (shouldExcludeError(error)) {
    return;
  }
  
  // Check rate limit
  if (!checkRateLimit()) {
    console.warn('[ErrorReporter] Rate limit exceeded, skipping error report');
    return;
  }
  
  // Apply sampling
  if (!shouldSample()) {
    return;
  }
  
  const errorData = formatError(error, context);
  await sendToService(errorData, 'error');
};

/**
 * Report a warning (less severe than error)
 * @param {string} message - Warning message
 * @param {Object} context - Additional context
 */
export const reportWarning = async (message, context = {}) => {
  if (!message) return;
  
  const warningData = formatError({ message, name: 'Warning' }, context);
  await sendToService(warningData, 'warning');
};

/**
 * Report an info message (for tracking important events)
 * @param {string} message - Info message
 * @param {Object} context - Additional context
 */
export const reportInfo = async (message, context = {}) => {
  if (!isProduction) return; // Only in production
  
  const infoData = formatError({ message, name: 'Info' }, context);
  await sendToService(infoData, 'info');
};

/**
 * Set up global error handlers
 * Call this once in your app's entry point
 */
export const setupGlobalErrorHandlers = () => {
  // Handle uncaught errors
  window.addEventListener('error', (event) => {
    reportError(event.error || event.message, {
      type: 'uncaught_error',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });
  
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, {
      type: 'unhandled_rejection',
    });
  });
};

const errorReporter = {
  reportError,
  reportWarning,
  reportInfo,
  setupGlobalErrorHandlers,
};

export default errorReporter;
