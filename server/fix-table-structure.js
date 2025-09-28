require('dotenv').config({ path: './env.production' });
const { query } = require('./config/database');

async function fixTableStructure() {
  try {
    console.log('🔧 Fixing table structure...\n');
    
    // Add missing columns to user_sessions table
    console.log('📝 Adding missing columns to user_sessions table...');
    
    try {
      await query('ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS socket_id VARCHAR(255)');
      console.log('✅ Added socket_id column');
    } catch (error) {
      console.log('ℹ️  socket_id column already exists or error:', error.message);
    }
    
    try {
      await query('ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true');
      console.log('✅ Added is_active column');
    } catch (error) {
      console.log('ℹ️  is_active column already exists or error:', error.message);
    }
    
    try {
      await query('ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP');
      console.log('✅ Added expires_at column');
    } catch (error) {
      console.log('ℹ️  expires_at column already exists or error:', error.message);
    }
    
    // Add missing columns to user_presence table
    console.log('\n📝 Adding missing columns to user_presence table...');
    
    try {
      await query('ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS is_typing BOOLEAN DEFAULT false');
      console.log('✅ Added is_typing column');
    } catch (error) {
      console.log('ℹ️  is_typing column already exists or error:', error.message);
    }
    
    try {
      await query('ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS current_page VARCHAR(100)');
      console.log('✅ Added current_page column');
    } catch (error) {
      console.log('ℹ️  current_page column already exists or error:', error.message);
    }
    
    try {
      await query('ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS device_info JSONB');
      console.log('✅ Added device_info column');
    } catch (error) {
      console.log('ℹ️  device_info column already exists or error:', error.message);
    }
    
    try {
      await query('ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
      console.log('✅ Added updated_at column');
    } catch (error) {
      console.log('ℹ️  updated_at column already exists or error:', error.message);
    }
    
    console.log('\n✅ Table structure fixes completed!');
    
    // Verify the structure again
    console.log('\n🔍 Verifying updated table structure...');
    
    const sessionsResult = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'user_sessions' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Updated user_sessions table columns:');
    sessionsResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.column_name} (${row.data_type}) - Nullable: ${row.is_nullable} - Default: ${row.column_default || 'None'}`);
    });
    
  } catch (error) {
    console.error('❌ Error fixing table structure:', error.message);
  }
}

fixTableStructure()
  .then(() => {
    console.log('\n✅ Table structure fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Table structure fix failed:', error);
    process.exit(1);
  });


