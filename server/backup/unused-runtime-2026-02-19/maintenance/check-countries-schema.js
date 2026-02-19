const { query } = require('./config/database');

async function checkCountriesSchema() {
  try {
    console.log('Checking countries table schema...');
    
    const result = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'countries' 
      ORDER BY ordinal_position
    `);
    
    console.log('Countries table columns:');
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    // Also check if there's data
    const dataResult = await query('SELECT * FROM countries LIMIT 1');
    if (dataResult.rows.length > 0) {
      console.log('\nSample country data:');
      console.log(dataResult.rows[0]);
    }
    
  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

checkCountriesSchema();



