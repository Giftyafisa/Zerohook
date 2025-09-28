const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';

// Test data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'TestPass123!',
  phone: '+1234567890'
};

const testService = {
  title: 'Test Service',
  description: 'This is a test service',
  price: 100.00,
  duration_minutes: 60,
  location_type: 'flexible'
};

// Helper function to log results
const logResult = (testName, success, data = null, error = null) => {
  const status = success ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} ${testName}`);
  if (data) console.log('   Data:', JSON.stringify(data, null, 2));
  if (error) console.log('   Error:', error.message || error);
  console.log('');
};

// Test 1: Health Check
const testHealthCheck = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    logResult('Health Check', true, response.data);
    return true;
  } catch (error) {
    logResult('Health Check', false, null, error);
    return false;
  }
};

// Test 2: User Registration
const testUserRegistration = async () => {
  try {
    const response = await axios.post(`${BASE_URL}/auth/register`, testUser);
    logResult('User Registration', true, response.data);
    return true;
  } catch (error) {
    logResult('User Registration', false, null, error);
    return false;
  }
};

// Test 3: User Login
const testUserLogin = async () => {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    authToken = response.data.token;
    logResult('User Login', true, { message: response.data.message, hasToken: !!authToken });
    return true;
  } catch (error) {
    logResult('User Login', false, null, error);
    return false;
  }
};

// Test 4: Get User Profile
const testGetProfile = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/users/profile`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    logResult('Get User Profile', true, response.data);
    return true;
  } catch (error) {
    logResult('Get User Profile', false, null, error);
    return false;
  }
};

// Test 5: Create Service
const testCreateService = async () => {
  try {
    const response = await axios.post(`${BASE_URL}/services`, testService, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    logResult('Create Service', true, response.data);
    return response.data.id;
  } catch (error) {
    logResult('Create Service', false, null, error);
    return null;
  }
};

// Test 6: Get Services
const testGetServices = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/services`);
    logResult('Get Services', true, { count: response.data.services?.length || 0 });
    return true;
  } catch (error) {
    logResult('Get Services', false, null, error);
    return false;
  }
};

// Test 7: Create Chat Conversation
const testCreateConversation = async () => {
  try {
    const response = await axios.post(`${BASE_URL}/chat/conversation`, {
      otherUserId: '00000000-0000-0000-0000-000000000001' // Dummy UUID
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    logResult('Create Chat Conversation', true, response.data);
    return response.data.conversationId;
  } catch (error) {
    logResult('Create Chat Conversation', false, null, error);
    return null;
  }
};

// Test 8: Send Message
const testSendMessage = async (conversationId) => {
  try {
    const response = await axios.post(`${BASE_URL}/chat/send`, {
      conversationId: conversationId,
      content: 'Hello! This is a test message.',
      messageType: 'text'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    logResult('Send Message', true, response.data);
    return true;
  } catch (error) {
    logResult('Send Message', false, null, error);
    return false;
  }
};

// Test 9: Get Chat Conversations
const testGetConversations = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/chat/conversations`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    logResult('Get Chat Conversations', true, { count: response.data.conversations?.length || 0 });
    return true;
  } catch (error) {
    logResult('Get Chat Conversations', false, null, error);
    return false;
  }
};

// Test 10: Create Payment Intent
const testCreatePaymentIntent = async (serviceId) => {
  try {
    const response = await axios.post(`${BASE_URL}/payments/create-payment-intent`, {
      amount: 100.00,
      currency: 'usd',
      serviceId: serviceId,
      description: 'Test service payment'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    logResult('Create Payment Intent', true, { 
      hasClientSecret: !!response.data.clientSecret,
      transactionId: response.data.transactionId 
    });
    return response.data.transactionId;
  } catch (error) {
    logResult('Create Payment Intent', false, null, error);
    return null;
  }
};

// Test 11: Get Payment Transactions
const testGetTransactions = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/payments/transactions`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    logResult('Get Payment Transactions', true, { count: response.data.transactions?.length || 0 });
    return true;
  } catch (error) {
    logResult('Get Payment Transactions', false, null, error);
    return false;
  }
};

// Test 12: Get Verification Status
const testGetVerificationStatus = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/verification/status`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    logResult('Get Verification Status', true, response.data);
    return true;
  } catch (error) {
    logResult('Get Verification Status', false, null, error);
    return false;
  }
};

// Test 13: Request Verification Upgrade
const testRequestVerificationUpgrade = async () => {
  try {
    const response = await axios.post(`${BASE_URL}/verification/request-upgrade`, {
      requestedTier: 2,
      reason: 'Testing verification upgrade functionality'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    logResult('Request Verification Upgrade', true, response.data);
    return true;
  } catch (error) {
    logResult('Request Verification Upgrade', false, null, error);
    return false;
  }
};

// Test 14: Get User Files
const testGetUserFiles = async () => {
  try {
    const response = await axios.get(`${BASE_URL}/uploads/user-files`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    logResult('Get User Files', true, { count: response.data.files?.length || 0 });
    return true;
  } catch (error) {
    logResult('Get User Files', false, null, error);
    return false;
  }
};

// Main test runner
const runAllTests = async () => {
  console.log('🚀 Starting API Tests...\n');
  
  let serviceId = null;
  let conversationId = null;
  let transactionId = null;
  
  try {
    // Basic connectivity tests
    await testHealthCheck();
    
    // Authentication tests
    await testUserRegistration();
    await testUserLogin();
    
    if (!authToken) {
      console.log('❌ Cannot continue without authentication token');
      return;
    }
    
    // User and service tests
    await testGetProfile();
    serviceId = await testCreateService();
    await testGetServices();
    
    // Chat tests
    conversationId = await testCreateConversation();
    if (conversationId) {
      await testSendMessage(conversationId);
    }
    await testGetConversations();
    
    // Payment tests
    if (serviceId) {
      transactionId = await testCreatePaymentIntent(serviceId);
    }
    await testGetTransactions();
    
    // Verification tests
    await testGetVerificationStatus();
    await testRequestVerificationUpgrade();
    
    // File upload tests
    await testGetUserFiles();
    
    console.log('🎉 All API tests completed!');
    
  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
  }
};

// Run tests if called directly
if (require.main === module) {
  runAllTests();
}

module.exports = { runAllTests };
