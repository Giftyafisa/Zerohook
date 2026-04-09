/*
 * Incident audit (read-only):
 * - Summarizes user integrity and suspicious mutation patterns
 * - Checks orphaned references to users in key collections
 *
 * Usage (PowerShell):
 *   $env:MONGODB_URI = "..."; node scripts/incident-db-audit.js
 */

const mongoose = require('mongoose');

function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return '(missing)';
  }

  const [name, domain] = email.split('@');
  const maskedName = name.length <= 2
    ? `${name[0] || '*'}*`
    : `${name.slice(0, 2)}***`;
  return `${maskedName}@${domain}`;
}

async function countOrphans({ db, sourceCollection, localField, userCollection = 'users' }) {
  const pipeline = [
    {
      $match: {
        [localField]: { $type: 'objectId' }
      }
    },
    {
      $lookup: {
        from: userCollection,
        localField,
        foreignField: '_id',
        as: 'userRef'
      }
    },
    {
      $match: {
        userRef: { $size: 0 }
      }
    },
    {
      $count: 'orphanCount'
    }
  ];

  const result = await db.collection(sourceCollection).aggregate(pipeline, { allowDiskUse: true }).toArray();
  return result[0]?.orphanCount || 0;
}

async function run() {
  const uri = process.env.MONGODB_URI;
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

  console.log('=== INCIDENT DB AUDIT (READ-ONLY) ===');
  console.log(`Database: ${db.databaseName}`);

  const keyCollections = [
    'users',
    'services',
    'transactions',
    'conversations',
    'messages',
    'subscriptions',
    'reviews',
    'notifications'
  ];

  console.log('\n[Collection Counts]');
  for (const name of keyCollections) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (!exists) {
      console.log(`- ${name}: (missing collection)`);
      continue;
    }
    const count = await db.collection(name).countDocuments();
    console.log(`- ${name}: ${count}`);
  }

  console.log('\n[User Integrity]');
  const [
    totalUsers,
    missingEmail,
    missingUsername,
    missingPasswordHash,
    adminFlagged,
    bannedUsers,
    activeUsers,
    updated24h
  ] = await Promise.all([
    users.countDocuments(),
    users.countDocuments({
      $or: [
        { email: { $exists: false } },
        { email: null },
        { email: '' }
      ]
    }),
    users.countDocuments({
      $or: [
        { username: { $exists: false } },
        { username: null },
        { username: '' }
      ]
    }),
    users.countDocuments({
      $or: [
        { password_hash: { $exists: false } },
        { password_hash: null },
        { password_hash: '' }
      ]
    }),
    users.countDocuments({
      $or: [
        { is_admin: true },
        { role: 'admin' }
      ]
    }),
    users.countDocuments({ is_banned: true }),
    users.countDocuments({ status: 'active' }),
    users.countDocuments({
      updated_at: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    })
  ]);

  console.log(`- totalUsers: ${totalUsers}`);
  console.log(`- activeUsers(status=active): ${activeUsers}`);
  console.log(`- bannedUsers: ${bannedUsers}`);
  console.log(`- adminFlagged(is_admin/role=admin): ${adminFlagged}`);
  console.log(`- missingEmail: ${missingEmail}`);
  console.log(`- missingUsername: ${missingUsername}`);
  console.log(`- missingPasswordHash: ${missingPasswordHash}`);
  console.log(`- updatedLast24h: ${updated24h}`);

  const duplicateEmails = await users.aggregate([
    {
      $match: {
        email: { $type: 'string', $ne: '' }
      }
    },
    {
      $group: {
        _id: { $toLower: '$email' },
        count: { $sum: 1 },
        ids: { $push: '$_id' }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 10
    }
  ]).toArray();

  const duplicateUsernames = await users.aggregate([
    {
      $match: {
        username: { $type: 'string', $ne: '' }
      }
    },
    {
      $group: {
        _id: { $toLower: '$username' },
        count: { $sum: 1 },
        ids: { $push: '$_id' }
      }
    },
    {
      $match: { count: { $gt: 1 } }
    },
    {
      $sort: { count: -1 }
    },
    {
      $limit: 10
    }
  ]).toArray();

  console.log(`- duplicateEmails(groups): ${duplicateEmails.length}`);
  console.log(`- duplicateUsernames(groups): ${duplicateUsernames.length}`);

  if (duplicateEmails.length > 0) {
    console.log('  duplicate email samples:');
    for (const dup of duplicateEmails) {
      console.log(`  * ${maskEmail(dup._id)} x${dup.count}`);
    }
  }

  if (duplicateUsernames.length > 0) {
    console.log('  duplicate username samples:');
    for (const dup of duplicateUsernames) {
      console.log(`  * ${dup._id} x${dup.count}`);
    }
  }

  const statusBreakdown = await users.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    },
    {
      $sort: { count: -1 }
    }
  ]).toArray();

  console.log('\n[User Status Breakdown]');
  for (const row of statusBreakdown) {
    console.log(`- ${row._id || '(null)'}: ${row.count}`);
  }

  const recentUsers = await users.find(
    {},
    {
      projection: {
        username: 1,
        email: 1,
        is_admin: 1,
        role: 1,
        status: 1,
        created_at: 1,
        updated_at: 1
      }
    }
  )
    .sort({ updated_at: -1 })
    .limit(25)
    .toArray();

  console.log('\n[Recently Updated Users - top 25]');
  for (const u of recentUsers) {
    console.log(`- ${u._id} | ${u.username || '(missing)'} | ${maskEmail(u.email)} | role=${u.role || 'user'} | is_admin=${!!u.is_admin} | status=${u.status || '(null)'} | updated=${u.updated_at || '(none)'}`);
  }

  console.log('\n[Orphaned User References]');
  const orphanChecks = [
    { sourceCollection: 'services', localField: 'provider_id' },
    { sourceCollection: 'transactions', localField: 'client_id' },
    { sourceCollection: 'transactions', localField: 'provider_id' },
    { sourceCollection: 'transactions', localField: 'user_id' },
    { sourceCollection: 'messages', localField: 'senderId' },
    { sourceCollection: 'conversations', localField: 'participant1Id' },
    { sourceCollection: 'conversations', localField: 'participant2Id' },
    { sourceCollection: 'subscriptions', localField: 'user_id' }
  ];

  for (const check of orphanChecks) {
    const exists = await db.listCollections({ name: check.sourceCollection }, { nameOnly: true }).hasNext();
    if (!exists) {
      console.log(`- ${check.sourceCollection}.${check.localField}: (collection missing)`);
      continue;
    }
    const orphanCount = await countOrphans({
      db,
      sourceCollection: check.sourceCollection,
      localField: check.localField
    });
    console.log(`- ${check.sourceCollection}.${check.localField}: ${orphanCount}`);
  }

  console.log('\nAudit complete. No data was modified.');
}

run()
  .catch((error) => {
    console.error('Incident audit failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
