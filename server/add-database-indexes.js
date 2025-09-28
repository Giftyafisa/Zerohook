// Load environment variables first
require('dotenv').config({ path: './env.production' });

const { query } = require('./config/database');

console.log('🚀 Adding database performance indexes...');

async function addIndexes() {
  try {
    console.log('📊 Creating indexes for better performance...');
    
    // 1. Location-based indexes for fast filtering
    console.log('📍 Creating location indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_profile_data_country 
      ON users ((profile_data->>'country'));
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_profile_data_city 
      ON users ((profile_data->>'city'));
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_profile_data_location 
      ON users USING GIN (profile_data->'location');
    `);
    
    // 2. Age filtering index
    console.log('🎂 Creating age index...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_profile_data_age 
      ON users ((profile_data->>'age'));
    `);
    
    // 3. Verification and trust score indexes
    console.log('⭐ Creating verification indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_verification_tier 
      ON users (verification_tier);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_reputation_score 
      ON users (reputation_score);
    `);
    
    // 4. Service category indexes
    console.log('🏷️ Creating service category indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_service_categories 
      ON users USING GIN (profile_data->'serviceCategories');
    `);
    
    // 5. Price range indexes
    console.log('💰 Creating price indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_base_price 
      ON users ((profile_data->>'basePrice'));
    `);
    
    // 6. Availability indexes
    console.log('📅 Creating availability indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_availability 
      ON users USING GIN (profile_data->'availability');
    `);
    
    // 7. Composite indexes for common filter combinations
    console.log('🔗 Creating composite indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_country_city 
      ON users ((profile_data->>'country'), (profile_data->>'city'));
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_verification_reputation 
      ON users (verification_tier, reputation_score);
    `);
    
    // 8. Timestamp indexes for sorting
    console.log('⏰ Creating timestamp indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_created_at 
      ON users (created_at DESC);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_last_active 
      ON users (last_active DESC);
    `);
    
    // 9. Subscription status indexes
    console.log('💎 Creating subscription indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_subscription_status 
      ON users (is_subscribed, subscription_tier);
    `);
    
    // 10. Text search indexes for bio and specializations
    console.log('🔍 Creating text search indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_bio_search 
      ON users USING GIN (to_tsvector('english', profile_data->>'bio'));
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_users_specializations_search 
      ON users USING GIN (profile_data->'specializations');
    `);
    
    console.log('✅ All indexes created successfully!');
    
    // Show index information
    const indexResult = await query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE tablename = 'users' 
      ORDER BY indexname;
    `);
    
    console.log('\n📋 Current indexes on users table:');
    indexResult.rows.forEach(row => {
      console.log(`  - ${row.indexname}`);
    });
    
  } catch (error) {
    console.error('❌ Error creating indexes:', error);
    throw error;
  }
}

// Run the index creation
addIndexes()
  .then(() => {
    console.log('🎉 Database optimization complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed to create indexes:', error);
    process.exit(1);
  });
