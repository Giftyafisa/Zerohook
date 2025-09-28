require('dotenv').config({ path: './env.local' });
const { Pool } = require('pg');

console.log('🔧 Checking services table structure...');

const testPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 10000,
});

async function checkTable() {
  try {
    console.log('🔄 Connecting to database...');
    const client = await testPool.connect();
    console.log('✅ Database connection successful!');
    
    // Check services table structure
    const columns = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'services'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Services table structure:');
    columns.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
    });
    
    // Check if table has data
    const countResult = await client.query('SELECT COUNT(*) FROM services');
    console.log(`📊 Table has ${countResult.rows[0].count} rows`);
    
    // Check a sample row
    if (parseInt(countResult.rows[0].count) > 0) {
      const sampleRow = await client.query('SELECT * FROM services LIMIT 1');
      console.log('📋 Sample row:');
      console.log(JSON.stringify(sampleRow.rows[0], null, 2));
    }
    
    client.release();
    await testPool.end();
    console.log('✅ Check completed successfully');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Error detail:', error.detail);
  }
}

checkTable();
