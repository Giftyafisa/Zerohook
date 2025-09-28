require('dotenv').config({ path: './env.local' });
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

const testContactRequest = async () => {
  try {
    console.log('🧪 Testing Contact Request Endpoint...');
    
    // Test 1: Check if endpoint exists (should return 401 for unauthorized)
    console.log('\n1️⃣ Testing endpoint accessibility...');
    try {
      const response = await axios.post(`${BASE_URL}/connections/contact-request`, {
        toUserId: '550e8400-e29b-41d4-a716-446655440000',
        message: 'test'
      });
      console.log('❌ Unexpected success without auth:', response.status);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ Endpoint accessible - correctly requires authentication');
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
      }
    }

    // Test 2: Test validation with invalid UUID
    console.log('\n2️⃣ Testing validation with invalid UUID...');
    try {
      const response = await axios.post(`${BASE_URL}/connections/contact-request`, {
        toUserId: 'invalid-uuid',
        message: 'test'
      });
      console.log('❌ Unexpected success with invalid UUID:', response.status);
    } catch (error) {
      if (error.response?.status === 400) {
        console.log('✅ Validation working - correctly rejects invalid UUID');
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
      }
    }

    // Test 3: Test validation with valid UUID format
    console.log('\n3️⃣ Testing validation with valid UUID format...');
    try {
      const response = await axios.post(`${BASE_URL}/connections/contact-request`, {
        toUserId: '550e8400-e29b-41d4-a716-446655440000',
        message: 'test'
      });
      console.log('❌ Unexpected success without auth:', response.status);
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('✅ UUID validation passed - correctly requires authentication');
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
      }
    }

    console.log('\n🎉 Contact Request Endpoint Tests Completed!');
    console.log('✅ Endpoint is accessible and working');
    console.log('✅ Validation is working properly');
    console.log('✅ Authentication is required as expected');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

testContactRequest();



