require('dotenv').config({ path: './env.local' });
const { Pool } = require('pg');

console.log('🚨 EMERGENCY DATABASE CONNECTION FIX');
console.log('🔧 Environment loaded from:', './env.local');
console.log('📡 DATABASE_URL:', process.env.DATABASE_URL ? 'Found' : 'Missing');

// Create a new pool with enhanced connection settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  acquireTimeoutMillis: 30000,
  reapIntervalMillis: 1000,
  createTimeoutMillis: 30000,
  // Add connection retry logic
  retryDelay: 1000,
  maxRetries: 5
});

// Add connection error handling
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
});

// Add connection success handling
pool.on('connect', () => {
  console.log('✅ New database connection established');
});

const testConnection = async () => {
  try {
    console.log('🔌 Testing database connection...');
    
    const client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Query test successful:', result.rows[0]);
    
    client.release();
    
    // Test the query helper function
    const testResult = await query('SELECT version() as db_version');
    console.log('✅ Query helper test successful:', testResult.rows[0]);
    
    console.log('🎉 Database connection is fully operational!');
    return true;
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('🔍 Error details:', error);
    return false;
  }
};

// Enhanced query function with retry logic
const query = async (text, params, retries = 5) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(text, params);
    return result;
  } catch (error) {
    if (retries > 0 && (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.message.includes('Connection terminated'))) {
      console.log(`🔄 Database connection error, retrying... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      return query(text, params, retries - 1);
    }
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
};

// Test the connection
testConnection().then(success => {
  if (success) {
    console.log('🚀 Database connection fix completed successfully!');
    process.exit(0);
  } else {
    console.log('❌ Database connection fix failed!');
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 Fatal error during database fix:', error);
  process.exit(1);
});



