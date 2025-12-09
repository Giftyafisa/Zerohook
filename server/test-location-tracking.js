/**
 * Test Location Tracking System
 * Run: node server/test-location-tracking.js
 */

const LocationTrackingService = require('./services/LocationTrackingService');

async function testLocationTracking() {
  console.log('🧪 Testing Location Tracking Service\n');
  console.log('='.repeat(60));
  
  const locationService = new LocationTrackingService();
  await locationService.initialize();
  
  // Test 1: GPS Coordinates
  console.log('\n📍 TEST 1: GPS Coordinates (Tema, Ghana)');
  console.log('-'.repeat(60));
  const gpsLocation = await locationService.getUserLocation({
    userId: 'test-user-1',
    providedCoords: {
      lat: 5.6698,
      lng: -0.0166,
      city: 'Tema',
      country: 'Ghana'
    }
  });
  console.log('Result:', JSON.stringify(gpsLocation, null, 2));
  
  // Test 2: Profile Location (City/Country only)
  console.log('\n\n📍 TEST 2: Profile Location (Lagos, Nigeria)');
  console.log('-'.repeat(60));
  const profileLocation = await locationService.getUserLocation({
    userId: 'test-user-2',
    userProfile: {
      location: {
        city: 'Lagos',
        country: 'Nigeria'
      }
    }
  });
  console.log('Result:', JSON.stringify(profileLocation, null, 2));
  
  // Test 3: IP-Based Detection
  console.log('\n\n📍 TEST 3: IP-Based Detection');
  console.log('-'.repeat(60));
  const ipLocation = await locationService.getUserLocation({
    sessionId: 'guest-session-1',
    ipAddress: '8.8.8.8' // Google DNS for testing
  });
  console.log('Result:', JSON.stringify(ipLocation, null, 2));
  
  // Test 4: Distance Calculation
  console.log('\n\n📏 TEST 4: Distance Calculation');
  console.log('-'.repeat(60));
  const distance1 = locationService.calculateDistance(
    { lat: 5.6037, lng: -0.1870 }, // Accra
    { lat: 6.6884, lng: -1.6244 }  // Kumasi
  );
  console.log(`Accra to Kumasi: ${distance1} km (Expected: ~196 km)`);
  
  const distance2 = locationService.calculateDistance(
    { lat: 5.6698, lng: -0.0166 }, // Tema
    { lat: 5.6037, lng: -0.1870 }  // Accra
  );
  console.log(`Tema to Accra: ${distance2} km (Expected: ~15 km)`);
  
  // Test 5: Find Nearest City
  console.log('\n\n🔍 TEST 5: Find Nearest City');
  console.log('-'.repeat(60));
  const nearestCity = locationService.findNearestCity(5.66, -0.02);
  console.log('Coordinates: 5.66, -0.02');
  console.log('Nearest City:', nearestCity);
  
  // Test 6: Invalid Coordinates Handling
  console.log('\n\n❌ TEST 6: Invalid Coordinates Handling');
  console.log('-'.repeat(60));
  const invalidLocation = await locationService.getUserLocation({
    userId: 'test-user-3',
    providedCoords: {
      lat: 999, // Invalid
      lng: -500  // Invalid
    }
  });
  console.log('Result:', JSON.stringify(invalidLocation, null, 2));
  
  // Test 7: Full Fallback Cascade (no GPS, no profile, no valid IP)
  console.log('\n\n🔄 TEST 7: Full Fallback Cascade');
  console.log('-'.repeat(60));
  const fallbackLocation = await locationService.getUserLocation({
    userId: 'test-user-4',
    ipAddress: '127.0.0.1'
  });
  console.log('Result:', JSON.stringify(fallbackLocation, null, 2));
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ All tests completed!\n');
}

// Run tests
testLocationTracking()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
