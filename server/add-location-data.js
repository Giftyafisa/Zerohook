const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Location data for existing users
const userLocations = {
  'akua_ghana': {
    city: 'Accra',
    country: 'Ghana',
    region: 'Greater Accra',
    coordinates: { lat: 5.5600, lng: -0.2057 }
  },
  'kwame_ghana': {
    city: 'Kumasi',
    country: 'Ghana',
    region: 'Ashanti',
    coordinates: { lat: 6.6885, lng: -1.6244 }
  },
  'efua_ghana': {
    city: 'Cape Coast',
    country: 'Ghana',
    region: 'Central',
    coordinates: { lat: 5.1313, lng: -1.2796 }
  },
  'kofi_ghana': {
    city: 'Tamale',
    country: 'Ghana',
    region: 'Northern',
    coordinates: { lat: 9.4035, lng: -0.8423 }
  },
  'ama_ghana': {
    city: 'Sekondi-Takoradi',
    country: 'Ghana',
    region: 'Western',
    coordinates: { lat: 4.9340, lng: -1.7137 }
  },
  'chioma_nigeria': {
    city: 'Lagos Island',
    country: 'Nigeria',
    state: 'Lagos',
    coordinates: { lat: 6.5244, lng: 3.3792 }
  },
  'adebayo_nigeria': {
    city: 'Abuja',
    country: 'Nigeria',
    state: 'FCT',
    coordinates: { lat: 9.0820, lng: 7.3981 }
  },
  'fatima_nigeria': {
    city: 'Kano',
    country: 'Nigeria',
    state: 'Kano',
    coordinates: { lat: 11.9914, lng: 8.5317 }
  },
  'emeka_nigeria': {
    city: 'Port Harcourt',
    country: 'Nigeria',
    state: 'Rivers',
    coordinates: { lat: 4.8156, lng: 7.0498 }
  },
  'blessing_nigeria': {
    city: 'Ibadan',
    country: 'Nigeria',
    state: 'Oyo',
    coordinates: { lat: 7.3964, lng: 3.8967 }
  }
};

async function addLocationData() {
  console.log('🗺️ Adding location data to user profiles...\n');
  
  try {
    for (const [username, locationData] of Object.entries(userLocations)) {
      console.log(`📍 Updating location for: ${username}`);
      
      // Get current profile data
      const currentProfile = await pool.query(`
        SELECT profile_data FROM users WHERE username = $1
      `, [username]);
      
      if (currentProfile.rows.length === 0) {
        console.log(`   ❌ User not found: ${username}`);
        continue;
      }
      
      const currentProfileData = currentProfile.rows[0].profile_data || {};
      
      // Add location data
      const updatedProfileData = {
        ...currentProfileData,
        location: locationData
      };
      
      // Update the user's profile data
      const result = await pool.query(`
        UPDATE users
        SET profile_data = $1::jsonb
        WHERE username = $2
        RETURNING username, profile_data->>'location' as location
      `, [JSON.stringify(updatedProfileData), username]);
      
      if (result.rows.length > 0) {
        console.log(`   ✅ Updated: ${result.rows[0].username} - ${result.rows[0].location}`);
      } else {
        console.log(`   ❌ Update failed: ${username}`);
      }
    }
    
    console.log('\n🎉 Location data added successfully!');
    
    // Verify the updates
    const verificationResult = await pool.query(`
      SELECT username, profile_data->>'location' as location
      FROM users
      WHERE username IN (${Object.keys(userLocations).map((_, i) => `$${i + 1}`).join(', ')})
      ORDER BY username
    `, Object.keys(userLocations));
    
    console.log('\n📋 Verification Results:');
    verificationResult.rows.forEach(row => {
      console.log(`   ${row.username}: ${row.location || 'No location'}`);
    });
    
  } catch (error) {
    console.error('❌ Error adding location data:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  addLocationData();
}
