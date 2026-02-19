const { query } = require('./config/database');

/**
 * Test script to verify profile picture URL resolution
 * Tests both backend extraction and what frontend will receive
 */
async function testProfilePictureResolution() {
  try {
    console.log('🧪 Testing Profile Picture URL Resolution\n');
    console.log('=' .repeat(80));
    
    // Test 1: Check raw database format
    console.log('\n📊 Test 1: Raw Database Storage');
    const rawData = await query(`
      SELECT 
        id, 
        username,
        profile_data->'profile_picture' as picture_json,
        profile_data->>'profile_picture' as picture_string
      FROM users 
      WHERE profile_data->'profile_picture' IS NOT NULL
      LIMIT 3
    `);
    
    rawData.rows.forEach((row, i) => {
      console.log(`\n  User ${i + 1}: ${row.username}`);
      console.log(`    JSON (->) : ${JSON.stringify(row.picture_json)}`);
      console.log(`    String (->>) : ${row.picture_string}`);
    });
    
    // Test 2: Simulate backend chat conversations endpoint
    console.log('\n\n📊 Test 2: Chat Conversations Endpoint Format');
    const userId = rawData.rows[0]?.id;
    
    if (userId) {
      const conversations = await query(`
        SELECT DISTINCT 
          c.id,
          c.participant1_id,
          c.participant2_id,
          u1.username as participant1_name,
          u2.username as participant2_name,
          u1.profile_data->>'profile_picture' as participant1_picture,
          u2.profile_data->>'profile_picture' as participant2_picture
        FROM conversations c
        JOIN users u1 ON c.participant1_id = u1.id
        JOIN users u2 ON c.participant2_id = u2.id
        WHERE c.participant1_id = $1 OR c.participant2_id = $1
        LIMIT 2
      `, [userId]);
      
      if (conversations.rows.length > 0) {
        conversations.rows.forEach((conv, i) => {
          const otherUserId = conv.participant1_id === userId ? conv.participant2_id : conv.participant1_id;
          const otherUserName = conv.participant1_id === userId ? conv.participant2_name : conv.participant1_name;
          const otherUserPicture = conv.participant1_id === userId ? conv.participant2_picture : conv.participant1_picture;
          
          console.log(`\n  Conversation ${i + 1}:`);
          console.log(`    Other User: ${otherUserName} (${otherUserId})`);
          console.log(`    Picture String: ${otherUserPicture}`);
          console.log(`    Is JSON String: ${otherUserPicture?.startsWith('{')}`);
          
          // Simulate frontend parsing
          try {
            const parsed = JSON.parse(otherUserPicture);
            console.log(`    ✅ Frontend can parse to: ${JSON.stringify(parsed)}`);
            console.log(`    ✅ Extracted URL: ${parsed.url}`);
          } catch (e) {
            console.log(`    ❌ Frontend parsing failed: ${e.message}`);
          }
        });
      } else {
        console.log('  No conversations found for test user');
      }
    }
    
    // Test 3: Simulate backend profile endpoint
    console.log('\n\n📊 Test 3: Profile Endpoint Format');
    const profiles = await query(`
      SELECT 
        id,
        username,
        profile_data
      FROM users 
      WHERE profile_data->'profile_picture' IS NOT NULL
      LIMIT 2
    `);
    
    profiles.rows.forEach((profile, i) => {
      console.log(`\n  Profile ${i + 1}: ${profile.username}`);
      console.log(`    Full profile_data keys: ${Object.keys(profile.profile_data).join(', ')}`);
      console.log(`    profile_picture type: ${typeof profile.profile_data.profile_picture}`);
      console.log(`    profile_picture value: ${JSON.stringify(profile.profile_data.profile_picture)}`);
      
      // Test if resolveProfileImage utility would work
      if (profile.profile_data.profile_picture?.url) {
        console.log(`    ✅ resolveProfileImage will extract: ${profile.profile_data.profile_picture.url}`);
      }
    });
    
    console.log('\n\n' + '='.repeat(80));
    console.log('✅ All tests completed\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    process.exit();
  }
}

testProfilePictureResolution();
