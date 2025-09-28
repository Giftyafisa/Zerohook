require('dotenv').config({ path: './env.production' });
const { query } = require('./config/database');

async function setupUserMonitoringTables() {
  try {
    console.log('🚀 Setting up user monitoring and performance tracking tables...');

    // 1. Create user_sessions table
    await query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        socket_id VARCHAR(255),
        ip_address INET,
        user_agent TEXT,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ User sessions table created');

    // 2. Create user_activity_logs table
    await query(`
      CREATE TABLE IF NOT EXISTS user_activity_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        action_type VARCHAR(50) NOT NULL,
        action_data JSONB,
        ip_address INET,
        user_agent TEXT,
        response_time_ms INTEGER,
        success BOOLEAN DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ User activity logs table created');

    // 3. Create user_presence table
    await query(`
      CREATE TABLE IF NOT EXISTS user_presence (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'offline',
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_typing BOOLEAN DEFAULT false,
        current_page VARCHAR(100),
        device_info JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ User presence table created');

    // 4. Create performance_metrics table
    await query(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        metric_type VARCHAR(50) NOT NULL,
        metric_name VARCHAR(100) NOT NULL,
        value DECIMAL(10,4) NOT NULL,
        unit VARCHAR(20),
        metadata JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Performance metrics table created');

    // 5. Create api_performance_logs table
    await query(`
      CREATE TABLE IF NOT EXISTS api_performance_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        endpoint VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        response_time_ms INTEGER NOT NULL,
        status_code INTEGER NOT NULL,
        request_size_bytes INTEGER,
        response_size_bytes INTEGER,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ API performance logs table created');

    // 6. Create user_engagement_metrics table
    await query(`
      CREATE TABLE IF NOT EXISTS user_engagement_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        engagement_score DECIMAL(5,2) DEFAULT 0.00,
        daily_active_minutes INTEGER DEFAULT 0,
        weekly_active_days INTEGER DEFAULT 0,
        monthly_active_days INTEGER DEFAULT 0,
        last_engagement_date DATE,
        engagement_trend VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ User engagement metrics table created');

    // 7. Create user_engagement_events table
    await query(`
      CREATE TABLE IF NOT EXISTS user_engagement_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        event_value INTEGER DEFAULT 1,
        event_metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ User engagement events table created');

    // 8. Create system_alerts table
    await query(`
      CREATE TABLE IF NOT EXISTS system_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB,
        is_resolved BOOLEAN DEFAULT false,
        resolved_at TIMESTAMP,
        resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ System alerts table created');

    // 9. Create alert_subscriptions table
    await query(`
      CREATE TABLE IF NOT EXISTS alert_subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        alert_type VARCHAR(50) NOT NULL,
        notification_method VARCHAR(20) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Alert subscriptions table created');

    // Create performance optimization indexes
    console.log('🔧 Creating performance indexes...');
    
    await query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON user_sessions(is_active, expires_at);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON user_activity_logs(user_id, created_at);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_user_presence_status ON user_presence(status, last_seen);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_api_performance_logs_endpoint ON api_performance_logs(endpoint, created_at);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_user_engagement_metrics_score ON user_engagement_metrics(engagement_score);`);
    await query(`CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity, is_resolved);`);
    
    console.log('✅ Performance indexes created');

    // Add last_active column to users table if it doesn't exist
    try {
      await query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      `);
      console.log('✅ Users table updated with last_active column');
    } catch (error) {
      console.log('ℹ️  last_active column already exists or error:', error.message);
    }

    console.log('🎉 User monitoring tables setup completed successfully!');
    
    // Display table summary
    const tables = [
      'user_sessions', 'user_activity_logs', 'user_presence', 
      'performance_metrics', 'api_performance_logs', 'user_engagement_metrics',
      'user_engagement_events', 'system_alerts', 'alert_subscriptions'
    ];
    
    console.log('\n📊 Created Tables:');
    tables.forEach(table => console.log(`   ✅ ${table}`));
    
    console.log('\n🔧 Created Indexes:');
    const indexes = [
      'idx_user_sessions_user_id', 'idx_user_sessions_active',
      'idx_user_activity_logs_user_id', 'idx_user_presence_status',
      'idx_performance_metrics_timestamp', 'idx_api_performance_logs_endpoint',
      'idx_user_engagement_metrics_score', 'idx_system_alerts_severity'
    ];
    indexes.forEach(index => console.log(`   ✅ ${index}`));

  } catch (error) {
    console.error('❌ Error setting up user monitoring tables:', error);
    throw error;
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupUserMonitoringTables()
    .then(() => {
      console.log('✅ Setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupUserMonitoringTables };
