const { query } = require('./config/database');

async function fixTransactionsTable() {
  try {
    console.log('🔧 Adding missing columns to transactions table...\n');
    
    // Add user_id column
    console.log('📝 Adding user_id column...');
    await query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS user_id UUID
    `);
    console.log('✅ user_id column added');
    
    // Add currency column
    console.log('📝 Adding currency column...');
    await query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'NGN'
    `);
    console.log('✅ currency column added');
    
    // Add payment_method column
    console.log('📝 Adding payment_method column...');
    await query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50)
    `);
    console.log('✅ payment_method column added');
    
    // Add payment_intent_id column
    console.log('📝 Adding payment_intent_id column...');
    await query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255)
    `);
    console.log('✅ payment_intent_id column added');
    
    // Add reference column
    console.log('📝 Adding reference column...');
    await query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS reference VARCHAR(255) UNIQUE
    `);
    console.log('✅ reference column added');
    
    // Add country_code column
    console.log('📝 Adding country_code column...');
    await query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS country_code VARCHAR(10)
    `);
    console.log('✅ country_code column added');
    
    // Add metadata column
    console.log('📝 Adding metadata column...');
    await query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb
    `);
    console.log('✅ metadata column added');
    
    // Add confirmed_at column
    console.log('📝 Adding confirmed_at column...');
    await query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP
    `);
    console.log('✅ confirmed_at column added');
    
    // Add description column
    console.log('📝 Adding description column...');
    await query(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS description TEXT
    `);
    console.log('✅ description column added');
    
    // Create indexes
    console.log('\n📊 Creating indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference);
      CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
    `);
    console.log('✅ Indexes created');
    
    // Verify
    console.log('\n📊 Verifying transactions table:');
    const check = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'transactions'
      ORDER BY ordinal_position
    `);
    check.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type}`);
    });
    
    console.log('\n🎉 Transactions table fix complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error fixing transactions table:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

fixTransactionsTable();
