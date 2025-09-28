const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function testDatabaseConnection() {
  console.log('🔌 Testing Database Connection...\n');
  
  // Try multiple connection methods
  const connectionConfigs = [
    // Method 1: Try DATABASE_URL without SSL
    {
      connectionString: process.env.DATABASE_URL,
      ssl: false
    },
    // Method 2: Try individual environment variables without SSL
    {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'hkup_db',
      password: process.env.DB_PASSWORD || 'password',
      port: process.env.DB_PORT || 5432,
      ssl: false
    },
    // Method 3: Try default local connection
    {
      user: 'postgres',
      host: 'localhost',
      database: 'hkup_db',
      password: 'password',
      port: 5432,
      ssl: false
    }
  ];

  let pool = null;
  let client = null;

  for (let i = 0; i < connectionConfigs.length; i++) {
    try {
      console.log(`🔌 Trying connection method ${i + 1}...`);
      pool = new Pool(connectionConfigs[i]);
      client = await pool.connect();
      console.log('✅ Database connected successfully!');
      break;
    } catch (error) {
      console.log(`❌ Connection method ${i + 1} failed:`, error.message);
      if (pool) await pool.end();
    }
  }

  if (!client) {
    console.error('❌ All connection methods failed');
    return;
  }

  try {
    // Check if users table exists and has subscription columns
    console.log('\n📋 Checking users table schema...');
    const schemaResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('Current users table columns:');
    schemaResult.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type}`);
    });
    
    // Check specifically for subscription columns
    const hasIsSubscribed = schemaResult.rows.some(row => row.column_name === 'is_subscribed');
    const hasSubscriptionTier = schemaResult.rows.some(row => row.column_name === 'subscription_tier');
    const hasSubscriptionExpires = schemaResult.rows.some(row => row.column_name === 'subscription_expires_at');
    
    console.log('\n🔍 Subscription columns status:');
    console.log(`   is_subscribed: ${hasIsSubscribed ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   subscription_tier: ${hasSubscriptionTier ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   subscription_expires_at: ${hasSubscriptionExpires ? '✅ EXISTS' : '❌ MISSING'}`);
    
    if (!hasIsSubscribed || !hasSubscriptionTier || !hasSubscriptionExpires) {
      console.log('\n🔧 Adding missing subscription columns...');
      
      if (!hasIsSubscribed) {
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN is_subscribed BOOLEAN DEFAULT false
        `);
        console.log('✅ Added is_subscribed column');
      }
      
      if (!hasSubscriptionTier) {
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN subscription_tier VARCHAR(50) DEFAULT 'free'
        `);
        console.log('✅ Added subscription_tier column');
      }
      
      if (!hasSubscriptionExpires) {
        await client.query(`
          ALTER TABLE users 
          ADD COLUMN subscription_expires_at TIMESTAMP
        `);
        console.log('✅ Added subscription_expires_at column');
      }
      
      console.log('\n🎯 SCHEMA UPDATE COMPLETE!');
      console.log('   All subscription columns are now available!');
    } else {
      console.log('\n🎉 All subscription columns already exist!');
    }
    
    // Test updating a user's subscription status
    console.log('\n🧪 Testing user subscription update...');
    try {
      const testUserId = '1b574327-9365-4d98-8e49-68cb87bd05a8';
      const updateResult = await client.query(`
        UPDATE users 
        SET is_subscribed = true, 
            subscription_tier = 'basic',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, is_subscribed, subscription_tier
      `, [testUserId]);
      
      if (updateResult.rows.length > 0) {
        const user = updateResult.rows[0];
        console.log('✅ User subscription status updated successfully!');
        console.log('   User ID:', user.id);
        console.log('   Is Subscribed:', user.is_subscribed);
        console.log('   Subscription Tier:', user.subscription_tier);
      } else {
        console.log('⚠️  User not found for update');
      }
    } catch (error) {
      console.log('❌ User update failed:', error.message);
    }
    
    client.release();
    console.log('\n🚀 Database is ready for the payment system!');
    
  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
  } finally {
    if (client) client.release();
    if (pool) await pool.end();
  }
}

testDatabaseConnection();
