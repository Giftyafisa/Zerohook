/**
 * Add Test Users to Zerohook Database
 * Run: node add-test-users.js
 */

require('dotenv').config({ path: './env.local' });
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// UUID v4 generator using built-in crypto
function uuidv4() {
  return crypto.randomUUID();
}

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const testUsers = [
  {
    username: 'sarah_professional',
    email: 'sarah@example.com',
    password: 'Test123!',
    profile_data: {
      firstName: 'Sarah',
      lastName: 'Johnson',
      age: 28,
      bio: 'Professional escort with 5+ years experience. Discreet and reliable.',
      location: { city: 'Lagos', country: 'Nigeria', coordinates: { lat: 6.5244, lng: 3.3792 } },
      occupation: 'Professional Escort',
      languages: ['English', 'Yoruba'],
      specializations: ['Long Term', 'Short Term'],
      serviceCategories: ['Long Term', 'Short Term'],
      basePrice: 250,
      availability: ['Weekdays', 'Weekends'],
      photos: ['https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400']
    },
    verification_tier: 3,
    reputation_score: 95,
    is_subscribed: true,
    subscription_tier: 'premium'
  },
  {
    username: 'grace_elegant',
    email: 'grace@example.com',
    password: 'Test123!',
    profile_data: {
      firstName: 'Grace',
      lastName: 'Williams',
      age: 25,
      bio: 'Elegant and sophisticated companion for discerning clients.',
      location: { city: 'Accra', country: 'Ghana', coordinates: { lat: 5.6037, lng: -0.1870 } },
      occupation: 'High-End Companion',
      languages: ['English', 'Twi'],
      specializations: ['Special Services', 'Long Term'],
      serviceCategories: ['Special Services', 'Long Term'],
      basePrice: 400,
      availability: ['Weekends', 'Evenings'],
      photos: ['https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400']
    },
    verification_tier: 2,
    reputation_score: 88,
    is_subscribed: true,
    subscription_tier: 'elite'
  },
  {
    username: 'amara_beauty',
    email: 'amara@example.com',
    password: 'Test123!',
    profile_data: {
      firstName: 'Amara',
      lastName: 'Okonkwo',
      age: 24,
      bio: 'Young, vibrant, and adventurous. Love meeting new people.',
      location: { city: 'Abuja', country: 'Nigeria', coordinates: { lat: 9.0765, lng: 7.3986 } },
      occupation: 'Model & Companion',
      languages: ['English', 'Igbo'],
      specializations: ['Short Term', 'BJ'],
      serviceCategories: ['Short Term', 'BJ'],
      basePrice: 150,
      availability: ['Evenings', 'Weekends'],
      photos: ['https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400']
    },
    verification_tier: 2,
    reputation_score: 82,
    is_subscribed: true,
    subscription_tier: 'basic'
  },
  {
    username: 'kenya_queen',
    email: 'kenya@example.com',
    password: 'Test123!',
    profile_data: {
      firstName: 'Wanjiku',
      lastName: 'Mwangi',
      age: 27,
      bio: 'Nairobi-based professional. GFE specialist with excellent reviews.',
      location: { city: 'Nairobi', country: 'Kenya', coordinates: { lat: -1.2921, lng: 36.8219 } },
      occupation: 'GFE Specialist',
      languages: ['English', 'Swahili'],
      specializations: ['Long Term', 'Special Services'],
      serviceCategories: ['Long Term', 'Special Services'],
      basePrice: 300,
      availability: ['Weekdays', 'Weekends', 'Evenings'],
      photos: ['https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400']
    },
    verification_tier: 3,
    reputation_score: 91,
    is_subscribed: true,
    subscription_tier: 'premium'
  },
  {
    username: 'diamond_diva',
    email: 'diamond@example.com',
    password: 'Test123!',
    profile_data: {
      firstName: 'Fatima',
      lastName: 'Ahmed',
      age: 26,
      bio: 'Luxury companion for business events and private encounters.',
      location: { city: 'Johannesburg', country: 'South Africa', coordinates: { lat: -26.2041, lng: 28.0473 } },
      occupation: 'Elite Companion',
      languages: ['English', 'Zulu', 'Afrikaans'],
      specializations: ['Long Term', 'Special Services', 'VIP'],
      serviceCategories: ['Long Term', 'Special Services'],
      basePrice: 500,
      availability: ['By Appointment'],
      photos: ['https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400']
    },
    verification_tier: 3,
    reputation_score: 97,
    is_subscribed: true,
    subscription_tier: 'elite'
  },
  {
    username: 'cleo_charm',
    email: 'cleo@example.com',
    password: 'Test123!',
    profile_data: {
      firstName: 'Cleopatra',
      lastName: 'Mensah',
      age: 23,
      bio: 'Sweet and caring. Perfect for first-timers.',
      location: { city: 'Kumasi', country: 'Ghana', coordinates: { lat: 6.6666, lng: -1.6163 } },
      occupation: 'Companion',
      languages: ['English', 'Twi'],
      specializations: ['Short Term', 'BJ'],
      serviceCategories: ['Short Term', 'BJ'],
      basePrice: 120,
      availability: ['Evenings', 'Weekends'],
      photos: ['https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400']
    },
    verification_tier: 1,
    reputation_score: 75,
    is_subscribed: false,
    subscription_tier: 'basic'
  },
  {
    username: 'naija_queen',
    email: 'naija@example.com',
    password: 'Test123!',
    profile_data: {
      firstName: 'Chiamaka',
      lastName: 'Eze',
      age: 29,
      bio: 'Mature and experienced. Specializing in mature clientele.',
      location: { city: 'Port Harcourt', country: 'Nigeria', coordinates: { lat: 4.8156, lng: 7.0498 } },
      occupation: 'Professional Escort',
      languages: ['English', 'Igbo', 'Pidgin'],
      specializations: ['Long Term', 'Mature'],
      serviceCategories: ['Long Term', 'Special Services'],
      basePrice: 200,
      availability: ['Weekdays', 'Evenings'],
      photos: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400']
    },
    verification_tier: 2,
    reputation_score: 85,
    is_subscribed: true,
    subscription_tier: 'basic'
  },
  {
    username: 'kampala_star',
    email: 'kampala@example.com',
    password: 'Test123!',
    profile_data: {
      firstName: 'Nakato',
      lastName: 'Ssemanda',
      age: 25,
      bio: 'Ugandan beauty. Friendly and professional service.',
      location: { city: 'Kampala', country: 'Uganda', coordinates: { lat: 0.3476, lng: 32.5825 } },
      occupation: 'Escort',
      languages: ['English', 'Luganda'],
      specializations: ['Short Term', 'Long Term'],
      serviceCategories: ['Short Term', 'Long Term'],
      basePrice: 180,
      availability: ['Weekends', 'Evenings'],
      photos: ['https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400']
    },
    verification_tier: 2,
    reputation_score: 80,
    is_subscribed: true,
    subscription_tier: 'basic'
  }
];

