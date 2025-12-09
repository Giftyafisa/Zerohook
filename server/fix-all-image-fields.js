const { query } = require('./config/database');

async function fixAllImageFields() {
  try {
    console.log('=== FIXING ALL INCONSISTENT IMAGE FIELDS ===\n');
    
    // Get all users with profile_data
    const result = await query(`
      SELECT 
        id,
        username,
        email,
        profile_data
      FROM users
      WHERE profile_data IS NOT NULL
    `);
    
    console.log(`Total users to check: ${result.rowCount}\n`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const user of result.rows) {
      const profileData = user.profile_data;
      
      // Determine the "source of truth" image URL
      // Priority: profile_picture.url > photos[0] > profilePicture
      let sourceUrl = null;
      let needsUpdate = false;
      
      const photosUrl = profileData.photos && Array.isArray(profileData.photos) && profileData.photos.length > 0 
        ? profileData.photos[0] 
        : null;
      const profilePictureUrl = profileData.profilePicture || null;
      const profilePictureObjUrl = profileData.profile_picture?.url || null;
      
      // Prefer uploaded images (start with /uploads/) over external URLs
      if (profilePictureObjUrl && profilePictureObjUrl.startsWith('/uploads/')) {
        sourceUrl = profilePictureObjUrl;
      } else if (photosUrl && photosUrl.startsWith('/uploads/')) {
        sourceUrl = photosUrl;
      } else if (profilePictureUrl && profilePictureUrl.startsWith('/uploads/')) {
        sourceUrl = profilePictureUrl;
      } else if (profilePictureObjUrl) {
        sourceUrl = profilePictureObjUrl;
      } else if (photosUrl) {
        sourceUrl = photosUrl;
      } else if (profilePictureUrl) {
        sourceUrl = profilePictureUrl;
      }
      
      if (!sourceUrl) {
        skippedCount++;
        continue; // No image at all
      }
      
      // Check if all three match
      const allMatch = (
        photosUrl === sourceUrl &&
        profilePictureUrl === sourceUrl &&
        profilePictureObjUrl === sourceUrl
      );
      
      if (allMatch) {
        skippedCount++;
        continue; // Already consistent
      }
      
      // Update to make all three fields consistent
      console.log(`Updating ${user.username}...`);
      console.log(`  Source URL: ${sourceUrl}`);
      
      await query(`
        UPDATE users 
        SET profile_data = jsonb_set(
          jsonb_set(
            jsonb_set(
              profile_data,
              '{photos}',
              $1::jsonb
            ),
            '{profilePicture}',
            $2::jsonb
          ),
          '{profile_picture}',
          $3::jsonb
        )
        WHERE id = $4
      `, [
        JSON.stringify([sourceUrl]),
        JSON.stringify(sourceUrl),
        JSON.stringify({
          url: sourceUrl,
          fileType: 'image'
        }),
        user.id
      ]);
      
      updatedCount++;
    }
    
    console.log(`\n✅ Migration complete!`);
    console.log(`   Updated: ${updatedCount} users`);
    console.log(`   Skipped: ${skippedCount} users (already consistent or no image)`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

fixAllImageFields();
