/**
 * Test Recommendation API - Distance Sorting
 * Simulates a request from Adjei-Kojo, Tema West
 */
const RecommendationEngine = require('./services/RecommendationEngine');

async function testRecommendations() {
  const engine = new RecommendationEngine();
  
  // User location: Adjei-Kojo, Tema West
  const userLocation = {
    lat: 5.6750,
    lng: -0.0100,
    city: 'Adjei-Kojo',
    country: 'Ghana'
  };
  
  console.log('\n📍 Testing recommendations from Adjei-Kojo, Tema West');
  console.log(`   User coordinates: lat=${userLocation.lat}, lng=${userLocation.lng}\n`);
  
  try {
    const result = await engine.getRecommendedProfiles({
      userLocation,
      limit: 15,
      filters: {} // Default "For You" filter
    });
    
    console.log('\n🎯 TOP 15 RECOMMENDED PROFILES (Should be sorted by distance):\n');
    console.log('Rank | City                  | Distance | Score | Online');
    console.log('-'.repeat(65));
    
    result.profiles.forEach((profile, index) => {
      const city = profile.profile_data?.location?.city || 'Unknown';
      const distance = profile.distance?.toFixed(1) || '?';
      const score = profile.recommendationScore?.toFixed(1) || '?';
      const online = profile.isOnline ? '🟢' : '⚪';
      
      console.log(
        `${String(index + 1).padStart(4)} | ${city.padEnd(20)} | ${String(distance + ' km').padStart(8)} | ${String(score).padStart(5)} | ${online}`
      );
    });
    
    console.log('\n✅ Total providers found:', result.total);
    console.log('📊 Algorithm:', result.metadata?.algorithm);
    
    // Check if sorting is correct
    let sortingCorrect = true;
    for (let i = 1; i < result.profiles.length; i++) {
      const prevDist = result.profiles[i-1].distance || 9999;
      const currDist = result.profiles[i].distance || 9999;
      if (currDist < prevDist) {
        console.log(`\n❌ SORTING ERROR: Profile ${i+1} (${currDist}km) is closer than Profile ${i} (${prevDist}km)`);
        sortingCorrect = false;
      }
    }
    
    if (sortingCorrect) {
      console.log('\n✅ SORTING VERIFIED: Profiles are correctly sorted by distance (closest first)');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  
  process.exit(0);
}

testRecommendations();
