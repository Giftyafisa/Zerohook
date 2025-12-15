import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Chip,
  Button,
  TextField,
  CircularProgress,
  IconButton,
  Avatar,
  Skeleton,
  Fade,
  InputAdornment,
  Tooltip,
  useTheme,
  useMediaQuery,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider
} from '@mui/material';
import {
  LocationOn,
  Verified,
  FavoriteBorder,
  Favorite,
  Message,
  Search,
  Close,
  Star,
  Whatshot,
  NearMe,
  Speed,
  MyLocation,
  EditLocation,
  CheckCircle,
  AccessTime
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSelector } from 'react-redux';
import { selectIsSubscribed, selectUser } from '../store/slices/authSlice';
import { isProvider, ACCOUNT_TYPES } from '../utils/accountTypeUtils';
import { selectUserCountry, selectDetectedCountry, selectExchangeRates } from '../store/slices/countrySlice';
import { API_BASE_URL, getUploadUrl } from '../config/constants';
import { LOCATIONS } from '../config/locations';
import { resolveProfileImage } from '../utils/imageUtils';
import { VERIFICATION_TIERS, getVerificationTierConfig } from '../components/ui/StatusBadge';

// Get all locations from user's country (or default to Ghana/Nigeria)
const getAllLocations = (countryCode) => {
  // Handle both string codes ('GH', 'gh') and country objects {code: 'GH', name: 'Ghana'}
  const code = typeof countryCode === 'string' ? countryCode : countryCode?.code;
  const countryKey = code?.toLowerCase() || 'ghana';
  const countryData = LOCATIONS[countryKey];
  
  if (!countryData) return [];
  
  // Flatten location data structure
  if (countryData.cities) {
    return countryData.cities;
  } else if (countryData.states) {
    return countryData.states.flatMap(state => state.cities || []);
  }
  return [];
};
// ============================================
// LOCATION PICKER COMPONENT
// ============================================
const LocationPicker = ({ open, onClose, onSelectLocation, currentLocation, countryCode }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);

  // Get locations for user's country
  const availableLocations = useMemo(() => getAllLocations(countryCode), [countryCode]);

  const filteredLocations = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show popular locations first, or first 15 locations
      const popular = availableLocations.filter(loc => loc.popular);
      return (popular.length > 0 ? popular : availableLocations).slice(0, 15);
    }
    const query = searchQuery.toLowerCase();
    return availableLocations.filter(loc =>
      loc.name.toLowerCase().includes(query) ||
      (loc.district && loc.district.toLowerCase().includes(query)) ||
      (loc.region && loc.region.toLowerCase().includes(query))
    ).slice(0, 20);
  }, [searchQuery, availableLocations]);

  const handleGPSLocation = async () => {
    setGpsLoading(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      
      const { latitude, longitude } = position.coords;
      
      // Haversine formula for accurate distance calculation
      const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth's radius in km
        const toRad = (deg) => deg * (Math.PI / 180);
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = 
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c; // Distance in km
      };
      
      // Find nearest location from available locations
      let nearestLocation = null;
      let minDistance = Infinity;
      
      availableLocations.forEach(loc => {
        const locLat = loc.coordinates?.lat || loc.lat;
        const locLng = loc.coordinates?.lng || loc.lng;
        if (locLat && locLng) {
          const dist = calculateDistance(latitude, longitude, locLat, locLng);
          if (dist < minDistance) {
            minDistance = dist;
            nearestLocation = loc;
          }
        }
      });

      if (nearestLocation) {
        const selectedLocation = {
          ...nearestLocation,
          lat: latitude,
          lng: longitude,
          method: 'gps',
          precision: 'exact'
        };
        console.log(`📍 GPS Location Selected: ${nearestLocation.name}`, 
          `\n   Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          `\n   Nearest Location Distance: ${minDistance.toFixed(2)} km`);
        onSelectLocation(selectedLocation);
      }
      onClose();
    } catch (error) {
      console.error('GPS Error:', error);
      alert('Could not get GPS location. Please select manually.');
    } finally {
      setGpsLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="sm"
      PaperProps={{
        sx: {
          bgcolor: '#1a1a2e',
          color: '#fff',
          borderRadius: 3,
          maxHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.1)'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditLocation sx={{ color: '#00f2ea' }} />
          <Typography variant="h6">Select Your Location</Typography>
        </Box>
        <IconButton 
          onClick={onClose} 
          sx={{ color: 'rgba(255,255,255,0.6)' }}
          aria-label="Close location picker"
        >
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 2 }}>
        {/* GPS Button */}
        <Button
          fullWidth
          variant="outlined"
          startIcon={gpsLoading ? <CircularProgress size={20} /> : <MyLocation />}
          onClick={handleGPSLocation}
          disabled={gpsLoading}
          sx={{
            mb: 2,
            py: 1.5,
            borderColor: '#00f2ea',
            color: '#00f2ea',
            '&:hover': {
              borderColor: '#00d4aa',
              bgcolor: 'rgba(0,242,234,0.1)',
            }
          }}
        >
          {gpsLoading ? 'Detecting...' : 'Use My Current GPS Location'}
        </Button>

        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            Or select manually
          </Typography>
        </Divider>

        {/* Search Box */}
        <TextField
          fullWidth
          placeholder="Search town or area..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{
            mb: 2,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.05)',
              color: '#fff',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
              '&.Mui-focused fieldset': { borderColor: '#00f2ea' },
            },
            '& .MuiInputBase-input::placeholder': {
              color: 'rgba(255,255,255,0.4)',
            }
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: 'rgba(255,255,255,0.4)' }} />
              </InputAdornment>
            )
          }}
        />

        {/* Location List */}
        <List sx={{ maxHeight: 300, overflow: 'auto' }}>
          {filteredLocations.map((location, index) => {
            const isSelected = currentLocation?.name === location.name;
            return (
              <ListItem key={`${location.name}-${index}`} disablePadding>
                <ListItemButton
                  onClick={() => {
                    onSelectLocation({
                      ...location,
                      method: 'manual',
                      precision: 'town'
                    });
                    onClose();
                  }}
                  sx={{
                    borderRadius: 2,
                    mb: 0.5,
                    bgcolor: isSelected ? 'rgba(0,242,234,0.15)' : 'transparent',
                    '&:hover': {
                      bgcolor: 'rgba(0,242,234,0.1)',
                    }
                  }}
                >
                  <ListItemIcon>
                    {isSelected ? (
                      <CheckCircle sx={{ color: '#00f2ea' }} />
                    ) : (
                      <LocationOn sx={{ color: 'rgba(255,255,255,0.5)' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={location.name}
                    secondary={`${location.district}, ${location.region}`}
                    primaryTypographyProps={{
                      sx: { color: isSelected ? '#00f2ea' : '#fff', fontWeight: isSelected ? 600 : 400 }
                    }}
                    secondaryTypographyProps={{
                      sx: { color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }
                    }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </DialogContent>
    </Dialog>
  );
};

// ============================================
// ACTIVITY TRACKER - Sends to Backend
// ============================================

class ActivityTracker {
  constructor() {
    this.viewedProfiles = new Set();
    this.dwellTime = new Map();
    this.pendingActivities = [];
    this.flushInterval = null;
  }

  init() {
    // Flush activities every 30 seconds
    this.flushInterval = setInterval(() => this.flush(), 30000);
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush(); // Final flush
  }

  async trackActivity(actionType, actionData) {
    const token = localStorage.getItem('token');
    if (!token) return; // Only track for authenticated users

    this.pendingActivities.push({ actionType, actionData, timestamp: Date.now() });

    // Immediate flush for important actions
    if (['like', 'message', 'save'].includes(actionType)) {
      await this.flush();
    }
  }

  async flush() {
    if (this.pendingActivities.length === 0) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    const activities = [...this.pendingActivities];
    this.pendingActivities = [];

    try {
      for (const activity of activities) {
        await fetch(`${API_BASE_URL}/users/track-activity`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify(activity),
        });
      }
    } catch (error) {
      console.error('Failed to track activities:', error);
      // Re-queue failed activities
      this.pendingActivities.push(...activities);
    }
  }

  trackView(profileId, duration = 0) {
    this.viewedProfiles.add(profileId);
    this.dwellTime.set(profileId, (this.dwellTime.get(profileId) || 0) + duration);
    
    if (duration > 3000) { // Only track views > 3 seconds
      this.trackActivity('profile_view', { 
        profileId, 
        duration,
        depth: this.dwellTime.get(profileId) 
      });
    }
  }

  trackLike(profileId, isLiked) {
    this.trackActivity('like', { profileId, action: isLiked ? 'add' : 'remove' });
  }

  trackMessage(profileId) {
    this.trackActivity('message', { profileId });
  }

  trackSearch(query, filters) {
    this.trackActivity('search', { query, filters });
  }

  trackFilter(filterType, filterValue) {
    this.trackActivity('filter', { filterType, filterValue });
  }
}

// Global activity tracker
const activityTracker = new ActivityTracker();

// ============================================
// SIMPLE FILTER CHIPS COMPONENT
// ============================================

const FilterChips = ({ activeFilter, onFilterChange, filters }) => {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        gap: { xs: 0.5, sm: 1 }, 
        overflowX: 'auto',
        py: { xs: 0.5, sm: 1 },
        px: 0.5,
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
      }}
    >
      {filters.map((filter) => (
        <Chip
          key={filter.id}
          icon={filter.icon}
          label={filter.label}
          onClick={() => onFilterChange(filter.id)}
          size="small"
          sx={{
            borderRadius: '16px',
            fontWeight: 600,
            fontSize: { xs: '0.75rem', sm: '0.85rem' },
            px: { xs: 0.5, sm: 1 },
            height: { xs: 28, sm: 32 },
            transition: 'all 0.2s ease',
            background: activeFilter === filter.id 
              ? 'linear-gradient(135deg, #00f2ea 0%, #00d4aa 100%)'
              : 'rgba(255,255,255,0.08)',
            color: activeFilter === filter.id ? '#000' : '#fff',
            border: activeFilter === filter.id 
              ? 'none' 
              : '1px solid rgba(255,255,255,0.15)',
            '&:hover': {
              background: activeFilter === filter.id 
                ? 'linear-gradient(135deg, #00f2ea 0%, #00d4aa 100%)'
                : 'rgba(255,255,255,0.15)',
              transform: 'scale(1.02)',
            },
            '& .MuiChip-icon': {
              color: activeFilter === filter.id ? '#000' : '#00f2ea',
              fontSize: { xs: '14px', sm: '18px' },
            }
          }}
        />
      ))}
    </Box>
  );
};

// ============================================
// PROFILE CARD COMPONENT (Clean Design)
// ============================================

const ProfileCard = ({ 
  profile, 
  onLike, 
  onMessage, 
  onClick, 
  isLiked,
  index,
  onView 
}) => {
  const cardRef = useRef(null);
  const viewStartTime = useRef(null);

  // Track view time
  useEffect(() => {
    viewStartTime.current = Date.now();
    
    return () => {
      if (viewStartTime.current) {
        const duration = Date.now() - viewStartTime.current;
        activityTracker.trackView(profile.id, duration);
      }
    };
  }, [profile.id]);

  // Intersection observer for view tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            onView?.(profile.id);
          }
        });
      },
      { threshold: [0.5] }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [profile.id, onView]);

  const profileData = profile.profileData || {};
  const displayName = profileData.firstName || profile.username || 'User';
  const age = profileData.age || '??';
  const city = profileData.location?.city || 'Unknown';
  const country = profileData.location?.country || '';
  const bio = profileData.bio || 'No bio available';
  const price = profile.displayPrice?.amount ?? profileData.basePrice ?? 0;
  const priceSymbol = profile.displayPrice?.symbol || profile.displayPrice?.currency || '$';
  const isPriceConverted = Boolean(profile.displayPrice && profile.displayPrice.currency && profile.displayPrice.currency !== 'USD');
  const isOnline = profile.isOnline; // From backend
  const lastActive = profile.lastActive; // From backend
  const verificationTier = profile.verificationTier || 1;
  const distance = profile.distance; // From backend recommendation engine
  const successRate = profile.successRate; // From backend
  const distanceLabel = distance != null ? (profile.distanceEstimated ? `${distance}km est` : `${distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}`) : null;

  // Helper function to format last active time
  const formatLastActive = (lastActiveDate) => {
    if (!lastActiveDate) return null;
    const date = new Date(lastActiveDate);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return `${Math.floor(diffDays / 7)}w ago`;
  };

  // Get profile image using shared utility
  const profileImage = resolveProfileImage(profileData);

  return (
    <Fade in timeout={300 + index * 50}>
      <Card
        ref={cardRef}
        onClick={() => onClick(profile)}
        sx={{
          background: 'linear-gradient(145deg, rgba(30,30,35,0.95) 0%, rgba(20,20,25,0.98) 100%)',
          backdropFilter: 'blur(20px)',
          borderRadius: '20px',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          border: '1px solid rgba(255,255,255,0.08)',
          position: 'relative',
          '&:hover': {
            transform: 'translateY(-8px) scale(1.02)',
            boxShadow: '0 20px 40px rgba(0,242,234,0.15)',
            border: '1px solid rgba(0,242,234,0.3)',
          },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: verificationTier >= 3 
              ? 'linear-gradient(90deg, #FFD700, #FFA500)'
              : verificationTier >= 2 
                ? 'linear-gradient(90deg, #00f2ea, #00d4aa)'
                : 'transparent',
          }
        }}
      >
        {/* Profile Image Section */}
        <Box sx={{ position: 'relative', pt: '100%' }}>
          {profileImage ? (
            <Box
              component="img"
              src={profileImage}
              alt={displayName}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            <Avatar
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                fontSize: '4rem',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 0,
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </Avatar>
          )}
          
          {/* Online Indicator */}
          {isOnline && (
            <Box
              sx={{
                position: 'absolute',
                top: 12,
                left: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                bgcolor: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                borderRadius: '12px',
                px: 1,
                py: 0.5,
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: '#4ade80',
                  boxShadow: '0 0 8px #4ade80',
                  animation: 'pulse 2s infinite',
                  '@keyframes pulse': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0.5 },
                  },
                }}
              />
              <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>
                Online
              </Typography>
            </Box>
          )}

          {/* Last Active Indicator - Show when offline */}
          {!isOnline && lastActive && formatLastActive(lastActive) && (
            <Tooltip title={`Last seen: ${new Date(lastActive).toLocaleString()}`} arrow placement="right">
              <Box
                sx={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  bgcolor: 'rgba(0,0,0,0.6)',
                  backdropFilter: 'blur(4px)',
                  borderRadius: '12px',
                  px: 1,
                  py: 0.5,
                }}
              >
                <AccessTime sx={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }} />
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>
                  {formatLastActive(lastActive)}
                </Typography>
              </Box>
            </Tooltip>
          )}

          {/* Distance Badge - Only show if we have distance data */}
          {distance !== null && distance !== undefined && (
            <Box
              sx={{
                position: 'absolute',
                top: 48, // Always below online/last-active indicator
                left: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                bgcolor: 'rgba(0,242,234,0.2)',
                backdropFilter: 'blur(4px)',
                borderRadius: '12px',
                px: 1,
                py: 0.5,
                border: '1px solid rgba(0,242,234,0.3)',
              }}
            >
              <NearMe sx={{ fontSize: 12, color: '#00f2ea' }} />
              <Typography variant="caption" sx={{ color: '#00f2ea', fontWeight: 600 }}>
                {distanceLabel}
              </Typography>
            </Box>
          )}

          {/* Verification Badge - Enhanced with tier label */}
          {verificationTier >= 2 && (
            <Box
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                bgcolor: verificationTier >= 3 ? 'rgba(255, 215, 0, 0.9)' : 'rgba(0, 242, 234, 0.9)',
                backdropFilter: 'blur(4px)',
                borderRadius: '20px',
                px: 1,
                py: 0.5,
                boxShadow: verificationTier >= 3 
                  ? '0 0 10px rgba(255, 215, 0, 0.5)' 
                  : '0 0 10px rgba(0, 242, 234, 0.5)',
              }}
            >
              <Verified sx={{ fontSize: 16, color: '#000' }} />
              <Typography 
                sx={{ 
                  fontSize: '0.7rem', 
                  fontWeight: 700, 
                  color: '#000',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                {getVerificationTierConfig(verificationTier).label}
              </Typography>
            </Box>
          )}

          {/* Price Tag */}
          {price > 0 && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                bgcolor: 'rgba(0,0,0,0.7)',
                backdropFilter: 'blur(4px)',
                borderRadius: '10px',
                px: 1.5,
                py: 0.5,
              }}
            >
              <Typography variant="body2" sx={{ color: '#00f2ea', fontWeight: 700 }}>
                {`${priceSymbol}${Number(price).toFixed(2)}`}{isPriceConverted ? ' *' : ''}
              </Typography>
            </Box>
          )}

          {/* Like Button */}
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onLike(profile.id);
              activityTracker.trackLike(profile.id, !isLiked);
            }}
            aria-label={isLiked ? 'Remove from favorites' : 'Add to favorites'}
            title={isLiked ? 'Remove from favorites' : 'Add to favorites'}
            sx={{
              position: 'absolute',
              bottom: 12,
              left: 12,
              bgcolor: 'rgba(0,0,0,0.6)',
              backdropFilter: 'blur(4px)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
            }}
          >
            {isLiked ? (
              <Favorite sx={{ color: '#ff4757', fontSize: 22 }} />
            ) : (
              <FavoriteBorder sx={{ color: '#fff', fontSize: 22 }} />
            )}
          </IconButton>
        </Box>

        {/* Profile Info */}
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Box>
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700, 
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                {displayName}, {age}
              </Typography>
              <Typography 
                variant="body2" 
                sx={{ 
                  color: 'rgba(255,255,255,0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <LocationOn sx={{ fontSize: 14 }} />
                {city}{country ? `, ${country}` : ''}
              </Typography>
            </Box>
            
            {/* Trust Score & Success Rate */}
            <Box sx={{ textAlign: 'right' }}>
              <Tooltip 
                title={
                  <Box sx={{ p: 0.5 }}>
                    <Typography sx={{ fontWeight: 700, mb: 0.5, fontSize: '0.8rem' }}>Trust Score Breakdown</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                        <Typography sx={{ fontSize: '0.7rem' }}>Verification</Typography>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600 }}>{verificationTier >= 3 ? 'Elite' : verificationTier >= 2 ? 'Verified' : 'Basic'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                        <Typography sx={{ fontSize: '0.7rem' }}>Success Rate</Typography>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600 }}>{successRate ? `${Math.round(parseFloat(successRate))}%` : 'N/A'}</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                        <Typography sx={{ fontSize: '0.7rem' }}>Response Time</Typography>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600 }}>Fast</Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                        <Typography sx={{ fontSize: '0.7rem' }}>Disputes</Typography>
                        <Typography sx={{ fontSize: '0.7rem', fontWeight: 600 }}>0</Typography>
                      </Box>
                    </Box>
                  </Box>
                }
                arrow
                placement="left"
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}>
                  <Star sx={{ fontSize: 16, color: '#FFD700' }} />
                  <Typography variant="body2" sx={{ color: '#FFD700', fontWeight: 600 }}>
                    {Math.round(parseFloat(profile.trustScore) || 75)}%
                  </Typography>
                </Box>
              </Tooltip>
              {successRate && parseFloat(successRate) > 0 && (
                <Tooltip title="Success Rate" arrow placement="left">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5, justifyContent: 'flex-end' }}>
                    <Speed sx={{ fontSize: 12, color: '#4ade80' }} />
                    <Typography variant="caption" sx={{ color: '#4ade80', fontWeight: 500 }}>
                      {Math.round(parseFloat(successRate))}%
                    </Typography>
                  </Box>
                </Tooltip>
              )}
            </Box>
          </Box>

          {/* Bio snippet */}
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'rgba(255,255,255,0.7)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              mb: 1.5,
              minHeight: '2.6em',
            }}
          >
            {bio}
          </Typography>

          {/* Action Button */}
          <Button
            fullWidth
            variant="contained"
            startIcon={<Message />}
            onClick={(e) => {
              e.stopPropagation();
              onMessage(profile);
              activityTracker.trackMessage(profile.id);
            }}
            sx={{
              background: 'linear-gradient(135deg, #00f2ea 0%, #00d4aa 100%)',
              color: '#000',
              fontWeight: 700,
              borderRadius: '12px',
              py: 1,
              '&:hover': {
                background: 'linear-gradient(135deg, #00d4aa 0%, #00f2ea 100%)',
                transform: 'scale(1.02)',
              },
            }}
          >
            Message
          </Button>
        </CardContent>
      </Card>
    </Fade>
  );
};

// ============================================
// SKELETON LOADER
// ============================================

const ProfileSkeleton = () => (
  <Card
    sx={{
      background: 'rgba(30,30,35,0.8)',
      borderRadius: '20px',
      overflow: 'hidden',
    }}
  >
    <Skeleton variant="rectangular" sx={{ pt: '100%' }} animation="wave" />
    <CardContent>
      <Skeleton width="60%" height={24} animation="wave" />
      <Skeleton width="40%" height={16} animation="wave" sx={{ mt: 1 }} />
      <Skeleton width="100%" height={40} animation="wave" sx={{ mt: 2 }} />
      <Skeleton width="100%" height={36} animation="wave" sx={{ mt: 1.5, borderRadius: '12px' }} />
    </CardContent>
  </Card>
);

// ============================================
// SUBSCRIPTION PAYWALL COMPONENT
// ============================================

const SubscriptionPaywall = ({ onSubscribe }) => {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Card
        sx={{
          maxWidth: 500,
          width: '100%',
          background: 'rgba(30,30,35,0.95)',
          borderRadius: '24px',
          border: '1px solid rgba(0,242,234,0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Header with gradient */}
        <Box
          sx={{
            background: 'linear-gradient(135deg, #00f2ea 0%, #00d4aa 100%)',
            py: 4,
            px: 3,
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              bgcolor: 'rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
            }}
          >
            <Verified sx={{ fontSize: 48, color: '#fff' }} />
          </Box>
          <Typography variant="h5" sx={{ color: '#000', fontWeight: 800, mb: 1 }}>
            Subscription Required
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(0,0,0,0.7)' }}>
            Get full access to verified profiles
          </Typography>
        </Box>

        <CardContent sx={{ p: 4 }}>
          {/* Benefits */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle2" sx={{ color: '#00f2ea', mb: 2, fontWeight: 600 }}>
              SUBSCRIPTION BENEFITS:
            </Typography>
            {[
              'Browse unlimited verified profiles',
              'Send unlimited messages',
              'See who viewed your profile',
              'Priority support & assistance',
              'Access to premium features',
              'Location-based matching',
            ].map((benefit, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                <CheckCircle sx={{ color: '#4ade80', fontSize: 20 }} />
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  {benefit}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* CTA Button */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={() => navigate('/subscription')}
            sx={{
              background: 'linear-gradient(135deg, #00f2ea 0%, #00d4aa 100%)',
              color: '#000',
              fontWeight: 700,
              py: 1.5,
              borderRadius: '12px',
              fontSize: '1rem',
              '&:hover': {
                background: 'linear-gradient(135deg, #00d4aa 0%, #00f2ea 100%)',
                transform: 'scale(1.02)',
              },
            }}
          >
            Subscribe Now
          </Button>

          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.4)',
              mt: 2,
            }}
          >
            Secure payment • Cancel anytime
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

// ============================================
// MAIN PROFILE FEED COMPONENT
// ============================================

const ProfileFeed = () => {
  const isMobile = useMediaQuery(useTheme().breakpoints.down('sm'));
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated } = useAuth();
  const isSubscribed = useSelector(selectIsSubscribed);
  const reduxUser = useSelector(selectUser);
  const userCountry = useSelector(selectUserCountry);
  const detectedCountry = useSelector(selectDetectedCountry);
  const exchangeRates = useSelector(selectExchangeRates);

  // State - ALL hooks must be called unconditionally
  const [displayedProfiles, setDisplayedProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [likedProfiles, setLikedProfiles] = useState(new Set());
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  
  const loadMoreRef = useRef(null);
  // AbortController for fetch cancellation - prevents race conditions
  const abortControllerRef = useRef(null);
  // Request ID to ignore stale responses
  const requestIdRef = useRef(0);

  const locationLabel = useMemo(() => {
    if (!userLocation) return null;
    const name = userLocation.city || userLocation.name || 'Location enabled';
    return userLocation.source ? `${name} • ${userLocation.source}` : name;
  }, [userLocation]);

  const convertPrice = useCallback((basePriceUSD) => {
    const countryCode = (userLocation?.countryCode || userCountry?.code || detectedCountry?.code || '').toUpperCase();
    const rateEntry = countryCode && exchangeRates ? exchangeRates[countryCode] : null;

    if (rateEntry && basePriceUSD != null) {
      const amount = Math.round(parseFloat(basePriceUSD) * rateEntry.rate * 100) / 100;
      return { amount, currency: rateEntry.currency, symbol: rateEntry.symbol, originalAmount: basePriceUSD, baseCurrency: 'USD' };
    }

    if (basePriceUSD != null) {
      return { amount: parseFloat(basePriceUSD), currency: 'USD', symbol: '$', originalAmount: basePriceUSD, baseCurrency: 'USD' };
    }

    return null;
  }, [userLocation?.countryCode, userCountry?.code, detectedCountry?.code, exchangeRates]);

  // Initialize activity tracker
  useEffect(() => {
    activityTracker.init();
    return () => activityTracker.destroy();
  }, []);

  // Get user's location on mount - works for both authenticated and public users
  useEffect(() => {
    /**
     * Build profile-based location (used when user prefers profile location)
     */
    const buildProfileLocation = () => {
      const location = reduxUser?.profile_data?.location;
      if (!location) return null;

      const coords = location.coordinates || location.coords || {};
      const hasCoords = coords.lat != null && coords.lng != null && !isNaN(coords.lat) && !isNaN(coords.lng);

      return {
        lat: hasCoords ? parseFloat(coords.lat) : null,
        lng: hasCoords ? parseFloat(coords.lng) : null,
        city: location.city || location.name,
        country: location.country,
        countryCode: location.countryCode,
        source: 'profile',
        accuracy: hasCoords ? 'city' : 'country',
        confidence: hasCoords ? 0.9 : 0.7
      };
    };

    /**
     * Get IP-based location via backend proxy (no exposed API key)
     */
    const getIPLocation = async () => {
      try {
        const token = localStorage.getItem('token');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const response = await fetch(`${API_BASE_URL}/geolocation/ip-detect`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({}),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const body = await response.json();
          const ipData = body?.data;
          if (ipData) {
            return {
              lat: ipData.lat ?? ipData.latitude ?? null,
              lng: ipData.lng ?? ipData.longitude ?? null,
              city: ipData.city,
              country: ipData.country,
              countryCode: ipData.countryCode,
              region: ipData.region,
              source: ipData.source || 'ip-proxy',
              confidence: ipData.confidence ?? 'medium'
            };
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log('IP geolocation timed out');
        } else {
          console.error('IP geolocation failed:', error);
        }
      }
      return null;
    };

    const getUserLocation = async () => {
      setLocationLoading(true);

      // Set a maximum timeout to prevent infinite loading
      const locationTimeout = setTimeout(() => {
        console.log('📍 Location detection timed out, proceeding without location');
        setLocationLoading(false);
      }, 10000); // 10 second max

      // Check for saved manual location first
      const savedLocation = localStorage.getItem('userManualLocation');
      if (savedLocation) {
        try {
          const parsed = JSON.parse(savedLocation);
          setUserLocation({ ...parsed, source: 'manual' });
          setLocationLoading(false);
          clearTimeout(locationTimeout);
          console.log('📍 Using saved manual location:', parsed.city);
          return;
        } catch (e) {
          localStorage.removeItem('userManualLocation');
        }
      }

      const profilePreferred = Boolean(reduxUser?.profile_data?.location?.preferProfileLocation);
      const profileLocation = buildProfileLocation();

      // Respect user preference to rely on profile location first
      if (profilePreferred && profileLocation) {
        setUserLocation({ ...profileLocation, source: 'profile-preferred' });
        setLocationLoading(false);
        clearTimeout(locationTimeout);
        return;
      }

      // Start IP detection immediately (as backup)
      const ipLocationPromise = getIPLocation();

      // Try browser geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(locationTimeout);
            // GPS success - use precise location
            const gpsLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              city: 'Current Location',
              country: userCountry || detectedCountry || 'Unknown',
              source: 'gps',
              confidence: 1.0
            };
            setUserLocation(gpsLocation);
            setLocationLoading(false);
            console.log('📍 FRESH GPS location:', gpsLocation.lat, gpsLocation.lng, '(accuracy:', gpsLocation.accuracy, 'm)');
          },
          async (error) => {
            clearTimeout(locationTimeout);
            console.log('Geolocation denied/blocked, using profile/IP detection:', error.message);

            if (profileLocation) {
              setUserLocation(profileLocation);
              setLocationLoading(false);
              return;
            }

            const ipLocation = await ipLocationPromise;
            if (ipLocation) {
              setUserLocation(ipLocation);
              console.log('📍 IP-based location:', ipLocation.city, ipLocation.country);
            }
            setLocationLoading(false);
          },
          { 
            enableHighAccuracy: false, // Use network location (faster) instead of GPS
            timeout: 8000, // 8 second timeout
            maximumAge: 60000 // Allow cached location up to 1 minute
          }
        );
      } else {
        // No geolocation support, use profile preference or IP
        clearTimeout(locationTimeout);
        if (profileLocation) {
          setUserLocation(profileLocation);
          setLocationLoading(false);
          return;
        }

        const ipLocation = await ipLocationPromise;
        if (ipLocation) {
          setUserLocation(ipLocation);
        }
        setLocationLoading(false);
      }
    };

    getUserLocation();
  }, [reduxUser, userCountry, detectedCountry]); // Removed auth dependencies - location works for everyone

  // Function to set manual location (for testing or when GPS blocked) - not currently used but available
  // const setManualLocation = useCallback((locationKey) => {
  //   const KNOWN_LOCATIONS = {
  //     'tema-west-adjei-kojo': { lat: 5.6647, lng: -0.0175, city: 'Tema West (Adjei-Kojo)', country: 'Ghana' },
  //     'tema-community-1': { lat: 5.6698, lng: -0.0166, city: 'Tema Community 1', country: 'Ghana' },
  //     'accra-central': { lat: 5.5560, lng: -0.1969, city: 'Accra Central', country: 'Ghana' },
  //     'osu': { lat: 5.5571, lng: -0.1818, city: 'Osu', country: 'Ghana' },
  //     'east-legon': { lat: 5.6350, lng: -0.1550, city: 'East Legon', country: 'Ghana' },
  //     'madina': { lat: 5.6700, lng: -0.1650, city: 'Madina', country: 'Ghana' },
  //     'spintex': { lat: 5.6350, lng: -0.0850, city: 'Spintex', country: 'Ghana' },
  //   };
  //   
  //   const location = KNOWN_LOCATIONS[locationKey];
  //   if (location) {
  //     const manualLocation = { ...location, source: 'manual' };
  //     setUserLocation(manualLocation);
  //     localStorage.setItem('userManualLocation', JSON.stringify(manualLocation));
  //     console.log('📍 Manual location set:', location.city);
  //     // Refresh profiles with new location
  //     setPage(1);
  //     setProfiles([]);
  //     setDisplayedProfiles([]);
  //   }
  // }, []);

  // Filter options - Simple and clean
  const filterOptions = useMemo(() => [
    { id: 'all', label: 'For You', icon: <Whatshot sx={{ fontSize: 18 }} /> },
    { id: 'nearby', label: 'Nearby', icon: <LocationOn sx={{ fontSize: 18 }} /> },
    { id: 'online', label: 'Online', icon: <AccessTime sx={{ fontSize: 18 }} /> },
    { id: 'verified', label: 'Verified', icon: <Verified sx={{ fontSize: 18 }} /> },
    { id: 'trending', label: 'Top Rated', icon: <Star sx={{ fontSize: 18 }} /> },
  ], []);

  // Fetch profiles from backend recommendation engine
  // Public access: Shows public profiles to everyone
  // Authenticated users see all profiles (public + authenticated-only)
  const fetchProfiles = useCallback(async (pageNum = 1, append = false) => {
    // Cancel any in-flight request to prevent race conditions
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    // Track this request to ignore stale responses
    const currentRequestId = ++requestIdRef.current;
    
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const queryParams = new URLSearchParams({
        page: pageNum.toString(),
        limit: '24',
        filter: activeFilter,
        search: searchQuery,
      });

      // Add location data if available for distance-based recommendations
      if (userLocation) {
        // Validate coordinates before sending
        if (userLocation.lat != null && userLocation.lng != null && 
            !isNaN(userLocation.lat) && !isNaN(userLocation.lng)) {
          queryParams.set('userLat', parseFloat(userLocation.lat).toFixed(6));
          queryParams.set('userLng', parseFloat(userLocation.lng).toFixed(6));
        }
        // Also send city and country for country-first filtering
        if (userLocation.city) {
          queryParams.set('userCity', userLocation.city);
        }
        if (userLocation.country) {
          queryParams.set('userCountry', userLocation.country);
        }
        if (userLocation.source) {
          queryParams.set('locationSource', userLocation.source);
        }
        if (userLocation.confidence != null) {
          queryParams.set('locationConfidence', userLocation.confidence);
        }
        if (userLocation.accuracy) {
          queryParams.set('locationAccuracy', userLocation.accuracy);
        }
      }

      // Add auth token for personalized recommendations
      const headers = {};
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/users/profiles?${queryParams}`, { 
        headers,
        signal: abortControllerRef.current.signal 
      });
      
      // Ignore stale responses from cancelled or outdated requests
      if (currentRequestId !== requestIdRef.current) {
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch profiles');
      }

      const data = await response.json();
      
      if (!data.users || !Array.isArray(data.users)) {
        throw new Error('Invalid response');
      }

      // Process profiles - backend now provides recommendation data
      const processedProfiles = data.users
        .filter(user => {
          // Exclude current user
          if (isAuthenticated && currentUser?.id === user.id) return false;
          if (reduxUser?.id === user.id) return false;
          // Backend already filters by visibility, but double-check
          // 'hidden' is legacy, 'authenticated' means logged-in users only
          if (user.profile_visibility === 'hidden') return false;
          if (user.profile_data?.profileVisibility === 'hidden') return false;
          
          // CRITICAL: ProfileFeed should only show providers (sex workers)
          // Backend should filter this, but double-check as safety net
          // This prevents clients, sugar_daddy, sugar_mommy from appearing in feed
          if (!isProvider(user)) {
            console.warn(`Filtering out non-provider from feed: ${user.username} (${user.profile_data?.accountType || 'unknown'})`);
            return false;
          }
          
          return true;
        })
        .map(user => {
          const profileData = user.profile_data || {};
          const basePrice = profileData.basePrice != null ? parseFloat(profileData.basePrice) : null;
          const converted = basePrice != null ? convertPrice(basePrice) : null;
          return {
            id: user.id,
            username: user.username,
            profileData,
            verificationTier: parseInt(user.verification_tier) || 1,
            trustScore: parseFloat(user.reputation_score) || 75,
            isPremium: user.is_subscribed,
            isOnline: user.isOnline || false, // From recommendation engine
            lastActive: user.lastSeen || user.last_active || user.created_at,
            createdAt: user.created_at,
            // Recommendation engine data - ensure numbers
            distance: user.distance != null ? parseFloat(user.distance) : null,
            distanceEstimated: user.distanceEstimated,
            distanceSource: user.distanceSource,
            distanceConfidence: user.distanceConfidence,
            recommendationScore: parseFloat(user.recommendationScore) || 0,
            successRate: parseFloat(user.successRate) || 0,
            sameCountry: user.sameCountry,
            displayPrice: converted,
          };
        });

      if (append) {
        setDisplayedProfiles(prev => [...prev, ...processedProfiles]);
      } else {
        setDisplayedProfiles(processedProfiles);
      }

      setHasMore(processedProfiles.length === 24);
      setPage(pageNum);

      // Track search/filter activity
      if (searchQuery) {
        activityTracker.trackSearch(searchQuery, { filter: activeFilter });
      }

    } catch (err) {
      // Ignore abort errors - these are expected when cancelling requests
      if (err.name === 'AbortError') {
        return;
      }
      console.error('Error fetching profiles:', err);
      setError(err.message);
    } finally {
      // Only update loading state if this is still the current request
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [activeFilter, searchQuery, isAuthenticated, isSubscribed, currentUser, reduxUser, userLocation, convertPrice]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Initial load - fetch profiles immediately, don't wait for location
  // Location detection runs in parallel and will trigger a refresh when complete
  useEffect(() => {
    fetchProfiles(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter]); // Only refetch when filter changes

  // Refetch when location is detected for better results
  useEffect(() => {
    if (!locationLoading && userLocation) {
      fetchProfiles(1);
    }
  }, [locationLoading, userLocation, fetchProfiles]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== '') {
        fetchProfiles(1);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchProfiles]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          fetchProfiles(page + 1, true);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loadingMore, loading, page, fetchProfiles]);

  // Handle like
  const handleLike = useCallback((profileId) => {
    setLikedProfiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(profileId)) {
        newSet.delete(profileId);
      } else {
        newSet.add(profileId);
      }
      return newSet;
    });
  }, []);

  // Handle message
  const handleMessage = useCallback((profile) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/profiles' } });
      return;
    }
    const avatar = resolveProfileImage(profile.profileData);
    navigate('/chat', {
      state: {
        recipientId: profile.id,
        recipientName: profile.profileData?.firstName || profile.username,
        recipientAvatar: avatar,
        from: '/profiles'
      }
    });
  }, [isAuthenticated, navigate]);

  // Handle profile click
  const handleProfileClick = useCallback((profile) => {
    navigate(`/profile/${profile.id}`);
  }, [navigate]);

  // Handle filter change
  const handleFilterChange = useCallback((filterId) => {
    setActiveFilter(filterId);
    setPage(1);
    setDisplayedProfiles([]);
    activityTracker.trackFilter('category', filterId);
  }, []);

  // Grid columns based on screen size
  const getGridColumns = () => {
    if (isMobile) return 1;
    return 4;
  };

  // ============================================
  // RENDER PROFILE FEED (Public Access Allowed)
  // ============================================
  // Public profiles are visible to everyone
  // Contact/Message features require authentication

  // Show profile feed (accessible to everyone)
  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%)',
        pt: { xs: 0.5, sm: 1, md: 2 },
        pb: { xs: 2, sm: 4, md: 8 },
      }}
    >
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: { xs: 1.5, sm: 2, md: 3 } }}>
          <Typography
            variant={isMobile ? 'h5' : 'h4'}
            sx={{
              fontWeight: 800,
              background: 'linear-gradient(135deg, #fff 0%, #00f2ea 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 0.5,
            }}
          >
            Discover
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Find verified profiles
            </Typography>
            {userLocation && (
              <Tooltip title="Click to change location">
                <Chip
                  size="small"
                  icon={<NearMe sx={{ fontSize: 14, color: '#00f2ea !important' }} />}
                  label={locationLabel || 'Location enabled'}
                  onClick={() => setShowLocationPicker(true)}
                  deleteIcon={<EditLocation sx={{ fontSize: 14 }} />}
                  onDelete={() => setShowLocationPicker(true)}
                  sx={{
                    bgcolor: 'rgba(0,242,234,0.1)',
                    color: '#00f2ea',
                    border: '1px solid rgba(0,242,234,0.2)',
                    fontSize: '0.75rem',
                    height: 24,
                    cursor: 'pointer',
                    '&:hover': {
                      bgcolor: 'rgba(0,242,234,0.2)',
                    },
                    '& .MuiChip-icon': { color: '#00f2ea' },
                    '& .MuiChip-deleteIcon': { color: '#00f2ea', fontSize: 14 },
                  }}
                />
              </Tooltip>
            )}
            {!userLocation && !locationLoading && (
              <Chip
                size="small"
                icon={<EditLocation sx={{ fontSize: 14 }} />}
                label="Set Location"
                onClick={() => setShowLocationPicker(true)}
                sx={{
                  bgcolor: 'rgba(255,165,0,0.15)',
                  color: '#ffa500',
                  border: '1px solid rgba(255,165,0,0.3)',
                  fontSize: '0.75rem',
                  height: 24,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'rgba(255,165,0,0.25)',
                  },
                }}
              />
            )}
            {locationLoading && (
              <Chip
                size="small"
                icon={<CircularProgress size={12} sx={{ color: '#00f2ea' }} />}
                label="Detecting location..."
                sx={{
                  bgcolor: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.75rem',
                  height: 24,
                }}
              />
            )}
          </Box>
        </Box>

        {/* Search Bar */}
        <Box sx={{ mb: { xs: 1, sm: 1.5, md: 2 } }}>
          <TextField
            fullWidth
            placeholder="Search by name, location, or interests..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: 'rgba(255,255,255,0.5)' }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton 
                    size="small" 
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                  >
                    <Close sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }} />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '16px',
                color: '#fff',
                '& fieldset': {
                  borderColor: 'rgba(255,255,255,0.1)',
                },
                '&:hover fieldset': {
                  borderColor: 'rgba(0,242,234,0.3)',
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#00f2ea',
                },
              },
              '& .MuiInputBase-input::placeholder': {
                color: 'rgba(255,255,255,0.4)',
              },
            }}
          />
        </Box>

        {/* Filter Chips */}
        <FilterChips
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          filters={filterOptions}
        />

        {/* Loading State */}
        {loading && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${getGridColumns()}, 1fr)`,
              gap: 2,
              mt: 3,
            }}
          >
            {[...Array(8)].map((_, i) => (
              <ProfileSkeleton key={i} />
            ))}
          </Box>
        )}

        {/* Error State */}
        {error && !loading && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Typography variant="h6" color="error" gutterBottom>
              {error}
            </Typography>
            <Button
              variant="contained"
              onClick={() => fetchProfiles(1)}
              sx={{ mt: 2 }}
            >
              Try Again
            </Button>
          </Box>
        )}

        {/* Profiles Grid */}
        {!loading && !error && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${getGridColumns()}, 1fr)`,
                gap: isMobile ? 2 : 3,
                mt: 3,
              }}
            >
              {displayedProfiles.map((profile, index) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  index={index}
                  isLiked={likedProfiles.has(profile.id)}
                  onLike={handleLike}
                  onMessage={handleMessage}
                  onClick={handleProfileClick}
                  onView={(id) => activityTracker.trackView(id, 1000)}
                />
              ))}
            </Box>

            {/* Load More Trigger */}
            {hasMore && (
              <Box
                ref={loadMoreRef}
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  py: 4,
                }}
              >
                {loadingMore && <CircularProgress sx={{ color: '#00f2ea' }} />}
              </Box>
            )}

            {/* No More Results */}
            {!hasMore && displayedProfiles.length > 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                  You've seen all profiles 🎉
                </Typography>
              </Box>
            )}

            {/* Empty State - Enhanced with icon and suggestions */}
            {displayedProfiles.length === 0 && (
              <Box 
                sx={{ 
                  textAlign: 'center', 
                  py: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2
                }}
              >
                <Search sx={{ fontSize: 64, color: 'rgba(255,255,255,0.2)' }} />
                <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  No profiles found
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', maxWidth: 320 }}>
                  Try expanding your search radius, removing filters, or checking back later for new profiles
                </Typography>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveFilter('all');
                    loadProfiles(1, false, '', 'all');
                  }}
                  sx={{
                    mt: 1,
                    borderColor: 'rgba(0,242,234,0.5)',
                    color: '#00f2ea',
                    '&:hover': {
                      borderColor: '#00f2ea',
                      bgcolor: 'rgba(0,242,234,0.1)',
                    }
                  }}
                >
                  Clear Filters
                </Button>
              </Box>
            )}
          </>
        )}
      </Container>

      {/* Location Picker Dialog */}
      <LocationPicker
        open={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        currentLocation={userLocation}
        countryCode={userCountry || detectedCountry || 'ghana'}
        onSelectLocation={(location) => {
          console.log('📍 Location selected:', location.name, location.lat, location.lng);
          
          // Determine country from location data or user country
          const selectedCountry = location.country || userCountry || detectedCountry || 'Unknown';
          
          // Save to localStorage for persistence
          localStorage.setItem('userManualLocation', JSON.stringify({
            lat: location.lat,
            lng: location.lng,
            city: location.name,
            country: selectedCountry,
            district: location.district,
            region: location.region,
            method: location.method,
            precision: location.precision
          }));
          
          setUserLocation({
            lat: location.lat,
            lng: location.lng,
            city: location.name,
            country: selectedCountry,
            source: location.method,
            precision: location.precision
          });
          
          // Refetch profiles with new location
          setPage(1);
          setDisplayedProfiles([]);
        }}
      />
    </Box>
  );
};

export default ProfileFeed;
