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
  useMediaQuery
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
  Speed
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSelector, useDispatch } from 'react-redux';
import { selectIsSubscribed, selectUser } from '../store/slices/authSlice';
import { API_BASE_URL, getUploadUrl } from '../config/constants';
import ChatSystem from '../components/ChatSystem';

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

    const getUserLocation = async () => {
      setLocationLoading(true);
      
      // Start IP detection immediately (as backup)
      const ipLocationPromise = getIPLocation();
      
      // Try browser geolocation
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            // GPS success - use precise location
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
              source: 'gps'
            });
            setLocationLoading(false);
          },
          async (error) => {
            console.log('Geolocation denied/blocked, using IP detection:', error.message);
            // Use IP location (already fetching)
            const ipLocation = await ipLocationPromise;
            if (ipLocation) {
              setUserLocation(ipLocation);
              console.log('📍 IP-based location:', ipLocation.city, ipLocation.country);
            }
            setLocationLoading(false);
          },
          { 
            enableHighAccuracy: false, // Faster response
            timeout: 5000, // Shorter timeout
            maximumAge: 600000 // Cache for 10 minutes
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
          verificationTier: user.verification_tier || 1,
          trustScore: user.reputation_score || 75,
          isPremium: user.is_subscribed,
          isOnline: user.isOnline || false, // From recommendation engine
          lastActive: user.lastSeen || user.last_active || user.created_at,
          createdAt: user.created_at,
          // Recommendation engine data
          distance: user.distance, // Distance in km from backend
          recommendationScore: user.recommendationScore,
          successRate: user.successRate,
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
              <Chip
                size="small"
                icon={<NearMe sx={{ fontSize: 14, color: '#00f2ea !important' }} />}
                label={userLocation.city ? `${userLocation.city}` : 'Location enabled'}
                sx={{
                  bgcolor: 'rgba(0,242,234,0.1)',
                  color: '#00f2ea',
                  border: '1px solid rgba(0,242,234,0.2)',
                  fontSize: '0.75rem',
                  height: 24,
                  '& .MuiChip-icon': { color: '#00f2ea' },
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
    </Box>
  );
};

export default ProfileFeed;
