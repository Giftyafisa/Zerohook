import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import countryAPI from '../../services/countryAPI';
import { getExchangeRatesForStore } from '../../services/exchangeRateAPI';

// Async thunks
export const detectUserCountry = createAsyncThunk(
  'country/detectUserCountry',
  async (_, { rejectWithValue }) => {
    try {
      const response = await countryAPI.detectCountry();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Country detection failed' });
    }
  }
);

export const setUserCountryPreference = createAsyncThunk(
  'country/setUserCountryPreference',
  async (countryCode, { rejectWithValue }) => {
    try {
      const response = await countryAPI.setPreference(countryCode);
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Failed to set country preference' });
    }
  }
);

export const getSupportedCountries = createAsyncThunk(
  'country/getSupportedCountries',
  async (_, { rejectWithValue }) => {
    try {
      const response = await countryAPI.getSupportedCountries();
      return response;
    } catch (error) {
      return rejectWithValue(error.response?.data || { error: 'Failed to get supported countries' });
    }
  }
);

// NEW: Fetch live exchange rates
export const fetchExchangeRates = createAsyncThunk(
  'country/fetchExchangeRates',
  async (_, { rejectWithValue }) => {
    try {
      console.log('💱 Fetching live exchange rates...');
      const rates = await getExchangeRatesForStore();
      return rates;
    } catch (error) {
      console.error('Failed to fetch exchange rates:', error);
      return rejectWithValue({ error: 'Failed to fetch exchange rates' });
    }
  }
);

// Initial state with updated realistic exchange rates (January 2026)
const initialState = {
  userCountry: null,
  detectedCountry: null,
  supportedCountries: [],
  loading: false,
  ratesLoading: false,
  ratesLastUpdated: null,
  error: null,
  exchangeRates: {
    'NG': { rate: 1580, currency: 'NGN', symbol: '₦' },
    'GH': { rate: 15.2, currency: 'GHS', symbol: '₵' },
    'KE': { rate: 154, currency: 'KES', symbol: 'KSh' },
    'ZA': { rate: 18.8, currency: 'ZAR', symbol: 'R' },
    'UG': { rate: 3780, currency: 'UGX', symbol: 'USh' },
    'TZ': { rate: 2580, currency: 'TZS', symbol: 'TSh' },
    'RW': { rate: 1320, currency: 'RWF', symbol: 'FRw' },
    'BW': { rate: 13.8, currency: 'BWP', symbol: 'P' },
    'ZM': { rate: 27.5, currency: 'ZMW', symbol: 'ZK' },
    'MW': { rate: 1750, currency: 'MWK', symbol: 'MK' },
    'US': { rate: 1, currency: 'USD', symbol: '$' },
    'GB': { rate: 0.79, currency: 'GBP', symbol: '£' },
    'EU': { rate: 0.92, currency: 'EUR', symbol: '€' }
  }
};

const countrySlice = createSlice({
  name: 'country',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUserCountry: (state, action) => {
      state.userCountry = action.payload;
    },
    setDetectedCountry: (state, action) => {
      state.detectedCountry = action.payload;
    },
    updateExchangeRate: (state, action) => {
      const { countryCode, rate, currency, symbol } = action.payload;
      state.exchangeRates[countryCode] = { rate, currency, symbol };
    },
    resetCountry: (state) => {
      state.userCountry = null;
      state.detectedCountry = null;
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Detect user country cases
      .addCase(detectUserCountry.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(detectUserCountry.fulfilled, (state, action) => {
        state.loading = false;
        // API returns detectedCountry, not country
        const resolvedCountry = action.payload.detectedCountry || action.payload.country;
        state.detectedCountry = resolvedCountry;
        if (!state.userCountry) {
          state.userCountry = resolvedCountry;
        }
        const loggedCountry = state.userCountry && typeof state.userCountry === 'object'
          ? { ...state.userCountry }
          : state.userCountry;
        console.log('🌍 Country stored in Redux:', loggedCountry);
      })
      .addCase(detectUserCountry.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Country detection failed';
      })
      
      // Set user country preference cases
      .addCase(setUserCountryPreference.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(setUserCountryPreference.fulfilled, (state, action) => {
        state.loading = false;
        state.userCountry = action.payload.country;
      })
      .addCase(setUserCountryPreference.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Failed to set country preference';
      })
      
      // Get supported countries cases
      .addCase(getSupportedCountries.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(getSupportedCountries.fulfilled, (state, action) => {
        state.loading = false;
        state.supportedCountries = action.payload.countries;
      })
      .addCase(getSupportedCountries.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload?.error || 'Failed to get supported countries';
      })
      
      // Fetch exchange rates cases
      .addCase(fetchExchangeRates.pending, (state) => {
        state.ratesLoading = true;
      })
      .addCase(fetchExchangeRates.fulfilled, (state, action) => {
        state.ratesLoading = false;
        state.exchangeRates = { ...state.exchangeRates, ...action.payload };
        state.ratesLastUpdated = new Date().toISOString();
        console.log('💱 Exchange rates updated in Redux');
      })
      .addCase(fetchExchangeRates.rejected, (state, action) => {
        state.ratesLoading = false;
        console.warn('⚠️ Exchange rates fetch failed, using cached rates');
      });
  }
});

// Export actions
export const { 
  clearError, 
  setUserCountry, 
  setDetectedCountry, 
  updateExchangeRate, 
  resetCountry 
} = countrySlice.actions;

// Export selectors
export const selectUserCountry = (state) => state.country.userCountry;
export const selectDetectedCountry = (state) => state.country.detectedCountry;
export const selectSupportedCountries = (state) => state.country.supportedCountries;
export const selectCountryLoading = (state) => state.country.loading;
export const selectCountryError = (state) => state.country.error;
export const selectExchangeRates = (state) => state.country.exchangeRates;
export const selectRatesLoading = (state) => state.country.ratesLoading;
export const selectRatesLastUpdated = (state) => state.country.ratesLastUpdated;

// Factory selector to get localized price for any USD amount
export const createLocalizedPriceSelector = (priceUSD = 20) => (state) => {
  const userCountry = state.country.userCountry;
  const exchangeRates = state.country.exchangeRates;
  
  if (!userCountry) {
    return { price: priceUSD, currency: 'USD', symbol: '$' };
  }
  
  const countryRate = exchangeRates[userCountry.code];
  if (!countryRate) {
    return { price: priceUSD, currency: 'USD', symbol: '$' };
  }
  
  const localPrice = Math.round(priceUSD * countryRate.rate);
  
  return {
    price: localPrice,
    currency: countryRate.currency,
    symbol: countryRate.symbol,
    originalPrice: priceUSD,
    originalCurrency: 'USD'
  };
};

// Backward-compatible: default $20 subscription price selector
export const selectLocalizedPrice = createLocalizedPriceSelector(20);

export default countrySlice.reducer;
