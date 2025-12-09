const { query } = require('./config/database');

const conversationId = 'b36b4653-3894-47ad-b31d-f4f37351d895';

async function checkConversation() {
  console.log(`🔍 Checking conversation ${conversationId}...`);
  
  try {
    // Check if conversation exists
    const convResult = await query(`
      SELECT 
        id,
        participant1_id,
        participant2_id,
        created_at,
        last_message,
        last_message_time
      FROM conversations
      WHERE id = $1
    `, [conversationId]);
    
    if (convResult.rows.length === 0) {
      console.log('❌ Conversation not found!');
      return;
    }
    
    console.log('✅ Conversation found:');
    console.log(JSON.stringify(convResult.rows[0], null, 2));
    
    // Check messages in this conversation
    const messagesResult = await query(`
      SELECT 
        id,
        sender_id,
        content,
        message_type,
        created_at,
        read_at
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
    `, [conversationId]);
    
    console.log(`\n📨 Messages in conversation: ${messagesResult.rows.length}`);
    if (messagesResult.rows.length > 0) {
      console.log('First message:', JSON.stringify(messagesResult.rows[0], null, 2));
    }
    
    // Check users
    const conv = convResult.rows[0];
    const usersResult = await query(`
      SELECT id, username, verification_tier
      FROM users
      WHERE id IN ($1, $2)
    `, [conv.participant1_id, conv.participant2_id]);
    
    console.log(`\n👥 Participants:`);
    usersResult.rows.forEach(user => {
      console.log(`  - ${user.username} (ID: ${user.id}, Tier: ${user.verification_tier})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking conversation:', error.message);
    console.error(error.stack);
  } finally {
    process.exit(0);
  }
}

checkConversation();
