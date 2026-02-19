const { query } = require('./config/database');

async function verifyUpdates() {
  console.log('🔍 Verifying profile picture updates...\n');
  
  try {
    const result = await query(`
      SELECT 
        username,
        profile_data->>'profilePicture' as profile_picture,
        array_length(
          CASE 
            WHEN jsonb_typeof(profile_data->'photos') = 'array' 
            THEN ARRAY(SELECT jsonb_array_elements_text(profile_data->'photos'))
            ELSE ARRAY[]::text[]
          END, 1
        ) as photo_count
      FROM users
      WHERE profile_data->>'profilePicture' LIKE '/uploads/profile-%'
      ORDER BY username
      LIMIT 10
    `);
    
    console.log(`✅ Found ${result.rows.length} users with updated profile pictures:\n`);
    
    result.rows.forEach((user, idx) => {
      console.log(`${idx + 1}. ${user.username}`);
      console.log(`   Picture: ${user.profile_picture}`);
      console.log(`   Photos in array: ${user.photo_count || 0}\n`);
    });
    
    // Count total users with profile pictures
    const countResult = await query(`
      SELECT COUNT(*) as total
      FROM users
      WHERE profile_data->>'profilePicture' IS NOT NULL
        AND profile_data->>'profilePicture' != ''
    `);
    
    console.log(`\n📊 Total users with profile pictures: ${countResult.rows[0].total}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

verifyUpdates();
