require('dotenv').config({ path: './env.production' });
const mongoose = require('mongoose');
const {
  connectDB,
  User,
  Service,
  Conversation,
  Message,
  UserConnection,
  BlockedUser,
  Notification,
  FileUpload,
  SubscriptionPlan,
  Subscription
} = require('./config/database');

async function testSystemIntegration() {
  console.log('🧪 Testing System Integration...\n');

  try {
    const connected = await connectDB();
    if (!connected || mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      console.error('❌ MongoDB is unavailable. Integration checks require a live database.');
      process.exitCode = 1;
      return;
    }

    // Test 1: Check if all required tables exist
    console.log('📋 Testing Database Collections...');
    
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
    
    // Test 2: Check if test users exist
    console.log('\n👥 Testing User Data...');
    
    const userCount = await User.countDocuments();
    console.log(`   📊 Total users: ${userCount}`);
    
    const testUsers = await User.find({}).select('username email verification_tier').limit(3).lean();
    
    console.log('   👤 Sample users:');
    testUsers.forEach(user => {
      console.log(`      - ${user.username} (${user.email}) - Tier ${user.verification_tier}`);
    });
    
    // Test 3: Check if test services exist
    console.log('\n🛍️ Testing Service Data...');
    
    const serviceCount = await Service.countDocuments();
    console.log(`   📊 Total services: ${serviceCount}`);
    
    const testServices = await Service.find({})
      .populate('provider_id', 'username')
      .select('title category_id price provider_id')
      .limit(3)
      .lean();
    
    console.log('   🎯 Sample services:');
    testServices.forEach(service => {
      console.log(`      - ${service.title} (${service.category_id}) - $${service.price} by ${service.provider_id?.username || 'Unknown'}`);
    });
    
    // Test 4: Test user connection functionality
    console.log('\n🔗 Testing User Connection System...');
    
    // Get two test users
    const [user1, user2] = await User.find({}).select('_id username').limit(2).lean();
    
    if (user1 && user2) {
      console.log(`   👥 Testing connection between ${user1.username} and ${user2.username}`);
      
      // Check if connection already exists
      const existingConnection = await UserConnection.findOne({
        $or: [
          { from_user_id: user1._id, to_user_id: user2._id },
          { from_user_id: user2._id, to_user_id: user1._id }
        ]
      }).lean();
      
      if (!existingConnection) {
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
    
    const planCount = await SubscriptionPlan.countDocuments();
    console.log(`   📊 Total subscription plans: ${planCount}`);
    
    const subscriptionCount = await Subscription.countDocuments();
    console.log(`   📊 Total subscriptions: ${subscriptionCount}`);
    
    // Test 7: Check chat system
    console.log('\n💬 Testing Chat System...');
    
    const conversationCount = await Conversation.countDocuments();
    console.log(`   📊 Total conversations: ${conversationCount}`);
    
    const messageCount = await Message.countDocuments();
    console.log(`   📊 Total messages: ${messageCount}`);
    
    // Test 8: Check notification system
    console.log('\n🔔 Testing Notification System...');
    
    const notificationCount = await Notification.countDocuments();
    console.log(`   📊 Total notifications: ${notificationCount}`);
    
    // Test 9: Check blocked users system
    console.log('\n🚫 Testing Blocked Users System...');
    
    const blockedCount = await BlockedUser.countDocuments();
    console.log(`   📊 Total blocked relationships: ${blockedCount}`);
    
    // Test 10: System Health Check
    console.log('\n🏥 System Health Check...');
    
    const healthChecks = [
      { name: 'Database Connection', run: async () => mongoose.connection.db.admin().ping() },
      { name: 'User Authentication', run: async () => User.countDocuments({ verification_tier: { $gt: 0 } }) },
      { name: 'Service Availability', run: async () => Service.countDocuments({ status: 'active' }) },
      { name: 'File System', run: async () => FileUpload.countDocuments() }
    ];
    
    for (const check of healthChecks) {
      try {
        await check.run();
        console.log(`   ✅ ${check.name}: OK`);
      } catch (error) {
        console.log(`   ❌ ${check.name}: Failed - ${error.message}`);
      }
    }
    
    console.log('\n🎉 System Integration Test Completed!');
    console.log('\n📋 Summary:');
    console.log(`   - Database Collections: ${requiredCollections.length} required collections checked`);
    console.log(`   - Users: ${userCount} total users`);
    console.log(`   - Services: ${serviceCount} total services`);
    console.log(`   - Conversations: ${conversationCount} total conversations`);
    console.log(`   - Messages: ${messageCount} total messages`);
    console.log(`   - File Uploads: ${fs.existsSync(uploadsDir) ? 'Directory ready' : 'Directory missing'}`);
    console.log(`   - Subscriptions: ${planCount} plans, ${subscriptionCount} active`);
    
  } catch (error) {
    console.error('❌ System integration test failed:', error);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testSystemIntegration();
}

module.exports = { testSystemIntegration };



