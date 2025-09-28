import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  transactions: [],
  currentTransaction: null,
  loading: false,
  error: null
};

const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    setTransactions: (state, action) => {
      state.transactions = action.payload;
    },
    setCurrentTransaction: (state, action) => {
      state.currentTransaction = action.payload;
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
  setTransactions, 
  setCurrentTransaction, 
  setLoading, 
  setError, 
  clearError 
} = transactionsSlice.actions;

export const selectTransactions = (state) => state.transactions.transactions;
export const selectCurrentTransaction = (state) => state.transactions.currentTransaction;
export const selectTransactionsLoading = (state) => state.transactions.loading;
export const selectTransactionsError = (state) => state.transactions.error;

export default transactionsSlice.reducer;
