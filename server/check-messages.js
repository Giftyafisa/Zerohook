require('dotenv').config({ path: './env.local' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function check() {
  // Check conversations with participant details
  console.log('=== CONVERSATIONS ===');
  const convs = await pool.query(`
    SELECT c.id, c.participant1_id, c.participant2_id, 
           u1.username as participant1_name, 
           u2.username as participant2_name,
           c.created_at
    FROM conversations c
    LEFT JOIN users u1 ON c.participant1_id = u1.id
    LEFT JOIN users u2 ON c.participant2_id = u2.id
    ORDER BY c.created_at DESC LIMIT 5
  `);
  convs.rows.forEach(c => {
    console.log('Conv:', c.id.substring(0,8));
    console.log('  Between:', c.participant1_name, '<-->', c.participant2_name);
  });

  // Check messages with sender info
  console.log('\n=== MESSAGES ===');
  const msgs = await pool.query(`
    SELECT m.id, m.conversation_id, m.sender_id, m.content,
           u.username as sender_name
    FROM messages m
    LEFT JOIN users u ON m.sender_id = u.id
    ORDER BY m.created_at DESC LIMIT 5
  `);
  msgs.rows.forEach(m => {
    console.log('Msg from', m.sender_name + ':', m.content?.substring(0,60));
  });

  // Check notifications
  console.log('\n=== NOTIFICATIONS ===');
  const notifs = await pool.query(`
    SELECT n.id, n.user_id, n.type, n.title, n.message,
           u.username as recipient_name
    FROM notifications n
    LEFT JOIN users u ON n.user_id = u.id
    ORDER BY n.created_at DESC LIMIT 5
  `);
  console.log('Notifications count:', notifs.rows.length);
  notifs.rows.forEach(n => {
    console.log('To:', n.recipient_name, '- Type:', n.type);
    console.log('  Title:', n.title);
  });

  pool.end();
}
check();
