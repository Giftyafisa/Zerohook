const mongoose = require('mongoose');
const { connectDB, User } = require('../config/database');

/**
 * Migration: Backfill photos array from profilePicture and profile_picture
 * Ensures all users have a consistent photos[] array for frontend compatibility
 */
async function backfillPhotosArray() {
  console.log('🔄 Starting photos array backfill migration...\n');
  
  try {
    await connectDB();

    // Step 1: profilePicture string -> photos[]
    console.log('Step 1: Backfilling from profilePicture...');
    const usersWithProfilePicture = await User.find({
      'profile_data.profilePicture': { $type: 'string', $ne: '' },
      $or: [
        { 'profile_data.photos': { $exists: false } },
        { 'profile_data.photos.0': { $exists: false } }
      ]
    }).select('_id profile_data.profilePicture').lean();

    if (usersWithProfilePicture.length > 0) {
      const bulk1 = usersWithProfilePicture.map((u) => ({
        updateOne: {
          filter: { _id: u._id },
          update: { $set: { 'profile_data.photos': [u.profile_data.profilePicture] } }
        }
      }));
      await User.bulkWrite(bulk1);
    }
    console.log(`✅ Updated ${usersWithProfilePicture.length} users from profilePicture\n`);

    // Step 2: profile_picture.url object -> photos[]
    console.log('Step 2: Backfilling from profile_picture.url...');
    const usersWithProfilePictureObj = await User.find({
      'profile_data.profile_picture.url': { $type: 'string', $ne: '' },
      $or: [
        { 'profile_data.photos': { $exists: false } },
        { 'profile_data.photos.0': { $exists: false } }
      ]
    }).select('_id profile_data.profile_picture.url').lean();

    if (usersWithProfilePictureObj.length > 0) {
      const bulk2 = usersWithProfilePictureObj.map((u) => ({
        updateOne: {
          filter: { _id: u._id },
          update: { $set: { 'profile_data.photos': [u.profile_data.profile_picture.url] } }
        }
      }));
      await User.bulkWrite(bulk2);
    }
    console.log(`✅ Updated ${usersWithProfilePictureObj.length} users from profile_picture object\n`);

    // Step 3: Verify the migration
    console.log('Step 3: Verifying migration results...');
    const [totalUsers, usersWithPhotos, usersWithProfilePicture, usersWithProfilePictureObj] = await Promise.all([
      User.countDocuments({ profile_data: { $exists: true } }),
      User.countDocuments({ 'profile_data.photos.0': { $exists: true } }),
      User.countDocuments({ 'profile_data.profilePicture': { $exists: true } }),
      User.countDocuments({ 'profile_data.profile_picture': { $exists: true } })
    ]);

    console.log('📊 Final Statistics:');
    console.log(`  Total users with profile_data: ${totalUsers}`);
    console.log(`  Users with photos array: ${usersWithPhotos}`);
    console.log(`  Users with profilePicture: ${usersWithProfilePicture}`);
    console.log(`  Users with profile_picture object: ${usersWithProfilePictureObj}`);
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    process.exit();
  }
}

// Run migration
backfillPhotosArray();
