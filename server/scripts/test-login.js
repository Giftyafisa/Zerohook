/**
 * Test Login Script
 * Verifies login credentials and password hashing
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI;

const userSchema = new mongoose.Schema({
  username: String,
  email: String,
  password_hash: String,
  profile_data: mongoose.Schema.Types.Mixed
}, { collection: 'users', strict: false });

const User = mongoose.model('User', userSchema);

async function testLogin() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected\n');

    // Test password: test123
    const testPassword = 'test123';
    
    // Get one of the seeded users
    const testUser = await User.findOne({ username: 'david_mwangi1' });
    
    if (!testUser) {
      console.log('❌ Test user not found!');
      
      // List all users
      const allUsers = await User.find({}).select('username email password_hash').limit(5);
      console.log('\n📋 First 5 users in database:');
      allUsers.forEach(u => {
        console.log(`   ${u.username} - ${u.email}`);
        console.log(`   Hash: ${u.password_hash?.substring(0, 20)}...`);
      });
      
      process.exit(1);
    }

    console.log(`🧪 Testing login for: ${testUser.username}`);
    console.log(`📧 Email: ${testUser.email}`);
    console.log(`🔑 Password: ${testPassword}`);
    console.log(`#️⃣ Hash: ${testUser.password_hash}\n`);

    // Test if password matches
    const isMatch = await bcrypt.compare(testPassword, testUser.password_hash);
    
    if (isMatch) {
      console.log('✅ PASSWORD MATCHES! Login should work.');
    } else {
      console.log('❌ PASSWORD DOES NOT MATCH!');
      console.log('\n🔧 Generating correct hash for "test123"...');
      const correctHash = await bcrypt.hash('test123', 12);
      console.log(`Correct hash: ${correctHash}`);
      
      console.log('\n🔄 Updating all provider passwords...');
      await User.updateMany(
        { username: { $regex: /_(mwangi|banda|kamau|adeyemi|mensah|agyemang|okoro|nwosu|okonkwo)\d+$/ } },
        { $set: { password_hash: correctHash } }
      );
      console.log('✅ Passwords updated!');
      
      // Test again
      const updatedUser = await User.findOne({ username: 'david_mwangi1' });
      const retestMatch = await bcrypt.compare('test123', updatedUser.password_hash);
      console.log(`\n🧪 Retest: ${retestMatch ? '✅ NOW WORKING!' : '❌ Still broken'}`);
    }

    // Show login instructions
    console.log('\n' + '='.repeat(60));
    console.log('📋 LOGIN CREDENTIALS:');
    console.log('='.repeat(60));
    console.log('Email: david_mwangi1@example.com');
    console.log('Password: test123');
    console.log('='.repeat(60));

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testLogin();
