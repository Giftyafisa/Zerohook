/**
 * useCurrency Hook
 * Provides currency formatting functions using Redux country detection
 * 
 * USAGE:
 * const { formatFromUSD, symbol, convertFromUSD } = useCurrency();
 * 
 * // Display formatted price from USD base
 * <Typography>{formatFromUSD(435)}</Typography>  // Shows "₵6,612" for Ghana
 * 
 * // Get just the symbol
 * <Typography>{symbol}5,000</Typography>  // Shows "₵5,000" for Ghana
 * 
 * // Get conversion details for complex displays
 * const price = convertFromUSD(435); 
 * // Returns { amount: 6612, symbol: '₵', currency: 'GHS', originalAmount: 435, baseCurrency: 'USD' }
 */

import { useSelector } from 'react-redux';
import { useMemo, useCallback } from 'react';
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
  // Memoize to prevent unnecessary re-renders
  const currentCountry = useMemo(() => {
    return userCountry || detectedCountry || { code: 'US', name: 'United States' };
  }, [userCountry, detectedCountry]);
  
  const countryCode = currentCountry?.code || 'US';
  
  /**
   * Format a price in the user's local currency
   * @param {number} amount - Amount to format (in local currency)
   * @param {Object} options - Formatting options
   */
  const format = useCallback((amount, options = {}) => {
    return formatCurrency(amount, countryCode, exchangeRates, options);
  }, [countryCode, exchangeRates]);
  
  /**
   * Format a USD amount and convert to local currency (returns formatted string)
   * @param {number} usdAmount - Amount in USD
   * @returns {string} - Formatted price string like "₵6,612"
   */
  const formatFromUSD = useCallback((usdAmount) => {
    if (usdAmount == null || isNaN(usdAmount)) return '';
    return formatCurrency(usdAmount, countryCode, exchangeRates, { 
      convertFromUSD: true, 
      showDecimals: false 
    });
  }, [countryCode, exchangeRates]);
  
  /**
   * Convert a USD amount to local currency (returns object with details)
   * Useful for displaying both amount and symbol separately
   * @param {number} usdAmount - Amount in USD
   * @returns {Object|null} - { amount, symbol, currency, originalAmount, baseCurrency }
   */
  const convertFromUSD = useCallback((usdAmount) => {
    if (usdAmount == null || isNaN(usdAmount)) return null;
    
    const info = getCurrencyInfo(countryCode, exchangeRates);
    const convertedAmount = Math.round(parseFloat(usdAmount) * info.rate);
    
    return {
      amount: convertedAmount,
      symbol: info.symbol,
      currency: info.currency,
      rate: info.rate,
      originalAmount: parseFloat(usdAmount),
      baseCurrency: 'USD',
      formatted: `${info.symbol}${convertedAmount.toLocaleString()}`
    };
  }, [countryCode, exchangeRates]);
  
  /**
   * Get the current currency symbol
   */
  const symbol = useMemo(() => {
    return getCurrencySymbol(countryCode, exchangeRates);
  }, [countryCode, exchangeRates]);
  
  /**
   * Get full currency info
   */
  const currencyInfo = useMemo(() => {
    return getCurrencyInfo(countryCode, exchangeRates);
  }, [countryCode, exchangeRates]);
  
  return {
    // Functions
    format,
    formatFromUSD,
    convertFromUSD,
    
    // Properties
    symbol,
    currencyCode: currencyInfo.currency,
    countryCode,
    countryName: currentCountry?.name || 'United States',
    exchangeRate: currencyInfo.rate,
    
    // Full info
    currencyInfo,
    exchangeRates,
    
    // Country info for debugging
    detectedCountry,
    userCountry
  };
};

export default useCurrency;
