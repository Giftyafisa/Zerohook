#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Starting African Country-Specific Payment System...\n');

try {
  // Check if we're in the server directory
  if (!process.cwd().endsWith('server')) {
    console.log('📁 Changing to server directory...');
    process.chdir(path.join(process.cwd(), 'server'));
  }

  // Install dependencies if needed
  console.log('📦 Checking dependencies...');
  try {
    require.resolve('axios');
    console.log('✅ Dependencies already installed');
  } catch (error) {
    console.log('📥 Installing dependencies...');
    execSync('npm install axios', { stdio: 'inherit' });
  }

  // Setup database
  console.log('\n🗄️  Setting up database...');
  try {
    execSync('node setup-database.js', { stdio: 'inherit' });
  } catch (error) {
    console.log('⚠️  Database setup failed, continuing...');
  }

  // Start the server
  console.log('\n🌐 Starting server...');
  console.log('   The system will be available at: http://localhost:5000');
  console.log('   API endpoints: http://localhost:5000/api');
  console.log('   Health check: http://localhost:5000/api/health');
  console.log('\n📱 Available features:');
  console.log('   🌍 10 African countries supported');
  console.log('   💳 Paystack integration');
  console.log('   🪙 Crypto payments (Coinbase, Binance, Luno)');
  console.log('   🇬🇭 Ghanaian Bitnob platform');
  console.log('   🏦 Local bank integration');
  console.log('   📱 Mobile money support');
  console.log('\n🔧 To test the system, run: node test-african-system.js');
  console.log('🔧 To stop the server, press Ctrl+C');
  
  execSync('node index.js', { stdio: 'inherit' });

} catch (error) {
  console.error('❌ Failed to start system:', error.message);
  process.exit(1);
}
