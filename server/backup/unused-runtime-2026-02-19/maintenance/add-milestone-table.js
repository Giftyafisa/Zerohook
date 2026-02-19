/**
 * Add milestone_requests table for payment request system
 * 
 * Run with: node add-milestone-table.js
 */

const { query } = require('./config/database');

async function addMilestoneTable() {
  console.log('🔧 Adding milestone_requests table...');

  try {
    // Create milestone_requests table (without strict foreign keys for flexibility)
    await query(`
      CREATE TABLE IF NOT EXISTS milestone_requests (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL,
        recipient_id INTEGER NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        description TEXT,
        request_type VARCHAR(50) DEFAULT 'provider_request',
        status VARCHAR(50) DEFAULT 'pending',
        escrow_id INTEGER,
        conversation_id INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ milestone_requests table created');

    // Add indexes
    await query(`
      CREATE INDEX IF NOT EXISTS idx_milestone_sender ON milestone_requests(sender_id);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_milestone_recipient ON milestone_requests(recipient_id);
    `);
    await query(`
      CREATE INDEX IF NOT EXISTS idx_milestone_status ON milestone_requests(status);
    `);
    console.log('✅ Indexes created');

    console.log('🎉 Milestone table setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addMilestoneTable();
