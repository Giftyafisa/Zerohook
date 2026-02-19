const { query } = require('./config/database');
require('dotenv').config({ path: './env.production' });

async function addMissingTables() {
  console.log('🔧 Adding missing tables for enhanced features...\n');
  
  try {
    // Check if user_connections table exists
    const connectionsCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_connections'
      )
    `);
    
    if (!connectionsCheck.rows[0].exists) {
      console.log('📋 Creating user_connections table...');
      await query(`
        CREATE TABLE IF NOT EXISTS user_connections (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          connection_type VARCHAR(50) NOT NULL DEFAULT 'contact_request',
          message TEXT,
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(from_user_id, to_user_id)
        )
      `);
      console.log('✅ user_connections table created');
    } else {
      console.log('✅ user_connections table already exists');
    }

    // Check if blocked_users table exists
    const blockedCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'blocked_users'
      )
    `);
    
    if (!blockedCheck.rows[0].exists) {
      console.log('📋 Creating blocked_users table...');
      await query(`
        CREATE TABLE IF NOT EXISTS blocked_users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
          blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
          reason TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(blocker_id, blocked_id)
        )
      `);
      console.log('✅ blocked_users table created');
    } else {
      console.log('✅ blocked_users table already exists');
    }

    // Check if notifications table exists
    const notificationsCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
      )
    `);
    
    if (!notificationsCheck.rows[0].exists) {
      console.log('📋 Creating notifications table...');
      await query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          data JSONB,
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ notifications table created');
    } else {
      console.log('✅ notifications table already exists');
    }

    // Check if file_uploads table exists
    const uploadsCheck = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'file_uploads'
      )
    `);
    
    if (!uploadsCheck.rows[0].exists) {
      console.log('📋 Creating file_uploads table...');
      await query(`
        CREATE TABLE IF NOT EXISTS file_uploads (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID REFERENCES users(id) ON DELETE CASCADE,
          service_id UUID REFERENCES services(id) ON DELETE SET NULL,
          file_name VARCHAR(255) NOT NULL,
          file_path TEXT NOT NULL,
          file_size BIGINT NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          upload_type VARCHAR(50) NOT NULL,
          status VARCHAR(20) DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✅ file_uploads table created');
    } else {
      console.log('✅ file_uploads table already exists');
    }

    // Check if conversations table has status field
    const conversationsCheck = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'conversations' AND column_name = 'status'
    `);
    
    if (conversationsCheck.rows.length === 0) {
      console.log('📋 Adding status field to conversations table...');
      await query(`
        ALTER TABLE conversations 
        ADD COLUMN status VARCHAR(20) DEFAULT 'active'
      `);
      console.log('✅ status field added to conversations table');
    } else {
      console.log('✅ conversations table already has status field');
    }

    // Check if messages table has metadata field
    const messagesCheck = await query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'messages' AND column_name = 'metadata'
    `);
    
    if (messagesCheck.rows.length === 0) {
      console.log('📋 Adding metadata field to messages table...');
      await query(`
        ALTER TABLE messages 
        ADD COLUMN metadata JSONB DEFAULT '{}'
      `);
      console.log('✅ metadata field added to messages table');
    } else {
      console.log('✅ messages table already has metadata field');
    }

    // Create indexes for better performance
    console.log('📋 Creating performance indexes...');
    
    try {
      await query(`CREATE INDEX IF NOT EXISTS idx_user_connections_users ON user_connections(from_user_id, to_user_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_blocked_users ON blocked_users(blocker_id, blocked_id)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_file_uploads_user ON file_uploads(user_id, upload_type)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status)`);
      await query(`CREATE INDEX IF NOT EXISTS idx_messages_metadata ON messages USING GIN(metadata)`);
      console.log('✅ Performance indexes created');
    } catch (indexError) {
      console.log('⚠️  Some indexes already exist:', indexError.message);
    }

    console.log('\n🎉 Missing tables added successfully!');
    console.log('\n📋 Summary of tables:');
    
    const allTables = await query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    allTables.rows.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });

  } catch (error) {
    console.error('❌ Failed to add missing tables:', error);
    throw error;
  }
}

// Run if this file is executed directly
if (require.main === module) {
  addMissingTables()
    .then(() => {
      console.log('\n✅ Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Script failed:', error);
      process.exit(1);
    });
}

module.exports = { addMissingTables };
