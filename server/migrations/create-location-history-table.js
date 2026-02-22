const mongoose = require('mongoose');
const { connectDB, UserActivityLog, User } = require('../config/database');

async function createLocationHistoryTable() {
  try {
    console.log('📍 Ensuring location history storage is ready (MongoDB)...');
    await connectDB();

    await UserActivityLog.createIndexes();
    await User.createIndexes();

    const activityIndexes = await UserActivityLog.collection.indexes();
    console.log(`✅ UserActivityLog indexes ensured (${activityIndexes.length} indexes)`);
    console.log('✅ Location history setup completed (uses UserActivityLog collection)');

    return true;
  } catch (error) {
    console.error('❌ Error preparing location history storage:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
  }
}

// Run if called directly
if (require.main === module) {
  createLocationHistoryTable()
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = createLocationHistoryTable;
