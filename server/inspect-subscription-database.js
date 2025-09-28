const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

async function inspectSubscriptionDatabase() {
  console.log('🔍 Inspecting Subscription Database...\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Check subscription_plans table
    console.log('\n📋 Subscription Plans:');
    const plansResult = await client.query('SELECT * FROM subscription_plans');
    console.log(`Found ${plansResult.rows.length} plans:`);
    plansResult.rows.forEach(plan => {
      console.log(`  - ${plan.plan_name}: $${plan.price} ${plan.currency} (${plan.is_active ? 'Active' : 'Inactive'})`);
    });

    // Check subscriptions table
    console.log('\n💳 Subscriptions:');
    const subscriptionsResult = await client.query('SELECT * FROM subscriptions ORDER BY created_at DESC LIMIT 10');
    console.log(`Found ${subscriptionsResult.rows.length} subscriptions:`);
    subscriptionsResult.rows.forEach(sub => {
      console.log(`  - ID: ${sub.id}, User: ${sub.user_id}, Status: ${sub.status}, Reference: ${sub.paystack_reference}, Created: ${sub.created_at}`);
    });

    // Check users table for subscription status
    console.log('\n👥 Users Subscription Status:');
    const usersResult = await client.query('SELECT id, email, is_subscribed, subscription_tier, subscription_expires_at FROM users ORDER BY created_at DESC LIMIT 10');
    console.log(`Found ${usersResult.rows.length} users:`);
    usersResult.rows.forEach(user => {
      console.log(`  - ID: ${user.id}, Email: ${user.email}, Subscribed: ${user.is_subscribed}, Tier: ${user.subscription_tier || 'None'}`);
    });

    // Check the latest subscription specifically
    if (subscriptionsResult.rows.length > 0) {
      const latestSub = subscriptionsResult.rows[0];
      console.log('\n🔍 Latest Subscription Details:');
      console.log(`  - ID: ${latestSub.id}`);
      console.log(`  - User ID: ${latestSub.user_id}`);
      console.log(`  - Plan ID: ${latestSub.plan_id}`);
      console.log(`  - Status: ${latestSub.status}`);
      console.log(`  - Paystack Reference: ${latestSub.paystack_reference}`);
      console.log(`  - Amount: ${latestSub.amount} ${latestSub.currency}`);
      console.log(`  - Created: ${latestSub.created_at}`);
      console.log(`  - Activated: ${latestSub.activated_at || 'Not activated'}`);
    }

    await client.release();
    console.log('\n✅ Database inspection completed');

  } catch (error) {
    console.error('❌ Database inspection failed:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the inspection
inspectSubscriptionDatabase().catch(console.error);


