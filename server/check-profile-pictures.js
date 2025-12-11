const { query } = require('./config/database');

async function checkProfilePictures() {
  try {
    console.log('🔍 Checking user profile pictures...\n');

    // Get all users
    const usersResult = await query(`
      SELECT 
        id, 
        username, 
        profile_data->>'profilePicture' as profile_picture,
        profile_data->>'profile_picture' as profile_picture_alt
      FROM users
      ORDER BY created_at ASC
      LIMIT 20
    `);

    console.log(`📊 First 20 users:\n`);
    usersResult.rows.forEach((user, i) => {
      const pic = user.profile_picture || user.profile_picture_alt || 'NONE';
      console.log(`${i + 1}. ${user.username}: ${pic}`);
    });

    // Count users with/without pictures
    const withPictures = await query(`
      SELECT COUNT(*) as count
      FROM users
      WHERE (profile_data->>'profilePicture' IS NOT NULL AND profile_data->>'profilePicture' != '')
         OR (profile_data->>'profile_picture' IS NOT NULL AND profile_data->>'profile_picture' != '')
    `);

    const totalUsers = await query(`SELECT COUNT(*) as count FROM users`);

    console.log(`\n📈 Summary:`);
    console.log(`   Total users: ${totalUsers.rows[0].count}`);
    console.log(`   With pictures: ${withPictures.rows[0].count}`);
    console.log(`   Without pictures: ${totalUsers.rows[0].count - withPictures.rows[0].count}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkProfilePictures();
