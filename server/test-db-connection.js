require('dotenv').config({ path: './env.local' });
const { Pool } = require('pg');

console.log('🔧 Testing database connection...');
console.log('   Environment:', process.env.NODE_ENV);
console.log('   DATABASE_URL exists:', !!process.env.DATABASE_URL);

// Create a test pool
const testPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 10000,
});

async function testConnection() {
  try {
    console.log('🔄 Attempting to connect...');
    const client = await testPool.connect();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Query test successful:', result.rows[0]);
    
    // Check if service_categories table exists
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'service_categories'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ service_categories table exists');
      
      // Check table structure
      const columns = await client.query(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'service_categories'
        ORDER BY ordinal_position
      `);
      console.log('📋 Table structure:');
      columns.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('❌ service_categories table does not exist');
    }
    
    client.release();
    await testPool.end();
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error detail:', error.detail);
  }
}

testConnection();
