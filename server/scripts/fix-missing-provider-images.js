/**
 * Re-assign images to test providers that are missing profile pictures.
 * This continues from where the previous script left off.
 *
 * Usage:
 *   node server/scripts/fix-missing-provider-images.js
 */

require('dotenv').config({ path: './env.local' });
const fs = require('fs');
const path = require('path');
const { mongoose, User } = require('../config/database');
const CloudinaryManager = require('../services/CloudinaryManager');

const MONGODB_URI = process.env.MONGODB_URI ||
  'mongodb+srv://zerohook:11221122Ga@zerohook.cnyphi4.mongodb.net/zerohook?retryWrites=true&w=majority';

const y77Dir = 'C:\\Users\\aship\\Desktop\\Hookup\\y77';
const kssDir = 'C:\\Users\\aship\\Desktop\\Hookup\\KSS';
const cloudinary = new CloudinaryManager();

const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const listImages = (dirPath) => {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter(name => imageExtensions.has(path.extname(name).toLowerCase()))
    .map(name => path.join(dirPath, name));
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const uploadImageForUser = async (sourcePath, userId, index) => {
  const result = await cloudinary.uploadImage(sourcePath, {
    folder: 'zerohook/profiles/test-providers',
    public_id: `profile-${userId}-${Date.now()}`,
    transformation: [
      { width: 800, height: 800, crop: 'limit', quality: 'auto:good' }
    ]
  });

  if (!result.success) {
    throw new Error(result.error || 'Cloudinary upload failed');
  }

  return result;
};

async function fixMissingImages() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    if (!cloudinary.isConfigured) {
      console.error('❌ Cloudinary is not configured. Set CLOUDINARY_API_SECRET in env.local');
      return;
    }

    const y77Images = listImages(y77Dir);
    const kssImages = listImages(kssDir);
    const allImages = [...y77Images, ...kssImages];

    if (allImages.length === 0) {
      console.log('❌ No images found in y77 or KSS folders.');
      return;
    }

    console.log(`📸 Found ${allImages.length} images (y77: ${y77Images.length}, KSS: ${kssImages.length})`);

    // Find providers WITHOUT profile pictures
    const providersWithoutImages = await User.find({
      'profile_data.accountType': 'provider',
      'profile_data.isTestAccount': true,
      $or: [
        { 'profile_data.profilePicture': { $exists: false } },
        { 'profile_data.profilePicture': null },
        { 'profile_data.profilePicture': '' }
      ]
    }).sort({ created_at: 1 });

    console.log(`👤 Found ${providersWithoutImages.length} providers WITHOUT images\n`);

    if (providersWithoutImages.length === 0) {
      console.log('✅ All test providers already have images!');
      return;
    }

    let updated = 0;
    let failed = 0;

    for (let i = 0; i < providersWithoutImages.length; i++) {
      const provider = providersWithoutImages[i];
      const imagePath = allImages[i % allImages.length];

      try {
        console.log(`[${i + 1}/${providersWithoutImages.length}] Uploading for ${provider.username}...`);
        
        const uploadResult = await uploadImageForUser(imagePath, provider._id, i);
        const imageUrl = uploadResult.url;

        // Update provider profile
        const profileData = provider.profile_data || {};
        profileData.profilePicture = imageUrl;
        profileData.profile_picture = {
          url: imageUrl,
          filename: uploadResult.publicId,
          fileSize: uploadResult.bytes || 0,
          mimeType: uploadResult.format ? `image/${uploadResult.format}` : 'image/jpeg',
          fileType: 'image',
          storageType: 'cloudinary',
          publicId: uploadResult.publicId
        };
        profileData.photos = Array.isArray(profileData.photos) ? profileData.photos : [];
        if (!profileData.photos.includes(imageUrl)) {
          profileData.photos.unshift(imageUrl);
        }

        await User.updateOne(
          { _id: provider._id },
          { $set: { profile_data: profileData } }
        );

        updated++;
        console.log(`   ✅ Updated with ${path.basename(imagePath)}`);
        
        // Add small delay to avoid rate limiting
        await delay(500);
        
      } catch (error) {
        failed++;
        console.log(`   ❌ Failed: ${error.message}`);
        // Continue with next user
        await delay(1000);
      }
    }

    console.log('\n========================================');
    console.log(`✅ Updated: ${updated} providers`);
    console.log(`❌ Failed: ${failed}`);
    console.log('========================================');

    // Final verification
    const finalCount = await User.countDocuments({
      'profile_data.accountType': 'provider',
      'profile_data.isTestAccount': true,
      'profile_data.profilePicture': { $regex: /cloudinary/ }
    });
    console.log(`\n🔍 Final count with Cloudinary images: ${finalCount}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

fixMissingImages();
