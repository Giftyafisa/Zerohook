const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');
const { body, query, validationResult } = require('express-validator');
const { authMiddleware } = require('./auth');
const { SocketTrace, User } = require('../config/database');
const { createDistributedLimiter } = require('../utils/rateLimiters');

const router = express.Router();

const TRACE_LIMIT_DEFAULT = 50;
const TRACE_LIMIT_MAX = 200;
const TRACE_LINE_MAX_LENGTH = 2048;
const TRACE_AGGREGATE_MAX_DAYS = 90;
const TRACE_AGGREGATE_MAX_DOCS = 5000;

const TRACE_SINK = String(process.env.SOCKET_TRACE_SINK || 'none').toLowerCase();
const TRACE_WEBHOOK_URL = process.env.SOCKET_TRACE_WEBHOOK_URL || '';
const TRACE_NDJSON_PATH = process.env.SOCKET_TRACE_NDJSON_PATH
  || path.join(process.cwd(), 'logs', 'socket-trace.ndjson');
const TRACE_REDACTION_MODE = String(process.env.SOCKET_TRACE_REDACTION_MODE || 'strict').toLowerCase();

const DEVICE_INFO_SAFE_KEYS = new Set([
  'platform',
  'osVersion',
  'sdkInt',
  'brand',
  'manufacturer',
  'model',
  'device',
  'product',
  'appVersion',
  'appVersionCode'
]);

const SENSITIVE_DEVICE_PATTERNS = [
  /token/i,
  /cookie/i,
  /session/i,
  /auth/i,
  /password/i,
  /secret/i,
  /email/i,
  /phone/i,
  /imei/i,
  /serial/i,
  /mac/i,
  /ip/i,
  /address/i,
  /location/i,
  /lat/i,
  /lng/i,
  /longitude/i,
  /latitude/i
];

const FAILURE_EVENT_PATTERNS = [
  /ignored/i,
  /error/i,
  /fail/i,
  /reject/i,
  /cancel/i,
  /timeout/i,
  /disconnect/i,
  /denied/i,
  /invalid/i,
  /missing/i,
  /blocked/i,
  /stuck/i
];

const uploadLimiter = createDistributedLimiter({ points: 60, duration: 60, keyPrefix: 'debug_socket_trace_upload' });
const adminReadLimiter = createDistributedLimiter({ points: 120, duration: 60, keyPrefix: 'debug_socket_trace_admin_read' });
const replayLimiter = createDistributedLimiter({ points: 30, duration: 60, keyPrefix: 'debug_socket_trace_replay' });
const exportLimiter = createDistributedLimiter({ points: 10, duration: 60, keyPrefix: 'debug_socket_trace_export' });

const sendError = (res, status, message, data = null, error = null) => res.status(status).json({
  success: false,
  data,
  message,
  error: error || message
});

const sendSuccess = (res, data, message) => res.json({ success: true, data, message });

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseDayRange = (dayKey) => {
  const raw = String(dayKey || '').trim();
  if (!raw) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const start = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime())) {
    return null;
  }

  const end = new Date(`${raw}T23:59:59.999Z`);
  return { start, end, day: raw };
};

const normalizeTraceLines = (rawTrace) => {
  if (!Array.isArray(rawTrace)) return [];
  return rawTrace
    .map((line) => String(line || '').trim())
    .filter(Boolean)
    .map((line) => (line.length > TRACE_LINE_MAX_LENGTH ? line.slice(0, TRACE_LINE_MAX_LENGTH) : line))
    .slice(-TRACE_LIMIT_MAX);
};

const parseTraceLine = (line) => {
  const text = String(line || '');
  const traceStart = text.indexOf('[TRACE]');
  if (traceStart < 0) {
    return null;
  }

  const fragment = text.slice(traceStart);
  const match = /\[TRACE\]\s*([^\-]+?)\s*-\s*(.*)$/.exec(fragment);
  if (!match) {
    return null;
  }

  return {
    event: match[1].trim(),
    details: match[2].trim(),
    raw: text
  };
};

const normalizeTraceEventName = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .slice(0, 128);

const extractTraceEvents = (traceLines) => {
  if (!Array.isArray(traceLines)) {
    return [];
  }

  const events = new Set();
  traceLines.forEach((line) => {
    const parsed = parseTraceLine(line);
    const normalized = normalizeTraceEventName(parsed?.event);
    if (normalized) {
      events.add(normalized);
    }
  });

  return Array.from(events).slice(0, 64);
};

