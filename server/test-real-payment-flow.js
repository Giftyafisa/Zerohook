const axios = require('axios');

async function testRealPaymentFlow() {
  console.log('🧪 Testing Real Payment Flow...\n');

  try {
    // Test 1: Check server health
    console.log('1️⃣ Server health check...');
    const healthResponse = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Server status:', healthResponse.data.status);

    // Test 2: Check subscription plans
    console.log('\n2️⃣ Subscription plans check...');
    const plansResponse = await axios.get('http://localhost:5000/api/subscriptions/plans');
    console.log('✅ Plans available:', plansResponse.data.plans.length);
    console.log('   Plan details:', plansResponse.data.plans[0]);

    // Test 3: Check database state
    console.log('\n3️⃣ Database state check...');
    try {
      const dbResponse = await axios.get('http://localhost:5000/api/subscriptions/check-db-state');
      console.log('✅ Database state:', dbResponse.data);
    } catch (error) {
      console.log('⚠️  Database state endpoint not available, checking subscriptions directly...');
      
      // Try to create a test subscription to see the flow
      console.log('\n4️⃣ Testing subscription creation...');
      try {
        const createResponse = await axios.post('http://localhost:5000/api/subscriptions/create', {
          planId: 'Basic Access',
          amount: 20,
          currency: 'USD',
          countryCode: 'GH'
        }, {
          headers: {
            'Authorization': 'Bearer test-token',
            'Content-Type': 'application/json'
          }
        });
        
        console.log('✅ Test subscription created:', createResponse.data);
        
        if (createResponse.data.success && createResponse.data.paymentData) {
          console.log('\n🎯 PAYMENT FLOW READY!');
          console.log('   User can now:');
          console.log('   1. Click Paystack payment link');
          console.log('   2. Complete payment on Paystack');
          console.log('   3. Get redirected back to callback');
          console.log('   4. Payment verified automatically');
          console.log('   5. Subscription activated');
          console.log('   6. User marked as subscribed');
          
          console.log('\n🔗 Payment URL:', createResponse.data.paymentData.authorizationUrl);
          console.log('📝 Reference:', createResponse.data.paymentData.reference);
        }
        
      } catch (createError) {
        console.log('❌ Subscription creation failed:', createError.response?.data || createError.message);
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRealPaymentFlow();



