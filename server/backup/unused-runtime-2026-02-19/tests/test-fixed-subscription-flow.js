const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testFixedSubscriptionFlow() {
  console.log('🚀 Testing Fixed Subscription Flow...\n');

  try {
    // Wait for server to start
    console.log('⏳ Waiting for server to start...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Test server health
    console.log('📊 Testing Server Health...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    console.log('✅ Server health:', healthResponse.data.status);
    console.log('');

    // Test the Paystack callback with a real reference from the database
    console.log('🔄 Testing Paystack Callback with Real Reference...');
    const testReference = 'SUB_1756093448697_1b574327-9365-4d98-8e49-68cb87bd05a8';
    
    try {
      const callbackResponse = await axios.get(`${BASE_URL}/subscriptions/paystack-callback?reference=${testReference}`);
      console.log('✅ Callback response:', callbackResponse.data);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('❌ Callback still not finding subscription - issue persists');
      } else {
        console.log('⚠️  Callback error:', error.response?.data || error.message);
      }
    }
    console.log('');

    // Test the new verify-payment-by-reference endpoint
    console.log('🔍 Testing Payment Verification by Reference...');
    try {
      const verifyResponse = await axios.post(`${BASE_URL}/subscriptions/verify-payment-by-reference`, {
        paymentReference: testReference
      });
      console.log('✅ Verification response:', verifyResponse.data);
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('❌ Verification still not finding subscription - issue persists');
      } else {
        console.log('⚠️  Verification error:', error.response?.data || error.message);
      }
    }
    console.log('');

    console.log('🎯 Test Summary:');
    console.log('✅ Server is running and healthy');
    console.log('❌ Subscription lookup issue persists');
    console.log('');
    console.log('💡 Next Steps:');
    console.log('1. The backend endpoints are working');
    console.log('2. The subscription lookup is still failing');
    console.log('3. Need to investigate the database query issue further');
    console.log('4. Check if there are any database constraints or triggers interfering');

  } catch (error) {
    console.error('❌ Test Failed:', error.message);
  }
}

// Run the test
testFixedSubscriptionFlow().catch(console.error);


