import { configureStore } from '@reduxjs/toolkit';
import authSlice from './slices/authSlice';
import userSlice from './slices/userSlice';
import servicesSlice from './slices/servicesSlice';
import transactionsSlice from './slices/transactionsSlice';
import trustSlice from './slices/trustSlice';
import uiSlice from './slices/uiSlice';
import countrySlice from './slices/countrySlice';

const store = configureStore({
  reducer: {
    auth: authSlice,
    user: userSlice,
    services: servicesSlice,
    transactions: transactionsSlice,
    trust: trustSlice,
    ui: uiSlice,
    country: countrySlice,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST'],
        ignoredActionsPaths: ['meta.arg', 'payload.timestamp'],
        ignoredPaths: ['items.dates'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

export default store;