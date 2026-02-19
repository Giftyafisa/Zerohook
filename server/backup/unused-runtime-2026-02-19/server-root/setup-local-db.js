const { Pool } = require('pg');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

console.log('🔧 Setting up local PostgreSQL database...');

async function setupDatabase() {
  try {
    // First, try to connect to postgres database to create our database
    console.log('📡 Attempting to connect to postgres database...');
    
    // Try different connection methods
    const connectionAttempts = [
      'postgresql://postgres@localhost:5432/postgres',
      'postgresql://postgres:postgres@localhost:5432/postgres',
      'postgresql://postgres:admin@localhost:5432/postgres',
      'postgresql://postgres:root@localhost:5432/postgres'
    ];
    
    let pool = null;
    let connected = false;
    
    for (const connectionString of connectionAttempts) {
      try {
        console.log(`🔄 Trying connection: ${connectionString}`);
        pool = new Pool({
          connectionString,
          ssl: false
        });
        
        const client = await pool.connect();
        console.log('✅ Connected to postgres database!');
        client.release();
        connected = true;
        break;
      } catch (error) {
        console.log(`❌ Failed: ${error.message}`);
        if (pool) {
          await pool.end();
        }
      }
    }
    
    if (!connected) {
      console.log('❌ Could not connect to postgres database with any method');
      console.log('💡 Please ensure PostgreSQL is running and accessible');
      console.log('💡 You may need to:');
      console.log('   1. Start PostgreSQL service');
      console.log('   2. Set password for postgres user');
      console.log('   3. Configure pg_hba.conf for local connections');
      return;
    }
    
    // Create our database
    console.log('📋 Creating hkup_db database...');
    const client = await pool.connect();
    
    try {
      await client.query('CREATE DATABASE hkup_db');
      console.log('✅ Database hkup_db created successfully');
    } catch (error) {
      if (error.code === '42P04') {
        console.log('ℹ️ Database hkup_db already exists');
      } else {
        console.log('❌ Error creating database:', error.message);
      }
    }
    
    client.release();
    await pool.end();
    
    // Now try to connect to our new database
    console.log('🔄 Testing connection to hkup_db...');
    const testPool = new Pool({
      connectionString: 'postgresql://postgres@localhost:5432/hkup_db',
      ssl: false
    });
    
    const testClient = await testPool.connect();
    console.log('✅ Successfully connected to hkup_db!');
    
    // Test basic functionality
    const result = await testClient.query('SELECT NOW() as current_time');
    console.log('⏰ Database time:', result.rows[0].current_time);
    
    testClient.release();
    await testPool.end();
    
    console.log('🎉 Local database setup completed successfully!');
    console.log('💡 You can now start the server with: npm start');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.log('💡 Manual setup required:');
    console.log('   1. Connect to PostgreSQL as superuser');
    console.log('   2. Create database: CREATE DATABASE hkup_db;');
    console.log('   3. Grant permissions: GRANT ALL PRIVILEGES ON DATABASE hkup_db TO postgres;');
  }
}

setupDatabase();


