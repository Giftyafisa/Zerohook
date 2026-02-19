const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testRealAuthEndpoints() {
  console.log('🔐 Testing Real Auth API Endpoints...\n');
  
  try {
    // Test 1: User Login with real user
    console.log('1️⃣ Testing User Login with real user...');
    const loginData = {
      email: 'akua.mensah@ghana.com',
      password: 'AkuaPass123!'
    };
    
    try {
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, loginData);
      console.log('✅ Login successful:', loginResponse.data.message);
      console.log('   User ID:', loginResponse.data.user.id);
      console.log('   Username:', loginResponse.data.user.username);
      console.log('   Verification Tier:', loginResponse.data.user.verification_tier);
      console.log('   Token:', loginResponse.data.token ? 'Present' : 'Missing');
      
      const token = loginResponse.data.token;
      
      // Test 2: Get user profile with token
      console.log('\n2️⃣ Testing Get User Profile...');
      try {
        const profileResponse = await axios.get(`${BASE_URL}/users/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('✅ Profile retrieved successfully');
        console.log('   Username:', profileResponse.data.user.username);
        console.log('   Email:', profileResponse.data.user.email);
        console.log('   Verification Tier:', profileResponse.data.user.verification_tier);
        console.log('   Profile Data:', JSON.stringify(profileResponse.data.user.profile_data, null, 2));
      } catch (error) {
        console.log('❌ Profile retrieval failed:', error.response?.status);
        console.log('   Error:', error.response?.data?.error || error.message);
      }
      
      // Test 3: Get services
      console.log('\n3️⃣ Testing Get Services...');
      try {
        const servicesResponse = await axios.get(`${BASE_URL}/services`);
        console.log('✅ Services retrieved successfully');
        console.log('   Response Type:', typeof servicesResponse.data);
        console.log('   Response Keys:', Object.keys(servicesResponse.data || {}));
        console.log('   Full Response:', JSON.stringify(servicesResponse.data, null, 2));
      } catch (error) {
        console.log('❌ Services retrieval failed:', error.response?.status);
        console.log('   Error:', error.response?.data?.error || error.message);
      }
      
    } catch (error) {
      console.log('❌ Login failed:', error.response?.status);
      console.log('   Error:', error.response?.data?.error || error.message);
    }
    
    console.log('\n🎉 Real Auth API tests completed!');
    
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
  }
}

testRealAuthEndpoints();
