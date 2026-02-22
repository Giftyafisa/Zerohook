const mongoose = require('mongoose');
const {
  connectDB,
  User,
  Service,
  Conversation,
  Message,
  UserConnection,
  SubscriptionPlan,
  Subscription
} = require('./config/database');
const SystemHealthService = require('./services/SystemHealthService');
const UserConnectionManager = require('./services/UserConnectionManager');

async function testCompleteSystem() {
  console.log('🧪 Testing Complete System Integration...\n');
  
  try {
    const connected = await connectDB();
    if (!connected || mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      console.error('❌ MongoDB is unavailable. Complete system checks require a live database.');
      process.exitCode = 1;
      return;
    }

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
    const requiredCollections = [
      'users', 'services', 'conversations', 'messages',
      'userconnections', 'blockedusers', 'notifications',
      'fileuploads', 'subscriptionplans', 'subscriptions'
    ];

    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = new Set(collections.map(c => c.name));
    
    for (const collection of requiredCollections) {
      if (collectionNames.has(collection)) {
        console.log(`   ✅ ${collection} collection exists`);
      } else {
        console.log(`   ❌ ${collection} collection missing`);
      }
    }

    // Test 3: User Connection Manager
    console.log('\n🔗 Testing User Connection Manager...');
    const connectionManager = new UserConnectionManager();
    
    // Test creating a connection
    try {
      const testUsers = await User.find({}).select('_id').limit(2).lean();
      if (testUsers.length < 2) {
        throw new Error('Need at least 2 users for connection manager test');
      }

      const testConnection = await connectionManager.sendContactRequest(
        testUsers[0]._id.toString(),
        testUsers[1]._id.toString(),
        'Test connection message',
        'contact_request'
      );
      console.log('   ✅ Contact request creation works');
      
      // Clean up test connection
      if (testConnection?.connectionId) {
        await UserConnection.deleteOne({ _id: testConnection.connectionId });
      }
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

    let orphanedConnectionsCount = 0;
    let orphanedMessagesCount = 0;
    
    try {
      // Check for orphaned records
      orphanedConnectionsCount = await UserConnection.countDocuments({
        $or: [
          { from_user_id: { $nin: await User.find({}).distinct('_id') } },
          { to_user_id: { $nin: await User.find({}).distinct('_id') } }
        ]
      });
      
      if (orphanedConnectionsCount === 0) {
        console.log('   ✅ No orphaned user connections found');
      } else {
        console.log(`   ⚠️  Found ${orphanedConnectionsCount} orphaned connections`);
      }

      // Check for orphaned messages
      orphanedMessagesCount = await Message.countDocuments({
        conversationId: { $nin: await Conversation.find({}).distinct('_id') }
      });
      
      if (orphanedMessagesCount === 0) {
        console.log('   ✅ No orphaned messages found');
      } else {
        console.log(`   ⚠️  Found ${orphanedMessagesCount} orphaned messages`);
      }

    } catch (error) {
      console.log('   ❌ Data integrity check failed:', error.message);
    }

    // Test 7: Performance
    console.log('\n⚡ Testing Performance...');
    
    try {
      const startTime = Date.now();
      
      // Test database query performance
      await User.countDocuments();
      await Service.countDocuments();
      await UserConnection.countDocuments();
      
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
    console.log(`   - Database Collections: ${requiredCollections.length} required collections checked`);
    console.log(`   - File System: ${fs.existsSync(uploadsDir) ? '✅ Ready' : '❌ Issues'}`);
    console.log(`   - API Endpoints: ${endpoints.length} endpoints tested`);
    console.log(`   - Data Integrity: ${orphanedConnectionsCount === 0 && orphanedMessagesCount === 0 ? '✅ Clean' : '⚠️ Issues'}`);
    
    if (healthStatus.overall) {
      console.log('\n🎊 All systems are operational! Your enhanced Zerohook platform is ready.');
    } else {
      console.log('\n⚠️  Some issues were detected. Please review the logs above.');
    }
    
  } catch (error) {
    console.error('❌ Complete system test failed:', error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testCompleteSystem();
}

module.exports = { testCompleteSystem };
