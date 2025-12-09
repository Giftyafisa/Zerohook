const { query } = require('./config/database');

async function listUsers() {
  try {
    console.log('=== USER LIST (EMAILS ONLY) ===\n');
    
    const result = await query(`
      SELECT 
        id,
        username,
        email,
        is_subscribed,
        subscription_tier,
        verification_tier,
        created_at
      FROM users
      ORDER BY created_at DESC
    `);
    
    console.log(`Total users found: ${result.rowCount}\n`);
    
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Subscribed: ${user.is_subscribed ? 'Yes' : 'No'} (${user.subscription_tier || 'none'})`);
      console.log(`   Verification: Tier ${user.verification_tier}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
      console.log('');
    });
    
    console.log('\n⚠️  NOTE: Passwords are NOT shown for security reasons.');
    console.log('Passwords are hashed using bcrypt and cannot be retrieved.\n');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

listUsers();
