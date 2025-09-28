const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testDashboardAPI() {
  console.log('🚀 Testing Dashboard API...\n');
  
  try {
    // Step 1: Test server health
    console.log('1. Testing server health...');
    try {
      const healthResponse = await axios.get(`${BASE_URL}/health`);
      console.log('✅ Server is healthy:', healthResponse.data.status);
    } catch (error) {
      console.log('⚠️  Health check failed, but continuing...');
    }
    
    // Step 2: Test login with real user
    console.log('\n2. Testing user login...');
    const loginData = {
      email: 'akua.mensah@ghana.com',
      password: 'AkuaPass123!'
    };
    
    let authToken = null;
    try {
      const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, loginData);
      console.log('✅ Login successful');
      authToken = loginResponse.data.token;
      console.log('📋 User data:', {
        id: loginResponse.data.user.id,
        username: loginResponse.data.user.username,
        email: loginResponse.data.user.email,
        verificationTier: loginResponse.data.user.verification_tier
      });
    } catch (error) {
      console.log('❌ Login failed:', error.response?.data?.error || error.message);
      return;
    }
    
    // Step 3: Test dashboard stats endpoint
    console.log('\n3. Testing dashboard stats endpoint...');
    try {
      const dashboardResponse = await axios.get(`${BASE_URL}/api/dashboard/stats`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Dashboard stats fetch successful');
      const dashboardData = dashboardResponse.data;
      console.log('📋 Dashboard data:', {
        user: {
          id: dashboardData.user.id,
          username: dashboardData.user.username,
          verificationTier: dashboardData.user.verificationTier,
          trustScore: dashboardData.user.trustScore
        },
        stats: {
          totalEarnings: dashboardData.stats.totalEarnings,
          activeServices: dashboardData.stats.activeServices,
          completedTransactions: dashboardData.stats.completedTransactions,
          totalServices: dashboardData.stats.totalServices
        }
      });
      
    } catch (error) {
      console.log('❌ Dashboard stats fetch failed:', error.response?.data?.error || error.message);
    }
    
    console.log('\n🎉 Dashboard API test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (require.main === module) {
  testDashboardAPI();
}
