const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

async function testUserUpdate() {
  console.log('🧪 TESTING USER UPDATE STATEMENT...\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    const targetUserId = '1b574327-9365-4d98-8e49-68cb87bd05a8';
    
    // First, check current user status
    console.log(`\n👤 CURRENT USER STATUS:`);
    const currentUser = await client.query(`
      SELECT id, email, is_subscribed, subscription_tier, updated_at
      FROM users 
      WHERE id = $1
    `, [targetUserId]);

    if (currentUser.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }

    const user = currentUser.rows[0];
    console.log(`  - ID: ${user.id}`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - is_subscribed: ${user.is_subscribed}`);
    console.log(`  - subscription_tier: ${user.subscription_tier || 'None'}`);
    console.log(`  - updated_at: ${user.updated_at || 'Never updated'}`);

    // Test the exact UPDATE statement that should be working
    console.log(`\n🔄 TESTING UPDATE STATEMENT:`);
    console.log('Executing: UPDATE users SET is_subscribed = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1');
    
    try {
      const updateResult = await client.query(`
        UPDATE users 
        SET is_subscribed = true, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, is_subscribed, updated_at
      `, [targetUserId]);

      console.log(`✅ UPDATE SUCCESSFUL!`);
      console.log(`  - Rows affected: ${updateResult.rowCount}`);
      if (updateResult.rows.length > 0) {
        const updatedUser = updateResult.rows[0];
        console.log(`  - Updated user: ${updatedUser.id}`);
        console.log(`  - New is_subscribed: ${updatedUser.is_subscribed}`);
        console.log(`  - New updated_at: ${updatedUser.updated_at}`);
      }
    } catch (updateError) {
      console.error(`❌ UPDATE FAILED: ${updateError.message}`);
      console.error(`   Code: ${updateError.code}`);
      console.error(`   Detail: ${updateError.detail || 'No detail'}`);
      console.error(`   Hint: ${updateError.hint || 'No hint'}`);
    }

    // Verify the update
    console.log(`\n🔍 VERIFYING UPDATE:`);
    const verifyUser = await client.query(`
      SELECT id, email, is_subscribed, subscription_tier, updated_at
      FROM users 
      WHERE id = $1
    `, [targetUserId]);

    if (verifyUser.rows.length > 0) {
      const updatedUser = verifyUser.rows[0];
      console.log(`  - ID: ${updatedUser.id}`);
      console.log(`  - Email: ${updatedUser.email}`);
      console.log(`  - is_subscribed: ${updatedUser.is_subscribed}`);
      console.log(`  - subscription_tier: ${updatedUser.subscription_tier || 'None'}`);
      console.log(`  - updated_at: ${updatedUser.updated_at || 'Never updated'}`);
    }

    await client.release();
    console.log('\n✅ User update test completed');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the test
testUserUpdate().catch(console.error);


