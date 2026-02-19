require('dotenv').config({ path: './env.local' });
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testRegistration() {
  try {
    console.log('🚀 Testing Registration Endpoint...');
    
    const testData = {
      username: 'testuser123',
      email: 'test123@example.com',
      password: 'TestPass123!',
      phone: '+2348012345678'
    };
    
    console.log('📤 Sending registration data:', testData);
    
    const response = await axios.post(`${BASE_URL}/auth/register`, testData);
    
    console.log('✅ Registration successful!');
    console.log('📊 Response:', response.data);
    
  } catch (error) {
    console.error('❌ Registration failed:');
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    } else {
      console.error('   Error:', error.message);
    }
  }
}

// Start the test
testRegistration();



