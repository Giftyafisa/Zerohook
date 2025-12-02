/**
 * Add api_performance_logs table to database
 * Run with: node add-api-performance-table.js
 */

require('dotenv').config({ path: 'env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function addApiPerformanceTable() {
  const client = await pool.connect();
  try {
    console.log('🔧 Adding api_performance_logs table...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_performance_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        endpoint VARCHAR(255) NOT NULL,
        method VARCHAR(10) NOT NULL,
        user_id UUID,
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

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_api_performance_logs_endpoint ON api_performance_logs(endpoint);
      CREATE INDEX IF NOT EXISTS idx_api_performance_logs_user_id ON api_performance_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_api_performance_logs_created_at ON api_performance_logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_api_performance_logs_status_code ON api_performance_logs(status_code);
    `);
    console.log('✅ API performance logs indexes created');

    console.log('\n✅ Done! Table added successfully.');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

addApiPerformanceTable();
