const { query } = require('./config/database');

async function investigateDatabaseConflicts() {
  try {
    console.log('🔍 Investigating Database Schema Conflicts...\n');
    
    // Check subscription_plans table
    console.log('1️⃣ Checking subscription_plans table...');
    try {
      const plansResult = await query('SELECT * FROM subscription_plans ORDER BY created_at');
      console.log(`   Found ${plansResult.rows.length} subscription plans:`);
      plansResult.rows.forEach((plan, index) => {
        console.log(`   ${index + 1}. ID: ${plan.id}, Name: "${plan.plan_name}", Active: ${plan.is_active}`);
      });
    } catch (error) {
      console.log(`   ❌ Error querying subscription_plans: ${error.message}`);
    }
    
    // Check for duplicate plan names
    console.log('\n2️⃣ Checking for duplicate plan names...');
    try {
      const duplicateResult = await query(`
        SELECT plan_name, COUNT(*) as count 
        FROM subscription_plans 
        GROUP BY plan_name 
        HAVING COUNT(*) > 1
      `);
      
      if (duplicateResult.rows.length > 0) {
        console.log('   ❌ Found duplicate plan names:');
        duplicateResult.rows.forEach(dup => {
          console.log(`      - "${dup.plan_name}": ${dup.count} occurrences`);
        });
      } else {
        console.log('   ✅ No duplicate plan names found');
      }
    } catch (error) {
      console.log(`   ❌ Error checking duplicates: ${error.message}`);
    }
    
    // Check table constraints
    console.log('\n3️⃣ Checking table constraints...');
    try {
      const constraintsResult = await query(`
        SELECT 
          tc.constraint_name,
          tc.table_name,
          kcu.column_name,
          tc.constraint_type
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = 'subscription_plans'
        ORDER BY tc.constraint_name
      `);
      
      console.log(`   Found ${constraintsResult.rows.length} constraints:`);
      constraintsResult.rows.forEach(constraint => {
        console.log(`      - ${constraint.constraint_name}: ${constraint.constraint_type} on ${constraint.column_name}`);
      });
    } catch (error) {
      console.log(`   ❌ Error checking constraints: ${error.message}`);
    }
    
    // Check users table schema
    console.log('\n4️⃣ Checking users table schema...');
    try {
      const userColumnsResult = await query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name IN ('is_subscribed', 'subscription_tier', 'subscription_expires_at')
        ORDER BY column_name
      `);
      
      console.log(`   Found ${userColumnsResult.rows.length} subscription columns in users table:`);
      userColumnsResult.rows.forEach(col => {
        console.log(`      - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default})`);
      });
    } catch (error) {
      console.log(`   ❌ Error checking users schema: ${error.message}`);
    }
    
    // Check for data inconsistencies
    console.log('\n5️⃣ Checking for data inconsistencies...');
    try {
      const userDataResult = await query(`
        SELECT 
          id, 
          email, 
          is_subscribed, 
          subscription_tier, 
          subscription_expires_at,
          created_at,
          updated_at
        FROM users 
        WHERE email = 'akua.mensah@ghana.com'
      `);
      
      if (userDataResult.rows.length > 0) {
        const user = userDataResult.rows[0];
        console.log('   ✅ User data found:');
        console.log(`      - ID: ${user.id}`);
        console.log(`      - Email: ${user.email}`);
        console.log(`      - Is Subscribed: ${user.is_subscribed}`);
        console.log(`      - Subscription Tier: ${user.subscription_tier || 'NULL'}`);
        console.log(`      - Subscription Expires: ${user.subscription_expires_at || 'NULL'}`);
        console.log(`      - Created: ${user.created_at}`);
        console.log(`      - Updated: ${user.updated_at}`);
        
        // Check for NULL vs false inconsistencies
        if (user.is_subscribed === null) {
          console.log('   ⚠️  WARNING: is_subscribed is NULL instead of false');
        }
        if (user.subscription_tier === null && user.is_subscribed === true) {
          console.log('   ⚠️  WARNING: User is subscribed but subscription_tier is NULL');
        }
      } else {
        console.log('   ❌ User not found');
      }
    } catch (error) {
      console.log(`   ❌ Error checking user data: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Investigation failed:', error.message);
  } finally {
    process.exit();
  }
}

investigateDatabaseConflicts();
