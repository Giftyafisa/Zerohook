/**
 * Assign images from y77 and KSS folders to test provider profiles.
 *
 * Usage:
 *   node server/scripts/assign-test-provider-images.js
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

const uploadImageForUser = async (sourcePath, username, index) => {
  const safeUsername = username.replace(/[^a-z0-9_-]/gi, '_');
  const result = await cloudinary.uploadImage(sourcePath, {
    folder: 'zerohook/profiles/test-providers',
    public_id: `profile-${safeUsername}-${Date.now()}-${index}`,
    transformation: [
      { width: 800, height: 800, crop: 'limit', quality: 'auto:good' }
    ]
  });

  if (!result.success) {
    throw new Error(result.error || 'Cloudinary upload failed');
  }

  return result;
};

async function assignImages() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

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

    const providers = await User.find({
      'profile_data.accountType': 'provider',
      'profile_data.isTestAccount': true
    }).sort({ created_at: 1 });

    if (providers.length === 0) {
      console.log('❌ No test providers found to update.');
      return;
    }

    console.log(`👤 Found ${providers.length} test providers`);

    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      const imagePath = allImages[i % allImages.length];

      if (!imagePath || !fs.existsSync(imagePath)) {
        skipped++;
        continue;
      }

      const profileData = provider.profile_data || {};
      const uploadResult = await uploadImageForUser(imagePath, provider.username, i);
      const imageUrl = uploadResult.url;

      profileData.profilePicture = imageUrl;
      profileData.profile_picture = {
        url: imageUrl,
        filename: uploadResult.publicId,
        fileSize: uploadResult.bytes,
        mimeType: uploadResult.format ? `image/${uploadResult.format}` : 'image/jpeg',
        fileType: 'image',
        storageType: 'cloudinary',
        publicId: uploadResult.publicId
      };
      profileData.photos = Array.isArray(profileData.photos) ? profileData.photos : [];
      if (!profileData.photos.includes(imageUrl)) {
        profileData.photos.unshift(imageUrl);
      }

      provider.profile_data = profileData;
      await provider.save();

      updated++;
      console.log(`✅ Updated ${provider.username} with ${path.basename(imagePath)}`);
    }

    console.log('\n========================================');
    console.log(`✅ Updated: ${updated} providers`);
    console.log(`⏭️ Skipped: ${skipped}`);
    console.log('========================================');
  } catch (error) {
    console.error('❌ Error assigning images:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

assignImages();
