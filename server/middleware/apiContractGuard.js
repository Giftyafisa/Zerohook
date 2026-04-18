const RESERVED_KEYS = new Set([
  'success',
  'message',
  'data',
  'error',
  'errors',
  'details',
  'status',
  'timestamp'
]);

const shouldSkipPath = (pathValue, skipPrefixes) => {
  if (!pathValue) return false;
  return skipPrefixes.some((prefix) => pathValue.startsWith(prefix));
};

const extractDataObject = (payload) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
    return payload.data;
  }

  const extracted = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!RESERVED_KEYS.has(key)) {
      extracted[key] = value;
    }
  }

  return Object.keys(extracted).length > 0 ? extracted : null;
};

const deriveMessage = (payload, success) => {
  if (payload && typeof payload.message === 'string' && payload.message.trim()) {
    return payload.message;
  }

  if (!success) {
    if (payload && typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error;
    }
    return 'Request failed';
  }

  return 'Request completed';
};

const normalizePayload = (payload, statusCode) => {
  const isObjectPayload = payload && typeof payload === 'object' && !Array.isArray(payload);
  const success = isObjectPayload && typeof payload.success === 'boolean'
    ? payload.success
    : statusCode < 400;
  const message = deriveMessage(payload, success);
  const data = extractDataObject(payload);

  if (!isObjectPayload) {
    return { success, data, message };
  }

  return {
    ...payload,
    success,
    data,
    message
  };
};

function createApiContractGuard(options = {}) {
  const {
    apiPrefix = '/api/',
    skipPrefixes = ['/api/health', '/api/health/simple'],
    getEnforcementEnabled,
    getStrictModeEnabled,
    logger = console
  } = options;

  return (req, res, next) => {
    const requestPath = req.path || req.originalUrl || '';
    const isApiPath = requestPath.startsWith(apiPrefix);

    if (!isApiPath || shouldSkipPath(requestPath, skipPrefixes)) {
      return next();
    }

    const enforcementEnabled = typeof getEnforcementEnabled === 'function'
      ? !!getEnforcementEnabled(req)
      : true;

    if (!enforcementEnabled) {
      return next();
    }

    if (res.locals.__apiContractWrapped) {
      return next();
    }
    res.locals.__apiContractWrapped = true;

    const originalJson = res.json.bind(res);

    res.json = (payload) => {
      const normalized = normalizePayload(payload, res.statusCode || 200);
      const strictMode = typeof getStrictModeEnabled === 'function'
        ? !!getStrictModeEnabled(req)
        : false;

      if (strictMode) {
        const hadSuccess = payload && typeof payload === 'object' && typeof payload.success === 'boolean';
        const hadData = payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'data');
        const hadMessage = payload && typeof payload === 'object' && typeof payload.message === 'string';

        if (!hadSuccess || !hadData || !hadMessage) {
          logger.warn?.(`[API_CONTRACT] Normalized response for ${req.method} ${requestPath}`);
        }
      }

      return originalJson(normalized);
    };

    return next();
  };
}

module.exports = createApiContractGuard;
module.exports.normalizePayload = normalizePayload;