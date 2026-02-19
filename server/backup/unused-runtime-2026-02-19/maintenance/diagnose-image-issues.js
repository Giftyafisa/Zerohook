const { query } = require('./config/database');
const fs = require('fs');
const path = require('path');

const uploadsPath = path.join(__dirname, 'uploads');

async function diagnoseImageIssues() {
  console.log('🔍 Diagnosing image display issues...\n');
  
  try {
    // Get users shown in screenshot: Ama, Adwoa, Araba, Sedinam
    const testUsers = ['ama_acheampong17', 'adwoa_agyeman51', 'araba_owusu78', 'sedinam_boateng14'];
    
    for (const username of testUsers) {
      const result = await query(`
        SELECT 
          username,
          profile_data->>'profilePicture' as pic_path,
          profile_data->'photos' as photos
        FROM users
        WHERE username = $1
      `, [username]);
      
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const picPath = user.pic_path;
        
        console.log(`\n📋 ${username}:`);
        console.log(`   DB Path: ${picPath}`);
        console.log(`   Photos: ${user.photos}`);
        
        if (picPath) {
          // Extract filename from path
          const filename = picPath.replace('/uploads/', '');
          const fullPath = path.join(uploadsPath, filename);
          
          // Check if file exists
          const exists = fs.existsSync(fullPath);
          console.log(`   File exists: ${exists ? '✅ YES' : '❌ NO'}`);
          
          if (exists) {
            const stats = fs.statSync(fullPath);
            const sizeKB = (stats.size / 1024).toFixed(2);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            console.log(`   File size: ${sizeKB} KB (${sizeMB} MB)`);
            console.log(`   Full path: ${fullPath}`);
          } else {
            console.log(`   Expected path: ${fullPath}`);
          }
        } else {
          console.log(`   ⚠️  No picture path in database`);
        }
      }
    }
    
    // Check all files in uploads and compare with database
    console.log(`\n\n📁 Files in uploads directory:`);
    const files = fs.readdirSync(uploadsPath);
    const profileFiles = files.filter(f => f.startsWith('profile-') && f.endsWith('.jpg'));
    
    console.log(`   Total profile images: ${profileFiles.length}`);
    
    // Show first 10
    console.log(`\n   Sample files:`);
    profileFiles.slice(0, 10).forEach((file, idx) => {
      const fullPath = path.join(uploadsPath, file);
      const stats = fs.statSync(fullPath);
      const sizeKB = (stats.size / 1024).toFixed(2);
      console.log(`   ${idx + 1}. ${file} (${sizeKB} KB)`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

diagnoseImageIssues();
