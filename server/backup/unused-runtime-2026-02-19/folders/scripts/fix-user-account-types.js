/**
 * Backfill Script: Set default accountType for users missing it
 * 
 * This script:
 * 1. Finds users without accountType in profile_data
 * 2. Sets default to 'client' (since that's the safest default)
 * 
 * Run: node server/scripts/fix-user-account-types.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function fixUserAccountTypes() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/zerohook';
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Get User model
    const User = mongoose.model('User', new mongoose.Schema({
      username: String,
      email: String,
      profile_data: mongoose.Schema.Types.Mixed,
      profileData: mongoose.Schema.Types.Mixed,
    }, { strict: false }));

    // Find users without accountType
    const usersWithoutType = await User.find({ 
      $and: [
        {
          $or: [
            { 'profile_data.accountType': { $exists: false } },
            { 'profile_data.accountType': null },
            { 'profile_data.accountType': '' },
            { 'profileData.accountType': { $exists: false } },
            { 'profileData.accountType': null },
            { 'profileData.accountType': '' }
          ]
        }
      ]
    }).lean();

    console.log(`\n📊 Found ${usersWithoutType.length} users without accountType\n`);

    let updated = 0;
    let errors = 0;

    for (const user of usersWithoutType) {
      const profileData = user.profile_data || user.profileData || {};
      
      // Skip if already has accountType
      if (profileData.accountType) {
        continue;
      }

      // Default to 'client' - safest default
      const updatedProfileData = {
        ...profileData,
        accountType: 'client'
      };

      try {
        await User.updateOne(
          { _id: user._id },
          { 
            $set: { 
              profile_data: updatedProfileData,
              profileData: updatedProfileData 
            }
          }
        );
        console.log(`✅ Set accountType='client' for ${user.username || user.email}`);
        updated++;
      } catch (err) {
        console.error(`❌ Error updating ${user.username || user.email}:`, err.message);
        errors++;
      }
    }

    // Summary of all account types
    const accountTypeCounts = await User.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$profile_data.accountType', '$profileData.accountType'] },
          count: { $sum: 1 }
        }
      }
    ]);

    console.log('\n' + '='.repeat(50));
    console.log('📊 ACCOUNT TYPE DISTRIBUTION');
    console.log('='.repeat(50));
    accountTypeCounts.forEach(item => {
      console.log(`  ${item._id || 'null/missing'}: ${item.count} users`);
    });

    console.log('\n' + '='.repeat(50));
    console.log('📊 FIX ACCOUNT TYPES SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Updated: ${updated}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
fixUserAccountTypes();
