/**
 * Check verification tier distribution
 */
const { query } = require('./config/database');

async function checkVerificationTiers() {
  try {
    // Check distribution before verification filter
    const allProviders = await query(`
      SELECT 
        verification_tier,
        COUNT(*) as count
      FROM users 
      WHERE profile_data->>'accountType' = 'provider'
      GROUP BY verification_tier
      ORDER BY verification_tier
    `);

    console.log('\n📊 All Providers by Verification Tier:\n');
    allProviders.rows.forEach(row => {
      const tier = row.verification_tier ?? 'NULL';
      const status = tier >= 1 ? '✅ Visible' : '❌ Hidden';
      console.log(`  Tier ${tier}: ${row.count} providers ${status}`);
    });

    // Check verified only
    const verifiedCount = await query(`
      SELECT COUNT(*) 
      FROM users 
      WHERE profile_data->>'accountType' = 'provider'
      AND verification_tier >= 1
    `);

    const unverifiedCount = await query(`
      SELECT COUNT(*) 
      FROM users 
      WHERE profile_data->>'accountType' = 'provider'
      AND (verification_tier IS NULL OR verification_tier < 1)
    `);

    console.log('\n📋 Summary:');
    console.log(`  ✅ Verified providers (tier >= 1): ${verifiedCount.rows[0].count} - VISIBLE in marketplace`);
    console.log(`  ❌ Unverified providers (tier < 1): ${unverifiedCount.rows[0].count} - HIDDEN from marketplace`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkVerificationTiers();
