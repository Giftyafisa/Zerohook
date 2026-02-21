/**
 * CurrencyManager - Live Currency Conversion Service
 * 
 * Handles:
 * - Live crypto rates from CoinGecko (free, no API key needed)
 * - Live fiat rates from Frankfurter (free, no API key needed)
 * - Smart caching: 60s crypto, 15min fiat
 * - Conversion between any fiat + crypto pair
 * - Fiat display prices for crypto payments
 */

const axios = require('axios');
const NodeCache = require('node-cache');

class CurrencyManager {
  constructor() {
    this.initialized = false;
    
    // Cache: 60s for crypto (volatile), 900s (15min) for fiat (stable)
    this.cryptoCache = new NodeCache({ stdTTL: 60, checkperiod: 30 });
    this.fiatCache = new NodeCache({ stdTTL: 900, checkperiod: 120 });
    
    // Thundering herd protection: in-flight fetch promises
    this._cryptoFetchPromise = null;
    this._fiatFetchPromise = null;
    
    // CoinGecko free API (no key needed, 10-30 calls/min)
    this.coinGeckoBase = 'https://api.coingecko.com/api/v3';
    
    // Frankfurter free API (no key needed, backed by ECB)
    this.frankfurterBase = 'https://api.frankfurter.app';
    
    // Supported cryptos mapped to CoinGecko IDs
    this.cryptoMap = {
      BTC: { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', decimals: 8, logo: '₿', network: 'Bitcoin' },
      ETH: { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', decimals: 18, logo: 'Ξ', network: 'Ethereum' },
      USDT: { id: 'tether', name: 'Tether', symbol: 'USDT', decimals: 6, logo: '₮', network: 'Ethereum' },
      USDC: { id: 'usd-coin', name: 'USD Coin', symbol: 'USDC', decimals: 6, logo: '💵', network: 'Ethereum' },
      BNB: { id: 'binancecoin', name: 'BNB', symbol: 'BNB', decimals: 18, logo: '🟡', network: 'BSC' },
      SOL: { id: 'solana', name: 'Solana', symbol: 'SOL', decimals: 9, logo: '◎', network: 'Solana' },
      LTC: { id: 'litecoin', name: 'Litecoin', symbol: 'LTC', decimals: 8, logo: 'Ł', network: 'Litecoin' }
    };
    
    // African + common fiat currencies
    this.fiatCurrencies = {
      NGN: { name: 'Nigerian Naira', symbol: '₦' },
      GHS: { name: 'Ghanaian Cedi', symbol: '₵' },
      KES: { name: 'Kenyan Shilling', symbol: 'KSh' },
      ZAR: { name: 'South African Rand', symbol: 'R' },
      UGX: { name: 'Ugandan Shilling', symbol: 'USh' },
      TZS: { name: 'Tanzanian Shilling', symbol: 'TSh' },
      RWF: { name: 'Rwandan Franc', symbol: 'FRw' },
      BWP: { name: 'Botswana Pula', symbol: 'P' },
      ZMW: { name: 'Zambian Kwacha', symbol: 'ZK' },
      MWK: { name: 'Malawian Kwacha', symbol: 'MK' },
      USD: { name: 'US Dollar', symbol: '$' },
      EUR: { name: 'Euro', symbol: '€' },
      GBP: { name: 'British Pound', symbol: '£' }
    };
    
    // Fallback rates (used when ALL APIs are unreachable)
    // ⚠️ STALENESS WARNING: These are approximate rates as of June 2025.
    // They WILL become inaccurate over time. If both ExchangeRate-API and
    // Frankfurter are down, these provide a degraded-but-functional experience.
    // Update periodically if API outages are frequent.
    this._fallbackRatesDate = '2025-06-01';
    this.fallbackCryptoRatesUSD = {
      BTC: 67000, ETH: 3500, USDT: 1.0, USDC: 1.0,
      BNB: 600, SOL: 170, LTC: 85
    };
    
    this.fallbackFiatRatesUSD = {
      NGN: 1600, GHS: 15.5, KES: 153, ZAR: 18.2, UGX: 3750,
      TZS: 2650, RWF: 1350, BWP: 13.7, ZMW: 27, MWK: 1750,
      USD: 1, EUR: 0.92, GBP: 0.79
    };
  }

  async initialize() {
    try {
      console.log('💱 Initializing Currency Manager...');
      
      // Pre-warm caches
      await Promise.allSettled([
        this.fetchCryptoRates(),
        this.fetchFiatRates()
      ]);
      
      this.initialized = true;
      console.log('✅ Currency Manager initialized');
      return true;
    } catch (error) {
      console.error('❌ Currency Manager initialization failed:', error.message);
      // Still mark as initialized - we have fallback rates
      this.initialized = true;
      return true;
    }
  }

  isHealthy() {
    return this.initialized;
  }

  // ============ CRYPTO RATES (CoinGecko) ============

  /**
   * Fetch live crypto prices in USD from CoinGecko
   * @returns {Object} { BTC: 67000, ETH: 3500, ... }
   */
  async fetchCryptoRates() {
    const cacheKey = 'crypto_rates_usd';
    const cached = this.cryptoCache.get(cacheKey);
    if (cached) return cached;

    // Thundering herd protection: reuse in-flight promise
    if (this._cryptoFetchPromise) return this._cryptoFetchPromise;
    
    this._cryptoFetchPromise = this._doFetchCryptoRates(cacheKey);
    try {
      return await this._cryptoFetchPromise;
    } finally {
      this._cryptoFetchPromise = null;
    }
  }

  async _doFetchCryptoRates(cacheKey) {
    try {
      const ids = Object.values(this.cryptoMap).map(c => c.id).join(',');
      const response = await axios.get(`${this.coinGeckoBase}/simple/price`, {
        params: {
          ids: ids,
          vs_currencies: 'usd',
          include_24hr_change: 'true'
        },
        timeout: 10000
      });

      const rates = {};
      const changes = {};
      for (const [symbol, info] of Object.entries(this.cryptoMap)) {
        const data = response.data[info.id];
        if (data) {
          rates[symbol] = data.usd;
          changes[symbol] = data.usd_24h_change || 0;
        }
      }

      const result = { rates, changes, timestamp: Date.now(), source: 'coingecko' };
      this.cryptoCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('CoinGecko API error:', error.message);
      return {
        rates: this.fallbackCryptoRatesUSD,
        changes: {},
        timestamp: Date.now(),
        source: 'fallback'
      };
    }
  }

  // ============ FIAT RATES (ExchangeRate-API + Frankfurter fallback) ============

  /**
   * Fetch live fiat exchange rates (base USD)
   * Primary: ExchangeRate-API (supports African currencies: NGN, GHS, KES, etc.)
   * Fallback: Frankfurter (ECB, major currencies only)
   * Final fallback: Hardcoded rates
   * @returns {Object} { rates: { NGN: 1600, GHS: 15.5, ... }, timestamp, source }
   */
  async fetchFiatRates() {
    const cacheKey = 'fiat_rates_usd';
    const cached = this.fiatCache.get(cacheKey);
    if (cached) return cached;

    // Thundering herd protection
    if (this._fiatFetchPromise) return this._fiatFetchPromise;

    this._fiatFetchPromise = this._doFetchFiatRates(cacheKey);
    try {
      return await this._fiatFetchPromise;
    } finally {
      this._fiatFetchPromise = null;
    }
  }

  async _doFetchFiatRates(cacheKey) {
    // Try ExchangeRate-API first (supports all African currencies)
    try {
      const response = await axios.get(
        'https://open.er-api.com/v6/latest/USD',
        { timeout: 10000 }
      );

      if (response.data && response.data.rates) {
        // Filter to only our supported currencies
        const allRates = response.data.rates;
        const rates = { USD: 1 };
        for (const currency of Object.keys(this.fiatCurrencies)) {
          if (allRates[currency]) {
            rates[currency] = allRates[currency];
          } else {
            // Use fallback for any missing currency
            rates[currency] = this.fallbackFiatRatesUSD[currency] || 1;
          }
        }

        const result = { rates, timestamp: Date.now(), source: 'exchangerate-api' };
        this.fiatCache.set(cacheKey, result);
        console.log('💱 Fiat rates fetched from ExchangeRate-API (supports African currencies)');
        return result;
      }
    } catch (error) {
      console.warn('ExchangeRate-API error, trying Frankfurter fallback:', error.message);
    }

    // Fallback to Frankfurter (doesn't support African currencies but has EUR/GBP)
    try {
      const symbols = Object.keys(this.fiatCurrencies).filter(c => c !== 'EUR').join(',');
      const response = await axios.get(`${this.frankfurterBase}/latest`, {
        params: { from: 'USD', to: symbols },
        timeout: 10000
      });

      // Merge: fallback first (all African currencies), then API data overrides what it supports
      const rates = { ...this.fallbackFiatRatesUSD, USD: 1, ...response.data.rates };
      const result = { rates, timestamp: Date.now(), source: 'frankfurter+fallback' };
      this.fiatCache.set(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Frankfurter API also failed:', error.message);
      const daysSinceFallback = Math.floor((Date.now() - new Date(this._fallbackRatesDate).getTime()) / 86400000);
      console.warn(`⚠️ Using hardcoded fallback rates from ${this._fallbackRatesDate} (${daysSinceFallback} days old). Exchange rates may be inaccurate!`);
      return {
        rates: this.fallbackFiatRatesUSD,
        timestamp: Date.now(),
        source: 'fallback-stale'
      };
    }
  }

  // ============ CONVERSION METHODS ============

  /**
   * Convert fiat amount to crypto amount
   * @param {number} fiatAmount - Amount in fiat currency
   * @param {string} fiatCurrency - Fiat currency code (NGN, USD, etc.)
   * @param {string} cryptoSymbol - Crypto symbol (BTC, ETH, etc.)
   * @returns {Object} { cryptoAmount, rate, fiatAmount, ... }
   */
  async fiatToCrypto(fiatAmount, fiatCurrency, cryptoSymbol) {
    const [cryptoData, fiatData] = await Promise.all([
      this.fetchCryptoRates(),
      this.fetchFiatRates()
    ]);

    const cryptoUsdPrice = cryptoData.rates[cryptoSymbol];
    const fiatUsdRate = fiatData.rates[fiatCurrency];

    if (!cryptoUsdPrice || !fiatUsdRate) {
      throw new Error(`Unsupported currency pair: ${fiatCurrency} → ${cryptoSymbol}`);
    }

    // fiatAmount in local currency → USD → crypto
    const usdAmount = fiatAmount / fiatUsdRate;
    const cryptoAmount = usdAmount / cryptoUsdPrice;

    return {
      cryptoAmount: cryptoAmount,
      cryptoSymbol: cryptoSymbol,
      fiatAmount: fiatAmount,
      fiatCurrency: fiatCurrency,
      usdEquivalent: usdAmount,
      rate: cryptoUsdPrice * fiatUsdRate, // 1 crypto = X fiat
      rateSource: `${cryptoData.source}+${fiatData.source}`,
      timestamp: Date.now()
    };
  }

  /**
   * Convert crypto amount to fiat amount
   * @param {number} cryptoAmount - Amount in crypto
   * @param {string} cryptoSymbol - Crypto symbol (BTC, ETH, etc.)
   * @param {string} fiatCurrency - Fiat currency code (NGN, USD, etc.)
   * @returns {Object} { fiatAmount, rate, cryptoAmount, ... }
   */
  async cryptoToFiat(cryptoAmount, cryptoSymbol, fiatCurrency) {
    const [cryptoData, fiatData] = await Promise.all([
      this.fetchCryptoRates(),
      this.fetchFiatRates()
    ]);

    const cryptoUsdPrice = cryptoData.rates[cryptoSymbol];
    const fiatUsdRate = fiatData.rates[fiatCurrency];

    if (!cryptoUsdPrice || !fiatUsdRate) {
      throw new Error(`Unsupported currency pair: ${cryptoSymbol} → ${fiatCurrency}`);
    }

    // crypto → USD → local fiat
    const usdAmount = cryptoAmount * cryptoUsdPrice;
    const fiatAmount = usdAmount * fiatUsdRate;

    return {
      fiatAmount: fiatAmount,
      fiatCurrency: fiatCurrency,
      cryptoAmount: cryptoAmount,
      cryptoSymbol: cryptoSymbol,
      usdEquivalent: usdAmount,
      rate: cryptoUsdPrice * fiatUsdRate, // 1 crypto = X fiat
      rateSource: `${cryptoData.source}+${fiatData.source}`,
      timestamp: Date.now()
    };
  }

  /**
   * Get all crypto rates in a specific fiat currency
   * @param {string} fiatCurrency - Fiat currency code
   * @returns {Object} { BTC: { price, change24h }, ETH: {...}, ... }
   */
  async getAllCryptoRatesInFiat(fiatCurrency = 'USD') {
    const [cryptoData, fiatData] = await Promise.all([
      this.fetchCryptoRates(),
      this.fetchFiatRates()
    ]);

    const fiatUsdRate = fiatData.rates[fiatCurrency] || 1;
    const result = {};

    for (const [symbol, info] of Object.entries(this.cryptoMap)) {
      const usdPrice = cryptoData.rates[symbol];
      if (usdPrice) {
        result[symbol] = {
          ...info,
          priceUSD: usdPrice,
          priceLocal: usdPrice * fiatUsdRate,
          localCurrency: fiatCurrency,
          localSymbol: this.fiatCurrencies[fiatCurrency]?.symbol || '',
          change24h: cryptoData.changes[symbol] || 0
        };
      }
    }

    return {
      rates: result,
      fiatCurrency: fiatCurrency,
      fiatSymbol: this.fiatCurrencies[fiatCurrency]?.symbol || '',
      source: `${cryptoData.source}+${fiatData.source}`,
      timestamp: Date.now()
    };
  }

  /**
   * Convert between any two fiat currencies
   */
  async fiatToFiat(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) {
      return { amount, fromCurrency, toCurrency, rate: 1 };
    }

    const fiatData = await this.fetchFiatRates();
    const fromRate = fiatData.rates[fromCurrency];
    const toRate = fiatData.rates[toCurrency];

    if (!fromRate || !toRate) {
      throw new Error(`Unsupported fiat pair: ${fromCurrency} → ${toCurrency}`);
    }

    const usdAmount = amount / fromRate;
    const convertedAmount = usdAmount * toRate;

    return {
      amount: convertedAmount,
      fromCurrency,
      toCurrency,
      rate: toRate / fromRate,
      source: fiatData.source,
      timestamp: Date.now()
    };
  }

  // ============ UTILITY METHODS ============

  /**
   * Get supported cryptocurrencies list
   */
  getSupportedCryptos() {
    return Object.values(this.cryptoMap);
  }

  /**
   * Get supported fiat currencies list
   */
  getSupportedFiats() {
    return Object.entries(this.fiatCurrencies).map(([code, info]) => ({
      code, ...info
    }));
  }

  /**
   * Check if a crypto symbol is supported
   */
  isSupportedCrypto(symbol) {
    return !!this.cryptoMap[symbol?.toUpperCase()];
  }

  /**
   * Check if a fiat currency is supported
   */
  isSupportedFiat(code) {
    return !!this.fiatCurrencies[code?.toUpperCase()];
  }

  /**
   * Get crypto info by symbol
   */
  getCryptoInfo(symbol) {
    return this.cryptoMap[symbol?.toUpperCase()] || null;
  }

  /**
   * Format crypto amount with appropriate decimals
   */
  formatCryptoAmount(amount, symbol) {
    const info = this.cryptoMap[symbol?.toUpperCase()];
    if (!info) return amount.toString();
    
    // Show meaningful decimals based on value
    if (amount < 0.0001) return amount.toFixed(8);
    if (amount < 1) return amount.toFixed(6);
    if (amount < 100) return amount.toFixed(4);
    return amount.toFixed(2);
  }

  /**
   * Format fiat amount with symbol
   */
  formatFiatAmount(amount, currencyCode) {
    const info = this.fiatCurrencies[currencyCode?.toUpperCase()];
    const symbol = info?.symbol || '';
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.cryptoCache.flushAll();
    this.fiatCache.flushAll();
  }
}

module.exports = CurrencyManager;
