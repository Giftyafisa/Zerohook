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
  Slide,
  InputAdornment,
  Badge,
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
  TuneRounded,
  Close,
  LocalFireDepartment,
  AccessTime,
  AttachMoney,
  Star,
  Whatshot,
  FilterList,
  NearMe,
  Speed,
  MyLocation,
  EditLocation,
  CheckCircle
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSelector, useDispatch } from 'react-redux';
import { selectIsSubscribed, selectUser } from '../store/slices/authSlice';
import { API_BASE_URL, getUploadUrl } from '../config/constants';
import ChatSystem from '../components/ChatSystem';

// ============================================
// GHANA TOWN COORDINATES - For precise location matching
// ============================================
const GHANA_LOCATIONS = {
  'Greater Accra': [
    { name: 'Adjei-Kojo, Tema West', lat: 5.6750, lng: -0.0100, district: 'Tema West' },
    { name: 'Tema', lat: 5.6698, lng: -0.0166, district: 'Tema Metro' },
    { name: 'Tema New Town', lat: 5.6550, lng: -0.0050, district: 'Tema Metro' },
    { name: 'Community 1, Tema', lat: 5.6600, lng: -0.0200, district: 'Tema Metro' },
    { name: 'Community 25, Tema', lat: 5.6850, lng: 0.0100, district: 'Tema Metro' },
    { name: 'Sakumono', lat: 5.6250, lng: -0.0350, district: 'Tema Metro' },
    { name: 'Lashibi', lat: 5.6150, lng: -0.0400, district: 'Tema Metro' },
    { name: 'Spintex', lat: 5.6300, lng: -0.1000, district: 'Accra Metro' },
    { name: 'Baatsonaa', lat: 5.6200, lng: -0.0800, district: 'Accra Metro' },
    { name: 'Nungua', lat: 5.5933, lng: -0.0653, district: 'Accra Metro' },
    { name: 'Teshie', lat: 5.5850, lng: -0.1000, district: 'Accra Metro' },
    { name: 'La', lat: 5.5611, lng: -0.1489, district: 'Accra Metro' },
    { name: 'Osu', lat: 5.5550, lng: -0.1800, district: 'Accra Metro' },
    { name: 'Labadi', lat: 5.5583, lng: -0.1467, district: 'Accra Metro' },
    { name: 'Labone', lat: 5.5700, lng: -0.1700, district: 'Accra Metro' },
    { name: 'Airport Residential', lat: 5.6050, lng: -0.1700, district: 'Accra Metro' },
    { name: 'East Legon', lat: 5.6400, lng: -0.1500, district: 'Accra Metro' },
    { name: 'Madina', lat: 5.6833, lng: -0.1644, district: 'La Nkwantanang' },
    { name: 'Adenta', lat: 5.7200, lng: -0.1550, district: 'Adenta' },
    { name: 'Dome', lat: 5.6500, lng: -0.2300, district: 'Ga East' },
    { name: 'Achimota', lat: 5.6100, lng: -0.2300, district: 'Ga East' },
    { name: 'Dzorwulu', lat: 5.5950, lng: -0.2000, district: 'Accra Metro' },
    { name: 'Cantonments', lat: 5.5700, lng: -0.1850, district: 'Accra Metro' },
    { name: 'Ridge', lat: 5.5650, lng: -0.2000, district: 'Accra Metro' },
    { name: 'Accra Central', lat: 5.5560, lng: -0.2010, district: 'Accra Metro' },
    { name: 'Circle', lat: 5.5700, lng: -0.2200, district: 'Accra Metro' },
    { name: 'Darkuman', lat: 5.5700, lng: -0.2450, district: 'Accra Metro' },
    { name: 'Dansoman', lat: 5.5325, lng: -0.2622, district: 'Accra Metro' },
    { name: 'Mamprobi', lat: 5.5350, lng: -0.2300, district: 'Accra Metro' },
    { name: 'Korle Bu', lat: 5.5350, lng: -0.2250, district: 'Accra Metro' },
    { name: 'Kaneshie', lat: 5.5650, lng: -0.2450, district: 'Accra Metro' },
    { name: 'Tesano', lat: 5.5800, lng: -0.2400, district: 'Accra Metro' },
    { name: 'Abeka', lat: 5.5900, lng: -0.2350, district: 'Accra Metro' },
    { name: 'Lapaz', lat: 5.5950, lng: -0.2600, district: 'Ga West' },
    { name: 'Kasoa', lat: 5.5333, lng: -0.4250, district: 'Ga South' },
    { name: 'Weija', lat: 5.5550, lng: -0.3500, district: 'Ga South' },
    { name: 'Gbawe', lat: 5.5700, lng: -0.3200, district: 'Ga South' },
    { name: 'Awoshie', lat: 5.5900, lng: -0.2850, district: 'Ga South' },
    { name: 'Ablekuma', lat: 5.5800, lng: -0.2700, district: 'Ablekuma' },
    { name: 'Ashaiman', lat: 5.6889, lng: -0.0306, district: 'Ashaiman' },
    { name: 'Prampram', lat: 5.7167, lng: 0.1167, district: 'Ningo-Prampram' },
    { name: 'Kpone', lat: 5.7000, lng: 0.0300, district: 'Kpone-Katamanso' },
  ],
  'Ashanti': [
    { name: 'Kumasi', lat: 6.6885, lng: -1.6244, district: 'Kumasi Metro' },
    { name: 'Adum', lat: 6.6900, lng: -1.6250, district: 'Kumasi Metro' },
    { name: 'Oforikrom', lat: 6.6800, lng: -1.5650, district: 'Oforikrom' },
    { name: 'Asokwa', lat: 6.6600, lng: -1.5800, district: 'Asokwa' },
    { name: 'Tafo', lat: 6.7100, lng: -1.5850, district: 'Old Tafo' },
    { name: 'Suame', lat: 6.7200, lng: -1.6200, district: 'Suame' },
    { name: 'Bantama', lat: 6.7000, lng: -1.6450, district: 'Bantama' },
    { name: 'Ejisu', lat: 6.7333, lng: -1.4500, district: 'Ejisu' },
    { name: 'Obuasi', lat: 6.2063, lng: -1.6603, district: 'Obuasi' },
  ],
  'Central': [
    { name: 'Cape Coast', lat: 5.1054, lng: -1.2466, district: 'Cape Coast Metro' },
    { name: 'Kasoa', lat: 5.5333, lng: -0.4250, district: 'Awutu Senya East' },
    { name: 'Winneba', lat: 5.3525, lng: -0.6228, district: 'Effutu' },
  ],
  'Western': [
    { name: 'Takoradi', lat: 4.8832, lng: -1.7554, district: 'Sekondi-Takoradi' },
    { name: 'Sekondi', lat: 4.9167, lng: -1.7167, district: 'Sekondi-Takoradi' },
    { name: 'Tarkwa', lat: 5.3000, lng: -1.9833, district: 'Tarkwa-Nsuaem' },
  ],
  'Eastern': [
    { name: 'Koforidua', lat: 6.0941, lng: -0.2593, district: 'New Juaben' },
    { name: 'Nsawam', lat: 5.8000, lng: -0.3500, district: 'Nsawam-Adoagyiri' },
    { name: 'Nkawkaw', lat: 6.5500, lng: -0.7667, district: 'Kwahu West' },
  ],
  'Volta': [
    { name: 'Ho', lat: 6.6000, lng: 0.4700, district: 'Ho Municipality' },
    { name: 'Hohoe', lat: 7.1500, lng: 0.4700, district: 'Hohoe Municipality' },
    { name: 'Aflao', lat: 6.1167, lng: 1.1833, district: 'Ketu South' },
  ],
  'Northern': [
    { name: 'Tamale', lat: 9.4034, lng: -0.8393, district: 'Tamale Metro' },
    { name: 'Yendi', lat: 9.4500, lng: -0.0167, district: 'Yendi Municipal' },
  ],
  'Upper East': [
    { name: 'Bolgatanga', lat: 10.7856, lng: -0.8514, district: 'Bolgatanga' },
    { name: 'Navrongo', lat: 10.8933, lng: -1.0950, district: 'Kassena Nankana' },
  ],
  'Upper West': [
    { name: 'Wa', lat: 10.0667, lng: -2.5000, district: 'Wa Municipal' },
  ],
};

