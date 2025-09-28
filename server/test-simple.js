const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testSimpleEndpoints() {
  console.log('🧪 Testing Simple API Endpoints...\n');
  
  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Health Check:', healthResponse.data.status);
    console.log('   Database:', healthResponse.data.services.database);
    console.log('   Redis:', healthResponse.data.services.redis);
    console.log('');
    
    // Test 2: Test User Creation (using test endpoint)
    console.log('2️⃣ Testing Test User Creation...');
    const testUserResponse = await axios.post(`${BASE_URL}/test/create-user`, {
      email: 'test@example.com',
      password: 'password123'
    });
    console.log('✅ Test User Created:', testUserResponse.data.message);
    console.log('   User ID:', testUserResponse.data.user.id);
    console.log('');
    
    // Test 3: Test Login (using test endpoint)
    console.log('3️⃣ Testing Test Login...');
    const testLoginResponse = await axios.post(`${BASE_URL}/test/login`, {
      email: 'test@example.com',
      password: 'password123'
    });
    console.log('✅ Test Login:', testLoginResponse.data.message);
    console.log('   Has Token:', !!testLoginResponse.data.token);
    console.log('');
    
    console.log('🎉 Simple API tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

testSimpleEndpoints();
