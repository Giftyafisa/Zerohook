/**
 * Check Tema providers specifically
 */
const { query } = require('./config/database');

async function checkTemaProviders() {
  try {
    const result = await query(`
      SELECT 
        id,
        username,
        profile_data->'location' as location
      FROM users 
      WHERE profile_data->>'accountType' = 'provider' 
      AND profile_data->'location'->>'city' ILIKE '%tema%'
    `);

    console.log('\n📍 Tema providers:\n');
    result.rows.forEach(row => {
      console.log(`Username: ${row.username}`);
      console.log(`Location data: ${JSON.stringify(row.location, null, 2)}`);
      console.log('-'.repeat(40));
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkTemaProviders();
