const { query } = require('./config/database');

async function checkUsersSchema() {
  console.log('🔍 Checking users table schema...\n');

  try {
    // Check all columns in users table
    const result = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `);

    console.log('📋 Users table columns:');
    result.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'}) default: ${row.column_default || 'none'}`);
    });

    // Check specifically for subscription columns
    const subscriptionColumns = result.rows.filter(row => 
      row.column_name.includes('subscription') || row.column_name === 'is_subscribed'
    );

    console.log('\n🔍 Subscription-related columns:');
    if (subscriptionColumns.length > 0) {
      subscriptionColumns.forEach(row => {
        console.log(`   ✅ ${row.column_name}: ${row.data_type}`);
      });
    } else {
      console.log('   ❌ No subscription columns found');
    }

    // Check if we can query the users table
    const userCount = await query('SELECT COUNT(*) as count FROM users');
    console.log(`\n📊 Total users in database: ${userCount.rows[0].count}`);

  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
    
    if (error.code === '42703') {
      console.log('\n💡 This error means the column does not exist.');
      console.log('   The database schema needs to be updated.');
    }
  }
}

checkUsersSchema();



