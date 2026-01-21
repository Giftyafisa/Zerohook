import React, { createContext, useContext, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectIsAuthenticated, selectUser, validateStoredToken, setSubscriptionStatus, updateUser as updateUserAction, logout as logoutAction } from '../store/slices/authSlice';
import { detectUserCountry, getSupportedCountries, fetchExchangeRates } from '../store/slices/countrySlice';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);

  // FIXED: Single useEffect for authentication initialization
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      if (token && !user) {
        try {
          await dispatch(validateStoredToken()).unwrap();
        } catch (error) {
          console.error('Token validation failed:', error);
          localStorage.removeItem('token');
        }
      }
    };
    
    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // CRITICAL FIX: Detect country and fetch exchange rates for ALL users (authenticated OR visitors)
  // This must run on app load regardless of authentication status
  useEffect(() => {
    const initializeLocationAndCurrency = async () => {
      try {
        // First, detect user's country (works for both authenticated and visitors)
        console.log('🌍 Detecting user country...');
        await dispatch(detectUserCountry()).unwrap();
        console.log('✅ Country detection complete');
      } catch (error) {
        console.log('⚠️ Country detection failed, using defaults:', error.message);
      }
      
      try {
        // Then fetch exchange rates
        console.log('💱 Initializing exchange rates...');
        await dispatch(fetchExchangeRates()).unwrap();
        console.log('✅ Exchange rates loaded');
      } catch (error) {
        console.log('⚠️ Exchange rates fetch failed, using defaults');
      }
      
      try {
        // Load supported countries list
        await dispatch(getSupportedCountries()).unwrap();
      } catch (error) {
        console.log('⚠️ Supported countries fetch failed');
      }
    };
    
    initializeLocationAndCurrency();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on app mount - NOT dependent on authentication

  // FIXED: Simplified subscription status check
  useEffect(() => {
    if (isAuthenticated && user && user.is_subscribed !== undefined) {
      dispatch(setSubscriptionStatus(user.is_subscribed));
    }
  }, [isAuthenticated, user, dispatch]);

  // Re-detect country when user logs in (they may have phone number for better detection)
  useEffect(() => {
    if (isAuthenticated && user) {
      const redetectCountryForAuthUser = async () => {
        try {
          console.log('🌍 Re-detecting country for authenticated user...');
          await dispatch(detectUserCountry()).unwrap();
        } catch (error) {
          console.log('⚠️ Re-detection failed, keeping previous country');
        }
      };
      redetectCountryForAuthUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const updateUser = (userData) => {
    if (user) {
      dispatch(updateUserAction({ ...user, ...userData }));
    }
  };

  // Logout function - clears auth state and localStorage
  const logout = useCallback(() => {
    console.log('🚪 Logging out user...');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    dispatch(logoutAction());
  }, [dispatch]);

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      user, 
      updateUser,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
