/**
 * Check specific user coordinates and calculate actual distance
 */

const { query } = require('./config/database');

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

async function checkSpecificUsers() {
  try {
    // User's GPS location from logs
    const userLat = 5.6131584;
    const userLng = -0.196608;
    
    console.log(`🔍 User's GPS Location: ${userLat}, ${userLng}\n`);
    
    // Check users mentioned as having wrong distances
    const usersToCheck = [
      'Nana',
      'Eyram',
      'Afua',
      'Selasi',
      'Maame',
      'Ama',
      'Adwoa',
      'Araba'
    ];
    
    const result = await query(`
      SELECT 
        id,
        username,
        profile_data
      FROM users
      WHERE profile_data->>'firstName' = ANY($1)
      ORDER BY username
    `, [usersToCheck]);
    
    console.log(`📊 Found ${result.rows.length} users\n`);
    console.log('=' .repeat(80));
    
    for (const user of result.rows) {
      const profileData = user.profile_data || {};
      const location = profileData.location || {};
      const coords = location.coordinates || {};
      const firstName = profileData.firstName;
      const age = profileData.age;
      const city = location.city;
      const country = location.country;
      
      console.log(`\n👤 ${firstName}, ${age}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   City: ${city}, ${country}`);
      console.log(`   Stored Coordinates: ${coords.lat}, ${coords.lng}`);
      
      if (coords.lat && coords.lng) {
        const providerLat = parseFloat(coords.lat);
        const providerLng = parseFloat(coords.lng);
        
        if (!isNaN(providerLat) && !isNaN(providerLng)) {
          const distance = calculateDistance(userLat, userLng, providerLat, providerLng);
          console.log(`   ✅ CALCULATED DISTANCE: ${distance.toFixed(2)} km`);
          
          // Check if coordinates match the stated city
          // Dzorwulu should be around 5.608, -0.201
          if (city === 'Dzorwulu') {
            const expectedLat = 5.608;
            const expectedLng = -0.201;
            const cityDistance = calculateDistance(providerLat, providerLng, expectedLat, expectedLng);
            console.log(`   🏙️  Distance from Dzorwulu center: ${cityDistance.toFixed(2)} km`);
            if (cityDistance > 5) {
              console.log(`   ⚠️  WARNING: Coordinates don't match stated city!`);
            }
          }
          
          // Check other cities
          if (city === 'Airport Residential') {
            const expectedLat = 5.605;
            const expectedLng = -0.170;
            const cityDistance = calculateDistance(providerLat, providerLng, expectedLat, expectedLng);
            console.log(`   🏙️  Distance from Airport Residential center: ${cityDistance.toFixed(2)} km`);
            if (cityDistance > 5) {
              console.log(`   ⚠️  WARNING: Coordinates don't match stated city!`);
            }
          }
          
          if (city === 'Roman Ridge') {
            const expectedLat = 5.588;
            const expectedLng = -0.188;
            const cityDistance = calculateDistance(providerLat, providerLng, expectedLat, expectedLng);
            console.log(`   🏙️  Distance from Roman Ridge center: ${cityDistance.toFixed(2)} km`);
            if (cityDistance > 5) {
              console.log(`   ⚠️  WARNING: Coordinates don't match stated city!`);
            }
          }
        } else {
          console.log(`   ❌ INVALID COORDINATES`);
        }
      } else {
        console.log(`   ❌ NO COORDINATES FOUND`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Check complete\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkSpecificUsers();
