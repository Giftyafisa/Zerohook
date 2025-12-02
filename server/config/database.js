require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? './env.production' : './env.local' });
const { Pool } = require('pg');
const Redis = require('redis');

// PostgreSQL connection - Optimized for Render.com free tier (may sleep after inactivity)
const isRenderDB = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'zerohook_db'}`,
  ssl: isRenderDB ? { rejectUnauthorized: false } : 
    (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),
  max: isRenderDB ? 5 : 20, // Lower pool size for free tier
  idleTimeoutMillis: isRenderDB ? 30000 : 60000, // 30s for Render, 60s otherwise
  connectionTimeoutMillis: isRenderDB ? 30000 : 10000, // 30s for Render (wake-up time)
  allowExitOnIdle: true, // Allow process to exit when pool is idle
});

// Handle pool errors gracefully
pool.on('error', (err, client) => {
  console.error('⚠️  Unexpected PostgreSQL pool error:', err.message);
});

console.log('🔧 Database configuration loaded:');
console.log('   Environment:', process.env.NODE_ENV);
console.log('   Using DATABASE_URL:', !!process.env.DATABASE_URL);
console.log('   Render.com detected:', process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com'));
console.log('   SSL enabled:', process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com') ? 'Yes (Render.com)' : (process.env.NODE_ENV === 'production' ? 'Yes (Production)' : 'No (Local)'));
console.log('   Connection string:', process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'zerohook_db'}`);

// Redis connection
const redisClient = Redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  retry_strategy: (times) => Math.min(times * 50, 2000)
});

