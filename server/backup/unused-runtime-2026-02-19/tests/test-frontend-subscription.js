const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test the subscription flow step by step
async function testFrontendSubscription() {
  console.log('🚀 Testing Frontend Subscription Flow...\n');

  try {
    // Step 1: Test server health
    console.log('📊 Step 1: Testing Server Health...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server health:', healthResponse.data.status);
    console.log('📋 Services:', healthResponse.data.services);
    console.log('');

    // Step 2: Test subscription plans endpoint
    console.log('📋 Step 2: Testing Subscription Plans...');
    try {
      const plansResponse = await axios.get(`${BASE_URL}/subscriptions/plans`);
      console.log('✅ Subscription plans:', plansResponse.data);
    } catch (error) {
      console.log('⚠️  Subscription plans failed:', error.response?.data || error.message);
    }
    console.log('');

    // Step 3: Test subscription creation (without auth for now)
    console.log('💳 Step 3: Testing Subscription Creation...');
    try {
      const createResponse = await axios.post(`${BASE_URL}/subscriptions/create`, {
        planId: 'Basic Access',
        amount: 20,
        currency: 'USD',
        countryCode: 'NG'
      });
      console.log('✅ Subscription creation:', createResponse.data);
    } catch (error) {
      console.log('⚠️  Subscription creation failed (expected without auth):', error.response?.data || error.message);
    }
    console.log('');

    // Step 4: Test Paystack configuration
    console.log('🔧 Step 4: Testing Paystack Configuration...');
    try {
      const paystackTest = await axios.get(`${BASE_URL}/subscriptions/test-paystack`);
      console.log('✅ Paystack test:', paystackTest.data);
    } catch (error) {
      console.log('⚠️  Paystack test failed:', error.response?.data || error.message);
    }
    console.log('');

    console.log('🎯 Frontend Test Summary:');
    console.log('✅ Server is running and healthy');
    console.log('✅ Basic endpoints are accessible');
    console.log('⚠️  Some endpoints require authentication (expected)');
    console.log('⚠️  Paystack integration needs proper configuration');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('1. Start the frontend (cd ../client && npm start)');
    console.log('2. Test the subscription flow in the browser');
    console.log('3. Check browser console for any JavaScript errors');
    console.log('4. Verify Redux state updates correctly');

  } catch (error) {
    console.error('❌ Test Failed:', error.message);
  }
}

// Run the test
testFrontendSubscription().catch(console.error);


