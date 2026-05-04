/**
 * Backfill one-year expiry metadata on legacy eligible-viewer<->sugar connections.
 *
 * Usage:
 *   Dry run (default): node scripts/backfill-sugar-connection-expiry.js
 *   Apply updates:      node scripts/backfill-sugar-connection-expiry.js --apply
 *   With options:       node scripts/backfill-sugar-connection-expiry.js --apply --batch=300 --limit=5000
 *   SRV fallback:       node scripts/backfill-sugar-connection-expiry.js --direct-fallback
 *   Host override:      node scripts/backfill-sugar-connection-expiry.js --direct-fallback --direct-host=ac-*.mongodb.net
 */

const dns = require('dns').promises;
const path = require('path');
const mongoose = require('mongoose');
const { URL } = require('url');

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

const envPaths = [
  path.resolve(__dirname, '../env.local'),
  path.resolve(__dirname, '../.env.local'),
  path.resolve(__dirname, '../.env'),
  path.resolve(process.cwd(), 'env.local'),
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), '.env')
];

for (const envPath of envPaths) {
  const result = require('dotenv').config({ path: envPath });
  if (!result.error) {
    console.log(`[sugar_connection_backfill] Loaded env from ${envPath}`);
    break;
  }
}

const { User, UserConnection, SugarAccessPayment } = require('../config/database');
const { getAccountType, SUGAR_TYPES } = require('../utils/accountTypeUtils');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zerohook';
const ELIGIBLE_VIEWER_TYPES = new Set(['client', 'provider']);

const parseCliArgs = (argv) => {
  const options = {
    apply: false,
    batchSize: 300,
    limit: 0,
    directFallback: false,
    directHost: null
  };

  for (const arg of argv) {
    if (arg === '--apply') {
      options.apply = true;
      continue;
    }

    if (arg.startsWith('--batch=')) {
      const value = parseInt(arg.split('=')[1], 10);
      if (Number.isFinite(value) && value > 0 && value <= 5000) {
        options.batchSize = value;
      }
      continue;
    }

    if (arg.startsWith('--limit=')) {
      const value = parseInt(arg.split('=')[1], 10);
      if (Number.isFinite(value) && value > 0) {
        options.limit = value;
      }
      continue;
    }

    if (arg === '--direct-fallback') {
      options.directFallback = true;
      continue;
    }

    if (arg.startsWith('--direct-host=')) {
      const host = String(arg.split('=')[1] || '').trim();
      if (host) {
        options.directHost = host.replace(/\.$/, '');
      }
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/backfill-sugar-connection-expiry.js [--apply] [--batch=300] [--limit=5000] [--direct-fallback] [--direct-host=HOST]');
      process.exit(0);
    }
  }

  return options;
};

const isSrvLookupFailure = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return [
    'querysrv',
    'econnrefused',
    'enotfound',
    'servfail',
    'dns'
  ].some((token) => message.includes(token));
};

const resolveDirectHostFromSrv = async (clusterHost) => {
  const srvQuery = `_mongodb._tcp.${clusterHost}`;
  const records = await dns.resolveSrv(srvQuery);

  if (!Array.isArray(records) || records.length === 0) {
    throw new Error(`No SRV records resolved for ${srvQuery}`);
  }

  const [preferred] = [...records].sort((left, right) => (
    left.priority - right.priority || right.weight - left.weight
  ));

  return {
    host: String(preferred.name || '').replace(/\.$/, ''),
    port: Number(preferred.port) || null
  };
};

const buildDirectFallbackUri = async (mongoUri, options) => {
  if (!mongoUri.startsWith('mongodb+srv://')) {
    throw new Error('Direct fallback requires a mongodb+srv URI');
  }

  const parsed = new URL(mongoUri);
  let directHost = options.directHost;
  let directPort = null;

  if (!directHost) {
    const resolvedHost = await resolveDirectHostFromSrv(parsed.hostname);
    directHost = resolvedHost.host;
    directPort = resolvedHost.port;
  }

  const hostWithPort = directPort && !directHost.includes(':')
    ? `${directHost}:${directPort}`
    : directHost;

  parsed.protocol = 'mongodb:';
  parsed.host = hostWithPort;

  if (!parsed.searchParams.has('directConnection')) {
    parsed.searchParams.set('directConnection', 'true');
  }

  if (!parsed.searchParams.has('authSource')) {
    parsed.searchParams.set('authSource', 'admin');
  }

  if (!parsed.searchParams.has('tls') && !parsed.searchParams.has('ssl')) {
    parsed.searchParams.set('tls', 'true');
  }

  return {
    uri: parsed.toString(),
    host: directHost,
    port: directPort
  };
};

