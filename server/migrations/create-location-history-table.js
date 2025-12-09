/**
 * Create location_history table for tracking user location changes
 * This helps detect suspicious activity and improves recommendations
 */

const { query } = require('../config/database');

async function createLocationHistoryTable() {
  try {
    console.log('📍 Creating location_history table...');
    
    await query(`
      CREATE TABLE IF NOT EXISTS location_history (
        id SERIAL PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        city VARCHAR(255),
        country VARCHAR(255),
        country_code VARCHAR(3),
        source VARCHAR(50), -- 'gps', 'profile', 'ip', 'manual'
        accuracy VARCHAR(50), -- 'high', 'medium', 'low', 'city', 'country'
        confidence VARCHAR(50), -- 'high', 'medium', 'low'
        ip_address INET,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, timestamp)
      );
    `);
    
    // Create indexes for better query performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_location_history_user 
      ON location_history(user_id);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_location_history_timestamp 
      ON location_history(timestamp DESC);
    `);
    
    await query(`
      CREATE INDEX IF NOT EXISTS idx_location_history_coords 
      ON location_history(latitude, longitude) 
      WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
    `);
    
    console.log('✅ Location history table created successfully');
    
    return true;
  } catch (error) {
    console.error('❌ Error creating location_history table:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  createLocationHistoryTable()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = createLocationHistoryTable;
