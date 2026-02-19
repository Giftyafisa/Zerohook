require('dotenv').config({ path: './env.local' });
const { Pool } = require('pg');

console.log('🔍 CHECKING SERVICE CATEGORIES SCHEMA');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  acquireTimeoutMillis: 30000,
  reapIntervalMillis: 1000,
  createTimeoutMillis: 30000,
  retryDelay: 1000,
  maxRetries: 5
});

const query = async (text, params) => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

const checkAndFixSchema = async () => {
  try {
    console.log('🔍 Checking service_categories table schema...');
    
    // Check what columns exist
    const columnsResult = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'service_categories'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Current columns in service_categories:');
    columnsResult.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

    // Check if the table exists and has data
    const countResult = await query('SELECT COUNT(*) as count FROM service_categories');
    console.log(`📊 service_categories table has ${countResult.rows[0].count} rows`);

    // Check services table schema
    console.log('\n🔍 Checking services table schema...');
    const servicesColumnsResult = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'services'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Current columns in services:');
    servicesColumnsResult.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
    });

    // Check if services table has category_id column
    const hasCategoryId = servicesColumnsResult.rows.some(col => col.column_name === 'category_id');
    console.log(`🔗 services table has category_id: ${hasCategoryId ? 'YES' : 'NO'}`);

    // Check if services table has provider_id column
    const hasProviderId = servicesColumnsResult.rows.some(col => col.column_name === 'provider_id');
    console.log(`🔗 services table has provider_id: ${hasProviderId ? 'YES' : 'NO'}`);

    // Check foreign key constraints
    console.log('\n🔍 Checking foreign key constraints...');
    const constraintsResult = await query(`
      SELECT 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name IN ('services', 'service_categories')
    `);
    
    console.log('🔗 Foreign key constraints:');
    constraintsResult.rows.forEach(constraint => {
      console.log(`   ${constraint.table_name}.${constraint.column_name} -> ${constraint.foreign_table_name}.${constraint.foreign_column_name}`);
    });

    console.log('\n🎉 Schema check completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
    console.error('🔍 Error details:', error);
    return false;
  } finally {
    await pool.end();
  }
};

// Execute the check
checkAndFixSchema().then(success => {
  if (success) {
    console.log('🚀 Schema check completed successfully!');
    process.exit(0);
  } else {
    console.log('❌ Schema check failed!');
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 Fatal error during schema check:', error);
  process.exit(1);
});



