const axios = require('axios');

async function testAuthFlow() {
  try {
    console.log('🚀 Testing Authentication Flow...\n');
    
    // Test Login
    console.log('1️⃣ Testing Login...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'akua.mensah@ghana.com',
      password: 'AkuaPass123!'
    });
    
    console.log('   ✅ Login successful');
    const user = loginResponse.data.user;
    console.log(`   📋 User: ${user.username} (${user.email})`);
    console.log(`   📋 Is Subscribed: ${user.is_subscribed}`);
    console.log(`   📋 Subscription Tier: ${user.subscription_tier}`);
    
    const token = loginResponse.data.token;
    
    // Test Profile
    console.log('\n2️⃣ Testing Profile...');
    const profileResponse = await axios.get('http://localhost:5000/api/users/profile', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('   ✅ Profile retrieved');
    const profile = profileResponse.data.user;
    console.log(`   📋 Profile Is Subscribed: ${profile.is_subscribed}`);
    console.log(`   📋 Profile Subscription Tier: ${profile.subscription_tier}`);
    
    console.log('\n🎉 Authentication Flow Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  } finally {
    process.exit();
  }
}

testAuthFlow();
