# 🌍 International Payment System - Paystack + Crypto

## Overview

This payment system has been enhanced to support **Paystack as the primary international payment method** alongside **cryptocurrency payments** and legacy Stripe support. The system provides seamless international payments with local bank support, crypto payments, and comprehensive escrow protection.

## 🚀 New Payment Methods

### 1. **Paystack (Primary) 💳**
- **International Coverage**: NGN, USD, EUR, GBP
- **Local Bank Support**: Direct bank transfers in supported countries
- **Fast Processing**: Real-time payment verification
- **Webhook Integration**: Automatic payment confirmation
- **Multi-Currency**: Automatic currency conversion

### 2. **Cryptocurrency 🪙**
- **Bitcoin (BTC)**: Direct wallet payments
- **Ethereum (ETH)**: Smart contract payments
- **USDT/USDC**: Stablecoin payments
- **Coinbase Commerce**: Hosted payment pages
- **Exchange Rates**: Real-time crypto pricing

### 3. **Stripe (Legacy) 💳**
- **Credit/Debit Cards**: Visa, Mastercard, Amex
- **Digital Wallets**: Apple Pay, Google Pay
- **International**: USD, EUR support

## 🏗️ Architecture

### Backend Services

```
PaymentManager (Main Controller)
├── PaystackManager (Primary)
├── CryptoPaymentManager (Crypto)
└── StripeManager (Legacy)
```

### Payment Flow

```
1. User selects payment method
2. Payment intent created
3. User redirected to payment gateway
4. Payment processed
5. Webhook confirmation
6. Funds held in escrow
7. Service completion
8. Funds released to provider
```

## 📁 File Structure

```
server/
├── services/
│   ├── PaystackManager.js      # Paystack integration
│   ├── CryptoPaymentManager.js # Crypto payments
│   └── EscrowManager.js       # Escrow system
├── routes/
│   └── payments.js            # Payment API endpoints
└── env.example               # Environment configuration

client/
└── src/
    └── components/
        └── payments/
            └── PaymentMethodSelector.js # Payment UI
```

## 🔧 Setup & Configuration

### 1. Environment Variables

```bash
# Paystack (Primary)
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
PAYSTACK_PUBLIC_KEY=pk_test_your_paystack_public_key

# Crypto Payments
COINBASE_COMMERCE_API_KEY=your_coinbase_commerce_api_key
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your_infura_project_id
BITCOIN_NETWORK=mainnet

# Stripe (Legacy)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

### 2. Install Dependencies

```bash
cd server
npm install paystack coinbase-commerce bitcoinjs-lib
```

### 3. Database Schema Updates

The system automatically handles the new payment fields:
- `payment_method`: 'paystack', 'crypto', 'stripe'
- `currency`: Payment currency code
- `escrow_address`: Payment reference/transaction ID

## 🌐 API Endpoints

### Payment Methods
```http
GET /api/payments/methods
# Returns available payment methods with supported currencies
```

### Currencies & Exchange Rates
```http
GET /api/payments/currencies
# Returns supported currencies with exchange rates
```

### Create Payment
```http
POST /api/payments/create-payment-intent
{
  "amount": 100.00,
  "currency": "NGN",
  "serviceId": "uuid",
  "description": "Service payment",
  "paymentMethod": "paystack"
}
```

### Payment Confirmation
```http
POST /api/payments/confirm
{
  "transactionId": "uuid",
  "paymentMethod": "paystack",
  "reference": "PAYSTACK_REF_123"
}
```

### Webhooks
```http
POST /api/payments/paystack-webhook
POST /api/payments/coinbase-webhook
```

## 💱 Supported Currencies

| Currency | Code | Symbol | Payment Methods | Exchange Rate |
|----------|------|--------|-----------------|---------------|
| Nigerian Naira | NGN | ₦ | Paystack | 1 USD = 0.0012 NGN |
| US Dollar | USD | $ | All | 1 USD = 1 USD |
| Euro | EUR | € | Paystack, Stripe | 1 USD = 1.08 EUR |
| British Pound | GBP | £ | Paystack | 1 USD = 1.26 GBP |
| Bitcoin | BTC | ₿ | Crypto | Real-time |
| Ethereum | ETH | Ξ | Crypto | Real-time |
| Tether | USDT | ₮ | Crypto | Real-time |
| USD Coin | USDC | 💵 | Crypto | Real-time |

## 🔒 Security Features

### Payment Verification
- **Paystack**: Webhook-based verification
- **Crypto**: Blockchain transaction verification
- **Stripe**: Payment intent verification

### Escrow Protection
- All payments held until service completion
- Dispute resolution system
- Automatic fund release upon proof

### Fraud Detection
- Risk assessment before payment
- Suspicious pattern detection
- Multi-factor verification

## 🚀 Usage Examples

### Frontend Integration

```javascript
import PaymentMethodSelector from './components/payments/PaymentMethodSelector';

