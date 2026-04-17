/**
 * Verify trust_score distribution and compare before/after snapshots.
 *
 * Usage:
 *   Current stats only:
 *     node scripts/verify-trust-score-distribution.js
 *
 *   Save current snapshot:
 *     node scripts/verify-trust-score-distribution.js --save
 *     node scripts/verify-trust-score-distribution.js --save=./recovery-artifacts/trust-before.json
 *
 *   Compare current stats to previous snapshot:
 *     node scripts/verify-trust-score-distribution.js --compare=./recovery-artifacts/trust-before.json
 *
 *   Optional strict mode (non-zero exit if out-of-range exists):
 *     node scripts/verify-trust-score-distribution.js --strict
 */

const fs = require('fs');
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
    console.log(`[trust_score_verify] Loaded env from ${envPath}`);
    break;
  }
}

const { User } = require('../config/database');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/zerohook';
const NUMERIC_TYPES = ['double', 'int', 'long', 'decimal'];

const parseCliArgs = (argv) => {
  const options = {
    save: false,
    savePath: '',
    comparePath: '',
    label: '',
    strict: false
  };

  for (const arg of argv) {
    if (arg === '--save') {
      options.save = true;
      continue;
    }

    if (arg.startsWith('--save=')) {
      options.save = true;
      options.savePath = arg.split('=')[1] || '';
      continue;
    }

    if (arg.startsWith('--compare=')) {
      options.comparePath = arg.split('=')[1] || '';
      continue;
    }

    if (arg.startsWith('--label=')) {
      options.label = arg.split('=')[1] || '';
      continue;
    }

    if (arg === '--strict') {
      options.strict = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      console.log('Usage: node scripts/verify-trust-score-distribution.js [--save[=path]] [--compare=path] [--label=name] [--strict]');
      process.exit(0);
    }
  }

  return options;
};

const roundTo = (value, decimals = 2) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const computeDistribution = async () => {
  const pipeline = [
    {
      $project: {
        trust_score: 1,
        trustScoreType: { $type: '$trust_score' },
        isNumeric: { $in: [{ $type: '$trust_score' }, NUMERIC_TYPES] }
      }
    },
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        numericCount: { $sum: { $cond: ['$isNumeric', 1, 0] } },
        missingOrNullCount: {
          $sum: {
            $cond: [
              {
                $or: [
                  { $eq: ['$trustScoreType', 'missing'] },
                  { $eq: ['$trust_score', null] }
                ]
              },
              1,
              0
            ]
          }
        },
        nonNumericCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ['$trustScoreType', 'missing'] },
                  { $ne: ['$trust_score', null] },
                  { $not: ['$isNumeric'] }
                ]
              },
              1,
              0
            ]
          }
        },
        belowZeroCount: {
          $sum: {
            $cond: [
              { $and: ['$isNumeric', { $lt: ['$trust_score', 0] }] },
              1,
              0
            ]
          }
        },
        aboveHundredCount: {
          $sum: {
            $cond: [
              { $and: ['$isNumeric', { $gt: ['$trust_score', 100] }] },
              1,
              0
            ]
          }
        },
        minTrustScoreRaw: {
          $min: {
            $cond: ['$isNumeric', '$trust_score', null]
          }
        },
        maxTrustScoreRaw: {
          $max: {
            $cond: ['$isNumeric', '$trust_score', null]
          }
        },
        avgTrustScoreRaw: {
          $avg: {
            $cond: ['$isNumeric', '$trust_score', null]
          }
        }
      }
    }
  ];

  const result = await User.aggregate(pipeline);
  const stats = result[0] || {
    totalUsers: 0,
    numericCount: 0,
    missingOrNullCount: 0,
    nonNumericCount: 0,
    belowZeroCount: 0,
    aboveHundredCount: 0,
    minTrustScoreRaw: null,
    maxTrustScoreRaw: null,
    avgTrustScoreRaw: null
  };

  const outOfRangeCount = Number(stats.belowZeroCount || 0) + Number(stats.aboveHundredCount || 0);

  return {
    totalUsers: Number(stats.totalUsers || 0),
    numericCount: Number(stats.numericCount || 0),
    missingOrNullCount: Number(stats.missingOrNullCount || 0),
    nonNumericCount: Number(stats.nonNumericCount || 0),
    belowZeroCount: Number(stats.belowZeroCount || 0),
    aboveHundredCount: Number(stats.aboveHundredCount || 0),
    outOfRangeCount,
    minTrustScore: stats.minTrustScoreRaw == null ? null : roundTo(Number(stats.minTrustScoreRaw), 2),
    maxTrustScore: stats.maxTrustScoreRaw == null ? null : roundTo(Number(stats.maxTrustScoreRaw), 2),
    avgTrustScore: stats.avgTrustScoreRaw == null ? null : roundTo(Number(stats.avgTrustScoreRaw), 2)
  };
};

