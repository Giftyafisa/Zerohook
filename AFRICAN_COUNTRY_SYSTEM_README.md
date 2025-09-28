# 🌍 African Country-Specific Payment System

## Overview

This system has been enhanced to provide **country-specific identification** and **localized payment methods** for African countries with Paystack support. Users are automatically assigned a country ID based on their location, and they can also manually select their preferred country. All payments, currencies, and features are tailored to the user's selected country.

## 🚀 Key Features

### **1. Automatic Country Detection**
- **IP Geolocation**: Automatically detects user's country from IP address
- **Smart Fallback**: Falls back to Nigeria (NG) if detected country not supported
- **Confidence Levels**: High/medium/low confidence indicators for detection

### **2. Country-Specific Payment Methods**
- **Local Currencies**: Each country uses its native currency (NGN, GHS, KES, etc.)
- **Local Banks**: Direct integration with country-specific banks
- **Mobile Money**: Support for local mobile money services
- **Crypto Platforms**: Country-specific cryptocurrency options

### **3. Ghanaian Special Features**
- **Bitnob Integration**: Exclusive Ghanaian crypto platform
- **Mobile Money**: MTN, Vodafone, AirtelTigo support
- **Local Banks**: All major Ghanaian banks
- **24/7 Local Support**: Ghanaian customer service

## 🌍 Supported African Countries

| Country | Code | Flag | Currency | Paystack | Local Banks | Mobile Money | Crypto |
|---------|------|------|----------|----------|-------------|--------------|---------|
| Nigeria | NG | 🇳🇬 | NGN (₦) | ✅ | ✅ | ❌ | ✅ |
| Ghana | GH | 🇬🇭 | GHS (₵) | ✅ | ✅ | ✅ | ✅ |
| Kenya | KE | 🇰🇪 | KES (KSh) | ✅ | ✅ | ✅ | ✅ |
| South Africa | ZA | 🇿🇦 | ZAR (R) | ✅ | ✅ | ❌ | ✅ |
| Uganda | UG | 🇺🇬 | UGX (USh) | ✅ | ✅ | ✅ | ✅ |
| Tanzania | TZ | 🇹🇿 | TZS (TSh) | ✅ | ✅ | ✅ | ✅ |
| Rwanda | RW | 🇷🇼 | RWF (FRw) | ✅ | ✅ | ✅ | ✅ |
| Botswana | BW | 🇧🇼 | BWP (P) | ✅ | ✅ | ❌ | ✅ |
| Zambia | ZM | 🇿🇲 | ZMW (ZK) | ✅ | ✅ | ✅ | ✅ |
| Malawi | MW | 🇲🇼 | MWK (MK) | ✅ | ✅ | ✅ | ✅ |

## 🏗️ Architecture

### **New Services**

```
CountryManager (Country Detection & Management)
├── IP Geolocation
├── Country Data Management
├── User Country Preferences
└── Country-Specific Features

BitnobManager (Ghanaian Crypto Platform)
├── Local Bank Integration
├── Mobile Money Support
├── Crypto Payments
└── Ghanaian-Specific Features
```

### **Database Schema Updates**

```sql
-- Countries table
CREATE TABLE countries (
  id SERIAL PRIMARY KEY,
  code VARCHAR(2) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  flag VARCHAR(10),
  currency VARCHAR(3) NOT NULL,
  currency_symbol VARCHAR(5),
  timezone VARCHAR(50),
  phone_code VARCHAR(10),
  paystack_support BOOLEAN DEFAULT false,
  crypto_platforms JSONB,
  local_banks BOOLEAN DEFAULT false,
  mobile_money BOOLEAN DEFAULT false
);

-- Users table updates
ALTER TABLE users ADD COLUMN country_preference VARCHAR(2);
ALTER TABLE users ADD COLUMN detected_country VARCHAR(2);
```

## 🔧 Setup & Configuration

### **1. Environment Variables**

```bash
# Country Detection
IP_GEOLOCATION_SERVICE=ip-api.com
DEFAULT_COUNTRY=NG
SUPPORTED_COUNTRIES=NG,GH,KE,ZA,UG,TZ,RW,BW,ZM,MW

# Bitnob (Ghanaian Platform)
BITNOB_API_KEY=your_bitnob_api_key
BITNOB_SECRET_KEY=your_bitnob_secret_key

# Paystack (Primary)
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key
```

### **2. Install Dependencies**

```bash
cd server
npm install axios
```

### **3. Database Initialization**

The system automatically creates the countries table and populates it with African country data on first run.

## 🌐 API Endpoints

### **Country Management**

```http
# Get all supported countries
GET /api/countries

# Get specific country details
GET /api/countries/:code

# Detect user's country from IP
POST /api/countries/detect
{
  "ipAddress": "user_ip_address"
}

# Get user's country preference
GET /api/countries/user/preference

# Update user's country preference
PUT /api/countries/user/preference
{
  "countryCode": "GH"
}
```

### **Country-Specific Features**