const connectDB = async () => {
  try {
    await pool.connect();
    console.log('✅ PostgreSQL connected successfully');
    
    // Create tables if they don't exist
    try {
      await initializeTables();
    } catch (initError) {
      console.log('⚠️  Table initialization failed, but continuing with schema update...');
      console.log('   Error:', initError.message);
    }

    // Force update existing users table schema regardless of initialization status
    console.log('🔄 Force updating users table schema...');
    try {
      const client = await pool.connect();
      
      // Check if subscription columns exist
      const schemaCheck = await client.query(`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name IN ('is_subscribed', 'subscription_tier', 'subscription_expires_at')
      `);
      
      const existingColumns = schemaCheck.rows.map(row => row.column_name);
      
      // Add missing columns
      if (!existingColumns.includes('is_subscribed')) {
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN is_subscribed BOOLEAN DEFAULT false
        `);
        console.log('✅ Added is_subscribed column to users table');
      }
      
      if (!existingColumns.includes('subscription_tier')) {
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN subscription_tier VARCHAR(50) DEFAULT 'free'
        `);
        console.log('✅ Added subscription_tier column to users table');
      }
      
      if (!existingColumns.includes('subscription_expires_at')) {
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN subscription_expires_at TIMESTAMP
        `);
        console.log('✅ Added subscription_expires_at column to users table');
      }
      
      console.log('✅ Users table schema updated successfully');
      client.release();
    } catch (schemaError) {
      console.log('❌ Schema update failed:', schemaError.message);
    }
    
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    console.log('⚠️  Continuing without database for frontend testing...');
    // Don't throw error, allow server to start for frontend testing
    return false;
  }
};

const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log('✅ Redis connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.log('⚠️  Redis is optional - continuing without it');
    return false;
  }
};

const initializeTables = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Users table with verification tiers
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        verification_tier INTEGER DEFAULT 1,
        verification_data JSONB DEFAULT '{}',
        reputation_score DECIMAL(10,2) DEFAULT 100.0,
        trust_score DECIMAL(10,2) DEFAULT 0.0,
        profile_data JSONB DEFAULT '{}',
        wallet_address VARCHAR(255),
        is_subscribed BOOLEAN DEFAULT false,
        subscription_tier VARCHAR(50) DEFAULT 'free',
        subscription_expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active'
      )
    `);

    // Service categories and types
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        description TEXT,
        base_price DECIMAL(10,2) DEFAULT 0,
        duration_options JSONB DEFAULT '[]',
        verification_required INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Services/Listings
    await client.query(`
      CREATE TABLE IF NOT EXISTS services (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id UUID REFERENCES users(id) ON DELETE CASCADE,
        category_id UUID REFERENCES service_categories(id),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        duration_minutes INTEGER DEFAULT 60,
        location_type VARCHAR(20) DEFAULT 'flexible',
        location_data JSONB DEFAULT '{}',
        availability JSONB DEFAULT '{}',
        requirements JSONB DEFAULT '{}',
        media_urls JSONB DEFAULT '[]',
        status VARCHAR(20) DEFAULT 'active',
        views INTEGER DEFAULT 0,
        bookings INTEGER DEFAULT 0,
        rating DECIMAL(3,2) DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Transactions/Bookings
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        service_id UUID REFERENCES services(id),
        client_id UUID REFERENCES users(id),
        provider_id UUID REFERENCES users(id),
        amount DECIMAL(10,2) NOT NULL,
        escrow_address VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        scheduled_time TIMESTAMP,
        location_data JSONB DEFAULT '{}',
        verification_data JSONB DEFAULT '{}',
        dispute_data JSONB DEFAULT '{}',
        completion_proof JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);

    // Trust/Reputation events
    await client.query(`
      CREATE TABLE IF NOT EXISTS trust_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        event_type VARCHAR(50) NOT NULL,
        event_data JSONB NOT NULL,
        trust_delta DECIMAL(10,2) DEFAULT 0,
        reputation_delta DECIMAL(10,2) DEFAULT 0,
        transaction_id UUID REFERENCES transactions(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Reviews and ratings
    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID REFERENCES transactions(id),
        reviewer_id UUID REFERENCES users(id),
        reviewee_id UUID REFERENCES users(id),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        anonymous BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Fraud detection logs
    await client.query(`
      CREATE TABLE IF NOT EXISTS fraud_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        transaction_id UUID REFERENCES transactions(id),
        fraud_type VARCHAR(50) NOT NULL,
        confidence_score DECIMAL(5,4) NOT NULL,
        evidence JSONB NOT NULL,
        action_taken VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Chat conversations
    await client.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        participant1_id UUID REFERENCES users(id) ON DELETE CASCADE,
        participant2_id UUID REFERENCES users(id) ON DELETE CASCADE,
        last_message TEXT,
        last_message_time TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Chat messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        message_type VARCHAR(20) DEFAULT 'text',
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // File uploads
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

    // Escrow transactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS escrow_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        escrow_address VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Refund requests
    await client.query(`
      CREATE TABLE IF NOT EXISTS refund_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Verification requests
    await client.query(`
      CREATE TABLE IF NOT EXISTS verification_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        requested_tier INTEGER NOT NULL,
        document_type VARCHAR(50),
        document_number VARCHAR(100),
        document_images JSONB,
        reason TEXT,
        status VARCHAR(20) DEFAULT 'pending',
        admin_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert default service categories
    await client.query(`
      INSERT INTO service_categories (name, display_name, description, base_price, duration_options, verification_required) 
      VALUES 
        ('dgy', 'Dgy Services', 'Premium personal services', 100.00, '[30, 60, 120, 240]', 2),
        ('romans', 'Romans Experience', 'Authentic cultural experiences', 150.00, '[60, 120, 180]', 2),
        ('ridin', 'Ridin Adventures', 'Exciting adventure services', 80.00, '[45, 90, 180]', 1),
        ('bb_suk', 'Bb Suk Special', 'Exclusive premium offerings', 200.00, '[90, 180, 360]', 3)
      ON CONFLICT (name) DO NOTHING
    `);

    // Create subscription plans table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plan_name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        features JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Subscription plans table created');

    // Create subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        plan_id UUID REFERENCES subscription_plans(id) ON DELETE SET NULL,
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(3) NOT NULL,
        country_code VARCHAR(2),
        paystack_reference VARCHAR(255),
        status VARCHAR(20) DEFAULT 'pending',
        activated_at TIMESTAMP,
        expires_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Subscriptions table created');

    // Insert default subscription plan (skip if already exists)
    await client.query(`
      INSERT INTO subscription_plans (
        plan_name, description, price, currency, features
      ) VALUES (
        'Basic Access',
        'Full access to the Zerohook platform',
        20.00,
        'USD',
        '["Full platform access", "Browse services", "Create services", "Secure messaging", "Trust system", "24/7 support"]'
      )
      ON CONFLICT (plan_name) DO NOTHING;
    `);
    console.log('✅ Default subscription plan created');

    // Create calls table
    await client.query(`
      CREATE TABLE IF NOT EXISTS calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        caller_id UUID REFERENCES users(id) ON DELETE CASCADE,
        target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(10) NOT NULL CHECK (type IN ('audio', 'video')),
        status VARCHAR(20) NOT NULL DEFAULT 'calling' CHECK (status IN ('calling', 'connected', 'rejected', 'ended', 'missed')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        connected_at TIMESTAMP,
        ended_at TIMESTAMP,
        duration INTEGER, -- in seconds
        metadata JSONB -- for additional call data
      )
    `);
    console.log('✅ Calls table created');

    // Create indexes for calls table
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_calls_caller_id ON calls(caller_id);
      CREATE INDEX IF NOT EXISTS idx_calls_target_user_id ON calls(target_user_id);
      CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
      CREATE INDEX IF NOT EXISTS idx_calls_created_at ON calls(created_at);
    `);
    console.log('✅ Calls table indexes created');

    // Create user_presence table for online/offline status
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_presence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id)
      )
    `);
    console.log('✅ User presence table created');

    // Create user_sessions table for active sessions
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        socket_id VARCHAR(255),
        ip_address INET,
        user_agent TEXT,
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ User sessions table created');

    // Create user_activity_logs table for activity tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        action_type VARCHAR(100) NOT NULL,
        action_data JSONB DEFAULT '{}',
        ip_address INET,
        user_agent TEXT,
        response_time_ms INTEGER DEFAULT 0,
        success BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ User activity logs table created');

    // Create indexes for new tables
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON user_presence(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_presence_status ON user_presence(status);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);
      CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_activity_logs_action_type ON user_activity_logs(action_type);
      CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at);
    `);
    console.log('✅ New table indexes created');

    // Create api_performance_logs table for tracking API performance metrics
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_performance_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        endpoint VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        response_time_ms INTEGER NOT NULL,
        status_code INTEGER NOT NULL,
        request_size_bytes INTEGER DEFAULT 0,
        response_size_bytes INTEGER DEFAULT 0,
        ip_address INET,
        user_agent TEXT,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ API performance logs table created');

    // Create indexes for api_performance_logs
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_api_performance_logs_endpoint ON api_performance_logs(endpoint);
      CREATE INDEX IF NOT EXISTS idx_api_performance_logs_user_id ON api_performance_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_performance_logs_created_at ON api_performance_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_api_performance_logs_status_code ON api_performance_logs(status_code);
    `);
    console.log('✅ API performance logs indexes created');

    await client.query('COMMIT');
    console.log('✅ Database tables initialized successfully');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Track database availability
let dbAvailable = false;

// Helper functions
const query = async (text, params, retries = 3) => {
  // If database is known to be unavailable, fail fast
  if (!dbAvailable && retries === 3) {
    // Try once to check if it's back
    try {
      const client = await pool.connect();
      client.release();
      dbAvailable = true;
    } catch (e) {
      throw new Error('Database unavailable');
    }
  }
  
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(text, params);
    dbAvailable = true; // Mark as available on success
    return result;
  } catch (error) {
    // If it's a connection error and we have retries left, try again
    if (retries > 0 && (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.message.includes('Connection terminated') || error.message.includes('timeout'))) {
      console.log(`🔄 Database connection error, retrying... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      return query(text, params, retries - 1);
    }
    dbAvailable = false; // Mark as unavailable on persistent failure
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
};

const getClient = async () => {
  try {
    const client = await pool.connect();
    dbAvailable = true;
    return client;
  } catch (error) {
    dbAvailable = false;
    console.error('❌ Failed to get database client:', error.message);
    throw error;
  }
};

// Check if database is available
const isDatabaseAvailable = () => dbAvailable;

module.exports = {
  pool,
  redisClient,
  connectDB,
  connectRedis,
  query,
  getClient,
  isDatabaseAvailable
};