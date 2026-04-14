/*
 * Seed deterministic provider test accounts across Greater Accra.
 *
 * Purpose:
 * - Generate realistic provider profiles for proximity and recommendation testing
 * - Keep inserts idempotent (safe to re-run)
 * - Remain dry-run by default
 *
 * Notes:
 * - Zerohook remains pan-African. This script is an Accra-specific seed helper only.
 * - Use --apply to write changes.
 *
 * Usage:
 *   node scripts/create-accra-test-providers.js
 *   node scripts/create-accra-test-providers.js --apply
 *   node scripts/create-accra-test-providers.js --apply --count=50
 */

const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

require('dotenv').config({ path: path.resolve(__dirname, '..', 'env.local') });

const { connectDB, mongoose, User } = require('../config/database');

const ACCRA_LOCATIONS = [
  { city: 'Accra Central', region: 'Greater Accra', lat: 5.5559, lng: -0.1969 },
  { city: 'Osu', region: 'Greater Accra', lat: 5.5560, lng: -0.1828 },
  { city: 'Labone', region: 'Greater Accra', lat: 5.5665, lng: -0.1728 },
  { city: 'East Legon', region: 'Greater Accra', lat: 5.6351, lng: -0.1596 },
  { city: 'Airport Residential', region: 'Greater Accra', lat: 5.6039, lng: -0.1736 },
  { city: 'Cantonments', region: 'Greater Accra', lat: 5.5729, lng: -0.1768 },
  { city: 'Tema', region: 'Greater Accra', lat: 5.6698, lng: 0.0166 },
  { city: 'Teshie', region: 'Greater Accra', lat: 5.5815, lng: -0.1069 },
  { city: 'Madina', region: 'Greater Accra', lat: 5.6830, lng: -0.1680 },
  { city: 'Adenta', region: 'Greater Accra', lat: 5.7150, lng: -0.1581 },
  { city: 'Spintex', region: 'Greater Accra', lat: 5.6298, lng: -0.0935 },
  { city: 'Dansoman', region: 'Greater Accra', lat: 5.5255, lng: -0.2666 },
  { city: 'Achimota', region: 'Greater Accra', lat: 5.6247, lng: -0.2294 },
  { city: 'Kasoa', region: 'Greater Accra', lat: 5.5348, lng: -0.4200 },
  { city: 'Ashaiman', region: 'Greater Accra', lat: 5.6843, lng: -0.0381 },
  { city: 'Nungua', region: 'Greater Accra', lat: 5.5948, lng: -0.0769 },
  { city: 'Labadi', region: 'Greater Accra', lat: 5.5617, lng: -0.1478 },
  { city: 'Dzorwulu', region: 'Greater Accra', lat: 5.6110, lng: -0.2000 },
  { city: 'Roman Ridge', region: 'Greater Accra', lat: 5.5887, lng: -0.1805 },
  { city: 'Ridge', region: 'Greater Accra', lat: 5.5735, lng: -0.1957 }
];

const FIRST_NAMES = [
  'Akua', 'Ama', 'Abena', 'Adwoa', 'Afia', 'Yaa', 'Efua', 'Esi',
  'Gifty', 'Grace', 'Mercy', 'Patience', 'Naomi', 'Priscilla', 'Rebecca',
  'Lydia', 'Sandra', 'Linda', 'Cynthia', 'Janet', 'Stella', 'Gloria'
];

const LAST_NAMES = [
  'Mensah', 'Owusu', 'Asante', 'Adjei', 'Osei', 'Boateng', 'Agyemang',
  'Amoah', 'Appiah', 'Darko', 'Yeboah', 'Frimpong', 'Antwi', 'Danquah'
];

const SERVICE_POOL = [
  'Companionship',
  'Dinner Dates',
  'Events',
  'Travel Companion',
  'Private Meetups',
  'Weekend Getaway'
];

const LANGUAGE_POOL = [
  ['English', 'Twi'],
  ['English', 'Ga'],
  ['English', 'Ewe'],
  ['English', 'French', 'Twi'],
  ['English']
];

function hashToInt(value) {
  const hash = crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 8);
  return Number.parseInt(hash, 16);
}

function pick(arr, seedOffset) {
  return arr[seedOffset % arr.length];
}

function parseArgs() {
  const apply = process.argv.includes('--apply');
  const countArg = process.argv.find((arg) => arg.startsWith('--count='));
  const parsedCount = countArg ? Number.parseInt(countArg.split('=')[1], 10) : 50;
  const count = Number.isFinite(parsedCount) ? Math.min(Math.max(parsedCount, 1), 500) : 50;
  return { apply, count };
}

