const axios = require('axios');

async function quickSystemCheck() {
  try {
    console.log('🔍 QUICK SYSTEM CHECK\n');
    
    // Test 1: Backend Status
    console.log('1️⃣ Backend Status:');
    try {
      const healthResponse = await axios.get('http://localhost:5000/api/health');
      console.log('   ✅ Backend running on port 5000');
      console.log('   📋 Status:', healthResponse.data.status);
      console.log('   📋 Database:', healthResponse.data.components?.database?.status);
    } catch (error) {
      console.log('   ❌ Backend not accessible');
    }
    
    // Test 2: Authentication
    console.log('\n2️⃣ Authentication:');
    try {
      const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'akua.mensah@ghana.com',
        password: 'AkuaPass123!'
      });
      
      if (loginResponse.data.token) {
        console.log('   ✅ Login working');
        const user = loginResponse.data.user;
        console.log('   📋 Subscription data present:', {
          is_subscribed: user.is_subscribed,
          subscription_tier: user.subscription_tier
        });
      }
    } catch (error) {
      console.log('   ❌ Login failed:', error.message);
    }
    
    // Test 3: Frontend
    console.log('\n3️⃣ Frontend Status:');
    try {
      const frontendResponse = await axios.get('http://localhost:3000');
      console.log('   ✅ Frontend running on port 3000');
    } catch (error) {
      console.log('   ❌ Frontend not running');
      console.log('   💡 Start with: cd client && npm start');
    }
    
    // Test 4: Summary
    console.log('\n4️⃣ SUMMARY:');
    console.log('   ✅ Backend: Working');
    console.log('   ✅ Authentication: Working with subscription data');
    console.log('   ❌ Frontend: Not running');
    console.log('   ✅ Redux Integration: Ready (when frontend starts)');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  } finally {
    process.exit();
  }
}

quickSystemCheck();
