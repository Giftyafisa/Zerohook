const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

async function deepInvestigation() {
  console.log('🔍 DEEP INVESTIGATION: Subscription Status Update Issue\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const client = await pool.connect();
    console.log('✅ Connected to database');

    // Focus on the specific user who has active subscriptions
    const targetUserId = '1b574327-9365-4d98-8e49-68cb87bd05a8';
    
    console.log(`\n🎯 INVESTIGATING USER: ${targetUserId}`);

    // Check user's current status
    const userResult = await client.query(`
      SELECT id, email, is_subscribed, subscription_tier, subscription_expires_at, created_at, updated_at
      FROM users 
      WHERE id = $1
    `, [targetUserId]);

    if (userResult.rows.length === 0) {
      console.log('❌ User not found');
      return;
    }

    const user = userResult.rows[0];
    console.log('\n👤 USER STATUS:');
    console.log(`  - ID: ${user.id}`);
    console.log(`  - Email: ${user.email}`);
    console.log(`  - is_subscribed: ${user.is_subscribed}`);
    console.log(`  - subscription_tier: ${user.subscription_tier || 'None'}`);
    console.log(`  - subscription_expires_at: ${user.subscription_expires_at || 'None'}`);
    console.log(`  - created_at: ${user.created_at}`);
    console.log(`  - updated_at: ${user.updated_at}`);

    // Check ALL subscriptions for this user
    const subscriptionsResult = await client.query(`
      SELECT id, plan_id, amount, currency, country_code, paystack_reference, status, 
             created_at, activated_at, updated_at
      FROM subscriptions 
      WHERE user_id = $1
      ORDER BY created_at DESC
    `, [targetUserId]);

    console.log(`\n💳 SUBSCRIPTIONS FOR USER (${subscriptionsResult.rows.length} total):`);
    subscriptionsResult.rows.forEach((sub, index) => {
      console.log(`\n  ${index + 1}. Subscription ID: ${sub.id}`);
      console.log(`     - Plan ID: ${sub.plan_id}`);
      console.log(`     - Amount: ${sub.amount} ${sub.currency}`);
      console.log(`     - Status: ${sub.status}`);
      console.log(`     - Paystack Reference: ${sub.paystack_reference}`);
      console.log(`     - Created: ${sub.created_at}`);
      console.log(`     - Activated: ${sub.activated_at || 'Not activated'}`);
      console.log(`     - Updated: ${sub.updated_at || 'Never updated'}`);
    });

    // Check if there are any active subscriptions
    const activeSubscriptions = subscriptionsResult.rows.filter(sub => sub.status === 'active');
    console.log(`\n✅ ACTIVE SUBSCRIPTIONS: ${activeSubscriptions.length}`);

    if (activeSubscriptions.length > 0) {
      console.log('\n🚨 CRITICAL ISSUE FOUND:');
      console.log('   User has active subscriptions but is_subscribed = false');
      console.log('   This indicates the user status update is failing');
      
      // Check the subscription_plans table for the plan details
      const planIds = [...new Set(activeSubscriptions.map(sub => sub.plan_id))];
      console.log(`\n📋 PLAN IDs: ${planIds.join(', ')}`);
      
      for (const planId of planIds) {
        const planResult = await client.query(`
          SELECT id, plan_name, description, price, currency, features, is_active
          FROM subscription_plans 
          WHERE id = $1
        `, [planId]);
        
        if (planResult.rows.length > 0) {
          const plan = planResult.rows[0];
          console.log(`\n  Plan ${planId}:`);
          console.log(`    - Name: ${plan.plan_name}`);
          console.log(`    - Price: $${plan.price} ${plan.currency}`);
          console.log(`    - Active: ${plan.is_active}`);
        }
      }
    }

    // Check for any database constraints or triggers that might be interfering
    console.log('\n🔍 CHECKING DATABASE CONSTRAINTS:');
    
    // Check if there are any triggers on the users table
    const triggersResult = await client.query(`
      SELECT trigger_name, event_manipulation, event_object_table, action_statement
      FROM information_schema.triggers 
      WHERE event_object_table = 'users'
    `);
    
    if (triggersResult.rows.length > 0) {
      console.log('⚠️  TRIGGERS FOUND on users table:');
      triggersResult.rows.forEach(trigger => {
        console.log(`  - ${trigger.trigger_name}: ${trigger.event_manipulation} on ${trigger.event_object_table}`);
        console.log(`    Action: ${trigger.action_statement}`);
      });
    } else {
      console.log('✅ No triggers found on users table');
    }

    // Check table structure
    console.log('\n🏗️  TABLE STRUCTURE:');
    
    const userColumnsResult = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);
    
    console.log('Users table columns:');
    userColumnsResult.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    await client.release();
    console.log('\n✅ Deep investigation completed');

  } catch (error) {
    console.error('❌ Deep investigation failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await pool.end();
  }
}

// Run the investigation
deepInvestigation().catch(console.error);


