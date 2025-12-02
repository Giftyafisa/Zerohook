const { query } = require('./config/database');

/**
 * Comprehensive wiring check script
 * Verifies all user interaction systems are properly connected
 */
async function checkWiring() {
  console.log('\n🔍 COMPREHENSIVE USER WIRING CHECK\n');
  console.log('='.repeat(50));
  
  let passed = 0;
  let failed = 0;

  // 1. Check Chat System
  console.log('\n📬 1. CHAT SYSTEM');
  try {
    // Check conversations table
    const convs = await query('SELECT COUNT(*) as count FROM conversations');
    console.log(`   ✅ Conversations table: ${convs.rows[0].count} records`);
    
    // Check messages table
    const msgs = await query('SELECT COUNT(*) as count FROM messages');
    console.log(`   ✅ Messages table: ${msgs.rows[0].count} records`);
    
    // Verify conversation-message relationship
    const orphanMsgs = await query(`
      SELECT COUNT(*) as count FROM messages m 
      LEFT JOIN conversations c ON m.conversation_id = c.id 
      WHERE c.id IS NULL
    `);
    if (parseInt(orphanMsgs.rows[0].count) === 0) {
      console.log('   ✅ No orphan messages (all linked to conversations)');
      passed++;
    } else {
      console.log(`   ⚠️  ${orphanMsgs.rows[0].count} orphan messages found`);
      failed++;
    }
  } catch (e) {
    console.log(`   ❌ Chat system error: ${e.message}`);
    failed++;
  }

  // 2. Check User Connections
  console.log('\n🤝 2. USER CONNECTIONS');
  try {
    const conns = await query('SELECT COUNT(*) as count FROM user_connections');
    console.log(`   ✅ User connections table: ${conns.rows[0].count} records`);
    
    // Check blocked_users
    const blocked = await query('SELECT COUNT(*) as count FROM blocked_users');
    console.log(`   ✅ Blocked users table: ${blocked.rows[0].count} records`);
    passed++;
  } catch (e) {
    console.log(`   ❌ User connections error: ${e.message}`);
    failed++;
  }

  // 3. Check Notifications
  console.log('\n🔔 3. NOTIFICATIONS');
  try {
    const notifs = await query('SELECT COUNT(*) as count FROM notifications');
    console.log(`   ✅ Notifications table: ${notifs.rows[0].count} records`);
    
    // Check for unread notifications
    const unread = await query("SELECT COUNT(*) as count FROM notifications WHERE read = false");
    console.log(`   📩 Unread notifications: ${unread.rows[0].count}`);
    passed++;
  } catch (e) {
    console.log(`   ❌ Notifications error: ${e.message}`);
    failed++;
  }

  // 4. Check User Profiles
  console.log('\n👤 4. USER PROFILES');
  try {
    const users = await query('SELECT COUNT(*) as count FROM users');
    console.log(`   ✅ Users table: ${users.rows[0].count} records`);
    
    // Check users with profile data
    const withProfile = await query("SELECT COUNT(*) as count FROM users WHERE profile_data IS NOT NULL AND profile_data != '{}'");
    console.log(`   ✅ Users with profile data: ${withProfile.rows[0].count}`);
    passed++;
  } catch (e) {
    console.log(`   ❌ User profiles error: ${e.message}`);
    failed++;
  }

  // 5. Check Services
  console.log('\n🛍️  5. SERVICES');
  try {
    const services = await query('SELECT COUNT(*) as count FROM services');
    console.log(`   ✅ Services table: ${services.rows[0].count} records`);
    
    // Check services with valid providers
    const validProviders = await query(`
      SELECT COUNT(*) as count FROM services s 
      JOIN users u ON s.provider_id = u.id
    `);
    console.log(`   ✅ Services with valid providers: ${validProviders.rows[0].count}`);
    passed++;
  } catch (e) {
    console.log(`   ❌ Services error: ${e.message}`);
    failed++;
  }

  // 6. Check Transactions/Bookings
  console.log('\n💳 6. TRANSACTIONS');
  try {
    const txns = await query('SELECT COUNT(*) as count FROM transactions');
    console.log(`   ✅ Transactions table: ${txns.rows[0].count} records`);
    
    const bookings = await query('SELECT COUNT(*) as count FROM bookings');
    console.log(`   ✅ Bookings table: ${bookings.rows[0].count} records`);
    passed++;
  } catch (e) {
    console.log(`   ❌ Transactions error: ${e.message}`);
    failed++;
  }

  // 7. Check User Presence/Sessions
  console.log('\n🟢 7. USER PRESENCE');
  try {
    const presence = await query('SELECT COUNT(*) as count FROM user_presence');
    console.log(`   ✅ User presence table: ${presence.rows[0].count} records`);
    
    const sessions = await query('SELECT COUNT(*) as count FROM user_sessions');
    console.log(`   ✅ User sessions table: ${sessions.rows[0].count} records`);
    passed++;
  } catch (e) {
    console.log(`   ❌ User presence error: ${e.message}`);
    failed++;
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SUMMARY');
  console.log(`   ✅ Passed: ${passed}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('='.repeat(50) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

checkWiring().catch(e => {
  console.error('Check failed:', e);
  process.exit(1);
});
