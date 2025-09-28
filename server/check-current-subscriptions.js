const { query } = require('./config/database');

async function checkCurrentSubscriptions() {
  try {
    console.log('🔍 Checking current subscriptions in database...\n');

    // Check subscriptions table
    const subscriptionsResult = await query(`
      SELECT id, user_id, plan_id, status, amount, currency, country_code, 
             paystack_reference, created_at, activated_at
      FROM subscriptions 
      ORDER BY created_at DESC
    `);

    console.log('📋 Subscriptions found:', subscriptionsResult.rows.length);
    if (subscriptionsResult.rows.length > 0) {
      console.log('\nLatest subscriptions:');
      subscriptionsResult.rows.forEach((sub, index) => {
        console.log(`\n${index + 1}. Subscription ID: ${sub.id}`);
        console.log(`   User ID: ${sub.user_id}`);
        console.log(`   Status: ${sub.status}`);
        console.log(`   Amount: ${sub.amount} ${sub.currency}`);
        console.log(`   Country: ${sub.country_code}`);
        console.log(`   Paystack Ref: ${sub.paystack_reference}`);
        console.log(`   Created: ${sub.created_at}`);
        console.log(`   Activated: ${sub.activated_at || 'Not activated'}`);
      });
    }

    // Check if there are any pending subscriptions that need activation
    const pendingSubscriptions = subscriptionsResult.rows.filter(sub => sub.status === 'pending');
    if (pendingSubscriptions.length > 0) {
      console.log(`\n⚠️  Found ${pendingSubscriptions.length} pending subscriptions that need payment completion:`);
      pendingSubscriptions.forEach(sub => {
        console.log(`   - ${sub.paystack_reference} (User: ${sub.user_id})`);
      });
      console.log('\n💡 These subscriptions are waiting for users to complete payment on Paystack.');
      console.log('   Once payment is completed, the callback will automatically activate them.');
    }

    // Check subscription plans
    const plansResult = await query(`
      SELECT id, plan_name, price, currency, is_active
      FROM subscription_plans
      WHERE is_active = true
    `);

    console.log(`\n📊 Active subscription plans: ${plansResult.rows.length}`);
    plansResult.rows.forEach(plan => {
      console.log(`   - ${plan.plan_name}: ${plan.price} ${plan.currency}`);
    });

    console.log('\n🎯 SYSTEM STATUS:');
    if (pendingSubscriptions.length > 0) {
      console.log('   ✅ Subscriptions created successfully');
      console.log('   ⏳ Waiting for payment completion on Paystack');
      console.log('   🔄 Callback system ready to activate payments');
    } else if (subscriptionsResult.rows.length > 0) {
      console.log('   ✅ All subscriptions processed');
      console.log('   🎉 Payment system fully operational');
    } else {
      console.log('   📝 No subscriptions yet - system ready for first payment');
    }

  } catch (error) {
    console.error('❌ Error checking subscriptions:', error.message);
  }
}

checkCurrentSubscriptions();



