import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  trustScore: null,
  trustEvents: [],
  loading: false,
  error: null
};

const trustSlice = createSlice({
  name: 'trust',
  initialState,
  reducers: {
    setTrustScore: (state, action) => {
      state.trustScore = action.payload;
    },
    setTrustEvents: (state, action) => {
      state.trustEvents = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    }
  }
});

export const { 
  setTrustScore, 
  setTrustEvents, 
  setLoading, 
  setError, 
  clearError 
} = trustSlice.actions;

export const selectTrustScore = (state) => state.trust.trustScore;
export const selectTrustEvents = (state) => state.trust.trustEvents;
export const selectTrustLoading = (state) => state.trust.loading;
export const selectTrustError = (state) => state.trust.error;

export default trustSlice.reducer;
