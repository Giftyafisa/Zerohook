/*
 * Restore users collection from a trusted JSON export (pre-attack snapshot).
 *
 * Usage:
 *   Dry run: node scripts/incident-restore-users-from-json.js ./path/to/users.json
 *   Apply:   node scripts/incident-restore-users-from-json.js ./path/to/users.json --apply
 *
 * Input format: JSON array of MongoDB user documents.
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

function toObjectId(raw) {
  if (raw && typeof raw === 'object' && raw.$oid) {
    return new mongoose.Types.ObjectId(raw.$oid);
  }
  return new mongoose.Types.ObjectId(String(raw));
}

function normalizeDoc(raw) {
  const doc = { ...raw };

  if (!doc._id) {
    throw new Error('Document is missing _id');
  }

  doc._id = toObjectId(doc._id);

  // Normalize common extended JSON date format when present.
  for (const key of ['created_at', 'updated_at', 'last_active', 'subscription_expires_at']) {
    const value = doc[key];
    if (value && typeof value === 'object' && value.$date) {
      doc[key] = new Date(value.$date);
    }
  }

  return doc;
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }

  const fileArg = process.argv[2];
  const applyMode = process.argv.includes('--apply');

  if (!fileArg) {
    console.error('Missing input file path.');
    process.exit(1);
  }

  const inputPath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(inputPath)) {
    console.error(`Input file does not exist: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    console.error('Input file must contain a JSON array.');
    process.exit(1);
  }

  const normalized = parsed.map(normalizeDoc);

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000
  });

  const users = mongoose.connection.db.collection('users');

  console.log('=== USERS RESTORE PLAN ===');
  console.log(`inputFile: ${inputPath}`);
  console.log(`documentsInFile: ${normalized.length}`);
  console.log(`mode: ${applyMode ? 'APPLY' : 'DRY_RUN'}`);

  if (!applyMode) {
    console.log('Dry run only. No data was modified.');
    console.log('Add --apply to perform replacement upserts.');
    return;
  }

  if (normalized.length === 0) {
    console.log('No documents in input file. Nothing to apply.');
    return;
  }

  const ops = normalized.map((doc) => ({
    replaceOne: {
      filter: { _id: doc._id },
      replacement: doc,
      upsert: true
    }
  }));

  const result = await users.bulkWrite(ops, { ordered: false });

  console.log('Restore apply complete.');
  console.log(`matchedCount: ${result.matchedCount || 0}`);
  console.log(`modifiedCount: ${result.modifiedCount || 0}`);
  console.log(`upsertedCount: ${result.upsertedCount || 0}`);
}

run()
  .catch((error) => {
    console.error('Restore script failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
