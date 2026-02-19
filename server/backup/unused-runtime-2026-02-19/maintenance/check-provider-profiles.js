const { query } = require('./config/database');

async function checkProviderProfiles() {
  console.log('🔍 Checking provider user profiles...\n');
  
  try {
    // Get all users with their profile data
    const result = await query(`
      SELECT 
        id,
        username,
        email,
        profile_data,
        profile_picture,
        verification_tier,
        created_at
      FROM users
      ORDER BY created_at DESC
    `);
    
    console.log(`Total users found: ${result.rows.length}\n`);
    
    let withImages = 0;
    let withoutImages = 0;
    let needsUpdate = [];
    
    result.rows.forEach((user, index) => {
      const profileData = user.profile_data || {};
      const hasProfilePicture = user.profile_picture && user.profile_picture.trim() !== '';
      
      if (hasProfilePicture) {
        withImages++;
      } else {
        withoutImages++;
        needsUpdate.push({
          id: user.id,
          username: user.username,
          email: user.email,
          verificationTier: user.verification_tier,
          createdAt: user.created_at
        });
      }
    });
    
    console.log(`📊 Summary:`);
    console.log(`   Users with profile pictures: ${withImages}`);
    console.log(`   Users without profile pictures: ${withoutImages}\n`);
    
    if (needsUpdate.length > 0) {
      console.log(`🔄 Users needing profile picture updates:\n`);
      needsUpdate.forEach((user, index) => {
        console.log(`${index + 1}. ${user.username}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Tier: ${user.verificationTier}`);
        console.log(`   Created: ${new Date(user.createdAt).toLocaleDateString()}\n`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

checkProviderProfiles();
