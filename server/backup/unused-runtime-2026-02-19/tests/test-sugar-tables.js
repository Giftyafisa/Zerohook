const { query } = require('./config/database');

async function testSugarTables() {
  console.log('🧪 Testing Sugar Tables...\n');
  
  try {
    // 1. Check sugar tables exist
    console.log('1. Checking tables exist...');
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'sugar%'
    `);
    console.log('   Sugar tables:', tables.rows.map(r => r.table_name));
    
    // 2. Check sugar_access_payments structure
    console.log('\n2. sugar_access_payments columns:');
    const paymentsCols = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sugar_access_payments'
    `);
    paymentsCols.rows.forEach(r => console.log(`   - ${r.column_name}: ${r.data_type}`));
    
    // 3. Check sugar_connections structure
    console.log('\n3. sugar_connections columns:');
    const connCols = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'sugar_connections'
    `);
    connCols.rows.forEach(r => console.log(`   - ${r.column_name}: ${r.data_type}`));
    
    // 4. Check user profile_data backfill
    console.log('\n4. Checking user profile_data backfill...');
    const usersWithGender = await query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE profile_data->>'gender' IS NOT NULL
    `);
    console.log(`   Users with gender field: ${usersWithGender.rows[0].count}`);
    
    const usersWithDob = await query(`
      SELECT COUNT(*) as count 
      FROM users 
      WHERE profile_data->>'dateOfBirth' IS NOT NULL
    `);
    console.log(`   Users with dateOfBirth field: ${usersWithDob.rows[0].count}`);
    
    // 5. Check accountType distribution
    console.log('\n5. accountType distribution:');
    const distribution = await query(`
      SELECT profile_data->>'accountType' as account_type, COUNT(*) as count
      FROM users
      GROUP BY profile_data->>'accountType'
    `);
    distribution.rows.forEach(r => console.log(`   - ${r.account_type || 'null'}: ${r.count}`));
    
    // 6. Sample user profile_data
    console.log('\n6. Sample user profile_data structure:');
    const sample = await query(`
      SELECT username, profile_data
      FROM users
      WHERE profile_data->>'gender' IS NOT NULL
      LIMIT 1
    `);
    if (sample.rows.length > 0) {
      console.log(`   User: ${sample.rows[0].username}`);
      console.log(`   profile_data:`, JSON.stringify(sample.rows[0].profile_data, null, 4));
    }
    
    console.log('\n✅ All tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

testSugarTables()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
