const { query } = require('../config/database');

/**
 * Migration: Backfill photos array from profilePicture and profile_picture
 * Ensures all users have a consistent photos[] array for frontend compatibility
 */
async function backfillPhotosArray() {
  console.log('🔄 Starting photos array backfill migration...\n');
  
  try {
    // Step 1: Find users with profilePicture but no photos array
    console.log('Step 1: Finding users with profilePicture but no photos...');
    const result1 = await query(`
      UPDATE users
      SET profile_data = jsonb_set(
        profile_data,
        '{photos}',
        jsonb_build_array(profile_data->'profilePicture')
      )
      WHERE profile_data ? 'profilePicture'
        AND profile_data->>'profilePicture' IS NOT NULL
        AND profile_data->>'profilePicture' != ''
        AND (NOT profile_data ? 'photos' OR jsonb_array_length(profile_data->'photos') = 0)
      RETURNING username, profile_data->'photos' as photos
    `);
    console.log(`✅ Updated ${result1.rowCount} users from profilePicture\n`);
    
    // Step 2: Find users with profile_picture object but no photos array
    console.log('Step 2: Finding users with profile_picture object but no photos...');
    const result2 = await query(`
      UPDATE users
      SET profile_data = jsonb_set(
        profile_data,
        '{photos}',
        jsonb_build_array(profile_data->'profile_picture'->'url')
      )
      WHERE profile_data ? 'profile_picture'
        AND profile_data->'profile_picture' ? 'url'
        AND profile_data->'profile_picture'->>'url' IS NOT NULL
        AND profile_data->'profile_picture'->>'url' != ''
        AND (NOT profile_data ? 'photos' OR jsonb_array_length(profile_data->'photos') = 0)
      RETURNING username, profile_data->'photos' as photos
    `);
    console.log(`✅ Updated ${result2.rowCount} users from profile_picture object\n`);
    
    // Step 3: Verify the migration
    console.log('Step 3: Verifying migration results...');
    const verification = await query(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(*) FILTER (WHERE profile_data ? 'photos' AND jsonb_array_length(profile_data->'photos') > 0) as users_with_photos,
        COUNT(*) FILTER (WHERE profile_data ? 'profilePicture') as users_with_profilePicture,
        COUNT(*) FILTER (WHERE profile_data ? 'profile_picture') as users_with_profile_picture_obj
      FROM users
      WHERE profile_data IS NOT NULL
    `);
    
    const stats = verification.rows[0];
    console.log('📊 Final Statistics:');
    console.log(`  Total users with profile_data: ${stats.total_users}`);
    console.log(`  Users with photos array: ${stats.users_with_photos}`);
    console.log(`  Users with profilePicture: ${stats.users_with_profilepicture}`);
    console.log(`  Users with profile_picture object: ${stats.users_with_profile_picture_obj}`);
    
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    process.exit();
  }
}

// Run migration
backfillPhotosArray();
