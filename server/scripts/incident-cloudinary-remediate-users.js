/*
 * Cloudinary-aware incident remediation for corrupted users.
 *
 * Strategy:
 * - Match Cloudinary assets to users via public_id patterns (profile/content/post + ObjectId)
 * - Detect corrupted users (Fernet tokens + invalid types)
 * - Build recoverability signals from Cloudinary + DB snapshots (content/file upload username)
 * - Apply mode:
 *   - Delete only unrecoverable orphan users (no links + no Cloudinary assets)
 *   - Restart/sanitize all other corrupted users to clean state
 *
 * Usage:
 *   Dry run: node scripts/incident-cloudinary-remediate-users.js
 *   Apply:   node scripts/incident-cloudinary-remediate-users.js --apply
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;

function ensureEnv() {
  // Load local env file for Cloudinary credentials when not already in process env.
  try {
    require('dotenv').config({ path: path.resolve(__dirname, '..', 'env.local') });
  } catch (_) {
    // Non-fatal; values may already exist in process env.
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

function extractUserIdFromPublicId(publicId) {
  if (typeof publicId !== 'string') return null;

  // Examples:
  // - zerohook/profiles/profile-<id>-<ts>
  // - zerohook/content/content-<id>-<ts>-<suffix>
  // - zerohook/content/post-<id>-<ts>
  const match = publicId.match(/(?:profile|content|post|verify)-([a-f0-9]{24})-/i);
  return match ? match[1].toLowerCase() : null;
}

function sanitizeUsername(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!cleaned) return null;
  return cleaned.slice(0, 22);
}

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function fieldLooksEncrypted(value) {
  return typeof value === 'string' && value.startsWith('gAAAAA');
}

function changedFieldList(userDoc) {
  const fields = [];
  const checks = [
    ['username', userDoc.username],
    ['email', userDoc.email],
    ['password_hash', userDoc.password_hash],
    ['phone', userDoc.phone],
    ['role', userDoc.role],
    ['status', userDoc.status],
    ['is_admin', userDoc.is_admin],
    ['verification_tier', userDoc.verification_tier],
    ['reputation_score', userDoc.reputation_score],
    ['trust_score', userDoc.trust_score],
    ['profile_data', userDoc.profile_data],
    ['is_subscribed', userDoc.is_subscribed],
    ['subscription_tier', userDoc.subscription_tier],
    ['created_at', userDoc.created_at],
    ['updated_at', userDoc.updated_at],
    ['last_active', userDoc.last_active]
  ];

  for (const [key, value] of checks) {
    if (fieldLooksEncrypted(value)) {
      fields.push(key);
      continue;
    }

    if (key === 'profile_data' && typeof value === 'string') {
      fields.push(key);
      continue;
    }

    if ((key === 'created_at' || key === 'updated_at' || key === 'last_active') && typeof value === 'string') {
      fields.push(key);
      continue;
    }
  }

  return fields;
}

async function listCloudinaryAssets() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return { enabled: false, assets: [] };
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });

  const assets = [];
  for (const resourceType of ['image', 'video', 'raw']) {
    let nextCursor = undefined;
    do {
      const result = await cloudinary.api.resources({
        type: 'upload',
        resource_type: resourceType,
        prefix: 'zerohook/',
        max_results: 500,
        next_cursor: nextCursor
      });

      for (const item of result.resources || []) {
        assets.push({
          resourceType,
          publicId: item.public_id,
          secureUrl: item.secure_url,
          createdAt: item.created_at ? new Date(item.created_at) : null,
          bytes: item.bytes || 0
        });
      }

      nextCursor = result.next_cursor;
    } while (nextCursor);
  }

  return { enabled: true, assets };
}

async function collectLinkedUserIds(db) {
  const linked = new Map();

  async function addCounts(collectionName, fieldName) {
    const exists = await db.listCollections({ name: collectionName }, { nameOnly: true }).hasNext();
    if (!exists) return;

    const docs = await db.collection(collectionName).aggregate([
      {
        $match: {
          [fieldName]: { $type: 'objectId' }
        }
      },
      {
        $group: {
          _id: `$${fieldName}`,
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    for (const row of docs) {
      const id = String(row._id);
      linked.set(id, (linked.get(id) || 0) + row.count);
    }
  }

  const checks = [
    ['services', 'provider_id'],
    ['transactions', 'client_id'],
    ['transactions', 'provider_id'],
    ['transactions', 'user_id'],
    ['conversations', 'participant1Id'],
    ['conversations', 'participant2Id'],
    ['messages', 'senderId'],
    ['subscriptions', 'user_id'],
    ['fileuploads', 'user_id'],
    ['contentposts', 'user_id']
  ];

  for (const [collectionName, fieldName] of checks) {
    await addCounts(collectionName, fieldName);
  }

  return linked;
}

async function collectUsernameSnapshots(db, targetUserIds) {
  const idList = [...targetUserIds].map((id) => new mongoose.Types.ObjectId(id));
  const snapshots = new Map();

  if (idList.length === 0) return snapshots;

  const contentPostExists = await db.listCollections({ name: 'contentposts' }, { nameOnly: true }).hasNext();
  if (contentPostExists) {
    const fromContentPosts = await db.collection('contentposts').aggregate([
      {
        $match: {
          user_id: { $in: idList },
          username: { $type: 'string', $not: /^gAAAAA/ }
        }
      },
      {
        $sort: { created_at: -1 }
      },
      {
        $group: {
          _id: '$user_id',
          username: { $first: '$username' },
          source: { $first: 'contentposts' }
        }
      }
    ]).toArray();

    for (const row of fromContentPosts) {
      snapshots.set(String(row._id), { username: row.username, source: row.source });
    }
  }

  const fileUploadExists = await db.listCollections({ name: 'fileuploads' }, { nameOnly: true }).hasNext();
  if (fileUploadExists) {
    const fromFileUploads = await db.collection('fileuploads').aggregate([
      {
        $match: {
          user_id: { $in: idList },
          username: { $type: 'string', $not: /^gAAAAA/ }
        }
      },
      {
        $sort: { created_at: -1 }
      },
      {
        $group: {
          _id: '$user_id',
          username: { $first: '$username' },
          source: { $first: 'fileuploads' }
        }
      }
    ]).toArray();

    for (const row of fromFileUploads) {
      const key = String(row._id);
      if (!snapshots.has(key)) {
        snapshots.set(key, { username: row.username, source: row.source });
      }
    }
  }

  return snapshots;
}

async function run() {
  ensureEnv();

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

  const corruptedUsers = await users.find(getCorruptionFilter()).toArray();
  const corruptedIds = new Set(corruptedUsers.map((u) => String(u._id)));

  const cloud = await listCloudinaryAssets();
  const cloudByUser = new Map();
  for (const asset of cloud.assets) {
    const userId = extractUserIdFromPublicId(asset.publicId);
    if (!userId) continue;
    if (!cloudByUser.has(userId)) cloudByUser.set(userId, []);
    cloudByUser.get(userId).push(asset);
  }

  const linkedCounts = await collectLinkedUserIds(db);
  const snapshots = await collectUsernameSnapshots(db, corruptedIds);

  const reportRows = [];
  for (const user of corruptedUsers) {
    const userId = String(user._id);
    const assets = cloudByUser.get(userId) || [];
    const latestProfileAsset = assets
      .filter((a) => a.publicId.includes('/profiles/profile-'))
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))[0] || null;

    const snapshot = snapshots.get(userId) || null;
    const changedFields = changedFieldList(user);

    reportRows.push({
      userId,
      changedFields,
      changedFieldCount: changedFields.length,
      hasCloudinaryAssets: assets.length > 0,
      cloudinaryAssetCount: assets.length,
      latestProfileImage: latestProfileAsset?.secureUrl || null,
      linkedDocumentCount: linkedCounts.get(userId) || 0,
      snapshotUsername: snapshot?.username || null,
      snapshotSource: snapshot?.source || null,
      createdAtValid: isValidDate(user.created_at),
      actionPlan: (!assets.length && !(linkedCounts.get(userId) || 0)) ? 'delete_orphan' : 'restart'
    });
  }

  const totals = {
    corruptedUsers: reportRows.length,
    cloudinaryMatchedUsers: reportRows.filter((r) => r.hasCloudinaryAssets).length,
    usersWithUsernameSnapshot: reportRows.filter((r) => !!r.snapshotUsername).length,
    deleteOrphanCandidates: reportRows.filter((r) => r.actionPlan === 'delete_orphan').length,
    restartCandidates: reportRows.filter((r) => r.actionPlan === 'restart').length,
    cloudinaryEnabled: cloud.enabled,
    totalCloudinaryAssetsScanned: cloud.assets.length
  };

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const artifactsDir = path.resolve(__dirname, '..', 'recovery-artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });

  const reportPath = path.join(artifactsDir, `cloudinary-user-match-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ generated_at: new Date().toISOString(), totals, users: reportRows }, null, 2), 'utf8');

  console.log('=== CLOUDINARY USER MATCH REPORT ===');
  console.log(`cloudinaryEnabled: ${totals.cloudinaryEnabled}`);
  console.log(`totalCloudinaryAssetsScanned: ${totals.totalCloudinaryAssetsScanned}`);
  console.log(`corruptedUsers: ${totals.corruptedUsers}`);
  console.log(`cloudinaryMatchedUsers: ${totals.cloudinaryMatchedUsers}`);
  console.log(`usersWithUsernameSnapshot: ${totals.usersWithUsernameSnapshot}`);
  console.log(`restartCandidates: ${totals.restartCandidates}`);
  console.log(`deleteOrphanCandidates: ${totals.deleteOrphanCandidates}`);
  console.log(`reportFile: ${reportPath}`);

  if (!applyMode) {
    console.log('Dry run only. No data was modified.');
    console.log('Run with --apply to execute restart/delete actions.');
    return;
  }

  let deleted = 0;
  let restarted = 0;
  const deletedIds = [];
  const restartedIds = [];

  for (const row of reportRows) {
    const userId = row.userId;

    if (row.actionPlan === 'delete_orphan') {
      const result = await users.deleteOne({ _id: new mongoose.Types.ObjectId(userId) });
      if (result.deletedCount === 1) {
        deleted += 1;
        deletedIds.push(userId);
      }
      continue;
    }

    const safeNameBase = sanitizeUsername(row.snapshotUsername) || 'recovered_user';
    const safeUsername = `${safeNameBase}_${userId.slice(-6)}`.slice(0, 30);
    const safeEmail = `recovery+${userId}@zerohook.invalid`;
    const lockedPasswordHash = await bcrypt.hash(`RECOVERY_LOCK_${userId}_${crypto.randomBytes(6).toString('hex')}`, 10);

    const profileData = {
      recovery: {
        restoredBy: 'incident-cloudinary-remediate-users',
        restoredAt: new Date().toISOString(),
        cloudinaryAssetCount: row.cloudinaryAssetCount,
        snapshotSource: row.snapshotSource || null
      }
    };

    if (row.latestProfileImage) {
      profileData.profilePicture = row.latestProfileImage;
      profileData.photos = [row.latestProfileImage];
      profileData.profile_picture = {
        url: row.latestProfileImage,
        storageType: 'cloudinary',
        recovered: true
      };
    }

    const now = new Date();
    const update = {
      username: safeUsername,
      email: safeEmail,
      password_hash: lockedPasswordHash,
      phone: null,
      verification_tier: 1,
      reputation_score: 100,
      trust_score: 0,
      role: 'user',
      is_admin: false,
      is_banned: false,
      status: 'recovery_pending',
      is_subscribed: false,
      subscription_tier: 'free',
      subscription_expires_at: null,
      profile_data: profileData,
      recovery_required: true,
      recovery_reason: 'fernet_user_field_corruption',
      recovery_marked_at: now,
      updated_at: now,
      last_active: now
    };

    if (!row.createdAtValid) {
      update.created_at = now;
    }

    const result = await users.updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: update }
    );

    if (result.modifiedCount === 1 || result.matchedCount === 1) {
      restarted += 1;
      restartedIds.push(userId);
    }
  }

  const applyManifest = {
    generated_at: new Date().toISOString(),
    report_file: reportPath,
    deleted_count: deleted,
    restarted_count: restarted,
    deleted_ids: deletedIds,
    restarted_ids: restartedIds
  };

  const applyPath = path.join(artifactsDir, `cloudinary-remediation-apply-${timestamp}.json`);
  fs.writeFileSync(applyPath, JSON.stringify(applyManifest, null, 2), 'utf8');

  console.log('Apply complete.');
  console.log(`deletedCount: ${deleted}`);
  console.log(`restartedCount: ${restarted}`);
  console.log(`applyManifest: ${applyPath}`);
}

run()
  .catch((error) => {
    console.error('Cloudinary remediation failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
