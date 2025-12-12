/**
 * useCurrency Hook
 * Provides currency formatting functions using Redux country detection
 */

import { useSelector } from 'react-redux';
import { 
  selectUserCountry, 
  selectDetectedCountry, 
  selectExchangeRates 
} from '../store/slices/countrySlice';
import { formatCurrency, getCurrencySymbol, getCurrencyInfo } from '../utils/currencyUtils';

/**
 * Custom hook for currency formatting based on detected/user country
 * @returns {Object} - Currency utilities and info
 */
const useCurrency = () => {
  const userCountry = useSelector(selectUserCountry);
  const detectedCountry = useSelector(selectDetectedCountry);
  const exchangeRates = useSelector(selectExchangeRates);
  
  // Prefer user-selected country, fall back to detected country, then US
  const currentCountry = userCountry || detectedCountry || { code: 'US', name: 'United States' };
  const countryCode = currentCountry?.code || 'US';
  
  /**
   * Format a price in the user's local currency
   * @param {number} amount - Amount to format (in local currency)
   * @param {Object} options - Formatting options
   */
  const format = (amount, options = {}) => {
    return formatCurrency(amount, countryCode, exchangeRates, options);
  };
  
  /**
   * Format a USD amount and convert to local currency
   * @param {number} usdAmount - Amount in USD
   */
  const formatFromUSD = (usdAmount) => {
    return formatCurrency(usdAmount, countryCode, exchangeRates, { 
      convertFromUSD: true, 
      showDecimals: false 
    });
  };
  
  /**
   * Get the current currency symbol
   */
  const symbol = getCurrencySymbol(countryCode, exchangeRates);
  
  /**
   * Get full currency info
   */
  const currencyInfo = getCurrencyInfo(countryCode, exchangeRates);
  
  return {
    // Functions
    format,
    formatFromUSD,
    
    // Properties
    symbol,
    currencyCode: currencyInfo.currency,
    countryCode,
    countryName: currentCountry?.name || 'United States',
    exchangeRate: currencyInfo.rate,
    
    // Full info
    currencyInfo,
    exchangeRates
  };
};

export default useCurrency;
