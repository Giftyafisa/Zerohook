/**
 * Create 50 Test Provider Profiles in Accra Region, Ghana
 * 
 * This script creates realistic test data for the recommendation algorithm.
 * Providers are spread across different towns/cities in the Greater Accra Region.
 * 
 * Usage:
 *   node server/scripts/create-accra-test-providers.js
 */

require('dotenv').config({ path: './env.local' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://zerohook:11221122Ga@zerohook.cnyphi4.mongodb.net/zerohook?retryWrites=true&w=majority';

// User Schema (minimal for this script)
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password_hash: { type: String, required: true },
  phone: String,
  verification_tier: { type: Number, default: 1 },
  reputation_score: { type: Number, default: 100.0 },
  trust_score: { type: Number, default: 50.0 },
  profile_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  is_subscribed: { type: Boolean, default: false },
  subscription_tier: { type: String, default: 'free' },
  status: { type: String, default: 'active' },
  last_active: { type: Date, default: Date.now }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const User = mongoose.model('User', userSchema);

// Accra Region locations with coordinates
const accraLocations = [
  { city: 'Accra Central', lat: 5.5559, lng: -0.1969 },
  { city: 'Osu', lat: 5.5560, lng: -0.1828 },
  { city: 'Labone', lat: 5.5665, lng: -0.1728 },
  { city: 'East Legon', lat: 5.6351, lng: -0.1596 },
  { city: 'Airport Residential', lat: 5.6039, lng: -0.1736 },
  { city: 'Cantonments', lat: 5.5729, lng: -0.1768 },
  { city: 'Tema', lat: 5.6698, lng: 0.0166 },
  { city: 'Teshie', lat: 5.5815, lng: -0.1069 },
  { city: 'Madina', lat: 5.6830, lng: -0.1680 },
  { city: 'Adenta', lat: 5.7150, lng: -0.1581 },
  { city: 'Spintex', lat: 5.6298, lng: -0.0935 },
  { city: 'Dansoman', lat: 5.5255, lng: -0.2666 },
  { city: 'Achimota', lat: 5.6247, lng: -0.2294 },
  { city: 'Kasoa', lat: 5.5348, lng: -0.4200 },
  { city: 'Ashaiman', lat: 5.6843, lng: -0.0381 },
  { city: 'Nungua', lat: 5.5948, lng: -0.0769 },
  { city: 'Labadi', lat: 5.5617, lng: -0.1478 },
  { city: 'Dzorwulu', lat: 5.6110, lng: -0.2000 },
  { city: 'Roman Ridge', lat: 5.5887, lng: -0.1805 },
  { city: 'Ridge', lat: 5.5735, lng: -0.1957 }
];

// Female first names (common in Ghana)
const femaleFirstNames = [
  'Akua', 'Ama', 'Abena', 'Adwoa', 'Afia', 'Yaa', 'Efua', 'Esi',
  'Nana', 'Gifty', 'Patience', 'Grace', 'Comfort', 'Mercy', 'Blessing',
  'Felicia', 'Josephine', 'Victoria', 'Elizabeth', 'Sarah', 'Ruth',
  'Naomi', 'Priscilla', 'Rebecca', 'Hannah', 'Lydia', 'Diana', 'Janet',
  'Sandra', 'Linda', 'Patricia', 'Cynthia', 'Christina', 'Angela', 'Monica',
  'Evelyn', 'Juliana', 'Cecilia', 'Martha', 'Agnes', 'Theresa', 'Dorcas',
  'Esther', 'Mary', 'Alice', 'Rose', 'Betty', 'Gloria', 'Joyce', 'Stella'
];

// Last names (common in Ghana)
const lastNames = [
  'Mensah', 'Asante', 'Owusu', 'Adjei', 'Osei', 'Boateng', 'Agyemang',
  'Amoah', 'Appiah', 'Darko', 'Gyamfi', 'Kwarteng', 'Yeboah', 'Antwi',
  'Frimpong', 'Acheampong', 'Bonsu', 'Ofori', 'Ansah', 'Danquah'
];

// Bio templates
const bioTemplates = [
  "Hi, I'm {name}! I'm a professional companion based in {city}. I offer quality time and genuine connections. Available for dinner dates, events, and private meetups. Discrete and respectful always. 💕",
  "Classy {age}-year-old from {city}. I provide premium companionship services. Looking for mature and respectful gentlemen. My time is valuable, but so is yours. Let's make memories! ✨",
  "Independent provider in {city}. I'm known for my warm personality and attention to detail. Whether it's a quiet evening or a night out, I'll make sure you're well taken care of. 🌹",
  "Sweet and caring {name} here! Based in {city}. I love meeting new people and creating unforgettable experiences. Verified and trusted. Your satisfaction is my priority. 💋",
  "Professional escort from {city}. {age} years young with a passion for life. I offer GFE, dinner dates, and travel companionship. Hygiene and discretion guaranteed. 🌟",
  "Hey there! I'm {name}, your perfect companion in {city}. I'm educated, well-spoken, and always dressed to impress. Looking for quality over quantity. 💎",
  "Elegant and sophisticated lady from {city}. I cater to upscale clientele seeking refined companionship. Private meets, events, and travel available. 👑",
  "Friendly and fun-loving {name}! {city} based. I bring positivity and good vibes to every encounter. Let me be your stress reliever! 🦋",
  "Mature and experienced provider in {city}. I know what men want and I deliver. No games, no drama, just pure pleasure. 🔥",
  "Young and vibrant {name} from {city}! I'm here to show you a good time. Clean, safe, and always professional. Your secret is safe with me. 💫"
];

// Services offered
const servicesList = [
  'Companionship', 'Dinner Dates', 'Events', 'Travel', 'GFE', 
  'Massage', 'Overnight', 'Weekend Getaways', 'Video Calls', 'Private Meets'
];

// Languages
const languageOptions = [
  ['English', 'Twi'], ['English', 'Ga'], ['English', 'Ewe'],
  ['English', 'Twi', 'Hausa'], ['English', 'French', 'Twi'],
  ['English'], ['English', 'Twi', 'Ga']
];

// Generate random profile
function generateProfile(index) {
  const firstName = femaleFirstNames[index % femaleFirstNames.length];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  const location = accraLocations[index % accraLocations.length];
  const age = 20 + Math.floor(Math.random() * 15); // 20-34
  const bio = bioTemplates[Math.floor(Math.random() * bioTemplates.length)]
    .replace(/{name}/g, firstName)
    .replace(/{city}/g, location.city)
    .replace(/{age}/g, age);
  
  // Add slight coordinate variation to spread profiles within each area
  const latVariation = (Math.random() - 0.5) * 0.02; // ~1km variation
  const lngVariation = (Math.random() - 0.5) * 0.02;
  
  // Random services (3-6)
  const numServices = 3 + Math.floor(Math.random() * 4);
  const services = [];
  const shuffledServices = [...servicesList].sort(() => Math.random() - 0.5);
  for (let i = 0; i < numServices; i++) {
    services.push(shuffledServices[i]);
  }
  
  // Random price (100-500 GHS)
  const basePrice = 100 + Math.floor(Math.random() * 400);
  
  // Random stats
  const responseRate = 70 + Math.floor(Math.random() * 30);
  const bookingSuccessRate = 60 + Math.floor(Math.random() * 40);
  const viewCount = Math.floor(Math.random() * 500);
  const contactCount = Math.floor(Math.random() * 50);
  
  return {
    username: `${firstName.toLowerCase()}_${lastName.toLowerCase()}_${index}`,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${index}@testprovider.com`,
    firstName,
    lastName,
    age,
    gender: 'female',
    bio,
    location: {
      city: location.city,
      country: 'Ghana',
      coordinates: {
        lat: location.lat + latVariation,
        lng: location.lng + lngVariation
      }
    },
    services,
    basePrice,
    currency: 'GHS',
    languages: languageOptions[Math.floor(Math.random() * languageOptions.length)],
    availability: generateAvailability(),
    responseRate,
    bookingSuccessRate,
    viewCount,
    contactCount,
    verificationTier: 1 + Math.floor(Math.random() * 3), // 1-3
    reputationScore: 50 + Math.floor(Math.random() * 50), // 50-100
    isSubscribed: Math.random() > 0.5,
    subscriptionTier: Math.random() > 0.7 ? 'premium' : 'basic'
  };
}

function generateAvailability() {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const availability = {};
  days.forEach(day => {
    if (Math.random() > 0.3) { // 70% chance available on each day
      availability[day] = {
        available: true,
        hours: Math.random() > 0.5 ? 'Evening only' : 'All day'
      };
    }
  });
  return availability;
}

async function createTestProviders() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Default password for all test accounts
    const defaultPassword = await bcrypt.hash('TestProvider123!', 10);
    
    console.log('🏗️ Creating 50 test provider profiles in Accra Region...\n');
    
    let created = 0;
    let skipped = 0;
    
    for (let i = 1; i <= 50; i++) {
      const profile = generateProfile(i);
      
      // Check if user already exists
      const existingUser = await User.findOne({
        $or: [
          { username: profile.username },
          { email: profile.email }
        ]
      });
      
      if (existingUser) {
        console.log(`⏭️ Skipping ${profile.username} (already exists)`);
        skipped++;
        continue;
      }
      
      // Create user
      const user = new User({
        username: profile.username,
        email: profile.email,
        password_hash: defaultPassword,
        phone: `+233${200000000 + Math.floor(Math.random() * 99999999)}`,
        verification_tier: profile.verificationTier,
        reputation_score: profile.reputationScore,
        trust_score: profile.reputationScore * 0.5,
        is_subscribed: profile.isSubscribed,
        subscription_tier: profile.subscriptionTier,
        status: 'active',
        last_active: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random last active within 7 days
        profile_data: {
          accountType: 'provider',
          firstName: profile.firstName,
          lastName: profile.lastName,
          age: profile.age,
          gender: profile.gender,
          bio: profile.bio,
          location: profile.location,
          services: profile.services,
          basePrice: profile.basePrice,
          currency: profile.currency,
          languages: profile.languages,
          availability: profile.availability,
          responseRate: profile.responseRate,
          bookingSuccessRate: profile.bookingSuccessRate,
          viewCount: profile.viewCount,
          contactCount: profile.contactCount,
          photos: [],
          profilePicture: null,
          isTestAccount: true
        }
      });
      
      await user.save();
      created++;
      
      console.log(`✅ Created: ${profile.firstName} ${profile.lastName} (${profile.location.city}) - ${profile.age}yo - ₵${profile.basePrice}`);
    }
    
    console.log('\n========================================');
    console.log(`✅ Created: ${created} new providers`);
    console.log(`⏭️ Skipped: ${skipped} (already existed)`);
    console.log('========================================\n');
    
    // Show distribution by city
    console.log('📍 Distribution by City:');
    const cityCounts = {};
    const allProviders = await User.find({ 'profile_data.accountType': 'provider', 'profile_data.isTestAccount': true });
    allProviders.forEach(p => {
      const city = p.profile_data?.location?.city || 'Unknown';
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    });
    Object.entries(cityCounts).sort((a, b) => b[1] - a[1]).forEach(([city, count]) => {
      console.log(`   ${city}: ${count} providers`);
    });
    
    console.log('\n🎉 Test data creation complete!');
    console.log('📝 Default password for all test accounts: TestProvider123!');
    
  } catch (error) {
    console.error('❌ Error creating test providers:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the script
createTestProviders();
