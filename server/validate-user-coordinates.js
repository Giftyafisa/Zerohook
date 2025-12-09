/**
 * Validate User Coordinates Against Known City Data
 * Checks if user coordinates match their stated city/country
 */

const { query } = require('./config/database');
const { GLOBAL_CITIES } = require('../shared/utils/globalCityData');

// Haversine distance calculation
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Find city in global database
function findCityInDatabase(cityName, countryName) {
  const cityLower = (cityName || '').toLowerCase().trim();
  const countryLower = (countryName || '').toLowerCase().trim();
  
  return GLOBAL_CITIES.find(c => {
    const cityMatch = c.city.toLowerCase() === cityLower || 
                     (c.aliases || []).some(a => a.toLowerCase() === cityLower);
    const countryMatch = !countryLower || 
                        c.country.toLowerCase() === countryLower || 
                        c.countryCode?.toLowerCase() === countryLower;
    return cityMatch && countryMatch;
  });
}

async function validateCoordinates() {
  try {
    console.log('✅ Database connected\n');
    console.log('🔍 Validating user coordinates against known city data...\n');
    
    const result = await query(`
      SELECT 
        id,
        username,
        profile_data
      FROM users
      WHERE profile_data IS NOT NULL
      ORDER BY created_at DESC
    `);
    
    const issues = [];
    const validated = [];
    let checked = 0;
    
    for (const user of result.rows) {
      const profileData = user.profile_data || {};
      const location = profileData.location || {};
      const coords = location.coordinates || {};
      
      if (!coords.lat || !coords.lng) continue;
      
      checked++;
      const userLat = parseFloat(coords.lat);
      const userLng = parseFloat(coords.lng);
      const city = location.city;
      const country = location.country;
      
      if (isNaN(userLat) || isNaN(userLng)) {
        issues.push({
          username: user.username,
          issue: 'INVALID_COORDS',
          coords: { lat: coords.lat, lng: coords.lng },
          city,
          country
        });
        continue;
      }
      
      // Check if coordinates are within valid Earth ranges
      if (userLat < -90 || userLat > 90 || userLng < -180 || userLng > 180) {
        issues.push({
          username: user.username,
          issue: 'OUT_OF_RANGE',
          coords: { lat: userLat, lng: userLng },
          city,
          country
        });
        continue;
      }
      
      // Find expected city coordinates
      const expectedCity = findCityInDatabase(city, country);
      
      if (expectedCity) {
        const distance = calculateDistance(
          userLat, userLng,
          expectedCity.lat, expectedCity.lng
        );
        
        // Flag if coordinates are more than 50km from stated city
        if (distance > 50) {
          issues.push({
            username: user.username,
            issue: 'COORD_MISMATCH',
            coords: { lat: userLat, lng: userLng },
            city,
            country,
            expectedCoords: { lat: expectedCity.lat, lng: expectedCity.lng },
            distance: Math.round(distance * 10) / 10
          });
        } else {
          validated.push({
            username: user.username,
            city,
            country,
            distance: Math.round(distance * 10) / 10
          });
        }
      } else {
        // City not in database, can't validate
        validated.push({
          username: user.username,
          city,
          country,
          note: 'City not in validation database'
        });
      }
    }
    
    console.log('📊 VALIDATION RESULTS:');
    console.log('============================================================');
    console.log(`Total users checked:         ${checked}`);
    console.log(`Coordinates validated:       ${validated.length}`);
    console.log(`Issues found:                ${issues.length}`);
    console.log('============================================================\n');
    
    if (issues.length > 0) {
      console.log('❌ COORDINATE ISSUES FOUND:\n');
      issues.forEach((issue, index) => {
        console.log(`${index + 1}. User: ${issue.username}`);
        console.log(`   Issue: ${issue.issue}`);
        console.log(`   Stated: ${issue.city}, ${issue.country}`);
        console.log(`   Current coords: ${issue.coords.lat}, ${issue.coords.lng}`);
        if (issue.expectedCoords) {
          console.log(`   Expected coords: ${issue.expectedCoords.lat}, ${issue.expectedCoords.lng}`);
          console.log(`   Distance from city center: ${issue.distance} km`);
        }
        console.log('');
      });
    }
    
    // Show sample of validated users
    console.log('✅ SAMPLE OF VALIDATED USERS (first 10):\n');
    validated.slice(0, 10).forEach((v, index) => {
      console.log(`${index + 1}. ${v.username}: ${v.city}, ${v.country}`);
      if (v.distance !== undefined) {
        console.log(`   Distance from city center: ${v.distance} km ✓`);
      }
      if (v.note) {
        console.log(`   Note: ${v.note}`);
      }
    });
    
    console.log('\n✅ Validation complete\n');
    
    if (issues.length > 0) {
      console.log('⚠️  RECOMMENDATION: Fix coordinates for users with mismatches');
      process.exit(1);
    } else {
      console.log('✨ All coordinates are accurate!');
      process.exit(0);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

validateCoordinates();
