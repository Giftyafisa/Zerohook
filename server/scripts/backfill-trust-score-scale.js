/**
 * Backfill users.trust_score to the canonical 0-100 scale.
 *
 * Usage:
 *   Dry run (default): node scripts/backfill-trust-score-scale.js
 *   Apply updates:      node scripts/backfill-trust-score-scale.js --apply
 *   With options:       node scripts/backfill-trust-score-scale.js --apply --batch=500 --limit=10000
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
    console.log(`[trust_score_backfill] Loaded env from ${envPath}`);
    break;
  }
}

const { User } = require('../config/database');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zerohook';

const parseCliArgs = (argv) => {
  const options = {
    apply: false,
    batchSize: 500,
    limit: 0
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

    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/backfill-trust-score-scale.js [--apply] [--batch=500] [--limit=10000]');
      process.exit(0);
    }
  }

  return options;
};

const normalizeTrustScore = (rawValue) => {
  const numeric = Number(rawValue);
  let reason = null;

  if (!Number.isFinite(numeric)) {
    return { nextValue: 0, changed: true, reason: 'non_numeric_to_zero' };
  }

  let adjusted = numeric;
  if (adjusted > 100) {
    adjusted = adjusted / 10;
    reason = 'legacy_0_1000_scaled';
  }

  const clamped = Math.max(0, Math.min(100, adjusted));
  const rounded = Math.round(clamped);

  if (rounded !== numeric) {
    if (!reason) {
      reason = adjusted !== clamped ? 'clamped' : 'rounded';
    }

    return { nextValue: rounded, changed: true, reason };
  }

  return { nextValue: rounded, changed: false, reason: null };
};

const flushOperations = async (operations, apply) => {
  if (!operations.length) {
    return 0;
  }

  if (!apply) {
    return operations.length;
  }

  const result = await User.bulkWrite(operations, { ordered: false });
  return Number(result?.modifiedCount || result?.matchedCount || operations.length);
};

async function run() {
  const options = parseCliArgs(process.argv.slice(2));
  const runMode = options.apply ? 'APPLY' : 'DRY_RUN';

  console.log(`[trust_score_backfill] Starting in ${runMode} mode with options:`, options);

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000
  });

  let finder = User.find({})
    .select('_id trust_score')
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
  let legacyScaled = 0;
  let nonNumericToZero = 0;
  let clampedOrRounded = 0;

  let operations = [];

  for await (const doc of cursor) {
    scanned += 1;

    const normalized = normalizeTrustScore(doc.trust_score);
    if (!normalized.changed) {
      unchanged += 1;
      continue;
    }

    scheduled += 1;

    if (normalized.reason === 'legacy_0_1000_scaled') {
      legacyScaled += 1;
    } else if (normalized.reason === 'non_numeric_to_zero') {
      nonNumericToZero += 1;
    } else {
      clampedOrRounded += 1;
    }

    operations.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            trust_score: normalized.nextValue,
            updated_at: new Date()
          }
        }
      }
    });

    if (operations.length >= options.batchSize) {
      written += await flushOperations(operations, options.apply);
      operations = [];
    }

    if (scanned % 1000 === 0) {
      console.log(`[trust_score_backfill] Progress scanned=${scanned}, scheduled=${scheduled}, ${options.apply ? 'written' : 'would_write'}=${written}`);
    }
  }

  if (operations.length) {
    written += await flushOperations(operations, options.apply);
  }

  console.log('[trust_score_backfill] Complete');
  console.log(`[trust_score_backfill] scanned=${scanned}`);
  console.log(`[trust_score_backfill] unchanged=${unchanged}`);
  console.log(`[trust_score_backfill] scheduled=${scheduled}`);
  console.log(`[trust_score_backfill] legacy_scaled=${legacyScaled}`);
  console.log(`[trust_score_backfill] non_numeric_to_zero=${nonNumericToZero}`);
  console.log(`[trust_score_backfill] clamped_or_rounded=${clampedOrRounded}`);
  console.log(`[trust_score_backfill] ${options.apply ? 'written' : 'would_write'}=${written}`);
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[trust_score_backfill] Failed:', error.message);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('[trust_score_backfill] Disconnect failed:', disconnectError.message);
    }
    process.exit(1);
  });
