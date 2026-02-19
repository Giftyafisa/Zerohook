/**
 * Add Tema Area Providers
 * Creates providers in Tema, Adjei-Kojo, Community 1-25, Sakumono, Lashibi areas
 */
const { query } = require('../config/database');
const bcrypt = require('bcryptjs');

// Tema area locations with precise coordinates
const TEMA_AREA_LOCATIONS = [
  { city: 'Adjei-Kojo', lat: 5.6750, lng: -0.0100, district: 'Tema West' },
  { city: 'Tema New Town', lat: 5.6550, lng: -0.0050, district: 'Tema Metro' },
  { city: 'Community 1', lat: 5.6600, lng: -0.0200, district: 'Tema Metro' },
  { city: 'Community 2', lat: 5.6620, lng: -0.0180, district: 'Tema Metro' },
  { city: 'Community 5', lat: 5.6650, lng: -0.0150, district: 'Tema Metro' },
  { city: 'Community 7', lat: 5.6700, lng: -0.0120, district: 'Tema Metro' },
  { city: 'Community 8', lat: 5.6680, lng: -0.0100, district: 'Tema Metro' },
  { city: 'Community 9', lat: 5.6720, lng: -0.0080, district: 'Tema Metro' },
  { city: 'Community 11', lat: 5.6760, lng: -0.0050, district: 'Tema Metro' },
  { city: 'Community 12', lat: 5.6780, lng: -0.0030, district: 'Tema Metro' },
  { city: 'Community 18', lat: 5.6800, lng: 0.0000, district: 'Tema Metro' },
  { city: 'Community 22', lat: 5.6820, lng: 0.0050, district: 'Tema Metro' },
  { city: 'Community 25', lat: 5.6850, lng: 0.0100, district: 'Tema Metro' },
  { city: 'Sakumono', lat: 5.6250, lng: -0.0350, district: 'Tema Metro' },
  { city: 'Lashibi', lat: 5.6150, lng: -0.0400, district: 'Tema Metro' },
  { city: 'Ashaiman', lat: 5.6914, lng: -0.0244, district: 'Ashaiman' },
  { city: 'Baatsonaa', lat: 5.6200, lng: -0.0800, district: 'Accra Metro' },
  { city: 'Kpone', lat: 5.7050, lng: 0.0300, district: 'Kpone Katamanso' },
  { city: 'Prampram', lat: 5.7250, lng: 0.1150, district: 'Ningo Prampram' },
  { city: 'Dawhenya', lat: 5.7000, lng: 0.0500, district: 'Ningo Prampram' }
];

const GHANAIAN_FIRST_NAMES = [
  'Ama', 'Akua', 'Abena', 'Yaa', 'Afia', 'Adwoa', 'Akosua',
  'Efua', 'Esi', 'Adjoa', 'Araba', 'Afua', 'Kukua', 'Ekua',
  'Nana', 'Maame', 'Serwaa', 'Adoma', 'Pokua', 'Frema'
];

const GHANAIAN_LAST_NAMES = [
  'Mensah', 'Owusu', 'Asante', 'Boateng', 'Amoah', 'Agyeman',
  'Appiah', 'Nyarko', 'Darko', 'Frimpong', 'Acheampong', 'Badu'
];

const SPECIALIZATIONS = [
  'Massage Therapy', 'Companionship', 'Dinner Dates', 'Travel Companion',
  'Personal Assistance', 'Wellness Services', 'Relaxation', 'Entertainment'
];

const BIOS = [
  "Hi! I'm a friendly and professional companion based in the Tema area.",
  "Looking for genuine connections in my neighborhood.",
  "Local girl, ready to make your day special.",
  "Professional and discreet. Your satisfaction is my priority.",
  "Sweet, fun, and always ready for a good time.",
  "Tema native, here to provide the best experience."
];

