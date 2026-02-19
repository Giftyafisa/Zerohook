const { query } = require('./config/database');

async function checkUsersTable() {
  console.log('🔍 Checking users table structure...\n');
  
  try {
    // Get column information
    const columns = await query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    
    console.log('Users table columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    console.log('\n📊 Sample user data:\n');
    
    // Get sample users
    const users = await query(`
      SELECT id, username, email, verification_tier, profile_data
      FROM users
      LIMIT 3
    `);
    
    users.rows.forEach(user => {
      console.log(`User: ${user.username}`);
      console.log(`  Profile data keys: ${Object.keys(user.profile_data || {}).join(', ')}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkUsersTable();