const PaymentPage = () => {
  const handlePaymentInitiate = (paymentData) => {
    const { method, currency, amount } = paymentData;
    
    // Redirect to appropriate payment gateway
    if (method === 'paystack') {
      // Redirect to Paystack payment page
      window.location.href = paymentData.authorizationUrl;
    } else if (method === 'crypto') {
      // Show crypto payment details
      showCryptoPayment(paymentData);
    }
  };

  return (
    <PaymentMethodSelector
      amount={100}
      currency="USD"
      onPaymentInitiate={handlePaymentInitiate}
    />
  );
};
```

### Backend Payment Processing

```javascript
// Create Paystack payment
const paystack = new PaystackManager();
const payment = await paystack.initializeTransaction({
  amount: 100,
  email: 'user@example.com',
  currency: 'NGN',
  reference: 'REF_123',
  callback_url: 'https://yourapp.com/callback'
});

// Create crypto payment
const crypto = new CryptoPaymentManager();
const btcPayment = await crypto.createBitcoinAddress({
  amount: 0.002,
  transactionId: 'TXN_123',
  metadata: { serviceId: 'SVC_123' }
});
```

## 🌍 International Features

### Local Bank Support
- **Nigeria**: Direct bank transfers via Paystack
- **Ghana**: Mobile money integration
- **Kenya**: M-Pesa support
- **South Africa**: Local bank integration

### Currency Conversion
- Automatic exchange rate calculation
- Real-time currency updates
- Local pricing display
- Multi-currency escrow

### Compliance
- Local payment regulations
- Anti-money laundering (AML)
- Know Your Customer (KYC)
- Tax compliance

## 📊 Monitoring & Analytics

### Payment Metrics
- Success rates by method
- Currency distribution
- Processing times
- Error rates

### Webhook Monitoring
- Payment confirmations
- Failed transactions
- Retry mechanisms
- Logging & alerts

## 🔄 Migration Guide

### From Stripe-Only to Multi-Method

1. **Update Environment Variables**
   ```bash
   # Add new payment method keys
   PAYSTACK_SECRET_KEY=your_key
   COINBASE_COMMERCE_API_KEY=your_key
   ```

2. **Update Frontend**
   ```javascript
   // Replace Stripe-only components with PaymentMethodSelector
   import PaymentMethodSelector from './components/payments/PaymentMethodSelector';
   ```

3. **Update Backend**
   ```javascript
   // Payment routes now support multiple methods
   // No changes needed to existing code
   ```

4. **Test Payment Flows**
   - Test Paystack payments
   - Test crypto payments
   - Verify webhooks
   - Test escrow system

## 🚨 Troubleshooting

### Common Issues

1. **Paystack Initialization Failed**
   - Check API keys
   - Verify network connectivity
   - Check account status

2. **Crypto Payment Verification**
   - Check blockchain network
   - Verify RPC endpoints
   - Check transaction confirmations

3. **Webhook Failures**
   - Verify webhook URLs
   - Check server logs
   - Test webhook endpoints

### Debug Commands

```bash
# Test Paystack connection
curl -H "Authorization: Bearer YOUR_KEY" \
  https://api.paystack.co/transaction/verify/test

# Test crypto rates
curl https://api.coinbase.com/v2/exchange-rates?currency=USD

# Check payment status
curl -H "Authorization: Bearer YOUR_KEY" \
  https://api.paystack.co/transaction/verify/REFERENCE
```

## 🔮 Future Enhancements

### Planned Features
- **More Cryptocurrencies**: Solana, Cardano, Polkadot
- **DeFi Integration**: Yield farming, staking
- **NFT Payments**: Digital asset payments
- **AI Fraud Detection**: Machine learning-based security
- **Mobile Money**: More local payment methods

### Scalability
- **Microservices**: Separate payment services
- **Load Balancing**: Multiple payment gateways
- **Caching**: Redis-based rate limiting
- **Monitoring**: Advanced analytics dashboard

## 📞 Support

### Documentation
- [Paystack API Docs](https://paystack.com/docs)
- [Coinbase Commerce Docs](https://commerce.coinbase.com/docs)
- [Stripe API Docs](https://stripe.com/docs)

### Community
- GitHub Issues
- Developer Forum
- Discord Community

---

**🎉 The payment system is now ready for international use with Paystack as the primary method and comprehensive crypto support!**
