const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testProfilesQuery() {
  console.log('🔍 Testing profiles query...\n');
  
  try {
    // Test basic connection
    console.log('1. Testing database connection...');
    const connectionTest = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', connectionTest.rows[0]);
    
    // Test users table structure
    console.log('\n2. Checking users table structure...');
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    console.log('📋 Users table columns:');
    tableInfo.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Test basic users query
    console.log('\n3. Testing basic users query...');
    const basicQuery = await pool.query('SELECT COUNT(*) FROM users');
    console.log('✅ Total users:', basicQuery.rows[0].count);
    
    // Test profile_data query
    console.log('\n4. Testing profile_data query...');
    const profileQuery = await pool.query('SELECT COUNT(*) FROM users WHERE profile_data IS NOT NULL');
    console.log('✅ Users with profile_data:', profileQuery.rows[0].count);
    
    // Test the actual profiles query
    console.log('\n5. Testing the actual profiles query...');
    const profilesQuery = await pool.query(`
      SELECT 
        u.id,
        u.username,
        u.email,
        u.profile_data,
        u.verification_tier,
        u.reputation_score,
        u.created_at,
        COALESCE(u.last_active, u.created_at) as last_active
      FROM users u
      WHERE u.profile_data IS NOT NULL
      ORDER BY u.created_at DESC
      LIMIT 5
    `);
    
    console.log('✅ Profiles query successful, found:', profilesQuery.rows.length, 'profiles');
    if (profilesQuery.rows.length > 0) {
      console.log('\n📋 Sample profile:');
      const sample = profilesQuery.rows[0];
      console.log(`   Username: ${sample.username}`);
      console.log(`   Email: ${sample.email}`);
      console.log(`   Verification Tier: ${sample.verification_tier}`);
      console.log(`   Trust Score: ${sample.reputation_score}`);
      console.log(`   Created: ${sample.created_at}`);
      console.log(`   Last Active: ${sample.last_active}`);
      console.log(`   Profile Data Keys:`, Object.keys(sample.profile_data || {}));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testProfilesQuery();
}
