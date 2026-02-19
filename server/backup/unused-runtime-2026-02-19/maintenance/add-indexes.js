const { query } = require("./config/database");

async function addDatabaseIndexes() {
  try {
    console.log('🔧 Adding database performance indexes...');
    // Add performance indexes for users table
    console.log('📊 Creating users table indexes...');
    await query('CREATE INDEX IF NOT EXISTS idx_users_profile_data ON users USING GIN (profile_data);');
    await query('CREATE INDEX IF NOT EXISTS idx_users_verification_tier ON users(verification_tier);');
    await query('CREATE INDEX IF NOT EXISTS idx_users_reputation_score ON users(reputation_score);');
    await query('CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);');
    await query('CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIN ((profile_data->\
location\));');
    await query('CREATE INDEX IF NOT EXISTS idx_users_age ON users USING GIN ((profile_data->\
age\));');
    await query('CREATE INDEX IF NOT EXISTS idx_users_base_price ON users USING GIN ((profile_data->\
basePrice\));');
    await query('CREATE INDEX IF NOT EXISTS idx_users_service_categories ON users USING GIN ((profile_data->\
serviceCategories\));');
    await query('CREATE INDEX IF NOT EXISTS idx_users_availability ON users USING GIN ((profile_data->\
availability\));');
    await query('CREATE INDEX IF NOT EXISTS idx_users_country ON users USING GIN ((profile_data->\
location\->\country\));');
    await query('CREATE INDEX IF NOT EXISTS idx_users_city ON users USING GIN ((profile_data->\
location\->\city\));');
    console.log('✅ All database indexes created successfully!');
  } catch (error) {
