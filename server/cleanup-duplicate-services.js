const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function cleanupDuplicateServices() {
  console.log('🧹 Cleaning up duplicate services...\n');
  
  try {
    // First, let's see what we have
    const allServices = await pool.query(`
      SELECT id, title, description, price, category_id, provider_id, created_at
      FROM services
      ORDER BY created_at DESC
    `);
    
    console.log(`📊 Found ${allServices.rows.length} total services`);
    
    // Keep only the most recent 20 services (the real adult services we just created)
    const servicesToKeep = allServices.rows.slice(0, 20);
    const servicesToDelete = allServices.rows.slice(20);
    
    console.log(`✅ Keeping ${servicesToKeep.length} real adult services`);
    console.log(`🗑️ Deleting ${servicesToDelete.length} duplicate/old services`);
    
    // Delete the old services
    for (const service of servicesToDelete) {
      await pool.query('DELETE FROM services WHERE id = $1', [service.id]);
      console.log(`   🗑️ Deleted: ${service.title}`);
    }
    
    // Verify the cleanup
    const finalCount = await pool.query('SELECT COUNT(*) as total FROM services');
    console.log(`\n🎉 Cleanup complete! Final service count: ${finalCount.rows[0].total}`);
    
    // Show what we kept
    const remainingServices = await pool.query(`
      SELECT title, price, category_id, provider_id
      FROM services
      ORDER BY created_at DESC
    `);
    
    console.log('\n📋 Remaining Services:');
    remainingServices.rows.forEach((service, index) => {
      console.log(`   ${index + 1}. ${service.title} - $${service.price}`);
    });
    
  } catch (error) {
    console.error('❌ Error cleaning up services:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  cleanupDuplicateServices();
}
