/**
 * Structured Logger Utility
 * 
 * Provides consistent log formatting with timestamps, levels, and context.
 * Drop-in replacement for console.log in production code.
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? 
  (process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG);

function formatMessage(level, context, message, meta) {
  const timestamp = new Date().toISOString();
  const base = {
    timestamp,
    level,
    ...(context && { context }),
    message
  };
  
  if (meta && Object.keys(meta).length > 0) {
    base.meta = meta;
  }
  
  if (process.env.LOG_FORMAT === 'json') {
    return JSON.stringify(base);
  }
  
  // Human-readable format for development
  const contextStr = context ? `[${context}]` : '';
  const metaStr = meta && Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level.padEnd(5)} ${contextStr} ${message}${metaStr}`;
}

function createLogger(context) {
  return {
    error(message, meta) {
      if (CURRENT_LEVEL >= LOG_LEVELS.ERROR) {
        console.error(formatMessage('ERROR', context, message, meta));
      }
    },
    warn(message, meta) {
      if (CURRENT_LEVEL >= LOG_LEVELS.WARN) {
        console.warn(formatMessage('WARN', context, message, meta));
      }
    },
    info(message, meta) {
      if (CURRENT_LEVEL >= LOG_LEVELS.INFO) {
        console.log(formatMessage('INFO', context, message, meta));
      }
    },
    debug(message, meta) {
      if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
        console.log(formatMessage('DEBUG', context, message, meta));
      }
    }
  };
}

module.exports = { createLogger, LOG_LEVELS };