const safeDeviceInfo = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const entries = Object.entries(value)
    .slice(0, 64)
    .map(([key, val]) => [String(key).slice(0, 64), String(val ?? '').slice(0, 256)]);

  return Object.fromEntries(entries);
};

const redactDeviceInfo = (deviceInfo, mode = TRACE_REDACTION_MODE) => {
  const safeInfo = safeDeviceInfo(deviceInfo);
  if (mode === 'none') {
    return safeInfo;
  }

  if (mode === 'strict') {
    return Object.fromEntries(
      Object.entries(safeInfo).filter(([key]) => DEVICE_INFO_SAFE_KEYS.has(key))
    );
  }

  // partial mode: keep keys but mask likely sensitive fields
  if (mode === 'partial') {
    return Object.fromEntries(
      Object.entries(safeInfo).map(([key, value]) => {
        const sensitive = SENSITIVE_DEVICE_PATTERNS.some((pattern) => pattern.test(key));
        return sensitive ? [key, '[redacted]'] : [key, value];
      })
    );
  }

  // Unknown mode defaults to strict.
  return Object.fromEntries(
    Object.entries(safeInfo).filter(([key]) => DEVICE_INFO_SAFE_KEYS.has(key))
  );
};

const isFailureTraceEvent = (parsedTrace) => {
  if (!parsedTrace) return false;
  const haystack = `${parsedTrace.event || ''} ${parsedTrace.details || ''}`;
  return FAILURE_EVENT_PATTERNS.some((pattern) => pattern.test(haystack));
};

