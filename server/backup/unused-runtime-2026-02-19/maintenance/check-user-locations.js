/**
 * Check User Location Data Quality
 * 
 * This script scans all users in the database and identifies:
 * - Users with missing location data
 * - Users with city/country but no coordinates
 * - Users with invalid coordinates (out of range, non-numeric)
 * - Summary statistics
 */

const { query } = require('./config/database');

async function checkUserLocations() {
  try {
    console.log('🔍 Checking user location data quality...\n');

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

    console.log(`📊 Total users in database: ${result.rows.length}\n`);

    let stats = {
      total: result.rows.length,
      hasLocation: 0,
      hasCoordinates: 0,
      hasValidCoordinates: 0,
      missingLocation: 0,
      missingCoordinates: 0,
      invalidCoordinates: 0,
      needsFix: []
    };

    for (const user of result.rows) {
      const profileData = user.profile_data || {};
      const location = profileData.location || {};

      // Check location presence
      if (!location.city && !location.country) {
        stats.missingLocation++;
        stats.needsFix.push({
          id: user.id,
          username: user.username,
          issue: 'NO_LOCATION_DATA',
          city: null,
          country: null,
          coordinates: null
        });
        continue;
      }

      stats.hasLocation++;

      // Check coordinates presence
      const coords = location.coordinates || {};
      const lat = coords.lat;
      const lng = coords.lng;

      if (lat == null || lng == null) {
        stats.missingCoordinates++;
        stats.needsFix.push({
          id: user.id,
          username: user.username,
          issue: 'MISSING_COORDINATES',
          city: location.city,
          country: location.country,
          coordinates: null
        });
        continue;
      }

      stats.hasCoordinates++;

      // Validate coordinates
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);

      if (
        isNaN(parsedLat) || 
        isNaN(parsedLng) ||
        parsedLat < -90 || 
        parsedLat > 90 ||
        parsedLng < -180 || 
        parsedLng > 180
      ) {
        stats.invalidCoordinates++;
        stats.needsFix.push({
          id: user.id,
          username: user.username,
          issue: 'INVALID_COORDINATES',
          city: location.city,
          country: location.country,
          coordinates: { lat, lng }
        });
        continue;
      }

      stats.hasValidCoordinates++;
    }

    // Print summary
    console.log('📈 SUMMARY STATISTICS:');
    console.log('='.repeat(60));
    console.log(`Total users:                     ${stats.total}`);
    console.log(`Users with location data:        ${stats.hasLocation} (${((stats.hasLocation/stats.total)*100).toFixed(1)}%)`);
    console.log(`Users with coordinates:          ${stats.hasCoordinates} (${((stats.hasCoordinates/stats.total)*100).toFixed(1)}%)`);
    console.log(`Users with valid coordinates:    ${stats.hasValidCoordinates} (${((stats.hasValidCoordinates/stats.total)*100).toFixed(1)}%)`);
    console.log('');
    console.log('❌ ISSUES FOUND:');
    console.log(`Missing location data:           ${stats.missingLocation}`);
    console.log(`Missing coordinates:             ${stats.missingCoordinates}`);
    console.log(`Invalid coordinates:             ${stats.invalidCoordinates}`);
    console.log(`TOTAL NEEDING FIX:               ${stats.needsFix.length}`);
    console.log('='.repeat(60));
    console.log('');

    // Show detailed issues
    if (stats.needsFix.length > 0) {
      console.log('🔧 USERS NEEDING FIXES:');
      console.log('');
      
      stats.needsFix.forEach((user, index) => {
        console.log(`${index + 1}. User: ${user.username} (${user.id})`);
        console.log(`   Issue: ${user.issue}`);
        console.log(`   City: ${user.city || 'N/A'}`);
        console.log(`   Country: ${user.country || 'N/A'}`);
        console.log(`   Coordinates: ${user.coordinates ? `${user.coordinates.lat}, ${user.coordinates.lng}` : 'N/A'}`);
        console.log('');
      });
    }

    return stats;

  } catch (error) {
    console.error('❌ Error checking user locations:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  checkUserLocations()
    .then((stats) => {
      console.log('✅ Check complete');
      process.exit(stats.needsFix.length > 0 ? 1 : 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { checkUserLocations };
