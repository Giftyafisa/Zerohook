require('dotenv').config({ path: './env.local' });
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

const testContactRequest = async () => {
  try {
    console.log('🧪 Testing Contact Request Validation...');
    
    // Test 1: Check if the endpoint exists
    console.log('\n📊 Test 1: Endpoint Check');
    try {
      const response = await axios.get(`${BASE_URL}/connections/contact-request`);
      console.log('✅ Endpoint exists (GET response):', response.status);
    } catch (error) {
      if (error.response && error.response.status === 405) {
        console.log('✅ Endpoint exists (Method Not Allowed for GET)');
      } else {
        console.log('❌ Endpoint check failed:', error.message);
        console.log('📝 Response status:', error.response?.status);
        console.log('📝 Response data:', error.response?.data);
      }
    }
    
    // Test 2: Check validation without authentication
    console.log('\n📊 Test 2: Validation Without Auth');
    try {
      const response = await axios.post(`${BASE_URL}/connections/contact-request`, {
        toUserId: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID format
        message: 'Test message',
        connectionType: 'contact_request'
      });
      console.log('❌ Should have failed without auth:', response.status);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Correctly rejected without auth');
      } else {
        console.log('⚠️ Unexpected error without auth:', error.response?.status, error.response?.data);
      }
    }
    
    // Test 3: Check validation with invalid data
    console.log('\n📊 Test 3: Invalid Data Validation');
    try {
      const response = await axios.post(`${BASE_URL}/connections/contact-request`, {
        toUserId: 'invalid-uuid', // Invalid UUID format
        message: 'Test message',
        connectionType: 'contact_request'
      }, {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });
      console.log('❌ Should have failed with invalid UUID:', response.status);
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly rejected invalid UUID');
        console.log('📝 Error details:', error.response.data);
      } else {
        console.log('⚠️ Unexpected error with invalid UUID:', error.response?.status, error.response?.data);
      }
    }
    
    // Test 4: Check validation with valid UUID format
    console.log('\n📊 Test 4: Valid UUID Format');
    try {
      const response = await axios.post(`${BASE_URL}/connections/contact-request`, {
        toUserId: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID format
        message: 'Test message',
        connectionType: 'contact_request'
      }, {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });
      console.log('❌ Should have failed with invalid token:', response.status);
    } catch (error) {
      if (error.response && error.response.status === 401) {
        console.log('✅ Correctly rejected invalid token');
      } else {
        console.log('⚠️ Unexpected error with valid UUID:', error.response?.status, error.response?.data);
      }
    }
    
    // Test 5: Check if server is running and routes are mounted
    console.log('\n📊 Test 5: Server Health Check');
    try {
      const response = await axios.get(`${BASE_URL}/health`);
      console.log('✅ Server health check:', response.status);
    } catch (error) {
      console.log('❌ Server health check failed:', error.message);
    }
    
    // Test 6: Check if other routes are working
    console.log('\n📊 Test 6: Other Routes Check');
    try {
      const response = await axios.get(`${BASE_URL}/users/profiles`);
      console.log('✅ Users profiles route working:', response.status);
    } catch (error) {
      console.log('❌ Users profiles route failed:', error.response?.status, error.response?.data?.error);
    }
    
    console.log('\n🎉 Contact Request Validation Test Completed!');
    console.log('💡 Check the error details above to identify the validation issue');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

testContactRequest();
