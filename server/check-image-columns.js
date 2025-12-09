const { query } = require('./config/database');

async function checkColumns() {
  try {
    console.log('=== CHECKING USERS TABLE IMAGE COLUMNS ===\n');
    
    const result = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND (
        column_name LIKE '%picture%' 
        OR column_name LIKE '%photo%' 
        OR column_name LIKE '%image%'
        OR column_name = 'profile_data'
      )
      ORDER BY column_name
    `);
    
    console.log('Image-related columns found:');
    result.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n=== CHECKING SEDINAM_BOATENG14 DATA ===\n');
    
    const userData = await query(`
      SELECT 
        id,
        username,
        email,
        profile_data
      FROM users
      WHERE email = 'sedinam_boateng14@example.com'
    `);
    
    if (userData.rowCount === 0) {
      console.log('❌ User not found!');
      return;
    }
    
    const user = userData.rows[0];
    
    console.log('User ID:', user.id);
    console.log('Username:', user.username);
    console.log('Email:', user.email);
    console.log('\n--- PROFILE_DATA CONTENT ---\n');
    console.log(JSON.stringify(user.profile_data, null, 2));
    
    if (user.profile_data) {
      console.log('\n--- IMAGE FIELDS IN PROFILE_DATA ---\n');
      if (user.profile_data.photos) {
        console.log('photos[]:', user.profile_data.photos);
      }
      if (user.profile_data.profilePicture) {
        console.log('profilePicture:', user.profile_data.profilePicture);
      }
      if (user.profile_data.profile_picture) {
        console.log('profile_picture:', user.profile_data.profile_picture);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkColumns();