```http
# Get payment methods for a country
GET /api/countries/:code/payment-methods

# Get crypto platforms for a country
GET /api/countries/:code/crypto-platforms

# Get countries by feature
GET /api/countries/features/mobile_money
GET /api/countries/features/local_banks
GET /api/countries/features/paystack
```

### **Ghanaian Special Endpoints**

```http
# Get Ghanaian crypto platforms
GET /api/countries/ghana/crypto-platforms

# Get Bitnob features
GET /api/countries/ghana/bitnob/features

# Get Ghanaian banks
GET /api/countries/ghana/bitnob/banks
```

## 💰 Payment Method Priority

### **1. Paystack (Primary)**
- **All Countries**: Primary payment method
- **Local Banks**: Direct bank transfers
- **Mobile Money**: Where available
- **Cards**: International cards

### **2. Crypto Platforms**
- **Global**: Coinbase, Binance, Luno
- **Local**: Bitnob (Ghana), PesaFlow (Kenya), VALR (South Africa)

### **3. Local Methods**
- **Bank Transfers**: Country-specific banks
- **Mobile Money**: Local providers (MTN, Vodafone, etc.)

## 🇬🇭 Ghanaian Special Features

### **Bitnob Platform**
- **Local Bank Integration**: All major Ghanaian banks
- **Mobile Money**: MTN, Vodafone, AirtelTigo
- **Crypto Support**: Bitcoin, Ethereum, USDT
- **Local Currency**: Ghanaian Cedi (GHS)
- **24/7 Support**: Ghanaian customer service

### **Mobile Money Providers**
- **MTN Mobile Money**: Largest provider
- **Vodafone Cash**: Second largest
- **AirtelTigo Money**: Third provider

### **Supported Banks**
- Ghana Commercial Bank (GCB)
- Ecobank Ghana
- Standard Chartered Ghana
- Access Bank Ghana
- And more...

## 🔄 User Flow

### **1. First Visit**
```
User visits app → IP detection → Country auto-assigned → Welcome message
```

### **2. Country Selection**
```
User can change country → View available features → Select new country → Update preferences
```

### **3. Payment Process**
```
Select service → Choose payment method → Country-specific options → Local currency → Complete payment
```

## 📱 Frontend Integration

### **Country Selector Component**

```javascript
import CountrySelector from './components/country/CountrySelector';

const App = () => {
  const handleCountryChange = (country) => {
    console.log('Country changed to:', country.name);
    // Update app state, payment methods, etc.
  };

  return (
    <CountrySelector
      onCountryChange={handleCountryChange}
      showDetected={true}
    />
  );
};
```

### **Country-Specific Payment Methods**

```javascript
const getPaymentMethods = async (countryCode) => {
  const response = await fetch(`/api/countries/${countryCode}/payment-methods`);
  const data = await response.json();
  return data.paymentMethods;
};
```

## 🚨 Error Handling

### **Country Detection Failures**
- Fallback to default country (Nigeria)
- User notification of detection failure
- Manual country selection option

### **Unsupported Countries**
- Clear error messages
- List of supported countries
- Suggestion to use nearest supported country

### **API Failures**
- Graceful degradation
- Retry mechanisms
- User-friendly error messages

## 📊 Monitoring & Analytics

### **Country Distribution**
- Users per country
- Payment method preferences
- Success rates by country

### **Feature Usage**
- Most used crypto platforms
- Popular payment methods
- Country-specific trends

### **Performance Metrics**
- Detection accuracy
- API response times
- Error rates by country

## 🔒 Security Features

### **Country Validation**
- Server-side country verification
- IP address validation
- User preference validation

### **Payment Security**
- Country-specific compliance
- Local regulatory adherence
- Secure API communications

### **Data Privacy**
- GDPR compliance
- Local data protection laws
- User consent management

## 🚀 Future Enhancements

### **Planned Features**
- **More Countries**: Expand to more African nations
- **Local Languages**: Country-specific language support
- **Regional Features**: East/West/South African specific features
- **Mobile Apps**: Country-specific mobile applications

### **Integration Plans**
- **More Crypto Platforms**: Local African crypto exchanges
- **Bank APIs**: Direct bank integration
- **Mobile Money APIs**: Direct mobile money integration
- **Local Payment Gateways**: Country-specific payment processors

## 📞 Support

### **Country-Specific Support**
- **Nigeria**: +234 support line
- **Ghana**: +233 support line
- **Kenya**: +254 support line
- **South Africa**: +27 support line

### **Documentation**
- [Paystack API Docs](https://paystack.com/docs)
- [Bitnob API Docs](https://bitnob.com/docs)
- [Country Codes](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)

### **Community**
- GitHub Issues
- Developer Forum
- Country-specific Discord channels

---

## 🎯 **System Benefits**

1. **Localized Experience**: Users get country-specific features and payment methods
2. **Better Conversion**: Local payment methods increase payment success rates
3. **Regulatory Compliance**: Adheres to local financial regulations
4. **User Trust**: Local platforms and currencies build user confidence
5. **Market Expansion**: Easy to add new African countries
6. **Competitive Advantage**: Unique positioning in African markets

---

**🌍 Your app is now ready for African users with country-specific identification and localized payment experiences!**
