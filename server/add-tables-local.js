/**
 * Add Missing Tables to Zerohook Database (Local Config)
 * Creates user_connections, blocked_users, notifications, adult_services tables
 */

require('dotenv').config({ path: './env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const missingTables = [
  {
    name: 'user_connections',
    sql: `
      CREATE TABLE IF NOT EXISTS user_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        connection_type VARCHAR(50) DEFAULT 'contact_request',
        message TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(from_user_id, to_user_id)
      )
    `
  },
  {
    name: 'blocked_users',
    sql: `
      CREATE TABLE IF NOT EXISTS blocked_users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(blocker_id, blocked_id)
      )
    `
  },
  {
    name: 'notifications',
    sql: `
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255),
        message TEXT,
        data JSONB,
        read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  {
    name: 'adult_services',
    sql: `
      CREATE TABLE IF NOT EXISTS adult_services (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        subcategory VARCHAR(100),
        price DECIMAL(10, 2),
        currency VARCHAR(10) DEFAULT 'NGN',
        duration_minutes INTEGER,
        location_type VARCHAR(50) DEFAULT 'flexible',
        location_data JSONB,
        requirements JSONB,
        availability JSONB,
        images TEXT[],
        is_active BOOLEAN DEFAULT true,
        is_verified BOOLEAN DEFAULT false,
        verification_status VARCHAR(50) DEFAULT 'pending',
        rating_average DECIMAL(3, 2) DEFAULT 0,
        total_reviews INTEGER DEFAULT 0,
        total_bookings INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  },
  {
    name: 'bookings',
    sql: `
      CREATE TABLE IF NOT EXISTS bookings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service_id UUID REFERENCES adult_services(id) ON DELETE SET NULL,
        client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        scheduled_time TIMESTAMP,
        duration_minutes INTEGER,
        price DECIMAL(10, 2),
        currency VARCHAR(10) DEFAULT 'NGN',
        location_data JSONB,
        notes TEXT,
        cancellation_reason TEXT,
        escrow_id UUID REFERENCES escrow_transactions(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `
  }
];

const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_user_connections_from ON user_connections(from_user_id)',
  'CREATE INDEX IF NOT EXISTS idx_user_connections_to ON user_connections(to_user_id)',
  'CREATE INDEX IF NOT EXISTS idx_user_connections_status ON user_connections(status)',
  'CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id)',
  'CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read)',
  'CREATE INDEX IF NOT EXISTS idx_adult_services_provider ON adult_services(provider_id)',
  'CREATE INDEX IF NOT EXISTS idx_adult_services_category ON adult_services(category)',
  'CREATE INDEX IF NOT EXISTS idx_adult_services_active ON adult_services(is_active)',
  'CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id)',
  'CREATE INDEX IF NOT EXISTS idx_bookings_provider ON bookings(provider_id)',
  'CREATE INDEX IF NOT EXISTS idx_bookings_service ON bookings(service_id)'
];

async function addMissingTables() {
  console.log('🚀 Adding missing tables to Zerohook database...\n');

  try {
    // Create tables
    for (const table of missingTables) {
      try {
        await pool.query(table.sql);
        console.log(`✅ Created table: ${table.name}`);
      } catch (error) {
        if (error.code === '42P07') {
          console.log(`ℹ️  Table already exists: ${table.name}`);
        } else {
          console.error(`❌ Error creating ${table.name}:`, error.message);
        }
      }
    }

    console.log('\n📇 Creating indexes...');
    
    // Create indexes
    for (const indexSql of indexes) {
      try {
        await pool.query(indexSql);
        const indexName = indexSql.match(/idx_\w+/)?.[0] || 'index';
        console.log(`✅ Created index: ${indexName}`);
      } catch (error) {
        console.error(`❌ Index error:`, error.message);
      }
    }

    // Verify tables
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('\n📋 Current tables in database:');
    result.rows.forEach(row => console.log('  -', row.table_name));
    console.log('\n📊 Total:', result.rows.length, 'tables');

    console.log('\n🎉 Missing tables added successfully!');

  } catch (error) {
    console.error('Fatal error:', error);
  } finally {
    await pool.end();
  }
}

addMissingTables();
