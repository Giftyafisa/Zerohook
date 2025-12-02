const { query } = require('./config/database');
const SystemHealthService = require('./services/SystemHealthService');
const UserConnectionManager = require('./services/UserConnectionManager');

async function testCompleteSystem() {
  console.log('🧪 Testing Complete System Integration...\n');
  
  try {
    // Test 1: System Health Service
    console.log('🏥 Testing System Health Service...');
    const healthService = new SystemHealthService();
    const healthStatus = await healthService.performFullHealthCheck();
    
    if (healthStatus.overall) {
      console.log('   ✅ System health check passed');
    } else {
      console.log('   ⚠️  System health check had issues');
      console.log('   📋 Issues:', healthStatus);
    }

    // Test 2: Database Schema
    console.log('\n🗄️ Testing Database Schema...');
    const requiredTables = [
      'users', 'services', 'conversations', 'messages',
      'user_connections', 'blocked_users', 'notifications',
      'file_uploads', 'subscription_plans', 'subscriptions'
    ];
    
    for (const table of requiredTables) {
      try {
        const result = await query(`SELECT EXISTS (
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

    // Test 3: User Connection Manager
    console.log('\n🔗 Testing User Connection Manager...');
    const connectionManager = new UserConnectionManager();
    
    // Test creating a connection
    try {
      const testConnection = await connectionManager.sendContactRequest(
        'test-user-1',
        'test-user-2',
        'Test connection message',
        'contact_request'
      );
      console.log('   ✅ Contact request creation works');
      
      // Clean up test connection
      await query('DELETE FROM user_connections WHERE id = $1', [testConnection.id]);
    } catch (error) {
      console.log('   ⚠️  Contact request test had issues:', error.message);
    }

    // Test 4: File Upload System
    console.log('\n📁 Testing File Upload System...');
    const uploadsDir = require('path').join(__dirname, 'uploads');
    const fs = require('fs');
    
    if (fs.existsSync(uploadsDir)) {
      console.log('   ✅ Uploads directory exists');
      
      // Test write permissions
      try {
        const testFile = require('path').join(uploadsDir, '.test-write');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        console.log('   ✅ Uploads directory is writable');
      } catch (error) {
        console.log('   ❌ Uploads directory not writable:', error.message);
      }
    } else {
      console.log('   📁 Creating uploads directory');
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Test 5: API Endpoints
    console.log('\n🌐 Testing API Endpoints...');
    const endpoints = [
      '/api/health',
      '/api/connections/user-connections',
      '/api/connections/pending-requests',
      '/api/uploads/user-files',
      '/api/chat/conversations'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`http://localhost:5000${endpoint}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.status === 200 || response.status === 401) {
          console.log(`   ✅ ${endpoint} endpoint accessible`);
        } else {
          console.log(`   ⚠️  ${endpoint} endpoint returned ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ ${endpoint} endpoint error: ${error.message}`);
      }
    }

    // Test 6: Data Integrity
    console.log('\n🔍 Testing Data Integrity...');
    
    try {
      // Check for orphaned records
      const orphanedConnections = await query(`
        SELECT COUNT(*) FROM user_connections uc
        LEFT JOIN users u1 ON uc.from_user_id = u1.id
        LEFT JOIN users u2 ON uc.to_user_id = u2.id
        WHERE u1.id IS NULL OR u2.id IS NULL
      `);
      
      if (parseInt(orphanedConnections.rows[0].count) === 0) {
        console.log('   ✅ No orphaned user connections found');
      } else {
        console.log(`   ⚠️  Found ${orphanedConnections.rows[0].count} orphaned connections`);
      }

      // Check for orphaned messages
      const orphanedMessages = await query(`
        SELECT COUNT(*) FROM messages m
        LEFT JOIN conversations c ON m.conversation_id = c.id
        WHERE c.id IS NULL
      `);
      
      if (parseInt(orphanedMessages.rows[0].count) === 0) {
        console.log('   ✅ No orphaned messages found');
      } else {
        console.log(`   ⚠️  Found ${orphanedMessages.rows[0].count} orphaned messages`);
      }

    } catch (error) {
      console.log('   ❌ Data integrity check failed:', error.message);
    }

    // Test 7: Performance
    console.log('\n⚡ Testing Performance...');
    
    try {
      const startTime = Date.now();
      
      // Test database query performance
      await query('SELECT COUNT(*) FROM users');
      await query('SELECT COUNT(*) FROM services');
      await query('SELECT COUNT(*) FROM user_connections');
      
      const queryTime = Date.now() - startTime;
      
      if (queryTime < 1000) {
        console.log(`   ✅ Database queries completed in ${queryTime}ms`);
      } else {
        console.log(`   ⚠️  Database queries took ${queryTime}ms (slow)`);
      }
      
    } catch (error) {
      console.log('   ❌ Performance test failed:', error.message);
    }

    // Test 8: Security
    console.log('\n🔒 Testing Security...');
    
    try {
      // Check if JWT secret is set
      if (process.env.JWT_SECRET && process.env.JWT_SECRET.length > 10) {
        console.log('   ✅ JWT secret is properly configured');
      } else {
        console.log('   ⚠️  JWT secret may be weak or missing');
      }
      
      // Check if rate limiting is enabled
      if (process.env.RATE_LIMIT_MAX_REQUESTS) {
        console.log('   ✅ Rate limiting is configured');
      } else {
        console.log('   ⚠️  Rate limiting not configured');
      }
      
    } catch (error) {
      console.log('   ❌ Security test failed:', error.message);
    }

    console.log('\n🎉 Complete System Test Completed!');
    console.log('\n📋 Summary:');
    console.log(`   - System Health: ${healthStatus.overall ? '✅ Healthy' : '❌ Issues'}`);
    console.log(`   - Database Tables: ${requiredTables.length} required tables checked`);
    console.log(`   - File System: ${fs.existsSync(uploadsDir) ? '✅ Ready' : '❌ Issues'}`);
    console.log(`   - API Endpoints: ${endpoints.length} endpoints tested`);
    console.log(`   - Data Integrity: ${orphanedConnections.rows[0].count === 0 ? '✅ Clean' : '⚠️ Issues'}`);
    
    if (healthStatus.overall) {
      console.log('\n🎊 All systems are operational! Your enhanced Zerohook platform is ready.');
    } else {
      console.log('\n⚠️  Some issues were detected. Please review the logs above.');
    }
    
  } catch (error) {
    console.error('❌ Complete system test failed:', error);
  } finally {
    await query.end();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testCompleteSystem();
}

module.exports = { testCompleteSystem };
