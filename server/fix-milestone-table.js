const { query } = require('./config/database');

async function fixMilestoneTable() {
  try {
    console.log('🔧 Fixing milestone_requests table...');
    
    // Drop the table and recreate with correct types
    console.log('🗑️ Dropping existing milestone_requests table...');
    await query(`DROP TABLE IF EXISTS milestone_requests CASCADE`);
    
    console.log('📝 Creating milestone_requests table with UUID types...');
    await query(`
      CREATE TABLE milestone_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL,
        recipient_id UUID NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        description TEXT,
        request_type VARCHAR(50) DEFAULT 'provider_request',
        status VARCHAR(50) DEFAULT 'pending',
        escrow_id UUID,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('📊 Creating indexes...');
    await query(`
      CREATE INDEX IF NOT EXISTS idx_milestone_sender ON milestone_requests(sender_id);
      CREATE INDEX IF NOT EXISTS idx_milestone_recipient ON milestone_requests(recipient_id);
      CREATE INDEX IF NOT EXISTS idx_milestone_status ON milestone_requests(status);
      CREATE INDEX IF NOT EXISTS idx_milestone_escrow ON milestone_requests(escrow_id);
    `);
    
    // Verify the table structure
    const checkResult = await query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'milestone_requests'
      ORDER BY ordinal_position
    `);
    
    console.log('✅ Table structure:');
    checkResult.rows.forEach(col => {
      console.log(`   ${col.column_name}: ${col.data_type} (${col.udt_name})`);
    });
    
    console.log('🎉 Milestone table fix complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error fixing milestone table:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

fixMilestoneTable();
