const { query } = require('./config/database');

async function syncPhotosWithProfilePicture() {
  try {
    console.log('🔄 Syncing photos array with profilePicture for all users...\n');

    // Get all users
    const usersResult = await query(`
      SELECT id, username, profile_data
      FROM users
      ORDER BY created_at ASC
    `);

    const users = usersResult.rows;
    console.log(`📊 Found ${users.length} users to check\n`);

    let fixedCount = 0;

    for (const user of users) {
      const profileData = user.profile_data || {};
      
      // Get the actual profile picture (prefer profilePicture string)
      let actualPicture = null;
      
      if (profileData.profilePicture && typeof profileData.profilePicture === 'string') {
        actualPicture = profileData.profilePicture;
      } else if (profileData.profile_picture) {
        if (typeof profileData.profile_picture === 'string') {
          actualPicture = profileData.profile_picture;
        } else if (typeof profileData.profile_picture === 'object' && profileData.profile_picture.url) {
          actualPicture = profileData.profile_picture.url;
        }
      }
      
      // Check if photos array needs fixing
      const currentPhotos = profileData.photos || [];
      const needsFix = !actualPicture || 
                       currentPhotos.length === 0 || 
                       (currentPhotos[0] && currentPhotos[0].includes('unsplash')) ||
                       (actualPicture && currentPhotos[0] !== actualPicture);
      
      if (needsFix && actualPicture) {
        // Update photos array to match profilePicture
        profileData.photos = [actualPicture];
        
        await query(`
          UPDATE users 
          SET profile_data = $1
          WHERE id = $2
        `, [JSON.stringify(profileData), user.id]);
        
        fixedCount++;
        console.log(`✅ Fixed ${user.username}: photos = ['${actualPicture}']`);
      } else if (!actualPicture) {
        console.log(`⚠️  ${user.username}: No profile picture found!`);
      }
    }

    console.log(`\n🎉 Fixed ${fixedCount} users' photos arrays!`);
    
    // Verify a sample
    console.log('\n📊 Sample verification (first 5 users):');
    const verifyResult = await query(`
      SELECT username, 
             profile_data->>'profilePicture' as pic,
             profile_data->'photos' as photos
      FROM users 
      ORDER BY created_at ASC 
      LIMIT 5
    `);
    verifyResult.rows.forEach(u => {
      console.log(`   ${u.username}: pic=${u.pic?.substring(0, 50)}..., photos=${JSON.stringify(u.photos)}`);
    });
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

syncPhotosWithProfilePicture();