function buildProvider(index) {
  const seed = hashToInt(`accra-provider-${index}`);
  const firstName = pick(FIRST_NAMES, seed);
  const lastName = pick(LAST_NAMES, Math.floor(seed / 7));
  const location = pick(ACCRA_LOCATIONS, Math.floor(seed / 13));

  const latJitter = ((seed % 100) / 10000) - 0.005;
  const lngJitter = (((Math.floor(seed / 5)) % 100) / 10000) - 0.005;

  const age = 20 + (seed % 15);
  const basePrice = 120 + (seed % 220);
  const verificationTier = 1 + (seed % 3);
  const reputationScore = 60 + (seed % 40);
  const responseRate = 72 + (seed % 28);
  const bookingSuccessRate = 68 + (seed % 30);

  const services = [];
  for (let i = 0; i < SERVICE_POOL.length; i++) {
    if (((seed >> i) & 1) === 1) {
      services.push(SERVICE_POOL[i]);
    }
  }
  if (services.length === 0) {
    services.push('Companionship', 'Private Meetups');
  }

  const username = `${firstName}_${lastName}_${String(index).padStart(3, '0')}`.toLowerCase();
  const email = `accra.provider.${String(index).padStart(3, '0')}@seed.zerohook.test`;

  return {
    username,
    email,
    firstName,
    lastName,
    age,
    basePrice,
    verificationTier,
    reputationScore,
    responseRate,
    bookingSuccessRate,
    services,
    languages: pick(LANGUAGE_POOL, Math.floor(seed / 17)),
    location: {
      city: location.city,
      region: location.region,
      country: 'Ghana',
      countryCode: 'GH',
      accuracy: 'seeded',
      coordinates: {
        lat: Number((location.lat + latJitter).toFixed(6)),
        lng: Number((location.lng + lngJitter).toFixed(6))
      }
    }
  };
}

async function run() {
  const { apply, count } = parseArgs();

  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is required in environment.');
    process.exit(1);
  }

  await connectDB();

  if (mongoose.connection.readyState !== 1) {
    throw new Error('Database connection unavailable. Check MONGODB_URI/network and retry.');
  }

  const defaultPassword = process.env.TEST_USERS_PASSWORD || 'TestProvider123!';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  let wouldCreate = 0;
  let created = 0;
  let existing = 0;
  const cityDistribution = new Map();

  for (let i = 1; i <= count; i++) {
    const profile = buildProvider(i);
    const geoPoint = {
      type: 'Point',
      coordinates: [profile.location.coordinates.lng, profile.location.coordinates.lat]
    };

    const seedTag = `accra_provider_seed_v1_${String(i).padStart(3, '0')}`;

    const insertDoc = {
      username: profile.username,
      email: profile.email,
      phone: `+23320${String(1000000 + i).padStart(7, '0')}`,
      password_hash: passwordHash,
      verification_tier: profile.verificationTier,
      reputation_score: profile.reputationScore,
      trust_score: Math.max(40, Math.round(profile.reputationScore * 0.65)),
      status: 'active',
      is_subscribed: true,
      subscription_tier: 'premium',
      last_active: new Date(Date.now() - ((i % 24) * 60 * 60 * 1000)),
      profile_data: {
        accountType: 'provider',
        firstName: profile.firstName,
        lastName: profile.lastName,
        age: profile.age,
        gender: 'female',
        bio: `Professional provider in ${profile.location.city}. Reliable, discreet, and responsive for premium companionship services.`,
        country: 'Ghana',
        countryCode: 'GH',
        currency: 'GHS',
        location: {
          ...profile.location,
          geoPoint,
          lastUpdated: new Date().toISOString()
        },
        services: profile.services,
        languages: profile.languages,
        basePrice: profile.basePrice,
        responseRate: profile.responseRate,
        bookingSuccessRate: profile.bookingSuccessRate,
        viewCount: 30 + (i * 4),
        contactCount: 5 + (i % 20),
        photos: [],
        profilePicture: null,
        isTestAccount: true,
        seedTags: ['accra', 'provider', 'recommendation-test', seedTag]
      }
    };

    const alreadyExists = await User.exists({ email: profile.email });
    if (alreadyExists) {
      existing += 1;
    } else {
      wouldCreate += 1;
      if (apply) {
        await User.create(insertDoc);
        created += 1;
      }
    }

    cityDistribution.set(
      profile.location.city,
      (cityDistribution.get(profile.location.city) || 0) + 1
    );
  }

  console.log('Create Accra Test Providers Summary');
  console.log('----------------------------------');
  console.log(`mode: ${apply ? 'apply' : 'dry-run'}`);
  console.log(`target_count: ${count}`);
  console.log(`existing_accounts: ${existing}`);
  console.log(`${apply ? 'created_accounts' : 'would_create_accounts'}: ${apply ? created : wouldCreate}`);
  console.log('city_distribution:');
  for (const [city, cityCount] of [...cityDistribution.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${city}: ${cityCount}`);
  }

  if (!apply) {
    console.log('No records were written. Re-run with --apply to persist seed accounts.');
  }

  await mongoose.connection.close();
}

run().catch(async (error) => {
  console.error('Failed to seed Accra provider accounts:', error.message);
  try {
    await mongoose.connection.close();
  } catch (_) {
    // no-op
  }
  process.exit(1);
});
