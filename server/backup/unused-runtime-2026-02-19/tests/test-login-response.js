const axios = require('axios');

async function testLoginResponse() {
  try {
    console.log('🔍 Testing login response format...\n');
    
    const response = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'akua.mensah@ghana.com',
      password: 'AkuaPass123!'
    });
    
    console.log('✅ Login successful!');
    console.log('📋 Response status:', response.status);
    console.log('📋 Message:', response.data.message);
    console.log('📋 Has token:', !!response.data.token);
    
    console.log('\n📋 User object keys:');
    Object.keys(response.data.user).forEach(key => {
      console.log(`   - ${key}: ${response.data.user[key]}`);
    });
    
    // Check for subscription fields
    console.log('\n🔍 Subscription fields check:');
    const hasIsSubscribed = 'is_subscribed' in response.data.user;
    const hasSubscriptionTier = 'subscription_tier' in response.data.user;
    const hasSubscriptionExpires = 'subscription_expires_at' in response.data.user;
    
    console.log(`   - is_subscribed: ${hasIsSubscribed ? '✅ Present' : '❌ Missing'}`);
    console.log(`   - subscription_tier: ${hasSubscriptionTier ? '✅ Present' : '❌ Missing'}`);
    console.log(`   - subscription_expires_at: ${hasSubscriptionExpires ? '✅ Present' : '❌ Missing'}`);
    
    if (hasIsSubscribed) {
      console.log(`   - is_subscribed value: ${response.data.user.is_subscribed}`);
    }
    if (hasSubscriptionTier) {
      console.log(`   - subscription_tier value: ${response.data.user.subscription_tier}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  } finally {
    process.exit();
  }
}

testLoginResponse();
