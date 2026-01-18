/**
 * Check database for providers vs clients
 */
require('dotenv').config({ path: './env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://zerohook:11221122Ga@zerohook.cnyphi4.mongodb.net/zerohook?retryWrites=true&w=majority';

async function checkDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!\n');
    
    const User = mongoose.connection.collection('users');
    
    // Count by accountType
    const providers = await User.countDocuments({'profile_data.accountType': 'provider'});
    const clients = await User.countDocuments({'profile_data.accountType': 'client'});
    const total = await User.countDocuments({});
    
    console.log('=== DATABASE STATS ===');
    console.log('Total users:', total);
    console.log('Providers (accountType=provider):', providers);
    console.log('Clients (accountType=client):', clients);
    console.log('Other/No accountType:', total - providers - clients);
    
    // Get sample providers
    const sampleProviders = await User.find({'profile_data.accountType': 'provider'}).limit(5).toArray();
    console.log('\n=== SAMPLE PROVIDERS ===');
    if (sampleProviders.length === 0) {
      console.log('NO PROVIDERS FOUND!');
    } else {
      sampleProviders.forEach(u => {
        console.log(`- ${u.username} (${u.profile_data?.location?.city || 'unknown city'})`);
      });
    }
    
    // Get sample clients  
    const sampleClients = await User.find({'profile_data.accountType': 'client'}).limit(5).toArray();
    console.log('\n=== SAMPLE CLIENTS ===');
    sampleClients.forEach(u => {
      console.log(`- ${u.username}`);
    });
    
    // Check if test providers exist
    const testProviders = await User.countDocuments({'profile_data.isTestAccount': true});
    console.log('\n=== TEST PROVIDERS ===');
    console.log('Test providers created:', testProviders);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected.');
  }
}

checkDatabase();
