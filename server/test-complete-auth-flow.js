const axios = require('axios');

async function testCompleteAuthFlow() {
  try {
    console.log('🚀 Testing Complete Authentication & Subscription Flow...\n');
    
    // Step 1: Test Login
    console.log('1️⃣ Testing Login...');
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'akua.mensah@ghana.com',
      password: 'AkuaPass123!'
    });
    
    if (loginResponse.data.token) {
      console.log('   ✅ Login successful');
      console.log('   📋 Token received:', loginResponse.data.token ? 'Yes' : 'No');
      
      const user = loginResponse.data.user;
      console.log('   📋 User data received:');
      console.log(`      - ID: ${user.id}`);
      console.log(`      - Username: ${user.username}`);
      console.log(`      - Email: ${user.email}`);
      console.log(`      - Is Subscribed: ${user.is_subscribed}`);
      console.log(`      - Subscription Tier: ${user.subscription_tier}`);
      console.log(`      - Subscription Expires: ${user.subscription_expires_at}`);
      
      // Check if subscription fields are present
      const hasSubscriptionFields = user.hasOwnProperty('is_subscribed') && 
                                  user.hasOwnProperty('subscription_tier') && 
                                  user.hasOwnProperty('subscription_expires_at');
      
      if (hasSubscriptionFields) {
        console.log('   ✅ All subscription fields present');
      } else {
        console.log('   ❌ Missing subscription fields');
        console.log('      Available fields:', Object.keys(user));
      }
      
      const token = loginResponse.data.token;
      
      // Step 2: Test Profile Endpoint
      console.log('\n2️⃣ Testing Profile Endpoint...');
      try {
        const profileResponse = await axios.get('http://localhost:5000/api/users/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (profileResponse.data.user) {
          const profile = profileResponse.data.user;
          console.log('   ✅ Profile retrieved successfully');
          console.log('   📋 Profile subscription data:');
          console.log(`      - Is Subscribed: ${profile.is_subscribed}`);
          console.log(`      - Subscription Tier: ${profile.subscription_tier}`);
          console.log(`      - Subscription Expires: ${profile.subscription_expires_at}`);
          
          // Check if profile has subscription fields
          const profileHasSubscriptionFields = profile.hasOwnProperty('is_subscribed') && 
                                            profile.hasOwnProperty('subscription_tier') && 
                                            profile.hasOwnProperty('subscription_expires_at');
          
          if (profileHasSubscriptionFields) {
            console.log('   ✅ Profile includes all subscription fields');
          } else {
            console.log('   ❌ Profile missing subscription fields');
            console.log('      Available fields:', Object.keys(profile));
          }
        } else {
          console.log('   ❌ Profile response missing user data');
        }
      } catch (error) {
        console.log('   ❌ Profile endpoint failed:', error.response?.status, error.response?.data?.error);
      }
      
      // Step 3: Test Subscription Status Endpoint
      console.log('\n3️⃣ Testing Subscription Status Endpoint...');
      try {
        const subscriptionResponse = await axios.get('http://localhost:5000/api/subscriptions/status', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (subscriptionResponse.data.success) {
          console.log('   ✅ Subscription status retrieved');
          console.log('   📋 Subscription data:');
          console.log(`      - Is Subscribed: ${subscriptionResponse.data.isSubscribed}`);
          console.log(`      - Subscription: ${subscriptionResponse.data.subscription ? 'Present' : 'None'}`);
        } else {
          console.log('   ❌ Subscription status failed:', subscriptionResponse.data.error);
        }
      } catch (error) {
        console.log('   ❌ Subscription status endpoint failed:', error.response?.status, error.response?.data?.error);
      }
      
      // Step 4: Test Token Refresh
      console.log('\n4️⃣ Testing Token Refresh...');
      try {
        const refreshResponse = await axios.post('http://localhost:5000/api/auth/refresh', {}, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (refreshResponse.data.token) {
          console.log('   ✅ Token refresh successful');
          console.log('   📋 New token received:', refreshResponse.data.token ? 'Yes' : 'No');
          
          if (refreshResponse.data.user) {
            const refreshUser = refreshResponse.data.user;
            console.log('   📋 Refresh user data:');
            console.log(`      - Is Subscribed: ${refreshUser.is_subscribed}`);
            console.log(`      - Subscription Tier: ${refreshUser.subscription_tier}`);
            console.log(`      - Subscription Expires: ${refreshUser.subscription_expires_at}`);
            
            // Check if refresh includes subscription fields
            const refreshHasSubscriptionFields = refreshUser.hasOwnProperty('is_subscribed') && 
                                              refreshUser.hasOwnProperty('subscription_tier') && 
                                              refreshUser.hasOwnProperty('subscription_expires_at');
            
            if (refreshHasSubscriptionFields) {
              console.log('   ✅ Token refresh includes all subscription fields');
            } else {
              console.log('   ❌ Token refresh missing subscription fields');
            }
          } else {
            console.log('   ❌ Token refresh missing user data');
          }
        } else {
          console.log('   ❌ Token refresh failed:', refreshResponse.data.error);
        }
      } catch (error) {
        console.log('   ❌ Token refresh failed:', error.response?.status, error.response?.data?.error);
      }
      
      // Step 5: Test Protected Route Access
      console.log('\n5️⃣ Testing Protected Route Access...');
      try {
        const protectedResponse = await axios.get('http://localhost:5000/api/subscriptions/plans', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (protectedResponse.data.success) {
          console.log('   ✅ Protected route access successful');
          console.log(`   📋 Found ${protectedResponse.data.plans?.length || 0} subscription plans`);
        } else {
          console.log('   ❌ Protected route access failed:', protectedResponse.data.error);
        }
      } catch (error) {
        console.log('   ❌ Protected route access failed:', error.response?.status, error.response?.data?.error);
      }
      
    } else {
      console.log('   ❌ Login failed:', loginResponse.data.error);
    }
    
    console.log('\n🎉 Complete Authentication Flow Test Finished!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    process.exit();
  }
}

testCompleteAuthFlow();
