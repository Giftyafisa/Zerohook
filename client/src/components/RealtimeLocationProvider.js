/**
 * RealtimeLocationProvider - Activates Uber-style real-time location sharing
 * 
 * This component activates the useRealtimeLocation hook for authenticated provider accounts.
 * When a provider is logged in, it automatically starts streaming their GPS location
 * to the server via WebSocket, enabling the recommendation engine to show them
 * to nearby clients in real-time.
 * 
 * For clients, it passively listens for nearby provider updates.
 * 
 * Mount this component inside SocketProvider and AuthProvider in App.js.
 */

import { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectUser, selectIsAuthenticated } from '../store/slices/authSlice';
import useRealtimeLocation from '../hooks/useRealtimeLocation';

const RealtimeLocationProvider = () => {
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const hasStartedRef = useRef(false);

  // Determine account type
  const accountType = user?.profile_data?.accountType || 
                      user?.profileData?.accountType || 
                      'client';
  
  const isProvider = accountType === 'provider';

  // Use the realtime location hook
  const { startSharing, stopSharing, isSharing } = useRealtimeLocation({
    role: isProvider ? 'provider' : 'client',
    updateInterval: isProvider ? 15000 : 30000, // Providers: 15s, Clients: 30s
    enableHighAccuracy: true
  });

  // Auto-start location sharing for authenticated providers
  useEffect(() => {
    if (isAuthenticated && isProvider && !isSharing && !hasStartedRef.current) {
      hasStartedRef.current = true;
      // Small delay to ensure socket connection is established
      const timer = setTimeout(() => {
        startSharing().then(success => {
          if (success) {
            console.log('📍 Auto-started real-time location sharing for provider');
          } else {
            hasStartedRef.current = false; // Allow retry
          }
        });
      }, 2000);
      
      return () => clearTimeout(timer);
    }
    
    // Stop sharing on logout
    if (!isAuthenticated && isSharing) {
      stopSharing();
      hasStartedRef.current = false;
    }
  }, [isAuthenticated, isProvider, isSharing, startSharing, stopSharing]);

  // Reset flag when user changes
  useEffect(() => {
    hasStartedRef.current = false;
  }, [user?.id]);

  // This component renders nothing - it's purely a side-effect hook activator
  return null;
};

export default RealtimeLocationProvider;
