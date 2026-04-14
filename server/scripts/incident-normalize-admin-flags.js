/*
 * Normalize admin flag consistency in users collection.
 *
 * Rules:
 * - role === 'admin' must have is_admin === true
 * - is_admin === true must have role === 'admin'
 *
 * Usage:
 *   Dry run: node scripts/incident-normalize-admin-flags.js
 *   Apply:   node scripts/incident-normalize-admin-flags.js --apply
 */

const path = require('path');
const mongoose = require('mongoose');

function loadEnv() {
  const dotenv = require('dotenv');
  const candidates = [
    path.resolve(__dirname, '..', 'env.local'),
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', '.env.production')
  ];

  for (const envPath of candidates) {
    dotenv.config({ path: envPath });
  }
}

function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '(missing)';
  const [name, domain] = email.split('@');
  const masked = name.length <= 2 ? `${name[0] || '*'}*` : `${name.slice(0, 2)}***`;
  return `${masked}@${domain}`;
}

function getMismatchFilter() {
  return {
    $or: [
      { role: 'admin', is_admin: { $ne: true } },
      { is_admin: true, role: { $ne: 'admin' } }
    ]
  };
}

async function run() {
  loadEnv();

  const uri = process.env.MONGODB_URI;
  const apply = process.argv.includes('--apply');

  if (!uri) {
    console.error('MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000
  });

  const db = mongoose.connection.db;
  const users = db.collection('users');
  const mismatchFilter = getMismatchFilter();

  const mismatches = await users
    .find(mismatchFilter)
    .project({ username: 1, email: 1, role: 1, is_admin: 1, status: 1, updated_at: 1 })
    .sort({ updated_at: -1 })
    .toArray();

  console.log('=== ADMIN FLAG NORMALIZATION ===');
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log(`Mismatch count: ${mismatches.length}`);

  if (mismatches.length > 0) {
    console.log('\n[Sample mismatches]');
    for (const u of mismatches.slice(0, 25)) {
      console.log(
        `- ${u._id} | ${u.username || '(missing)'} | ${maskEmail(u.email)} | role=${u.role || '(null)'} | is_admin=${u.is_admin === true} | status=${u.status || '(null)'}`
      );
    }
    if (mismatches.length > 25) {
      console.log(`... and ${mismatches.length - 25} more`);
    }
  }

  if (!apply) {
    await mongoose.disconnect();
    return;
  }

  const [roleAdminFix, isAdminFix] = await Promise.all([
    users.updateMany(
      { role: 'admin', is_admin: { $ne: true } },
      { $set: { is_admin: true, updated_at: new Date() } }
    ),
    users.updateMany(
      { is_admin: true, role: { $ne: 'admin' } },
      { $set: { role: 'admin', updated_at: new Date() } }
    )
  ]);

  const remaining = await users.countDocuments(mismatchFilter);

  console.log('\n[Apply summary]');
  console.log(`- role=admin -> is_admin=true matched: ${roleAdminFix.matchedCount}, modified: ${roleAdminFix.modifiedCount}`);
  console.log(`- is_admin=true -> role=admin matched: ${isAdminFix.matchedCount}, modified: ${isAdminFix.modifiedCount}`);
  console.log(`- remaining mismatches: ${remaining}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Normalization failed:', error.message);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore disconnect errors on failure path
  }
  process.exit(1);
});
