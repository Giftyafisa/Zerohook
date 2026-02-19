console.log('🚀 Starting simple database test...');

const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

console.log('🔧 Environment loaded');
console.log('📡 Database URL:', process.env.DATABASE_URL ? 'Found' : 'Missing');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function testDB() {
  try {
    console.log('📡 Attempting connection...');
    const client = await pool.connect();
    console.log('✅ Connected to database!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as time');
    console.log('⏰ Database time:', result.rows[0].time);
    
    client.release();
    await pool.end();
    console.log('🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
}

testDB();
