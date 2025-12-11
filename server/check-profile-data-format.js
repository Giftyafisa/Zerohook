const { query } = require('./config/database');

async function checkProfileDataFormat() {
  try {
    console.log('🔍 Checking profile_data format...\n');

    const usersResult = await query(`
      SELECT 
        id, 
        username,
        profile_data
      FROM users
      ORDER BY created_at ASC
      LIMIT 5
    `);

    console.log(`📊 Sample of 5 users' profile_data:\n`);
    usersResult.rows.forEach((user, i) => {
      console.log(`${i + 1}. ${user.username}:`);
      console.log(`   Keys in profile_data:`, Object.keys(user.profile_data || {}));
      console.log(`   profilePicture:`, user.profile_data?.profilePicture);
      console.log(`   profile_picture:`, user.profile_data?.profile_picture);
      console.log(`   photos:`, user.profile_data?.photos);
      console.log('');
    });

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkProfileDataFormat();
