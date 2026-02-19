/**
 * Create 50 Provider Profiles in Accra Region
 * Spread across different towns and cities
 */

const { query } = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Generate UUID v4
function uuidv4() {
  return crypto.randomUUID();
}

// Accra Region towns/cities with coordinates
const ACCRA_LOCATIONS = [
  { city: 'Accra Central', lat: 5.5560, lng: -0.1969 },
  { city: 'Osu', lat: 5.5571, lng: -0.1818 },
  { city: 'Cantonments', lat: 5.5761, lng: -0.1674 },
  { city: 'Airport Residential', lat: 5.6050, lng: -0.1700 },
  { city: 'East Legon', lat: 5.6350, lng: -0.1550 },
  { city: 'Labone', lat: 5.5650, lng: -0.1750 },
  { city: 'Dzorwulu', lat: 5.6100, lng: -0.1950 },
  { city: 'Achimota', lat: 5.6150, lng: -0.2250 },
  { city: 'Tesano', lat: 5.5950, lng: -0.2350 },
  { city: 'Dansoman', lat: 5.5350, lng: -0.2550 },
  { city: 'Mamprobi', lat: 5.5400, lng: -0.2350 },
  { city: 'Korle Bu', lat: 5.5350, lng: -0.2250 },
  { city: 'Adabraka', lat: 5.5600, lng: -0.2100 },
  { city: 'Circle', lat: 5.5700, lng: -0.2150 },
  { city: 'Nima', lat: 5.5850, lng: -0.2000 },
  { city: 'Madina', lat: 5.6700, lng: -0.1650 },
  { city: 'Adenta', lat: 5.7100, lng: -0.1500 },
  { city: 'Tema', lat: 5.6698, lng: -0.0166 },
  { city: 'Spintex', lat: 5.6350, lng: -0.0850 },
  { city: 'Teshie', lat: 5.5850, lng: -0.1050 },
  { city: 'Nungua', lat: 5.6050, lng: -0.0750 },
  { city: 'Labadi', lat: 5.5600, lng: -0.1450 },
  { city: 'Ridge', lat: 5.5700, lng: -0.1900 },
  { city: 'Roman Ridge', lat: 5.5850, lng: -0.1850 },
  { city: 'Ringway Estates', lat: 5.5650, lng: -0.1900 },
];

// Female Ghanaian names
const FIRST_NAMES = [
  'Ama', 'Akosua', 'Adjoa', 'Akua', 'Yaa', 'Afia', 'Efua', 'Abena',
  'Nana', 'Adwoa', 'Afua', 'Kukua', 'Araba', 'Esi', 'Ekua', 'Adzo',
  'Dzifa', 'Enam', 'Sena', 'Selasi', 'Mawusi', 'Yayra', 'Dela', 'Enyonam',
  'Sedinam', 'Senam', 'Dzidzor', 'Kafui', 'Eyram', 'Etornam', 'Makafui', 'Sefakor',
  'Vida', 'Gifty', 'Patience', 'Comfort', 'Mercy', 'Grace', 'Blessing', 'Precious',
  'Diana', 'Sandra', 'Linda', 'Rita', 'Janet', 'Nancy', 'Rose', 'Esther',
  'Priscilla', 'Lydia'
];

const LAST_NAMES = [
  'Mensah', 'Asante', 'Osei', 'Boateng', 'Amoah', 'Owusu', 'Agyei', 'Appiah',
  'Antwi', 'Ofori', 'Adjei', 'Darko', 'Gyamfi', 'Kwarteng', 'Ampofo', 'Asamoah',
  'Afriyie', 'Bonsu', 'Kumi', 'Danso', 'Forson', 'Asiedu', 'Amponsah', 'Acheampong',
  'Boadu', 'Kyei', 'Sarpong', 'Badu', 'Frimpong', 'Tetteh'
];

// Service categories
const SERVICES = [
  ['Escort', 'Companion'],
  ['Massage', 'Sensual'],
  ['GFE', 'Intimacy'],
  ['Short Term', 'Quick'],
  ['Long Term', 'Overnight'],
  ['VIP', 'Premium'],
  ['Incall', 'Outcall'],
  ['BDSM', 'Fetish'],
];

// Bio templates
const BIOS = [
  "Sweet and caring companion ready to make your day special. 💕",
  "Elegant lady offering premium services for gentlemen. Discretion guaranteed.",
  "Young and vibrant! Let's have a great time together. 🌟",
  "Professional companion with 3+ years experience. Your satisfaction is my priority.",
  "Curvy and beautiful. Available for incalls and outcalls. Hit me up!",
  "Exotic beauty looking to connect with respectful clients. No rush services.",
  "Mature and experienced. I know exactly what you need. 💋",
  "New in town but ready to impress. Give me a chance to wow you!",
  "Slim and petite with a big personality. Let me be your escape.",
  "Busty and beautiful. GFE specialist with excellent reviews.",
  "Your secret is safe with me. Discreet and professional always.",
  "Independent provider. No agencies, no drama. Just pure pleasure.",
  "Available 24/7 for your needs. Incall and outcall services.",
  "Chocolate beauty with a warm personality. Come taste the sweetness!",
  "Fitness enthusiast with a killer body. Let me show you my flexibility. 😉",
];

