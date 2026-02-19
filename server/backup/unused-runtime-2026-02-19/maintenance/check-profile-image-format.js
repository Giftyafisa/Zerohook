const { query } = require('./config/database');

async function checkProfileImageFormat() {
  console.log('🔍 Checking profile image format in database...\n');
  
  try {
    const result = await query(`
      SELECT 
        username,
        profile_data->>'profilePicture' as profile_picture_string,
        profile_data->>'profile_picture' as profile_picture_alt,
        profile_data->'photos' as photos_array,
        profile_data
      FROM users
      WHERE username IN ('ekua_adjei98', 'linda_ofori81', 'mercy_tetteh8')
      ORDER BY username
    `);
    
    console.log('Profile Data Structure:\n');
    result.rows.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.username}`);
      console.log(`   profilePicture (string): ${user.profile_picture_string}`);
      console.log(`   profile_picture (alt): ${user.profile_picture_alt}`);
      console.log(`   photos array: ${user.photos_array}`);
      console.log(`   Full profile_data keys:`, Object.keys(user.profile_data || {}));
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkProfileImageFormat();
