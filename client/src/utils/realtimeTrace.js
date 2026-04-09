import apiClient from '../services/apiClient';

const STORAGE_KEY = 'zerohook.realtimeTrace.enabled';
const QUERY_PARAM = 'traceRealtime';
const TRACE_PREFIX = '[TRACE]';
const TRACE_SCOPE_MAX = 24;
const TRACE_EVENT_MAX = 96;
const TRACE_DETAIL_MAX = 512;
const TRACE_LINE_MAX = 2048;
const TRACE_BATCH_SIZE = 20;
const TRACE_DELAY_MS = 750;

let traceQueue = [];
let flushTimer = null;
let flushPromise = null;

const getWindow = () => (typeof window !== 'undefined' ? window : null);

const safeStorage = () => {
  const win = getWindow();
  if (!win) return null;
  try {
    return win.localStorage;
  } catch (_) {
    return null;
  }
};

const setStorageFlag = (enabled) => {
  const storage = safeStorage();
  if (!storage) return;
  try {
    if (enabled) {
      storage.setItem(STORAGE_KEY, '1');
    } else {
      storage.removeItem(STORAGE_KEY);
    }
  } catch (_) {
    // Best-effort only.
  }
};

const readStorageFlag = () => {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const value = storage.getItem(STORAGE_KEY);
    if (value === '1' || value === 'true') return true;
    if (value === '0' || value === 'false') return false;
  } catch (_) {
    // Ignore storage errors.
  }
  return null;
};

const syncTraceModeFromUrl = () => {
  const win = getWindow();
  if (!win?.location) return;
  try {
    const params = new URLSearchParams(win.location.search);
    const flag = params.get(QUERY_PARAM);
    if (flag === '1' || flag === 'true') {
      setStorageFlag(true);
    } else if (flag === '0' || flag === 'false') {
      setStorageFlag(false);
    }
  } catch (_) {
    // No-op.
  }
};

syncTraceModeFromUrl();

const normalizeTraceValue = (value, depth = 0) => {
  if (value == null) return value;
  if (typeof value === 'string') {
    return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    if (depth >= 1) return `[Array(${value.length})]`;
    return value.slice(0, 8).map((item) => normalizeTraceValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    if (depth >= 1) return '[Object]';
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 8)
        .map(([key, item]) => [String(key).slice(0, 32), normalizeTraceValue(item, depth + 1)])
    );
  }
  return String(value);
};

const formatTraceDetails = (details) => {
  if (details == null) return '{}';
  if (typeof details === 'string') return details.slice(0, TRACE_DETAIL_MAX);

  try {
    return JSON.stringify(normalizeTraceValue(details)).slice(0, TRACE_DETAIL_MAX);
  } catch (_) {
    return String(details).slice(0, TRACE_DETAIL_MAX);
  }
};

const buildTraceLine = (scope, event, details) => {
  const timestamp = new Date().toISOString();
  const normalizedScope = String(scope || 'realtime').trim().slice(0, TRACE_SCOPE_MAX) || 'realtime';
  const normalizedEvent = String(event || 'event').trim().replace(/\s+/g, ' ').slice(0, TRACE_EVENT_MAX) || 'event';
  const detailText = formatTraceDetails(details);
  return `${timestamp}: ${TRACE_PREFIX} ${normalizedScope}.${normalizedEvent} - ${detailText}`.slice(0, TRACE_LINE_MAX);
};

const scheduleFlush = () => {
  if (!isRealtimeTraceEnabled() || flushTimer || traceQueue.length === 0) return;
  const win = getWindow();
  if (!win?.setTimeout) return;

  flushTimer = win.setTimeout(() => {
    flushTimer = null;
    void flushRealtimeTrace({ reason: 'timer' });
  }, TRACE_DELAY_MS);
};

export const isRealtimeTraceEnabled = () => {
  const stored = readStorageFlag();
  if (stored != null) return stored;
  return false;
};

export const setRealtimeTraceEnabled = (enabled) => {
  setStorageFlag(!!enabled);
  if (!enabled) {
    traceQueue = [];
  }
};

export const traceRealtime = (scope, event, details = {}) => {
  if (!isRealtimeTraceEnabled()) return false;

  const line = buildTraceLine(scope, event, details);
  traceQueue.push(line);
  if (traceQueue.length > TRACE_BATCH_SIZE) {
    traceQueue = traceQueue.slice(-TRACE_BATCH_SIZE);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug(line);
  }

  scheduleFlush();
  return true;
};

export const flushRealtimeTrace = async ({ reason = 'manual' } = {}) => {
  if (!isRealtimeTraceEnabled()) return { shipped: false, reason: 'disabled' };
  if (traceQueue.length === 0) return { shipped: false, reason: 'empty' };
  if (flushPromise) return flushPromise;

  if (flushTimer) {
    const win = getWindow();
    if (win?.clearTimeout) {
      win.clearTimeout(flushTimer);
    }
    flushTimer = null;
  }

  const trace = traceQueue.splice(0, TRACE_BATCH_SIZE);
  const payload = {
    trace,
    origin: 'web',
    reason,
    deviceInfo: {
      platform: typeof navigator !== 'undefined' ? navigator.platform || navigator.userAgentData?.platform || 'web' : 'web',
      appVersion: process.env.REACT_APP_VERSION || process.env.REACT_APP_BUILD_ID || 'web'
    }
  };

  flushPromise = apiClient.post('/debug/socket-trace', payload)
    .then((response) => ({
      shipped: true,
      traceId: response?.data?.data?.traceId || null,
      count: trace.length
    }))
    .catch((error) => {
      traceQueue = [...trace, ...traceQueue];
      return {
        shipped: false,
        error: error?.response?.data?.message || error?.message || 'Failed to record realtime trace.'
      };
    })
    .finally(() => {
      flushPromise = null;
      if (traceQueue.length > 0) {
        scheduleFlush();
      }
    });

  return flushPromise;
};

export const registerRealtimeTraceLifecycle = () => {
  if (!isRealtimeTraceEnabled()) return () => {};
  const win = getWindow();
  if (!win) return () => {};

  const handleFlush = () => {
    void flushRealtimeTrace({ reason: 'lifecycle' });
  };

  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      handleFlush();
    }
  };

  win.addEventListener('beforeunload', handleFlush);
  win.addEventListener('pagehide', handleFlush);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    win.removeEventListener('beforeunload', handleFlush);
    win.removeEventListener('pagehide', handleFlush);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    void flushRealtimeTrace({ reason: 'cleanup' });
  };
};
