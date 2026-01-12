// Test MongoDB Connection
require('dotenv').config();
const { connectDB, User, ServiceCategory, mongoose } = require('./config/database');

async function testConnection() {
  console.log('🔧 Testing MongoDB connection...\n');
  
  try {
    // Connect to database
    const connected = await connectDB();
    
    if (!connected) {
      console.log('❌ Failed to connect to MongoDB');
      process.exit(1);
    }
    
    console.log('\n📊 Database Status:');
    console.log('   Connected:', mongoose.connection.readyState === 1 ? 'Yes' : 'No');
    console.log('   Host:', mongoose.connection.host);
    console.log('   Database:', mongoose.connection.name);
    
    // Check collections
    console.log('\n📁 Checking collections...');
    
    const userCount = await User.countDocuments();
    console.log('   Users:', userCount);
    
    const categoryCount = await ServiceCategory.countDocuments();
    console.log('   Service Categories:', categoryCount);
    
    // List categories
    const categories = await ServiceCategory.find();
    console.log('\n📋 Service Categories:');
    categories.forEach(cat => {
      console.log(`   - ${cat.display_name} (${cat.name}): $${cat.base_price}`);
    });
    
    console.log('\n✅ MongoDB connection test PASSED!');
    console.log('🎉 Your database is ready to use.\n');
    
  } catch (error) {
    console.error('\n❌ MongoDB connection test FAILED:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

testConnection();
