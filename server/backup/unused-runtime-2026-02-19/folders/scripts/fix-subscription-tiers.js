/**
 * Backfill Script: Fix subscription_tier for users who have is_subscribed=true but tier='free'
 * 
 * This script:
 * 1. Finds users with is_subscribed=true but subscription_tier='free' or null
 * 2. Updates their subscription_tier to 'premium'
 * 3. Sets subscription_expires_at if missing
 * 
 * Run: node server/scripts/fix-subscription-tiers.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function fixSubscriptionTiers() {
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
      is_subscribed: Boolean,
      isSubscribed: Boolean,
      subscription_tier: String,
      subscriptionTier: String,
      subscription_expires_at: Date,
      subscriptionExpiresAt: Date,
    }, { strict: false }));

    // Find users with subscription issues
    const usersWithIssues = await User.find({ 
      $or: [
        { is_subscribed: true },
        { isSubscribed: true }
      ],
      $and: [
        {
          $or: [
            { subscription_tier: { $in: ['free', null, ''] } },
            { subscription_tier: { $exists: false } },
            { subscriptionTier: { $in: ['free', null, ''] } },
            { subscriptionTier: { $exists: false } }
          ]
        }
      ]
    }).lean();

    console.log(`\n📊 Found ${usersWithIssues.length} users with subscription tier issues\n`);

    let updated = 0;
    let errors = 0;

    // Calculate expiration date (1 year from now)
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    for (const user of usersWithIssues) {
      try {
        await User.updateOne(
          { _id: user._id },
          { 
            $set: { 
              subscription_tier: 'premium',
              subscriptionTier: 'premium',
              subscription_expires_at: user.subscription_expires_at || user.subscriptionExpiresAt || expiresAt,
              subscriptionExpiresAt: user.subscription_expires_at || user.subscriptionExpiresAt || expiresAt
            }
          }
        );
        console.log(`✅ Fixed ${user.username || user.email}: tier='premium', expires=${expiresAt.toISOString()}`);
        updated++;
      } catch (err) {
        console.error(`❌ Error updating ${user.username || user.email}:`, err.message);
        errors++;
      }
    }

    // Also find users with active subscriptions but is_subscribed=false
    const activeSubUsers = await User.find({
      $or: [
        { subscription_tier: 'premium' },
        { subscriptionTier: 'premium' },
        { subscription_tier: 'elite' },
        { subscriptionTier: 'elite' }
      ],
      $and: [
        {
          $or: [
            { is_subscribed: { $ne: true } },
            { is_subscribed: { $exists: false } }
          ]
        }
      ]
    }).lean();

    console.log(`\n📊 Found ${activeSubUsers.length} users with premium tier but is_subscribed=false\n`);

    for (const user of activeSubUsers) {
      try {
        await User.updateOne(
          { _id: user._id },
          { 
            $set: { 
              is_subscribed: true,
              isSubscribed: true
            }
          }
        );
        console.log(`✅ Fixed ${user.username || user.email}: is_subscribed=true`);
        updated++;
      } catch (err) {
        console.error(`❌ Error updating ${user.username || user.email}:`, err.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 FIX SUBSCRIPTION TIERS SUMMARY');
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
fixSubscriptionTiers();
