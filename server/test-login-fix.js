const { Pool } = require('pg');

// Test database connection with SSL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://hkup_db_user:THb1eT6ufKx3Fsicu21BxDZXPoaQDEAq@dpg-d2kmi83e5dus7382r760-a.oregon-postgres.render.com/hkup_db?sslmode=require',
  ssl: { rejectUnauthorized: false }
});

async function testLoginSystem() {
  try {
    console.log('🔧 Testing login system...');
    
    // Test database connection
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Check if users table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('❌ Users table does not exist');
      return;
    }
    
    console.log('✅ Users table exists');
    
    // Check if test user exists
    const userCheck = await client.query(`
      SELECT id, username, email, password_hash, status 
      FROM users 
      WHERE email = 'akua.mensah@ghana.com'
    `);
    
    if (userCheck.rows.length === 0) {
      console.log('❌ Test user does not exist');
      console.log('📝 Creating test user...');
      
      const bcrypt = require('bcrypt');
      const hashedPassword = await bcrypt.hash('AkuaPass123!', 10);
      
      await client.query(`
        INSERT INTO users (username, email, password_hash, status, verification_tier)
        VALUES ('akua_mensah', 'akua.mensah@ghana.com', $1, 'active', 1)
      `, [hashedPassword]);
      
      console.log('✅ Test user created');
    } else {
      console.log('✅ Test user exists');
      console.log('   User:', userCheck.rows[0].username, userCheck.rows[0].email);
    }
    
    // Test login endpoint
    console.log('🔧 Testing login endpoint...');
    
    const axios = require('axios');
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'akua.mensah@ghana.com',
        password: 'AkuaPass123!'
      });
      
      console.log('✅ Login successful!');
      console.log('   Response:', response.data);
    } catch (error) {
      console.log('❌ Login failed:', error.response?.data || error.message);
    }
    
    client.release();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

testLoginSystem();
