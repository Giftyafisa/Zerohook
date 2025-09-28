require('dotenv').config({ path: './env.production' });
const { query } = require('./config/database');

async function checkTestUser() {
  try {
    console.log('🔍 Checking for test user: akua.mensah@ghana.com');
    
    const result = await query(
      'SELECT id, username, email, profile_data, verification_tier, reputation_score FROM users WHERE email = $1',
      ['akua.mensah@ghana.com']
    );
    
    if (result.rows.length > 0) {
      console.log('✅ Test user found:', JSON.stringify(result.rows[0], null, 2));
    } else {
      console.log('❌ Test user not found');
      
      // Check what users exist
      const allUsers = await query('SELECT username, email FROM users LIMIT 5');
      console.log('📋 Available users:', allUsers.rows);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit();
  }
}

checkTestUser();
