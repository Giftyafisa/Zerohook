/**
 * Fix UserSession Index Issue
 * 
 * This script drops the problematic session_token_1 unique index
 * that causes duplicate key errors when session_token is null.
 * 
 * Run with: node scripts/fix-session-index.js
 */

require('dotenv').config({ path: process.env.NODE_ENV === 'production' ? './env.production' : './env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://zerohook:11221122Ga@zerohook.cnyphi4.mongodb.net/zerohook?retryWrites=true&w=majority';

async function fixSessionIndex() {
  console.log('🔧 Connecting to MongoDB...');
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('usersessions');

    // List current indexes
    console.log('\n📋 Current indexes on usersessions collection:');
    const indexes = await collection.indexes();
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} ${idx.unique ? '(UNIQUE)' : ''} ${idx.sparse ? '(SPARSE)' : ''}`);
    });

    // Drop the problematic index if it exists
    const problematicIndexes = ['session_token_1', 'sessionToken_1'];
    
    for (const indexName of problematicIndexes) {
      try {
        const indexExists = indexes.some(idx => idx.name === indexName);
        if (indexExists) {
          console.log(`\n🗑️  Dropping index: ${indexName}...`);
          await collection.dropIndex(indexName);
          console.log(`✅ Successfully dropped index: ${indexName}`);
        } else {
          console.log(`ℹ️  Index ${indexName} does not exist, skipping...`);
        }
      } catch (err) {
        if (err.code === 27) {
          console.log(`ℹ️  Index ${indexName} not found, already removed.`);
        } else {
          console.error(`⚠️  Error dropping ${indexName}:`, err.message);
        }
      }
    }

    // Also clean up any documents with null session tokens that might cause issues
    console.log('\n🧹 Cleaning up sessions with null session tokens...');
    const deleteResult = await collection.deleteMany({ 
      sessionToken: null,
      isActive: false 
    });
    console.log(`✅ Removed ${deleteResult.deletedCount} inactive sessions with null tokens`);

    // Create the correct compound index if it doesn't exist
    console.log('\n📊 Ensuring correct compound index exists...');
    try {
      await collection.createIndex(
        { userId: 1, socketId: 1 },
        { unique: true, sparse: true, name: 'userId_socketId_compound' }
      );
      console.log('✅ Compound index userId_socketId_compound created/verified');
    } catch (err) {
      if (err.code === 85) {
        console.log('ℹ️  Compound index already exists with different options');
      } else {
        console.error('⚠️  Error creating compound index:', err.message);
      }
    }

    // Show final indexes
    console.log('\n📋 Final indexes on usersessions collection:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(idx => {
      console.log(`  - ${idx.name}: ${JSON.stringify(idx.key)} ${idx.unique ? '(UNIQUE)' : ''} ${idx.sparse ? '(SPARSE)' : ''}`);
    });

    console.log('\n✅ Index fix complete!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
    process.exit(0);
  }
}

fixSessionIndex();
