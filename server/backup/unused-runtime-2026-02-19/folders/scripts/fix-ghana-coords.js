/**
 * Quick fix: Update providers with Ghana cities to have Ghana country
 * and correct GPS coordinates
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { User, connectDB } = require('../config/database');

const GHANA_COORDS = {
  'Accra': { lat: 5.6037, lng: -0.187 },
  'Madina': { lat: 5.6803, lng: -0.1703 },
  'Kumasi': { lat: 6.6885, lng: -1.6244 },
  'Tema': { lat: 5.6698, lng: -0.0166 },
  'Takoradi': { lat: 4.8845, lng: -1.7554 },
  'Cape Coast': { lat: 5.1315, lng: -1.2795 },
  'Osu': { lat: 5.556, lng: -0.1847 },
  'East Legon': { lat: 5.6347, lng: -0.1553 }
};

async function fixGhanaProviders() {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');
    await new Promise(r => setTimeout(r, 1000));

    // Find providers with Ghana cities but Nigeria country
    const ghanaCities = Object.keys(GHANA_COORDS);
    
    const providers = await User.find({
      $or: [
        { 'profile_data.location.city': { $in: ghanaCities } },
        { 'profileData.location.city': { $in: ghanaCities } }
      ]
    }).lean();

    console.log(`Found ${providers.length} providers with Ghana cities\n`);
    
    let updatedCount = 0;
    
    for (const provider of providers) {
      const profileData = provider.profile_data || provider.profileData || {};
      const city = profileData.location?.city;
      
      if (!city || !GHANA_COORDS[city]) continue;
      
      const coords = GHANA_COORDS[city];
      
      // Add small random offset for variety
      const lat = coords.lat + (Math.random() - 0.5) * 0.02;
      const lng = coords.lng + (Math.random() - 0.5) * 0.02;
      
      await User.updateOne(
        { _id: provider._id },
        {
          $set: {
            'profile_data.location.country': 'Ghana',
            'profile_data.location.coordinates.lat': lat,
            'profile_data.location.coordinates.lng': lng,
            'profileData.location.country': 'Ghana',
            'profileData.location.coordinates.lat': lat,
            'profileData.location.coordinates.lng': lng
          }
        }
      );
      
      console.log(`✅ Updated ${provider.username}: ${city} → Ghana (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      updatedCount++;
    }
    
    console.log(`\n🎉 Updated ${updatedCount} providers to Ghana with correct GPS coords!`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixGhanaProviders();
