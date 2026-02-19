const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testAuthEndpoints() {
  console.log('🔐 Testing Auth API Endpoints...\n');
  
  try {
    // Test 1: User Registration with proper validation
    console.log('1️⃣ Testing User Registration...');
    const registerData = {
      username: 'testuser123',
      email: 'test123@example.com',
      password: 'TestPass123!',
      phone: '+1234567890'
    };
    
    try {
      const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
      console.log('✅ Registration successful:', registerResponse.data.message);
      console.log('   User ID:', registerResponse.data.user.id);
      console.log('   Token:', registerResponse.data.token ? 'Present' : 'Missing');
    } catch (error) {
      console.log('❌ Registration failed:', error.response?.status);
      console.log('   Error:', error.response?.data?.error || error.message);
      if (error.response?.data?.details) {
        console.log('   Validation Details:', error.response.data.details);
      }
    }
    console.log('');
    
    // Test 2: User Login
    console.log('2️⃣ Testing User Login...');
    const loginData = {
      email: 'test123@example.com',
      password: 'TestPass123!'
    };
    
    try {
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, loginData);
      console.log('✅ Login successful:', loginResponse.data.message);
      console.log('   Token:', loginResponse.data.token ? 'Present' : 'Missing');
    } catch (error) {
      console.log('❌ Login failed:', error.response?.status);
      console.log('   Error:', error.response?.data?.error || error.message);
    }
    console.log('');
    
    console.log('🎉 Auth API tests completed!');
    
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
  }
}

testAuthEndpoints();
