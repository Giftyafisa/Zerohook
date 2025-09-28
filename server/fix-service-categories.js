require('dotenv').config({ path: './env.local' });
const { Pool } = require('pg');

console.log('🚨 EMERGENCY SERVICE CATEGORIES FIX');

// Create a new pool with enhanced connection settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  acquireTimeoutMillis: 30000,
  reapIntervalMillis: 1000,
  createTimeoutMillis: 30000,
  retryDelay: 1000,
  maxRetries: 5
});

const query = async (text, params) => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

const fixServiceCategories = async () => {
  try {
    console.log('🔧 Creating service_categories table...');
    
    // Create service_categories table
    await query(`
      CREATE TABLE IF NOT EXISTS service_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) UNIQUE NOT NULL,
        display_name VARCHAR(150) NOT NULL,
        description TEXT,
        base_price DECIMAL(10,2) DEFAULT 0.00,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ service_categories table created');

    // Insert default categories
    await query(`
      INSERT INTO service_categories (name, display_name, description, base_price) VALUES
      ('long_term', 'Long Term', 'Long-term companionship services', 50000.00),
      ('short_term', 'Short Term', 'Short-term services', 25000.00),
      ('oral_services', 'Oral Services', 'Specialized services', 15000.00),
      ('special_services', 'Special Services', 'Premium services', 35000.00)
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('✅ Default categories inserted');

    // Create indexes for performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_service_categories_name ON service_categories(name)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_service_categories_active ON service_categories(is_active)
    `);
    console.log('✅ Performance indexes created');

    // Fix services table schema
    console.log('🔧 Fixing services table schema...');
    
    // Add missing columns to services table
    const columnsToAdd = [
      'provider_id UUID REFERENCES users(id) ON DELETE CASCADE',
      'category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL',
      'status VARCHAR(20) DEFAULT \'active\'',
      'duration_minutes INTEGER',
      'location_type VARCHAR(50) DEFAULT \'local\'',
      'location_data JSONB DEFAULT \'{}\'',
      'availability JSONB DEFAULT \'{}\'',
      'requirements JSONB DEFAULT \'[]\'',
      'media_urls JSONB DEFAULT \'[]\'',
      'views INTEGER DEFAULT 0',
      'bookings INTEGER DEFAULT 0',
      'rating DECIMAL(3,2) DEFAULT 0.00'
    ];

    for (const columnDef of columnsToAdd) {
      try {
        const columnName = columnDef.split(' ')[0];
        await query(`ALTER TABLE services ADD COLUMN IF NOT EXISTS ${columnDef}`);
        console.log(`✅ Added column: ${columnName}`);
      } catch (error) {
        if (error.code === '42701') { // Column already exists
          console.log(`ℹ️  Column already exists: ${columnDef.split(' ')[0]}`);
        } else {
          console.log(`⚠️  Could not add column ${columnDef.split(' ')[0]}: ${error.message}`);
        }
      }
    }

    // Create performance indexes for services
    await query(`
      CREATE INDEX IF NOT EXISTS idx_services_provider_id ON services(provider_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_services_category_id ON services(category_id)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_services_status ON services(status)
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_services_price ON services(price)
    `);
    console.log('✅ Services table indexes created');

    // Verify the fix
    console.log('🔍 Verifying fix...');
    const categoriesResult = await query('SELECT COUNT(*) as count FROM service_categories');
    const servicesResult = await query('SELECT COUNT(*) as count FROM services');
    
    console.log(`✅ service_categories table has ${categoriesResult.rows[0].count} categories`);
    console.log(`✅ services table has ${servicesResult.rows[0].count} services`);

    console.log('🎉 Service categories fix completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Service categories fix failed:', error.message);
    console.error('🔍 Error details:', error);
    return false;
  } finally {
    await pool.end();
  }
};

// Execute the fix
fixServiceCategories().then(success => {
  if (success) {
    console.log('🚀 Service categories fix completed successfully!');
    process.exit(0);
  } else {
    console.log('❌ Service categories fix failed!');
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 Fatal error during service categories fix:', error);
  process.exit(1);
});



