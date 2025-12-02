/**
 * Add mock user akua_mensah to database and fix missing columns
 */
require('dotenv').config({ path: './env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixDatabase() {
  console.log('🔧 Fixing database issues...\n');

  try {
    // 1. Add detected_country column to users if missing
    console.log('📋 Adding detected_country column to users table...');
    try {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS detected_country VARCHAR(10)
      `);
      console.log('✅ detected_country column added/exists');
    } catch (e) {
      console.log('⚠️ Could not add detected_country:', e.message);
    }

    // 2. Check if mock user exists
    const mockUserId = '00000000-0000-0000-0000-000000000001';
    const existingUser = await pool.query(
      'SELECT id, username FROM users WHERE id = $1',
      [mockUserId]
    );

    if (existingUser.rows.length === 0) {
      console.log('\n📋 Creating mock user akua_mensah...');
      
      // Create the mock user
      await pool.query(`
        INSERT INTO users (
          id, username, email, password_hash, 
          verification_tier, reputation_score, 
          is_subscribed, subscription_tier,
          profile_data, detected_country,
          created_at, last_active
        ) VALUES (
          $1, 'akua_mensah', 'akua@example.com', 
          '$2b$10$dummy.hash.for.testing.only',
          2, 85.00,
          false, 'free',
          $2, 'GH',
          NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          username = 'akua_mensah',
          profile_data = $2,
          detected_country = 'GH'
      `, [
        mockUserId,
        JSON.stringify({
          firstName: 'Akua',
          lastName: 'Mensah',
          age: 28,
          location: {
            city: 'Accra',
            country: 'Ghana',
            coordinates: { lat: 5.6037, lng: -0.187 }
          },
          phone: '+233241234567',
          bio: 'Test user from Ghana'
        })
      ]);
      
      console.log('✅ Mock user akua_mensah created');
    } else {
      console.log('✅ Mock user akua_mensah already exists');
      
      // Update their profile_data to include Ghana location
      await pool.query(`
        UPDATE users SET 
          profile_data = $1,
          detected_country = 'GH'
        WHERE id = $2
      `, [
        JSON.stringify({
          firstName: 'Akua',
          lastName: 'Mensah',
          age: 28,
          location: {
            city: 'Accra',
            country: 'Ghana',
            coordinates: { lat: 5.6037, lng: -0.187 }
          },
          phone: '+233241234567',
          bio: 'Test user from Ghana'
        }),
        mockUserId
      ]);
      console.log('✅ Updated akua_mensah profile with Ghana location');
    }

    // 3. Verify the user
    const verifyUser = await pool.query(
      'SELECT id, username, profile_data, detected_country FROM users WHERE id = $1',
      [mockUserId]
    );
    console.log('\n📊 Verified user:', JSON.stringify(verifyUser.rows[0], null, 2));

    console.log('\n✅ Database fixes complete!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixDatabase();
