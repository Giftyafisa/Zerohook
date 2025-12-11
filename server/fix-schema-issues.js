const { query } = require('./config/database');

async function fixSchemaIssues() {
  try {
    console.log('🔧 Fixing database schema issues...\n');
    
    // 1. Add status column to conversations table
    console.log('📝 Adding status column to conversations table...');
    await query(`
      ALTER TABLE conversations 
      ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active'
    `);
    console.log('✅ conversations.status column added');
    
    // 2. Add is_typing column to user_presence table
    console.log('📝 Adding is_typing column to user_presence table...');
    await query(`
      ALTER TABLE user_presence 
      ADD COLUMN IF NOT EXISTS is_typing BOOLEAN DEFAULT false
    `);
    console.log('✅ user_presence.is_typing column added');
    
    // 3. Add typing_in_conversation_id for tracking where user is typing
    console.log('📝 Adding typing_in_conversation_id column to user_presence table...');
    await query(`
      ALTER TABLE user_presence 
      ADD COLUMN IF NOT EXISTS typing_in_conversation_id UUID
    `);
    console.log('✅ user_presence.typing_in_conversation_id column added');
    
    // Verify conversations table
    console.log('\n📊 Verifying conversations table:');
    const conversationsCheck = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'conversations'
      ORDER BY ordinal_position
    `);
    conversationsCheck.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });
    
    // Verify user_presence table
    console.log('\n📊 Verifying user_presence table:');
    const presenceCheck = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user_presence'
      ORDER BY ordinal_position
    `);
    presenceCheck.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n🎉 Schema fixes complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error fixing schema:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

fixSchemaIssues();
