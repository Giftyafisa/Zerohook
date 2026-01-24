/**
 * Currency Utility Functions
 * Centralized currency formatting that uses Redux country detection
 * 
 * SUBSCRIPTION PRICING:
 * Base price: $20 USD for 6-month subscription
 * Local prices are calculated using exchange rates below
 */

// Default exchange rates and symbols matching countrySlice (Updated January 2026)
const DEFAULT_EXCHANGE_RATES = {
  NG: { currency: 'NGN', rate: 1580, symbol: '₦' },
  GH: { currency: 'GHS', rate: 15.2, symbol: '₵' },
  KE: { currency: 'KES', rate: 154, symbol: 'KSh' },
  ZA: { currency: 'ZAR', rate: 18.8, symbol: 'R' },
  EG: { currency: 'EGP', rate: 48, symbol: 'E£' },
  TZ: { currency: 'TZS', rate: 2580, symbol: 'TSh' },
  UG: { currency: 'UGX', rate: 3780, symbol: 'USh' },
  RW: { currency: 'RWF', rate: 1320, symbol: 'FRw' },
  BW: { currency: 'BWP', rate: 13.8, symbol: 'P' },
  ZM: { currency: 'ZMW', rate: 27.5, symbol: 'ZK' },
  MW: { currency: 'MWK', rate: 1750, symbol: 'MK' },
  ET: { currency: 'ETB', rate: 56, symbol: 'Br' },
  MA: { currency: 'MAD', rate: 10, symbol: 'DH' },
  US: { currency: 'USD', rate: 1, symbol: '$' },
  GB: { currency: 'GBP', rate: 0.79, symbol: '£' },
  EU: { currency: 'EUR', rate: 0.92, symbol: '€' },
  CA: { currency: 'CAD', rate: 1.36, symbol: 'C$' },
};

/**
 * Get currency info for a country code
 * @param {string} countryCode - ISO country code (e.g., 'NG', 'US')
 * @param {Object} exchangeRates - Exchange rates from Redux (optional)
 * @returns {Object} - { currency, rate, symbol }
 */
export const getCurrencyInfo = (countryCode, exchangeRates = null) => {
  const rates = exchangeRates || DEFAULT_EXCHANGE_RATES;
  
  if (countryCode && rates[countryCode]) {
    return rates[countryCode];
  }
  
  // Default to USD
  return { currency: 'USD', rate: 1, symbol: '$' };
};

/**
 * Format a price with the correct currency symbol
 * @param {number} amount - The amount to format
 * @param {string} countryCode - ISO country code for currency
 * @param {Object} exchangeRates - Exchange rates from Redux (optional)
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted price string
 */
export const formatCurrency = (amount, countryCode = 'US', exchangeRates = null, options = {}) => {
  const { 
    showDecimals = true, 
    convertFromUSD = false,
    showCurrencyCode = false 
  } = options;
  
  const currencyInfo = getCurrencyInfo(countryCode, exchangeRates);
  
  // Convert from USD if needed
  let finalAmount = amount;
  if (convertFromUSD && currencyInfo.rate) {
    finalAmount = amount * currencyInfo.rate;
  }
  
  // Format the number
  const formattedNumber = showDecimals 
    ? finalAmount.toFixed(2) 
    : Math.round(finalAmount).toLocaleString();
  
  // Build the result
  let result = `${currencyInfo.symbol}${formattedNumber}`;
  
  if (showCurrencyCode) {
    result += ` ${currencyInfo.currency}`;
  }
  
  return result;
};

/**
 * Format price with automatic conversion from USD
 * @param {number} usdAmount - Amount in USD
 * @param {string} countryCode - Target country code
 * @param {Object} exchangeRates - Exchange rates from Redux
 * @returns {string} - Formatted local price
 */
export const formatLocalPrice = (usdAmount, countryCode, exchangeRates = null) => {
  return formatCurrency(usdAmount, countryCode, exchangeRates, { 
    convertFromUSD: true, 
    showDecimals: false 
  });
};

/**
 * Get just the currency symbol for a country
 * @param {string} countryCode - ISO country code
 * @param {Object} exchangeRates - Exchange rates from Redux (optional)
 * @returns {string} - Currency symbol
 */
export const getCurrencySymbol = (countryCode, exchangeRates = null) => {
  const currencyInfo = getCurrencyInfo(countryCode, exchangeRates);
  return currencyInfo.symbol;
};

const currencyUtils = {
  formatCurrency,
  formatLocalPrice,
  getCurrencyInfo,
  getCurrencySymbol,
  DEFAULT_EXCHANGE_RATES
};

export default currencyUtils;
