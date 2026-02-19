/**
 * Debug the MongoRecommendationEngine to see what's happening
 */
require('dotenv').config({ path: './env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://zerohook:11221122Ga@zerohook.cnyphi4.mongodb.net/zerohook?retryWrites=true&w=majority';

async function debugRecommendationEngine() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected!\n');
    
    const User = mongoose.connection.collection('users');
    
    // Test the exact query the engine uses
    console.log('=== TESTING MONGODB QUERY ===\n');
    
    // This is the query the MongoRecommendationEngine uses
    const mongoQuery = {
      $or: [
        { 'profile_data.accountType': 'provider' },
        { 'profileData.accountType': 'provider' }
      ]
    };
    
    console.log('Query:', JSON.stringify(mongoQuery, null, 2));
    
    const results = await User.find(mongoQuery).limit(10).toArray();
    
    console.log(`\n=== QUERY RESULTS: ${results.length} profiles ===\n`);
    
    results.forEach((user, i) => {
      const pd = user.profile_data || user.profileData || {};
      console.log(`${i+1}. ${user.username}`);
      console.log(`   - profile_data.accountType: ${pd.accountType}`);
      console.log(`   - Location: ${pd.location?.city || 'unknown'}, ${pd.location?.country || 'unknown'}`);
      console.log('');
    });
    
    // Also check what fields are actually in the database
    console.log('\n=== CHECKING RAW PROFILE DATA STRUCTURE ===\n');
    
    const sampleProvider = await User.findOne({ 'profile_data.accountType': 'provider' });
    if (sampleProvider) {
      console.log('Sample provider profile_data:');
      console.log(JSON.stringify(sampleProvider.profile_data, null, 2));
    } else {
      console.log('No provider found with profile_data.accountType');
      
      // Check if it's using profileData instead
      const sampleProvider2 = await User.findOne({ 'profileData.accountType': 'provider' });
      if (sampleProvider2) {
        console.log('Found using profileData (camelCase):');
        console.log(JSON.stringify(sampleProvider2.profileData, null, 2));
      }
    }
    
    // Check a client to see structure
    console.log('\n=== CHECKING CLIENT STRUCTURE ===\n');
    const sampleClient = await User.findOne({ 'profile_data.accountType': 'client' });
    if (sampleClient) {
      console.log('Sample client profile_data:');
      console.log(JSON.stringify(sampleClient.profile_data, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected.');
  }
}

debugRecommendationEngine();
