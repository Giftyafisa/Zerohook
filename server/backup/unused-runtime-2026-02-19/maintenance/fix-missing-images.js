const { query } = require('./config/database');
const fs = require('fs');
const path = require('path');

async function checkMissingImages() {
  try {
    console.log('🔍 Checking for users with missing image files...\n');

    const uploadsDir = path.join(__dirname, 'uploads');
    
    // Get all users with their profile pictures
    const usersResult = await query(`
      SELECT id, username, profile_data
      FROM users
      ORDER BY username ASC
    `);

    const users = usersResult.rows;
    let missingCount = 0;
    const missingUsers = [];

    for (const user of users) {
      const profileData = user.profile_data || {};
      
      // Get the profile picture path
      let picturePath = null;
      
      if (profileData.profilePicture && typeof profileData.profilePicture === 'string') {
        picturePath = profileData.profilePicture;
      } else if (profileData.profile_picture) {
        if (typeof profileData.profile_picture === 'string') {
          picturePath = profileData.profile_picture;
        } else if (typeof profileData.profile_picture === 'object' && profileData.profile_picture.url) {
          picturePath = profileData.profile_picture.url;
        }
      }
      
      if (picturePath) {
        // Check if it's a local file (starts with /uploads/)
        if (picturePath.startsWith('/uploads/')) {
          const filename = picturePath.replace('/uploads/', '');
          const fullPath = path.join(uploadsDir, filename);
          
          if (!fs.existsSync(fullPath)) {
            missingCount++;
            missingUsers.push({
              username: user.username,
              id: user.id,
              path: picturePath,
              profileData
            });
            console.log(`❌ MISSING: ${user.username} - ${picturePath}`);
          }
        }
      } else {
        missingCount++;
        missingUsers.push({
          username: user.username,
          id: user.id,
          path: null,
          profileData
        });
        console.log(`⚠️  NO PATH: ${user.username}`);
      }
    }

    console.log(`\n📊 Summary: ${missingCount} users with missing/no images out of ${users.length}`);
    
    if (missingUsers.length > 0) {
      console.log('\n🔧 Users that need fixing:');
      missingUsers.forEach((u, i) => {
        console.log(`   ${i + 1}. ${u.username} (${u.path || 'no path'})`);
      });
    }

    // Return missing users for potential fixing
    return missingUsers;

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function fixMissingImages(missingUsers) {
  if (missingUsers.length === 0) {
    console.log('\n✅ All users have valid images!');
    process.exit(0);
    return;
  }

  console.log('\n🔧 Assigning KSS images to users with missing files...\n');

  const kssDir = path.join(__dirname, '..', 'KSS');
  const uploadsDir = path.join(__dirname, 'uploads');

  // Get available KSS images
  const kssImages = fs.readdirSync(kssDir)
    .filter(f => f.toLowerCase().endsWith('.jpg'))
    .sort();

  console.log(`📸 Found ${kssImages.length} KSS images available\n`);

  let fixedCount = 0;

  for (let i = 0; i < missingUsers.length && i < kssImages.length; i++) {
    const user = missingUsers[i];
    const kssImage = kssImages[i];

    const newFilename = `profile-${user.username}-${Date.now()}.jpg`;
    const sourcePath = path.join(kssDir, kssImage);
    const destPath = path.join(uploadsDir, newFilename);

    try {
      // Copy image
      fs.copyFileSync(sourcePath, destPath);

      // Update database
      const profileData = user.profileData || {};
      profileData.profilePicture = `/uploads/${newFilename}`;
      profileData.profile_picture = `/uploads/${newFilename}`;
      profileData.photos = [`/uploads/${newFilename}`];

      await query(`
        UPDATE users 
        SET profile_data = $1
        WHERE id = $2
      `, [JSON.stringify(profileData), user.id]);

      fixedCount++;
      console.log(`✅ Fixed ${user.username}: ${newFilename}`);

    } catch (err) {
      console.error(`❌ Failed to fix ${user.username}:`, err.message);
    }
  }

  console.log(`\n🎉 Fixed ${fixedCount} users!`);
  process.exit(0);
}

// Run
(async () => {
  const missing = await checkMissingImages();
  await fixMissingImages(missing);
})();
