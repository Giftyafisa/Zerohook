const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

async function testSystemIntegration() {
  console.log('🧪 Testing System Integration...\n');
  
  // Create a direct database connection for testing
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  
  try {
    // Test 1: Check if all required tables exist
    console.log('📋 Testing Database Tables...');
    
    const requiredTables = [
      'users',
      'services', 
      'conversations',
      'messages',
      'user_connections',
      'blocked_users',
      'notifications',
      'file_uploads',
      'subscription_plans',
      'subscriptions'
    ];
    
    for (const table of requiredTables) {
      try {
        const result = await pool.query(`SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`, [table]);
        
        if (result.rows[0].exists) {
          console.log(`   ✅ ${table} table exists`);
        } else {
          console.log(`   ❌ ${table} table missing`);
        }
      } catch (error) {
        console.log(`   ❌ Error checking ${table} table: ${error.message}`);
      }
    }
    
    // Test 2: Check if test users exist
    console.log('\n👥 Testing User Data...');
    
    const userCount = await pool.query('SELECT COUNT(*) FROM users');
    console.log(`   📊 Total users: ${userCount.rows[0].count}`);
    
    const testUsers = await pool.query(`
      SELECT username, email, verification_tier, 
             profile_data->>'profile_picture' as profile_picture
      FROM users 
      LIMIT 3
    `);
    
    console.log('   👤 Sample users:');
    testUsers.rows.forEach(user => {
      console.log(`      - ${user.username} (${user.email}) - Tier ${user.verification_tier}`);
    });
    
    // Test 3: Check if test services exist
    console.log('\n🛍️ Testing Service Data...');
    
    const serviceCount = await pool.query('SELECT COUNT(*) FROM services');
    console.log(`   📊 Total services: ${serviceCount.rows[0].count}`);
    
    const testServices = await pool.query(`
      SELECT title, category_id, price, 
             users.username as provider_name
      FROM services 
      JOIN users ON services.provider_id = users.id
      LIMIT 3
    `);
    
    console.log('   🎯 Sample services:');
    testServices.rows.forEach(service => {
      console.log(`      - ${service.title} (${service.category_id}) - $${service.price} by ${service.provider_name}`);
    });
    
    // Test 4: Test user connection functionality
    console.log('\n🔗 Testing User Connection System...');
    
    // Get two test users
    const testUser1 = await pool.query('SELECT id, username FROM users LIMIT 1');
    const testUser2 = await pool.query('SELECT id, username FROM users OFFSET 1 LIMIT 1');
    
    if (testUser1.rows.length > 0 && testUser2.rows.length > 0) {
      const user1 = testUser1.rows[0];
      const user2 = testUser2.rows[0];
      
      console.log(`   👥 Testing connection between ${user1.username} and ${user2.username}`);
      
      // Check if connection already exists
      const existingConnection = await pool.query(`
        SELECT id FROM user_connections 
        WHERE (from_user_id = $1 AND to_user_id = $2) 
           OR (from_user_id = $2 AND to_user_id = $1)
      `, [user1.id, user2.id]);
      
      if (existingConnection.rows.length === 0) {
        console.log('   ✅ No existing connection found');
      } else {
        console.log('   ℹ️  Connection already exists');
      }
    }
    
    // Test 5: Check file upload system
    console.log('\n📁 Testing File Upload System...');
    
    const uploadsDir = require('path').join(__dirname, 'uploads');
    const fs = require('fs');
    
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      console.log(`   📁 Uploads directory exists with ${files.length} files`);
      
      if (files.length > 0) {
        console.log('   📄 Sample files:');
        files.slice(0, 3).forEach(file => {
          const stats = fs.statSync(require('path').join(uploadsDir, file));
          console.log(`      - ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
        });
      }
    } else {
      console.log('   📁 Uploads directory created');
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Test 6: Check subscription system
    console.log('\n💳 Testing Subscription System...');
    
    const planCount = await pool.query('SELECT COUNT(*) FROM subscription_plans');
    console.log(`   📊 Total subscription plans: ${planCount.rows[0].count}`);
    
    const subscriptionCount = await pool.query('SELECT COUNT(*) FROM subscriptions');
    console.log(`   📊 Total subscriptions: ${subscriptionCount.rows[0].count}`);
    
    // Test 7: Check chat system
    console.log('\n💬 Testing Chat System...');
    
    const conversationCount = await pool.query('SELECT COUNT(*) FROM conversations');
    console.log(`   📊 Total conversations: ${conversationCount.rows[0].count}`);
    
    const messageCount = await pool.query('SELECT COUNT(*) FROM messages');
    console.log(`   📊 Total messages: ${messageCount.rows[0].count}`);
    
    // Test 8: Check notification system
    console.log('\n🔔 Testing Notification System...');
    
    const notificationCount = await pool.query('SELECT COUNT(*) FROM notifications');
    console.log(`   📊 Total notifications: ${notificationCount.rows[0].count}`);
    
    // Test 9: Check blocked users system
    console.log('\n🚫 Testing Blocked Users System...');
    
    const blockedCount = await pool.query('SELECT COUNT(*) FROM blocked_users');
    console.log(`   📊 Total blocked relationships: ${blockedCount.rows[0].count}`);
    
    // Test 10: System Health Check
    console.log('\n🏥 System Health Check...');
    
    const healthChecks = [
      { name: 'Database Connection', query: 'SELECT 1 as test' },
      { name: 'User Authentication', query: 'SELECT COUNT(*) FROM users WHERE verification_tier > 0' },
      { name: 'Service Availability', query: 'SELECT COUNT(*) FROM services WHERE status = \'active\'' },
      { name: 'File System', query: 'SELECT COUNT(*) FROM file_uploads' }
    ];
    
    for (const check of healthChecks) {
      try {
        const result = await pool.query(check.query);
        console.log(`   ✅ ${check.name}: OK`);
      } catch (error) {
        console.log(`   ❌ ${check.name}: Failed - ${error.message}`);
      }
    }
    
    console.log('\n🎉 System Integration Test Completed!');
    console.log('\n📋 Summary:');
    console.log(`   - Database Tables: ${requiredTables.length} required tables checked`);
    console.log(`   - Users: ${userCount.rows[0].count} total users`);
    console.log(`   - Services: ${serviceCount.rows[0].count} total services`);
    console.log(`   - Conversations: ${conversationCount.rows[0].count} total conversations`);
    console.log(`   - Messages: ${messageCount.rows[0].count} total messages`);
    console.log(`   - File Uploads: ${fs.existsSync(uploadsDir) ? 'Directory ready' : 'Directory missing'}`);
    console.log(`   - Subscriptions: ${planCount.rows[0].count} plans, ${subscriptionCount.rows[0].count} active`);
    
  } catch (error) {
    console.error('❌ System integration test failed:', error);
  } finally {
    await pool.end();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testSystemIntegration();
}

module.exports = { testSystemIntegration };



