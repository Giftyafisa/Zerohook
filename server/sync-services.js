/**
 * Sync adult_services data to services table
 */
require('dotenv').config({ path: './env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function syncServices() {
  console.log('🔄 Syncing services tables...\n');

  try {
    // Check what tables exist
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('services', 'adult_services', 'service_categories')
    `);
    console.log('📋 Found tables:', tables.rows.map(r => r.table_name));

    // Check adult_services count
    const adultCount = await pool.query('SELECT COUNT(*) FROM adult_services');
    console.log('📊 adult_services count:', adultCount.rows[0].count);

    // Check services count
    const servicesCount = await pool.query('SELECT COUNT(*) FROM services');
    console.log('📊 services count:', servicesCount.rows[0].count);

    // Get service_categories
    const categories = await pool.query('SELECT id, name FROM service_categories');
    console.log('📋 service_categories:', categories.rows);

    // Create a category map
    const categoryMap = {};
    for (const cat of categories.rows) {
      categoryMap[cat.name.toLowerCase()] = cat.id;
    }

    // Get adult_services data
    const adultServices = await pool.query(`
      SELECT * FROM adult_services LIMIT 5
    `);
    console.log('\n📋 Sample adult_services structure:');
    if (adultServices.rows.length > 0) {
      console.log('Columns:', Object.keys(adultServices.rows[0]));
      console.log('Sample row:', adultServices.rows[0]);
    }

    // Get services table structure
    const servicesStructure = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'services' 
      ORDER BY ordinal_position
    `);
    console.log('\n📋 services table structure:');
    console.log(servicesStructure.rows.map(r => `${r.column_name} (${r.data_type})`));

    // If services table is empty, copy data from adult_services
    if (parseInt(servicesCount.rows[0].count) === 0 && parseInt(adultCount.rows[0].count) > 0) {
      console.log('\n🔄 Copying data from adult_services to services...');
      
      const allAdultServices = await pool.query('SELECT * FROM adult_services');
      
      for (const service of allAdultServices.rows) {
        // Map category to category_id
        let categoryId = null;
        if (service.category) {
          // Try to find matching category
          const catName = service.category.toLowerCase();
          categoryId = categoryMap[catName] || categoryMap['companionship'] || categories.rows[0]?.id;
        }

        try {
          await pool.query(`
            INSERT INTO services (
              id, provider_id, category_id, title, description, 
              price, duration_minutes, location_type, location_data,
              media_urls, status, views, bookings, rating, created_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
            ) ON CONFLICT (id) DO NOTHING
          `, [
            service.id,
            service.provider_id,
            categoryId,
            service.title,
            service.description,
            service.price,
            service.duration_minutes || 60,
            service.location_type || 'flexible',
            service.location_data || '{}',
            service.media_urls || '[]',
            service.status || 'active',
            service.views || 0,
            service.bookings || 0,
            service.rating || 0,
            service.created_at || new Date()
          ]);
          console.log(`✅ Copied: ${service.title}`);
        } catch (e) {
          console.log(`❌ Failed to copy ${service.title}:`, e.message);
        }
      }

      const newCount = await pool.query('SELECT COUNT(*) FROM services');
      console.log(`\n📊 New services count: ${newCount.rows[0].count}`);
    }

    console.log('\n✅ Sync complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

syncServices();
