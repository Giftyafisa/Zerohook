/**
 * Create comprehensive test adult services for all test providers
 */
require('dotenv').config({ path: './env.local' });
const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://zerohook:11221122Ga@zerohook.cnyphi4.mongodb.net/zerohook?retryWrites=true&w=majority';

async function createTestServices() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB\n');
    
    const User = mongoose.connection.collection('users');
    const AdultService = mongoose.connection.collection('adultservices');
    
    // Get all test providers
    const testProviders = await User.find({
      'profile_data.isTestAccount': true,
      'profile_data.accountType': 'provider'
    }).toArray();
    
    console.log(`👤 Found ${testProviders.length} test providers`);
    
    // Service templates
    const serviceTemplates = [
      {
        category: 'long-term',
        titles: ['Premium Companionship', 'VIP Dating Experience', 'Elite Partnership', 'Exclusive Relationship', 'Sugar Dating'],
        descriptions: [
          'Experience meaningful connections with a genuine partner. Regular dates, emotional support, and memorable experiences.',
          'VIP treatment for discerning gentlemen. Upscale dates, travel companion, and exclusive access.',
          'Build a lasting connection with someone who truly understands your needs.',
        ],
        basePrice: 200,
        priceRange: 150,
        durations: [120, 180, 240]
      },
      {
        category: 'short-term',
        titles: ['Casual Dates', 'Quick Meetup', 'Spontaneous Fun', 'No-Strings Connection', 'Instant Chemistry'],
        descriptions: [
          'Fun and relaxed casual encounters without commitment. Perfect for busy professionals.',
          'Quick, discrete meetings for those with limited time but high expectations.',
          'Spontaneous adventures and exciting experiences await.',
        ],
        basePrice: 100,
        priceRange: 100,
        durations: [60, 90, 120]
      },
      {
        category: 'oral-services',
        titles: ['Sensual Experience', 'Intimate Session', 'Special Treatment', 'Pleasure Focus', 'Satisfaction Guaranteed'],
        descriptions: [
          'Focused intimate experiences with attention to your complete satisfaction.',
          'Professional and discrete service with hygiene as top priority.',
          'Let me take care of your needs with skill and enthusiasm.',
        ],
        basePrice: 80,
        priceRange: 70,
        durations: [30, 45, 60]
      },
      {
        category: 'special-services',
        titles: ['Exclusive VIP Package', 'Fantasy Fulfillment', 'Custom Experience', 'Premium Treatment', 'Ultimate Indulgence'],
        descriptions: [
          'The ultimate premium experience tailored to your specific desires and fantasies.',
          'Make your fantasies reality with our custom experience packages.',
          'VIP treatment at premium locations with complete discretion.',
        ],
        basePrice: 400,
        priceRange: 300,
        durations: [120, 180, 240, 300]
      }
    ];
    
    // Delete existing test services
    const deleteResult = await AdultService.deleteMany({});
    console.log(`🗑️ Cleared ${deleteResult.deletedCount} existing services\n`);
    
    let created = 0;
    
    // Create 2 services per provider (different categories)
    for (let i = 0; i < testProviders.length; i++) {
      const provider = testProviders[i];
      
      // Each provider gets 2 services in different categories
      const numServices = Math.min(2, serviceTemplates.length);
      const startCategoryIndex = i % serviceTemplates.length;
      
      for (let j = 0; j < numServices; j++) {
        const template = serviceTemplates[(startCategoryIndex + j) % serviceTemplates.length];
        const title = template.titles[i % template.titles.length];
        const description = template.descriptions[i % template.descriptions.length];
        const price = template.basePrice + Math.floor(Math.random() * template.priceRange);
        const duration = template.durations[Math.floor(Math.random() * template.durations.length)];
        
        const profileData = provider.profile_data || {};
        const location = profileData.location || { city: 'Accra', country: 'Ghana' };
        
        const service = {
          provider_id: provider._id,
          category: template.category,
          title: title,
          description: `${description} Offered by ${profileData.firstName || provider.username.split('_')[0]}.`,
          price: price,
          duration_minutes: duration,
          location_type: 'flexible',
          location_data: location,
          images: [profileData.profilePicture].filter(Boolean),
          is_active: true,
          is_verified: (provider.verification_tier || 0) >= 2,
          likes_count: Math.floor(Math.random() * 100),
          views_count: Math.floor(Math.random() * 500),
          created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
          updated_at: new Date()
        };
        
        await AdultService.insertOne(service);
        created++;
      }
      
      if ((i + 1) % 10 === 0) {
        console.log(`  Progress: ${i + 1}/${testProviders.length} providers processed`);
      }
    }
    
    console.log(`\n✅ Created ${created} adult services`);
    
    // Stats by category
    console.log('\n📊 Services by category:');
    for (const template of serviceTemplates) {
      const count = await AdultService.countDocuments({ category: template.category });
      console.log(`  ${template.category}: ${count}`);
    }
    
    const totalActive = await AdultService.countDocuments({ is_active: true });
    console.log(`\n📊 Total active services: ${totalActive}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

createTestServices();
