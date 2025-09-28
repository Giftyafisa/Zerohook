const axios = require('axios');

async function testFrontendIntegration() {
  try {
    console.log('🧪 Testing Frontend Integration...\n');
    
    // Test 1: Check if frontend is accessible
    console.log('1️⃣ Testing Frontend Accessibility...');
    try {
      const frontendResponse = await axios.get('http://localhost:3000');
      console.log('   ✅ Frontend accessible at http://localhost:3000');
      console.log('   📋 Status:', frontendResponse.status);
    } catch (error) {
      console.log('   ❌ Frontend not accessible:', error.message);
      console.log('   💡 Make sure the React app is running on port 3000');
    }
    
    // Test 2: Check authentication flow from frontend perspective
    console.log('\n2️⃣ Testing Authentication Flow for Frontend...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'akua.mensah@ghana.com',
      password: 'AkuaPass123!'
    });
    
    if (loginResponse.data.token) {
      console.log('   ✅ Login successful for frontend');
      
      const user = loginResponse.data.user;
      console.log('   📋 Data that will be sent to Redux store:');
      console.log(`      - isAuthenticated: true`);
      console.log(`      - user: ${user.username}`);
      console.log(`      - isSubscribed: ${user.is_subscribed}`);
      console.log(`      - subscription_tier: ${user.subscription_tier}`);
      
      // Check if all required fields are present for Redux
      const requiredFields = ['id', 'username', 'email', 'is_subscribed', 'subscription_tier'];
      const missingFields = requiredFields.filter(field => !user.hasOwnProperty(field));
      
      if (missingFields.length === 0) {
        console.log('   ✅ All required fields present for Redux store');
      } else {
        console.log('   ❌ Missing fields for Redux store:', missingFields);
      }
      
      // Test 3: Check profile endpoint for frontend
      console.log('\n3️⃣ Testing Profile Endpoint for Frontend...');
      const profileResponse = await axios.get('http://localhost:5000/api/users/profile', {
        headers: { 'Authorization': `Bearer ${loginResponse.data.token}` }
      });
      
      if (profileResponse.data.user) {
        const profile = profileResponse.data.user;
        console.log('   ✅ Profile data available for frontend');
        console.log('   📋 Profile data for Redux:');
        console.log(`      - is_subscribed: ${profile.is_subscribed}`);
        console.log(`      - subscription_tier: ${profile.subscription_tier}`);
        console.log(`      - subscription_expires_at: ${profile.subscription_expires_at}`);
        
        // Check if profile has all subscription fields
        const profileFields = ['is_subscribed', 'subscription_tier', 'subscription_expires_at'];
        const missingProfileFields = profileFields.filter(field => !profile.hasOwnProperty(field));
        
        if (missingProfileFields.length === 0) {
          console.log('   ✅ Profile includes all subscription fields for Redux');
        } else {
          console.log('   ❌ Profile missing fields for Redux:', missingProfileFields);
        }
      }
      
      // Test 4: Check subscription status endpoint
      console.log('\n4️⃣ Testing Subscription Status for Frontend...');
      try {
        const subscriptionResponse = await axios.get('http://localhost:5000/api/subscriptions/status', {
          headers: { 'Authorization': `Bearer ${loginResponse.data.token}` }
        });
        
        if (subscriptionResponse.data.success) {
          console.log('   ✅ Subscription status available for frontend');
          console.log('   📋 Subscription data:');
          console.log(`      - isSubscribed: ${subscriptionResponse.data.isSubscribed}`);
          console.log(`      - subscription: ${subscriptionResponse.data.subscription ? 'Present' : 'None'}`);
        } else {
          console.log('   ❌ Subscription status failed:', subscriptionResponse.data.error);
        }
      } catch (error) {
        console.log('   ❌ Subscription status endpoint failed:', error.response?.status, error.response?.data?.error);
      }
      
    } else {
      console.log('   ❌ Login failed for frontend:', loginResponse.data.error);
    }
    
    console.log('\n🎉 Frontend Integration Test Complete!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    process.exit();
  }
}

testFrontendIntegration();
