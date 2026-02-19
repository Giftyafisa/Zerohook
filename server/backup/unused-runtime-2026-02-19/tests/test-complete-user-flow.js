const axios = require('axios');

const BASE_URL = 'http://localhost:5000';

async function testCompleteUserFlow() {
  console.log('🚀 Testing Complete User Flow...\n');
  
  try {
    // Step 1: Test server health
    console.log('1. Testing server health...');
    try {
      const healthResponse = await axios.get(`${BASE_URL}/health`);
      console.log('✅ Server is healthy:', healthResponse.data);
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
    
    // Step 3: Test profile fetch with authentication
    console.log('\n3. Testing profile fetch with authentication...');
    try {
      const profileResponse = await axios.get(`${BASE_URL}/api/users/profile`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Profile fetch successful');
      const profile = profileResponse.data.user;
      console.log('📋 Profile data:', {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        verificationTier: profile.verification_tier,
        trustScore: profile.reputation_score,
        hasProfileData: !!profile.profile_data
      });
      
      if (profile.profile_data) {
        console.log('📋 Profile details:');
        console.log('   Name:', `${profile.profile_data.firstName} ${profile.profile_data.lastName}`);
        console.log('   Age:', profile.profile_data.age);
        console.log('   Location:', profile.profile_data.location?.city, profile.profile_data.location?.country);
        console.log('   Base Price:', profile.profile_data.basePrice);
        console.log('   Specializations:', profile.profile_data.specializations);
      }
      
    } catch (error) {
      console.log('❌ Profile fetch failed:', error.response?.data?.error || error.message);
      if (error.response?.status === 401) {
        console.log('   This suggests an authentication issue');
      }
    }
    
    // Step 4: Test profile update
    console.log('\n4. Testing profile update...');
    try {
      const updateData = {
        profile_data: {
          bio: 'Updated bio for testing purposes',
          phone: '+233 123 456 789'
        }
      };
      
      const updateResponse = await axios.put(`${BASE_URL}/api/users/profile`, updateData, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ Profile update successful');
      console.log('📋 Update response:', updateResponse.data.message);
      
    } catch (error) {
      console.log('❌ Profile update failed:', error.response?.data?.error || error.message);
    }
    
    // Step 5: Test profiles endpoint (public)
    console.log('\n5. Testing public profiles endpoint...');
    try {
      const profilesResponse = await axios.get(`${BASE_URL}/api/users/profiles`);
      console.log('✅ Public profiles fetch successful');
      console.log('📋 Found', profilesResponse.data.count, 'profiles');
      
      if (profilesResponse.data.users.length > 0) {
        const sampleProfile = profilesResponse.data.users[0];
        console.log('📋 Sample profile:', {
          username: sampleProfile.username,
          hasProfileData: !!sampleProfile.profile_data,
          verificationTier: sampleProfile.verification_tier
        });
      }
      
    } catch (error) {
      console.log('❌ Public profiles fetch failed:', error.response?.data?.error || error.message);
    }
    
    console.log('\n🎉 Complete user flow test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (require.main === module) {
  testCompleteUserFlow();
}