const connectWithOptionalDirectFallback = async (mongoUri, options) => {
  const connectOptions = {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000
  };

  try {
    await mongoose.connect(mongoUri, connectOptions);
    return {
      usedDirectFallback: false,
      directHost: null,
      directPort: null
    };
  } catch (primaryError) {
    if (!options.directFallback || !isSrvLookupFailure(primaryError)) {
      throw primaryError;
    }

    const fallback = await buildDirectFallbackUri(mongoUri, options);
    console.warn(`[sugar_connection_backfill] Primary SRV connection failed (${primaryError.message}). Retrying with direct host ${fallback.host}${fallback.port ? `:${fallback.port}` : ''}`);

    await mongoose.connect(fallback.uri, connectOptions);

    return {
      usedDirectFallback: true,
      directHost: fallback.host,
      directPort: fallback.port
    };
  }
};

const asDate = (value, fallback = null) => {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
};

const toKey = (value) => (value ? String(value) : null);

const buildUserTypeLookup = (users) => {
  const byId = new Map();
  for (const user of users) {
    byId.set(String(user._id), getAccountType(user) || 'client');
  }
  return byId;
};

const resolveProviderSugarPair = (fromType, toType, fromUserId, toUserId) => {
  const fromToSugar = ELIGIBLE_VIEWER_TYPES.has(fromType) && SUGAR_TYPES.includes(toType);
  if (fromToSugar) {
    return {
      providerId: toKey(fromUserId),
      sugarType: toType
    };
  }

  const toFromSugar = ELIGIBLE_VIEWER_TYPES.has(toType) && SUGAR_TYPES.includes(fromType);
  if (toFromSugar) {
    return {
      providerId: toKey(toUserId),
      sugarType: fromType
    };
  }

  return null;
};

const getRequiredAccessTypes = (sugarType) => {
  if (sugarType === 'sugar_daddy') return ['sugar_daddy', 'both'];
  if (sugarType === 'sugar_mommy') return ['sugar_mommy', 'both'];
  return ['both'];
};

const buildPaymentsByProvider = async (providerIds) => {
  if (!providerIds.length) {
    return new Map();
  }

  const payments = await SugarAccessPayment.find({
    providerId: { $in: providerIds },
    paymentStatus: 'completed'
  })
    .select('_id providerId accessType accessStartsAt accessExpiresAt createdAt')
    .sort({ accessExpiresAt: -1 })
    .lean();

  const byProvider = new Map();
  for (const payment of payments) {
    const key = toKey(payment.providerId);
    if (!key) continue;

    const existing = byProvider.get(key) || [];
    existing.push(payment);
    byProvider.set(key, existing);
  }

  return byProvider;
};

const findCoveringSugarPayment = ({ providerId, requiredAccessTypes, connectionCreatedAt, paymentsByProvider }) => {
  const paymentCandidates = paymentsByProvider.get(providerId) || [];
  if (!paymentCandidates.length) return null;

  for (const payment of paymentCandidates) {
    if (!requiredAccessTypes.includes(payment.accessType)) {
      continue;
    }

    const startsAt = asDate(payment.accessStartsAt, null);
    const expiresAt = asDate(payment.accessExpiresAt, null);

    if (!expiresAt) {
      continue;
    }

    if (startsAt && connectionCreatedAt < startsAt) {
      continue;
    }

    if (connectionCreatedAt > expiresAt) {
      continue;
    }

    return {
      _id: payment._id,
      accessType: payment.accessType,
      accessExpiresAt: expiresAt
    };
  }

  return null;
};

const flushOperations = async (operations, apply) => {
  if (!operations.length) return 0;
  if (!apply) return operations.length;

  const result = await UserConnection.bulkWrite(operations, { ordered: false });
  return Number(result?.modifiedCount || result?.matchedCount || operations.length);
};

