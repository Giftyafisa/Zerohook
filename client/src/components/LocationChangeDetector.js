import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectUser } from '../store/slices/authSlice';
import { calculateDistance } from '../config/locations';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Stack,
  Chip,
} from '@mui/material';
import {
  LocationOn as LocationIcon,
  MyLocation as GpsIcon,
  ArrowForward as ArrowIcon
} from '@mui/icons-material';

/**
 * LocationChangeDetector
 * 
 * Detects when a user's GPS location differs significantly from their stored
 * profile location and prompts them to update it.
 * 
 * This helps keep profile locations accurate for the recommendation algorithm.
 */
const LocationChangeDetector = ({ checkOnMount = true, thresholdKm = 50 }) => {
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  
  const [showPrompt, setShowPrompt] = useState(false);
  const [locationData, setLocationData] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  /**
   * Find nearest city from current location
   */
  const findNearestCity = useCallback(async (lat, lng) => {
    try {
      const response = await fetch(`/api/geolocation/nearest-city?lat=${lat}&lng=${lng}`);
      if (response.ok) {
        const data = await response.json();
        return data.city;
      }
    } catch (error) {
      console.error('Error finding nearest city:', error);
    }
    return null;
  }, []);

  /**
   * Check if user's location has changed significantly
   */
  const checkLocationChange = useCallback(async () => {
    if (!user || dismissed) return;

    // Don't check more than once per hour
    const lastCheck = localStorage.getItem('locationCheckTime');
    if (lastCheck && Date.now() - parseInt(lastCheck) < 60 * 60 * 1000) {
      return;
    }

    // Check if user already dismissed this session
    const dismissedUntil = localStorage.getItem('locationChangeDismissedUntil');
    if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
      return;
    }

    try {
      // Get current GPS location
      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('Geolocation not supported'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });

      const currentLat = position.coords.latitude;
      const currentLng = position.coords.longitude;
      
      localStorage.setItem('locationCheckTime', Date.now().toString());

      // Get user's stored location
      const profileData = user.profile_data || user.profileData || {};
      const storedLocation = profileData.location || {};
      
      let storedLat = storedLocation.coordinates?.lat;
      let storedLng = storedLocation.coordinates?.lng;
      
      // If no stored coordinates, user definitely needs to set location
      if (!storedLat || !storedLng) {
        // Try to find their current city
        const nearestCity = await findNearestCity(currentLat, currentLng);
        
        setLocationData({
          type: 'no_location',
          currentLat,
          currentLng,
          currentCity: nearestCity,
          message: 'We detected your location. Would you like to set it as your profile location?'
        });
        setShowPrompt(true);
        return;
      }

      // Calculate distance between current and stored location
      const distance = calculateDistance(currentLat, currentLng, storedLat, storedLng);
      
      if (distance > thresholdKm) {
        // Find nearest city to current location
        const nearestCity = await findNearestCity(currentLat, currentLng);
        
        setLocationData({
          type: 'location_change',
          currentLat,
          currentLng,
          storedLat,
          storedLng,
          distance: Math.round(distance),
          currentCity: nearestCity,
          storedCity: storedLocation.city,
          storedCountry: storedLocation.country,
          message: `You appear to be ${Math.round(distance)}km away from your profile location.`
        });
        setShowPrompt(true);
      }
    } catch (error) {
      console.log('Location check skipped:', error.message);
    }
  }, [user, dismissed, thresholdKm, findNearestCity]);

  // Check location on mount if enabled
  useEffect(() => {
    if (checkOnMount && user) {
      // Wait a bit before checking to not interrupt page load
      const timer = setTimeout(() => {
        checkLocationChange();
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [checkOnMount, user, checkLocationChange]);

  const handleUpdateLocation = () => {
    // Navigate to settings page with location data
    navigate('/settings', {
      state: {
        updateLocation: true,
        suggestedLocation: {
          lat: locationData.currentLat,
          lng: locationData.currentLng,
          city: locationData.currentCity
        }
      }
    });
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    // Dismiss for 7 days
    const dismissUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    localStorage.setItem('locationChangeDismissedUntil', dismissUntil.toISOString());
    setDismissed(true);
    setShowPrompt(false);
  };

  const handleRemindLater = () => {
    // Dismiss for 24 hours
    const dismissUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    localStorage.setItem('locationChangeDismissedUntil', dismissUntil.toISOString());
    setShowPrompt(false);
  };

  if (!user || !showPrompt) {
    return null;
  }

  return (
    <Dialog
      open={showPrompt}
      onClose={handleRemindLater}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <GpsIcon color="primary" />
          <Typography variant="h6">
            {locationData?.type === 'no_location' 
              ? 'Set Your Location' 
              : 'Did You Move?'}
          </Typography>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        <Stack spacing={3}>
          <Typography variant="body1">
            {locationData?.message}
          </Typography>

          {locationData?.type === 'location_change' && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
              <Chip
                icon={<LocationIcon />}
                label={locationData.storedCity || 'Previous location'}
                color="default"
                variant="outlined"
              />
              <ArrowIcon color="action" />
              <Chip
                icon={<GpsIcon />}
                label={locationData.currentCity || 'Current location'}
                color="primary"
                variant="filled"
              />
            </Box>
          )}

          {locationData?.type === 'no_location' && locationData.currentCity && (
            <Box sx={{ textAlign: 'center' }}>
              <Chip
                icon={<GpsIcon />}
                label={locationData.currentCity}
                color="primary"
                size="large"
              />
            </Box>
          )}

          <Alert severity="info">
            <Typography variant="body2">
              <strong>Why this matters:</strong> Keeping your location updated helps nearby users find you.
              Profiles with accurate locations get more views and messages!
            </Typography>
          </Alert>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleDismiss} color="inherit">
          Don't Ask Again
        </Button>
        <Button onClick={handleRemindLater}>
          Remind Me Later
        </Button>
        <Button 
          onClick={handleUpdateLocation} 
          variant="contained" 
          startIcon={<LocationIcon />}
        >
          Update Location
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default LocationChangeDetector;
