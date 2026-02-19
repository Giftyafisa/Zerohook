const { query } = require('./config/database');

async function checkUserSubscription() {
  try {
    console.log('🔍 Checking user subscription data...\n');
    
    // Check user subscription data
    const userResult = await query(`
      SELECT id, email, is_subscribed, subscription_tier, subscription_expires_at 
      FROM users 
      WHERE email = $1
    `, ['akua.mensah@ghana.com']);
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log('✅ User found:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Is Subscribed: ${user.is_subscribed}`);
      console.log(`   Subscription Tier: ${user.subscription_tier || 'None'}`);
      console.log(`   Subscription Expires: ${user.subscription_expires_at || 'None'}`);
    } else {
      console.log('❌ User not found');
    }
    
    // Check if subscription columns exist
    console.log('\n🔍 Checking database schema...');
    const schemaResult = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('is_subscribed', 'subscription_tier', 'subscription_expires_at')
      ORDER BY column_name
    `);
    
    console.log(`\n📋 Found ${schemaResult.rows.length} subscription columns:`);
    schemaResult.rows.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    process.exit();
  }
}

checkUserSubscription();
