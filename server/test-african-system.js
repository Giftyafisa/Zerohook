const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function testAfricanSystem() {
  console.log('🌍 Testing African Country-Specific Payment System\n');

  try {
    // Test 1: Get all supported countries
    console.log('1️⃣ Testing Countries API...');
    const countriesResponse = await axios.get(`${BASE_URL}/countries`);
    if (countriesResponse.data.success) {
      console.log(`✅ Found ${countriesResponse.data.countries.length} supported countries`);
      countriesResponse.data.countries.forEach(country => {
        console.log(`   ${country.flag} ${country.name} (${country.code}) - ${country.currency} ${country.currencySymbol}`);
      });
    } else {
      console.log('❌ Failed to get countries');
    }

    // Test 2: Get Ghanaian crypto platforms
    console.log('\n2️⃣ Testing Ghanaian Crypto Platforms...');
    const ghanaCryptoResponse = await axios.get(`${BASE_URL}/countries/ghana/crypto-platforms`);
    if (ghanaCryptoResponse.data.success) {
      console.log('✅ Ghanaian crypto platforms retrieved');
      ghanaCryptoResponse.data.cryptoPlatforms.forEach(platform => {
        console.log(`   ${platform.logo} ${platform.name} - ${platform.description}`);
      });
    } else {
      console.log('❌ Failed to get Ghanaian crypto platforms');
    }

    // Test 3: Get Bitnob features
    console.log('\n3️⃣ Testing Bitnob Features...');
    const bitnobFeaturesResponse = await axios.get(`${BASE_URL}/countries/ghana/bitnob/features`);
    if (bitnobFeaturesResponse.data.success) {
      console.log('✅ Bitnob features retrieved');
      console.log(`   Local Banks: ${bitnobFeaturesResponse.data.features.localBanks}`);
      console.log(`   Mobile Money: ${bitnobFeaturesResponse.data.features.mobileMoney}`);
      console.log(`   Crypto Payments: ${bitnobFeaturesResponse.data.features.cryptoPayments}`);
    } else {
      console.log('❌ Failed to get Bitnob features');
    }

    // Test 4: Get countries with mobile money
    console.log('\n4️⃣ Testing Countries by Feature...');
    const mobileMoneyResponse = await axios.get(`${BASE_URL}/countries/features/mobile_money`);
    if (mobileMoneyResponse.data.success) {
      console.log(`✅ Found ${mobileMoneyResponse.data.countries.length} countries with mobile money`);
      mobileMoneyResponse.data.countries.forEach(country => {
        console.log(`   ${country.flag} ${country.name} - ${country.currency}`);
      });
    } else {
      console.log('❌ Failed to get countries by feature');
    }

    // Test 5: Get payment methods for Nigeria
    console.log('\n5️⃣ Testing Country-Specific Payment Methods...');
    const nigeriaPaymentsResponse = await axios.get(`${BASE_URL}/countries/NG/payment-methods`);
    if (nigeriaPaymentsResponse.data.success) {
      console.log('✅ Nigerian payment methods retrieved');
      nigeriaPaymentsResponse.data.paymentMethods.forEach(method => {
        console.log(`   ${method.logo} ${method.name} - ${method.description}`);
      });
    } else {
      console.log('❌ Failed to get Nigerian payment methods');
    }

    // Test 6: Health check
    console.log('\n6️⃣ Testing System Health...');
    const healthResponse = await axios.get(`${BASE_URL}/health`);
    if (healthResponse.data.status === 'healthy') {
      console.log('✅ System is healthy');
      console.log('   Services status:');
      Object.entries(healthResponse.data.services).forEach(([service, status]) => {
        console.log(`     ${service}: ${status ? '✅' : '❌'}`);
      });
    } else {
      console.log('❌ System health check failed');
    }

    console.log('\n🎉 All tests completed!');
    console.log('\n📋 System Summary:');
    console.log('   🌍 African Countries: 10 supported');
    console.log('   💳 Paystack: Primary payment method');
    console.log('   🪙 Crypto: Multiple platforms supported');
    console.log('   🇬🇭 Ghana: Special Bitnob integration');
    console.log('   🏦 Local Banks: Country-specific support');
    console.log('   📱 Mobile Money: Where available');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testAfricanSystem();
}

module.exports = { testAfricanSystem };
