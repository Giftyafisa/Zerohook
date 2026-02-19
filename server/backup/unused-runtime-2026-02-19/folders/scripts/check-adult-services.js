/**
 * Check adult services status and optionally create test services
 */
require('dotenv').config({ path: './env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://zerohook:11221122Ga@zerohook.cnyphi4.mongodb.net/zerohook?retryWrites=true&w=majority';

async function checkAdultServices() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');
    
    const User = mongoose.connection.collection('users');
    const AdultService = mongoose.connection.collection('adultservices');
    
    // Check existing services
    const serviceCount = await AdultService.countDocuments();
    console.log(`📊 Total adult services in database: ${serviceCount}`);
    
    const activeServices = await AdultService.countDocuments({ is_active: true });
    console.log(`📊 Active services: ${activeServices}`);
    
    // Get a sample
    const sampleServices = await AdultService.find({}).limit(3).toArray();
    console.log('\n📋 Sample services:');
    sampleServices.forEach(s => {
      console.log(`  - ${s.title || s.category}: ${s.price} (provider: ${s.provider_id})`);
    });
    
    // Get test providers that could have services
    const testProviders = await User.find({
      'profile_data.isTestAccount': true,
      'profile_data.accountType': 'provider'
    }).limit(5).toArray();
    
    console.log(`\n👤 Test providers available: ${testProviders.length}`);
    
    // Check if we should create services
    if (serviceCount === 0 && testProviders.length > 0) {
      console.log('\n🔧 No services found. Creating test services...');
      
      const categories = ['long-term', 'short-term', 'oral-services', 'special-services'];
      const serviceTitles = {
        'long-term': ['Premium Companionship', 'VIP Dating Experience', 'Elite Partnership'],
        'short-term': ['Casual Dates', 'Quick Meetup', 'Spontaneous Fun'],
        'oral-services': ['Sensual Experience', 'Intimate Session', 'Special Treatment'],
        'special-services': ['Exclusive VIP Package', 'Fantasy Fulfillment', 'Custom Experience']
      };
      
      let created = 0;
      
      for (let i = 0; i < testProviders.length && i < 20; i++) {
        const provider = testProviders[i % testProviders.length];
        const category = categories[i % categories.length];
        const titles = serviceTitles[category];
        const title = titles[i % titles.length];
        
        const basePrice = {
          'long-term': 250,
          'short-term': 150,
          'oral-services': 80,
          'special-services': 500
        }[category];
        
        const service = {
          provider_id: provider._id,
          category: category,
          title: `${title} - ${provider.username}`,
          description: `${title} offered by ${provider.username}. Professional, discrete, and satisfying experience guaranteed.`,
          price: basePrice + Math.floor(Math.random() * 100),
          duration_minutes: [60, 90, 120, 180][Math.floor(Math.random() * 4)],
          location_type: 'flexible',
          location_data: provider.profile_data?.location || { city: 'Accra', country: 'Ghana' },
          images: [provider.profile_data?.profilePicture].filter(Boolean),
          is_active: true,
          is_verified: provider.verification_tier >= 2,
          likes_count: Math.floor(Math.random() * 50),
          created_at: new Date(),
          updated_at: new Date()
        };
        
        await AdultService.insertOne(service);
        created++;
        console.log(`  ✅ Created: ${service.title}`);
      }
      
      console.log(`\n✅ Created ${created} test services`);
    }
    
    // Final count
    const finalCount = await AdultService.countDocuments({ is_active: true });
    console.log(`\n📊 Final active service count: ${finalCount}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

checkAdultServices();
