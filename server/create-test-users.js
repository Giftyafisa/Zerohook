const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Test users data - 10 Adult Service Providers (Ghana & Nigeria)
const testUsers = [
  // Ghana Users
  {
    username: 'akua_ghana',
    email: 'akua.mensah@ghana.com',
    password: 'AkuaPass123!',
    phone: '233244123456',
    country: 'Ghana',
    city: 'Accra',
    verification_tier: 3,
            profile_data: {
          firstName: 'Akua',
          lastName: 'Mensah',
          age: 28,
          gender: 'Female',
          bio: 'Professional escort and companion in Accra. Offering intimate companionship, massage therapy, and special services with complete discretion. Available for both short and long-term arrangements.',
          interests: ['Intimate Companionship', 'Massage Therapy', 'Travel Companionship', 'Special Requests'],
          languages: ['English', 'Twi', 'Ga'],
          education: 'Hospitality Management',
          occupation: 'Professional Escort & Companion',
          serviceCategories: ['Long Term', 'Special Services', 'Massage'],
          basePrice: 250,
          availability: ['Weekends', 'Evenings', 'Late Night'],
          discretion: 'Maximum',
          verificationStatus: 'Verified',
          specializations: ['GFE', 'PSE', 'Massage', 'Travel Companion']
        }
  },
  {
    username: 'kwame_ghana',
    email: 'kwame.owusu@ghana.com',
    password: 'KwamePass123!',
    phone: '233277789012',
    country: 'Ghana',
    city: 'Kumasi',
    verification_tier: 2,
            profile_data: {
          firstName: 'Kwame',
          lastName: 'Owusu',
          age: 32,
          gender: 'Male',
          bio: 'Professional male escort and masseur in Kumasi. Specializing in intimate companionship, therapeutic massage, and stress relief services. Available for both short and extended sessions with complete discretion.',
          interests: ['Intimate Companionship', 'Therapeutic Massage', 'Stress Relief', 'Travel Companion'],
          languages: ['English', 'Twi', 'French'],
          education: 'KNUST - Massage Therapy',
          occupation: 'Professional Male Escort & Masseur',
          serviceCategories: ['Short Term', 'Oral Services', 'Massage'],
          basePrice: 180,
          availability: ['Weekdays', 'Evenings', 'Late Night'],
          discretion: 'Maximum',
          verificationStatus: 'Verified',
          specializations: ['GFE', 'Therapeutic Massage', 'Stress Relief', 'Travel Companion']
        }
  },
  {
    username: 'efua_ghana',
    email: 'efua.adjei@ghana.com',
    password: 'EfuaPass123!',
    phone: '233209456789',
    country: 'Ghana',
    city: 'Cape Coast',
    verification_tier: 3,
            profile_data: {
          firstName: 'Efua',
          lastName: 'Adjei',
          age: 35,
          gender: 'Female',
          bio: 'Premium escort and companion in Cape Coast. Offering exclusive intimate services, event companionship, and luxury experiences. Specializing in high-end clients seeking sophisticated adult entertainment with maximum discretion.',
          interests: ['Premium Escort Services', 'Luxury Companionship', 'Event Entertainment', 'Travel Companion'],
          languages: ['English', 'Fante', 'Twi'],
          education: 'Culinary Institute of Ghana',
          occupation: 'Premium Escort & Luxury Companion',
          serviceCategories: ['Long Term', 'Special Services', 'Premium'],
          basePrice: 350,
          availability: ['Weekends', 'Special Events', '24/7'],
          discretion: 'Maximum',
          verificationStatus: 'Verified',
          specializations: ['PSE', 'Luxury Companion', 'Event Entertainment', 'Travel Companion']
        }
  },
  {
    username: 'kofi_ghana',
    email: 'kofi.boateng@ghana.com',
    password: 'KofiPass123!',
    phone: '233244567890',
    country: 'Ghana',
    city: 'Tamale',
    verification_tier: 2,
            profile_data: {
          firstName: 'Kofi',
          lastName: 'Boateng',
          age: 29,
          gender: 'Male',
          bio: 'Professional male escort and wellness provider in Tamale. Offering intimate companionship, therapeutic services, and stress relief with cultural sensitivity. Specializing in discreet adult entertainment and wellness.',
          interests: ['Intimate Companionship', 'Adult Wellness', 'Cultural Services', 'Stress Relief'],
          languages: ['English', 'Dagbani', 'Hausa'],
          education: 'University for Development Studies',
          occupation: 'Professional Male Escort & Wellness Provider',
          serviceCategories: ['Short Term', 'Oral Services', 'Wellness'],
          basePrice: 150,
          availability: ['Weekdays', 'Evenings', 'Weekends'],
          discretion: 'Maximum',
          verificationStatus: 'Verified',
          specializations: ['GFE', 'Adult Wellness', 'Cultural Services', 'Stress Relief']
        }
  },
  {
    username: 'ama_ghana',
    email: 'ama.sarpong@ghana.com',
    password: 'AmaPass123!',
    phone: '233277890123',
    country: 'Ghana',
    city: 'Tema',
    verification_tier: 2,
            profile_data: {
          firstName: 'Ama',
          lastName: 'Sarpong',
          age: 26,
          gender: 'Female',
          bio: 'Professional escort and fitness companion in Tema. Offering intimate services, fitness coaching, and wellness experiences. Specializing in energetic adult entertainment with a focus on health and vitality.',
          interests: ['Intimate Escort Services', 'Fitness Companionship', 'Wellness Coaching', 'Sports Entertainment'],
          languages: ['English', 'Twi', 'Ga'],
          education: 'University of Ghana - Sports Science',
          occupation: 'Professional Escort & Fitness Companion',
          serviceCategories: ['Short Term', 'Oral Services', 'Fitness'],
          basePrice: 220,
          availability: ['Weekends', 'Mornings', 'Evenings'],
          discretion: 'Maximum',
          verificationStatus: 'Verified',
          specializations: ['GFE', 'Fitness Companion', 'Wellness Coaching', 'Sports Entertainment']
        }
  },
  
  // Nigeria Users
  {
    username: 'chioma_nigeria',
    email: 'chioma.okechukwu@nigeria.com',
    password: 'ChiomaPass123!',
    phone: '2348012345678',
    country: 'Nigeria',
    city: 'Lagos',
    verification_tier: 3,
            profile_data: {
          firstName: 'Chioma',
          lastName: 'Okechukwu',
          age: 27,
          gender: 'Female',
          bio: 'Premium escort and companion in Lagos. Offering exclusive intimate services, beauty treatments, and luxury companionship. Specializing in high-end adult entertainment with Nigerian elegance and maximum discretion.',
          interests: ['Premium Escort Services', 'Luxury Companionship', 'Beauty Treatments', 'Fashion Entertainment'],
          languages: ['English', 'Igbo', 'Yoruba'],
          education: 'Lagos Beauty Academy',
          occupation: 'Premium Escort & Luxury Companion',
          serviceCategories: ['Long Term', 'Special Services', 'Premium'],
          basePrice: 400,
          availability: ['Weekends', 'Evenings', '24/7'],
          discretion: 'Maximum',
          verificationStatus: 'Verified',
          specializations: ['PSE', 'Luxury Companion', 'Beauty Services', 'Fashion Entertainment']
        }
  },
  {
    username: 'adebayo_nigeria',
    email: 'adebayo.adeyemi@nigeria.com',
    password: 'AdebayoPass123!',
    phone: '2348023456789',
    country: 'Nigeria',
    city: 'Abuja',
    verification_tier: 3,
            profile_data: {
          firstName: 'Adebayo',
          lastName: 'Adeyemi',
          age: 31,
          gender: 'Male',
          bio: 'Professional male escort and masseur in Abuja. Offering intimate companionship, therapeutic massage, and relaxation services. Specializing in discreet adult entertainment and stress relief with maximum discretion.',
          interests: ['Intimate Companionship', 'Therapeutic Massage', 'Stress Relief', 'Travel Companion'],
          languages: ['English', 'Yoruba', 'Hausa'],
          education: 'University of Lagos - Massage Therapy',
          occupation: 'Professional Male Escort & Masseur',
          serviceCategories: ['Long Term', 'Oral Services', 'Massage'],
          basePrice: 250,
          availability: ['Weekends', 'Evenings', 'Late Night'],
          discretion: 'Maximum',
          verificationStatus: 'Verified',
          specializations: ['GFE', 'Therapeutic Massage', 'Stress Relief', 'Travel Companion']
        }
  },
  {
    username: 'fatima_nigeria',
    email: 'fatima.hassan@nigeria.com',
    password: 'FatimaPass123!',
    phone: '2348034567890',
    country: 'Nigeria',
    city: 'Kano',
    verification_tier: 2,
            profile_data: {
          firstName: 'Fatima',
          lastName: 'Hassan',
          age: 33,
          gender: 'Female',
          bio: 'Professional escort and wellness provider in Kano. Offering intimate services, wellness treatments, and cultural experiences with maximum discretion. Specializing in discreet adult entertainment with cultural sensitivity.',
          interests: ['Intimate Escort Services', 'Wellness Treatments', 'Cultural Services', 'Travel Companion'],
          languages: ['English', 'Hausa', 'Arabic'],
          education: 'Kano Culinary Institute',
          occupation: 'Professional Escort & Wellness Provider',
          serviceCategories: ['Short Term', 'Oral Services', 'Wellness'],
          basePrice: 200,
          availability: ['Weekdays', 'Afternoons', 'Weekends'],
          discretion: 'Maximum',
          verificationStatus: 'Verified',
          specializations: ['GFE', 'Wellness Services', 'Cultural Experiences', 'Travel Companion']
        }
  },
  {
    username: 'emeka_nigeria',
    email: 'emeka.uzoma@nigeria.com',
    password: 'EmekaPass123!',
    phone: '2348045678901',
    country: 'Nigeria',
    city: 'Port Harcourt',
    verification_tier: 3,
            profile_data: {
          firstName: 'Emeka',
          lastName: 'Uzoma',
          age: 34,
          gender: 'Male',
          bio: 'Professional male escort and business companion in Port Harcourt. Offering intimate services, business networking, and travel companionship. Specializing in discreet adult entertainment for business professionals with maximum discretion.',
          interests: ['Intimate Escort Services', 'Business Companionship', 'Networking Services', 'Travel Companion'],
          languages: ['English', 'Igbo', 'Pidgin'],
          education: 'University of Port Harcourt',
          occupation: 'Professional Male Escort & Business Companion',
          serviceCategories: ['Long Term', 'Special Services', 'Business'],
          basePrice: 300,
          availability: ['Weekends', 'Business Hours', 'Travel'],
          discretion: 'Maximum',
          verificationStatus: 'Verified',
          specializations: ['GFE', 'Business Companion', 'Networking Services', 'Travel Companion']
        }
  },
  {
    username: 'blessing_nigeria',
    email: 'blessing.ogunleye@nigeria.com',
    password: 'BlessingPass123!',
    phone: '2348056789012',
    country: 'Nigeria',
    city: 'Ibadan',
    verification_tier: 2,
            profile_data: {
          firstName: 'Blessing',
          lastName: 'Ogunleye',
          age: 28,
          gender: 'Female',
          bio: 'Professional escort and cultural companion in Ibadan. Offering intimate services, cultural experiences, and educational companionship. Specializing in discreet adult entertainment with cultural enrichment and maximum discretion.',
          interests: ['Intimate Escort Services', 'Cultural Companionship', 'Educational Services', 'Travel Companion'],
          languages: ['English', 'Yoruba', 'French'],
          education: 'University of Ibadan',
          occupation: 'Professional Escort & Cultural Companion',
          serviceCategories: ['Short Term', 'Oral Services', 'Cultural'],
          basePrice: 200,
          availability: ['Weekends', 'Afternoons', 'Evenings'],
          discretion: 'Maximum',
          verificationStatus: 'Verified',
          specializations: ['GFE', 'Cultural Companion', 'Educational Services', 'Travel Companion']
        }
  }
];

async function createTestUsers() {
  console.log('🚀 Creating test users...\n');
  
  try {
    for (const user of testUsers) {
      console.log(`👤 Creating user: ${user.username}`);
      
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(user.password, 12);
      
      const result = await pool.query(`
        INSERT INTO users (username, email, password_hash, phone, verification_tier, profile_data)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, username
      `, [
        user.username,
        user.email,
        passwordHash,
        user.phone,
        user.verification_tier,
        JSON.stringify(user.profile_data)
      ]);
      
      console.log(`   ✅ Created: ${result.rows[0].username} (ID: ${result.rows[0].id})`);
    }
    
    console.log('\n🎉 Test users created successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  createTestUsers();
}
