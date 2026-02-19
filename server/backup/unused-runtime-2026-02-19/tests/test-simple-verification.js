const axios = require('axios');

async function testSimpleVerification() {
  console.log('🧪 Testing Simple Payment Verification...\n');

  try {
    // Test 1: Check server health
    console.log('1️⃣ Server health check...');
    const healthResponse = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Server status:', healthResponse.data.status);

    // Test 2: Check if the endpoint exists
    console.log('\n2️⃣ Testing endpoint availability...');
    try {
      const testResponse = await axios.post('http://localhost:5000/api/subscriptions/verify-payment-manual', {
        paymentReference: 'TEST_REF',
        userId: 'TEST_USER'
      });
      console.log('✅ Endpoint is accessible');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('❌ Endpoint not found');
      } else if (error.response?.status === 500) {
        console.log('⚠️  Endpoint exists but has server error');
        console.log('   Error details:', error.response.data);
      } else {
        console.log('❌ Unexpected error:', error.response?.status, error.response?.data);
      }
    }

    console.log('\n🎉 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testSimpleVerification();



