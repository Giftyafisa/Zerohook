const { query } = require('./config/database');
const fs = require('fs');
const path = require('path');

async function assignProfilePictures() {
  try {
    console.log('🖼️  Assigning profile pictures from KSS folder...\n');

    // Get all users without profile pictures
    const usersResult = await query(`
      SELECT id, username, profile_data
      FROM users
      WHERE profile_data->>'profilePicture' IS NULL 
         OR profile_data->>'profilePicture' = ''
         OR profile_data->>'profile_picture' IS NULL
         OR profile_data->>'profile_picture' = ''
      ORDER BY created_at ASC
    `);

    const users = usersResult.rows;
    console.log(`📊 Found ${users.length} users without profile pictures`);

    if (users.length === 0) {
      console.log('✅ All users already have profile pictures!');
      process.exit(0);
    }

    // Get list of images from KSS folder
    const kssDir = path.join(__dirname, '..', 'KSS');
    const uploadsDir = path.join(__dirname, 'uploads');

    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('📁 Created uploads directory');
    }

    let imageFiles = [];
    if (fs.existsSync(kssDir)) {
      imageFiles = fs.readdirSync(kssDir)
        .filter(file => file.toLowerCase().endsWith('.jpg'))
        .sort();
      console.log(`📸 Found ${imageFiles.length} images in KSS folder\n`);
    } else {
      console.log('❌ KSS folder not found!');
      process.exit(1);
    }

    if (imageFiles.length === 0) {
      console.log('❌ No images found in KSS folder!');
      process.exit(1);
    }

    let assignedCount = 0;

    for (let i = 0; i < users.length && i < imageFiles.length; i++) {
      const user = users[i];
      const imageFile = imageFiles[i];
      
      // Generate new filename for the user
      const ext = path.extname(imageFile);
      const newFilename = `profile-${user.username}-${Date.now()}${ext}`;
      
      // Copy image from KSS to uploads
      const sourcePath = path.join(kssDir, imageFile);
      const destPath = path.join(uploadsDir, newFilename);
      
      try {
        fs.copyFileSync(sourcePath, destPath);
        
        // Update user's profile_data with the new profile picture
        const profileData = user.profile_data || {};
        profileData.profilePicture = `/uploads/${newFilename}`;
        profileData.profile_picture = `/uploads/${newFilename}`; // Both formats for compatibility
        
        await query(`
          UPDATE users 
          SET profile_data = $1
          WHERE id = $2
        `, [JSON.stringify(profileData), user.id]);
        
        assignedCount++;
        console.log(`✅ ${assignedCount}. Assigned ${imageFile} → ${user.username} (${newFilename})`);
        
      } catch (copyError) {
        console.error(`❌ Failed to copy ${imageFile} for ${user.username}:`, copyError.message);
      }
    }

    console.log(`\n🎉 Successfully assigned ${assignedCount} profile pictures!`);
    
    if (users.length > imageFiles.length) {
      console.log(`⚠️  ${users.length - imageFiles.length} users still need pictures (not enough images)`);
    }
    
    process.exit(0);

  } catch (error) {
    console.error('❌ Error assigning profile pictures:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

assignProfilePictures();