function generatePhone() {
  const prefixes = ['024', '054', '055', '027', '020'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(Math.random() * 9000000) + 1000000;
  return `+233${prefix.slice(1)}${number}`;
}

async function addTemaProviders() {
  console.log('\n🏗️ Adding Tema Area Providers...\n');
  
  const password = await bcrypt.hash('Provider123!', 12);
  let created = 0;
  
  for (const location of TEMA_AREA_LOCATIONS) {
    // Create 2 providers per location
    for (let i = 0; i < 2; i++) {
      const firstName = GHANAIAN_FIRST_NAMES[Math.floor(Math.random() * GHANAIAN_FIRST_NAMES.length)];
      const lastName = GHANAIAN_LAST_NAMES[Math.floor(Math.random() * GHANAIAN_LAST_NAMES.length)];
      const username = `${firstName.toLowerCase()}_${lastName.toLowerCase()}${Math.floor(Math.random() * 100)}`;
      const email = `${username}@temaarea.gh`;
      
      // Add small random offset to coordinates (within 500m)
      const latOffset = (Math.random() - 0.5) * 0.008;  // ~400m variation
      const lngOffset = (Math.random() - 0.5) * 0.008;
      
      const age = Math.floor(Math.random() * 15) + 20; // 20-35
      const basePrice = Math.floor(Math.random() * 300) + 100; // 100-400 GHS
      
      const specializations = [];
      const numSpecs = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numSpecs; j++) {
        const spec = SPECIALIZATIONS[Math.floor(Math.random() * SPECIALIZATIONS.length)];
        if (!specializations.includes(spec)) specializations.push(spec);
      }
      
      const profileData = {
        firstName,
        lastName,
        age,
        accountType: 'provider',
        phone: generatePhone(),
        gender: 'female',
        bio: BIOS[Math.floor(Math.random() * BIOS.length)] + ` Based in ${location.city}.`,
        location: {
          city: location.city,
          region: 'Greater Accra',
          country: 'Ghana',
          coordinates: {
            lat: location.lat + latOffset,
            lng: location.lng + lngOffset
          }
        },
        basePrice,
        currency: 'GHS',
        specializations,
        serviceCategories: specializations.slice(0, 2),
        availability: ['weekdays', 'weekends', 'evenings'],
        languages: ['English', 'Twi'],
        responseRate: Math.floor(Math.random() * 20) + 80, // 80-100%
        bookingSuccessRate: Math.floor(Math.random() * 25) + 75, // 75-100%
        reviewCount: Math.floor(Math.random() * 20),
        rating: (Math.random() * 1.5 + 3.5).toFixed(1) // 3.5-5.0
      };
      
      try {
        // Check if username exists
        const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
        if (existing.rows.length > 0) {
          console.log(`  ⏭️ ${username} already exists, skipping`);
          continue;
        }
        
        await query(`
          INSERT INTO users (username, email, password_hash, profile_data, verification_tier, reputation_score, is_subscribed, last_active)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        `, [
          username,
          email,
          password,
          JSON.stringify(profileData),
          Math.floor(Math.random() * 2) + 1, // Tier 1-2
          Math.floor(Math.random() * 30) + 70, // 70-100
          Math.random() > 0.7 // 30% subscribed
        ]);
        
        created++;
        console.log(`  ✅ Created: ${firstName} ${lastName} (${location.city}) - ${(location.lat + latOffset).toFixed(4)}, ${(location.lng + lngOffset).toFixed(4)}`);
      } catch (error) {
        console.error(`  ❌ Error creating ${username}:`, error.message);
      }
    }
  }
  
  console.log(`\n✅ Created ${created} new Tema area providers!\n`);
  
  // Now fix sarah_professional - add coordinates
  console.log('📍 Fixing sarah_professional coordinates...');
  try {
    const sarahResult = await query(`
      UPDATE users 
      SET profile_data = profile_data || '{"location": {"city": "Tema", "region": "Greater Accra", "country": "Ghana", "coordinates": {"lat": 5.6698, "lng": -0.0166}}}'::jsonb
      WHERE username = 'sarah_professional'
      RETURNING username
    `);
    if (sarahResult.rows.length > 0) {
      console.log('  ✅ Fixed sarah_professional coordinates');
    }
  } catch (error) {
    console.error('  ❌ Error fixing sarah_professional:', error.message);
  }
  
  process.exit(0);
}

addTemaProviders();
