/**
 * Fix existing users to have accountType field
 */

const { query } = require('../config/database');

async function fix() {
  try {
    console.log('🔧 Updating existing providers to have accountType...');
    
    // Update all users that look like providers to have accountType
    const result = await query(`
      UPDATE users 
      SET profile_data = profile_data || '{"accountType": "provider"}'::jsonb
      WHERE profile_data IS NOT NULL
      AND profile_data->>'accountType' IS NULL
      AND (
        profile_data ? 'basePrice' OR
        profile_data ? 'serviceCategories' OR
        profile_data ? 'specializations'
      )
    `);
    console.log('✅ Updated', result.rowCount, 'users to have accountType: provider');
    
    // Count providers
    const count = await query(`SELECT COUNT(*) FROM users WHERE profile_data->>'accountType' = 'provider'`);
    console.log('📊 Total providers now:', count.rows[0].count);
    
    // Show sample
    const sample = await query(`
      SELECT username, profile_data->'location'->>'city' as city, profile_data->>'accountType' as type
      FROM users 
      WHERE profile_data->>'accountType' = 'provider'
      LIMIT 5
    `);
    console.log('\n📋 Sample providers:');
    sample.rows.forEach(r => console.log(`   ${r.username} - ${r.city} - ${r.type}`));
    
    process.exit(0);
  } catch(e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

fix();