const defaultSnapshotPath = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve(__dirname, '../recovery-artifacts', `trust-score-distribution-${timestamp}.json`);
};

const saveSnapshot = (snapshotPath, payload) => {
  const resolvedPath = path.resolve(process.cwd(), snapshotPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, JSON.stringify(payload, null, 2), 'utf8');
  return resolvedPath;
};

const loadSnapshot = (snapshotPath) => {
  const resolvedPath = path.resolve(process.cwd(), snapshotPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Snapshot file not found: ${resolvedPath}`);
  }
  const raw = fs.readFileSync(resolvedPath, 'utf8');
  return { path: resolvedPath, payload: JSON.parse(raw) };
};

const numericDelta = (current, previous) => {
  if (!Number.isFinite(Number(current)) || !Number.isFinite(Number(previous))) {
    return null;
  }
  return roundTo(Number(current) - Number(previous), 2);
};

const buildComparison = (current, previous) => {
  const keys = [
    'totalUsers',
    'numericCount',
    'missingOrNullCount',
    'nonNumericCount',
    'belowZeroCount',
    'aboveHundredCount',
    'outOfRangeCount',
    'minTrustScore',
    'maxTrustScore',
    'avgTrustScore'
  ];

  const delta = {};
  for (const key of keys) {
    delta[key] = numericDelta(current[key], previous[key]);
  }

  return delta;
};

async function run() {
  const options = parseCliArgs(process.argv.slice(2));

  console.log('[trust_score_verify] Starting with options:', options);

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000
  });

  const summary = await computeDistribution();
  const report = {
    generatedAt: new Date().toISOString(),
    label: options.label || 'current',
    summary
  };

  console.log('[trust_score_verify] Current distribution:');
  console.log(JSON.stringify(summary, null, 2));

  if (options.comparePath) {
    const compare = loadSnapshot(options.comparePath);
    const previousSummary = compare.payload?.summary || {};
    const delta = buildComparison(summary, previousSummary);

    report.compare = {
      baselinePath: compare.path,
      baselineLabel: compare.payload?.label || 'baseline',
      baselineGeneratedAt: compare.payload?.generatedAt || null,
      baselineSummary: previousSummary,
      delta
    };

    console.log('[trust_score_verify] Comparison delta:');
    console.log(JSON.stringify(delta, null, 2));
  }

  if (options.save) {
    const snapshotPath = options.savePath ? options.savePath : defaultSnapshotPath();
    const savedPath = saveSnapshot(snapshotPath, report);
    console.log(`[trust_score_verify] Snapshot saved to ${savedPath}`);
  }

  if (options.strict) {
    const hasOutOfRange = Number(summary.outOfRangeCount || 0) > 0;
    const hasInvalidType = Number(summary.nonNumericCount || 0) > 0;
    if (hasOutOfRange || hasInvalidType) {
      throw new Error(`Strict mode failed: outOfRangeCount=${summary.outOfRangeCount}, nonNumericCount=${summary.nonNumericCount}`);
    }
  }
}

run()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[trust_score_verify] Failed:', error.message);
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('[trust_score_verify] Disconnect failed:', disconnectError.message);
    }
    process.exit(1);
  });
