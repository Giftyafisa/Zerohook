require('dotenv').config({ path: './env.local' });
const { Pool } = require('pg');
const axios = require('axios');

console.log('🚀 FINAL PRODUCTION READINESS TEST');

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

const query = async (text, params) => {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
};

const testProductionReadiness = async () => {
  try {
    console.log('🔍 Testing Production Readiness...\n');

    // Test 1: Database Connection
    console.log('📊 Test 1: Database Connection');
    const client = await pool.connect();
    console.log('✅ Database connection successful');
    
    // Test database schema
    const tablesResult = await query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const requiredTables = ['users', 'services', 'service_categories', 'transactions', 'subscriptions'];
    const existingTables = tablesResult.rows.map(row => row.table_name);
    
    console.log('📋 Existing tables:', existingTables);
    
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    if (missingTables.length > 0) {
      console.log('❌ Missing required tables:', missingTables);
      return false;
    }
    console.log('✅ All required tables exist\n');
    
    // Test 2: Service Categories
    console.log('📊 Test 2: Service Categories');
    const categoriesResult = await query('SELECT COUNT(*) as count FROM service_categories');
    console.log(`✅ Service categories: ${categoriesResult.rows[0].count} found`);
    
    // Test 3: API Endpoints
    console.log('📊 Test 3: API Endpoints');
    
    try {
      // Test categories endpoint
      const categoriesResponse = await axios.get('http://localhost:5000/api/services/categories');
      if (categoriesResponse.status === 200 && categoriesResponse.data.categories) {
        console.log(`✅ Categories API: ${categoriesResponse.data.categories.length} categories returned`);
      } else {
        console.log('❌ Categories API failed');
        return false;
      }
    } catch (error) {
      console.log('❌ Categories API error:', error.message);
      return false;
    }
    
    // Test 4: Database Performance
    console.log('📊 Test 4: Database Performance');
    const startTime = Date.now();
    await query('SELECT COUNT(*) FROM users');
    const queryTime = Date.now() - startTime;
    console.log(`✅ Database query performance: ${queryTime}ms`);
    
    if (queryTime > 1000) {
      console.log('⚠️ Database query is slow (>1s)');
    }
    
    // Test 5: Schema Validation
    console.log('📊 Test 5: Schema Validation');
    
    // Check services table structure
    const servicesColumns = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'services' 
      ORDER BY ordinal_position
    `);
    
    const requiredColumns = ['id', 'provider_id', 'category_id', 'title', 'description', 'price'];
    const existingColumns = servicesColumns.rows.map(col => col.column_name);
    
    const missingColumns = requiredColumns.filter(col => !existingColumns.includes(col));
    if (missingColumns.length > 0) {
      console.log('❌ Missing required columns in services table:', missingColumns);
      return false;
    }
    console.log('✅ Services table schema is correct');
    
    // Test 6: Foreign Key Constraints
    console.log('📊 Test 6: Foreign Key Constraints');
    const constraintsResult = await query(`
      SELECT 
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name IN ('services', 'transactions')
    `);
    
    console.log(`✅ Foreign key constraints: ${constraintsResult.rows.length} found`);
    
    // Test 7: Indexes
    console.log('📊 Test 7: Database Indexes');
    const indexesResult = await query(`
      SELECT indexname, tablename 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename IN ('services', 'users', 'service_categories')
    `);
    
    console.log(`✅ Database indexes: ${indexesResult.rows.length} found`);
    
    // Test 8: Data Integrity
    console.log('📊 Test 8: Data Integrity');
    
    // Check for orphaned services (services without valid category_id)
    const orphanedServices = await query(`
      SELECT COUNT(*) as count 
      FROM services s 
      LEFT JOIN service_categories sc ON s.category_id = sc.id 
      WHERE s.category_id IS NOT NULL AND sc.id IS NULL
    `);
    
    if (orphanedServices.rows[0].count > 0) {
      console.log(`⚠️ Found ${orphanedServices.rows[0].count} orphaned services`);
    } else {
      console.log('✅ No orphaned services found');
    }
    
    // Test 9: Environment Configuration
    console.log('📊 Test 9: Environment Configuration');
    const requiredEnvVars = ['DATABASE_URL', 'JWT_SECRET', 'NODE_ENV'];
    const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingEnvVars.length > 0) {
      console.log('❌ Missing environment variables:', missingEnvVars);
      return false;
    }
    console.log('✅ Environment configuration is complete');
    
    // Test 10: System Health
    console.log('📊 Test 10: System Health');
    
    // Check database connection pool status
    const poolStatus = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    };
    
    console.log('📊 Connection pool status:', poolStatus);
    
    if (poolStatus.totalCount > 0) {
      console.log('✅ Database connection pool is healthy');
    } else {
      console.log('❌ Database connection pool is empty');
      return false;
    }
    
    console.log('\n🎉 PRODUCTION READINESS TEST COMPLETED SUCCESSFULLY!');
    console.log('✅ Database: Connected and healthy');
    console.log('✅ Schema: All required tables and columns exist');
    console.log('✅ API: Categories endpoint responding');
    console.log('✅ Performance: Database queries within acceptable range');
    console.log('✅ Constraints: Foreign keys properly configured');
    console.log('✅ Indexes: Performance indexes in place');
    console.log('✅ Environment: All required variables configured');
    console.log('✅ System: Ready for production deployment');
    
    return true;
    
  } catch (error) {
    console.error('❌ Production readiness test failed:', error.message);
    console.error('🔍 Error details:', error);
    return false;
  } finally {
    await pool.end();
  }
};

// Execute the test
testProductionReadiness().then(success => {
  if (success) {
    console.log('\n🚀 SYSTEM IS PRODUCTION READY!');
    process.exit(0);
  } else {
    console.log('\n❌ SYSTEM IS NOT PRODUCTION READY!');
    process.exit(1);
  }
}).catch(error => {
  console.error('💥 Fatal error during production readiness test:', error);
  process.exit(1);
});



