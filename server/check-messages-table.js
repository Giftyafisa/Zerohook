const { query } = require('./config/database');

async function checkMessagesTable() {
  try {
    console.log('Checking messages table schema...');
    const result = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'messages' 
      ORDER BY ordinal_position
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Messages table does not exist!');
    } else {
      console.log('✅ Messages table exists with columns:');
      result.rows.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    }
    
    // Try to count messages
    const count = await query('SELECT COUNT(*) as count FROM messages');
    console.log(`\n📊 Total messages in database: ${count.rows[0].count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkMessagesTable();
