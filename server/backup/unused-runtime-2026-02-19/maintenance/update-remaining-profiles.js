const { query } = require('./config/database');
const fs = require('fs');
const path = require('path');

const y77ImagesPath = 'C:\\Users\\aship\\Desktop\\Hookup\\y77';
const uploadsPath = path.join(__dirname, 'uploads');

// Remaining images from y77 folder (14 images left)
const remainingImages = [
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

// Specific users to update (from your list)
const targetUsernames = [
  'lydia_sarpong54',
  'selasi_gyamfi41',
  'precious_darko22',
  'araba_danso59',
  'sefakor_badu19',
  'selasi_acheampong77',
  'lydia_badu38',
  'yaa_sarpong18',
  'dzifa_mensah97',
  'precious_badu6',
  'vida_sarpong78',
  'makafui_asamoah13',
  'sena_tetteh70',
  'sena_boateng35',
  'akosua_gyamfi98',
  'yaa_kyei32',
  'mawusi_bonsu74',
  'eyram_boateng26',
  'esther_acheampong6',
  'priscilla_asamoah87',
  'sena_kyei3',
  'nana_boadu52',
  'mercy_tetteh8',
  'linda_ofori81',
  'ekua_adjei98',
  'sandra_amponsah88',
  'patience_forson21',
  'selasi_asante40',
  'yayra_gyamfi75',
  'gifty_kyei1',
  'senam_ampofo55',
  'enam_afriyie29',
  'sena_sarpong29',
  'nana_boadu83',
  'vida_afriyie60',
  'janet_owusu78',
  'mawusi_boadu11',
  'precious_antwi79',
  'linda_badu73',
  'dela_sarpong90',
  'makafui_acheampong24',
  'sandra_owusu26',
  'nana_appiah10',
  'sedinam_bonsu48',
  'sefakor_ampofo63',
  'afua_frimpong83',
  'lydia_asamoah47',
  'janet_amoah79',
  'ekua_agyei67',
  'gifty_afisa',
  'kampala_star',
  'naija_queen',
  'cleo_charm',
  'diamond_diva',
  'kenya_queen',
  'amara_beauty',
  'grace_elegant',
  'sarah_professional'
];

async function updateRemainingProfiles() {
  console.log('🔍 Fetching users needing profile pictures...');
  
  try {
    // Get users from the target list who don't have profile pictures yet
    const placeholders = targetUsernames.map((_, i) => `$${i + 1}`).join(',');
    const result = await query(`
      SELECT id, username, email, profile_data
      FROM users
      WHERE username IN (${placeholders})
        AND (
          profile_data->>'profilePicture' IS NULL 
          OR profile_data->>'profilePicture' = ''
        )
      ORDER BY created_at ASC
    `, targetUsernames);
    
    const usersNeedingPictures = result.rows;
    console.log(`\n📊 Found ${usersNeedingPictures.length} users needing profile pictures`);
    console.log(`📸 Available images: ${remainingImages.length}`);
    
    if (usersNeedingPictures.length === 0) {
      console.log('\n✅ All target users already have profile pictures!');
      return;
    }
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
    }
    
    let updated = 0;
    let skipped = 0;
    
    for (let i = 0; i < usersNeedingPictures.length && i < remainingImages.length; i++) {
      const user = usersNeedingPictures[i];
      const imageFileName = remainingImages[i];
      const sourcePath = path.join(y77ImagesPath, imageFileName);
      
      // Check if source image exists
      if (!fs.existsSync(sourcePath)) {
        console.log(`⚠️  Image not found: ${imageFileName}, skipping...`);
        skipped++;
        continue;
      }
      
      // Create a unique filename for the upload
      const timestamp = Date.now() + i; // Add index to ensure uniqueness
      const newFileName = `profile-${user.username}-${timestamp}.jpg`;
      const destPath = path.join(uploadsPath, newFileName);
      
      try {
        // Copy image to uploads folder
        fs.copyFileSync(sourcePath, destPath);
        
        // Update user profile_data with new profile picture
        const profileData = user.profile_data || {};
        profileData.profilePicture = `/uploads/${newFileName}`;
        profileData.profile_picture = `/uploads/${newFileName}`;
        
        // Also add to photos array
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
    }
    
    console.log(`\n📊 Update Summary:`);
    console.log(`   ✅ Successfully updated: ${updated} users`);
    console.log(`   ⚠️  Skipped: ${skipped} users`);
    console.log(`   📸 Images used: ${updated}/${remainingImages.length}`);
    
    if (usersNeedingPictures.length > remainingImages.length) {
      console.log(`   ⚠️  ${usersNeedingPictures.length - remainingImages.length} users still need pictures (ran out of images)`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

updateRemainingProfiles();
