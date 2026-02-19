/**
 * Quick test script to check provider location data
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { User, connectDB } = require('./config/database');

async function main() {
  console.log('🔍 Checking provider locations...\n');
  
  try {
    // Wait for DB connection
    await connectDB();
    console.log('Connected to database\n');
    
    // Wait a bit more for models to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      // Get providers
      const providers = await User.find({
        $or: [
          { 'profile_data.accountType': 'provider' },
          { 'profileData.accountType': 'provider' }
        ]
      }).limit(15).lean();
      
      console.log(`Found ${providers.length} providers:\n`);
      
      providers.forEach((p, i) => {
        const pd = p.profile_data || p.profileData || {};
        const loc = pd.location || {};
        const coords = loc.coordinates || {};
        
        console.log(`${i + 1}. ${p.username || 'Unknown'}`);
        console.log(`   Country: ${loc.country || 'N/A'}`);
        console.log(`   City: ${loc.city || 'N/A'}`);
        console.log(`   Lat/Lng: ${coords.lat || 'N/A'}, ${coords.lng || 'N/A'}`);
        console.log('');
      });
      
      // Count by country
      console.log('\n📊 Country distribution:');
      const countryCounts = {};
      providers.forEach(p => {
        const pd = p.profile_data || p.profileData || {};
        const country = pd.location?.country || 'Unknown';
        countryCounts[country] = (countryCounts[country] || 0) + 1;
      });
      Object.entries(countryCounts).forEach(([country, count]) => {
        console.log(`   ${country}: ${count} providers`);
      });
      
      // Check for missing coordinates
      const withCoords = providers.filter(p => {
        const pd = p.profile_data || p.profileData || {};
        return pd.location?.coordinates?.lat && pd.location?.coordinates?.lng;
      });
      
      console.log(`\n📍 Providers with GPS coordinates: ${withCoords.length}/${providers.length}`);
      
      process.exit(0);
    } catch (error) {
      console.error('Query Error:', error.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('Connection Error:', error.message);
    process.exit(1);
  }
}

main();
