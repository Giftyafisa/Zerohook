const axios = require('axios');

async function testPaymentFlow() {
  console.log('🧪 Testing Payment Flow...\n');

  try {
    // Test 1: Check if server is running
    console.log('1️⃣ Testing server health...');
    const healthResponse = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Server health:', healthResponse.data.status);
    console.log('   Services:', Object.keys(healthResponse.data.services).filter(key => healthResponse.data.services[key]).join(', '));

    // Test 2: Check countries API
    console.log('\n2️⃣ Testing countries API...');
    const countriesResponse = await axios.get('http://localhost:5000/api/countries');
    console.log('✅ Countries API working');
    console.log('   Found countries:', countriesResponse.data.countries.length);

    // Test 3: Test subscription creation with different countries
    console.log('\n3️⃣ Testing subscription creation...');
    
    const testCountries = ['NG', 'GH', 'KE', 'ZA'];
    
    for (const country of testCountries) {
      try {
        console.log(`   Testing ${country}...`);
        const subscriptionResponse = await axios.post('http://localhost:5000/api/subscriptions/create', {
          planId: 'Basic Access',
          amount: 20,
          currency: 'USD',
          countryCode: country
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }
        });

        if (subscriptionResponse.data.success) {
          console.log(`   ✅ ${country}: Subscription created successfully`);
          console.log(`      Payment URL: ${subscriptionResponse.data.paymentData.authorizationUrl}`);
          console.log(`      Test Mode: ${subscriptionResponse.data.paymentData.isTestMode}`);
        }
      } catch (error) {
        console.log(`   ❌ ${country}: ${error.response?.data?.error || error.message}`);
      }
    }

    console.log('\n🎉 Payment flow test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPaymentFlow();



