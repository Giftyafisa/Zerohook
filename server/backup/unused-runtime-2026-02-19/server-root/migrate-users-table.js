const { query } = require('./config/database');

async function migrateUsersTable() {
  console.log('🔄 Migrating users table...\n');

  try {
    // Check if columns already exist
    const checkColumns = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('is_subscribed', 'subscription_tier', 'subscription_expires_at')
    `);

    const existingColumns = checkColumns.rows.map(row => row.column_name);
    console.log('📋 Existing columns:', existingColumns);

    // Add missing columns
    if (!existingColumns.includes('is_subscribed')) {
      console.log('➕ Adding is_subscribed column...');
      await query(`
        ALTER TABLE users 
        ADD COLUMN is_subscribed BOOLEAN DEFAULT false
      `);
      console.log('✅ is_subscribed column added');
    }

    if (!existingColumns.includes('subscription_tier')) {
      console.log('➕ Adding subscription_tier column...');
      await query(`
        ALTER TABLE users 
        ADD COLUMN subscription_tier VARCHAR(50) DEFAULT 'free'
      `);
      console.log('✅ subscription_tier column added');
    }

    if (!existingColumns.includes('subscription_expires_at')) {
      console.log('➕ Adding subscription_expires_at column...');
      await query(`
        ALTER TABLE users 
        ADD COLUMN subscription_expires_at TIMESTAMP
      `);
      console.log('✅ subscription_expires_at column added');
    }

    // Verify the migration
    const finalCheck = await query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('is_subscribed', 'subscription_tier', 'subscription_expires_at')
      ORDER BY column_name
    `);

    console.log('\n📋 Final column status:');
    finalCheck.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'}) default: ${row.column_default || 'none'}`);
    });

    console.log('\n🎉 Users table migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

migrateUsersTable();



