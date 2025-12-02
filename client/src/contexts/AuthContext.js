import React, { createContext, useContext, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectIsAuthenticated, selectUser, validateStoredToken, setSubscriptionStatus, updateUser as updateUserAction } from '../store/slices/authSlice';
import { detectUserCountry, getSupportedCountries } from '../store/slices/countrySlice';

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
  }, []); // Only run once on mount

  // FIXED: Simplified subscription status check
  useEffect(() => {
    if (isAuthenticated && user && user.is_subscribed !== undefined) {
      dispatch(setSubscriptionStatus(user.is_subscribed));
    }
  }, [isAuthenticated, user?.is_subscribed, dispatch]);

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
  }, [isAuthenticated, user, dispatch]);

  const updateUser = (userData) => {
    if (user) {
      dispatch(updateUserAction({ ...user, ...userData }));
    }
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      user, 
      updateUser 
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
