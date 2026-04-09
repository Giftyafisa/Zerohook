/*
 * Build complete test-user profiles from recovered users.
 *
 * Behavior:
 * - Targets users marked as recovery candidates
 * - Maps Cloudinary assets to users via public_id id pattern
 * - Rebuilds valid profile_data and core fields for test use
 * - Activates users and clears recovery flags
 *
 * Usage:
 *   Dry run: node scripts/incident-build-test-profiles-from-cloudinary.js
 *   Apply:   node scripts/incident-build-test-profiles-from-cloudinary.js --apply
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cloudinary = require('cloudinary').v2;

function ensureEnv() {
  try {
    require('dotenv').config({ path: path.resolve(__dirname, '..', 'env.local') });
  } catch (_) {
    // Non-fatal.
  }
}

function hashNumber(idHex) {
  const h = crypto.createHash('sha256').update(idHex).digest('hex').slice(0, 12);
  return parseInt(h, 16);
}

function pick(arr, seed) {
  if (!arr.length) return null;
  return arr[seed % arr.length];
}

function sanitizeUsername(raw) {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
}

function extractUserIdFromPublicId(publicId) {
  if (typeof publicId !== 'string') return null;
  const match = publicId.match(/(?:profile|content|post|verify)-([a-f0-9]{24})-/i);
  return match ? match[1].toLowerCase() : null;
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
    let nextCursor;
    do {
      const res = await cloudinary.api.resources({
        type: 'upload',
        resource_type: resourceType,
        prefix: 'zerohook/',
        max_results: 500,
        next_cursor: nextCursor
      });

      for (const r of res.resources || []) {
        assets.push({
          resourceType,
          publicId: r.public_id,
          secureUrl: r.secure_url,
          createdAt: r.created_at ? new Date(r.created_at) : null
        });
      }

      nextCursor = res.next_cursor;
    } while (nextCursor);
  }

  return { enabled: true, assets };
}

function buildProfile(userId, imageUrls) {
  const firstNames = [
    'Akua', 'Adwoa', 'Ama', 'Afia', 'Abena', 'Araba', 'Efua', 'Esi', 'Maame', 'Adjoa',
    'Kofi', 'Kwame', 'Kwesi', 'Kojo', 'Yaw', 'Kwaku', 'Nana', 'Kweku', 'Ekow', 'Yawson'
  ];

  const lastNames = [
    'Mensah', 'Owusu', 'Asante', 'Boateng', 'Agyeman', 'Frimpong', 'Appiah', 'Darko', 'Badu', 'Amoah'
  ];

  const locations = [
    { city: 'Accra', lat: 5.6037, lng: -0.1870 },
    { city: 'Kumasi', lat: 6.6885, lng: -1.6244 },
    { city: 'Takoradi', lat: 4.8982, lng: -1.7603 },
    { city: 'Tamale', lat: 9.4075, lng: -0.8533 },
    { city: 'Cape Coast', lat: 5.1053, lng: -1.2466 },
    { city: 'Tema', lat: 5.6698, lng: -0.0166 }
  ];

  const idHex = userId.toLowerCase();
  const seed = hashNumber(idHex);

  const firstName = pick(firstNames, seed);
  const lastName = pick(lastNames, Math.floor(seed / 7));
  const gender = seed % 2 === 0 ? 'female' : 'male';
  const accountType = seed % 2 === 0 ? 'provider' : 'client';
  const age = 21 + (seed % 15);
  const year = new Date().getUTCFullYear() - age;
  const month = String((seed % 12) + 1).padStart(2, '0');
  const day = String((seed % 28) + 1).padStart(2, '0');
  const dateOfBirth = `${year}-${month}-${day}`;

  const loc = pick(locations, Math.floor(seed / 13));
  const profileImage = imageUrls[0] || null;

  return {
    username: sanitizeUsername(`${firstName}_${lastName}_${idHex.slice(-5)}`),
    email: `${sanitizeUsername(`${firstName}_${lastName}_${idHex.slice(-5)}`)}@zerohook.test`,
    phone: `+233${String(seed % 1000000000).padStart(9, '0')}`,
    verification_tier: 1 + (seed % 2),
    reputation_score: 90 + (seed % 21),
    trust_score: 40 + (seed % 31),
    profile_data: {
      firstName,
      lastName,
      accountType,
      gender,
      dateOfBirth,
      country: 'Ghana',
      countryCode: 'GH',
      currency: 'GHS',
      bio: `Test ${accountType} profile generated from incident recovery data.`,
      languages: ['English'],
      basePrice: accountType === 'provider' ? 120 + (seed % 80) : 0,
      location: {
        country: 'Ghana',
        countryCode: 'GH',
        city: loc.city,
        accuracy: 'seeded',
        coordinates: {
          lat: loc.lat,
          lng: loc.lng
        },
        geoPoint: {
          type: 'Point',
          coordinates: [loc.lng, loc.lat]
        },
        lastUpdated: new Date().toISOString()
      },
      profilePicture: profileImage,
      profile_picture: profileImage
        ? {
            url: profileImage,
            storageType: 'cloudinary',
            recovered: true,
            source: 'cloudinary_public_id_user_match'
          }
        : null,
      photos: imageUrls.slice(0, 6),
      faceVerification: {
        verified: false,
        verifiedAt: null,
        verificationMethod: null,
        consentGiven: true,
        consentGivenAt: new Date().toISOString()
      }
    }
  };
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

  const targetUsers = await users.find({
    $or: [
      { status: 'recovery_pending' },
      { recovery_required: true }
    ]
  }).toArray();

  const cloud = await listCloudinaryAssets();

  const assetsByUser = new Map();
  for (const asset of cloud.assets) {
    const userId = extractUserIdFromPublicId(asset.publicId);
    if (!userId) continue;
    if (!assetsByUser.has(userId)) assetsByUser.set(userId, []);
    assetsByUser.get(userId).push(asset);
  }

  const rows = [];
  for (const user of targetUsers) {
    const userId = String(user._id).toLowerCase();
    const matchedAssets = (assetsByUser.get(userId) || [])
      .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));

    const profileAssets = matchedAssets.filter((a) => a.publicId.includes('/profiles/profile-'));
    const ordered = [...profileAssets, ...matchedAssets.filter((a) => !profileAssets.includes(a))];
    const uniqueUrls = [...new Set(ordered.map((a) => a.secureUrl).filter(Boolean))];

    const rebuilt = buildProfile(userId, uniqueUrls);

    rows.push({
      userId,
      matchedAssetCount: matchedAssets.length,
      profileImageUrl: rebuilt.profile_data.profilePicture,
      username: rebuilt.username,
      email: rebuilt.email,
      rebuilt
    });
  }

  const summary = {
    generated_at: new Date().toISOString(),
    cloudinaryEnabled: cloud.enabled,
    totalCloudinaryAssetsScanned: cloud.assets.length,
    targetUsers: rows.length,
    usersWithMatchedAssets: rows.filter((r) => r.matchedAssetCount > 0).length,
    usersWithoutMatchedAssets: rows.filter((r) => r.matchedAssetCount === 0).length
  };

  const artifactsDir = path.resolve(__dirname, '..', 'recovery-artifacts');
  fs.mkdirSync(artifactsDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const previewPath = path.join(artifactsDir, `test-profile-rebuild-preview-${ts}.json`);
  fs.writeFileSync(previewPath, JSON.stringify({ summary, users: rows.map((r) => ({
    userId: r.userId,
    matchedAssetCount: r.matchedAssetCount,
    profileImageUrl: r.profileImageUrl,
    username: r.username,
    email: r.email
  })) }, null, 2), 'utf8');

  console.log('=== TEST PROFILE REBUILD ===');
  console.log(`cloudinaryEnabled: ${summary.cloudinaryEnabled}`);
  console.log(`totalCloudinaryAssetsScanned: ${summary.totalCloudinaryAssetsScanned}`);
  console.log(`targetUsers: ${summary.targetUsers}`);
  console.log(`usersWithMatchedAssets: ${summary.usersWithMatchedAssets}`);
  console.log(`usersWithoutMatchedAssets: ${summary.usersWithoutMatchedAssets}`);
  console.log(`previewFile: ${previewPath}`);

  if (!applyMode) {
    console.log('Dry run only. No data was modified.');
    console.log('Run with --apply to rebuild and activate recovered users.');
    return;
  }

  const testPassword = process.env.TEST_USERS_PASSWORD || 'TestUser@123';
  const passwordHash = await bcrypt.hash(testPassword, 10);
  const now = new Date();

  let updated = 0;
  for (const row of rows) {
    const update = {
      username: row.rebuilt.username,
      email: row.rebuilt.email,
      phone: row.rebuilt.phone,
      password_hash: passwordHash,
      verification_tier: row.rebuilt.verification_tier,
      reputation_score: row.rebuilt.reputation_score,
      trust_score: row.rebuilt.trust_score,
      profile_data: row.rebuilt.profile_data,
      role: 'user',
      is_admin: false,
      is_banned: false,
      status: 'active',
      is_subscribed: false,
      subscription_tier: 'free',
      subscription_expires_at: null,
      recovery_required: false,
      recovery_reason: null,
      recovery_marked_at: null,
      updated_at: now,
      last_active: now
    };

    const result = await users.updateOne(
      { _id: new mongoose.Types.ObjectId(row.userId) },
      { $set: update }
    );

    if (result.matchedCount === 1) updated += 1;
  }

  const applyManifestPath = path.join(artifactsDir, `test-profile-rebuild-apply-${ts}.json`);
  fs.writeFileSync(applyManifestPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    updated_users: updated,
    target_users: rows.length,
    users_with_matched_assets: summary.usersWithMatchedAssets,
    users_without_matched_assets: summary.usersWithoutMatchedAssets,
    default_test_password: testPassword,
    note: 'All targeted recovery users were converted to active test users with normalized profile_data.'
  }, null, 2), 'utf8');

  console.log('Apply complete.');
  console.log(`updatedUsers: ${updated}`);
  console.log(`applyManifest: ${applyManifestPath}`);
}

run()
  .catch((error) => {
    console.error('Test profile rebuild failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
