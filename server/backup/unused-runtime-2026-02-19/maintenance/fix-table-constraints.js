require('dotenv').config({ path: './env.production' });
const { query } = require('./config/database');

async function fixTableConstraints() {
  try {
    console.log('🔧 Fixing table constraints...\n');
    
    // Add unique constraint to user_presence table for user_id
    console.log('📝 Adding unique constraint to user_presence table...');
    
    try {
      await query('ALTER TABLE user_presence ADD CONSTRAINT user_presence_user_id_unique UNIQUE (user_id)');
      console.log('✅ Added unique constraint on user_id');
    } catch (error) {
      if (error.code === '42710') {
        console.log('ℹ️  Unique constraint already exists');
      } else {
        console.log('⚠️  Error adding unique constraint:', error.message);
      }
    }
    
    // Add unique constraint to user_sessions table for session_token
    console.log('\n📝 Adding unique constraint to user_sessions table...');
    
    try {
      await query('ALTER TABLE user_sessions ADD CONSTRAINT user_sessions_session_token_unique UNIQUE (session_token)');
      console.log('✅ Added unique constraint on session_token');
    } catch (error) {
      if (error.code === '42710') {
        console.log('ℹ️  Unique constraint already exists');
      } else {
        console.log('⚠️  Error adding unique constraint:', error.message);
      }
    }
    
    // Verify the constraints
    console.log('\n🔍 Verifying table constraints...');
    
    const constraintsResult = await query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name IN ('user_presence', 'user_sessions')
        AND tc.constraint_type = 'UNIQUE'
      ORDER BY tc.table_name, tc.constraint_name
    `);
    
    console.log('\n📊 Unique constraints:');
    constraintsResult.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}.${row.column_name} - ${row.constraint_name}`);
    });
    
    console.log('\n✅ Table constraints fix completed!');
    
  } catch (error) {
    console.error('❌ Error fixing table constraints:', error.message);
  }
}

fixTableConstraints()
  .then(() => {
    console.log('\n✅ Table constraints fix completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Table constraints fix failed:', error);
    process.exit(1);
  });


