require('dotenv').config({ path: './env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkServices() {
  try {
    // Check services table structure
    const columns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'services'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 services table columns:');
    columns.rows.forEach(c => console.log('  ', c.column_name, '-', c.data_type));

    // Check count
    const count = await pool.query('SELECT COUNT(*) FROM services');
    console.log('\n📊 Total services:', count.rows[0].count);

    // Check adult_services count
    const adultCount = await pool.query('SELECT COUNT(*) FROM adult_services');
    console.log('📊 Total adult_services:', adultCount.rows[0].count);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkServices();
