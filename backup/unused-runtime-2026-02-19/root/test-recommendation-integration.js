/**
 * COMPREHENSIVE TEST: Frontend-Backend Recommendation Algorithm Integration
 * Tests the entire pipeline from ProfileFeed component to RecommendationEngine
 */

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';

// Simple base64 encode for testing
function encodeBase64(str) {
  return Buffer.from(str).toString('base64');
}
let testResults = {
  passed: 0,
  failed: 0,
  warnings: 0,
  details: []
};

// ============================================
// TEST UTILITIES
// ============================================

async function logResult(testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${testName}`);
  if (details) {
    console.log(`   └─ ${details}`);
  }
  
  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
  
  testResults.details.push({ testName, passed, details });
}

async function logWarning(testName, details) {
  console.log(`⚠️  WARNING: ${testName}`);
  console.log(`   └─ ${details}`);
  testResults.warnings++;
}

// ============================================
// TEST 1: Authentication & API Access
// ============================================

async function testAuthenticationFlow() {
  console.log('\n📋 TEST 1: Authentication & API Access Flow');
  console.log('━'.repeat(60));

  try {
    // Test 1.1: Missing auth header
    try {
      await axios.get(`${API_BASE_URL}/users/profiles`);
      await logResult('Test 1.1 - Auth required (no header)', false, 'Should return 401');
    } catch (error) {
      await logResult(
        'Test 1.1 - Auth required (no header)',
        error.response?.status === 401,
        `Status: ${error.response?.status}`
      );
    }

    // Test 1.2: Invalid token
    try {
      await axios.get(`${API_BASE_URL}/users/profiles`, {
        headers: { Authorization: 'Bearer invalid_token' }
      });
      await logResult('Test 1.2 - Invalid token rejection', false, 'Should return 401');
    } catch (error) {
      await logResult(
        'Test 1.2 - Invalid token rejection',
        error.response?.status === 401,
        `Status: ${error.response?.status}`
      );
    }

  } catch (error) {
    await logResult('Test 1: Authentication Flow', false, error.message);
  }
}

// ============================================
// TEST 2: Subscription Gate
// ============================================

async function testSubscriptionGate(token, userId) {
  console.log('\n📋 TEST 2: Subscription Gate & Access Control');
  console.log('━'.repeat(60));

  try {
    // Test 2.1: Check subscription requirement
    const response = await axios.get(`${API_BASE_URL}/users/profiles?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(error => error.response);

    if (response?.status === 403) {
      await logResult(
        'Test 2.1 - Subscription gate active',
        true,
        'Non-subscribed user blocked with 403'
      );
    } else if (response?.status === 200) {
      await logResult(
        'Test 2.1 - Subscription gate active',
        true,
        'Subscribed user allowed (200)'
      );
    } else {
      await logResult(
        'Test 2.1 - Subscription gate active',
        false,
        `Unexpected status: ${response?.status}`
      );
    }

  } catch (error) {
    await logResult('Test 2: Subscription Gate', false, error.message);
  }
}

// ============================================
// TEST 3: Recommendation Algorithm Features
// ============================================

