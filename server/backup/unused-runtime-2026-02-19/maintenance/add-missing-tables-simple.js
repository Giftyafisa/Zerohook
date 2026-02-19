const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

async function addMissingTables() {
  console.log('🔧 Adding missing tables for enhanced features...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    console.log('📡 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Check if user_connections table exists
    console.log('📋 Checking user_connections table...');
    const connectionsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_connections'
      )
    `);
    
    if (!connectionsCheck.rows[0].exists) {
      console.log('📋 Creating user_connections table...');
      await client.query(`
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
    console.log('📋 Checking blocked_users table...');
    const blockedCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'blocked_users'
      )
    `);
    
    if (!blockedCheck.rows[0].exists) {
      console.log('📋 Creating blocked_users table...');
      await client.query(`
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
    console.log('📋 Checking notifications table...');
    const notificationsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'notifications'
      )
    `);
    
    if (!notificationsCheck.rows[0].exists) {
      console.log('📋 Creating notifications table...');
      await client.query(`
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
    console.log('📋 Checking file_uploads table...');
    const uploadsCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'file_uploads'
      )
    `);
    
    if (!uploadsCheck.rows[0].exists) {
      console.log('📋 Creating file_uploads table...');
      await client.query(`
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

    // Create indexes for better performance
    console.log('📋 Creating performance indexes...');
    
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_user_connections_users ON user_connections(from_user_id, to_user_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_blocked_users ON blocked_users(blocker_id, blocked_id)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at)`);
      await client.query(`CREATE INDEX IF NOT EXISTS idx_file_uploads_user ON file_uploads(user_id, upload_type)`);
      console.log('✅ Performance indexes created');
    } catch (indexError) {
      console.log('⚠️  Some indexes already exist:', indexError.message);
    }

    console.log('\n🎉 Missing tables added successfully!');
    
    // List all tables
    const allTables = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    console.log('\n📋 Available tables:');
    allTables.rows.forEach(table => {
      console.log(`   - ${table.table_name}`);
    });

    client.release();
    await pool.end();
    
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
