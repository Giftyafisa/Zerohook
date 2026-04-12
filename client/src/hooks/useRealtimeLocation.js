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

const GEOLOCATION_TIMEOUT_CODE = 3;

const useRealtimeLocation = (options = {}) => {
  const { 
    updateInterval = 15000,    // Update frequency (ms) - 15 seconds default
    enableHighAccuracy = true  // GPS accuracy preference
  } = options;

  const { socket, isConnected } = useSocket();
  
  // State
  const [isSharing, setIsSharing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [nearbyProviders, setNearbyProviders] = useState([]);
  const [locationError, setLocationError] = useState(null);
  
  // Refs for cleanup
  const watchIdRef = useRef(null);
  const updateIntervalRef = useRef(null);
  const lastUpdateRef = useRef(null);
  const isStartingRef = useRef(false);

  const isGeolocationTimeout = useCallback((error) => {
    return Number(error?.code) === GEOLOCATION_TIMEOUT_CODE;
  }, []);

  /**
   * Get current position with promise wrapper
   */
  const getCurrentPosition = useCallback((overrideOptions = {}) => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      const geolocationOptions = {
        enableHighAccuracy,
        timeout: 12000,
        maximumAge: 45000,
        ...overrideOptions,
      };

      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        geolocationOptions
      );
    });
  }, [enableHighAccuracy]);

  const getCurrentPositionWithFallback = useCallback(async () => {
    try {
      return await getCurrentPosition();
    } catch (error) {
      if (!isGeolocationTimeout(error)) {
        throw error;
      }

      // Timeout fallback: allow cached/coarse location before failing the cycle.
      return getCurrentPosition({
        enableHighAccuracy: false,
        timeout: 20000,
        maximumAge: 180000,
      });
    }
  }, [getCurrentPosition, isGeolocationTimeout]);

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

    if (isSharing || isStartingRef.current) {
      return true;
    }

    isStartingRef.current = true;

    try {
      // Clear previous listeners/timers defensively to avoid duplicate streams.
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }

      // Get initial position
      const position = await getCurrentPositionWithFallback();
      await sendLocationUpdate(position);
      
      // Start watching position
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          sendLocationUpdate(pos);
        },
        (error) => {
          if (isGeolocationTimeout(error)) {
            console.debug('Location watch timed out; continuing with next cycle.');
            return;
          }

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
          const pos = await getCurrentPositionWithFallback();
          sendLocationUpdate(pos);
        } catch (err) {
          if (isGeolocationTimeout(err)) {
            console.debug('Interval location fetch timed out; retrying on next interval.');
            return;
          }
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
      const message = isGeolocationTimeout(error)
        ? 'Location request timed out. Please try moving to an open area or disable high-accuracy mode.'
        : error.message;
      setLocationError(message);
      return false;
    } finally {
      isStartingRef.current = false;
    }
  }, [
    getCurrentPositionWithFallback,
    sendLocationUpdate,
    socket,
    isConnected,
    enableHighAccuracy,
    updateInterval,
    isGeolocationTimeout,
    isSharing,
  ]);

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

    isStartingRef.current = false;

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (navigator.geolocation && watchIdRef.current !== null) {
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
