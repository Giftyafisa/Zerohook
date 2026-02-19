require('dotenv').config({ path: './env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
  try {
    // Check conversations table
    const convCols = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'conversations' ORDER BY ordinal_position"
    );
    console.log('conversations columns:', convCols.rows.map(x => x.column_name));

    // Check messages table
    const msgCols = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'messages' ORDER BY ordinal_position"
    );
    console.log('messages columns:', msgCols.rows.map(x => x.column_name));

    // Check notifications table
    const notifCols = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'notifications' ORDER BY ordinal_position"
    );
    console.log('notifications columns:', notifCols.rows.map(x => x.column_name));
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await pool.end();
  }
}

checkColumns();
