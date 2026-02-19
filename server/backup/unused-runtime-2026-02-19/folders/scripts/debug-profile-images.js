/**
 * Debug profile images to find why some aren't displaying
 */
require('dotenv').config({ path: './env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://zerohook:11221122Ga@zerohook.cnyphi4.mongodb.net/zerohook?retryWrites=true&w=majority';

async function debugImages() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');
    
    const User = mongoose.connection.collection('users');
    
    // Check specific users from screenshot (Naomi, Sarah, Ama, Dorcas)
    console.log('=== CHECKING USERS FROM SCREENSHOT ===\n');
    
    const testUsers = await User.find({
      'profile_data.isTestAccount': true
    }).toArray();
    
    // Find Naomi, Sarah, Ama, Dorcas
    const targetNames = ['naomi', 'sarah', 'ama', 'dorcas'];
    
    for (const name of targetNames) {
      const user = testUsers.find(u => u.username.toLowerCase().includes(name));
      if (user) {
        console.log(`${user.username}:`);
        console.log(`  profilePicture: ${user.profile_data?.profilePicture || 'NULL'}`);
        console.log(`  profile_picture: ${typeof user.profile_data?.profile_picture === 'object' ? JSON.stringify(user.profile_data?.profile_picture).substring(0, 100) : user.profile_data?.profile_picture || 'NULL'}`);
        console.log(`  photos: ${user.profile_data?.photos?.length || 0} items`);
        if (user.profile_data?.photos?.[0]) {
          console.log(`  photos[0]: ${user.profile_data.photos[0].substring(0, 80)}`);
        }
        console.log('');
      }
    }
    
    // Count stats
    let withCloudinary = 0;
    let withLocal = 0;
    let withNone = 0;
    
    for (const user of testUsers) {
      const pic = user.profile_data?.profilePicture;
      if (pic && pic.includes('cloudinary')) {
        withCloudinary++;
      } else if (pic && pic.startsWith('/uploads')) {
        withLocal++;
      } else {
        withNone++;
        if (withNone <= 5) {
          console.log(`No image: ${user.username} - profilePicture: ${pic || 'undefined'}`);
        }
      }
    }
    
    console.log('\n=== STATS ===');
    console.log(`With Cloudinary: ${withCloudinary}`);
    console.log(`With Local: ${withLocal}`);
    console.log(`No Image: ${withNone}`);
    console.log(`Total test accounts: ${testUsers.length}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

debugImages();
