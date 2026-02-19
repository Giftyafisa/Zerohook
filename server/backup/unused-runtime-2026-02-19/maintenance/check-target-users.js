const { query } = require('./config/database');

async function checkTargetUsers() {
  console.log('🔍 Checking profile pictures for target users...\n');
  
  const targetUsers = [
    'lydia_sarpong54',
    'selasi_gyamfi41',
    'sedinam_boateng14',
    'kampala_star',
    'naija_queen',
    'diamond_diva',
    'kenya_queen',
    'sarah_professional'
  ];
  
  try {
    const placeholders = targetUsers.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`
      SELECT 
        username,
        email,
        profile_data->>'profilePicture' as profile_picture,
        CASE 
          WHEN profile_data->>'profilePicture' IS NOT NULL 
            AND profile_data->>'profilePicture' != '' 
          THEN 'Yes ✅'
          ELSE 'No ❌'
        END as has_picture
      FROM users
      WHERE username IN (${placeholders})
      ORDER BY username
    `, targetUsers);
    
    console.log('Profile Picture Status:\n');
    result.rows.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Has Picture: ${user.has_picture}`);
      if (user.profile_picture) {
        console.log(`   Path: ${user.profile_picture}`);
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkTargetUsers();
