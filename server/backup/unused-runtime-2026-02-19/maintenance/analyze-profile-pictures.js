const { query } = require('./config/database');

async function analyzeProfilePictures() {
  console.log('🔍 Analyzing profile picture status...\n');
  
  try {
    const result = await query(`
      SELECT 
        id,
        username,
        email,
        verification_tier,
        profile_data,
        created_at
      FROM users
      ORDER BY created_at ASC
    `);
    
    console.log(`Total users: ${result.rows.length}\n`);
    
    const withNewImages = [];
    const needsUpdate = [];
    
    result.rows.forEach(user => {
      const profileData = user.profile_data || {};
      const profilePicture = profileData.profilePicture || profileData.profile_picture || '';
      
      // Check if has recent upload (contains timestamp in filename)
      const hasNewImage = profilePicture.includes('profilePicture-');
      
      if (hasNewImage) {
        withNewImages.push(user.username);
      } else {
        needsUpdate.push({
          id: user.id,
          username: user.username,
          email: user.email,
          currentImage: profilePicture,
          tier: user.verification_tier
        });
      }
    });
    
    console.log(`✅ Users with new profile images: ${withNewImages.length}`);
    if (withNewImages.length > 0) {
      console.log(`   ${withNewImages.slice(0, 5).join(', ')}${withNewImages.length > 5 ? '...' : ''}\n`);
    }
    
    console.log(`🔄 Users needing profile image updates: ${needsUpdate.length}\n`);
    
    if (needsUpdate.length > 0) {
      console.log('Users to update:\n');
      needsUpdate.forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.username} (${user.email})`);
        console.log(`   Current: ${user.currentImage || 'none'}`);
        console.log(`   Tier: ${user.tier}\n`);
      });
    }
    
    // Export list for update script
    const fs = require('fs');
    fs.writeFileSync(
      'users-needing-updates.json',
      JSON.stringify(needsUpdate, null, 2)
    );
    console.log(`\n💾 Saved list to users-needing-updates.json`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

analyzeProfilePictures();
