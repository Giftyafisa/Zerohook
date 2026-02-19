require('dotenv').config({ path: './env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkUser() {
  try {
    // List all users
    const allUsers = await pool.query(
      "SELECT id, username, email, profile_data FROM users LIMIT 10"
    );
    console.log('All users:');
    allUsers.rows.forEach(user => {
      console.log(`- ${user.username}: ${JSON.stringify(user.profile_data?.location || 'no location')}`);
    });
  } catch (e) {
    console.log('Error:', e.message);
  } finally {
    await pool.end();
  }
}

checkUser();
