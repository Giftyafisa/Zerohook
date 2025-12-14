/**
 * Migration: Add User Identification System
 * 
 * This migration adds support for:
 * 1. Expanded account types: client, provider, sugar_daddy, sugar_mommy
 * 2. New profile fields: gender, dateOfBirth, faceVerification
 * 3. Sugar access payments table (separate from subscription)
 * 4. Sugar privacy settings (visibleToProviders)
 * 5. Connection expiration tracking for sugar connections
 * 
 * Account Type Access Rules:
 * - client: Can see and book providers
 * - provider: Can offer services, can pay to see sugar profiles
 * - sugar_daddy: VVIP, private by default, sees young female providers
 * - sugar_mommy: VVIP, private by default, sees young male providers
 */

const { query } = require('../config/database');

async function runMigration(dryRun = false) {
  console.log('🚀 Starting User Identification System Migration...');
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);

  try {
    // ========================================
    // 1. Create sugar_access_payments table
    // ========================================
    console.log('\n📋 Step 1: Creating sugar_access_payments table...');
    
    const createSugarAccessTable = `
      CREATE TABLE IF NOT EXISTS sugar_access_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        access_type VARCHAR(20) NOT NULL CHECK (access_type IN ('sugar_daddy', 'sugar_mommy', 'both')),
        amount DECIMAL(10,2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'NGN',
        payment_reference VARCHAR(255),
        payment_provider VARCHAR(50) DEFAULT 'paystack',
        payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
        access_starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        access_expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(provider_id, access_type, payment_status) -- Prevent duplicate active payments
      );

      -- Index for quick lookups
      CREATE INDEX IF NOT EXISTS idx_sugar_access_provider ON sugar_access_payments(provider_id);
      CREATE INDEX IF NOT EXISTS idx_sugar_access_status ON sugar_access_payments(payment_status);
      CREATE INDEX IF NOT EXISTS idx_sugar_access_expires ON sugar_access_payments(access_expires_at);
    `;

    if (!dryRun) {
      await query(createSugarAccessTable);
      console.log('   ✅ sugar_access_payments table created');
    } else {
      console.log('   [DRY RUN] Would create sugar_access_payments table');
    }

    // ========================================
    // 2. Create sugar_connections table
    // ========================================
    console.log('\n📋 Step 2: Creating sugar_connections table...');
    
    const createSugarConnectionsTable = `
      CREATE TABLE IF NOT EXISTS sugar_connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sugar_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        connection_status VARCHAR(20) DEFAULT 'active' CHECK (connection_status IN ('active', 'expired', 'blocked')),
        connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL, -- 1 year from connection
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sugar_user_id, provider_id) -- One connection per pair
      );

      -- Indexes for quick lookups
      CREATE INDEX IF NOT EXISTS idx_sugar_conn_sugar_user ON sugar_connections(sugar_user_id);
      CREATE INDEX IF NOT EXISTS idx_sugar_conn_provider ON sugar_connections(provider_id);
      CREATE INDEX IF NOT EXISTS idx_sugar_conn_expires ON sugar_connections(expires_at);
      CREATE INDEX IF NOT EXISTS idx_sugar_conn_status ON sugar_connections(connection_status);
    `;

    if (!dryRun) {
      await query(createSugarConnectionsTable);
      console.log('   ✅ sugar_connections table created');
    } else {
      console.log('   [DRY RUN] Would create sugar_connections table');
    }

    // ========================================
    // 3. Add profile_data field documentation
    // ========================================
    console.log('\n📋 Step 3: Profile data structure documentation...');
    console.log(`
   New profile_data fields:
   - accountType: 'client' | 'provider' | 'sugar_daddy' | 'sugar_mommy'
   - gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say'
   - dateOfBirth: 'YYYY-MM-DD' (ISO format)
   - faceVerification: {
       verified: boolean,
       verifiedAt: timestamp | null,
       verificationMethod: 'selfie' | 'video' | 'document' | null
     }
   - sugarSettings: { // Only for sugar_daddy/sugar_mommy
       visibleToProviders: boolean (default: false),
       preferredAgeRange: { min: number, max: number },
       preferredGender: 'male' | 'female' | 'any'
     }
    `);

    // ========================================
    // 4. Backfill existing users
    // ========================================
    console.log('\n📋 Step 4: Backfilling existing users...');
    
    // Get existing users count
    const userCount = await query('SELECT COUNT(*) as count FROM users');
    console.log(`   Found ${userCount.rows[0].count} existing users`);

    // Get current accountType distribution
    const accountTypeDistribution = await query(`
      SELECT 
        profile_data->>'accountType' as account_type,
        COUNT(*) as count
      FROM users
      GROUP BY profile_data->>'accountType'
    `);
    
    console.log('\n   Current accountType distribution:');
    accountTypeDistribution.rows.forEach(row => {
      console.log(`   - ${row.account_type || 'null'}: ${row.count}`);
    });

    // Backfill missing fields with defaults
    const backfillQuery = `
      UPDATE users
      SET profile_data = profile_data || jsonb_build_object(
        'gender', null,
        'dateOfBirth', null,
        'faceVerification', jsonb_build_object(
          'verified', false,
          'verifiedAt', null,
          'verificationMethod', null
        )
      )
      WHERE profile_data->>'gender' IS NULL
    `;

    if (!dryRun) {
      const backfillResult = await query(backfillQuery);
      console.log(`   ✅ Backfilled ${backfillResult.rowCount} users with default values`);
    } else {
      // Count how many would be affected
      const countQuery = await query("SELECT COUNT(*) as count FROM users WHERE profile_data->>'gender' IS NULL");
      console.log(`   [DRY RUN] Would backfill ${countQuery.rows[0].count} users`);
    }

    // ========================================
    // 5. Set accountType for null users
    // ========================================
    console.log('\n📋 Step 5: Setting accountType for users with null...');
    
    const setAccountTypeQuery = `
      UPDATE users
      SET profile_data = profile_data || '{"accountType": "client"}'::jsonb
      WHERE profile_data->>'accountType' IS NULL
    `;

    if (!dryRun) {
      const result = await query(setAccountTypeQuery);
      console.log(`   ✅ Set accountType to 'client' for ${result.rowCount} users`);
    } else {
      const countQuery = await query("SELECT COUNT(*) as count FROM users WHERE profile_data->>'accountType' IS NULL");
      console.log(`   [DRY RUN] Would set accountType for ${countQuery.rows[0].count} users`);
    }

    // ========================================
    // 6. Summary
    // ========================================
    console.log('\n✅ Migration completed successfully!');
    
    // Show final distribution
    const finalDistribution = await query(`
      SELECT 
        profile_data->>'accountType' as account_type,
        COUNT(*) as count
      FROM users
      GROUP BY profile_data->>'accountType'
      ORDER BY count DESC
    `);
    
    console.log('\n   Final accountType distribution:');
    finalDistribution.rows.forEach(row => {
      console.log(`   - ${row.account_type || 'null'}: ${row.count}`);
    });

    return { success: true };

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    return { success: false, error: error.message };
  }
}

// Run with: node migrations/add-user-identification-system.js [--dry-run]
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

runMigration(dryRun).then(result => {
  if (result.success) {
    console.log('\n🎉 Done!');
    process.exit(0);
  } else {
    process.exit(1);
  }
});

module.exports = { runMigration };
