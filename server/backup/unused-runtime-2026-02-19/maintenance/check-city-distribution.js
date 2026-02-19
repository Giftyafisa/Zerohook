/**
 * Check provider distribution by city
 */
const { query } = require('./config/database');

async function checkDistribution() {
  try {
    const result = await query(`
      SELECT 
        profile_data->'location'->>'city' as city, 
        COUNT(*) as count 
      FROM users 
      WHERE profile_data->>'accountType' = 'provider' 
      GROUP BY profile_data->'location'->>'city' 
      ORDER BY count DESC
    `);

    console.log('\n📊 Provider distribution by city:\n');
    result.rows.forEach(row => {
      console.log(`${(row.city || 'Unknown').padEnd(25)} : ${row.count} providers`);
    });
    
    console.log(`\n📍 Total: ${result.rows.reduce((s, r) => s + parseInt(r.count), 0)} providers`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkDistribution();
