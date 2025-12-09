const { query } = require('./config/database');
const fs = require('fs');
const path = require('path');

const y77ImagesPath = 'C:\\Users\\aship\\Desktop\\Hookup\\y77';
const uploadsPath = path.join(__dirname, 'uploads');

// List of images from y77 folder (excluding default images from eventhub)
const y77Images = [
  'sedinam_boateng14@example.com.jpg',
  'Akua.jpg',
  'photo_2025-12-04_10-40-51.jpg',
  'photo_2025-12-03_17-03-30.jpg',
  'photo_2025-12-02_13-48-49.jpg',
  'photo_2025-11-26_10-03-51.jpg',
  'photo_2025-11-25_23-00-19.jpg',
  'photo_2025-11-19_09-30-34.jpg',
  'photo_2025-11-01_10-00-21.jpg',
  'photo_2025-10-30_08-08-31.jpg',
  'photo_2025-10-29_10-07-33.jpg',
  'photo_2025-10-29_10-07-13.jpg',
  'photo_2025-10-22_03-17-35.jpg',
  'photo_2025-10-22_02-11-09.jpg',
  'photo_2025-10-14_13-37-22.jpg',
  'photo_2025-10-07_20-02-31.jpg',
  'photo_2025-10-04_07-43-09.jpg',
  'photo_2025-10-02_17-20-59.jpg',
  'photo_2025-09-25_00-31-32.jpg',
  'photo_2025-09-20_18-02-58.jpg',
  'photo_2025-09-15_22-19-24.jpg',
  'photo_2025-09-13_07-23-32.jpg',
  'photo_2025-09-10_14-27-07.jpg',
  'photo_2025-09-10_14-27-06.jpg',
  'photo_2025-09-03_05-14-58.jpg',
  'photo_2025-08-31_20-07-55.jpg',
  'photo_2025-08-20_20-21-31.jpg',
  'photo_2025-08-17_10-43-26.jpg',
  'photo_2025-08-08_11-18-35.jpg',
  'photo_2025-08-07_09-56-52.jpg',
  'photo_2025-08-05_09-05-00.jpg',
  'photo_2025-08-02_06-28-27.jpg',
  'photo_2025-07-31_15-59-12.jpg',
  'photo_2025-07-31_14-25-08.jpg',
  'photo_2025-07-31_10-30-50.jpg',
  'photo_2025-07-27_04-59-10.jpg',
  'photo_2025-07-11_08-01-41.jpg',
  'photo_2025-07-05_13-07-50.jpg',
  'photo_2025-06-29_06-51-14.jpg',
  'photo_2025-06-28_12-28-58.jpg',
  'photo_2025-06-27_07-12-56.jpg',
  'photo_2025-06-19_12-49-32.jpg',
  'photo_2025-06-14_19-43-58.jpg',
  'photo_2025-05-29_05-09-47.jpg',
  'photo_2025-05-22_10-03-27.jpg',
  'photo_2025-05-20_23-39-46.jpg',
  'photo_2025-05-20_16-35-41.jpg',
  'photo_2025-03-12_08-54-32.jpg',
  'photo_2024-12-27_22-24-21.jpg',
  'photo_2024-09-07_09-00-13.jpg',
  'photo_2024-07-06_20-01-39.jpg',
  'photo_2024-05-12_21-44-52.jpg',
  'photo_2024-05-11_17-46-27.jpg',
  'photo_2023-08-01_22-34-41.jpg',
  'photo_2023-04-03_20-24-55.jpg',
  'photo_2021-07-13_11-44-37.jpg',
  'photo_2021-07-10_13-51-22.jpg'
];

async function updateProfilesWithY77Images() {
  console.log('🔍 Fetching users without profile pictures...');
  
  try {
    // Get all users who don't have profile pictures yet (excluding users with recent updates)
    const result = await query(`
      SELECT id, username, email, profile_data
      FROM users
      WHERE (
          profile_data->>'profilePicture' IS NULL 
          OR profile_data->>'profilePicture' = ''
          OR profile_data->>'profile_picture' IS NULL 
          OR profile_data->>'profile_picture' = ''
        )
        AND username NOT IN ('sedinam_boateng14')
      ORDER BY created_at ASC
    `);
    
    const usersNeedingPictures = result.rows;
    console.log(`\n📊 Found ${usersNeedingPictures.length} users needing profile pictures`);
    console.log(`📸 Available images: ${y77Images.length}`);
    
    if (usersNeedingPictures.length === 0) {
      console.log('\n✅ All provider users already have profile pictures!');
      return;
    }
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
      console.log(`\n📁 Created uploads directory: ${uploadsPath}`);
    }
    
    let updated = 0;
    let skipped = 0;
    let imageIndex = 0;
    
    for (const user of usersNeedingPictures) {
      if (imageIndex >= y77Images.length) {
        console.log(`\n⚠️  Ran out of images. ${usersNeedingPictures.length - updated} users still need pictures.`);
        break;
      }
      
      const imageFileName = y77Images[imageIndex];
      const sourcePath = path.join(y77ImagesPath, imageFileName);
      
      // Check if source image exists
      if (!fs.existsSync(sourcePath)) {
        console.log(`⚠️  Image not found: ${imageFileName}, skipping...`);
        imageIndex++;
        skipped++;
        continue;
      }
      
      // Create a unique filename for the upload
      const timestamp = Date.now();
      const newFileName = `profile-${user.username}-${timestamp}.jpg`;
      const destPath = path.join(uploadsPath, newFileName);
      
      try {
        // Copy image to uploads folder
        fs.copyFileSync(sourcePath, destPath);
        
        // Update user profile_data with new profile picture
        const profileData = user.profile_data || {};
        profileData.profilePicture = `/uploads/${newFileName}`;
        profileData.profile_picture = `/uploads/${newFileName}`;
        
        // Also add to photos array if it exists
        if (!profileData.photos) {
          profileData.photos = [];
        }
        if (!profileData.photos.includes(`/uploads/${newFileName}`)) {
          profileData.photos.unshift(`/uploads/${newFileName}`);
        }
        
        await query(`
          UPDATE users 
          SET profile_data = $1
          WHERE id = $2
        `, [JSON.stringify(profileData), user.id]);
        
        updated++;
        console.log(`✅ ${updated}. Updated ${user.username} with ${imageFileName}`);
        
      } catch (error) {
        console.error(`❌ Error updating ${user.username}:`, error.message);
        skipped++;
      }
      
      imageIndex++;
    }
    
    console.log(`\n📊 Update Summary:`);
    console.log(`   ✅ Successfully updated: ${updated} users`);
    console.log(`   ⚠️  Skipped: ${skipped} users`);
    console.log(`   📸 Images used: ${imageIndex}/${y77Images.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

updateProfilesWithY77Images();
