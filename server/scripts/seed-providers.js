/**
 * Seed Provider Profiles Script
 * Creates test provider profiles for the Zerohook marketplace
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

// Connect to MongoDB - use the correct URI from .env
const MONGODB_URI = process.env.MONGODB_URI;
console.log('MongoDB URI found:', MONGODB_URI ? 'Yes' : 'No');
console.log('URI prefix:', MONGODB_URI?.substring(0, 30) + '...');

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password_hash: String,
  phone: String,
  verification_tier: Number,
  reputation_score: Number,
  trust_score: Number,
  profile_data: mongoose.Schema.Types.Mixed,
  profile_visibility: String,
  is_subscribed: Boolean,
  subscription_tier: String,
  created_at: Date,
  last_active: Date,
  is_online: Boolean,
  last_login: Date,
  failed_login_attempts: Number,
  account_locked_until: Date
}, { collection: 'users', strict: false });

const User = mongoose.model('User', userSchema);

// African cities and countries
const locations = [
  { city: 'Lagos', country: 'Nigeria', coordinates: { lat: 6.5244, lng: 3.3792 } },
  { city: 'Accra', country: 'Ghana', coordinates: { lat: 5.6037, lng: -0.1870 } },
  { city: 'Nairobi', country: 'Kenya', coordinates: { lat: -1.2921, lng: 36.8219 } },
  { city: 'Abuja', country: 'Nigeria', coordinates: { lat: 9.0579, lng: 7.4951 } },
  { city: 'Kumasi', country: 'Ghana', coordinates: { lat: 6.6666, lng: -1.6163 } },
  { city: 'Mombasa', country: 'Kenya', coordinates: { lat: -4.0435, lng: 39.6682 } },
  { city: 'Cape Town', country: 'South Africa', coordinates: { lat: -33.9249, lng: 18.4241 } },
  { city: 'Johannesburg', country: 'South Africa', coordinates: { lat: -26.2041, lng: 28.0473 } },
  { city: 'Dar es Salaam', country: 'Tanzania', coordinates: { lat: -6.7924, lng: 39.2083 } },
  { city: 'Kampala', country: 'Uganda', coordinates: { lat: 0.3476, lng: 32.5825 } }
];

const services = [
  'Companionship', 'Massage Therapy', 'Personal Training', 'Life Coaching',
  'Modeling', 'Dance Entertainment', 'Event Hosting', 'VIP Escort',
  'Travel Companion', 'Private Chef', 'Personal Stylist'
];

const specializations = [
  'Luxury Events', 'Corporate Events', 'Private Parties', 'Travel',
  'Wellness', 'Fitness', 'Entertainment', 'Nightlife', 'Fine Dining'
];

const femaleFirstNames = ['Amara', 'Chidinma', 'Zainab', 'Adaeze', 'Oluchi', 'Ngozi', 'Fatima', 'Aisha', 'Grace', 'Blessing'];
const maleFirstNames = ['Chidi', 'Kofi', 'Emeka', 'Yusuf', 'Tunde', 'Kwame', 'Obinna', 'Abdul', 'David', 'Samuel'];
const lastNames = ['Okoro', 'Mensah', 'Okonkwo', 'Ibrahim', 'Adeyemi', 'Agyemang', 'Nwosu', 'Kamau', 'Banda', 'Mwangi'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomItems(arr, count) {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function generateProvider(index) {
  const isFemale = Math.random() > 0.4; // 60% female
  const firstName = isFemale ? randomItem(femaleFirstNames) : randomItem(maleFirstNames);
  const lastName = randomItem(lastNames);
  const location = randomItem(locations);
  const age = Math.floor(Math.random() * 15) + 22; // 22-36
  const basePrice = Math.floor(Math.random() * 400) + 100; // 100-500
  
  const verificationTier = Math.floor(Math.random() * 4); // 0-3
  const reputationScore = Math.floor(Math.random() * 30) + 70; // 70-100
  const trustScore = Math.floor(Math.random() * 25) + 75; // 75-100
  
  const isOnline = Math.random() > 0.6; // 40% online
  const isSubscribed = Math.random() > 0.5; // 50% subscribed
  const subscriptionTier = isSubscribed ? randomItem(['basic', 'premium', 'elite']) : 'free';
  
  const username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}${index}`;
  
  return {
    username,
    email: `${username}@example.com`,
    password_hash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewYpfQaJxOLZPiIG', // password: test123
    phone: `+234${Math.floor(Math.random() * 900000000) + 100000000}`,
    verification_tier: verificationTier,
    reputation_score: reputationScore,
    trust_score: trustScore,
    profile_data: {
      firstName,
      lastName,
      age,
      gender: isFemale ? 'female' : 'male',
      bio: `Hi, I'm ${firstName}! Professional ${randomItem(services).toLowerCase()} provider based in ${location.city}. Available for bookings.`,
      location: location,
      basePrice,
      currency: location.country === 'Nigeria' ? 'NGN' : location.country === 'Ghana' ? 'GHS' : location.country === 'Kenya' ? 'KES' : 'USD',
      availability: randomItems(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], Math.floor(Math.random() * 4) + 3),
      services: randomItems(services, Math.floor(Math.random() * 3) + 2),
      specializations: randomItems(specializations, Math.floor(Math.random() * 3) + 1),
      languages: ['English', ...(location.country === 'Nigeria' ? ['Yoruba', 'Igbo', 'Hausa'] : location.country === 'Ghana' ? ['Twi', 'Ga'] : ['Swahili']).slice(0, Math.floor(Math.random() * 2) + 1)],
      accountType: 'provider',
      profileComplete: true,
      photos: [],
      contactPreferences: {
        phone: Math.random() > 0.5,
        chat: true,
        video: Math.random() > 0.3
      }
    },
    profile_visibility: 'public',
    is_subscribed: isSubscribed,
    subscription_tier: subscriptionTier,
    created_at: new Date(Date.now() - Math.floor(Math.random() * 90) * 24 * 60 * 60 * 1000), // Random date in last 90 days
    last_active: new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000), // Random date in last 7 days
    is_online: isOnline,
    last_login: new Date(),
    failed_login_attempts: 0,
    account_locked_until: null
  };
}

async function seedProviders() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Check current user count
    const existingCount = await User.countDocuments({});
    console.log(`📊 Current users in database: ${existingCount}`);

    // Generate and insert providers
    const numberOfProviders = 20;
    const providers = [];
    
    for (let i = 1; i <= numberOfProviders; i++) {
      providers.push(generateProvider(i));
    }

    console.log(`🌱 Seeding ${numberOfProviders} provider profiles...`);
    
    // Insert providers (skip if username already exists)
    let inserted = 0;
    let skipped = 0;
    
    for (const provider of providers) {
      const existing = await User.findOne({ username: provider.username });
      if (!existing) {
        await User.create(provider);
        inserted++;
        console.log(`  ✅ Created: ${provider.username} (${provider.profile_data.location.city}, ${provider.profile_data.location.country})`);
      } else {
        skipped++;
        console.log(`  ⏭️  Skipped: ${provider.username} (already exists)`);
      }
    }

    console.log('\n📊 Seeding Summary:');
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Skipped: ${skipped}`);
    
    // Verify total count
    const finalCount = await User.countDocuments({});
    console.log(`   Total users now: ${finalCount}`);

    // Show sample of inserted data
    const sample = await User.findOne({ 'profile_data.accountType': 'provider' });
    if (sample) {
      console.log('\n📋 Sample provider profile:');
      console.log(`   Username: ${sample.username}`);
      console.log(`   Location: ${sample.profile_data?.location?.city}, ${sample.profile_data?.location?.country}`);
      console.log(`   Services: ${sample.profile_data?.services?.join(', ')}`);
      console.log(`   Verification: Tier ${sample.verification_tier}`);
      console.log(`   Online: ${sample.is_online}`);
    }

    console.log('\n✅ Seeding complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

seedProviders();
