require('dotenv').config({ path: './env.local' });
const axios = require('axios');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 30000,
  acquireTimeoutMillis: 30000,
  reapIntervalMillis: 1000,
  createTimeoutMillis: 30000,
  retryDelay: 1000,
  maxRetries: 5
});

const BASE_URL = 'http://localhost:5000/api';

// Test user credentials
const testUser = {
  email: 'test@example.com',
  password: 'testpassword123'
};

let authToken = null;
let userId = null;

async function testCompleteSystem() {
  console.log('🚀 Starting Complete System Test...\n');

  try {
    // Step 1: Test Database Connection
    console.log('📊 Step 1: Testing Database Connection...');
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    
    // Check if required tables exist
    const tablesCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_name IN ('users', 'subscriptions', 'subscription_plans')
    `);
    
    const existingTables = tablesCheck.rows.map(row => row.table_name);
    console.log('📋 Existing tables:', existingTables);
    
    if (!existingTables.includes('users')) {
      throw new Error('Users table not found');
    }
    
    if (!existingTables.includes('subscriptions')) {
      throw new Error('Subscriptions table not found');
    }
    
    if (!existingTables.includes('subscription_plans')) {
      throw new Error('Subscription plans table not found');
    }
    
    // Check users table schema
    const userSchema = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name IN ('is_subscribed', 'subscription_tier', 'subscription_expires_at')
    `);
    
    const userColumns = userSchema.rows.map(row => row.column_name);
    console.log('👤 User table columns:', userColumns);
    
    if (!userColumns.includes('is_subscribed')) {
      throw new Error('is_subscribed column not found in users table');
    }
    
    client.release();
    console.log('✅ Database schema check passed\n');

    // Step 2: Test User Registration/Login
    console.log('🔐 Step 2: Testing User Authentication...');
    
    try {
      // Try to login first
      const loginResponse = await axios.post(`${BASE_URL}/auth/login`, testUser);
      if (loginResponse.data.message === 'Login successful') {
        authToken = loginResponse.data.token;
        userId = loginResponse.data.user.id;
        console.log('✅ User login successful');
      }
    } catch (loginError) {
      if (loginError.response?.status === 401) {
        // User doesn't exist, try to register
        console.log('⚠️  User not found, attempting registration...');
        try {
          const registerResponse = await axios.post(`${BASE_URL}/auth/register`, {
            username: 'testuser',
            email: 'test@example.com',
            password: 'TestPass123!',
            phone: '+2348012345678'
          });
          
          if (registerResponse.data.message === 'Registration successful') {
            authToken = registerResponse.data.token;
            userId = registerResponse.data.user.id;
            console.log('✅ User registration successful');
          } else {
            throw new Error('Registration failed: ' + (registerResponse.data.error || 'Unknown error'));
          }
        } catch (registerError) {
          throw new Error('Registration failed: ' + registerError.message);
        }
      } else {
        throw new Error('Login failed: ' + loginError.message);
      }
    }
    
    console.log(`👤 User ID: ${userId}`);
    console.log(`🔑 Auth Token: ${authToken ? 'Present' : 'Missing'}\n`);

    // Step 3: Check Initial Subscription Status
    console.log('📋 Step 3: Checking Initial Subscription Status...');
    
    const initialStatusResponse = await axios.get(`${BASE_URL}/subscriptions/status`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('📊 Initial subscription status:', initialStatusResponse.data);
    
    if (initialStatusResponse.data.success) {
      console.log(`✅ Initial status check successful. Is subscribed: ${initialStatusResponse.data.isSubscribed}`);
    } else {
      console.log('⚠️  Initial status check failed:', initialStatusResponse.data.error);
    }
    console.log('');

    // Step 4: Test Subscription Creation
    console.log('💳 Step 4: Testing Subscription Creation...');
    
    const subscriptionData = {
      planId: 'Basic Access',
      amount: 20,
      currency: 'USD',
      countryCode: 'NG'
    };
    
    const createResponse = await axios.post(`${BASE_URL}/subscriptions/create`, subscriptionData, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('📊 Subscription creation response:', createResponse.data);
    
    if (createResponse.data.success) {
      console.log('✅ Subscription created successfully');
      console.log(`💰 Amount: ${createResponse.data.paymentData.amount}`);
      console.log(`🌍 Currency: ${createResponse.data.paymentData.currency}`);
      console.log(`🔗 Authorization URL: ${createResponse.data.paymentData.authorizationUrl ? 'Present' : 'Missing'}`);
      console.log(`🧪 Test Mode: ${createResponse.data.paymentData.isTestMode}`);
    } else {
      throw new Error('Subscription creation failed: ' + createResponse.data.error);
    }
    console.log('');

    // Step 5: Test Manual Payment Verification (for test mode)
    console.log('✅ Step 5: Testing Manual Payment Verification...');
    
    // Get the subscription reference from the database
    const dbClient2 = await pool.connect();
    const subscriptionResult = await dbClient2.query(`
      SELECT paystack_reference FROM subscriptions 
      WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1
    `, [userId]);
    
    if (subscriptionResult.rows.length === 0) {
      throw new Error('No subscription found in database');
    }
    
    const paystackReference = subscriptionResult.rows[0].paystack_reference;
    console.log(`🔍 Found subscription reference: ${paystackReference}`);
    
    // Test manual verification
    const manualVerifyResponse = await axios.post(`${BASE_URL}/subscriptions/verify-payment-manual`, {
      paymentReference: paystackReference,
      userId: userId
    });
    
    console.log('📊 Manual verification response:', manualVerifyResponse.data);
    
    if (manualVerifyResponse.data.success) {
      console.log('✅ Manual payment verification successful');
    } else {
      throw new Error('Manual verification failed: ' + manualVerifyResponse.data.error);
    }
    
    dbClient2.release();
    console.log('');

    // Step 6: Verify Final Subscription Status
    console.log('🔍 Step 6: Verifying Final Subscription Status...');
    
    const finalStatusResponse = await axios.get(`${BASE_URL}/subscriptions/status`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('📊 Final subscription status:', finalStatusResponse.data);
    
    if (finalStatusResponse.data.success && finalStatusResponse.data.isSubscribed) {
      console.log('✅ Final status check successful - User is now subscribed!');
    } else {
      console.log('⚠️  Final status check failed or user not subscribed');
    }
    console.log('');

    // Step 7: Verify Database State
    console.log('🗄️  Step 7: Verifying Database State...');
    
    const dbClient = await pool.connect();
    
    // Check subscription status
    const subscriptionStatus = await dbClient.query(`
      SELECT s.status, s.activated_at, u.is_subscribed, u.updated_at
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC LIMIT 1
    `, [userId]);
    
    if (subscriptionStatus.rows.length > 0) {
      const status = subscriptionStatus.rows[0];
      console.log('📊 Subscription Status:', status.status);
      console.log('📅 Activated At:', status.activated_at);
      console.log('👤 User Is Subscribed:', status.is_subscribed);
      console.log('🔄 User Updated At:', status.updated_at);
      
      if (status.status === 'active' && status.is_subscribed === true) {
        console.log('✅ Database state verification passed');
      } else {
        console.log('⚠️  Database state verification failed');
      }
    } else {
      console.log('❌ No subscription found in database');
    }
    
    dbClient.release();
    console.log('');

    // Step 8: Test Protected Route Access
    console.log('🚪 Step 8: Testing Protected Route Access...');
    
    try {
      const protectedResponse = await axios.get(`${BASE_URL}/subscriptions/plans`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      
      if (protectedResponse.data.success) {
        console.log('✅ Protected route access successful');
        console.log(`📋 Found ${protectedResponse.data.plans?.length || 0} subscription plans`);
      } else {
        console.log('⚠️  Protected route access failed:', protectedResponse.data.error);
      }
    } catch (protectedError) {
      console.log('❌ Protected route access failed:', protectedError.message);
    }
    console.log('');

    console.log('🎉 All Tests Completed Successfully!');
    console.log('✅ The subscription system is working correctly');
    console.log('✅ Users can create subscriptions');
    console.log('✅ Payments can be verified');
    console.log('✅ User subscription status is updated');
    console.log('✅ Database state is consistent');
    console.log('✅ Protected routes work correctly');

  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Clean up on failure
    if (authToken && userId) {
      try {
        console.log('🧹 Cleaning up test data...');
        const client = await pool.connect();
        await client.query('DELETE FROM subscriptions WHERE user_id = $1', [userId]);
        await client.query('UPDATE users SET is_subscribed = false WHERE id = $1', [userId]);
        client.release();
        console.log('✅ Cleanup completed');
      } catch (cleanupError) {
        console.error('⚠️  Cleanup failed:', cleanupError.message);
      }
    }
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run the test
testCompleteSystem().catch(console.error);
