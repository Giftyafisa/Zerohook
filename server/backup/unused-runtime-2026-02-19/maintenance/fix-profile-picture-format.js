const { query } = require('./config/database');
const fs = require('fs');
const path = require('path');

const uploadsPath = path.join(__dirname, 'uploads');

async function fixProfilePictureFormat() {
  console.log('🔧 Fixing profile picture format to match upload process...\n');
  
  try {
    // Get all files in uploads directory
    const files = fs.readdirSync(uploadsPath);
    const profileFiles = files.filter(f => f.startsWith('profile-') && f.endsWith('.jpg'));
    
    console.log(`📁 Found ${profileFiles.length} profile images\n`);
    
    let updated = 0;
    
    for (const fileName of profileFiles) {
      const match = fileName.match(/^profile-(.+?)-\d+\.jpg$/);
      if (!match) continue;
      
      const username = match[1];
      const publicUrl = `/uploads/${fileName}`;
      const filePath = path.join(uploadsPath, fileName);
      const stats = fs.statSync(filePath);
      
      try {
        // Update using THE EXACT SAME format as the upload endpoint
        const updateResult = await query(`
          UPDATE users 
          SET profile_data = jsonb_set(
            jsonb_set(
              jsonb_set(
                COALESCE(profile_data, '{}'::jsonb), 
                '{profile_picture}', 
                $1::jsonb
              ),
              '{photos}',
              $2::jsonb
            ),
            '{profilePicture}',
            $3::jsonb
          )
          WHERE username = $4
          RETURNING username
        `, [
          JSON.stringify({ 
            url: publicUrl, 
            filename: fileName, 
            fileSize: stats.size, 
            mimeType: 'image/jpeg', 
            fileType: 'image' 
          }),
          JSON.stringify([publicUrl]),
          JSON.stringify(publicUrl),
          username
        ]);
        
        if (updateResult.rows.length > 0) {
          updated++;
          console.log(`✅ ${updated}. ${username} → ${publicUrl}`);
        }
        
      } catch (error) {
        console.error(`❌ ${username}:`, error.message);
      }
    }
    
    console.log(`\n✅ Updated ${updated} users with proper upload format\n`);
    
    // Verify
    const verifyResult = await query(`
      SELECT 
        username,
        profile_data->>'profilePicture' as pic,
        profile_data->'profile_picture' as pic_obj
      FROM users
      WHERE profile_data->>'profilePicture' LIKE '/uploads/profile-%'
      LIMIT 3
    `);
    
    console.log('📋 Verification:');
    verifyResult.rows.forEach(user => {
      console.log(`\n${user.username}:`);
      console.log(`  String: ${user.pic}`);
      console.log(`  Object: ${JSON.stringify(user.pic_obj, null, 2)}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

fixProfilePictureFormat();
