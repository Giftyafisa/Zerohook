const { query } = require('./config/database');

async function checkImageFormats() {
  try {
    console.log('=== CHECKING IMAGE FORMATS IN DATABASE ===\n');
    
    const result = await query(`
      SELECT 
        username,
        profile_data->'photos' as photos,
        profile_data->'profilePicture' as profilePicture,
        profile_data->'profile_picture' as profile_picture
      FROM users 
      WHERE profile_data IS NOT NULL 
      LIMIT 10
    `);
    
    result.rows.forEach(user => {
      console.log(`User: ${user.username}`);
      if (user.photos) {
        console.log(`  photos: ${JSON.stringify(user.photos)}`);
      }
      if (user.profilepicture) {
        console.log(`  profilePicture: ${JSON.stringify(user.profilepicture)}`);
      }
      if (user.profile_picture) {
        console.log(`  profile_picture: ${JSON.stringify(user.profile_picture)}`);
      }
      console.log('');
    });
    
    // Summary
    const withPhotos = result.rows.filter(r => r.photos).length;
    const withProfilePicture = result.rows.filter(r => r.profilepicture).length;
    const withProfilePictureObj = result.rows.filter(r => r.profile_picture).length;
    
    console.log('=== SUMMARY ===');
    console.log(`Total users checked: ${result.rows.length}`);
    console.log(`Users with 'photos' array: ${withPhotos}`);
    console.log(`Users with 'profilePicture' string: ${withProfilePicture}`);
    console.log(`Users with 'profile_picture' object: ${withProfilePictureObj}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkImageFormats();
