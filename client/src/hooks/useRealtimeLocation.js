/**
 * useRealtimeLocation - Uber-style real-time location streaming hook
 * 
 * For PROVIDERS: Streams their location to server every 10-30 seconds
 * For CLIENTS: Subscribes to provider location updates in their area
 * 
 * Features:
 * - Continuous GPS tracking with battery optimization
 * - WebSocket-based real-time streaming
 * - Graceful fallback to HTTP polling
 * - Privacy controls (start/stop sharing)
 * 
 * Usage:
 * // For providers:
 * const { startSharing, stopSharing, isSharing } = useRealtimeLocation({ role: 'provider' });
 * 
 * // For clients:
 * const { nearbyProviders, subscribeToArea } = useRealtimeLocation({ role: 'client' });
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const useRealtimeLocation = (options = {}) => {
  const { 
    role = 'client',           // 'provider' or 'client'
    updateInterval = 15000,    // Update frequency (ms) - 15 seconds default
    enableHighAccuracy = true  // GPS accuracy preference
  } = options;

  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  
  // State
  const [isSharing, setIsSharing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [nearbyProviders, setNearbyProviders] = useState([]);
  const [locationError, setLocationError] = useState(null);
  
  // Refs for cleanup
  const watchIdRef = useRef(null);
  const updateIntervalRef = useRef(null);
  const lastUpdateRef = useRef(null);

  /**
   * Get current position with promise wrapper
   */
  const getCurrentPosition = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy,
          timeout: 10000,
          maximumAge: 30000  // Accept cached position up to 30s old
        }
      );
    });
  }, [enableHighAccuracy]);

  /**
   * Send location update to server
   */
  const sendLocationUpdate = useCallback(async (position) => {
    if (!socket || !isConnected) return;

    const locationData = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy < 50 ? 'high' : 
                position.coords.accuracy < 200 ? 'medium' : 'low',
      heading: position.coords.heading,
      isAvailable: true,
      timestamp: Date.now()
    };

    // Rate limit: don't send if last update was very recent
    if (lastUpdateRef.current && 
        Date.now() - lastUpdateRef.current < updateInterval / 2) {
      return;
    }

    socket.emit('location_update', locationData);
    lastUpdateRef.current = Date.now();

    setCurrentLocation({
      lat: locationData.lat,
      lng: locationData.lng,
      timestamp: locationData.timestamp
    });

    console.log('📍 Location update sent:', {
      lat: locationData.lat.toFixed(6),
      lng: locationData.lng.toFixed(6)
    });
  }, [socket, isConnected, updateInterval]);

  /**
   * Start continuous location sharing (for providers)
   */
  const startSharing = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return false;
    }

    try {
      // Get initial position
      const position = await getCurrentPosition();
      await sendLocationUpdate(position);
      
      // Start watching position
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          sendLocationUpdate(pos);
        },
        (error) => {
          console.error('Location watch error:', error);
          setLocationError(error.message);
        },
        {
          enableHighAccuracy,
          maximumAge: 30000,
          timeout: 15000
        }
      );

      // Also set up interval as backup
      updateIntervalRef.current = setInterval(async () => {
        try {
          const pos = await getCurrentPosition();
          sendLocationUpdate(pos);
        } catch (err) {
          console.warn('Interval location fetch failed:', err);
        }
      }, updateInterval);

      // Notify server
      if (socket && isConnected) {
        socket.emit('start_location_sharing');
      }

      setIsSharing(true);
      setLocationError(null);
      console.log('📍 Started location sharing');
      return true;

    } catch (error) {
      console.error('Failed to start location sharing:', error);
      setLocationError(error.message);
      return false;
    }
  }, [getCurrentPosition, sendLocationUpdate, socket, isConnected, enableHighAccuracy, updateInterval]);

  /**
   * Stop location sharing
   */
  const stopSharing = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    // Notify server
    if (socket && isConnected) {
      socket.emit('stop_location_sharing');
    }

    setIsSharing(false);
    console.log('📍 Stopped location sharing');
  }, [socket, isConnected]);

  /**
   * Subscribe to provider updates in an area (for clients)
   */
  const subscribeToArea = useCallback(async (lat, lng) => {
    if (!socket || !isConnected) return;

    socket.emit('subscribe_to_area', { lat, lng });
    
    // Request initial nearby providers
    socket.emit('get_nearby_providers', {
      lat,
      lng,
      radiusKm: 25,
      limit: 50
    });
  }, [socket, isConnected]);

  /**
   * Request nearby providers (one-time fetch)
   */
  const getNearbyProviders = useCallback(async (lat, lng, radius = 25) => {
    if (!socket || !isConnected) return [];

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve([]), 5000);
      
      socket.once('nearby_providers', (data) => {
        clearTimeout(timeout);
        resolve(data.providers || []);
      });

      socket.emit('get_nearby_providers', {
        lat,
        lng,
        radiusKm: radius,
        limit: 100
      });
    });
  }, [socket, isConnected]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Handle nearby providers update
    const handleNearbyProviders = (data) => {
      setNearbyProviders(data.providers || []);
    };

    // Handle individual provider location update
    const handleProviderUpdate = (data) => {
      setNearbyProviders(prev => {
        const index = prev.findIndex(p => p.providerId === data.providerId);
        if (index >= 0) {
          // Update existing provider
          const updated = [...prev];
          updated[index] = { ...updated[index], ...data };
          return updated;
        }
        // Don't add new providers via this event (they come from nearby_providers)
        return prev;
      });
    };

    // Handle location acknowledged
    const handleAcknowledged = (data) => {
      console.debug('Location acknowledged:', data.timestamp);
    };

    socket.on('nearby_providers', handleNearbyProviders);
    socket.on('provider_location_update', handleProviderUpdate);
    socket.on('location_acknowledged', handleAcknowledged);

    return () => {
      socket.off('nearby_providers', handleNearbyProviders);
      socket.off('provider_location_update', handleProviderUpdate);
      socket.off('location_acknowledged', handleAcknowledged);
    };
  }, [socket, isConnected]);

  // Auto-start for providers with location sharing enabled
  useEffect(() => {
    const accountType = user?.profileData?.accountType || user?.profile_data?.accountType;
    const autoShare = user?.profileData?.autoShareLocation || user?.profile_data?.autoShareLocation;
    
    if (role === 'provider' && accountType === 'provider' && autoShare) {
      startSharing();
    }

    return () => {
      if (isSharing) {
        stopSharing();
      }
    };
  }, [role, user, startSharing, stopSharing, isSharing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, []);

  return {
    // Provider functions
    startSharing,
    stopSharing,
    isSharing,
    currentLocation,
    
    // Client functions
    subscribeToArea,
    getNearbyProviders,
    nearbyProviders,
    
    // Common
    locationError,
    isConnected
  };
};

export default useRealtimeLocation;
