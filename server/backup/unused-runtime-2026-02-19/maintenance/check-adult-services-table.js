require('dotenv').config({ path: './env.local' });
const { Pool } = require('pg');

console.log('🔧 Checking adult_services table...');

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
    
    // Check if adult_services table exists
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'adult_services'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ adult_services table exists');
      
      // Check table structure
      const columns = await client.query(`
        SELECT column_name, data_type FROM information_schema.columns 
        WHERE table_name = 'adult_services'
        ORDER BY ordinal_position
      `);
      console.log('📋 Table structure:');
      columns.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
      
      // Check if table has data
      const countResult = await client.query('SELECT COUNT(*) FROM adult_services');
      console.log(`📊 Table has ${countResult.rows[0].count} rows`);
      
    } else {
      console.log('❌ adult_services table does not exist');
      
      // Check what tables exist
      const allTables = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name
      `);
      console.log('📋 Available tables:');
      allTables.rows.forEach(table => {
        console.log(`   - ${table.table_name}`);
      });
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
