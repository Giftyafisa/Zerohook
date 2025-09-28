const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testProfileAPI() {
  console.log('🔍 Testing Profile API...\n');
  
  try {
    // Test database connection
    console.log('1. Testing database connection...');
    const connectionTest = await pool.query('SELECT NOW()');
    console.log('✅ Database connected:', connectionTest.rows[0]);
    
    // Get a test user for authentication
    console.log('\n2. Getting test user for authentication...');
    const userResult = await pool.query(`
      SELECT id, username, email, verification_tier, reputation_score, profile_data
      FROM users 
      WHERE username = 'akua_ghana'
      LIMIT 1
    `);
    
    if (userResult.rows.length === 0) {
      console.log('❌ No test user found');
      return;
    }
    
    const testUser = userResult.rows[0];
    console.log('✅ Test user found:', {
      id: testUser.id,
      username: testUser.username,
      email: testUser.email,
      verificationTier: testUser.verification_tier,
      trustScore: testUser.reputation_score
    });
    
    // Test profile data structure
    console.log('\n3. Testing profile data structure...');
    if (testUser.profile_data) {
      console.log('✅ Profile data exists with keys:', Object.keys(testUser.profile_data));
      console.log('📋 Sample profile data:');
      console.log('   First Name:', testUser.profile_data.firstName);
      console.log('   Last Name:', testUser.profile_data.lastName);
      console.log('   Age:', testUser.profile_data.age);
      console.log('   Location:', testUser.profile_data.location);
      console.log('   Base Price:', testUser.profile_data.basePrice);
      console.log('   Specializations:', testUser.profile_data.specializations);
    } else {
      console.log('❌ No profile data found');
    }
    
    // Test the profile query that the API uses
    console.log('\n4. Testing the profile query...');
    const profileQuery = await pool.query(`
      SELECT 
        id, username, email, verification_tier, 
        reputation_score, profile_data, 
        created_at, last_active
      FROM users 
      WHERE id = $1
    `, [testUser.id]);
    
    if (profileQuery.rows.length > 0) {
      const profile = profileQuery.rows[0];
      console.log('✅ Profile query successful');
      console.log('📋 Profile data:', {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        verificationTier: profile.verification_tier,
        trustScore: profile.reputation_score,
        hasProfileData: !!profile.profile_data,
        createdAt: profile.created_at,
        lastActive: profile.last_active
      });
    }
    
    console.log('\n🎉 Profile API test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  testProfileAPI();
}
