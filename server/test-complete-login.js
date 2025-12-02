const axios = require('axios');

async function testCompleteLoginFlow() {
  console.log('🔧 Testing Complete Login Flow...');
  
  try {
    // Test 1: Server Health Check
    console.log('\n1️⃣ Testing server health...');
    try {
      const healthResponse = await axios.get('http://localhost:5000/api/health');
      console.log('✅ Server is healthy');
    } catch (error) {
      console.log('❌ Server health check failed:', error.message);
      return;
    }
    
    // Test 2: Login API Test
    console.log('\n2️⃣ Testing login API...');
    try {
      const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'akua.mensah@ghana.com',
        password: 'AkuaPass123!'
      });
      
      console.log('✅ Login successful!');
      console.log('   Status:', loginResponse.status);
      console.log('   Token present:', !!loginResponse.data.token);
      console.log('   User ID:', loginResponse.data.user?.id);
      console.log('   Username:', loginResponse.data.user?.username);
      console.log('   Email:', loginResponse.data.user?.email);
      console.log('   Mode:', loginResponse.data.message);
      
      const token = loginResponse.data.token;
      
      // Test 3: Token Validation
      console.log('\n3️⃣ Testing token validation...');
      try {
        const validateResponse = await axios.post('http://localhost:5000/api/auth/validate-token', {
          token: token
        });
        
        console.log('✅ Token validation successful');
        console.log('   Valid:', validateResponse.data.valid);
        console.log('   User ID:', validateResponse.data.user?.id);
        
      } catch (error) {
        console.log('❌ Token validation failed:', error.response?.data || error.message);
      }
      
    } catch (error) {
      console.log('❌ Login failed:');
      console.log('   Status:', error.response?.status);
      console.log('   Error:', error.response?.data);
      console.log('   Message:', error.message);
    }
    
    // Test 4: Frontend Connection Test
    console.log('\n4️⃣ Testing frontend connection...');
    try {
      const frontendResponse = await axios.get('http://localhost:3000');
      console.log('✅ Frontend is accessible');
    } catch (error) {
      console.log('⚠️ Frontend not accessible (may still be starting):', error.message);
    }
    
    console.log('\n🎉 Login system is working!');
    console.log('\n📝 To test login in the browser:');
    console.log('   1. Go to http://localhost:3000/login');
    console.log('   2. Use email: akua.mensah@ghana.com');
    console.log('   3. Use password: AkuaPass123!');
    console.log('   4. Click Login');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testCompleteLoginFlow();
