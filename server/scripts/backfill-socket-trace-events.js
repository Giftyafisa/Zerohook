/**
 * Backfill trace_events in SocketTrace documents for index-backed event filtering.
 *
 * Usage:
 *   node scripts/backfill-socket-trace-events.js [--dry-run] [--force] [--batch=500] [--limit=10000]
 */

const path = require('path');
const mongoose = require('mongoose');

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
    console.log(`[trace_events_backfill] Loaded env from ${envPath}`);
    break;
  }
}

const { SocketTrace } = require('../config/database');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zerohook';

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

const parseCliArgs = (argv) => {
  const options = {
    dryRun: false,
    force: false,
    batchSize: 500,
    limit: 0
  };

  argv.forEach((arg) => {
    if (arg === '--dry-run') {
      options.dryRun = true;
      return;
    }

    if (arg === '--force') {
      options.force = true;
      return;
    }

    if (arg.startsWith('--batch=')) {
      const value = parseInt(arg.split('=')[1], 10);
      if (Number.isFinite(value) && value > 0 && value <= 5000) {
        options.batchSize = value;
      }
      return;
    }

    if (arg.startsWith('--limit=')) {
      const value = parseInt(arg.split('=')[1], 10);
      if (Number.isFinite(value) && value > 0) {
        options.limit = value;
      }
      return;
    }

    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/backfill-socket-trace-events.js [--dry-run] [--force] [--batch=500] [--limit=10000]');
      process.exit(0);
    }
  });

  return options;
};

const arraysEqual = (left, right) => {
  if (!Array.isArray(left) || !Array.isArray(right)) {
    return false;
  }

  if (left.length !== right.length) {
    return false;
  }

  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }

  return true;
};

const flushBulkUpdates = async (operations, dryRun) => {
  if (!operations.length) {
    return 0;
  }

  if (dryRun) {
    return operations.length;
  }

  const result = await SocketTrace.bulkWrite(operations, { ordered: false });
  return Number(result?.modifiedCount || result?.matchedCount || operations.length);
};

async function run() {
  const options = parseCliArgs(process.argv.slice(2));

  console.log('[trace_events_backfill] Starting backfill with options:', options);
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000
  });

  const query = options.force
    ? {}
    : { 'trace_events.0': { $exists: false } };

  let finder = SocketTrace.find(query)
    .select('_id trace trace_events')
    .sort({ _id: 1 })
    .lean();

  if (options.limit > 0) {
    finder = finder.limit(options.limit);
  }

  const cursor = finder.cursor();

  let scanned = 0;
  let unchanged = 0;
  let scheduled = 0;
  let written = 0;
  let operations = [];

  for await (const doc of cursor) {
    scanned += 1;
    const currentEvents = Array.isArray(doc.trace_events) ? doc.trace_events : [];
    const nextEvents = extractTraceEvents(doc.trace);

    if (arraysEqual(currentEvents, nextEvents)) {
      unchanged += 1;
      continue;
    }

    scheduled += 1;
    operations.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { trace_events: nextEvents } }
      }
    });

    if (operations.length >= options.batchSize) {
      written += await flushBulkUpdates(operations, options.dryRun);
      operations = [];
    }

    if (scanned % 1000 === 0) {
      console.log(`[trace_events_backfill] Progress scanned=${scanned}, scheduled=${scheduled}, written=${written}`);
    }
  }

  if (operations.length) {
    written += await flushBulkUpdates(operations, options.dryRun);
  }

  console.log('[trace_events_backfill] Complete');
  console.log(`[trace_events_backfill] scanned=${scanned}`);
  console.log(`[trace_events_backfill] unchanged=${unchanged}`);
  console.log(`[trace_events_backfill] scheduled=${scheduled}`);
  console.log(`[trace_events_backfill] ${options.dryRun ? 'would_write' : 'written'}=${written}`);
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[trace_events_backfill] Failed:', error.message);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('[trace_events_backfill] Disconnect failed:', disconnectError.message);
    }
    process.exit(1);
  });
