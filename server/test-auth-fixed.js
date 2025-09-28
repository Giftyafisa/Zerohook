const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testAuthEndpointsFixed() {
  console.log('🔐 Testing Auth API Endpoints (Fixed)...\n');
  
  try {
    // Test 1: User Registration with corrected phone format
    console.log('1️⃣ Testing User Registration...');
    const registerData = {
      username: 'testuser123',
      email: 'test123@example.com',
      password: 'TestPass123!',
      phone: '1234567890' // Removed + for validation
    };
    
    try {
      const registerResponse = await axios.post(`${BASE_URL}/auth/register`, registerData);
      console.log('✅ Registration successful:', registerResponse.data.message);
      console.log('   User ID:', registerResponse.data.user.id);
      console.log('   Token:', registerResponse.data.token ? 'Present' : 'Missing');
      
      // Test 2: User Login with the created user
      console.log('\n2️⃣ Testing User Login...');
      const loginData = {
        email: 'test123@example.com',
        password: 'TestPass123!'
      };
      
      try {
        const loginResponse = await axios.post(`${BASE_URL}/auth/login`, loginData);
        console.log('✅ Login successful:', registerResponse.data.message);
        console.log('   Token:', loginResponse.data.token ? 'Present' : 'Missing');
      } catch (error) {
        console.log('❌ Login failed:', error.response?.status);
        console.log('   Error:', error.response?.data?.error || error.message);
      }
      
    } catch (error) {
      console.log('❌ Registration failed:', error.response?.status);
      console.log('   Error:', error.response?.data?.error || error.message);
      if (error.response?.data?.details) {
        console.log('   Validation Details:', error.response.data.details);
      }
      
      // Try without phone number
      console.log('\n🔄 Trying registration without phone number...');
      const registerDataNoPhone = {
        username: 'testuser456',
        email: 'test456@example.com',
        password: 'TestPass123!'
        // No phone field
      };
      
      try {
        const registerResponse2 = await axios.post(`${BASE_URL}/auth/register`, registerDataNoPhone);
        console.log('✅ Registration successful (no phone):', registerResponse2.data.message);
        console.log('   User ID:', registerResponse2.data.user.id);
        console.log('   Token:', registerResponse2.data.token ? 'Present' : 'Missing');
        
        // Test login with this user
        console.log('\n2️⃣ Testing User Login...');
        const loginData2 = {
          email: 'test456@example.com',
          password: 'TestPass123!'
        };
        
        try {
          const loginResponse2 = await axios.post(`${BASE_URL}/auth/login`, loginData2);
          console.log('✅ Login successful:', loginResponse2.data.message);
          console.log('   Token:', loginResponse2.data.token ? 'Present' : 'Missing');
        } catch (error) {
          console.log('❌ Login failed:', error.response?.status);
          console.log('   Error:', error.response?.data?.error || error.message);
        }
        
      } catch (error2) {
        console.log('❌ Registration without phone also failed:', error2.response?.status);
        console.log('   Error:', error2.response?.data?.error || error2.message);
      }
    }
    
    console.log('\n🎉 Auth API tests completed!');
    
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
  }
}

testAuthEndpointsFixed();
