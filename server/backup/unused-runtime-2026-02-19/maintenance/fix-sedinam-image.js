const { query } = require('./config/database');

async function fixSedinamImage() {
  try {
    console.log('=== FIXING SEDINAM_BOATENG14 IMAGE FIELDS ===\n');
    
    // Get current data
    const current = await query(`
      SELECT profile_data FROM users WHERE email = 'sedinam_boateng14@example.com'
    `);
    
    if (current.rowCount === 0) {
      console.log('❌ User not found!');
      return;
    }
    
    const profileData = current.rows[0].profile_data;
    const newImageUrl = profileData.profile_picture?.url;
    
    if (!newImageUrl) {
      console.log('❌ No profile_picture.url found!');
      return;
    }
    
    console.log('Current state:');
    console.log('  photos[0]:', profileData.photos?.[0]);
    console.log('  profilePicture:', profileData.profilePicture);
    console.log('  profile_picture.url:', newImageUrl);
    
    console.log('\n🔧 Updating all three fields to:', newImageUrl);
    
    // Update all three fields to match
    const result = await query(`
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
        profile_data->'profile_picture'
      )
      WHERE email = 'sedinam_boateng14@example.com'
      RETURNING profile_data
    `, [
      JSON.stringify([newImageUrl]),
      JSON.stringify(newImageUrl)
    ]);
    
    const updated = result.rows[0].profile_data;
    
    console.log('\n✅ Updated successfully!');
    console.log('New state:');
    console.log('  photos[0]:', updated.photos?.[0]);
    console.log('  profilePicture:', updated.profilePicture);
    console.log('  profile_picture.url:', updated.profile_picture?.url);
    
    console.log('\n✅ All three fields now point to the same image!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

fixSedinamImage();
