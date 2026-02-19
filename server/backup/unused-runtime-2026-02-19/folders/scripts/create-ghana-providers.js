/**
 * Create test providers in Ghana (Accra area) with CORRECT GPS coordinates
 * 
 * Accra coordinates: 5.6037° N, -0.1870° W
 * This script creates providers distributed across Accra and nearby areas
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User, connectDB } = require('../config/database');

// Ghana locations with correct GPS coordinates
const GHANA_LOCATIONS = [
  // Accra proper
  { city: 'Accra Central', country: 'Ghana', lat: 5.5500, lng: -0.2000 },
  { city: 'Osu', country: 'Ghana', lat: 5.5560, lng: -0.1847 },
  { city: 'Cantonments', country: 'Ghana', lat: 5.5733, lng: -0.1700 },
  { city: 'Airport Residential', country: 'Ghana', lat: 5.6058, lng: -0.1719 },
  { city: 'East Legon', country: 'Ghana', lat: 5.6347, lng: -0.1553 },
  { city: 'Labone', country: 'Ghana', lat: 5.5653, lng: -0.1750 },
  { city: 'Roman Ridge', country: 'Ghana', lat: 5.5800, lng: -0.1750 },
  { city: 'Dzorwulu', country: 'Ghana', lat: 5.6064, lng: -0.2050 },
  // Greater Accra - slightly further
  { city: 'Tema', country: 'Ghana', lat: 5.6698, lng: -0.0166 },
  { city: 'Madina', country: 'Ghana', lat: 5.6803, lng: -0.1703 },
  { city: 'Achimota', country: 'Ghana', lat: 5.6167, lng: -0.2333 },
  { city: 'Dome', country: 'Ghana', lat: 5.6353, lng: -0.2317 },
  { city: 'Kasoa', country: 'Ghana', lat: 5.5333, lng: -0.4167 },
  { city: 'Spintex', country: 'Ghana', lat: 5.6350, lng: -0.0700 },
  // Kumasi (2nd largest city, ~250km north)
  { city: 'Kumasi', country: 'Ghana', lat: 6.6885, lng: -1.6244 },
  { city: 'Adum', country: 'Ghana', lat: 6.6950, lng: -1.6150 },
  // Takoradi (coastal city, ~220km west)
  { city: 'Takoradi', country: 'Ghana', lat: 4.8845, lng: -1.7554 },
  { city: 'Sekondi', country: 'Ghana', lat: 4.9342, lng: -1.7137 },
  // Cape Coast
  { city: 'Cape Coast', country: 'Ghana', lat: 5.1315, lng: -1.2795 },
];

const FIRST_NAMES = [
  'Akua', 'Ama', 'Abena', 'Adjoa', 'Yaa', 'Afia', 'Akosua', 'Efua',
  'Adwoa', 'Adzo', 'Serwaa', 'Abigail', 'Nana', 'Gifty', 'Mercy', 
  'Precious', 'Princess', 'Gloria', 'Linda', 'Sarah', 'Esther', 'Ruth',
  'Grace', 'Patience', 'Comfort', 'Felicia', 'Joyce', 'Love'
];

const LAST_NAMES = [
  'Mensah', 'Asante', 'Owusu', 'Boateng', 'Osei', 'Appiah', 'Agyemang',
  'Amoah', 'Antwi', 'Donkor', 'Kwarteng', 'Yeboah', 'Amankwah', 'Adu',
  'Amponsah', 'Asare', 'Gyasi', 'Nyame', 'Ofori', 'Sarpong', 'Tetteh'
];

const BIOS = [
  "Professional companion based in {city}. Available for dinner dates, events, and intimate encounters. Discrete and sophisticated. 💋",
  "Elegant {city} beauty offering premium companionship. University educated, multilingual, and adventurous. Message me!",
  "Your dream date in {city}! I love good conversation, fine dining, and making memorable connections. ✨",
  "Sweet and sensual {city} girl. Let me make your fantasies come true. Available for outcalls and incalls.",
  "High-class escort serving {city} and surroundings. Polite, punctual, and passionate. Book your appointment!",
  "Curvy chocolate goddess in {city}. GFE specialist with a touch of naughtiness. You won't be disappointed! 🔥",
  "Natural beauty based in {city}. I offer authentic connections and unforgettable experiences. DM me!",
  "{city}'s finest! Sexy, smart, and always ready for adventure. Let's create some magic together. 💫"
];

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateUsername(firstName, lastName) {
  const random = Math.floor(Math.random() * 1000);
  return `${firstName.toLowerCase()}_${lastName.toLowerCase()}_gh${random}`;
}

function addRandomOffset(lat, lng, maxKm = 2) {
  // Add random offset within maxKm kilometers
  const latOffset = (Math.random() - 0.5) * (maxKm / 111); // 1 degree ≈ 111km
  const lngOffset = (Math.random() - 0.5) * (maxKm / 111);
  return {
    lat: lat + latOffset,
    lng: lng + lngOffset
  };
}

async function createGhanaProviders(count = 30) {
  try {
    await connectDB();
    console.log('✅ Connected to database\n');
    
    // Wait for models
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const createdProfiles = [];
    const passwordHash = await bcrypt.hash('testpass123', 10);
    
    for (let i = 0; i < count; i++) {
      const firstName = randomElement(FIRST_NAMES);
      const lastName = randomElement(LAST_NAMES);
      const location = randomElement(GHANA_LOCATIONS);
      const coords = addRandomOffset(location.lat, location.lng);
      const bio = randomElement(BIOS).replace('{city}', location.city);
      const age = Math.floor(Math.random() * 12) + 20; // 20-31
      const basePrice = Math.floor(Math.random() * 300) + 100; // 100-400 GHS
      
      // Prioritize Accra area (70% of profiles)
      const useAccraArea = i < count * 0.7;
      const finalLocation = useAccraArea 
        ? GHANA_LOCATIONS[Math.floor(Math.random() * 14)] // First 14 are Accra/Greater Accra
        : randomElement(GHANA_LOCATIONS);
      const finalCoords = addRandomOffset(finalLocation.lat, finalLocation.lng);
      
      const username = generateUsername(firstName, lastName);
      
      // Check if username already exists
      const existing = await User.findOne({ username });
      if (existing) {
        console.log(`⏭️ Skipping ${username} (already exists)`);
        continue;
      }
      
      const profileData = {
        firstName,
        lastName,
        age,
        bio,
        accountType: 'provider',
        gender: 'female',
        location: {
          city: finalLocation.city,
          country: 'Ghana',
          coordinates: {
            lat: finalCoords.lat,
            lng: finalCoords.lng
          }
        },
        basePrice,
        currency: 'GHS',
        languages: ['English', 'Twi'],
        services: ['Companionship', 'Dinner Dates', 'Events', 'GFE'],
        availability: ['Weekdays', 'Weekends', 'Evenings'],
        profilePicture: null,
        photos: [],
        bookingSuccessRate: Math.floor(Math.random() * 30) + 70, // 70-100
        responseRate: Math.floor(Math.random() * 30) + 70 // 70-100
      };
      
      const newUser = new User({
        username,
        email: `${username}@test.zerohook.com`,
        password: passwordHash,
        verification_tier: Math.floor(Math.random() * 3) + 1, // 1-3
        verificationTier: Math.floor(Math.random() * 3) + 1,
        reputation_score: Math.floor(Math.random() * 30) + 70, // 70-100
        reputationScore: Math.floor(Math.random() * 30) + 70,
        is_subscribed: Math.random() > 0.5,
        isSubscribed: Math.random() > 0.5,
        subscription_tier: Math.random() > 0.7 ? 'premium' : 'basic',
        subscriptionTier: Math.random() > 0.7 ? 'premium' : 'basic',
        profile_data: profileData,
        profileData: profileData,
        profile_visibility: 'public',
        profileVisibility: 'public',
        last_active: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000), // Last 24 hours
        lastActive: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000),
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) // Last 30 days
      });
      
      await newUser.save();
      createdProfiles.push({
        username,
        city: finalLocation.city,
        coords: finalCoords
      });
      
      const distanceFromAccra = Math.sqrt(
        Math.pow((finalCoords.lat - 5.6037) * 111, 2) + 
        Math.pow((finalCoords.lng - (-0.187)) * 111, 2)
      ).toFixed(1);
      
      console.log(`✅ Created: ${username} in ${finalLocation.city} (~${distanceFromAccra}km from Accra central)`);
    }
    
    console.log(`\n🎉 Created ${createdProfiles.length} Ghana providers!`);
    
    // Count by city
    console.log('\n📊 Distribution by city:');
    const cityCounts = {};
    createdProfiles.forEach(p => {
      cityCounts[p.city] = (cityCounts[p.city] || 0) + 1;
    });
    Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([city, count]) => {
        console.log(`   ${city}: ${count} providers`);
      });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Create 30 Ghana providers
createGhanaProviders(30);
