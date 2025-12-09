const { query } = require('./config/database');

async function checkInconsistentImages() {
  try {
    console.log('=== CHECKING FOR INCONSISTENT IMAGE FIELDS ===\n');
    
    const result = await query(`
      SELECT 
        id,
        username,
        email,
        profile_data->'photos' as photos,
        profile_data->'profilePicture' as profilePicture,
        profile_data->'profile_picture' as profile_picture
      FROM users
      WHERE profile_data IS NOT NULL
    `);
    
    console.log(`Total users with profile_data: ${result.rowCount}\n`);
    
    let inconsistentCount = 0;
    const inconsistentUsers = [];
    
    result.rows.forEach(user => {
      const photos = user.photos;
      const profilePicture = user.profilepicture;
      const profile_picture = user.profile_picture;
      
      // Get values
      const photosUrl = photos && Array.isArray(photos) && photos.length > 0 ? photos[0] : null;
      const profilePictureUrl = profilePicture || null;
      const profilePictureObjUrl = profile_picture?.url || null;
      
      // Check if they're all the same
      const allSame = (
        photosUrl === profilePictureUrl &&
        photosUrl === profilePictureObjUrl
      );
      
      if (!allSame && (photosUrl || profilePictureUrl || profilePictureObjUrl)) {
        inconsistentCount++;
        inconsistentUsers.push({
          username: user.username,
          email: user.email,
          photos: photosUrl,
          profilePicture: profilePictureUrl,
          profile_picture_url: profilePictureObjUrl
        });
      }
    });
    
    console.log(`Users with inconsistent image fields: ${inconsistentCount}\n`);
    
    if (inconsistentCount > 0) {
      console.log('First 10 inconsistent users:\n');
      inconsistentUsers.slice(0, 10).forEach(u => {
        console.log(`${u.username} (${u.email})`);
        console.log(`  photos[0]: ${u.photos}`);
        console.log(`  profilePicture: ${u.profilePicture}`);
        console.log(`  profile_picture.url: ${u.profile_picture_url}`);
        console.log('');
      });
      
      console.log(`\n💡 Run fix-all-image-fields.js to fix all ${inconsistentCount} users`);
    } else {
      console.log('✅ All users have consistent image fields!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkInconsistentImages();
