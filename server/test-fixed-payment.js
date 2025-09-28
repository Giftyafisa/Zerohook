const axios = require('axios');

async function testFixedPayment() {
  console.log('🧪 Testing Fixed Payment Flow...\n');

  try {
    // Test subscription creation with Ghana (which worked in logs)
    console.log('1️⃣ Testing subscription creation with Ghana...');
    
    const subscriptionResponse = await axios.post('http://localhost:5000/api/subscriptions/create', {
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

    if (subscriptionResponse.data.success) {
      console.log('✅ Subscription created successfully!');
      console.log('   Message:', subscriptionResponse.data.message);
      console.log('   Subscription ID:', subscriptionResponse.data.subscriptionId);
      console.log('   Payment Data:', subscriptionResponse.data.paymentData);
      
      if (subscriptionResponse.data.paymentData.authorizationUrl) {
        console.log('   🌐 Paystack URL:', subscriptionResponse.data.paymentData.authorizationUrl);
        console.log('   💡 Users can now click this URL to complete payment!');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data?.error || error.message);
    
    if (error.response?.status === 500) {
      console.log('🔍 Server error details:', error.response.data);
    }
  }
}

testFixedPayment();



