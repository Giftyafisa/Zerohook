const { query } = require('./config/database');

async function checkSchema() {
  try {
    // Check conversations table
    console.log('=== CONVERSATIONS TABLE COLUMNS ===');
    const convCols = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'conversations' 
      ORDER BY ordinal_position
    `);
    convCols.rows.forEach(r => console.log(`  ${r.column_name} - ${r.data_type} (nullable: ${r.is_nullable})`));
    
    // Check messages table
    console.log('\n=== MESSAGES TABLE COLUMNS ===');
    const msgCols = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'messages' 
      ORDER BY ordinal_position
    `);
    msgCols.rows.forEach(r => console.log(`  ${r.column_name} - ${r.data_type} (nullable: ${r.is_nullable})`));
    
    // Check notifications table
    console.log('\n=== NOTIFICATIONS TABLE ===');
    const notifCols = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'notifications' 
      ORDER BY ordinal_position
    `);
    if (notifCols.rows.length === 0) {
      console.log('  TABLE DOES NOT EXIST!');
    } else {
      notifCols.rows.forEach(r => console.log(`  ${r.column_name} - ${r.data_type} (nullable: ${r.is_nullable})`));
    }
    
    // Check user_connections table
    console.log('\n=== USER_CONNECTIONS TABLE ===');
    const connCols = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'user_connections' 
      ORDER BY ordinal_position
    `);
    if (connCols.rows.length === 0) {
      console.log('  TABLE DOES NOT EXIST!');
    } else {
      connCols.rows.forEach(r => console.log(`  ${r.column_name} - ${r.data_type} (nullable: ${r.is_nullable})`));
    }
    
    // Check blocked_users table
    console.log('\n=== BLOCKED_USERS TABLE ===');
    const blockedCols = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'blocked_users' 
      ORDER BY ordinal_position
    `);
    if (blockedCols.rows.length === 0) {
      console.log('  TABLE DOES NOT EXIST!');
    } else {
      blockedCols.rows.forEach(r => console.log(`  ${r.column_name} - ${r.data_type} (nullable: ${r.is_nullable})`));
    }
    
    // Check bookings table
    console.log('\n=== BOOKINGS TABLE ===');
    const bookCols = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' 
      ORDER BY ordinal_position
    `);
    if (bookCols.rows.length === 0) {
      console.log('  TABLE DOES NOT EXIST!');
    } else {
      bookCols.rows.forEach(r => console.log(`  ${r.column_name} - ${r.data_type} (nullable: ${r.is_nullable})`));
    }
    
    // Sample data
    console.log('\n=== SAMPLE NOTIFICATIONS DATA ===');
    const notifs = await query('SELECT * FROM notifications LIMIT 3');
    console.log('Notifications:', notifs.rows);
    
    console.log('\n=== SAMPLE USER_CONNECTIONS DATA ===');
    const conns = await query('SELECT * FROM user_connections LIMIT 3');
    console.log('User connections:', conns.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSchema();
