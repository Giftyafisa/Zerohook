import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  services: [],
  currentService: null,
  categories: [],
  loading: false,
  error: null,
  filters: {
    category: '',
    minPrice: '',
    maxPrice: '',
    location: ''
  }
};

const servicesSlice = createSlice({
  name: 'services',
  initialState,
  reducers: {
    setServices: (state, action) => {
      state.services = action.payload;
    },
    setCurrentService: (state, action) => {
      state.currentService = action.payload;
    },
    setCategories: (state, action) => {
      state.categories = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearError: (state) => {
      state.error = null;
    }
  }
});

export const { 
  setServices, 
  setCurrentService, 
  setCategories, 
  setLoading, 
  setError, 
  setFilters, 
  clearError 
} = servicesSlice.actions;

export const selectServices = (state) => state.services.services;
export const selectCurrentService = (state) => state.services.currentService;
export const selectCategories = (state) => state.services.categories;
export const selectServicesLoading = (state) => state.services.loading;
export const selectServicesError = (state) => state.services.error;
export const selectFilters = (state) => state.services.filters;

export default servicesSlice.reducer;
