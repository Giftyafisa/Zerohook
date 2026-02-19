const axios = require('axios');

async function testCompleteFlow() {
  console.log('🧪 Testing Complete Payment Flow...\n');

  try {
    // Test 1: Check server health
    console.log('1️⃣ Server health check...');
    const healthResponse = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Server status:', healthResponse.data.status);

    // Test 2: Check if subscription plans exist
    console.log('\n2️⃣ Checking subscription plans...');
    try {
      const plansResponse = await axios.get('http://localhost:5000/api/subscriptions/plans');
      console.log('✅ Subscription plans available:', plansResponse.data.plans?.length || 0);
    } catch (error) {
      console.log('⚠️  Subscription plans endpoint not available');
    }

    // Test 3: Create a test subscription
    console.log('\n3️⃣ Creating test subscription...');
    try {
      const createResponse = await axios.post('http://localhost:5000/api/subscriptions/create', {
        planId: 'Basic Access',
        amount: 20,
        currency: 'USD',
        countryCode: 'GH'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        }
      });

      if (createResponse.data.success) {
        console.log('✅ Test subscription created successfully!');
        console.log('   Subscription ID:', createResponse.data.subscriptionId);
        console.log('   Payment Data:', createResponse.data.paymentData);
        
        // Test 4: Verify the payment manually
        console.log('\n4️⃣ Testing manual payment verification...');
        try {
          const verifyResponse = await axios.post('http://localhost:5000/api/subscriptions/verify-payment-manual', {
            paymentReference: createResponse.data.paymentData.reference,
            userId: '1b574327-9365-4d98-8e49-68cb87bd05a8' // Use a test user ID
          });

          if (verifyResponse.data.success) {
            console.log('✅ Manual payment verification successful!');
            console.log('   Message:', verifyResponse.data.message);
          }
        } catch (verifyError) {
          console.log('❌ Manual verification failed:', verifyError.response?.data?.error || verifyError.message);
        }
      }
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('⚠️  Authentication required for subscription creation');
      } else {
        console.log('❌ Subscription creation failed:', error.response?.data?.error || error.message);
      }
    }

    console.log('\n🎉 Complete flow test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCompleteFlow();



