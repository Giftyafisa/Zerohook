/**
 * Fix providers that have Ghana cities but Nigeria country
 * Update them to Ghana with correct GPS coordinates
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { User, connectDB } = require('../config/database');

const GHANA_CITY_COORDS = {
  'Accra': { lat: 5.6037, lng: -0.187 },
  'Accra Central': { lat: 5.5500, lng: -0.2000 },
  'Osu': { lat: 5.5560, lng: -0.1847 },
  'Cantonments': { lat: 5.5733, lng: -0.1700 },
  'Airport Residential': { lat: 5.6058, lng: -0.1719 },
  'East Legon': { lat: 5.6347, lng: -0.1553 },
  'Labone': { lat: 5.5653, lng: -0.1750 },
  'Roman Ridge': { lat: 5.5800, lng: -0.1750 },
  'Dzorwulu': { lat: 5.6064, lng: -0.2050 },
  'Tema': { lat: 5.6698, lng: -0.0166 },
  'Madina': { lat: 5.6803, lng: -0.1703 },
  'Achimota': { lat: 5.6167, lng: -0.2333 },
  'Dome': { lat: 5.6353, lng: -0.2317 },
  'Kasoa': { lat: 5.5333, lng: -0.4167 },
  'Spintex': { lat: 5.6350, lng: -0.0700 },
  'Kumasi': { lat: 6.6885, lng: -1.6244 },
  'Adum': { lat: 6.6950, lng: -1.6150 },
  'Takoradi': { lat: 4.8845, lng: -1.7554 },
  'Sekondi': { lat: 4.9342, lng: -1.7137 },
  'Cape Coast': { lat: 5.1315, lng: -1.2795 }
};

async function main() {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');
    
    // Wait for models and indexes
    await new Promise(r => setTimeout(r, 2000));
    console.log('Models ready...');
    
    const ghanaCities = Object.keys(GHANA_CITY_COORDS);
    let totalUpdated = 0;
    
    for (const city of ghanaCities) {
      const coords = GHANA_CITY_COORDS[city];
      
      // Add small random offset for variety (up to ~1km)
      const randomLat = coords.lat + (Math.random() - 0.5) * 0.02;
      const randomLng = coords.lng + (Math.random() - 0.5) * 0.02;
      
      // Update providers with this city who have wrong country
      const result = await User.updateMany(
        {
          $or: [
            { 'profile_data.location.city': city },
            { 'profileData.location.city': city }
          ],
          $and: [
            {
              $or: [
                { 'profile_data.location.country': { $ne: 'Ghana' } },
                { 'profileData.location.country': { $ne: 'Ghana' } }
              ]
            }
          ]
        },
        {
          $set: {
            'profile_data.location.country': 'Ghana',
            'profile_data.location.coordinates.lat': randomLat,
            'profile_data.location.coordinates.lng': randomLng,
            'profileData.location.country': 'Ghana',
            'profileData.location.coordinates.lat': randomLat,
            'profileData.location.coordinates.lng': randomLng
          }
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`✅ ${city}: Updated ${result.modifiedCount} providers to Ghana`);
        totalUpdated += result.modifiedCount;
      }
    }
    
    console.log(`\n🎉 Total updated: ${totalUpdated} providers`);
    
    // Now verify
    console.log('\n📊 Verification - Ghana providers:');
    const ghanaProviders = await User.find({
      $or: [
        { 'profile_data.location.country': 'Ghana' },
        { 'profileData.location.country': 'Ghana' }
      ]
    }).select('username profile_data.location profileData.location').limit(15).lean();
    
    ghanaProviders.forEach(p => {
      const loc = p.profile_data?.location || p.profileData?.location || {};
      console.log(`   ${p.username}: ${loc.city || '?'}, ${loc.country || '?'} (${loc.coordinates?.lat?.toFixed(4) || '?'}, ${loc.coordinates?.lng?.toFixed(4) || '?'})`);
    });
    
    console.log(`\n📍 Total Ghana providers: ${ghanaProviders.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
