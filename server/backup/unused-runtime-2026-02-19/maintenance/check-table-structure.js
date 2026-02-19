require('dotenv').config({ path: './env.production' });
const { query } = require('./config/database');

async function checkTableStructure() {
  try {
    console.log('🔍 Checking user_sessions table structure...\n');
    
    const result = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_sessions' 
      ORDER BY ordinal_position
    `);
    
    console.log('📊 user_sessions table columns:');
    result.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.column_name} (${row.data_type}) - Nullable: ${row.is_nullable} - Default: ${row.column_default || 'None'}`);
    });
    
    console.log('\n🔍 Checking user_presence table structure...\n');
    
    const presenceResult = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_presence' 
      ORDER BY ordinal_position
    `);
    
    console.log('📊 user_presence table columns:');
    presenceResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.column_name} (${row.data_type}) - Nullable: ${row.is_nullable} - Default: ${row.column_default || 'None'}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking table structure:', error.message);
  }
}

checkTableStructure()
  .then(() => {
    console.log('\n✅ Table structure check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Table structure check failed:', error);
    process.exit(1);
  });