async function addTestUsers() {
  console.log('🚀 Adding test users to Zerohook database...\n');
  
  const client = await pool.connect();
  
  try {
    for (const user of testUsers) {
      const userId = uuidv4();
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1 OR username = $2',
        [user.email, user.username]
      );
      
      if (existingUser.rows.length > 0) {
        console.log(`⚠️  User ${user.username} already exists, skipping...`);
        continue;
      }
      
      // Insert user
      await client.query(`
        INSERT INTO users (
          id, username, email, password_hash, 
          profile_data, verification_tier, reputation_score,
          is_subscribed, subscription_tier, subscription_expires_at,
          created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()
        )
      `, [
        userId,
        user.username,
        user.email,
        hashedPassword,
        JSON.stringify(user.profile_data),
        user.verification_tier,
        user.reputation_score,
        user.is_subscribed,
        user.subscription_tier,
        user.is_subscribed ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null // 30 days from now
      ]);
      
      console.log(`✅ Added user: ${user.username} (${user.email})`);
      console.log(`   Location: ${user.profile_data.location.city}, ${user.profile_data.location.country}`);
      console.log(`   Tier: ${user.verification_tier} | Score: ${user.reputation_score}`);
      console.log(`   Subscribed: ${user.is_subscribed ? 'Yes (' + user.subscription_tier + ')' : 'No'}`);
      console.log('');
    }
    
    // Count total users
    const countResult = await client.query('SELECT COUNT(*) FROM users');
    console.log(`\n📊 Total users in database: ${countResult.rows[0].count}`);
    
    console.log('\n🎉 Test users added successfully!');
    console.log('\n📝 Login credentials for all test users:');
    console.log('   Password: Test123!');
    console.log('   Emails: sarah@example.com, grace@example.com, amara@example.com, etc.');
    
  } catch (error) {
    console.error('❌ Error adding test users:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addTestUsers().catch(console.error);
