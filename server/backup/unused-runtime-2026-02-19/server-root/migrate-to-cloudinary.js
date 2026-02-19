/**
 * Migrate Local Images to Cloudinary
 * This script uploads existing local profile images to Cloudinary
 * and updates the database references
 */

require('dotenv').config({ path: './env.local' });
const fs = require('fs');
const path = require('path');
const { query } = require('./config/database');
const CloudinaryManager = require('./services/CloudinaryManager');

const cloudinary = new CloudinaryManager();

async function migrateImages() {
  console.log('🚀 Starting image migration to Cloudinary...\n');

  // Check Cloudinary configuration
  if (!cloudinary.isConfigured) {
    console.error('❌ Cloudinary is not configured. Please set CLOUDINARY_API_SECRET in env.local');
    console.log('\nTo get your API Secret:');
    console.log('1. Go to https://console.cloudinary.com/settings/api-keys');
    console.log('2. Click on your API key or "Generate New API Key"');
    console.log('3. Copy the API Secret and add it to env.local');
    process.exit(1);
  }

  const healthCheck = await cloudinary.healthCheck();
  if (!healthCheck.healthy) {
    console.error('❌ Cloudinary health check failed:', healthCheck.error);
    process.exit(1);
  }
  console.log('✅ Cloudinary connection verified\n');

  // Get all users with local profile images
  const usersResult = await query(`
    SELECT id, username, profile_data 
    FROM users 
    WHERE profile_data IS NOT NULL
  `);

  console.log(`Found ${usersResult.rows.length} users to check for local images\n`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const user of usersResult.rows) {
    const profileData = user.profile_data;
    if (!profileData) {
      skipped++;
      continue;
    }

    // Check for local images in various formats
    let localImagePath = null;
    let imageSource = null;

    // Check photos array
    if (profileData.photos && Array.isArray(profileData.photos) && profileData.photos.length > 0) {
      const photo = profileData.photos[0];
      if (typeof photo === 'string' && photo.startsWith('/uploads/')) {
        localImagePath = photo;
        imageSource = 'photos';
      }
    }

    // Check profile_picture
    if (!localImagePath && profileData.profile_picture) {
      const pic = typeof profileData.profile_picture === 'object' 
        ? profileData.profile_picture.url 
        : profileData.profile_picture;
      if (pic && typeof pic === 'string' && pic.startsWith('/uploads/')) {
        localImagePath = pic;
        imageSource = 'profile_picture';
      }
    }

    // Check profilePicture
    if (!localImagePath && profileData.profilePicture) {
      if (typeof profileData.profilePicture === 'string' && profileData.profilePicture.startsWith('/uploads/')) {
        localImagePath = profileData.profilePicture;
        imageSource = 'profilePicture';
      }
    }

    // Skip if already on Cloudinary or no local image
    if (!localImagePath) {
      // Check if already on Cloudinary
      const anyUrl = profileData.photos?.[0] || profileData.profile_picture?.url || profileData.profilePicture;
      if (anyUrl && anyUrl.includes('cloudinary.com')) {
        console.log(`⏭️  ${user.username}: Already on Cloudinary`);
      }
      skipped++;
      continue;
    }

    // Construct full file path
    const fullPath = path.join(__dirname, localImagePath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  ${user.username}: Local file not found: ${localImagePath}`);
      skipped++;
      continue;
    }

    console.log(`📤 Uploading ${user.username}'s profile image from ${imageSource}...`);

    try {
      const result = await cloudinary.uploadImage(fullPath, {
        folder: 'zerohook/profiles',
        public_id: `profile-${user.username}-${Date.now()}`,
        transformation: [
          { width: 800, height: 800, crop: 'limit', quality: 'auto:good' }
        ]
      });

      if (!result.success) {
        console.error(`❌ Failed to upload ${user.username}'s image:`, result.error);
        errors++;
        continue;
      }

      const cloudinaryUrl = result.url;
      console.log(`   ✅ Uploaded: ${cloudinaryUrl}`);

      // Update database with Cloudinary URL
      const updatedProfileData = {
        ...profileData,
        photos: [cloudinaryUrl],
        profilePicture: cloudinaryUrl,
        profile_picture: {
          url: cloudinaryUrl,
          publicId: result.publicId,
          storageType: 'cloudinary',
          migratedFrom: localImagePath,
          migratedAt: new Date().toISOString()
        }
      };

      await query(`
        UPDATE users 
        SET profile_data = $1
        WHERE id = $2
      `, [JSON.stringify(updatedProfileData), user.id]);

      console.log(`   ✅ Database updated for ${user.username}`);
      migrated++;

    } catch (error) {
      console.error(`❌ Error migrating ${user.username}:`, error.message);
      errors++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Migrated: ${migrated}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log('='.repeat(50));

  process.exit(0);
}

// Run migration
migrateImages().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
