const { query } = require('./config/database');
const fs = require('fs');

// Diverse realistic profile image URLs (African-focused, professional quality)
const profileImages = [
  'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
  'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400',
  'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=400',
  'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400',
  'https://images.unsplash.com/photo-1506863530036-1efeddceb993?w=400',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400',
  'https://images.unsplash.com/photo-1515077678510-ce3bdf418862?w=400',
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400',
  'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?w=400',
  'https://images.unsplash.com/photo-1521119989659-a83eee488004?w=400',
  'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=400',
  'https://images.unsplash.com/photo-1524503033411-c9566986fc8f?w=400',
  'https://images.unsplash.com/photo-1525134479668-1bee5c7c6845?w=400',
  'https://images.unsplash.com/photo-1530268729831-4b0b9e170218?w=400',
  'https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=400',
  'https://images.unsplash.com/photo-1536164261511-3a17e671d380?w=400',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=400',
  'https://images.unsplash.com/photo-1541271696563-3be2f555fc4e?w=400',
  'https://images.unsplash.com/photo-1543965170-4c01a586684e?w=400',
  'https://images.unsplash.com/photo-1546539782-6fc531453083?w=400',
  'https://images.unsplash.com/photo-1551069613-1904dbdcda11?w=400',
  'https://images.unsplash.com/photo-1554727242-741c14fa561c?w=400',
  'https://images.unsplash.com/photo-1561677843-39dee7a319ca?w=400',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400',
  'https://images.unsplash.com/photo-1593104547489-5cfb3839a3b5?w=400',
  'https://images.unsplash.com/photo-1594744803329-e58b31de8bf5?w=400',
  'https://images.unsplash.com/photo-1600486913747-55e5470d6f40?w=400',
  'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=400',
  'https://images.unsplash.com/photo-1611432579699-484f7990b127?w=400',
  'https://images.unsplash.com/photo-1614283233556-f35b0c801ef1?w=400',
  'https://images.unsplash.com/photo-1619895862022-09114b41f16f?w=400',
  'https://images.unsplash.com/photo-1624298357597-fd92dfbec01d?w=400',
  'https://images.unsplash.com/photo-1628015081036-0747ec8f077a?w=400',
  'https://images.unsplash.com/photo-1632765854612-9b02b6ec2b15?w=400',
  'https://images.unsplash.com/photo-1635107510862-53886e926b74?w=400',
  'https://images.unsplash.com/photo-1651684215020-f7a5b6610f23?w=400',
  'https://images.unsplash.com/photo-1653669486915-3ffbec5a0659?w=400',
  'https://images.unsplash.com/photo-1665686304355-0b09b1e3b03c?w=400',
  'https://images.unsplash.com/photo-1667489911619-75477c685aac?w=400',
  'https://images.unsplash.com/photo-1669462277329-6644d6e03a60?w=400',
  'https://images.unsplash.com/photo-1671151268988-6c3b1ed72bf2?w=400',
  'https://images.unsplash.com/photo-1676319242566-0d0c9566c062?w=400',
  'https://images.unsplash.com/photo-1678495320545-4b5e1a22ef0a?w=400'
];

async function updateProviderProfiles() {
  console.log('🔄 Updating provider profiles with new images...\n');
  
  try {
    // Load users needing updates
    const usersToUpdate = JSON.parse(fs.readFileSync('users-needing-updates.json', 'utf8'));
    
    console.log(`Found ${usersToUpdate.length} users to update\n`);
    
    let updated = 0;
    let failed = 0;
    
    for (let i = 0; i < usersToUpdate.length; i++) {
      const user = usersToUpdate[i];
      
      // Skip users with Unsplash images (grace_elegant, amara_beauty)
      if (user.currentImage && user.currentImage.includes('unsplash')) {
        console.log(`⏭️  Skipping ${user.username} (already has Unsplash image)`);
        continue;
      }
      
      // Assign image based on index to ensure variety
      const imageUrl = profileImages[i % profileImages.length];
      
      try {
        // Get current profile_data
        const currentUser = await query(
          'SELECT profile_data FROM users WHERE id = $1',
          [user.id]
        );
        
        const profileData = currentUser.rows[0]?.profile_data || {};
        
        // Update both profilePicture and profile_picture for consistency
        profileData.profilePicture = imageUrl;
        profileData.profile_picture = imageUrl;
        
        // Add to photos array if not present
        if (!profileData.photos || !Array.isArray(profileData.photos)) {
          profileData.photos = [];
        }
        if (!profileData.photos.includes(imageUrl)) {
          profileData.photos.unshift(imageUrl);
        }
        
        // Update database
        await query(
          `UPDATE users 
           SET profile_data = $1,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [JSON.stringify(profileData), user.id]
        );
        
        updated++;
        console.log(`✅ ${updated}. Updated ${user.username} - ${imageUrl.substring(0, 50)}...`);
        
      } catch (error) {
        failed++;
        console.error(`❌ Failed to update ${user.username}:`, error.message);
      }
    }
    
    console.log(`\n📊 Update Summary:`);
    console.log(`   ✅ Successfully updated: ${updated}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   ⏭️  Skipped (already have images): ${usersToUpdate.length - updated - failed}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

updateProviderProfiles();
