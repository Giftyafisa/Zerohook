require('dotenv').config({ path: './env.production' });

console.log('🔍 Environment Variables Test');
console.log('=============================');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET (hidden for security)' : 'NOT SET');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'SET (hidden for security)' : 'NOT SET');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('PORT:', process.env.PORT);
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'SET (hidden for security)' : 'NOT SET');

// Test database connection with current environment
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testConnection() {
  try {
    console.log('\n📡 Testing database connection...');
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    const result = await client.query('SELECT NOW() as current_time');
    console.log('📊 Current time:', result.rows[0].current_time);
    
    client.release();
    await pool.end();
    
    console.log('\n🎉 Environment test completed successfully!');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Error code:', error.code);
    process.exit(1);
  }
}

testConnection();