// Flatten for search
const ALL_GHANA_LOCATIONS = Object.entries(GHANA_LOCATIONS).flatMap(([region, towns]) =>
  towns.map(town => ({ ...town, region }))
);

// ============================================
// LOCATION PICKER COMPONENT
// ============================================
const LocationPicker = ({ open, onClose, onSelectLocation, currentLocation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [gpsLoading, setGpsLoading] = useState(false);
  const theme = useTheme();

  const filteredLocations = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show Tema and nearby areas by default
      return ALL_GHANA_LOCATIONS.filter(loc => 
        loc.region === 'Greater Accra'
      ).slice(0, 15);
    }
    const query = searchQuery.toLowerCase();
    return ALL_GHANA_LOCATIONS.filter(loc =>
      loc.name.toLowerCase().includes(query) ||
      loc.district.toLowerCase().includes(query) ||
      loc.region.toLowerCase().includes(query)
    ).slice(0, 20);
  }, [searchQuery]);

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
      
      // Find nearest town
      let nearestTown = null;
      let minDistance = Infinity;
      
      ALL_GHANA_LOCATIONS.forEach(loc => {
        const dist = Math.sqrt(
          Math.pow(loc.lat - latitude, 2) + Math.pow(loc.lng - longitude, 2)
        );
        if (dist < minDistance) {
          minDistance = dist;
          nearestTown = loc;
        }
      });

      if (nearestTown) {
        onSelectLocation({
          ...nearestTown,
          lat: latitude,
          lng: longitude,
          method: 'gps',
          precision: 'exact'
        });
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
        <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.6)' }}>
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
  const theme = useTheme();
  
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        gap: 1, 
        overflowX: 'auto',
        py: 1,
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
          sx={{
            borderRadius: '20px',
            fontWeight: 600,
            fontSize: '0.85rem',
            px: 1,
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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
  const price = profileData.basePrice || 0;
  const isOnline = profile.isOnline; // From backend
  const verificationTier = profile.verificationTier || 1;
  const distance = profile.distance; // From backend recommendation engine
  const successRate = profile.successRate; // From backend

  // Get profile image
  const getProfileImage = () => {
    if (profileData.profilePicture) {
      return getUploadUrl(profileData.profilePicture);
    }
    // Generate consistent placeholder based on profile id
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#fd79a8', '#00b894'];
    const colorIndex = profile.id ? profile.id.charCodeAt(0) % colors.length : 0;
    return null; // Will use Avatar with initial
  };

  const profileImage = getProfileImage();

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

          {/* Distance Badge - Only show if we have distance data */}
          {distance !== null && distance !== undefined && (
            <Box
              sx={{
                position: 'absolute',
                top: isOnline ? 48 : 12,
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
                {distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(1)}km`}
              </Typography>
            </Box>
          )}

          {/* Verification Badge */}
          {verificationTier >= 2 && (
            <Box
              sx={{
                position: 'absolute',
                top: 12,
                right: 12,
                bgcolor: verificationTier >= 3 ? '#FFD700' : '#00f2ea',
                borderRadius: '50%',
                p: 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Verified sx={{ fontSize: 18, color: '#000' }} />
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
                ${price}
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Star sx={{ fontSize: 16, color: '#FFD700' }} />
                <Typography variant="body2" sx={{ color: '#FFD700', fontWeight: 600 }}>
                  {Math.round(parseFloat(profile.trustScore) || 75)}%
                </Typography>
              </Box>
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user: currentUser, isAuthenticated } = useAuth();
  const isSubscribed = useSelector(selectIsSubscribed);
  const reduxUser = useSelector(selectUser);

  // ============================================
  // SUBSCRIPTION CHECK - Must be subscribed to browse
  // ============================================
  if (!isAuthenticated) {
    // Not logged in - redirect to login
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
            maxWidth: 400,
            width: '100%',
            background: 'rgba(30,30,35,0.95)',
            borderRadius: '24px',
            p: 4,
            textAlign: 'center',
          }}
        >
          <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700, mb: 2 }}>
            Login Required
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 3 }}>
            Please login to browse profiles
          </Typography>
          <Button
            fullWidth
            variant="contained"
            onClick={() => navigate('/login', { state: { from: '/profiles' } })}
            sx={{
              background: 'linear-gradient(135deg, #00f2ea 0%, #00d4aa 100%)',
              color: '#000',
              fontWeight: 700,
              py: 1.5,
              borderRadius: '12px',
            }}
          >
            Login
          </Button>
          <Button
            fullWidth
            variant="text"
            onClick={() => navigate('/register')}
            sx={{ color: '#00f2ea', mt: 1 }}
          >
            Create Account
          </Button>
        </Card>
      </Box>
    );
  }

  if (!isSubscribed) {
    // Logged in but not subscribed - show paywall
    return <SubscriptionPaywall />;
  }

  // State
  const [profiles, setProfiles] = useState([]);
  const [displayedProfiles, setDisplayedProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [likedProfiles, setLikedProfiles] = useState(new Set());
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showChat, setShowChat] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  
  const observerRef = useRef(null);
  const loadMoreRef = useRef(null);

  // Initialize activity tracker
  useEffect(() => {
    activityTracker.init();
    return () => activityTracker.destroy();
  }, []);

  // Get user's location on mount
  useEffect(() => {
    const getIPLocation = async () => {
      try {
        const response = await fetch(
          'https://api.ipgeolocation.io/ipgeo?apiKey=1d24707d2a554ee697b852f28dd6533e'
        );
        const data = await response.json();
        if (data.latitude && data.longitude) {
          return {
            lat: parseFloat(data.latitude),
            lng: parseFloat(data.longitude),
            city: data.city,
            country: data.country_name,
            source: 'ip'
          };
        }
      } catch (error) {
        console.error('IP geolocation failed:', error);
      }
      return null;
    };

    // Known Ghana locations with precise coordinates for manual selection
    const KNOWN_LOCATIONS = {
      'tema-west-adjei-kojo': { lat: 5.6647, lng: -0.0175, city: 'Tema West (Adjei-Kojo)', country: 'Ghana' },
      'tema-community-1': { lat: 5.6698, lng: -0.0166, city: 'Tema Community 1', country: 'Ghana' },
      'accra-central': { lat: 5.5560, lng: -0.1969, city: 'Accra Central', country: 'Ghana' },
      'osu': { lat: 5.5571, lng: -0.1818, city: 'Osu', country: 'Ghana' },
      'east-legon': { lat: 5.6350, lng: -0.1550, city: 'East Legon', country: 'Ghana' },
      'madina': { lat: 5.6700, lng: -0.1650, city: 'Madina', country: 'Ghana' },
      'spintex': { lat: 5.6350, lng: -0.0850, city: 'Spintex', country: 'Ghana' },
      'airport-residential': { lat: 5.6050, lng: -0.1700, city: 'Airport Residential', country: 'Ghana' },
    };

    const getUserLocation = async () => {
      setLocationLoading(true);
      
      // Check for saved manual location first
      const savedLocation = localStorage.getItem('userManualLocation');
      if (savedLocation) {
        try {
          const parsed = JSON.parse(savedLocation);
          setUserLocation({ ...parsed, source: 'manual' });
          setLocationLoading(false);
          console.log('📍 Using saved manual location:', parsed.city);
          return;
        } catch (e) {
          localStorage.removeItem('userManualLocation');
        }
      }
      
      // Start IP detection immediately (as backup)
      const ipLocationPromise = getIPLocation();
      
      // Try browser geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // GPS success - use precise location
            const gpsLocation = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              city: 'Current Location',
              country: 'Ghana', // Assume Ghana for now
              source: 'gps'
            };
            setUserLocation(gpsLocation);
            setLocationLoading(false);
            console.log('📍 GPS location:', gpsLocation.lat, gpsLocation.lng, '(accuracy:', gpsLocation.accuracy, 'm)');
          },
          async (error) => {
            console.log('Geolocation denied/blocked, using IP detection:', error.message);
            // Use IP location (already fetching)
            const ipLocation = await ipLocationPromise;
            if (ipLocation) {
              setUserLocation(ipLocation);
              console.log('📍 IP-based location:', ipLocation.city, ipLocation.country);
              console.log('⚠️ IP location is city-level only. For precise results, enable GPS or set location manually.');
            }
            setLocationLoading(false);
          },
          { 
            enableHighAccuracy: true, // Request high accuracy
            timeout: 10000, 
            maximumAge: 300000 // Cache for 5 minutes
          }
        );
      } else {
        // No geolocation support, use IP
        const ipLocation = await ipLocationPromise;
        if (ipLocation) {
          setUserLocation(ipLocation);
        }
        setLocationLoading(false);
      }
    };

    getUserLocation();
  }, []);

  // Function to set manual location (for testing or when GPS blocked)
  const setManualLocation = useCallback((locationKey) => {
    const KNOWN_LOCATIONS = {
      'tema-west-adjei-kojo': { lat: 5.6647, lng: -0.0175, city: 'Tema West (Adjei-Kojo)', country: 'Ghana' },
      'tema-community-1': { lat: 5.6698, lng: -0.0166, city: 'Tema Community 1', country: 'Ghana' },
      'accra-central': { lat: 5.5560, lng: -0.1969, city: 'Accra Central', country: 'Ghana' },
      'osu': { lat: 5.5571, lng: -0.1818, city: 'Osu', country: 'Ghana' },
      'east-legon': { lat: 5.6350, lng: -0.1550, city: 'East Legon', country: 'Ghana' },
      'madina': { lat: 5.6700, lng: -0.1650, city: 'Madina', country: 'Ghana' },
      'spintex': { lat: 5.6350, lng: -0.0850, city: 'Spintex', country: 'Ghana' },
    };
    
    const location = KNOWN_LOCATIONS[locationKey];
    if (location) {
      const manualLocation = { ...location, source: 'manual' };
      setUserLocation(manualLocation);
      localStorage.setItem('userManualLocation', JSON.stringify(manualLocation));
      console.log('📍 Manual location set:', location.city);
      // Refresh profiles with new location
      setPage(1);
      setProfiles([]);
      setDisplayedProfiles([]);
    }
  }, []);

  // Filter options - Simple and clean
  const filterOptions = useMemo(() => [
    { id: 'all', label: 'For You', icon: <Whatshot sx={{ fontSize: 18 }} /> },
    { id: 'nearby', label: 'Nearby', icon: <LocationOn sx={{ fontSize: 18 }} /> },
    { id: 'online', label: 'Online', icon: <AccessTime sx={{ fontSize: 18 }} /> },
    { id: 'verified', label: 'Verified', icon: <Verified sx={{ fontSize: 18 }} /> },
    { id: 'trending', label: 'Top Rated', icon: <Star sx={{ fontSize: 18 }} /> },
  ], []);

  // Fetch profiles from backend recommendation engine
  const fetchProfiles = useCallback(async (pageNum = 1, append = false) => {
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
        queryParams.set('userLat', userLocation.lat.toString());
        queryParams.set('userLng', userLocation.lng.toString());
        // Also send city and country for country-first filtering
        if (userLocation.city) {
          queryParams.set('userCity', userLocation.city);
        }
        if (userLocation.country) {
          queryParams.set('userCountry', userLocation.country);
        }
      }

      // Add auth token for personalized recommendations
      const headers = {};
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/users/profiles?${queryParams}`, { headers });
      
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
          return true;
        })
        .map(user => ({
          id: user.id,
          username: user.username,
          profileData: user.profile_data || {},
          verificationTier: parseInt(user.verification_tier) || 1,
          trustScore: parseFloat(user.reputation_score) || 75,
          isPremium: user.is_subscribed,
          isOnline: user.isOnline || false, // From recommendation engine
          lastActive: user.lastSeen || user.last_active || user.created_at,
          createdAt: user.created_at,
          // Recommendation engine data - ensure numbers
          distance: user.distance != null ? parseFloat(user.distance) : null,
          recommendationScore: parseFloat(user.recommendationScore) || 0,
          successRate: parseFloat(user.successRate) || 0,
          sameCountry: user.sameCountry,
        }));

      if (append) {
        setProfiles(prev => [...prev, ...processedProfiles]);
        setDisplayedProfiles(prev => [...prev, ...processedProfiles]);
      } else {
        setProfiles(processedProfiles);
        setDisplayedProfiles(processedProfiles);
      }

      setHasMore(processedProfiles.length === 24);
      setPage(pageNum);

      // Track search/filter activity
      if (searchQuery) {
        activityTracker.trackSearch(searchQuery, { filter: activeFilter });
      }

    } catch (err) {
      console.error('Error fetching profiles:', err);
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeFilter, searchQuery, isAuthenticated, currentUser, reduxUser, userLocation]);

  // Initial load - wait for location to be available
  useEffect(() => {
    if (!locationLoading) {
      fetchProfiles(1);
    }
  }, [activeFilter, locationLoading]); // Refetch when filter changes or location becomes available

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== '') {
        fetchProfiles(1);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
    setSelectedProfile(profile);
    setShowChat(true);
  }, [isAuthenticated, navigate]);

  // Handle profile click
  const handleProfileClick = useCallback((profile) => {
    navigate(`/profile/${profile.id}`);
  }, [navigate]);

  // Handle filter change
  const handleFilterChange = useCallback((filterId) => {
    setActiveFilter(filterId);
    setPage(1);
    setProfiles([]);
    setDisplayedProfiles([]);
    activityTracker.trackFilter('category', filterId);
  }, []);

  // Grid columns based on screen size
  const getGridColumns = () => {
    if (isMobile) return 1;
    if (isTablet) return 2;
    return 4;
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%)',
        pt: 2,
        pb: 8,
      }}
    >
      <Container maxWidth="xl">
        {/* Header */}
        <Box sx={{ mb: 3 }}>
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
                  label={userLocation.city || userLocation.name || 'Location enabled'}
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
        <Box sx={{ mb: 2 }}>
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
                  <IconButton size="small" onClick={() => setSearchQuery('')}>
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
                  You've seen all profiles
                </Typography>
              </Box>
            )}

            {/* Empty State */}
            {displayedProfiles.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                  No profiles found
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)', mt: 1 }}>
                  Try adjusting your filters
                </Typography>
              </Box>
            )}
          </>
        )}
      </Container>

      {/* Chat Dialog */}
      {showChat && selectedProfile && (
        <ChatSystem
          recipientId={selectedProfile.id}
          recipientName={selectedProfile.profileData?.firstName || selectedProfile.username}
          onClose={() => {
            setShowChat(false);
            setSelectedProfile(null);
          }}
        />
      )}

      {/* Location Picker Dialog */}
      <LocationPicker
        open={showLocationPicker}
        onClose={() => setShowLocationPicker(false)}
        currentLocation={userLocation}
        onSelectLocation={(location) => {
          console.log('📍 Location selected:', location.name, location.lat, location.lng);
          
          // Save to localStorage for persistence
          localStorage.setItem('userManualLocation', JSON.stringify({
            lat: location.lat,
            lng: location.lng,
            city: location.name,
            country: 'Ghana',
            district: location.district,
            region: location.region,
            method: location.method,
            precision: location.precision
          }));
          
          setUserLocation({
            lat: location.lat,
            lng: location.lng,
            city: location.name,
            country: 'Ghana',
            source: location.method,
            precision: location.precision
          });
          
          // Refetch profiles with new location
          setPage(1);
          setProfiles([]);
          setDisplayedProfiles([]);
        }}
      />
    </Box>
  );
};

export default ProfileFeed;
