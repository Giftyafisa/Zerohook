import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectIsSubscribed } from '../../store/slices/authSlice';

const ProtectedRoute = ({ children, requireSubscription = true }) => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isSubscribed = useSelector(selectIsSubscribed);
  const location = useLocation();

  console.log('🔐 ProtectedRoute Check:', { 
    isAuthenticated, 
    isSubscribed, 
    requireSubscription,
    currentPath: location.pathname 
  });

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireSubscription && !isSubscribed) {
    return <Navigate to="/subscription" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
