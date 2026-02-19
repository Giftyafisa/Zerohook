/**
 * Fix User Location Data
 * 
 * This script:
 * 1. Finds users with city/country but no coordinates
 * 2. Uses LocationTrackingService to resolve coordinates
 * 3. Updates the database with correct coordinates
 * 4. Reports users with no location data at all
 */

const { query } = require('./config/database');
const LocationTrackingService = require('./services/LocationTrackingService');

async function fixUserLocations() {
  try {
    console.log('🔧 Starting user location fix...\n');

    const locationService = new LocationTrackingService();
    await locationService.initialize();

    // Get all users with profile data
    const result = await query(`
      SELECT 
        id,
        username,
        profile_data
      FROM users
      WHERE profile_data IS NOT NULL
      ORDER BY created_at DESC
    `);

    console.log(`📊 Scanning ${result.rows.length} users...\n`);

    let stats = {
      scanned: result.rows.length,
      alreadyValid: 0,
      fixed: 0,
      noLocationData: 0,
      couldNotResolve: 0,
      errors: []
    };

    for (const user of result.rows) {
      const profileData = user.profile_data || {};
      const location = profileData.location || {};

      // Skip users with no location data
      if (!location.city && !location.country) {
        stats.noLocationData++;
        console.log(`⚠️  ${user.username}: No location data - needs manual entry`);
        continue;
      }

      // Check if coordinates already exist and are valid
      const coords = location.coordinates || {};
      const lat = parseFloat(coords.lat);
      const lng = parseFloat(coords.lng);

      if (
        !isNaN(lat) && 
        !isNaN(lng) &&
        lat >= -90 && 
        lat <= 90 &&
        lng >= -180 && 
        lng <= 180
      ) {
        stats.alreadyValid++;
        continue; // Already has valid coordinates
      }

      // Try to resolve coordinates
      console.log(`🔍 ${user.username}: Resolving "${location.city}, ${location.country}"...`);

      try {
        const resolved = await locationService.getCityCoordinates(
          location.city,
          location.country
        );

        if (resolved && resolved.lat && resolved.lng) {
          // Update profile_data with resolved coordinates
          const updatedLocation = {
            ...location,
            coordinates: {
              lat: resolved.lat,
              lng: resolved.lng
            },
            countryCode: resolved.countryCode || location.countryCode,
            region: resolved.region || location.region
          };

          const updatedProfileData = {
            ...profileData,
            location: updatedLocation
          };

          await query(`
            UPDATE users
            SET profile_data = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [JSON.stringify(updatedProfileData), user.id]);

          stats.fixed++;
          console.log(`✅ ${user.username}: Fixed! Coordinates: ${resolved.lat}, ${resolved.lng}`);
        } else {
          stats.couldNotResolve++;
          console.log(`❌ ${user.username}: Could not resolve coordinates for "${location.city}, ${location.country}"`);
        }
      } catch (error) {
        stats.errors.push({
          username: user.username,
          error: error.message
        });
        console.log(`❌ ${user.username}: Error - ${error.message}`);
      }

      // Small delay to avoid rate limiting external APIs
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 FIX SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Total users scanned:           ${stats.scanned}`);
    console.log(`Already valid:                 ${stats.alreadyValid}`);
    console.log(`✅ Successfully fixed:         ${stats.fixed}`);
    console.log(`⚠️  No location data:          ${stats.noLocationData}`);
    console.log(`❌ Could not resolve:          ${stats.couldNotResolve}`);
    console.log(`❌ Errors:                     ${stats.errors.length}`);
    console.log('='.repeat(60));

    if (stats.noLocationData > 0) {
      console.log('\n⚠️  USERS WITH NO LOCATION DATA (need manual entry):');
      console.log('These users need to update their profile with city/country information.');
    }

    if (stats.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      stats.errors.forEach(e => {
        console.log(`   ${e.username}: ${e.error}`);
      });
    }

    return stats;

  } catch (error) {
    console.error('❌ Fatal error fixing user locations:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  fixUserLocations()
    .then((stats) => {
      console.log('\n✅ Fix complete!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { fixUserLocations };
