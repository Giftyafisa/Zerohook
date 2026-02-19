const axios = require('axios');

async function testMockLogin() {
  try {
    console.log('🔧 Testing mock login system...');
    
    // Test if server is running
    try {
      const healthCheck = await axios.get('http://localhost:5000/api/health');
      console.log('✅ Server is running');
    } catch (error) {
      console.log('❌ Server not running:', error.message);
      return;
    }
    
    // Test login with mock data
    console.log('🔧 Testing login endpoint...');
    
    try {
      const response = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'akua.mensah@ghana.com',
        password: 'AkuaPass123!'
      });
      
      console.log('✅ Login successful!');
      console.log('   Token:', response.data.token ? 'Present' : 'Missing');
      console.log('   User:', response.data.user ? response.data.user.username : 'Missing');
      
    } catch (error) {
      console.log('❌ Login failed:');
      console.log('   Status:', error.response?.status);
      console.log('   Error:', error.response?.data);
      console.log('   Message:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Test error:', error.message);
  }
}

testMockLogin();
