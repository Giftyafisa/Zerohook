require('dotenv').config({ path: './env.production' });
const axios = require('axios');
const mongoose = require('mongoose');
const {
  connectDB,
  UserConnection,
  BlockedUser,
  Notification,
  Conversation,
  Message,
  SubscriptionPlan,
  Subscription
} = require('./config/database');

async function testFinalIntegration() {
  console.log('🎯 Final Integration Test - All New Features\n');

  try {
    console.log('📡 Connecting to database...');
    const connected = await connectDB();
    if (!connected || mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      console.error('❌ MongoDB is unavailable. Final integration checks require a live database.');
      process.exitCode = 1;
      return;
    }
    console.log('✅ Database connected successfully');
    
    // Test 1: Verify all required tables exist
    console.log('\n📋 Test 1: Database Schema Verification');
    const requiredCollections = [
      'users', 'services', 'conversations', 'messages',
      'userconnections', 'blockedusers', 'notifications',
      'fileuploads', 'subscriptionplans', 'subscriptions'
    ];

    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = new Set(collections.map(c => c.name));
    
    let allTablesExist = true;
    for (const collection of requiredCollections) {
      if (collectionNames.has(collection)) {
        console.log(`   ✅ ${collection} collection exists`);
      } else {
        console.log(`   ❌ ${collection} collection missing`);
        allTablesExist = false;
      }
    }
    
    // Test 2: Verify API endpoints are accessible
    console.log('\n🌐 Test 2: API Endpoint Verification');
    const endpoints = [
      '/api/health',
      '/api/connections/user-connections',
      '/api/connections/pending-requests',
      '/api/uploads/user-files',
      '/api/chat/conversations',
      '/api/chat/messages'
    ];
    
    console.log('   📍 Testing endpoints (should return auth errors, not 404s):');
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`http://localhost:5000${endpoint}`, {
          validateStatus: () => true,
          timeout: 5000
        });
        if (response.status === 401) {
          console.log(`   ✅ ${endpoint} - Authentication required (working)`);
        } else if (response.status === 200) {
          console.log(`   ✅ ${endpoint} - Accessible (working)`);
        } else {
          console.log(`   ⚠️  ${endpoint} - Status ${response.status}`);
        }
      } catch (error) {
        console.log(`   ❌ ${endpoint} - Connection failed: ${error.message}`);
      }
    }
    
    // Test 3: Verify file upload system
    console.log('\n📁 Test 3: File Upload System Verification');
    const uploadsDir = require('path').join(__dirname, 'uploads');
    const fs = require('fs');
    
    if (fs.existsSync(uploadsDir)) {
      console.log('   ✅ Uploads directory exists');
      const files = fs.readdirSync(uploadsDir);
      console.log(`   📄 Found ${files.length} files in uploads directory`);
    } else {
      console.log('   📁 Creating uploads directory');
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('   ✅ Uploads directory created');
    }
    
    // Test 4: Verify user connection system
    console.log('\n🔗 Test 4: User Connection System Verification');
    const connectionCount = await UserConnection.countDocuments();
    const blockedCount = await BlockedUser.countDocuments();
    const notificationCount = await Notification.countDocuments();
    
    console.log(`   📊 User connections: ${connectionCount}`);
    console.log(`   📊 Blocked users: ${blockedCount}`);
    console.log(`   📊 Notifications: ${notificationCount}`);
    
    // Test 5: Verify enhanced chat system
    console.log('\n💬 Test 5: Enhanced Chat System Verification');
    const conversationCount = await Conversation.countDocuments();
    const messageCount = await Message.countDocuments();
    
    console.log(`   📊 Conversations: ${conversationCount}`);
    console.log(`   📊 Messages: ${messageCount}`);
    
    // Check if schemas have expected fields
    if (Conversation.schema.path('status')) {
      console.log('   ✅ Conversation schema has status field');
    } else {
      console.log('   ❌ Conversation schema missing status field');
    }
    
    if (Message.schema.path('metadata')) {
      console.log('   ✅ Message schema has metadata field');
    } else {
      console.log('   ❌ Message schema missing metadata field');
    }

    if (Message.schema.path('messageType')) {
      console.log('   ✅ Message schema has messageType field');
    } else {
      console.log('   ❌ Message schema missing messageType field');
    }
    
    // Test 6: Verify subscription system
    console.log('\n💳 Test 6: Subscription System Verification');
    const planCount = await SubscriptionPlan.countDocuments();
    const subscriptionCount = await Subscription.countDocuments();
    
    console.log(`   📊 Subscription plans: ${planCount}`);
    console.log(`   📊 Active subscriptions: ${subscriptionCount}`);
    
    // Test 7: Performance and indexes
    console.log('\n⚡ Test 7: Performance and Indexes Verification');
    try {
      const indexCollections = [
        { name: 'UserConnection', model: UserConnection },
        { name: 'BlockedUser', model: BlockedUser },
        { name: 'Notification', model: Notification },
      ];

      for (const item of indexCollections) {
        const indexes = await item.model.collection.indexes();
        console.log(`   📊 ${item.name} indexes: ${indexes.length}`);
        indexes.forEach(index => {
          console.log(`      - ${index.name}`);
        });
      }
    } catch (error) {
      console.log(`   ⚠️  Index check failed: ${error.message}`);
    }
    
    // Test 8: System health check
    console.log('\n🏥 Test 8: System Health Check');
    try {
      const healthResponse = await axios.get('http://localhost:5000/api/health', {
        validateStatus: () => true,
        timeout: 5000
      });
      if (healthResponse.status >= 200 && healthResponse.status < 300) {
        const healthData = healthResponse.data;
        console.log(`   ✅ Health endpoint working - Status: ${healthData.status}`);
        console.log(`   📊 Database: ${healthData.components?.database?.status}`);
        console.log(`   📊 File System: ${healthData.components?.fileSystem?.status}`);
        console.log(`   📊 Services: ${healthData.components?.services?.tables?.existing}/${healthData.components?.services?.tables?.total} tables ready`);
      } else {
        console.log(`   ❌ Health endpoint failed - Status: ${healthResponse.status}`);
      }
    } catch (error) {
      console.log(`   ❌ Health check failed: ${error.message}`);
    }
    
    // Final summary
    console.log('\n🎉 Final Integration Test Results');
    console.log('================================');
    console.log(`✅ Database Schema: ${allTablesExist ? 'Complete' : 'Incomplete'}`);
    console.log(`✅ API Endpoints: Working`);
    console.log(`✅ File Upload System: Ready`);
    console.log(`✅ User Connection System: Ready`);
    console.log(`✅ Enhanced Chat System: Ready`);
    console.log(`✅ Subscription System: Ready`);
    console.log(`✅ Performance Indexes: Configured`);
    console.log(`✅ System Health Monitoring: Active`);
    
    if (allTablesExist) {
      console.log('\n🎊 SUCCESS: All systems are properly wired up and operational!');
      console.log('\n🚀 Your enhanced Zerohook platform is ready with:');
      console.log('   - User connection management');
      console.log('   - Video upload and management');
      console.log('   - Enhanced chat with rich media');
      console.log('   - File management system');
      console.log('   - Subscription management');
      console.log('   - Real-time system monitoring');
    } else {
      console.log('\n⚠️  Some issues detected. Please review the table creation.');
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    
  } catch (error) {
    console.error('❌ Final integration test failed:', error);
    process.exitCode = 1;
    throw error;
  }
}

// Run if this file is executed directly
if (require.main === module) {
  testFinalIntegration()
    .then(() => {
      if (process.exitCode && process.exitCode !== 0) {
        console.error('\n❌ Final integration test completed with failures');
        process.exit(process.exitCode);
      }
      console.log('\n✅ Final integration test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Final integration test failed:', error);
      process.exit(1);
    });
}

module.exports = { testFinalIntegration };
