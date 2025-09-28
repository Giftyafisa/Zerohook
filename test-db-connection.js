const { Pool } = require('pg');
require('dotenv').config({ path: './env.local' });

console.log('🔍 Testing database connection and fixing schema...');
console.log('Environment:', process.env.NODE_ENV);
console.log('Database URL:', process.env.DATABASE_URL ? 'Found' : 'Missing');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testConnectionAndFix() {
  let client;
  
  try {
    console.log('📡 Attempting to connect...');
    client = await pool.connect();
    console.log('✅ Database connection successful!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('⏰ Current database time:', result.rows[0].current_time);
    
    // Now fix the database schema
    console.log('\n🔧 Starting database schema fixes...');
    
    // 1. Create service_categories table
    console.log('📋 Creating service_categories table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS service_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(150) NOT NULL,
        description TEXT,
        base_price DECIMAL(10,2),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ service_categories table created/verified');
    
    // 2. Insert default service categories
    console.log('📝 Inserting default service categories...');
    await client.query(`
      INSERT INTO service_categories (name, display_name, description, base_price) VALUES
      ('long_term', 'Long Term', 'Long-term companionship and relationship services', 50000.00),
      ('short_term', 'Short Term', 'Short-term and casual services', 25000.00),
      ('oral_services', 'Oral Services', 'Specialized oral service offerings', 15000.00),
      ('special_services', 'Special Services', 'Specialized and fetish services', 35000.00)
      ON CONFLICT (name) DO NOTHING;
    `);
    console.log('✅ Default categories inserted');
    
    // 3. Add missing columns to services table
    console.log('🔧 Adding missing columns to services table...');
    
    const columnsToAdd = [
      { name: 'provider_id', type: 'UUID REFERENCES users(id) ON DELETE CASCADE' },
      { name: 'category_id', type: 'UUID REFERENCES service_categories(id) ON DELETE SET NULL' },
      { name: 'status', type: 'VARCHAR(20) DEFAULT \'active\'' },
      { name: 'duration_minutes', type: 'INTEGER' },
      { name: 'location_type', type: 'VARCHAR(50) DEFAULT \'local\'' },
      { name: 'location_data', type: 'JSONB DEFAULT \'{}\'' },
      { name: 'availability', type: 'JSONB DEFAULT \'{}\'' },
      { name: 'requirements', type: 'JSONB DEFAULT \'[]\'' },
      { name: 'media_urls', type: 'JSONB DEFAULT \'[]\'' },
      { name: 'views', type: 'INTEGER DEFAULT 0' },
      { name: 'bookings', type: 'INTEGER DEFAULT 0' },
      { name: 'rating', type: 'DECIMAL(3,2) DEFAULT 0.00' }
    ];
    
    for (const column of columnsToAdd) {
      try {
        await client.query(`
          ALTER TABLE services 
          ADD COLUMN IF NOT EXISTS ${column.name} ${column.type};
        `);
        console.log(`✅ Added column: ${column.name}`);
      } catch (error) {
        console.log(`⚠️ Column ${column.name} might already exist:`, error.message);
      }
    }
    
    // 4. Update existing services to set provider_id
    console.log('🔄 Updating existing services...');
    await client.query(`
      UPDATE services 
      SET provider_id = user_id 
      WHERE provider_id IS NULL AND user_id IS NOT NULL;
    `);
    console.log('✅ Updated provider_id for existing services');
    
    // 5. Set default category_id for existing services
    console.log('🔄 Setting default category for existing services...');
    const defaultCategoryResult = await client.query(`
      SELECT id FROM service_categories WHERE name = 'long_term' LIMIT 1;
    `);
    
    if (defaultCategoryResult.rows.length > 0) {
      const defaultCategoryId = defaultCategoryResult.rows[0].id;
      await client.query(`
        UPDATE services 
        SET category_id = $1 
        WHERE category_id IS NULL;
      `, [defaultCategoryId]);
      console.log('✅ Set default category for existing services');
    }
    
    // 6. Create indexes
    console.log('📊 Creating performance indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_services_provider_id ON services(provider_id);
      CREATE INDEX IF NOT EXISTS idx_services_category_id ON services(category_id);
      CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
    `);
    console.log('✅ Performance indexes created');
    
    console.log('\n🎉 Database schema fixes completed successfully!');
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Database connection or fix failed:', error.message);
    if (client) {
      client.release();
    }
    await pool.end();
  }
}

testConnectionAndFix();
