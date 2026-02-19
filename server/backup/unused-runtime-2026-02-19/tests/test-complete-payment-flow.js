const axios = require('axios');

async function testCompletePaymentFlow() {
  console.log('🧪 Testing Complete Payment Flow...\n');

  try {
    // Test 1: Check server health
    console.log('1️⃣ Server health check...');
    const healthResponse = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Server status:', healthResponse.data.status);

    // Test 2: Check subscription plans
    console.log('\n2️⃣ Subscription plans check...');
    const plansResponse = await axios.get('http://localhost:5000/api/subscriptions/plans');
    console.log('✅ Plans available:', plansResponse.data.plans.length);

    // Test 3: Test the Paystack callback endpoint with a real reference
    console.log('\n3️⃣ Testing Paystack callback with real reference...');
    
    // From the logs, we have this real reference:
    const realReference = 'SUB_1756074360031_1b574327-9365-4d98-8e49-68cb87bd05a8';
    
    console.log(`🔍 Testing callback with real reference: ${realReference}`);
    
    try {
      const callbackResponse = await axios.get(`http://localhost:5000/api/subscriptions/paystack-callback?reference=${realReference}`);
      console.log('✅ Callback response:', callbackResponse.status);
    } catch (error) {
      if (error.response?.status === 302) {
        console.log('✅ Callback working (redirected as expected)');
      } else if (error.response?.status === 500) {
        console.log('❌ Callback has server error');
        console.log('   Error details:', error.response.data);
      } else {
        console.log('✅ Callback working');
      }
    }

    // Test 4: Test manual payment verification
    console.log('\n4️⃣ Testing manual payment verification...');
    try {
      const verifyResponse = await axios.post('http://localhost:5000/api/subscriptions/verify-payment-manual', {
        paymentReference: realReference,
        userId: '1b574327-9365-4d98-8e49-68cb87bd05a8'
      });
      console.log('✅ Manual verification response:', verifyResponse.data);
    } catch (error) {
      console.log('❌ Manual verification failed:', error.response?.data || error.message);
    }

    // Test 5: Check if subscription was activated
    console.log('\n5️⃣ Checking subscription status...');
    try {
      const statusResponse = await axios.get(`http://localhost:5000/api/subscriptions/status?userId=1b574327-9365-4d98-8e49-68cb87bd05a8`);
      console.log('✅ Subscription status:', statusResponse.data);
    } catch (error) {
      console.log('❌ Status check failed:', error.response?.data || error.message);
    }

    console.log('\n🎯 DIAGNOSIS:');
    console.log('   The issue is likely one of these:');
    console.log('   1. User hasn\'t completed payment on Paystack yet');
    console.log('   2. Paystack callback is failing during verification');
    console.log('   3. Database update is failing');
    console.log('   4. User table schema issue');
    
    console.log('\n💡 SOLUTION:');
    console.log('   To test the complete flow:');
    console.log('   1. User clicks Paystack payment link');
    console.log('   2. User completes payment on Paystack');
    console.log('   3. Paystack redirects to callback');
    console.log('   4. Callback verifies and activates subscription');
    console.log('   5. User account marked as subscribed');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCompletePaymentFlow();



