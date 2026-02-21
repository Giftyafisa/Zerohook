import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
// NOTE: useRef/useMemo still used by sub-components (LocationPicker, ProfileCard, ActivityTracker)
import {
  Box,
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
import { toast } from 'react-toastify';
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
  AccessTime,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/constants';
import { calculateDistance } from '../config/locations';
import { resolveProfileImage } from '../utils/imageUtils';
import { VerificationBadge, TrustScoreBreakdown } from '../components/ui/StatusBadge';
import ProfileCompletionReminder from '../components/ProfileCompletionReminder';
import useCurrency from '../hooks/useCurrency';
import useProfileEngagement from '../hooks/useProfileEngagement';
import useFeedFilters from '../hooks/useFeedFilters';
import useLocationBootstrap, { getAllLocations, findNearestCity } from '../hooks/useLocationBootstrap';
import useFeedQuery from '../hooks/useFeedQuery';
import TikTokProfileFeed from '../components/TikTokProfileFeed';
import tokens from '../theme/tokens';

// Environment-gated debug logger — no logs in production builds
const isDev = process.env.NODE_ENV === 'development';
const debugLog = isDev ? (...args) => console.log(...args) : () => {};
const debugError = isDev ? (...args) => console.error(...args) : () => {};

// getAllLocations and findNearestCity are now in hooks/useLocationBootstrap.js
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
        debugLog(`📍 GPS Location Selected: ${nearestLocation.name}`, 
          `\n   Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          `\n   Nearest Location Distance: ${minDistance.toFixed(2)} km`);
        onSelectLocation(selectedLocation);
      }
      onClose();
    } catch (error) {
      debugError('GPS Error:', error);
      toast.warning('Could not get GPS location. Please select manually.');
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
          bgcolor: tokens.colors.background.secondary,
          color: tokens.colors.text.primary,
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
          <EditLocation sx={{ color: tokens.colors.primary.main }} />
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
            borderColor: tokens.colors.primary.main,
            color: tokens.colors.primary.main,
            '&:hover': {
              borderColor: tokens.colors.primary.dark,
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
              color: tokens.colors.text.primary,
              '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
              '&.Mui-focused fieldset': { borderColor: tokens.colors.primary.main },
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
                      <CheckCircle sx={{ color: tokens.colors.primary.main }} />
                    ) : (
                      <LocationOn sx={{ color: 'rgba(255,255,255,0.5)' }} />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={location.name}
                    secondary={`${location.district}, ${location.region}`}
                    primaryTypographyProps={{
                      sx: { color: isSelected ? tokens.colors.primary.main : tokens.colors.text.primary, fontWeight: isSelected ? 600 : 400 }
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
      const results = await Promise.allSettled(
        activities.map(activity =>
          fetch(`${API_BASE_URL}/users/track-activity`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(activity),
          })
        )
      );

      // Re-queue only the failed activities
      const failed = activities.filter((_, i) => results[i].status === 'rejected');
      if (failed.length > 0) {
        this.pendingActivities.push(...failed);
      }
    } catch (error) {
      debugError('Failed to track activities:', error);
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

// ActivityTracker factory (instances created per-component via useRef, not at module scope)
// const activityTracker = new ActivityTracker(); // REMOVED: caused interval leak in HMR

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
        // CRITICAL: Prevent horizontal overflow while allowing scroll
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
        // Enable smooth horizontal scroll on touch
        WebkitOverflowScrolling: 'touch',
        scrollSnapType: 'x mandatory',
        '& > *': {
          scrollSnapAlign: 'start',
          flexShrink: 0, // Prevent chips from shrinking
        },
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
              ? tokens.gradients.primary
              : 'rgba(255,255,255,0.08)',
            color: activeFilter === filter.id ? '#000' : tokens.colors.text.primary,
            border: activeFilter === filter.id 
              ? 'none' 
              : '1px solid rgba(255,255,255,0.15)',
            '&:hover': {
              background: activeFilter === filter.id 
                ? tokens.gradients.primary
                : 'rgba(255,255,255,0.15)',
              transform: 'scale(1.02)',
            },
            '& .MuiChip-icon': {
              color: activeFilter === filter.id ? '#000' : tokens.colors.primary.main,
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
// With TikTok-style engagement tracking
// ============================================

const ProfileCard = React.memo(({ 
  profile, 
  onLike, 
  onMessage, 
  onClick, 
  isLiked,
  index,
  onView 
}) => {
  // Use currency hook for consistent currency symbol based on detected country
  const { symbol: detectedCurrencySymbol } = useCurrency();
  
  // TikTok-style engagement tracking
  const {
    startTracking,
    stopTracking,
    trackScrollDepth,
    trackContactClick
  } = useProfileEngagement(profile?.id);
  
  const cardRef = useRef(null);
  const viewStartTime = useRef(null);
  const hasStartedTracking = useRef(false);

  // Track view time with TikTok-style engagement
  useEffect(() => {
    viewStartTime.current = Date.now();
    
    return () => {
      if (viewStartTime.current) {
        const duration = Date.now() - viewStartTime.current;
        activityTracker.trackView(profile.id, duration);
      }
    };
  }, [profile.id]);

  // Intersection observer for view tracking with engagement
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            // Start engagement tracking when card becomes visible
            if (!hasStartedTracking.current) {
              startTracking();
              hasStartedTracking.current = true;
            }
            onView?.(profile.id);
          } else if (!entry.isIntersecting && hasStartedTracking.current) {
            // Stop tracking when card scrolls out of view
            stopTracking('exit');
            hasStartedTracking.current = false;
          }
        });
      },
      { threshold: [0.5] }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      observer.disconnect();
      // Cleanup tracking on unmount
      if (hasStartedTracking.current) {
        stopTracking('exit');
      }
    };
  }, [profile.id, onView, startTracking, stopTracking]);

  // Handle message click with engagement tracking
  const handleMessageClick = (e) => {
    e.stopPropagation();
    trackContactClick(); // Track as high engagement signal
    onMessage(profile);
  };

  const profileData = profile.profileData || {};
  const displayName = profileData.firstName || profile.username || 'User';
  const age = profileData.age || '??';
  const city = profileData.location?.city || 'Unknown';
  const country = profileData.location?.country || '';
  const bio = profileData.bio || 'No bio available';
  const price = profile.displayPrice?.amount ?? profileData.basePrice ?? 0;
  // Use displayPrice symbol if available, otherwise use detected currency symbol (not hardcoded $)
  const priceSymbol = profile.displayPrice?.symbol || profile.displayPrice?.currency || detectedCurrencySymbol;
  const isPriceConverted = Boolean(profile.displayPrice && profile.displayPrice.currency && profile.displayPrice.currency !== 'USD');
  const isOnline = profile.isOnline; // From backend
  const lastActive = profile.lastActive; // ISO date from backend
  const lastSeenLabel = profile.lastSeenLabel; // Pre-formatted "2 days ago" etc.
  const verificationTier = profile.verificationTier || 1;
  const distance = profile.distance; // From backend recommendation engine
  const successRate = profile.successRate; // From backend
  const distanceLabel = distance != null ? (profile.distanceEstimated ? `${distance}km est` : `${distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}`) : null;
  
  // Quality scoring from recommendation engine
  const recommendationScore = profile.recommendationScore || 0;
  const scoreBreakdown = profile.scoreBreakdown || {};
  const matchPercentage = Math.round(recommendationScore) || (scoreBreakdown.compatibility ? Math.round(scoreBreakdown.compatibility) : null);

  // Helper function to format last active time
  const formatLastActive = (lastActiveDate) => {
    // If we have a pre-formatted label, use it (but not "Online now" since we show online indicator separately)
    if (lastSeenLabel && lastSeenLabel !== 'Online now') {
      return lastSeenLabel;
    }
    
    if (!lastActiveDate) return null;
    const date = new Date(lastActiveDate);
    
    // Check for invalid date
    if (isNaN(date.getTime())) return null;
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 0) return null; // Future date, invalid
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
              ? `linear-gradient(90deg, ${tokens.colors.warning}, #FFA500)`
              : verificationTier >= 2 
                ? tokens.gradients.primary
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
              loading="lazy"
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
              <NearMe sx={{ fontSize: 12, color: tokens.colors.primary.main }} />
              <Typography variant="caption" sx={{ color: tokens.colors.primary.main, fontWeight: 600 }}>
                {distanceLabel}
              </Typography>
            </Box>
          )}

          {/* Match Quality Score Badge */}
          {matchPercentage && matchPercentage > 0 && (
            <Tooltip
              title={
                <Box sx={{ p: 0.5 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>Match Quality Breakdown</Typography>
                  <Box sx={{ mt: 0.5, fontSize: '11px' }}>
                    {scoreBreakdown.countryMatch !== undefined && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                        <span>🌍 Location</span>
                        <span>{Math.round(scoreBreakdown.countryMatch + (scoreBreakdown.distance || 0))}%</span>
                      </Box>
                    )}
                    {scoreBreakdown.quality !== undefined && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                        <span>⭐ Quality</span>
                        <span>{Math.round(scoreBreakdown.quality)}%</span>
                      </Box>
                    )}
                    {scoreBreakdown.engagement !== undefined && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                        <span>🔥 Activity</span>
                        <span>{Math.round(scoreBreakdown.engagement)}%</span>
                      </Box>
                    )}
                    {scoreBreakdown.popularity !== undefined && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                        <span>💖 Popularity</span>
                        <span>{Math.round(scoreBreakdown.popularity)}%</span>
                      </Box>
                    )}
                  </Box>
                </Box>
              }
              arrow
              placement="right"
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: distance !== null && distance !== undefined ? 84 : 48, // Below distance if present
                  left: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  bgcolor: matchPercentage >= 80 ? 'rgba(74,222,128,0.2)' : matchPercentage >= 60 ? 'rgba(255,215,0,0.2)' : 'rgba(255,107,107,0.2)',
                  backdropFilter: 'blur(4px)',
                  borderRadius: '12px',
                  px: 1,
                  py: 0.5,
                  border: `1px solid ${matchPercentage >= 80 ? 'rgba(74,222,128,0.3)' : matchPercentage >= 60 ? 'rgba(255,215,0,0.3)' : 'rgba(255,107,107,0.3)'}`,
                  cursor: 'pointer',
                }}
              >
                <Whatshot sx={{ fontSize: 12, color: matchPercentage >= 80 ? tokens.colors.success : matchPercentage >= 60 ? tokens.colors.warning : tokens.colors.error }} />
                <Typography variant="caption" sx={{ color: matchPercentage >= 80 ? tokens.colors.success : matchPercentage >= 60 ? tokens.colors.warning : tokens.colors.error, fontWeight: 600 }}>
                  {matchPercentage}% Match
                </Typography>
              </Box>
            </Tooltip>
          )}

          {/* Verification Badge - Always visible with appropriate tier styling */}
          <Box
            sx={{
              position: 'absolute',
              top: 12,
              right: 12,
            }}
          >
            <VerificationBadge 
              tier={verificationTier} 
              variant="chip" 
              size="medium"
              showUnverified={true}
              showTooltip={true}
            />
          </Box>

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
              <Typography variant="body2" sx={{ color: tokens.colors.primary.main, fontWeight: 700 }}>
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
                  <TrustScoreBreakdown 
                    profile={{
                      verification_tier: verificationTier,
                      completion_rate: successRate ? parseFloat(successRate) : 80,
                      last_active: profile.lastActive,
                      dispute_count: 0
                    }}
                    variant="compact"
                  />
                }
                arrow
                placement="left"
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}>
                <Star sx={{ fontSize: 16, color: tokens.colors.warning }} />
                  <Typography variant="body2" sx={{ color: tokens.colors.warning, fontWeight: 600 }}>
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
            onClick={handleMessageClick}
            sx={{
              background: tokens.gradients.primary,
              color: '#000',
              fontWeight: 700,
              borderRadius: '12px',
              py: 1,
              '&:hover': {
                background: `linear-gradient(135deg, ${tokens.colors.primary.dark} 0%, ${tokens.colors.primary.main} 100%)`,
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
});
ProfileCard.displayName = 'ProfileCard';

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
            background: tokens.gradients.primary,
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
            <Typography variant="subtitle2" sx={{ color: tokens.colors.primary.main, mb: 2, fontWeight: 600 }}>
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
              background: tokens.gradients.primary,
              color: '#000',
              fontWeight: 700,
              py: 1.5,
              borderRadius: '12px',
              fontSize: '1rem',
              '&:hover': {
                background: `linear-gradient(135deg, ${tokens.colors.primary.dark} 0%, ${tokens.colors.primary.main} 100%)`,
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

  // ── extracted hooks ──────────────────────────────
  const {
    activeFilter, searchQuery, filterOptions,
    handleFilterChange: _onFilterChange,
    handleSearchChange, resetFilters,
  } = useFeedFilters();

  const {
    userLocation, locationLoading,
    showLocationPicker, setShowLocationPicker,
    locationLabel, setManualLocation,
    availableLocations, countryKey,
  } = useLocationBootstrap();

  const {
    displayedProfiles, loading, loadingMore, error,
    hasMore, searchMetadata, loadMoreRef,
    fetchProfiles, resetProfiles,
  } = useFeedQuery({ activeFilter, searchQuery, userLocation, locationLoading });

  // Local UI state
  const [likedProfiles, setLikedProfiles] = useState(new Set());

  // Activity tracker — per-component instance via useRef (prevents HMR/remount interval leaks)
  const activityTrackerRef = useRef(null);
  if (!activityTrackerRef.current) {
    activityTrackerRef.current = new ActivityTracker();
  }
  const activityTracker = activityTrackerRef.current;

  // Initialize activity tracker
  useEffect(() => {
    activityTracker.init();
    return () => activityTracker.destroy();
  }, [activityTracker]);

  // Handle filter change — reset profiles + track
  const handleFilterChange = useCallback((filterId) => {
    _onFilterChange(filterId);
    resetProfiles();
    activityTracker.trackFilter('category', filterId);
  }, [_onFilterChange, resetProfiles]);

  // Handle like
  const handleLike = useCallback((profileId) => {
    setLikedProfiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(profileId)) newSet.delete(profileId);
      else newSet.add(profileId);
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

  // ============================================
  // RENDER PROFILE FEED (Public Access Allowed)
  // ============================================
  // Public profiles are visible to everyone
  // Contact/Message features require authentication

  // Mobile: Use TikTok-style full-screen swipeable feed
  if (isMobile) {
    return <TikTokProfileFeed />;
  }

  // Desktop: Show traditional grid feed (accessible to everyone)
  return (
    <Box
      sx={{
        minHeight: '100%', // Fill MobileShell content area
        background: 'linear-gradient(180deg, #0f0f13 0%, #1a1a2e 100%)',
        // Mobile: no extra padding at bottom (handled by shell)
        // Desktop: add padding for footer
        pb: { xs: 0, md: 4 },
      }}
    >
      {/* Profile Completion Reminder - Shows if profile is incomplete */}
      {isAuthenticated && (
        <Box sx={{ px: 2, pt: 2 }}>
          <ProfileCompletionReminder variant="banner" showDismiss={true} />
        </Box>
      )}
      
      {/* Content Area - Filter Section */}
      <Box
        sx={{
          // Desktop only: sticky filter bar
          position: { xs: 'relative', md: 'sticky' },
          top: { md: 0 },
          zIndex: 50,
          background: { md: 'rgba(15,15,19,0.95)' },
          backdropFilter: { md: 'blur(20px)' },
          borderBottom: { md: '1px solid rgba(0,242,234,0.1)' },
          px: 2,
          py: 1.5,
        }}
      >
        {/* Location & Filter Row */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: '1.1rem',
              color: '#fff',
            }}
          >
            Discover
          </Typography>
          
          {/* Compact Location Chip */}
          {userLocation ? (
            <Chip
              size="small"
              icon={<NearMe sx={{ fontSize: 12, color: `${tokens.colors.primary.main} !important` }} />}
              label={locationLabel ? (locationLabel.length > 20 ? locationLabel.substring(0, 20) + '...' : locationLabel) : 'Near you'}
              onClick={() => setShowLocationPicker(true)}
              sx={{
                bgcolor: 'rgba(0,242,234,0.12)',
                color: tokens.colors.primary.main,
                border: '1px solid rgba(0,242,234,0.25)',
                fontSize: '0.7rem',
                fontWeight: 600,
                height: 28,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(0,242,234,0.2)' },
                '& .MuiChip-icon': { color: tokens.colors.primary.main, ml: 0.5 },
                '& .MuiChip-label': { px: 1 },
              }}
            />
          ) : (
            <Chip
              size="small"
              icon={locationLoading ? <CircularProgress size={12} sx={{ color: tokens.colors.primary.main }} /> : <MyLocation sx={{ fontSize: 12 }} />}
              label={locationLoading ? 'Detecting...' : 'Set location'}
              onClick={() => !locationLoading && setShowLocationPicker(true)}
              disabled={locationLoading}
              sx={{
                bgcolor: 'rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.6)',
                border: '1px solid rgba(255,255,255,0.15)',
                fontSize: '0.7rem',
                height: 28,
                cursor: locationLoading ? 'default' : 'pointer',
                '&:hover': { bgcolor: locationLoading ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.12)' },
              }}
            />
          )}
        </Box>

        {/* Search Bar - Compact */}
        <TextField
          fullWidth
          size="small"
          placeholder="Search profiles..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18, color: 'rgba(255,255,255,0.4)' }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => handleSearchChange('')} aria-label="Clear search">
                  <Close sx={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }} />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 1.5,
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.05)',
              borderRadius: '12px',
              height: 40,
              color: '#fff',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
              '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
              '&.Mui-focused fieldset': { borderColor: 'rgba(0,242,234,0.5)' },
            },
            '& .MuiInputBase-input': {
              fontSize: '0.875rem',
              '&::placeholder': { color: 'rgba(255,255,255,0.4)' },
            },
          }}
        />

        {/* Filter Chips - Scrollable horizontally */}
        <FilterChips
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          filters={filterOptions}
        />
      </Box>

      {/* Main Content Area */}
      <Box sx={{ px: 2, pt: 1 }}>
        {/* Loading State */}
        {loading && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
              gap: { xs: 1.5, sm: 2 },
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
            {/* Radius Expansion Suggestion */}
            {searchMetadata?.suggestedRadiusExpansion && displayedProfiles.length > 0 && displayedProfiles.length < 10 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  mb: 2,
                  p: 1.5,
                  bgcolor: 'rgba(0,242,234,0.1)',
                  border: '1px solid rgba(0,242,234,0.2)',
                  borderRadius: 2,
                }}
              >
                <NearMe sx={{ color: tokens.colors.primary.main, fontSize: 20 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ color: '#fff', fontWeight: 500 }}>
                    Only {searchMetadata.nearbyCount?.within10km || displayedProfiles.length} providers within 10km
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                    {searchMetadata.suggestedRadiusExpansion.message}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={`${searchMetadata.nearbyCount?.within25km || 0} within 25km`}
                  sx={{
                    bgcolor: 'rgba(0,242,234,0.2)',
                    color: tokens.colors.primary.main,
                    fontWeight: 600,
                  }}
                />
              </Box>
            )}
            
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, 1fr)', md: 'repeat(4, 1fr)' },
                gap: { xs: 1.5, sm: 2 },
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
                {loadingMore && <CircularProgress sx={{ color: tokens.colors.primary.main }} />}
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
                    resetFilters();
                    resetProfiles();
                    fetchProfiles(1, false);
                  }}
                  sx={{
                    mt: 1,
                    borderColor: 'rgba(0,242,234,0.5)',
                    color: tokens.colors.primary.main,
                    '&:hover': {
                      borderColor: tokens.colors.primary.main,
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
      </Box>

      {/* Location Picker Dialog */}
      <LocationPicker
        open={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        currentLocation={userLocation}
        countryCode={countryKey}
        onSelectLocation={async (location) => {
          await setManualLocation(location);
          resetProfiles();
        }}
      />
    </Box>
  );
};

export default ProfileFeed;
