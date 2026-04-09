/*
 * Incident stabilization for Fernet-corrupted user records.
 *
 * What this script does:
 * 1) Finds corrupted users (gAAAAA* tokens and invalid field types)
 * 2) Computes attack window from Fernet token timestamps
 * 3) (apply mode) Saves JSON backup + archives docs in users_corrupted_archive
 * 4) (apply mode) Neutralizes risky flags (admin/role/status) without deleting records
 *
 * Usage:
 *   Dry run: node scripts/incident-stabilize-users.js
 *   Apply:   node scripts/incident-stabilize-users.js --apply
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

function parseFernetTimestamp(token) {
  if (typeof token !== 'string' || !token.startsWith('gAAAAA')) {
    return null;
  }

  try {
    const padded = token + '='.repeat((4 - (token.length % 4)) % 4);
    const raw = Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (raw.length < 9 || raw[0] !== 0x80) {
      return null;
    }

    const hi = raw.readUInt32BE(1);
    const lo = raw.readUInt32BE(5);
    const seconds = hi * 4294967296 + lo;
    return new Date(seconds * 1000);
  } catch (error) {
    return null;
  }
}

function getCorruptionFilter() {
  return {
    $or: [
      { username: /^gAAAAA/ },
      { email: /^gAAAAA/ },
      { role: /^gAAAAA/ },
      { status: /^gAAAAA/ },
      { password_hash: /^gAAAAA/ },
      { profile_data: { $type: 'string' } },
      { is_admin: { $type: 'string' } },
      { created_at: { $type: 'string' } },
      { updated_at: { $type: 'string' } },
      { last_active: { $type: 'string' } }
    ]
  };
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Aborting.');
    process.exit(1);
  }

  const applyMode = process.argv.includes('--apply');

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000
  });

  const db = mongoose.connection.db;
  const users = db.collection('users');
  const archive = db.collection('users_corrupted_archive');
  const corruptionFilter = getCorruptionFilter();

  const [totalUsers, corruptedUsers] = await Promise.all([
    users.countDocuments(),
    users.find(corruptionFilter).toArray()
  ]);

  const healthyUsers = totalUsers - corruptedUsers.length;

  let attackStart = null;
  let attackEnd = null;
  for (const user of corruptedUsers) {
    const tokens = [user.username, user.email, user.status, user.role, user.password_hash, user.profile_data]
      .filter((value) => typeof value === 'string');
    for (const token of tokens) {
      const ts = parseFernetTimestamp(token);
      if (!ts) continue;
      if (!attackStart || ts < attackStart) attackStart = ts;
      if (!attackEnd || ts > attackEnd) attackEnd = ts;
    }
  }

  console.log('=== INCIDENT STABILIZATION SUMMARY ===');
  console.log(`totalUsers: ${totalUsers}`);
  console.log(`corruptedUsers: ${corruptedUsers.length}`);
  console.log(`healthyUsers: ${healthyUsers}`);
  console.log(`attackWindowStart: ${attackStart ? attackStart.toISOString() : 'n/a'}`);
  console.log(`attackWindowEnd: ${attackEnd ? attackEnd.toISOString() : 'n/a'}`);

  if (!applyMode) {
    console.log('\nDry run only. No data was modified.');
    console.log('Run with --apply to archive and stabilize corrupted users.');
    return;
  }

  if (corruptedUsers.length === 0) {
    console.log('\nNo corrupted users found. Nothing to apply.');
    return;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const artifactsDir = path.resolve(__dirname, '..', 'recovery-artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });

  const backupPath = path.join(artifactsDir, `users-corrupted-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(corruptedUsers, null, 2), 'utf8');

  const archiveDocs = corruptedUsers.map((userDoc) => ({
    archived_at: new Date(),
    incident_type: 'fernet_user_field_corruption',
    attack_window_start: attackStart,
    attack_window_end: attackEnd,
    source_collection: 'users',
    user_id: userDoc._id,
    payload: userDoc
  }));
  await archive.insertMany(archiveDocs, { ordered: false });

  const stabilizeResult = await users.updateMany(
    corruptionFilter,
    {
      $set: {
        is_admin: false,
        role: 'user',
        status: 'suspended',
        recovery_required: true,
        recovery_reason: 'fernet_user_field_corruption',
        recovery_marked_at: new Date(),
        updated_at: new Date()
      }
    }
  );

  const manifest = {
    generated_at: new Date().toISOString(),
    total_users: totalUsers,
    corrupted_users: corruptedUsers.length,
    healthy_users: healthyUsers,
    attack_window_start: attackStart ? attackStart.toISOString() : null,
    attack_window_end: attackEnd ? attackEnd.toISOString() : null,
    backup_file: backupPath,
    archive_collection: 'users_corrupted_archive',
    stabilized_matched_count: stabilizeResult.matchedCount,
    stabilized_modified_count: stabilizeResult.modifiedCount,
    restore_note: 'Full restoration requires pre-attack backup/snapshot taken before attack_window_start.'
  };

  const manifestPath = path.join(artifactsDir, `incident-manifest-${timestamp}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\nApply complete.');
  console.log(`backupFile: ${backupPath}`);
  console.log(`manifestFile: ${manifestPath}`);
  console.log(`archiveInserted: ${archiveDocs.length}`);
  console.log(`stabilizedMatched: ${stabilizeResult.matchedCount}`);
  console.log(`stabilizedModified: ${stabilizeResult.modifiedCount}`);
}

run()
  .catch((error) => {
    console.error('Incident stabilization failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
