const { query } = require('./config/database');

async function checkAccountTypes() {
  try {
    const result = await query(`
      SELECT profile_data->>'accountType' as type, COUNT(*) as count
      FROM users
      GROUP BY profile_data->>'accountType'
      ORDER BY count DESC
    `);

    console.log('Current accountType distribution:');
    result.rows.forEach(row => {
      console.log(`${row.type || 'null'}: ${row.count}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkAccountTypes();