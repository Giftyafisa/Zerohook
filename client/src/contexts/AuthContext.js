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

  // Fetch exchange rates on app load (for all users, even unauthenticated)
  useEffect(() => {
    const initializeExchangeRates = async () => {
      try {
        console.log('💱 Initializing exchange rates...');
        await dispatch(fetchExchangeRates()).unwrap();
        console.log('✅ Exchange rates loaded');
      } catch (error) {
        console.log('⚠️ Exchange rates fetch failed, using defaults');
      }
    };
    initializeExchangeRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // FIXED: Simplified subscription status check
  useEffect(() => {
    if (isAuthenticated && user && user.is_subscribed !== undefined) {
      dispatch(setSubscriptionStatus(user.is_subscribed));
    }
  }, [isAuthenticated, user, dispatch]);

  // Country detection after authentication
  useEffect(() => {
    if (isAuthenticated && user) {
      const detectCountry = async () => {
        try {
          console.log('🌍 Detecting user country...');
          await dispatch(detectUserCountry()).unwrap();
          await dispatch(getSupportedCountries()).unwrap();
          console.log('✅ Country detection complete');
        } catch (error) {
          console.log('⚠️ Country detection failed, using defaults:', error.message);
        }
      };
      detectCountry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user]);

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