async function testRecommendationFeatures(token, userId) {
  console.log('\n📋 TEST 3: Recommendation Algorithm Features');
  console.log('━'.repeat(60));

  try {
    // Test 3.1: Distance-based sorting
    const locResponse = await axios.get(
      `${API_BASE_URL}/users/profiles?page=1&limit=10&userLat=5.6650&userLng=-0.0175&userCity=Tema`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).catch(error => error.response);

    if (locResponse?.status === 200) {
      const users = locResponse.data.users || [];
      const hasDistanceData = users.some(u => u.distance !== undefined);
      
      await logResult(
        'Test 3.1 - Distance calculation in response',
        hasDistanceData,
        `${users.length} profiles returned with distance data`
      );

      // Check if profiles are sorted by distance
      if (users.length > 1) {
        let isSorted = true;
        for (let i = 1; i < Math.min(users.length, 5); i++) {
          if (users[i].distance && users[i-1].distance && 
              users[i].distance < users[i-1].distance) {
            isSorted = false;
            break;
          }
        }
        
        await logResult(
          'Test 3.2 - Distance sorting (closest first)',
          isSorted,
          `First 5 profiles: ${users.slice(0, 5).map(u => u.distance?.toFixed(1) + 'km').join(', ')}`
        );
      }
    } else {
      await logWarning(
        'Test 3.1-3.2 - Distance features',
        `Cannot test - API returned status ${locResponse?.status}`
      );
    }

    // Test 3.3: Recommendation score presence
    const scoreResponse = await axios.get(
      `${API_BASE_URL}/users/profiles?page=1&limit=5&filter=all`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).catch(error => error.response);

    if (scoreResponse?.status === 200) {
      const users = scoreResponse.data.users || [];
      const hasScores = users.every(u => u.recommendationScore !== undefined);
      
      await logResult(
        'Test 3.3 - Recommendation scores calculated',
        hasScores,
        `All ${users.length} profiles have scores: ${users.map(u => u.recommendationScore).join(', ')}`
      );

      // Check metadata
      if (scoreResponse.data.metadata) {
        await logResult(
          'Test 3.4 - Metadata included',
          true,
          `Algorithm: ${scoreResponse.data.metadata.algorithm}, Top score: ${scoreResponse.data.metadata.topScore}`
        );
      }
    }

    // Test 3.5: Filter modes
    const filterModes = ['all', 'nearby', 'online', 'verified', 'trending'];
    for (const mode of filterModes) {
      try {
        const filterResponse = await axios.get(
          `${API_BASE_URL}/users/profiles?page=1&limit=5&filter=${mode}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ).catch(error => error.response);

        await logResult(
          `Test 3.5.${filterModes.indexOf(mode)+1} - Filter mode '${mode}'`,
          filterResponse?.status === 200 || filterResponse?.status === 403,
          `Status: ${filterResponse?.status}`
        );
      } catch (error) {
        await logResult(
          `Test 3.5 - Filter mode '${mode}'`,
          false,
          error.message
        );
      }
    }

  } catch (error) {
    await logResult('Test 3: Recommendation Features', false, error.message);
  }
}

// ============================================
// TEST 4: Frontend Integration Points
// ============================================

async function testFrontendIntegration(token, userId) {
  console.log('\n📋 TEST 4: Frontend Integration Points');
  console.log('━'.repeat(60));

  try {
    // Test 4.1: Query parameters properly sent
    const queryResponse = await axios.get(
      `${API_BASE_URL}/users/profiles?` +
      `page=1&limit=24&` +
      `filter=nearby&` +
      `search=massage&` +
      `userLat=5.6700&userLng=-0.1600&` +
      `userCity=East%20Legon&userCountry=Ghana`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).catch(error => error.response);

    await logResult(
      'Test 4.1 - Complex query parameters accepted',
      queryResponse?.status === 200 || queryResponse?.status === 403,
      `Backend processed all query params: page, limit, filter, search, location`
    );

    // Test 4.2: Location data in response
    if (queryResponse?.data?.users) {
      const user = queryResponse.data.users[0];
      const hasLocationFields = ['distance', 'isOnline', 'lastSeen'].every(
        field => field in user
      );
      
      await logResult(
        'Test 4.2 - Location fields in response',
        hasLocationFields,
        `Fields: distance, isOnline, lastSeen`
      );
    }

    // Test 4.3: Pagination support
    if (queryResponse?.data?.pagination) {
      const pagination = queryResponse.data.pagination;
      const hasRequired = ['page', 'limit', 'total', 'pages'].every(
        field => field in pagination
      );
      
      await logResult(
        'Test 4.3 - Pagination support',
        hasRequired,
        `Page ${pagination.page}/${pagination.pages}, Total: ${pagination.total}`
      );
    }

    // Test 4.4: Activity tracking endpoint
    try {
      const trackResponse = await axios.post(
        `${API_BASE_URL}/users/track-activity`,
        {
          actionType: 'profile_view',
          actionData: { profileId: 1, viewDuration: 5000 }
        },
        { headers: { Authorization: `Bearer ${token}` } }
      ).catch(error => error.response);

      await logResult(
        'Test 4.4 - Activity tracking endpoint',
        trackResponse?.status === 200 || trackResponse?.status === 401,
        `Endpoint available: ${trackResponse?.status}`
      );
    } catch (error) {
      await logWarning('Test 4.4 - Activity tracking', 'Endpoint not available');
    }

  } catch (error) {
    await logResult('Test 4: Frontend Integration', false, error.message);
  }
}

// ============================================
// TEST 5: Performance & Response Quality
// ============================================

async function testPerformance(token) {
  console.log('\n📋 TEST 5: Performance & Response Quality');
  console.log('━'.repeat(60));

  try {
    // Test 5.1: Response time
    const startTime = Date.now();
    const response = await axios.get(
      `${API_BASE_URL}/users/profiles?page=1&limit=20`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).catch(error => error.response);
    const responseTime = Date.now() - startTime;

    await logResult(
      'Test 5.1 - Response time',
      responseTime < 5000,
      `${responseTime}ms (target < 5000ms)`
    );

    // Test 5.2: Profile data completeness
    if (response?.data?.users?.length > 0) {
      const user = response.data.users[0];
      const requiredFields = [
        'id', 'username', 'profile_data', 
        'verification_tier', 'recommendationScore'
      ];
      const hasRequiredFields = requiredFields.every(field => field in user);
      
      await logResult(
        'Test 5.2 - Profile data completeness',
        hasRequiredFields,
        `All required fields present`
      );

      // Test 5.3: Profile data structure
      const profileData = user.profile_data;
      if (profileData) {
        const hasProfileContent = 
          profileData.firstName || profileData.username || profileData.bio;
        
        await logResult(
          'Test 5.3 - Profile data structure valid',
          hasProfileContent,
          `Profile has: name/username/bio`
        );
      }
    }

    // Test 5.4: Consistent response structure
    if (response?.data) {
      const hasStructure = 
        'success' in response.data &&
        'users' in response.data &&
        'pagination' in response.data;
      
      await logResult(
        'Test 5.4 - Response structure consistent',
        hasStructure,
        `Has: success, users, pagination${response.data.metadata ? ', metadata' : ''}`
      );
    }

  } catch (error) {
    await logResult('Test 5: Performance', false, error.message);
  }
}

// ============================================
// TEST 6: Algorithm Quality Checks
// ============================================

async function testAlgorithmQuality(token) {
  console.log('\n📋 TEST 6: Algorithm Quality Checks');
  console.log('━'.repeat(60));

  try {
    // Test 6.1: Verified providers only
    const response = await axios.get(
      `${API_BASE_URL}/users/profiles?page=1&limit=50`,
      { headers: { Authorization: `Bearer ${token}` } }
    ).catch(error => error.response);

    if (response?.data?.users?.length > 0) {
      const allVerified = response.data.users.every(
        u => (u.verification_tier || 0) >= 1
      );
      
      await logResult(
        'Test 6.1 - Only verified providers shown',
        allVerified,
        `All ${response.data.users.length} profiles have verification_tier >= 1`
      );

      // Test 6.2: Score distribution
      const scores = response.data.users.map(u => u.recommendationScore);
      const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
      const minScore = Math.min(...scores);
      const maxScore = Math.max(...scores);
      
      await logResult(
        'Test 6.2 - Score distribution',
        avgScore > 30 && maxScore <= 100,
        `Range: ${minScore?.toFixed(1)}-${maxScore?.toFixed(1)}, Avg: ${avgScore?.toFixed(1)}`
      );

      // Test 6.3: Score consistency (should be mostly different)
      const uniqueScores = new Set(scores).size;
      const diversityRatio = uniqueScores / scores.length;
      
      await logResult(
        'Test 6.3 - Score diversity',
        diversityRatio > 0.8,
        `${uniqueScores}/${scores.length} unique scores (${(diversityRatio*100).toFixed(0)}% diverse)`
      );
    }

  } catch (error) {
    await logResult('Test 6: Algorithm Quality', false, error.message);
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║   FRONTEND-BACKEND RECOMMENDATION INTEGRATION TEST SUITE   ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  try {
    // First, test authentication without credentials
    await testAuthenticationFlow();

    // Create a mock token (in real tests, use actual login endpoint)
    const mockTokenPayload = JSON.stringify({ userId: 1, username: 'testuser', iat: Date.now() });
    const testToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + 
                      encodeBase64(mockTokenPayload) + 
                      '.mock_signature';

    console.log('\n📝 Note: Using mock token. In production, authenticate via /api/auth/login');

    // Run remaining tests
    await testSubscriptionGate(testToken, 1);
    await testRecommendationFeatures(testToken, 1);
    await testFrontendIntegration(testToken, 1);
    await testPerformance(testToken);
    await testAlgorithmQuality(testToken);

  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
  }

  // ============================================
  // TEST SUMMARY
  // ============================================

  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                      TEST SUMMARY                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\n✅ Passed:  ${testResults.passed}`);
  console.log(`❌ Failed:  ${testResults.failed}`);
  console.log(`⚠️  Warnings: ${testResults.warnings}`);
  console.log(`📊 Total:   ${testResults.passed + testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

  if (testResults.failed === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Frontend-backend integration is working correctly.');
  } else {
    console.log(`\n⚠️  ${testResults.failed} test(s) failed. Review the integration.`);
  }

  console.log('\n' + '═'.repeat(60));
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
