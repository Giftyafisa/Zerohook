// Check user data structure
require('dotenv').config({ path: './env.local' });
const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://zerohook:11221122Ga@zerohook.cnyphi4.mongodb.net/zerohook').then(async () => {
  const db = mongoose.connection.db;
  
  // Check how users are stored
  const totalUsers = await db.collection('users').countDocuments();
  console.log('Total users:', totalUsers);
  
  const users = await db.collection('users').find({}).limit(5).toArray();
  console.log('\nSample user fields:', users.length > 0 ? Object.keys(users[0]) : 'No users');
  
  if (users.length > 0) {
    console.log('\n--- First user sample ---');
    console.log('username:', users[0].username);
    console.log('profileData:', JSON.stringify(users[0].profileData, null, 2));
    console.log('profileData.accountType:', users[0].profileData?.accountType);
  }
  
  // Check with provider filter
  const providers = await db.collection('users').countDocuments({ 'profileData.accountType': 'provider' });
  console.log('\nUsers with accountType=provider:', providers);
  
  // Check users with any profileData
  const withProfile = await db.collection('users').countDocuments({ profileData: { $exists: true, $ne: null } });
  console.log('Users with profileData:', withProfile);
  
  // Check users with profileData but no accountType
  const withoutAccountType = await db.collection('users').find({ 
    profileData: { $exists: true, $ne: null },
    'profileData.accountType': { $exists: false }
  }).limit(3).toArray();
  console.log('\nUsers with profileData but no accountType:', withoutAccountType.length);
  if (withoutAccountType.length > 0) {
    console.log('Sample:', withoutAccountType[0].username, withoutAccountType[0].profileData);
  }
  
  mongoose.disconnect();
}).catch(e => console.error(e));
