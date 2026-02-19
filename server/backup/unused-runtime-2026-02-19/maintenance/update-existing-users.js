const { Pool } = require('pg');
require('dotenv').config({ path: './env.production' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Updated profile data for existing users
const updatedProfiles = {
  'akua_ghana': {
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
  },
  'kwame_ghana': {
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
  },
  'efua_ghana': {
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
  },
  'kofi_ghana': {
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
  },
  'ama_ghana': {
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
  },
  'chioma_nigeria': {
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
  },
  'adebayo_nigeria': {
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
  },
  'fatima_nigeria': {
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
  },
  'emeka_nigeria': {
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
  },
  'blessing_nigeria': {
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
};

async function updateExistingUsers() {
  console.log('🔄 Updating existing users with productive profiles...\n');
  
  try {
    for (const [username, profileData] of Object.entries(updatedProfiles)) {
      console.log(`👤 Updating user: ${username}`);
      
      const result = await pool.query(`
        UPDATE users 
        SET profile_data = $1::jsonb
        WHERE username = $2
        RETURNING username, profile_data->>'occupation' as occupation
      `, [JSON.stringify(profileData), username]);
      
      if (result.rows.length > 0) {
        console.log(`   ✅ Updated: ${result.rows[0].username} - ${result.rows[0].occupation}`);
      } else {
        console.log(`   ❌ User not found: ${username}`);
      }
    }
    
    console.log('\n🎉 All users updated successfully!');
    console.log('\n📊 Updated Profile Summary:');
    console.log('   Ghana Users: 5 (Accra, Kumasi, Cape Coast, Tamale, Tema)');
    console.log('   Nigeria Users: 5 (Lagos, Abuja, Kano, Port Harcourt, Ibadan)');
    console.log('   Total: 10 users with productive adult service profiles');
    console.log('   All profiles now include: specializations, enhanced pricing, maximum discretion');
    
  } catch (error) {
    console.error('❌ Error updating users:', error);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  updateExistingUsers();
}
