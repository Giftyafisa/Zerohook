import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import countryAPI from '../../services/countryAPI';

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

// Initial state
const initialState = {
  userCountry: null,
  detectedCountry: null,
  supportedCountries: [],
  loading: false,
  error: null,
  exchangeRates: {
    'NG': { rate: 1500, currency: 'NGN', symbol: '₦' },
    'GH': { rate: 25, currency: 'GHS', symbol: '₵' },
    'KE': { rate: 3200, currency: 'KES', symbol: 'KSh' },
    'ZA': { rate: 380, currency: 'ZAR', symbol: 'R' },
    'UG': { rate: 75000, currency: 'UGX', symbol: 'USh' },
    'TZ': { rate: 50000, currency: 'TZS', symbol: 'TSh' },
    'RW': { rate: 25000, currency: 'RWF', symbol: 'FRw' },
    'BW': { rate: 270, currency: 'BWP', symbol: 'P' },
    'ZM': { rate: 500, currency: 'ZMW', symbol: 'ZK' },
    'MW': { rate: 35000, currency: 'MWK', symbol: 'MK' }
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
        state.detectedCountry = action.payload.country;
        if (!state.userCountry) {
          state.userCountry = action.payload.country;
        }
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

// Helper selector to get localized price
export const selectLocalizedPrice = (state) => {
  const userCountry = state.country.userCountry;
  const exchangeRates = state.country.exchangeRates;
  
  if (!userCountry) {
    return { price: 20, currency: 'USD', symbol: '$' };
  }
  
  const countryRate = exchangeRates[userCountry.code];
  if (!countryRate) {
    return { price: 20, currency: 'USD', symbol: '$' };
  }
  
  const localPrice = Math.round(20 * countryRate.rate);
  
  return {
    price: localPrice,
    currency: countryRate.currency,
    symbol: countryRate.symbol,
    originalPrice: 20,
    originalCurrency: 'USD'
  };
};

export default countrySlice.reducer;
