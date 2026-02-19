/**
 * Backfill Script: Update existing users with country/currency based on phone number
 * 
 * This script:
 * 1. Finds users with phone numbers but no country/currency in profile_data
 * 2. Detects country from phone number country code
 * 3. Updates their profile_data with country and currency info
 * 
 * Run: node server/scripts/backfill-user-country-currency.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

// Phone code to country mapping
const phoneCodeMap = {
  '+234': { code: 'NG', currency: 'NGN', name: 'Nigeria' },
  '+233': { code: 'GH', currency: 'GHS', name: 'Ghana' },
  '+254': { code: 'KE', currency: 'KES', name: 'Kenya' },
  '+27': { code: 'ZA', currency: 'ZAR', name: 'South Africa' },
  '+256': { code: 'UG', currency: 'UGX', name: 'Uganda' },
  '+255': { code: 'TZ', currency: 'TZS', name: 'Tanzania' },
  '+250': { code: 'RW', currency: 'RWF', name: 'Rwanda' },
  '+267': { code: 'BW', currency: 'BWP', name: 'Botswana' },
  '+260': { code: 'ZM', currency: 'ZMW', name: 'Zambia' },
  '+265': { code: 'MW', currency: 'MWK', name: 'Malawi' },
};

function detectCountryFromPhone(phone) {
  if (!phone) return null;
  const cleanPhone = phone.replace(/\s+/g, '').replace(/-/g, '');
  
  for (const [code, countryInfo] of Object.entries(phoneCodeMap)) {
    if (cleanPhone.startsWith(code)) {
      return countryInfo;
    }
  }
  return null;
}

async function backfillUserCountryCurrency() {
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
      phone: String,
      profile_data: mongoose.Schema.Types.Mixed,
      profileData: mongoose.Schema.Types.Mixed,
    }, { strict: false }));

    // Find all users with phone numbers
    const users = await User.find({ 
      phone: { $exists: true, $ne: null, $ne: '' }
    }).lean();

    console.log(`\n📊 Found ${users.length} users with phone numbers\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      const profileData = user.profile_data || user.profileData || {};
      
      // Check if user already has country/currency
      if (profileData.country && profileData.currency) {
        console.log(`⏭️  Skipping ${user.username || user.email} - already has country/currency`);
        skipped++;
        continue;
      }

      // Detect country from phone
      const countryInfo = detectCountryFromPhone(user.phone);
      
      if (!countryInfo) {
        console.log(`⚠️  Could not detect country for ${user.username || user.email} (phone: ${user.phone})`);
        skipped++;
        continue;
      }

      // Update profile_data with country and currency
      const updatedProfileData = {
        ...profileData,
        country: countryInfo.name,
        countryCode: countryInfo.code,
        currency: countryInfo.currency,
        location: {
          ...(profileData.location || {}),
          country: countryInfo.name,
          countryCode: countryInfo.code
        }
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
        console.log(`✅ Updated ${user.username || user.email}: ${countryInfo.name} (${countryInfo.currency})`);
        updated++;
      } catch (err) {
        console.error(`❌ Error updating ${user.username || user.email}:`, err.message);
        errors++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 BACKFILL SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📝 Total: ${users.length}`);
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('❌ Script failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
backfillUserCountryCurrency();
