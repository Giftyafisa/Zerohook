const mongoose = require('mongoose');
const { connectDB, Message } = require('../config/database');

async function addMessagesMetadata() {
  console.log('📦 Ensuring Message metadata/messageType schema and indexes...');
  try {
    await connectDB();

    const hasMetadata = !!Message.schema.path('metadata');
    const hasMessageType = !!Message.schema.path('messageType');
    if (!hasMetadata || !hasMessageType) {
      throw new Error('Message schema is missing metadata or messageType fields');
    }

    await Message.createIndexes();
    const indexes = await Message.collection.indexes();
    console.log(`✅ Message schema valid and indexes ensured (${indexes.length} indexes)`);
  } catch (error) {
    console.error('❌ Failed to ensure Message schema/indexes:', error.message);
    throw error;
  } finally {
    await mongoose.connection.close();
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
