/**
 * Exchange Rate API Service
 * Fetches live exchange rates for currency conversion
 * 
 * Uses ExchangeRate-API (free tier: 1500 requests/month)
 * Fallback to Open Exchange Rates or hardcoded rates if API fails
 */

import axios from 'axios';

// Free exchange rate API options:
// 1. ExchangeRate-API: https://api.exchangerate-api.com/v4/latest/USD (free, no key needed)
// 2. Open Exchange Rates: requires API key
// 3. Fixer.io: requires API key

const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour cache

// Fallback rates (updated January 2026 estimates)
const FALLBACK_RATES = {
  NGN: 1580,   // Nigerian Naira
  GHS: 15.2,   // Ghanaian Cedi
  KES: 154,    // Kenyan Shilling
  ZAR: 18.8,   // South African Rand
  UGX: 3780,   // Ugandan Shilling
  TZS: 2580,   // Tanzanian Shilling
  RWF: 1320,   // Rwandan Franc
  BWP: 13.8,   // Botswana Pula
  ZMW: 27.5,   // Zambian Kwacha
  MWK: 1750,   // Malawian Kwacha
  USD: 1,      // US Dollar (base)
  EUR: 0.92,   // Euro
  GBP: 0.79,   // British Pound
};

// Currency symbols
const CURRENCY_SYMBOLS = {
  NGN: '₦',
  GHS: '₵',
  KES: 'KSh',
  ZAR: 'R',
  UGX: 'USh',
  TZS: 'TSh',
  RWF: 'FRw',
  BWP: 'P',
  ZMW: 'ZK',
  MWK: 'MK',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

// Country code to currency code mapping
const COUNTRY_TO_CURRENCY = {
  NG: 'NGN',
  GH: 'GHS',
  KE: 'KES',
  ZA: 'ZAR',
  UG: 'UGX',
  TZ: 'TZS',
  RW: 'RWF',
  BW: 'BWP',
  ZM: 'ZMW',
  MW: 'MWK',
  US: 'USD',
  GB: 'GBP',
  EU: 'EUR',
};

// Cache for exchange rates
let rateCache = {
  rates: null,
  timestamp: 0,
};

/**
 * Clear the exchange rate cache (call on logout to prevent stale data across sessions)
 */
export const clearExchangeRateCache = () => {
  rateCache = { rates: null, timestamp: 0 };
};

/**
 * Fetch live exchange rates from API
 * @returns {Promise<Object>} Exchange rates keyed by currency code
 */
export const fetchLiveExchangeRates = async () => {
  // Check cache first
  const now = Date.now();
  if (rateCache.rates && (now - rateCache.timestamp) < CACHE_DURATION) {
    console.log('💱 Using cached exchange rates');
    return rateCache.rates;
  }

  try {
    console.log('💱 Fetching live exchange rates...');
    const response = await axios.get(EXCHANGE_RATE_API, {
      timeout: 10000, // 10 second timeout
    });

    if (response.data && response.data.rates) {
      const rates = response.data.rates;
      
      // Update cache
      rateCache = {
        rates: rates,
        timestamp: now,
      };

      console.log('✅ Live exchange rates fetched successfully');
      return rates;
    }
    
    throw new Error('Invalid API response');
  } catch (error) {
    console.warn('⚠️ Exchange rate API failed, using fallback rates:', error.message);
    return FALLBACK_RATES;
  }
};

/**
 * Get exchange rates formatted for Redux store
 * @returns {Promise<Object>} Exchange rates keyed by country code
 */
export const getExchangeRatesForStore = async () => {
  const rates = await fetchLiveExchangeRates();
  
  const storeRates = {};
  
  for (const [countryCode, currencyCode] of Object.entries(COUNTRY_TO_CURRENCY)) {
    const rate = rates[currencyCode] || FALLBACK_RATES[currencyCode] || 1;
    storeRates[countryCode] = {
      rate: rate,
      currency: currencyCode,
      symbol: CURRENCY_SYMBOLS[currencyCode] || currencyCode,
    };
  }

  return storeRates;
};

/**
 * Convert amount from USD to target currency
 * @param {number} usdAmount - Amount in USD
 * @param {string} targetCurrency - Target currency code (e.g., 'NGN', 'GHS')
 * @param {Object} rates - Exchange rates object (optional, will fetch if not provided)
 * @returns {Promise<number>} Converted amount
 */
export const convertFromUSD = async (usdAmount, targetCurrency, rates = null) => {
  if (!rates) {
    rates = await fetchLiveExchangeRates();
  }
  
  const rate = rates[targetCurrency] || FALLBACK_RATES[targetCurrency] || 1;
  return usdAmount * rate;
};

/**
 * Convert amount between any two currencies
 * @param {number} amount - Amount to convert
 * @param {string} fromCurrency - Source currency code
 * @param {string} toCurrency - Target currency code
 * @param {Object} rates - Exchange rates object (optional)
 * @returns {Promise<number>} Converted amount
 */
export const convertCurrency = async (amount, fromCurrency, toCurrency, rates = null) => {
  if (fromCurrency === toCurrency) return amount;
  
  if (!rates) {
    rates = await fetchLiveExchangeRates();
  }
  
  // Convert to USD first, then to target currency
  const fromRate = rates[fromCurrency] || FALLBACK_RATES[fromCurrency] || 1;
  const toRate = rates[toCurrency] || FALLBACK_RATES[toCurrency] || 1;
  
  const usdAmount = amount / fromRate;
  return usdAmount * toRate;
};

/**
 * Format amount with currency symbol
 * @param {number} amount - Amount to format
 * @param {string} currencyCode - Currency code
 * @param {Object} options - Formatting options
 * @returns {string} Formatted price string
 */
export const formatWithSymbol = (amount, currencyCode, options = {}) => {
  const { showDecimals = false, compact = false } = options;
  const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
  
  let formattedAmount;
  
  if (compact && amount >= 1000) {
    if (amount >= 1000000) {
      formattedAmount = (amount / 1000000).toFixed(1) + 'M';
    } else if (amount >= 1000) {
      formattedAmount = (amount / 1000).toFixed(1) + 'K';
    }
  } else {
    formattedAmount = showDecimals 
      ? amount.toFixed(2) 
      : Math.round(amount).toLocaleString();
  }
  
  return `${symbol}${formattedAmount}`;
};

// Export constants for use elsewhere
export { FALLBACK_RATES, CURRENCY_SYMBOLS, COUNTRY_TO_CURRENCY };

const exchangeRateAPI = {
  fetchLiveExchangeRates,
  getExchangeRatesForStore,
  convertFromUSD,
  convertCurrency,
  formatWithSymbol,
  FALLBACK_RATES,
  CURRENCY_SYMBOLS,
  COUNTRY_TO_CURRENCY,
};

export default exchangeRateAPI;
