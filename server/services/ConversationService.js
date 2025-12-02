const { query, getClient } = require('../config/database');

class ConversationService {
  constructor() {
    // no-op for now; could accept injected deps later (cache, logger)
  }

  async isMember(conversationId, userId) {
    const res = await query(`
      SELECT id FROM conversations WHERE id = $1 AND (participant1_id = $2 OR participant2_id = $2)
    `, [conversationId, userId]);
    return res.rows.length > 0;
  }

  async getOtherParticipant(conversationId, userId) {
    const res = await query(`
      SELECT participant1_id, participant2_id FROM conversations WHERE id = $1
    `, [conversationId]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return row.participant1_id === userId ? row.participant2_id : row.participant1_id;
  }

  async isBlockedBetween(userA, userB) {
    const res = await query(`
      SELECT 1 FROM blocked_users WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)
    `, [userA, userB]);
    return res.rows.length > 0;
  }

  async createOrGetConversation(userA, userB) {
    // check existing
    const existing = await query(`
      SELECT id, created_at FROM conversations WHERE (participant1_id = $1 AND participant2_id = $2) OR (participant1_id = $2 AND participant2_id = $1)
    `, [userA, userB]);
    if (existing.rows.length > 0) return existing.rows[0];

    // Note: conversations table has no 'status' column
    const res = await query(`
      INSERT INTO conversations (participant1_id, participant2_id, created_at, updated_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, created_at
    `, [userA, userB]);
    return res.rows[0];
  }

  // Insert a message within an existing client transaction or create its own transaction
  async insertMessageTx({ client = null, conversationId, senderId, content, messageType = 'text', metadata = {} }) {
    let localClient = client;
    let createdHere = false;
    try {
      if (!localClient) {
        localClient = await getClient();
        createdHere = true;
        await localClient.query('BEGIN');
      }

      // Note: messages table has no 'metadata' column
      const insertRes = await localClient.query(`
        INSERT INTO messages (conversation_id, sender_id, content, message_type)
        VALUES ($1, $2, $3, $4)
        RETURNING id, created_at
      `, [conversationId, senderId, content, messageType]);

      const message = insertRes.rows[0];

      await localClient.query(`
        UPDATE conversations SET last_message = $1, last_message_time = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3
      `, [content, message.created_at, conversationId]);

      if (createdHere) {
        await localClient.query('COMMIT');
      }

      return message;
    } catch (err) {
      if (createdHere && localClient) {
        try { await localClient.query('ROLLBACK'); } catch (e) { /* ignore */ }
      }
      throw err;
    } finally {
      if (createdHere && localClient) {
        try { localClient.release(); } catch (e) { /* ignore */ }
      }
    }
  }

  async blockUser(blockerId, blockedId) {
    // Centralized block flow: insert into blocked_users, close conversations, reject pending requests
    const client = await getClient();
    try {
      await client.query('BEGIN');

      await client.query(`
        INSERT INTO blocked_users (blocker_id, blocked_id, created_at)
        VALUES ($1, $2, CURRENT_TIMESTAMP)
        ON CONFLICT (blocker_id, blocked_id) DO NOTHING
      `, [blockerId, blockedId]);

      // Note: conversations table has no 'status' column - blocking is tracked in blocked_users table
      await client.query(`
        UPDATE conversations 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE (participant1_id = $1 AND participant2_id = $2) 
           OR (participant1_id = $2 AND participant2_id = $1)
      `, [blockerId, blockedId]);

      await client.query(`
        UPDATE user_connections 
        SET status = 'rejected', updated_at = CURRENT_TIMESTAMP
        WHERE (from_user_id = $1 AND to_user_id = $2) 
           OR (from_user_id = $2 AND to_user_id = $1)
      `, [blockerId, blockedId]);

      await client.query('COMMIT');

      return { success: true, message: 'User blocked successfully' };
    } catch (err) {
      try { await client.query('ROLLBACK'); } catch (e) { /* ignore */ }
      console.error('ConversationService.blockUser error:', err);
      throw err;
    } finally {
      try { client.release(); } catch (e) { /* ignore */ }
    }
  }
}

module.exports = ConversationService;
