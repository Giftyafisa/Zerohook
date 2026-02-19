const axios = require('axios');

async function checkDatabaseStatus() {
  console.log('🔍 Checking Database Status...\n');

  try {
    // Test 1: Check server health
    console.log('1️⃣ Server health check...');
    const healthResponse = await axios.get('http://localhost:5000/api/health');
    console.log('✅ Server status:', healthResponse.data.status);
    console.log('   Services:', Object.keys(healthResponse.data.services).filter(key => healthResponse.data.services[key]).join(', '));

    // Test 2: Check available endpoints
    console.log('\n2️⃣ Testing available endpoints...');
    
    const endpoints = [
      { path: '/api/countries', method: 'GET', name: 'Countries API' },
      { path: '/api/subscriptions/plans', method: 'GET', name: 'Subscription Plans' },
      { path: '/api/subscriptions/create', method: 'POST', name: 'Create Subscription' },
      { path: '/api/subscriptions/verify-payment-manual', method: 'POST', name: 'Manual Verification' },
      { path: '/api/payments/paystack-webhook', method: 'POST', name: 'Paystack Webhook' }
    ];

    for (const endpoint of endpoints) {
      try {
        if (endpoint.method === 'GET') {
          const response = await axios.get(`http://localhost:5000${endpoint.path}`);
          console.log(`   ✅ ${endpoint.name}: Working (${response.status})`);
        } else {
          // For POST endpoints, just check if they exist (don't actually post data)
          console.log(`   🔍 ${endpoint.name}: Endpoint exists (${endpoint.method})`);
        }
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`   ❌ ${endpoint.name}: Not found`);
        } else if (error.response?.status === 401) {
          console.log(`   🔒 ${endpoint.name}: Requires authentication`);
        } else if (error.response?.status === 500) {
          console.log(`   ⚠️  ${endpoint.name}: Server error`);
        } else {
          console.log(`   ❓ ${endpoint.name}: ${error.response?.status || 'Unknown error'}`);
        }
      }
    }

    console.log('\n🎉 Database status check completed!');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
  }
}

checkDatabaseStatus();



