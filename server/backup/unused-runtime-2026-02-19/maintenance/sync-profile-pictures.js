const { query } = require('./config/database');
const fs = require('fs');
const path = require('path');

const uploadsPath = path.join(__dirname, 'uploads');

async function syncProfilePictures() {
  console.log('🔄 Syncing profile pictures with actual files...\n');
  
  try {
    // Get all files in uploads directory
    const files = fs.readdirSync(uploadsPath);
    const profileFiles = files.filter(f => f.startsWith('profile-') && f.endsWith('.jpg'));
    
    console.log(`📁 Found ${profileFiles.length} profile images in uploads folder\n`);
    
    let updated = 0;
    let notFound = 0;
    
    for (const file of profileFiles) {
      // Extract username from filename: profile-username-timestamp.jpg
      const match = file.match(/^profile-(.+?)-\d+\.jpg$/);
      if (!match) {
        console.log(`⚠️  Could not extract username from: ${file}`);
        continue;
      }
      
      const username = match[1];
      const imagePath = `/uploads/${file}`;
      
      try {
        // Update user's profile_data
        const result = await query(`
          UPDATE users
          SET profile_data = jsonb_set(
            jsonb_set(
              COALESCE(profile_data, '{}'::jsonb),
              '{profilePicture}',
              to_jsonb($1::text)
            ),
            '{photos}',
            jsonb_build_array($1::text)
          )
          WHERE username = $2
          RETURNING username
        `, [imagePath, username]);
        
        if (result.rows.length > 0) {
          updated++;
          console.log(`✅ ${updated}. Updated ${username} → ${imagePath}`);
        } else {
          notFound++;
          console.log(`⚠️  User not found: ${username}`);
        }
        
      } catch (error) {
        console.error(`❌ Error updating ${username}:`, error.message);
      }
    }
    
    console.log(`\n📊 Sync Summary:`);
    console.log(`   ✅ Successfully updated: ${updated} users`);
    console.log(`   ⚠️  Users not found: ${notFound}`);
    
    // Verify a few users
    console.log(`\n🔍 Verifying sample users...`);
    const verifyResult = await query(`
      SELECT username, profile_data->>'profilePicture' as pic
      FROM users
      WHERE profile_data->>'profilePicture' LIKE '/uploads/profile-%'
      LIMIT 5
    `);
    
    verifyResult.rows.forEach(user => {
      console.log(`   ${user.username}: ${user.pic}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

syncProfilePictures();
