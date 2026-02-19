const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testFullUserFlow() {
  console.log('🧪 Testing Full User Flow...\n');
  
  try {
    // Test 1: User Registration
    console.log('1️⃣ Testing User Registration...');
    const newUser = {
      username: 'test_user_flow',
      email: 'testflow@example.com',
      password: 'TestFlow123!',
      phone: '1234567890',
      verification_tier: 1
    };
    
    try {
      const registerResponse = await axios.post(`${BASE_URL}/auth/register`, newUser);
      console.log('✅ Registration successful:', registerResponse.data.message);
      console.log('   User ID:', registerResponse.data.user.id);
      console.log('   Token:', registerResponse.data.token ? 'Present' : 'Missing');
    } catch (error) {
      if (error.response?.status === 409) {
        console.log('⚠️ User already exists, continuing with login...');
      } else {
        console.log('❌ Registration failed:', error.response?.data?.error || error.message);
        return;
      }
    }
    
    // Test 2: User Login
    console.log('\n2️⃣ Testing User Login...');
    const loginData = {
      email: 'testflow@example.com',
      password: 'TestFlow123!'
    };
    
    let token;
    try {
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, loginData);
      console.log('✅ Login successful:', loginResponse.data.message);
      token = loginResponse.data.token;
    } catch (error) {
      console.log('❌ Login failed:', error.response?.data?.error || error.message);
      return;
    }
    
    // Test 3: Browse Services (Unauthenticated)
    console.log('\n3️⃣ Testing Service Browsing (Public)...');
    try {
      const servicesResponse = await axios.get(`${BASE_URL}/services`);
      console.log('✅ Services retrieved successfully');
      console.log(`   Total Services: ${servicesResponse.data.services.length}`);
      console.log(`   Categories: ${[...new Set(servicesResponse.data.services.map(s => s.category_name))].join(', ')}`);
      
      // Check if services have images
      const servicesWithImages = servicesResponse.data.services.filter(s => s.media_urls && s.media_urls.length > 0);
      console.log(`   Services with Images: ${servicesWithImages.length}/${servicesResponse.data.services.length}`);
      
    } catch (error) {
      console.log('❌ Services retrieval failed:', error.response?.data?.error || error.message);
    }
    
    // Test 4: Get User Profile (Authenticated)
    console.log('\n4️⃣ Testing User Profile Retrieval...');
    try {
      const profileResponse = await axios.get(`${BASE_URL}/users/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('✅ Profile retrieved successfully');
      console.log('   Username:', profileResponse.data.user.username);
      console.log('   Email:', profileResponse.data.user.email);
      console.log('   Verification Tier:', profileResponse.data.user.verification_tier);
    } catch (error) {
      console.log('❌ Profile retrieval failed:', error.response?.data?.error || error.message);
    }
    
    // Test 5: Test with Real User (Akua from Ghana)
    console.log('\n5️⃣ Testing with Real User (Akua from Ghana)...');
    try {
      const realUserLogin = await axios.post(`${BASE_URL}/auth/login`, {
        email: 'akua.mensah@ghana.com',
        password: 'AkuaPass123!'
      });
      
      const realToken = realUserLogin.data.token;
      console.log('✅ Real user login successful');
      
      // Get real user profile
      const realProfileResponse = await axios.get(`${BASE_URL}/users/profile`, {
        headers: { 'Authorization': `Bearer ${realToken}` }
      });
      
      const profileData = realProfileResponse.data.user.profile_data;
      console.log('   Profile Picture:', profileData.profilePicture ? '✅ Present' : '❌ Missing');
      console.log('   Service Categories:', profileData.serviceCategories?.join(', ') || 'None');
      console.log('   Base Price: $' + (profileData.basePrice || 'Not set'));
      
    } catch (error) {
      console.log('❌ Real user test failed:', error.response?.data?.error || error.message);
    }
    
    // Test 6: Test Service Categories
    console.log('\n6️⃣ Testing Service Categories...');
    try {
      const categoriesResponse = await axios.get(`${BASE_URL}/services/categories`);
      console.log('✅ Categories retrieved successfully');
      console.log('   Categories:', categoriesResponse.data.map(c => c.display_name).join(', '));
    } catch (error) {
      console.log('⚠️ Categories endpoint not available, skipping...');
    }
    
    console.log('\n🎉 Full User Flow Test Complete!');
    console.log('\n📱 Frontend Test Instructions:');
    console.log('   1. Open http://localhost:3000 in browser');
    console.log('   2. Navigate to Adult Services page');
    console.log('   3. Verify real services with images are displayed');
    console.log('   4. Test login with: akua.mensah@ghana.com / AkuaPass123!');
    console.log('   5. Check user profile for picture and details');
    console.log('   6. Browse services by category');
    
  } catch (error) {
    console.error('💥 Full user flow test failed:', error.message);
  }
}

testFullUserFlow();
