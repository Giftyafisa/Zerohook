const { query } = require('./config/database');

async function fixMessagesTable() {
  try {
    console.log('🔧 Adding metadata column to messages table...');
    
    // Add metadata column if it doesn't exist
    await query(`
      ALTER TABLE messages 
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb
    `);
    
    console.log('✅ metadata column added to messages table');
    
    // Verify the column exists
    const checkResult = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'metadata'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ Verified: metadata column exists');
      console.log('   Type:', checkResult.rows[0].data_type);
    } else {
      console.log('❌ Warning: metadata column not found after addition');
    }
    
    console.log('🎉 Messages table fix complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error fixing messages table:', error.message);
    process.exit(1);
  }
}

fixMessagesTable();
