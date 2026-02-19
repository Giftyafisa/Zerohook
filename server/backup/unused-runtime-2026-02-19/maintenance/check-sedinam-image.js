const { query } = require('./config/database');

async function checkUserImage() {
  try {
    console.log('=== CHECKING SEDINAM_BOATENG14 PROFILE IMAGE ===\n');
    
    const result = await query(`
      SELECT 
        id,
        username,
        email,
        photos,
        profile_picture,
        "profilePicture",
        profile_data
      FROM users
      WHERE email = 'sedinam_boateng14@example.com'
    `);
    
    if (result.rowCount === 0) {
      console.log('❌ User not found!');
      return;
    }
    
    const user = result.rows[0];
    
    console.log('User ID:', user.id);
    console.log('Username:', user.username);
    console.log('Email:', user.email);
    console.log('\n--- IMAGE FIELD VALUES ---\n');
    
    console.log('1. photos[] array:');
    console.log(JSON.stringify(user.photos, null, 2));
    
    console.log('\n2. profile_picture (JSONB):');
    console.log(JSON.stringify(user.profile_picture, null, 2));
    
    console.log('\n3. profilePicture (string):');
    console.log(user.profilePicture);
    
    console.log('\n4. profile_data (JSONB):');
    if (user.profile_data) {
      console.log(JSON.stringify(user.profile_data, null, 2));
    } else {
      console.log('null');
    }
    
    console.log('\n--- ANALYSIS ---\n');
    
    if (user.photos && user.photos.length > 0) {
      console.log('✅ photos[0] exists:', user.photos[0]);
    } else {
      console.log('❌ photos[] is empty or null');
    }
    
    if (user.profile_picture && user.profile_picture.url) {
      console.log('✅ profile_picture.url exists:', user.profile_picture.url);
    } else {
      console.log('❌ profile_picture.url is missing');
    }
    
    if (user.profilePicture) {
      console.log('✅ profilePicture string exists:', user.profilePicture);
    } else {
      console.log('❌ profilePicture is null');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkUserImage();