const parseTraceTimestamp = (line, fallbackDate) => {
  const marker = ': [TRACE]';
  const text = String(line || '');
  const markerIndex = text.indexOf(marker);
  if (markerIndex > 0) {
    const prefix = text.slice(0, markerIndex).trim();
    const parsed = new Date(prefix);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return fallbackDate instanceof Date ? fallbackDate : new Date(fallbackDate || Date.now());
};

const toDayKey = (date) => {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const consumeLimiter = async (limiter, key, res) => {
  try {
    await limiter.consume(key);
    return true;
  } catch (err) {
    if (err && Object.prototype.hasOwnProperty.call(err, 'msBeforeNext')) {
      const retryAfterSeconds = Math.max(1, Math.ceil((err.msBeforeNext || 0) / 1000));
      res.set('Retry-After', String(retryAfterSeconds));
      sendError(res, 429, `Too many debug requests. Retry in ${retryAfterSeconds}s.`, { retryAfterSeconds });
      return false;
    }
    sendError(res, 429, 'Too many debug requests. Please slow down.');
    return false;
  }
};

const ensureAdmin = async (req, res, next) => {
  try {
    if (req.user?.isAdmin === true) {
      return next();
    }

    if (!req.user?.userId || !mongoose.Types.ObjectId.isValid(req.user.userId)) {
      return sendError(res, 401, 'Unauthorized');
    }

    const user = await User.findById(req.user.userId)
      .select('is_admin role profile_data.accountType')
      .lean();

    const isAdmin = user?.is_admin === true
      || user?.role === 'admin'
      || user?.profile_data?.accountType === 'admin';

    if (!isAdmin) {
      return sendError(res, 403, 'Admin access required');
    }

    return next();
  } catch (error) {
    return sendError(res, 500, 'Admin verification failed', null, error.message);
  }
};

const publishToSink = async (payload) => {
  if (TRACE_SINK === 'none') {
    return { shipped: false, sink: 'none' };
  }

  if (TRACE_SINK === 'stdout') {
    console.log('[SOCKET_TRACE_PIPELINE]', JSON.stringify(payload));
    return { shipped: true, sink: 'stdout' };
  }

  if (TRACE_SINK === 'ndjson') {
    await fs.mkdir(path.dirname(TRACE_NDJSON_PATH), { recursive: true });
    await fs.appendFile(TRACE_NDJSON_PATH, `${JSON.stringify(payload)}\n`, 'utf8');
    return { shipped: true, sink: 'ndjson', path: TRACE_NDJSON_PATH };
  }

  if (TRACE_SINK === 'webhook') {
    if (!TRACE_WEBHOOK_URL) {
      return { shipped: false, sink: 'webhook', error: 'SOCKET_TRACE_WEBHOOK_URL is not configured' };
    }

    if (typeof fetch !== 'function') {
      return { shipped: false, sink: 'webhook', error: 'fetch API unavailable in this runtime' };
    }

    const response = await fetch(TRACE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Webhook sink failed: ${response.status} ${body}`);
    }

    return { shipped: true, sink: 'webhook' };
  }

  return { shipped: false, sink: TRACE_SINK, error: `Unsupported SOCKET_TRACE_SINK: ${TRACE_SINK}` };
};

/**
 * POST /api/debug/socket-trace
 * Authenticated endpoint for collecting client socket trace for post-mortem.
 */
router.post('/socket-trace', authMiddleware, [
  body('trace').isArray({ min: 1, max: TRACE_LIMIT_MAX }),
  body('trace.*').isString().isLength({ min: 1, max: TRACE_LINE_MAX_LENGTH }),
  body('origin').optional().isString().isLength({ min: 1, max: 64 }),
  body('deviceInfo').optional().isObject()
], async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return sendError(res, 401, 'Unauthorized');
    }

    const limiterKey = `u:${userId}`;
    const allowed = await consumeLimiter(uploadLimiter, limiterKey, res);
    if (!allowed) return;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, 'Validation failed', { details: errors.array() });
    }

    const trace = normalizeTraceLines(req.body?.trace);
    if (!trace.length) {
      return sendError(res, 400, 'trace must be a non-empty array');
    }

    const origin = String(req.body?.origin || 'mobile').trim().slice(0, 64);
    const deviceInfo = safeDeviceInfo(req.body?.deviceInfo);
    const traceEvents = extractTraceEvents(trace);

    const traceDoc = await SocketTrace.create({
      user_id: userId,
      trace,
      trace_events: traceEvents,
      origin,
      device_info: deviceInfo
    });

    const parsedEvents = trace
      .map(parseTraceLine)
      .filter(Boolean)
      .slice(-TRACE_LIMIT_DEFAULT);

    const sinkResult = await publishToSink({
      type: 'socket_trace',
      traceId: String(traceDoc._id),
      userId: String(userId),
      origin,
      deviceInfo,
      trace,
      parsedEvents,
      createdAt: traceDoc.created_at || traceDoc.createdAt || new Date().toISOString()
    }).catch((sinkError) => ({ shipped: false, sink: TRACE_SINK, error: sinkError.message }));

    return sendSuccess(
      res,
      {
        traceId: String(traceDoc._id),
        sink: sinkResult
      },
      'Socket trace recorded'
    );
  } catch (error) {
    console.error('Socket trace telemetry error:', error.message);
    return sendError(
      res,
      500,
      process.env.NODE_ENV === 'development' ? error.message : 'Failed to record socket trace'
    );
  }
});

/**
 * GET /api/debug/socket-trace/recent?user=<id>&event=<name>&day=YYYY-MM-DD&limit=50&page=1
 * Admin endpoint for recent trace viewing and triage.
 */
router.get('/socket-trace/recent', authMiddleware, ensureAdmin, [
  query('user').optional().isMongoId(),
  query('event').optional().trim().isLength({ min: 1, max: 128 }),
  query('day').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  query('limit').optional().isInt({ min: 1, max: TRACE_LIMIT_MAX }),
  query('page').optional().isInt({ min: 1, max: 10000 })
], async (req, res) => {
  try {
    const adminKey = `u:${req.user?.userId || 'unknown'}`;
    const allowed = await consumeLimiter(adminReadLimiter, adminKey, res);
    if (!allowed) return;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, 'Validation failed', { details: errors.array() });
    }

    const userId = req.query.user;
    const eventFilter = String(req.query.event || '').trim().slice(0, 128);
    const normalizedEventFilter = normalizeTraceEventName(eventFilter);
    const dayFilter = String(req.query.day || '').trim();
    const limit = parsePositiveInt(req.query.limit, TRACE_LIMIT_DEFAULT);
    const page = parsePositiveInt(req.query.page, 1);
    const skip = (page - 1) * limit;

    const filter = userId ? { user_id: userId } : {};

    if (normalizedEventFilter) {
      filter.trace_events = normalizedEventFilter;
    }

    if (dayFilter) {
      const dayRange = parseDayRange(dayFilter);
      if (!dayRange) {
        return sendError(res, 400, 'Invalid day filter. Expected format YYYY-MM-DD');
      }

      filter.created_at = {
        $gte: dayRange.start,
        $lte: dayRange.end
      };
    }

    const [rows, total] = await Promise.all([
      SocketTrace.find(filter)
        .sort({ created_at: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SocketTrace.countDocuments(filter)
    ]);

    const traces = rows.map((row) => ({
      id: String(row._id),
      userId: String(row.user_id),
      origin: row.origin || 'mobile',
      deviceInfo: row.device_info || {},
      traceCount: Array.isArray(row.trace) ? row.trace.length : 0,
      tracePreview: Array.isArray(row.trace) ? row.trace.slice(-20) : [],
      createdAt: row.created_at || row.createdAt || null
    }));

    return sendSuccess(res, {
      traces,
      filters: {
        userId: userId || null,
        event: eventFilter || null,
        day: dayFilter || null
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    }, 'Recent socket traces fetched');
  } catch (error) {
    console.error('Socket trace recent fetch error:', error.message);
    return sendError(res, 500, 'Failed to fetch recent socket traces');
  }
});

/**
 * GET /api/debug/socket-trace/aggregate?days=7&limit=10&user=<id>&maxDocs=1000
 * Admin endpoint: top failing socket event types per day.
 */
router.get('/socket-trace/aggregate', authMiddleware, ensureAdmin, [
  query('days').optional().isInt({ min: 1, max: TRACE_AGGREGATE_MAX_DAYS }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('maxDocs').optional().isInt({ min: 1, max: TRACE_AGGREGATE_MAX_DOCS }),
  query('user').optional().isMongoId()
], async (req, res) => {
  try {
    const adminKey = `u:${req.user?.userId || 'unknown'}`;
    const allowed = await consumeLimiter(adminReadLimiter, adminKey, res);
    if (!allowed) return;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, 'Validation failed', { details: errors.array() });
    }

    const days = parsePositiveInt(req.query.days, 7);
    const limit = parsePositiveInt(req.query.limit, 10);
    const maxDocs = parsePositiveInt(req.query.maxDocs, 1000);
    const userId = req.query.user;

    const since = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
    const filter = { created_at: { $gte: since } };
    if (userId) {
      filter.user_id = userId;
    }

    const docs = await SocketTrace.find(filter)
      .select('user_id trace created_at origin')
      .sort({ created_at: -1, _id: -1 })
      .limit(maxDocs)
      .lean();

    const perDay = {};
    const overall = {};

    let scannedLines = 0;
    let failureLines = 0;

    docs.forEach((doc) => {
      const createdAt = new Date(doc.created_at || Date.now());
      const traceLines = Array.isArray(doc.trace) ? doc.trace : [];

      traceLines.forEach((line) => {
        scannedLines += 1;
        const parsed = parseTraceLine(line);
        if (!isFailureTraceEvent(parsed)) {
          return;
        }

        failureLines += 1;
        const eventName = parsed?.event || 'unknown_event';
        const lineTime = parseTraceTimestamp(line, createdAt);
        const dayKey = toDayKey(lineTime);

        if (!perDay[dayKey]) {
          perDay[dayKey] = {};
        }

        perDay[dayKey][eventName] = (perDay[dayKey][eventName] || 0) + 1;
        overall[eventName] = (overall[eventName] || 0) + 1;
      });
    });

    const overallTop = Object.entries(overall)
      .map(([event, count]) => ({ event, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const perDayTop = Object.entries(perDay)
      .map(([day, eventCounts]) => {
        const topEvents = Object.entries(eventCounts)
          .map(([event, count]) => ({ event, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, limit);

        const totalFailures = Object.values(eventCounts).reduce((sum, count) => sum + count, 0);
        return { day, topEvents, totalFailures };
      })
      .sort((a, b) => b.day.localeCompare(a.day));

    return sendSuccess(res, {
      overallTop,
      perDay: perDayTop,
      scanned: {
        documents: docs.length,
        lines: scannedLines,
        failureLines,
        days,
        filterUser: userId || null
      }
    }, 'Socket trace aggregation fetched');
  } catch (error) {
    console.error('Socket trace aggregate error:', error.message);
    return sendError(res, 500, 'Failed to aggregate socket traces');
  }
});

/**
 * POST /api/debug/socket-trace/replay
 * Admin remediation endpoint: emits a trace replay payload to the target user room.
 */
router.post('/socket-trace/replay', authMiddleware, ensureAdmin, [
  body('traceId').optional().isMongoId(),
  body('userId').optional().isMongoId(),
  body('maxLines').optional().isInt({ min: 1, max: TRACE_LIMIT_MAX }),
  body('dryRun').optional().isBoolean(),
  body('emitToUser').optional().isBoolean()
], async (req, res) => {
  try {
    const adminKey = `u:${req.user?.userId || 'unknown'}`;
    const allowed = await consumeLimiter(replayLimiter, adminKey, res);
    if (!allowed) return;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, 'Validation failed', { details: errors.array() });
    }

    const { traceId, userId } = req.body || {};
    if (!traceId && !userId) {
      return sendError(res, 400, 'Either traceId or userId is required');
    }

    let traceDoc;
    if (traceId) {
      traceDoc = await SocketTrace.findById(traceId).lean();
    } else {
      traceDoc = await SocketTrace.findOne({ user_id: userId }).sort({ created_at: -1, _id: -1 }).lean();
    }

    if (!traceDoc) {
      return sendError(res, 404, 'Trace not found');
    }

    const maxLines = parsePositiveInt(req.body?.maxLines, TRACE_LIMIT_DEFAULT);
    const dryRun = Boolean(req.body?.dryRun);
    const emitToUser = req.body?.emitToUser !== false;
    const lines = Array.isArray(traceDoc.trace) ? traceDoc.trace.slice(-maxLines) : [];
    const parsedEvents = lines.map(parseTraceLine).filter(Boolean);
    const userRoomId = `user_${String(traceDoc.user_id)}`;

    let emitted = false;
    if (!dryRun && emitToUser && req.io) {
      req.io.to(userRoomId).emit('debug_socket_trace_replay', {
        traceId: String(traceDoc._id),
        userId: String(traceDoc.user_id),
        lines,
        parsedEvents,
        requestedBy: req.user?.userId || null,
        timestamp: new Date().toISOString()
      });
      emitted = true;
    }

    return sendSuccess(res, {
      traceId: String(traceDoc._id),
      userId: String(traceDoc.user_id),
      lineCount: lines.length,
      eventTypes: [...new Set(parsedEvents.map((event) => event.event))],
      dryRun,
      emitted
    }, 'Socket trace replay completed');
  } catch (error) {
    console.error('Socket trace replay error:', error.message);
    return sendError(res, 500, 'Failed to replay socket trace');
  }
});

/**
 * POST /api/debug/socket-trace/export
 * Admin analytics pipeline endpoint: consume traces from DB and ship to configured sink.
 */
router.post('/socket-trace/export', authMiddleware, ensureAdmin, [
  body('sinceMinutes').optional().isInt({ min: 1, max: 10080 }),
  body('limit').optional().isInt({ min: 1, max: 500 }),
  body('userId').optional().isMongoId()
], async (req, res) => {
  try {
    const adminKey = `u:${req.user?.userId || 'unknown'}`;
    const allowed = await consumeLimiter(exportLimiter, adminKey, res);
    if (!allowed) return;

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return sendError(res, 400, 'Validation failed', { details: errors.array() });
    }

    if (TRACE_SINK === 'none') {
      return sendError(res, 400, 'Export sink is disabled. Set SOCKET_TRACE_SINK to stdout|ndjson|webhook');
    }

    const sinceMinutes = parsePositiveInt(req.body?.sinceMinutes, 60);
    const limit = parsePositiveInt(req.body?.limit, 100);
    const userId = req.body?.userId;

    const since = new Date(Date.now() - (sinceMinutes * 60 * 1000));
    const filter = {
      created_at: { $gte: since }
    };

    if (userId) {
      filter.user_id = userId;
    }

    const traces = await SocketTrace.find(filter)
      .sort({ created_at: -1, _id: -1 })
      .limit(limit)
      .lean();

    const results = await Promise.allSettled(traces.map((traceDoc) => publishToSink({
      type: 'socket_trace_export',
      traceId: String(traceDoc._id),
      userId: String(traceDoc.user_id),
      origin: traceDoc.origin || 'mobile',
      deviceInfo: redactDeviceInfo(traceDoc.device_info || {}),
      trace: Array.isArray(traceDoc.trace) ? traceDoc.trace : [],
      createdAt: traceDoc.created_at || traceDoc.createdAt || null,
      exportedAt: new Date().toISOString(),
      exportedBy: req.user?.userId || null
    })));

    const shipped = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.length - shipped;

    return sendSuccess(res, {
      sink: TRACE_SINK,
      redactionMode: TRACE_REDACTION_MODE,
      processed: traces.length,
      shipped,
      failed
    }, 'Socket traces exported to sink');
  } catch (error) {
    console.error('Socket trace export error:', error.message);
    return sendError(res, 500, 'Failed to export socket traces');
  }
});

module.exports = router;