const processBatch = async ({ batchDocs, options, stats }) => {
  if (!batchDocs.length) return 0;

  const userIds = new Set();
  for (const doc of batchDocs) {
    userIds.add(String(doc.from_user_id));
    userIds.add(String(doc.to_user_id));
  }

  const users = await User.find({ _id: { $in: Array.from(userIds) } })
    .select('_id accountType account_type profile_data profileData')
    .lean();
  const userTypeById = buildUserTypeLookup(users);

  const providerIds = new Set();
  for (const doc of batchDocs) {
    const fromType = userTypeById.get(String(doc.from_user_id)) || 'client';
    const toType = userTypeById.get(String(doc.to_user_id)) || 'client';
    const relation = resolveProviderSugarPair(fromType, toType, doc.from_user_id, doc.to_user_id);
    if (relation?.providerId) {
      providerIds.add(relation.providerId);
    }
  }

  const paymentsByProvider = await buildPaymentsByProvider(Array.from(providerIds));
  const operations = [];
  const now = new Date();

  for (const doc of batchDocs) {
    const fromType = userTypeById.get(String(doc.from_user_id)) || 'client';
    const toType = userTypeById.get(String(doc.to_user_id)) || 'client';

    const relation = resolveProviderSugarPair(fromType, toType, doc.from_user_id, doc.to_user_id);
    if (!relation) {
      continue;
    }

    stats.providerSugarConnections += 1;

    const connectionCreatedAt = asDate(doc.created_at, now);
    const requiredAccessTypes = getRequiredAccessTypes(relation.sugarType);
    const payment = findCoveringSugarPayment({
      providerId: relation.providerId,
      requiredAccessTypes,
      connectionCreatedAt,
      paymentsByProvider
    });

    const setFields = {};

    if (doc.connection_policy !== 'sugar_limited') {
      setFields.connection_policy = 'sugar_limited';
      stats.policyStamped += 1;
    }

    if (!doc.connection_expires_at) {
      const oneYearExpiry = new Date(connectionCreatedAt.getTime() + ONE_YEAR_MS);
      const paymentExpiry = payment?.accessExpiresAt || null;
      const effectiveExpiry = paymentExpiry && paymentExpiry < oneYearExpiry
        ? paymentExpiry
        : oneYearExpiry;

      setFields.connection_expires_at = effectiveExpiry;
      stats.expiryStamped += 1;

      if (effectiveExpiry <= now) {
        stats.expiryAlreadyElapsed += 1;
      }
    }

    if (!doc.sugar_access_type) {
      setFields.sugar_access_type = payment?.accessType || relation.sugarType;
      stats.accessTypeStamped += 1;
    }

    if (!doc.sugar_access_payment_id && payment?._id) {
      setFields.sugar_access_payment_id = payment._id;
      stats.paymentRefStamped += 1;
    }

    if (!payment) {
      stats.noPaymentMatch += 1;
    }

    if (!Object.keys(setFields).length) {
      stats.alreadyStamped += 1;
      continue;
    }

    setFields.updated_at = new Date();
    operations.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: setFields }
      }
    });
    stats.scheduled += 1;
  }

  return flushOperations(operations, options.apply);
};

async function run() {
  const options = parseCliArgs(process.argv.slice(2));
  const runMode = options.apply ? 'APPLY' : 'DRY_RUN';

  console.log(`[sugar_connection_backfill] Starting in ${runMode} mode with options:`, options);

  const connectionInfo = await connectWithOptionalDirectFallback(MONGODB_URI, options);
  if (connectionInfo.usedDirectFallback) {
    console.log(`[sugar_connection_backfill] Connected via direct host fallback: ${connectionInfo.directHost}${connectionInfo.directPort ? `:${connectionInfo.directPort}` : ''}`);
  }

  let finder = UserConnection.find({})
    .select('_id from_user_id to_user_id connection_policy connection_expires_at sugar_access_type sugar_access_payment_id created_at')
    .sort({ _id: 1 })
    .lean();

  if (options.limit > 0) {
    finder = finder.limit(options.limit);
  }

  const cursor = finder.cursor();

  const stats = {
    scanned: 0,
    providerSugarConnections: 0,
    alreadyStamped: 0,
    scheduled: 0,
    written: 0,
    policyStamped: 0,
    expiryStamped: 0,
    expiryAlreadyElapsed: 0,
    accessTypeStamped: 0,
    paymentRefStamped: 0,
    noPaymentMatch: 0
  };

  let batchDocs = [];

  for await (const doc of cursor) {
    stats.scanned += 1;
    batchDocs.push(doc);

    if (batchDocs.length >= options.batchSize) {
      stats.written += await processBatch({ batchDocs, options, stats });
      batchDocs = [];
    }

    if (stats.scanned % 1000 === 0) {
      console.log(
        `[sugar_connection_backfill] Progress scanned=${stats.scanned}, pairs=${stats.providerSugarConnections}, scheduled=${stats.scheduled}, ${options.apply ? 'written' : 'would_write'}=${stats.written}`
      );
    }
  }

  if (batchDocs.length) {
    stats.written += await processBatch({ batchDocs, options, stats });
  }

  console.log('[sugar_connection_backfill] Complete');
  console.log(`[sugar_connection_backfill] scanned=${stats.scanned}`);
  console.log(`[sugar_connection_backfill] provider_sugar_connections=${stats.providerSugarConnections}`);
  console.log(`[sugar_connection_backfill] already_stamped=${stats.alreadyStamped}`);
  console.log(`[sugar_connection_backfill] scheduled=${stats.scheduled}`);
  console.log(`[sugar_connection_backfill] policy_stamped=${stats.policyStamped}`);
  console.log(`[sugar_connection_backfill] expiry_stamped=${stats.expiryStamped}`);
  console.log(`[sugar_connection_backfill] expiry_already_elapsed=${stats.expiryAlreadyElapsed}`);
  console.log(`[sugar_connection_backfill] access_type_stamped=${stats.accessTypeStamped}`);
  console.log(`[sugar_connection_backfill] payment_ref_stamped=${stats.paymentRefStamped}`);
  console.log(`[sugar_connection_backfill] no_payment_match=${stats.noPaymentMatch}`);
  console.log(`[sugar_connection_backfill] ${options.apply ? 'written' : 'would_write'}=${stats.written}`);
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[sugar_connection_backfill] Failed:', error.message);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('[sugar_connection_backfill] Disconnect failed:', disconnectError.message);
    }
    process.exit(1);
  });