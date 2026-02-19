/**
 * Fetch the most recently registered user
 */

const { query } = require('./config/database');

async function fetchLatestUser() {
  try {
    console.log('🔍 Fetching latest registered user...\n');
    
    const result = await query(`
      SELECT 
        id,
        username,
        email,
        verification_tier,
        profile_data,
        created_at
      FROM users
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No users found in database');
      return;
    }
    
    const user = result.rows[0];
    const profileData = user.profile_data || {};
    
    console.log('=' .repeat(80));
    console.log('👤 LATEST REGISTERED USER');
    console.log('=' .repeat(80));
    console.log(`\n📋 Account Details:`);
    console.log(`   ID:                  ${user.id}`);
    console.log(`   Username:            ${user.username}`);
    console.log(`   Email:               ${user.email}`);
    console.log(`   Verification Tier:   ${user.verification_tier || 'Unverified'}`);
    console.log(`   Registered:          ${user.created_at}`);
    
    console.log(`\n👤 Profile Information:`);
    console.log(`   First Name:          ${profileData.firstName || 'Not set'}`);
    console.log(`   Last Name:           ${profileData.lastName || 'Not set'}`);
    console.log(`   Age:                 ${profileData.age || 'Not set'}`);
    console.log(`   Gender:              ${profileData.gender || 'Not set'}`);
    console.log(`   Bio:                 ${profileData.bio || 'Not set'}`);
    
    if (profileData.location) {
      console.log(`\n📍 Location:`);
      console.log(`   City:                ${profileData.location.city || 'Not set'}`);
      console.log(`   Country:             ${profileData.location.country || 'Not set'}`);
      if (profileData.location.coordinates) {
        console.log(`   Coordinates:         ${profileData.location.coordinates.lat}, ${profileData.location.coordinates.lng}`);
      }
    }
    
    if (profileData.basePrice) {
      console.log(`\n💰 Service Provider Details:`);
      console.log(`   Base Price:          ${profileData.basePrice} ${profileData.currency || 'GHS'}`);
      console.log(`   Availability:        ${profileData.availability?.length || 0} time slots`);
      console.log(`   Specializations:     ${profileData.specializations?.join(', ') || 'None'}`);
      console.log(`   Languages:           ${profileData.languages?.join(', ') || 'None'}`);
    }
    
    console.log('\n' + '=' .repeat(80));
    console.log('✅ Fetch complete\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fetchLatestUser();
