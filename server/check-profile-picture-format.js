const { query } = require('./config/database');

async function checkProfilePictureFormat() {
  try {
    const result = await query(`
      SELECT 
        id, 
        username, 
        profile_data->>'profile_picture' as pp_string,
        profile_data->'profile_picture' as pp_json,
        jsonb_typeof(profile_data->'profile_picture') as pp_type
      FROM users 
      WHERE profile_data->'profile_picture' IS NOT NULL
      LIMIT 5
    `);
    
    console.log('Profile Picture Storage Format:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    result.rows.forEach(row => {
      console.log(`\n--- User: ${row.username} ---`);
      console.log('Type:', row.pp_type);
      console.log('String value (->>):', row.pp_string);
      console.log('JSON value (->):', row.pp_json);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit();
  }
}

checkProfilePictureFormat();
