const { testSystemIntegration } = require('./test-system-integration');
const { connectDB, connectRedis } = require('./config/database');

async function startSystem() {
  console.log('🚀 Starting Zerohook Platform...\n');
  
  try {
    // Step 1: Initialize Database
    console.log('📊 Step 1: Initializing Database...');
    const dbConnected = await connectDB();
    
    if (dbConnected) {
      console.log('   ✅ Database connected successfully');
    } else {
      console.log('   ⚠️  Database connection failed, continuing with frontend mode');
    }
    
    // Step 2: Initialize Redis (if available)
    console.log('\n🔴 Step 2: Initializing Redis...');
    try {
      await connectRedis();
      console.log('   ✅ Redis connected successfully');
    } catch (error) {
      console.log('   ⚠️  Redis connection failed, continuing without caching');
    }
    
    // Step 3: Test System Integration
    console.log('\n🧪 Step 3: Testing System Integration...');
    if (dbConnected) {
      await testSystemIntegration();
    } else {
      console.log('   ⚠️  Skipping system integration test (database not available)');
    }
    
    // Step 4: Start Server
    console.log('\n🌐 Step 4: Starting Server...');
    
    // Import and start the main server
    const { startServer } = require('./index');
    
    if (typeof startServer === 'function') {
      await startServer();
    } else {
      console.log('   ℹ️  Server startup function not found, manual startup required');
      console.log('   💡 Run: npm start or node index.js');
    }
    
  } catch (error) {
    console.error('❌ System startup failed:', error);
    process.exit(1);
  }
}

// Run startup if this file is executed directly
if (require.main === module) {
  startSystem();
}

module.exports = { startSystem };



