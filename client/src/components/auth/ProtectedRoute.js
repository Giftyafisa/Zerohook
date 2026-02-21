import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectIsSubscribed, selectAuthInitialized } from '../../store/slices/authSlice';
import { Box, CircularProgress } from '@mui/material';

/**
 * ProtectedRoute - Guards routes requiring authentication and/or subscription
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Route content to render if authorized
 * @param {boolean} props.requireSubscription - Whether active subscription is required (default: true)
 */
const ProtectedRoute = ({ children, requireSubscription = true }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isSubscribed = useSelector(selectIsSubscribed);
  const initialized = useSelector(selectAuthInitialized);
  const location = useLocation();

  // Wait for initial token validation before making any redirect decisions
  if (!initialized) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  // Only log in development to avoid leaking auth state in production
  if (process.env.NODE_ENV === 'development') {
    console.log('🔐 ProtectedRoute Check:', { 
      isAuthenticated, 
      isSubscribed, 
      requireSubscription,
      currentPath: location.pathname 
    });
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Defensive: Prevent redirect loops if /subscription is accidentally wrapped with requireSubscription
  // This should never happen if routes are configured correctly, but provides safety
  if (requireSubscription && !isSubscribed) {
    const subscriptionPaths = ['/subscription', '/subscription/success', '/subscription/error'];
    if (subscriptionPaths.includes(location.pathname)) {
      // Already on subscription page - render children to avoid infinite loop
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️ ProtectedRoute: Subscription route wrapped with requireSubscription=true. This is likely a misconfiguration.');
      }
      return children;
    }
    return <Navigate to="/subscription" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
