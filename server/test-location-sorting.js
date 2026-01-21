/**
 * Test script to verify the profile browse API with location parameters
 * Run this after starting the server to test the fix
 */
const API_BASE = 'http://localhost:5000/api';

async function testProfileBrowse() {
  console.log('🧪 Testing Profile Browse API with location parameters...\n');

  // Simulate a request from Accra, Ghana
  const params = new URLSearchParams({
    page: '1',
    limit: '10',
    filter: 'all',
    // These are the params the frontend sends
    userLat: '5.6131584',
    userLng: '-0.196608',
    userCity: 'Accra',
    userCountry: 'Ghana',
    locationSource: 'gps',
    locationConfidence: '1.0',
    locationAccuracy: '50'
  });

  try {
    console.log(`📤 Request URL: ${API_BASE}/users/profiles?${params}\n`);
    
    const response = await fetch(`${API_BASE}/users/profiles?${params}`);
    const data = await response.json();
    
    if (!data.success) {
      console.error('❌ API returned error:', data);
      return;
    }
    
    console.log('✅ API Response:');
    console.log(`   Total profiles: ${data.pagination?.total || data.users?.length || 0}`);
    console.log(`   Algorithm: ${data.metadata?.algorithm || 'unknown'}`);
    console.log(`   User location detected: ${data.metadata?.userLocationDetected}`);
    console.log(`   Same country count: ${data.metadata?.sameCountryCount}`);
    console.log(`   Nearby count: ${JSON.stringify(data.metadata?.nearbyCount)}`);
    
    console.log('\n📊 Top 10 profiles by distance:');
    const profiles = data.users || [];
    profiles.slice(0, 10).forEach((p, i) => {
      const city = p.profile_data?.location?.city || p.profileData?.location?.city || 'Unknown';
      const country = p.profile_data?.location?.country || p.profileData?.location?.country || 'Unknown';
      const distance = p.distance != null ? `${p.distance.toFixed(1)}km` : 'N/A';
      const score = p.recommendationScore || 'N/A';
      const sameCountry = p.sameCountry ? '✅' : '❌';
      
      console.log(`   ${i + 1}. ${p.username}`);
      console.log(`      Location: ${city}, ${country} ${sameCountry}`);
      console.log(`      Distance: ${distance} | Score: ${score}`);
    });
    
    // Check if sorting is correct
    console.log('\n🔍 Sorting Analysis:');
    const ghanaProfiles = profiles.filter(p => {
      const country = (p.profile_data?.location?.country || p.profileData?.location?.country || '').toLowerCase();
      return country === 'ghana';
    });
    const nigeriaProfiles = profiles.filter(p => {
      const country = (p.profile_data?.location?.country || p.profileData?.location?.country || '').toLowerCase();
      return country === 'nigeria';
    });
    
    console.log(`   Ghana profiles in top 10: ${profiles.slice(0, 10).filter(p => (p.profile_data?.location?.country || p.profileData?.location?.country || '').toLowerCase() === 'ghana').length}`);
    console.log(`   Total Ghana profiles: ${ghanaProfiles.length}`);
    console.log(`   Total Nigeria profiles: ${nigeriaProfiles.length}`);
    
    // Check if Ghana profiles are first
    const firstNonGhanaIndex = profiles.findIndex(p => 
      (p.profile_data?.location?.country || p.profileData?.location?.country || '').toLowerCase() !== 'ghana'
    );
    
    if (firstNonGhanaIndex === -1) {
      console.log('   ✅ All profiles are from Ghana (correct!)');
    } else if (firstNonGhanaIndex >= ghanaProfiles.length) {
      console.log(`   ✅ All Ghana profiles (${ghanaProfiles.length}) appear before other countries (correct!)`);
    } else {
      console.log(`   ⚠️ First non-Ghana profile at position ${firstNonGhanaIndex + 1}, but there are ${ghanaProfiles.length} Ghana profiles total`);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testProfileBrowse();
