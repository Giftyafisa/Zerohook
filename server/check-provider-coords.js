/**
 * Check Provider Coordinates
 * Debug script to verify provider location data
 */
const { query } = require('./config/database');

async function checkProviderCoords() {
  try {
    const result = await query(`
      SELECT 
        id, 
        username, 
        profile_data->'location'->>'city' as city,
        profile_data->'location'->'coordinates' as coords
      FROM users 
      WHERE profile_data->>'accountType' = 'provider'
      ORDER BY id
      LIMIT 20
    `);

    console.log('\n📍 Provider locations in database:\n');
    console.log('ID | Username | City | Coordinates');
    console.log('-'.repeat(60));
    
    result.rows.forEach(u => {
      const coords = u.coords || {};
      const lat = coords.lat || 'NULL';
      const lng = coords.lng || 'NULL';
      console.log(`${u.id} | ${u.username?.padEnd(15) || 'N/A'} | ${(u.city || 'N/A').padEnd(15)} | lat: ${lat}, lng: ${lng}`);
    });

    // Now test distance calculation from Adjei-Kojo
    const userLat = 5.6750;  // Adjei-Kojo
    const userLng = -0.0100;
    
    console.log('\n\n🧮 Distance from Adjei-Kojo, Tema West (lat: 5.6750, lng: -0.0100):\n');
    
    // Haversine distance formula
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

    // Calculate distances for each provider
    const withDistances = result.rows.map(u => {
      const coords = u.coords || {};
      if (coords.lat && coords.lng) {
        const distance = calculateDistance(userLat, userLng, coords.lat, coords.lng);
        return { ...u, distance: Math.round(distance * 10) / 10 };
      }
      return { ...u, distance: 9999 };
    }).sort((a, b) => a.distance - b.distance);

    console.log('City | Distance (km)');
    console.log('-'.repeat(40));
    withDistances.slice(0, 15).forEach(u => {
      console.log(`${(u.city || 'N/A').padEnd(20)} | ${u.distance} km`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkProviderCoords();
