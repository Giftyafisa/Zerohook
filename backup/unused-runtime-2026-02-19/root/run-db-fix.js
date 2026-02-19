const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: './env.production' });

console.log('🚀 Starting database fix process...');
console.log('📁 Current directory:', process.cwd());
console.log('🔧 Environment:', process.env.NODE_ENV);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runDatabaseFix() {
  let client;
  
  try {
    console.log('📡 Connecting to database...');
    client = await pool.connect();
    console.log('✅ Database connection established');
    
    console.log('📖 Reading SQL file...');
    const sqlContent = fs.readFileSync('./fix-database.sql', 'utf8');
    console.log('📄 SQL file loaded, length:', sqlContent.length);
    
    // Split by semicolon and execute each statement
    const statements = sqlContent.split(';').filter(stmt => stmt.trim());
    console.log(`🔍 Found ${statements.length} SQL statements to execute`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          console.log(`\n📝 Executing statement ${i + 1}/${statements.length}...`);
          console.log(`📋 Statement: ${statement.substring(0, 100)}...`);
          
          const result = await client.query(statement);
          console.log(`✅ Statement ${i + 1} executed successfully`);
          if (result.rows && result.rows.length > 0) {
            console.log(`📊 Result:`, result.rows[0]);
          }
        } catch (error) {
          console.log(`⚠️ Statement ${i + 1} had an issue:`, error.message);
          console.log(`🔍 Error details:`, error);
        }
      }
    }
    
    console.log('\n🎉 Database schema fixes completed!');
    
  } catch (error) {
    console.error('❌ Error running database fixes:', error);
    console.error('🔍 Full error:', error);
    throw error;
  } finally {
    if (client) {
      client.release();
      console.log('🔌 Database client released');
    }
    await pool.end();
    console.log('🔌 Database pool closed');
  }
}

console.log('🚀 Starting database fix execution...');

runDatabaseFix()
  .then(() => {
    console.log('🎉 Database fix script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Database fix script failed:', error);
    process.exit(1);
  });