// Generate random phone number (Ghana format)
function generatePhone() {
  const prefixes = ['024', '054', '055', '059', '020', '050', '027', '057', '026', '056'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(Math.random() * 9000000) + 1000000;
  return `+233${prefix.slice(1)}${number}`;
}

// Generate random price (50-800 GHS)
function generatePrice() {
  const prices = [50, 80, 100, 120, 150, 180, 200, 250, 300, 350, 400, 500, 600, 800];
  return prices[Math.floor(Math.random() * prices.length)];
}

// Generate random age (19-38)
function generateAge() {
  return Math.floor(Math.random() * 20) + 19;
}

// Generate random verification tier (1-3)
function generateVerificationTier() {
  const rand = Math.random();
  if (rand < 0.5) return 1;
  if (rand < 0.85) return 2;
  return 3;
}

// Generate reputation score (60-100)
function generateReputation() {
  return Math.floor(Math.random() * 40) + 60;
}

// Generate availability
function generateAvailability() {
  const options = [
    ['Evenings', 'Weekends'],
    ['Weekdays', 'Evenings'],
    ['24/7'],
    ['Afternoons', 'Evenings'],
    ['Weekends Only'],
    ['By Appointment'],
    ['Mornings', 'Afternoons', 'Evenings'],
  ];
  return options[Math.floor(Math.random() * options.length)];
}

// Add slight randomness to coordinates (within ~2km)
function randomizeCoords(lat, lng) {
  const latOffset = (Math.random() - 0.5) * 0.02;
  const lngOffset = (Math.random() - 0.5) * 0.02;
  return {
    lat: parseFloat((lat + latOffset).toFixed(6)),
    lng: parseFloat((lng + lngOffset).toFixed(6))
  };
}

async function createProviders() {
  console.log('🚀 Starting to create 50 Accra-region providers...\n');
  
  const hashedPassword = await bcrypt.hash('Test123!', 10);
  let created = 0;
  const usedNames = new Set();

  for (let i = 0; i < 50; i++) {
    try {
      // Pick random location
      const location = ACCRA_LOCATIONS[i % ACCRA_LOCATIONS.length];
      const coords = randomizeCoords(location.lat, location.lng);
      
      // Generate unique name
      let firstName, lastName, username;
      do {
        firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
        lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
        username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}${Math.floor(Math.random() * 99)}`;
      } while (usedNames.has(username));
      usedNames.add(username);
      
      const email = `${username}@example.com`;
      const age = generateAge();
      const price = generatePrice();
      const services = SERVICES[Math.floor(Math.random() * SERVICES.length)];
      const bio = BIOS[Math.floor(Math.random() * BIOS.length)];
      const verificationTier = generateVerificationTier();
      const reputation = generateReputation();
      const availability = generateAvailability();
      
      // Random last active (within last 7 days, some online now)
      const hoursAgo = Math.random() < 0.3 ? 0 : Math.floor(Math.random() * 168);
      const lastActive = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
      
      const profileData = {
        accountType: 'provider', // IMPORTANT: Mark as provider
        firstName,
        lastName,
        age,
        bio,
        phone: generatePhone(),
        location: {
          city: location.city,
          country: 'Ghana',
          region: 'Greater Accra',
          coordinates: coords
        },
        basePrice: price,
        currency: 'GHS',
        languages: ['English', 'Twi'],
        availability,
        serviceCategories: services,
        specializations: services,
        photos: [
          `https://i.pravatar.cc/400?img=${(i % 70) + 1}`
        ],
        profilePicture: `https://i.pravatar.cc/400?img=${(i % 70) + 1}`,
        responseRate: Math.floor(Math.random() * 30) + 70, // 70-100%
        bookingSuccessRate: Math.floor(Math.random() * 25) + 75, // 75-100%
        reviewCount: Math.floor(Math.random() * 50),
        isVerified: verificationTier >= 2,
        acceptsOnlineBooking: Math.random() > 0.3,
      };

      const userId = uuidv4();
      
      await query(`
        INSERT INTO users (
          id, username, email, password_hash, 
          profile_data, verification_tier, reputation_score,
          is_subscribed, subscription_tier, last_active, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (email) DO NOTHING
      `, [
        userId,
        username,
        email,
        hashedPassword,
        JSON.stringify(profileData),
        verificationTier,
        reputation,
        Math.random() > 0.6, // 40% subscribed
        Math.random() > 0.7 ? 'premium' : 'basic',
        lastActive
      ]);

      created++;
      console.log(`✅ Created: ${firstName} ${lastName} (${location.city}) - $${price} - Tier ${verificationTier}`);
      
    } catch (error) {
      console.error(`❌ Error creating provider ${i + 1}:`, error.message);
    }
  }

  console.log(`\n🎉 Done! Created ${created} providers in Accra region.`);
  
  // Show summary by location
  const summary = await query(`
    SELECT 
      profile_data->'location'->>'city' as city,
      COUNT(*) as count
    FROM users 
    WHERE profile_data->>'accountType' = 'provider'
    AND profile_data->'location'->>'country' = 'Ghana'
    GROUP BY profile_data->'location'->>'city'
    ORDER BY count DESC
  `);
  
  console.log('\n📊 Providers by City:');
  summary.rows.forEach(row => {
    console.log(`   ${row.city}: ${row.count} providers`);
  });
  
  process.exit(0);
}

createProviders().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
