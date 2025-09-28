const axios = require('axios');

async function testCurrentFixes() {
  console.log('🧪 TESTING CURRENT FIXES - BROWSE PROFILES SYSTEM\n');
  
  try {
    // Test 1: Backend Profiles Endpoint
    console.log('1️⃣ Testing Backend Profiles Endpoint...');
    try {
      const profilesResponse = await axios.get('http://localhost:5000/api/users/profiles');
      console.log('   ✅ Profiles endpoint working');
      console.log('   📋 Response status:', profilesResponse.status);
      console.log('   📋 Users found:', profilesResponse.data.users?.length || 0);
      
      if (profilesResponse.data.users && profilesResponse.data.users.length > 0) {
        const firstUser = profilesResponse.data.users[0];
        console.log('   📋 Sample user data structure:');
        console.log(`      - ID: ${firstUser.id}`);
        console.log(`      - Username: ${firstUser.username}`);
        console.log(`      - Has profile_data: ${!!firstUser.profile_data}`);
        console.log(`      - Profile data type: ${typeof firstUser.profile_data}`);
        
        if (firstUser.profile_data) {
          console.log('   📋 Profile data fields:');
          console.log(`      - firstName: ${firstUser.profile_data.firstName || 'undefined'}`);
          console.log(`      - lastName: ${firstUser.profile_data.lastName || 'undefined'}`);
          console.log(`      - age: ${firstUser.profile_data.age || 'undefined'}`);
          console.log(`      - location: ${!!firstUser.profile_data.location}`);
        }
      }
    } catch (error) {
      console.log('   ❌ Profiles endpoint failed:', error.response?.status, error.response?.data?.error);
    }
    
    // Test 2: Authentication Flow
    console.log('\n2️⃣ Testing Authentication Flow...');
    try {
      const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
        email: 'akua.mensah@ghana.com',
        password: 'AkuaPass123!'
      });
      
      if (loginResponse.data.token) {
        console.log('   ✅ Login successful');
        const token = loginResponse.data.token;
        
        // Test contact request endpoint
        try {
          const contactResponse = await axios.post('http://localhost:5000/api/connections/contact-request', {
            toUserId: '1b574327-9365-4d98-8e49-68cb87bd05a8',
            message: 'Test contact request',
            connectionType: 'contact_request'
          }, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          console.log('   ✅ Contact request endpoint working');
          console.log('   📋 Response:', contactResponse.data);
        } catch (error) {
          console.log('   ❌ Contact request failed:', error.response?.status, error.response?.data?.error);
        }
        
      } else {
        console.log('   ❌ Login failed');
      }
    } catch (error) {
      console.log('   ❌ Authentication test failed:', error.message);
    }
    
    // Test 3: Frontend Accessibility
    console.log('\n3️⃣ Testing Frontend Accessibility...');
    try {
      const frontendResponse = await axios.get('http://localhost:3000');
      console.log('   ✅ Frontend accessible');
      console.log('   📋 Status:', frontendResponse.status);
      
      // Test profiles page specifically
      try {
        const profilesPageResponse = await axios.get('http://localhost:3000/profiles');
        console.log('   ✅ Profiles page accessible');
        console.log('   📋 Status:', profilesPageResponse.status);
      } catch (error) {
        console.log('   ❌ Profiles page not accessible:', error.message);
      }
      
    } catch (error) {
      console.log('   ❌ Frontend not accessible:', error.message);
    }
    
    // Test 4: Current Fix Status
    console.log('\n4️⃣ CURRENT FIX STATUS...');
    console.log('   🔍 Implemented Fixes:');
    console.log('      ✅ Authentication context integration');
    console.log('      ✅ Contact authentication check');
    console.log('      ✅ Profile data structure processing');
    console.log('      ✅ Error handling in fetchProfiles');
    console.log('      ✅ Error display in UI');
    console.log('      ✅ API_BASE_URL environment variable usage');
    
    console.log('\n   🚧 Pending Fixes:');
    console.log('      ❌ Backend pagination (needs edit_file tool)');
    console.log('      ❌ Frontend pagination integration');
    console.log('      ❌ Database indexes');
    console.log('      ❌ Advanced filtering');
    console.log('      ❌ Caching implementation');
    
    console.log('\n   🎯 Next Steps:');
    console.log('      1. Test current fixes in browser');
    console.log('      2. Verify authentication flow works');
    console.log('      3. Check profile data display');
    console.log('      4. Test contact functionality (when logged in)');
    console.log('      5. Continue with remaining fixes');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    process.exit();
  }
}

testCurrentFixes();
