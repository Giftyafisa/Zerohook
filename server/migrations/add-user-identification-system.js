const mongoose = require('mongoose');
const { connectDB, User, SugarAccessPayment } = require('../config/database');

async function runMigration(dryRun = false) {
  console.log('🚀 Starting User Identification System Migration...');
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);

  try {
    await connectDB();

    // ========================================
    // 1. Ensure SugarAccessPayment indexes
    // ========================================
    console.log('\n📋 Step 1: Ensuring SugarAccessPayment indexes...');
    if (!dryRun) {
      await SugarAccessPayment.createIndexes();
      const sugarIndexes = await SugarAccessPayment.collection.indexes();
      console.log(`   ✅ SugarAccessPayment indexes ready (${sugarIndexes.length} indexes)`);
    } else {
      console.log('   [DRY RUN] Would ensure SugarAccessPayment indexes');
    }

    // ========================================
    // 3. Add profile_data field documentation
    // ========================================
    console.log('\n📋 Step 3: Profile data structure documentation...');
    console.log(`
   New profile_data fields:
   - accountType: 'client' | 'provider' | 'sugar_daddy' | 'sugar_mommy'
   - gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say'
   - dateOfBirth: 'YYYY-MM-DD' (ISO format)
   - faceVerification: {
       verified: boolean,
       verifiedAt: timestamp | null,
       verificationMethod: 'selfie' | 'video' | 'document' | null
     }
   - sugarSettings: { // Only for sugar_daddy/sugar_mommy
       visibleToProviders: boolean (default: false),
       preferredAgeRange: { min: number, max: number },
       preferredGender: 'male' | 'female' | 'any'
     }
    `);

    // ========================================
    // 2. Backfill existing users
    // ========================================
    console.log('\n📋 Step 2: Backfilling existing users...');
    
    // Get existing users count
    const userCount = await User.countDocuments();
    console.log(`   Found ${userCount} existing users`);

    const accountTypeDistribution = await User.aggregate([
      {
        $group: {
          _id: '$profile_data.accountType',
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n   Current accountType distribution:');
    accountTypeDistribution.forEach(row => {
      console.log(`   - ${row._id || 'null'}: ${row.count}`);
    });

    const usersNeedingBackfill = await User.find({
      $or: [
        { 'profile_data.gender': { $exists: false } },
        { 'profile_data.faceVerification': { $exists: false } }
      ]
    }).select('_id profile_data').lean();

    if (!dryRun) {
      if (usersNeedingBackfill.length > 0) {
        const updates = usersNeedingBackfill.map((user) => {
          const profileData = user.profile_data || {};
          return {
            updateOne: {
              filter: { _id: user._id },
              update: {
                $set: {
                  profile_data: {
                    ...profileData,
                    gender: profileData.gender ?? null,
                    dateOfBirth: profileData.dateOfBirth ?? null,
                    faceVerification: profileData.faceVerification || {
                      verified: false,
                      verifiedAt: null,
                      verificationMethod: null
                    }
                  }
                }
              }
            }
          };
        });
        await User.bulkWrite(updates);
      }
      console.log(`   ✅ Backfilled ${usersNeedingBackfill.length} users with default values`);
    } else {
      console.log(`   [DRY RUN] Would backfill ${usersNeedingBackfill.length} users`);
    }

    // ========================================
    // 3. Set accountType for null users
    // ========================================
    console.log('\n📋 Step 3: Setting accountType for users with null...');

    const usersWithoutAccountType = await User.countDocuments({
      $or: [
        { 'profile_data.accountType': { $exists: false } },
        { 'profile_data.accountType': null },
        { 'profile_data.accountType': '' }
      ]
    });

    if (!dryRun) {
      await User.updateMany(
        {
          $or: [
            { 'profile_data.accountType': { $exists: false } },
            { 'profile_data.accountType': null },
            { 'profile_data.accountType': '' }
          ]
        },
        { $set: { 'profile_data.accountType': 'client' } }
      );
      console.log(`   ✅ Set accountType to 'client' for ${usersWithoutAccountType} users`);
    } else {
      console.log(`   [DRY RUN] Would set accountType for ${usersWithoutAccountType} users`);
    }

    // ========================================
    // 6. Summary
    // ========================================
    console.log('\n✅ Migration completed successfully!');
    
    // Show final distribution
    const finalDistribution = await User.aggregate([
      {
        $group: {
          _id: '$profile_data.accountType',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);
    
    console.log('\n   Final accountType distribution:');
    finalDistribution.forEach(row => {
      console.log(`   - ${row._id || 'null'}: ${row.count}`);
    });

    return { success: true };

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    return { success: false, error: error.message };
  } finally {
    await mongoose.connection.close();
  }
}

// Run with: node migrations/add-user-identification-system.js [--dry-run]
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

runMigration(dryRun).then(result => {
  if (result.success) {
    console.log('\n🎉 Done!');
    process.exit(0);
  } else {
    process.exit(1);
  }
});

module.exports = { runMigration };
