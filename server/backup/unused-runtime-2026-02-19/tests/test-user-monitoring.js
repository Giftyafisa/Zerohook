require('dotenv').config({ path: './env.production' });
const { query } = require('./config/database');
const UserActivityMonitor = require('./services/UserActivityMonitor');
const PerformanceMetrics = require('./services/PerformanceMetrics');

async function testUserMonitoring() {
  try {
    console.log('🧪 Testing User Monitoring Services...\n');
    
    // Initialize services
    const userActivityMonitor = new UserActivityMonitor();
    const performanceMetrics = new PerformanceMetrics();
    
    await userActivityMonitor.initialize();
    await performanceMetrics.initialize();
    
    console.log('✅ Services initialized successfully\n');
    
    // Get an existing user ID from the database
    console.log('📝 Getting existing user ID for testing...');
    const userResult = await query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      throw new Error('No users found in database');
    }
    const testUserId = userResult.rows[0].id;
    console.log('✅ Using existing user ID:', testUserId.substring(0, 8) + '...\n');
    
    // Test 1: Create a test user session
    console.log('📝 Test 1: Creating test user session...');
    const sessionToken = await userActivityMonitor.createUserSession(
      testUserId,
      'test-socket-123',
      '127.0.0.1',
      'Test User Agent'
    );
    console.log('✅ Session created:', sessionToken.substring(0, 20) + '...\n');
    
    // Test 2: Update user presence
    console.log('📝 Test 2: Updating user presence...');
    await userActivityMonitor.updateUserPresence(testUserId, 'online', 'test-socket-123');
    console.log('✅ Presence updated to online\n');
    
    // Test 3: Log user activity
    console.log('📝 Test 3: Logging user activity...');
    await userActivityMonitor.logUserActivity(testUserId, {
      actionType: 'test_action',
      actionData: { test: true },
      ipAddress: '127.0.0.1',
      userAgent: 'Test User Agent',
      responseTimeMs: 150,
      success: true
    });
    console.log('✅ Activity logged\n');
    
    // Test 4: Get user presence
    console.log('📝 Test 4: Getting user presence...');
    const presence = await userActivityMonitor.getUserPresence(testUserId);
    console.log('✅ User presence:', presence);
    
    // Test 5: Get online users count
    console.log('📝 Test 5: Getting online users count...');
    const onlineCount = await userActivityMonitor.getOnlineUsersCount();
    console.log('✅ Online users:', onlineCount);
    
    // Test 6: Record performance metrics
    console.log('📝 Test 6: Recording performance metrics...');
    await performanceMetrics.recordAPIMetrics(
      '/api/test',
      'GET',
      125,
      200,
      testUserId,
      100,
      500,
      '127.0.0.1',
      'Test User Agent'
    );
    console.log('✅ Performance metrics recorded\n');
    
    // Test 7: Get system activity overview
    console.log('📝 Test 7: Getting system activity overview...');
    const activityOverview = await userActivityMonitor.getSystemActivityOverview();
    console.log('✅ System activity:', activityOverview);
    
    // Test 8: Get performance summary
    console.log('📝 Test 8: Getting performance summary...');
    const performanceSummary = await performanceMetrics.getPerformanceSummary('1 hour');
    console.log('✅ Performance summary retrieved (API metrics count:', performanceSummary.apiMetrics.length, ')');
    
    // Test 9: Get system health score
    console.log('📝 Test 9: Getting system health score...');
    const healthScore = await performanceMetrics.getSystemHealthScore();
    console.log('✅ System health score:', healthScore.healthScore);
    
    console.log('\n🎉 All tests completed successfully!');
    
    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await query('DELETE FROM user_sessions WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM user_presence WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM user_activity_logs WHERE user_id = $1', [testUserId]);
    await query('DELETE FROM api_performance_logs WHERE user_id = $1', [testUserId]);
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
  }
}

testUserMonitoring()
  .then(() => {
    console.log('✅ Testing completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Testing failed:', error);
    process.exit(1);
  });
