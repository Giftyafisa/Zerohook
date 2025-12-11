const { query } = require('./config/database');

async function addProfileVisibility() {
  try {
    console.log('🔧 Adding profile_visibility column to users table...\n');

    // Add profile_visibility column
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS profile_visibility VARCHAR(20) DEFAULT 'public'
    `);
    console.log('✅ profile_visibility column added');

    // Add check constraint for valid values
    try {
      await query(`
        ALTER TABLE users 
        ADD CONSTRAINT check_profile_visibility 
        CHECK (profile_visibility IN ('public', 'authenticated'))
      `);
      console.log('✅ Check constraint added');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('ℹ️  Check constraint already exists');
      } else {
        console.log('⚠️  Could not add constraint:', e.message);
      }
    }

    // Set all existing users to 'public'
    const updateResult = await query(`
      UPDATE users 
      SET profile_visibility = 'public'
      WHERE profile_visibility IS NULL OR profile_visibility = ''
    `);
    console.log(`✅ Set ${updateResult.rowCount} users to 'public' visibility`);

    // Verify
    const verifyResult = await query(`
      SELECT profile_visibility, COUNT(*) as count 
      FROM users 
      GROUP BY profile_visibility
    `);
    console.log('\n📊 Visibility distribution:');
    verifyResult.rows.forEach(row => {
      console.log(`   ${row.profile_visibility}: ${row.count} users`);
    });

    console.log('\n🎉 Profile visibility feature added!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addProfileVisibility();
