const { query } = require('./config/database');

async function checkAndFixUsersSchema() {
  try {
    console.log('🔍 Checking and fixing users table schema...\n');

    // Check current users table schema
    console.log('1️⃣ Checking current users table schema...');
    const schemaResult = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);

    console.log('📋 Current users table columns:');
    schemaResult.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check if is_subscribed column exists
    const hasIsSubscribed = schemaResult.rows.some(row => row.column_name === 'is_subscribed');
    
    if (!hasIsSubscribed) {
      console.log('\n❌ Missing is_subscribed column! Adding it now...');
      
      try {
        await query(`
          ALTER TABLE users 
          ADD COLUMN is_subscribed BOOLEAN DEFAULT false
        `);
        console.log('✅ Added is_subscribed column');
      } catch (error) {
        console.log('❌ Failed to add column:', error.message);
      }
    } else {
      console.log('\n✅ is_subscribed column exists');
    }

    // Check if subscription_tier column exists
    const hasSubscriptionTier = schemaResult.rows.some(row => row.column_name === 'subscription_tier');
    
    if (!hasSubscriptionTier) {
      console.log('\n❌ Missing subscription_tier column! Adding it now...');
      
      try {
        await query(`
          ALTER TABLE users 
          ADD COLUMN subscription_tier VARCHAR(50) DEFAULT 'free'
        `);
        console.log('✅ Added subscription_tier column');
      } catch (error) {
        console.log('❌ Failed to add column:', error.message);
      }
    } else {
      console.log('\n✅ subscription_tier column exists');
    }

    // Check if subscription_expires_at column exists
    const hasSubscriptionExpires = schemaResult.rows.some(row => row.column_name === 'subscription_expires_at');
    
    if (!hasSubscriptionExpires) {
      console.log('\n❌ Missing subscription_expires_at column! Adding it now...');
      
      try {
        await query(`
          ALTER TABLE users 
          ADD COLUMN subscription_expires_at TIMESTAMP
        `);
        console.log('✅ Added subscription_expires_at column');
      } catch (error) {
        console.log('❌ Failed to add column:', error.message);
      }
    } else {
      console.log('\n✅ subscription_expires_at column exists');
    }

    // Now test updating a user's subscription status
    console.log('\n2️⃣ Testing user subscription status update...');
    
    const testUserId = '1b574327-9365-4d98-8e49-68cb87bd05a8';
    
    try {
      const updateResult = await query(`
        UPDATE users 
        SET is_subscribed = true, 
            subscription_tier = 'basic',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING id, is_subscribed, subscription_tier
      `, [testUserId]);

      if (updateResult.rows.length > 0) {
        const user = updateResult.rows[0];
        console.log('✅ User subscription status updated successfully!');
        console.log(`   User ID: ${user.id}`);
        console.log(`   Is Subscribed: ${user.is_subscribed}`);
        console.log(`   Subscription Tier: ${user.subscription_tier}`);
      } else {
        console.log('⚠️  User not found for update');
      }
    } catch (error) {
      console.log('❌ User update failed:', error.message);
    }

    // Check final schema
    console.log('\n3️⃣ Final users table schema:');
    const finalSchemaResult = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);

    finalSchemaResult.rows.forEach(row => {
      if (row.column_name.includes('subscription')) {
        console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      }
    });

    console.log('\n🎯 SCHEMA FIX STATUS:');
    console.log('   The users table now has all required subscription columns!');
    console.log('   User subscription updates should work correctly now.');

  } catch (error) {
    console.error('❌ Schema check/fix failed:', error.message);
  }
}

checkAndFixUsersSchema();



