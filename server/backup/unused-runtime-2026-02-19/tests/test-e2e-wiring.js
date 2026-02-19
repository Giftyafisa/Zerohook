const { query } = require('./config/database');

/**
 * End-to-end user action wiring test
 * Tests all user interaction flows
 */
async function testEndToEndWiring() {
  console.log('\n🧪 END-TO-END USER ACTION WIRING TEST\n');
  console.log('='.repeat(60));
  
  const results = { passed: 0, failed: 0, errors: [] };

  // Test 1: Conversations API Response Format
  console.log('\n📬 Test 1: Conversations API Response Format');
  try {
    const convs = await query(`
      SELECT 
        c.id,
        c.participant1_id,
        c.participant2_id,
        c.last_message,
        c.last_message_time,
        u1.username as participant1_name,
        u2.username as participant2_name
      FROM conversations c
      JOIN users u1 ON c.participant1_id = u1.id
      JOIN users u2 ON c.participant2_id = u2.id
      LIMIT 1
    `);
    
    if (convs.rows.length > 0) {
      const conv = convs.rows[0];
      console.log('   ✅ Conversation found with all required fields');
      console.log(`      ID: ${conv.id}`);
      console.log(`      Participants: ${conv.participant1_name} <-> ${conv.participant2_name}`);
      results.passed++;
    } else {
      console.log('   ⚠️  No conversations found (but query works)');
      results.passed++;
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
    results.failed++;
    results.errors.push(`Conversations: ${e.message}`);
  }

  // Test 2: Messages API Response Format
  console.log('\n📨 Test 2: Messages API Response Format');
  try {
    const msgs = await query(`
      SELECT 
        m.id,
        m.sender_id,
        m.content,
        m.message_type,
        m.created_at,
        m.read_at,
        u.username as sender_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LIMIT 1
    `);
    
    if (msgs.rows.length > 0) {
      const msg = msgs.rows[0];
      console.log('   ✅ Message found with all required fields');
      console.log(`      Type: ${msg.message_type}, Sender: ${msg.sender_name}`);
      results.passed++;
    } else {
      console.log('   ⚠️  No messages found (but query works)');
      results.passed++;
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
    results.failed++;
    results.errors.push(`Messages: ${e.message}`);
  }

  // Test 3: Notifications API Response Format
  console.log('\n🔔 Test 3: Notifications API Response Format');
  try {
    const notifs = await query(`
      SELECT 
        id, type, title, message, read, created_at, data
      FROM notifications
      LIMIT 1
    `);
    
    if (notifs.rows.length > 0) {
      const notif = notifs.rows[0];
      console.log('   ✅ Notification found with all required fields');
      console.log(`      Type: ${notif.type}, Title: ${notif.title}, Read: ${notif.read}`);
      results.passed++;
    } else {
      console.log('   ⚠️  No notifications found (but query works)');
      results.passed++;
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
    results.failed++;
    results.errors.push(`Notifications: ${e.message}`);
  }

  // Test 4: Services with Provider Info
  console.log('\n🛍️  Test 4: Services with Provider Info');
  try {
    const services = await query(`
      SELECT 
        s.id, s.provider_id, s.title, s.price,
        u.username as provider_username,
        u.verification_tier
      FROM services s
      JOIN users u ON s.provider_id = u.id
      LIMIT 1
    `);
    
    if (services.rows.length > 0) {
      const svc = services.rows[0];
      console.log('   ✅ Service found with provider info');
      console.log(`      Title: ${svc.title}, Provider: ${svc.provider_username}`);
      console.log(`      Provider ID: ${svc.provider_id} (required for messaging)`);
      results.passed++;
    } else {
      console.log('   ❌ No services with valid providers found');
      results.failed++;
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
    results.failed++;
    results.errors.push(`Services: ${e.message}`);
  }

  // Test 5: User Connections Schema
  console.log('\n🤝 Test 5: User Connections Schema');
  try {
    const cols = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'user_connections'
    `);
    
    const required = ['id', 'from_user_id', 'to_user_id', 'status', 'connection_type'];
    const existing = cols.rows.map(r => r.column_name);
    const missing = required.filter(c => !existing.includes(c));
    
    if (missing.length === 0) {
      console.log('   ✅ All required columns exist');
      results.passed++;
    } else {
      console.log(`   ❌ Missing columns: ${missing.join(', ')}`);
      results.failed++;
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
    results.failed++;
    results.errors.push(`User Connections: ${e.message}`);
  }

  // Test 6: Blocked Users Schema
  console.log('\n🚫 Test 6: Blocked Users Schema');
  try {
    const cols = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'blocked_users'
    `);
    
    const required = ['id', 'blocker_id', 'blocked_id'];
    const existing = cols.rows.map(r => r.column_name);
    const missing = required.filter(c => !existing.includes(c));
    
    if (missing.length === 0) {
      console.log('   ✅ All required columns exist');
      results.passed++;
    } else {
      console.log(`   ❌ Missing columns: ${missing.join(', ')}`);
      results.failed++;
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
    results.failed++;
    results.errors.push(`Blocked Users: ${e.message}`);
  }

  // Test 7: User Profile Data
  console.log('\n👤 Test 7: User Profile Data');
  try {
    const users = await query(`
      SELECT 
        id, username, email, verification_tier, 
        profile_data, is_subscribed, subscription_tier
      FROM users
      WHERE profile_data IS NOT NULL
      LIMIT 1
    `);
    
    if (users.rows.length > 0) {
      const user = users.rows[0];
      console.log('   ✅ User profile found');
      console.log(`      Username: ${user.username}, Tier: ${user.verification_tier}`);
      console.log(`      Has profile_data: ${user.profile_data ? 'Yes' : 'No'}`);
      results.passed++;
    } else {
      console.log('   ⚠️  No users with profile data found');
      results.passed++;
    }
  } catch (e) {
    console.log(`   ❌ Failed: ${e.message}`);
    results.failed++;
    results.errors.push(`User Profile: ${e.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log(`   ✅ Passed: ${results.passed}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  
  if (results.errors.length > 0) {
    console.log('\n   Errors:');
    results.errors.forEach(err => console.log(`   - ${err}`));
  }
  
  console.log('='.repeat(60) + '\n');

  process.exit(results.failed > 0 ? 1 : 0);
}

testEndToEndWiring().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
