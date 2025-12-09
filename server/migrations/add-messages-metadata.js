/**
 * Migration: Add metadata column to messages table
 * Safe to run multiple times; only applies when missing.
 */
const { query } = require('../config/database');

async function addMessagesMetadata() {
  console.log('📦 Ensuring messages.metadata column exists...');
  try {
    const check = await query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'messages' AND column_name = 'metadata'
    `);

    if (check.rows.length === 0) {
      await query(`
        ALTER TABLE messages
        ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb
      `);
      console.log('✅ Added metadata column to messages table');
    } else {
      console.log('✅ metadata column already present');
    }

    // Helpful index for metadata queries
    await query(`CREATE INDEX IF NOT EXISTS idx_messages_metadata ON messages USING GIN(metadata)`);
  } catch (error) {
    console.error('❌ Failed to ensure messages.metadata:', error.message);
    throw error;
  }
}

if (require.main === module) {
  addMessagesMetadata()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed', err);
      process.exit(1);
    });
}

module.exports = addMessagesMetadata;
