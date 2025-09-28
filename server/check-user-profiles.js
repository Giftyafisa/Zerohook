const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkUserProfiles() {
  console.log('🔍 Checking user profile data...\n');
  
  try {
    const result = await pool.query(`
      SELECT 
        username,
        profile_data,
        verification_tier,
        reputation_score
      FROM users
      ORDER BY username
    `);
    
    console.log(`Found ${result.rows.length} users:\n`);
    
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username}`);
      console.log(`   Verification Tier: ${user.verification_tier}`);
      console.log(`   Trust Score: ${user.reputation_score}`);
      console.log(`   Profile Data Keys: ${Object.keys(user.profile_data || {}).join(', ') || 'None'}`);
      
      if (user.profile_data && Object.keys(user.profile_data).length > 0) {
        console.log(`   Profile Data:`, JSON.stringify(user.profile_data, null, 2));
      }
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  checkUserProfiles();
}
