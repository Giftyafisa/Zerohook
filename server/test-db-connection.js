require('dotenv').config({ path: './env.local' });
const mongoose = require('mongoose');
const { connectDB, isDatabaseAvailable, ServiceCategory } = require('./config/database');

console.log('🔧 Testing MongoDB connection...');
console.log('   Environment:', process.env.NODE_ENV);
console.log('   MONGODB_URI exists:', !!process.env.MONGODB_URI);

async function testConnection() {
  try {
    console.log('🔄 Attempting to connect...');
    const connected = await connectDB();
    if (!connected || mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
      console.error('❌ Database connection unavailable. Skipping collection checks.');
      process.exitCode = 1;
      return;
    }
    console.log('✅ Database connection successful!');

    const dbReady = isDatabaseAvailable() && mongoose.connection.readyState === 1;
    console.log(`✅ Connection state: ${dbReady ? 'connected' : 'disconnected'}`);
    console.log(`✅ Database name: ${mongoose.connection.name}`);

    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📋 Collections found: ${collections.length}`);

    const hasServiceCategories = collections.some(c => c.name === 'servicecategories');
    if (hasServiceCategories) {
      console.log('✅ servicecategories collection exists');
      const categoryCount = await ServiceCategory.countDocuments();
      console.log(`📊 Service categories: ${categoryCount}`);
    } else {
      console.log('❌ servicecategories collection does not exist');
    }

    await mongoose.connection.close();
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

testConnection();
