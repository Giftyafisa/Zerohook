const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

async function fixChatSchema() {
  console.log('🔧 Fixing Chat System Schema...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    console.log('📡 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Fix 1: Add status field to conversations table
    console.log('📋 Fixing conversations table...');
    try {
      const statusCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'conversations' AND column_name = 'status'
      `);
      
      if (statusCheck.rows.length === 0) {
        await client.query(`
          ALTER TABLE conversations 
          ADD COLUMN status VARCHAR(20) DEFAULT 'active'
        `);
        console.log('   ✅ Added status field to conversations table');
      } else {
        console.log('   ✅ Status field already exists in conversations table');
      }
    } catch (error) {
      console.log(`   ⚠️  Conversations table fix: ${error.message}`);
    }
    
    // Fix 2: Add metadata field to messages table
    console.log('📋 Fixing messages table...');
    try {
      const metadataCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'metadata'
      `);
      
      if (metadataCheck.rows.length === 0) {
        await client.query(`
          ALTER TABLE messages 
          ADD COLUMN metadata JSONB DEFAULT '{}'
        `);
        console.log('   ✅ Added metadata field to messages table');
      } else {
        console.log('   ✅ Metadata field already exists in messages table');
      }
    } catch (error) {
      console.log(`   ⚠️  Messages table fix: ${error.message}`);
    }
    
    // Fix 3: Add message_type field to messages table if missing
    console.log('📋 Checking messages table for message_type...');
    try {
      const messageTypeCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'messages' AND column_name = 'message_type'
      `);
      
      if (messageTypeCheck.rows.length === 0) {
        await client.query(`
          ALTER TABLE messages 
          ADD COLUMN message_type VARCHAR(20) DEFAULT 'text'
        `);
        console.log('   ✅ Added message_type field to messages table');
      } else {
        console.log('   ✅ Message_type field already exists in messages table');
      }
    } catch (error) {
      console.log(`   ⚠️  Message type fix: ${error.message}`);
    }
    
    // Fix 4: Add indexes for better performance
    console.log('📋 Creating additional performance indexes...');
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_metadata ON messages USING GIN(metadata)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type)`);
      console.log('   ✅ Additional performance indexes created');
    } catch (error) {
      console.log(`   ⚠️  Index creation: ${error.message}`);
    }
    
    console.log('\n🎉 Chat system schema fixes completed!');
    
    // Verify the fixes
    console.log('\n🔍 Verifying fixes...');
    
    const conversationsStatus = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'conversations' AND column_name = 'status'
    `);
    
    const messagesMetadata = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'metadata'
    `);
    
    const messagesType = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'message_type'
    `);
    
    console.log(`   ✅ Conversations status field: ${conversationsStatus.rows.length > 0 ? 'Present' : 'Missing'}`);
    console.log(`   ✅ Messages metadata field: ${messagesMetadata.rows.length > 0 ? 'Present' : 'Missing'}`);
    console.log(`   ✅ Messages type field: ${messagesType.rows.length > 0 ? 'Present' : 'Missing'}`);
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Failed to fix chat schema:', error);
    throw error;
  }
}

// Run if this file is executed directly
if (require.main === module) {
  fixChatSchema()
    .then(() => {
      console.log('\n✅ Chat schema fix completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Chat schema fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixChatSchema };
