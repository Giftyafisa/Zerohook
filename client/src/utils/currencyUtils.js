/**
 * Currency Utility Functions
 * Centralized currency formatting that uses Redux country detection
 */

// Default exchange rates and symbols matching countrySlice
const DEFAULT_EXCHANGE_RATES = {
  NG: { currency: 'NGN', rate: 1550, symbol: '₦' },
  GH: { currency: 'GHS', rate: 14.5, symbol: '₵' },
  KE: { currency: 'KES', rate: 153, symbol: 'KSh ' },
  ZA: { currency: 'ZAR', rate: 18.5, symbol: 'R' },
  EG: { currency: 'EGP', rate: 48, symbol: 'E£' },
  TZ: { currency: 'TZS', rate: 2550, symbol: 'TSh ' },
  UG: { currency: 'UGX', rate: 3750, symbol: 'USh ' },
  RW: { currency: 'RWF', rate: 1280, symbol: 'RF ' },
  ET: { currency: 'ETB', rate: 56, symbol: 'Br ' },
  MA: { currency: 'MAD', rate: 10, symbol: 'DH ' },
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
