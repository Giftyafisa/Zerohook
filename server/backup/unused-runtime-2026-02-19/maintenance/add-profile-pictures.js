const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Profile picture URLs for Ghana and Nigeria users
const profilePictures = {
  // Ghana Users
  'akua_ghana': {
    name: 'Akua Mensah',
    picture: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=400&fit=crop&crop=face',
    description: 'Professional companion and beauty consultant in Accra'
  },
  'kwame_ghana': {
    name: 'Kwame Owusu',
    picture: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
    description: 'Professional companion and masseur in Kumasi'
  },
  'efua_ghana': {
    name: 'Efua Adjei',
    picture: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop&crop=face',
    description: 'Professional companion and event organizer in Cape Coast'
  },
  'kofi_ghana': {
    name: 'Kofi Boateng',
    picture: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop&crop=face',
    description: 'Professional companion and wellness provider in Tamale'
  },
  'ama_ghana': {
    name: 'Ama Sarpong',
    picture: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop&crop=face',
    description: 'Professional companion and fitness trainer in Tema'
  },
  
  // Nigeria Users
  'chioma_nigeria': {
    name: 'Chioma Okechukwu',
    picture: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=400&fit=crop&crop=face',
    description: 'Professional companion and beauty expert in Lagos'
  },
  'adebayo_nigeria': {
    name: 'Adebayo Adeyemi',
    picture: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop&crop=face',
    description: 'Professional companion and masseur in Abuja'
  },
  'fatima_nigeria': {
    name: 'Fatima Hassan',
    picture: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=400&h=400&fit=crop&crop=face',
    description: 'Professional companion and wellness provider in Kano'
  },
  'emeka_nigeria': {
    name: 'Emeka Uzoma',
    picture: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face',
    description: 'Professional companion and business consultant in Port Harcourt'
  },
  'blessing_nigeria': {
    name: 'Blessing Ogunleye',
    picture: 'https://images.unsplash.com/photo-1485875437342-9b7f0a0b0b0b?w=400&h=400&fit=crop&crop=face',
    description: 'Professional companion and educator in Ibadan'
  }
};

async function addProfilePictures() {
  console.log('🖼️ Adding Profile Pictures to Users...\n');
  
  try {
    for (const [username, profileData] of Object.entries(profilePictures)) {
      console.log(`👤 Adding picture for: ${profileData.name} (${username})`);
      
      // Update user's profile_data to include profile picture
      const result = await pool.query(`
        UPDATE users 
        SET profile_data = profile_data || $1::jsonb
        WHERE username = $2
        RETURNING username, profile_data->>'profilePicture' as picture
      `, [
        JSON.stringify({
          profilePicture: profileData.picture,
          profileDescription: profileData.description
        }),
        username
      ]);
      
      if (result.rows.length > 0) {
        console.log(`   ✅ Picture added: ${result.rows[0].picture ? 'Success' : 'Failed'}`);
      } else {
        console.log(`   ❌ User not found: ${username}`);
      }
    }
    
    console.log('\n🎉 Profile pictures added successfully!');
    console.log('\n📸 Profile Pictures Summary:');
    console.log('   Ghana Users: 5 (Accra, Kumasi, Cape Coast, Tamale, Tema)');
    console.log('   Nigeria Users: 5 (Lagos, Abuja, Kano, Port Harcourt, Ibadan)');
    console.log('   Total: 10 users with professional profile pictures');
    
  } catch (error) {
    console.error('❌ Error adding profile pictures:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  addProfilePictures();
}
