const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function debugAPIResponse() {
  console.log('🔍 Debugging API Response Structure...\n');
  
  try {
    // Test 1: Login and see full response
    console.log('1️⃣ Testing Login Response Structure...');
    const loginData = {
      email: 'akua.mensah@ghana.com',
      password: 'AkuaPass123!'
    };
    
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, loginData);
    console.log('✅ Login Response Structure:');
    console.log('   Status:', loginResponse.status);
    console.log('   Message:', loginResponse.data.message);
    console.log('   Full Response:', JSON.stringify(loginResponse.data, null, 2));
    
    const token = loginResponse.data.token;
    
    // Test 2: Get profile and see full response
    console.log('\n2️⃣ Testing Profile Response Structure...');
    try {
      const profileResponse = await axios.get(`${BASE_URL}/users/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Profile Response Structure:');
      console.log('   Status:', profileResponse.status);
      console.log('   Full Response:', JSON.stringify(profileResponse.data, null, 2));
    } catch (error) {
      console.log('❌ Profile Error:', error.response?.data || error.message);
    }
    
    // Test 3: Get services and see full response
    console.log('\n3️⃣ Testing Services Response Structure...');
    try {
      const servicesResponse = await axios.get(`${BASE_URL}/services`);
      console.log('✅ Services Response Structure:');
      console.log('   Status:', servicesResponse.status);
      console.log('   Total Services:', servicesResponse.data?.length || 'No length property');
      console.log('   First Service:', servicesResponse.data?.[0] ? JSON.stringify(servicesResponse.data[0], null, 2) : 'No services');
    } catch (error) {
      console.log('❌ Services Error:', error.response?.data || error.message);
    }
    
  } catch (error) {
    console.error('💥 Debug failed:', error.response?.data || error.message);
  }
}

debugAPIResponse();
