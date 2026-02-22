require('dotenv').config({ path: './env.production' });
const mongoose = require('mongoose');
const { connectDB, Conversation, Message } = require('./config/database');

async function fixChatSchema() {
  console.log('🔧 Fixing Chat System Schema...\n');

  try {
    console.log('📡 Connecting to database...');
    await connectDB();
    console.log('✅ Database connected successfully');

    // Mongoose schemas already define required fields; verify expected paths exist
    console.log('📋 Verifying Mongoose schema fields...');
    const hasConversationStatus = !!Conversation.schema.path('status');
    const hasMessageMetadata = !!Message.schema.path('metadata');
    const hasMessageType = !!Message.schema.path('messageType');

    console.log(`   ${hasConversationStatus ? '✅' : '❌'} Conversation schema status field`);
    console.log(`   ${hasMessageMetadata ? '✅' : '❌'} Message schema metadata field`);
    console.log(`   ${hasMessageType ? '✅' : '❌'} Message schema messageType field`);

    // Ensure indexes are present in MongoDB
    console.log('📋 Creating/refreshing MongoDB indexes...');
    await Conversation.createIndexes();
    await Message.createIndexes();
    console.log('   ✅ Chat indexes ensured');
    
    console.log('\n🎉 Chat system schema fixes completed!');
    
    // Verify the fixes
    console.log('\n🔍 Verifying fixes...');

    const conversationIndexes = await Conversation.collection.indexes();
    const messageIndexes = await Message.collection.indexes();

    console.log(`   ✅ Conversation indexes: ${conversationIndexes.length}`);
    console.log(`   ✅ Message indexes: ${messageIndexes.length}`);

    await mongoose.connection.close();
    
  } catch (error) {
    console.error('❌ Failed to fix chat schema:', error);
    throw error;
  }
}

// Run if this file is executed directly
if (require.main === module) {
  fixChatSchema()
    .then(() => {
      console.log('\n✅ Chat schema fix completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Chat schema fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixChatSchema };
