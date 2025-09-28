const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function checkReviewsTable() {
  console.log('🔍 Checking reviews table structure...\n');
  
  try {
    const reviewsColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reviews'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Reviews table columns:');
    reviewsColumns.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });
    
    // Check if there are any reviews
    const reviewsCount = await pool.query('SELECT COUNT(*) FROM reviews');
    console.log(`\n📊 Total reviews in database: ${reviewsCount.rows[0].count}`);
    
    if (parseInt(reviewsCount.rows[0].count) > 0) {
      const sampleReview = await pool.query('SELECT * FROM reviews LIMIT 1');
      console.log('\n📋 Sample review data:');
      console.log(JSON.stringify(sampleReview.rows[0], null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  checkReviewsTable();
}
