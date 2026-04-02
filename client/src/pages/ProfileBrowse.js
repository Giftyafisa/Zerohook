import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Pagination,
  CircularProgress,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { toast } from 'react-toastify';
import {
  LocationOn,
  Star,
  Security,
  FavoriteBorder,
  Favorite,
  Message,
  Chat,
  FilterList,
  ViewModule,
  ViewList,
  Search
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSelector } from 'react-redux';
import { selectIsSubscribed } from '../store/slices/authSlice';
import { isProvider } from '../utils/accountTypeUtils';
import { 
  getAllCities, 
  getCitiesByCountry, 
  getUserLocation
} from '../config/locations';
import { getDefaultImage } from '../config/images';
import ChatSystem from '../components/ChatSystem';
import { API_BASE_URL, getUploadUrl } from '../config/constants';
import apiClient from '../services/apiClient';
import { extractProfileImagePath } from '../utils/imageUtils';
import usePresence from '../hooks/usePresence';

const ProfileBrowse = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // < 900px
  // const isSmallMobile = useMediaQuery(theme.breakpoints.down('sm')); // < 600px - unused
  const isLargeScreen = useMediaQuery(theme.breakpoints.up('xl')); // >= 1536px
  const navigate = useNavigate();
  const { user: currentUser, isAuthenticated } = useAuth();
  const isSubscribed = useSelector(selectIsSubscribed);
  
  // State
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [lastErrorTime, setLastErrorTime] = useState(null);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [connectionDialog, setConnectionDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [quickChatDialog, setQuickChatDialog] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState('prompt');
  const [debugMode] = useState(process.env.NODE_ENV === 'development');
  const [filters, setFilters] = useState({
    country: 'all',
    city: '',
    ageRange: [18, 50],
    verificationTier: 'all',
    trustScore: [0, 100],
    distance: 100, // km
    category: 'all',
    priceRange: [0, 1000],
    availability: 'all',
    languages: [],
    specializations: []
  });
  const [viewMode, setViewMode] = useState('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('distance');

  // Search timeout ref for debounced search
  const searchTimeout = useRef(null);
  
  // AbortController ref for cancelling in-flight requests
  const abortControllerRef = useRef(null);
  
  // Request ID to ignore stale responses
  const requestIdRef = useRef(0);
  
  // Mounted ref to prevent state updates after unmount
  const mountedRef = useRef(true);
  
  // Ref to prevent infinite loops
  const isInitialMount = useRef(true);

  // Fallback mock data for when API is unavailable
  const fallbackProfiles = [
    {
      id: '1',
      username: 'Sarah_Professional',
      profileData: {
        firstName: 'Sarah',
        lastName: 'Johnson',
        age: 28,
        bio: 'Professional escort with 5+ years experience. Discreet and reliable.',
        location: { city: 'Lagos', country: 'Nigeria' },
        occupation: 'Professional Escort',
        languages: ['English', 'Yoruba'],
        specializations: ['Long Term', 'Short Term'],
        serviceCategories: ['Long Term', 'Short Term'],
        basePrice: 250,
        availability: ['Weekdays', 'Weekends']
      },
      verificationTier: 3,
      trustScore: 95,
      is_subscribed: true,
      subscription_tier: 'premium',
      created_at: '2024-01-15T10:00:00Z',
      lastActive: '2024-08-15T14:30:00Z'
    },
    {
      id: '2',
      username: 'Grace_Elegant',
      profileData: {
        firstName: 'Grace',
        lastName: 'Williams',
        age: 25,
        bio: 'Elegant and sophisticated companion for discerning clients.',
        location: { city: 'Accra', country: 'Ghana' },
        occupation: 'High-End Companion',
        languages: ['English', 'Twi'],
        specializations: ['Special Services', 'Long Term'],
        serviceCategories: ['Special Services', 'Long Term'],
        basePrice: 400,
        availability: ['Weekends', 'Evenings']
      },
      verificationTier: 2,
      trustScore: 88,
      is_subscribed: true,
      subscription_tier: 'elite',
      created_at: '2024-02-20T12:00:00Z',
      lastActive: '2024-08-15T16:45:00Z'
    },
    {
      id: '3',
      username: 'Maria_Charming',
      profileData: {
        firstName: 'Maria',
        lastName: 'Rodriguez',
        age: 26,
        bio: 'Charming and attentive companion. Specializing in oral services.',
        location: { city: 'Port Harcourt', country: 'Nigeria' },
        occupation: 'Companion',
        languages: ['English', 'Spanish'],
        specializations: ['Oral Services', 'Short Term'],
        serviceCategories: ['Oral Services', 'Short Term'],
        basePrice: 180,
        availability: ['Weekdays', 'Evenings']
      },
      verificationTier: 1,
      trustScore: 75,
      is_subscribed: false,
      subscription_tier: 'free',
      created_at: '2024-03-10T09:00:00Z',
      lastActive: '2024-08-15T13:20:00Z'
    }
  ];
  const isLocationDetecting = useRef(false);
  const isFetchingProfiles = useRef(false);

  // Get all available cities for filters
  const allCities = getAllCities();
  const ghanaCities = getCitiesByCountry('ghana');
  const nigeriaCities = getCitiesByCountry('nigeria');

  // FIXED: Stable callback with proper dependencies
  const detectUserLocation = useCallback(async () => {
    if (isLocationDetecting.current) return; // Prevent multiple simultaneous calls
    
    try {
      isLocationDetecting.current = true;
      setLocationPermission('prompt');
      const location = await getUserLocation();
      setUserLocation(location);
      setLocationPermission('granted');
      
      // Auto-set city filter to nearest city
      if (location.nearestCity) {
        setFilters(prev => ({
          ...prev,
          city: location.nearestCity.name,
          country: location.nearestCity.country.toLowerCase()
        }));
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('📍 User location detected:', location);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('📍 Location detection failed:', error);
      }
      setLocationPermission('denied');
      
      // Set default location for testing
      if (debugMode && process.env.NODE_ENV !== 'production') {
        console.log('📍 Setting default location for debugging');
        setUserLocation({
          coordinates: { lat: 5.5600, lng: -0.2057 }, // Accra, Ghana
          nearestCity: { name: 'Accra', country: 'Ghana' },
          distance: 0
        });
      }
    } finally {
      isLocationDetecting.current = false;
    }
  }, [debugMode]); // Only depends on debugMode

  // IMPROVED: Stable callback with AbortController for race condition prevention
  const fetchProfiles = useCallback(async (pageNum = 1, currentFilters = null) => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    // Track request ID to ignore stale responses
    const currentRequestId = ++requestIdRef.current;
    
    // Guard against state updates if unmounted
    if (!mountedRef.current) return;
    
    try {
      setLoading(true);
      setError(null);
      setIsRetrying(false);
      
      // Use passed filters or current state filters
      const filtersToUse = currentFilters || filters;
      
      // Build query parameters
      const queryParams = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20'
      });
      
      // Add filters to query params
      if (filtersToUse.country && filtersToUse.country !== 'all') {
        queryParams.append('country', filtersToUse.country);
      }
      if (filtersToUse.city) {
        queryParams.append('city', filtersToUse.city);
      }
      if (filtersToUse.ageRange[0] !== 18 || filtersToUse.ageRange[1] !== 50) {
        queryParams.append('minAge', filtersToUse.ageRange[0].toString());
        queryParams.append('maxAge', filtersToUse.ageRange[1].toString());
      }
      if (filtersToUse.verificationTier !== 'all') {
        queryParams.append('verificationTier', filtersToUse.verificationTier);
      }
      if (filtersToUse.trustScore[0] !== 0 || filtersToUse.trustScore[1] !== 100) {
        queryParams.append('minTrustScore', filtersToUse.trustScore[0].toString());
        queryParams.append('maxTrustScore', filtersToUse.trustScore[1].toString());
      }
      if (filtersToUse.category !== 'all') {
        queryParams.append('category', filtersToUse.category);
      }
      if (filtersToUse.priceRange[0] !== 0 || filtersToUse.priceRange[1] !== 1000) {
        queryParams.append('minPrice', filtersToUse.priceRange[0].toString());
        queryParams.append('maxPrice', filtersToUse.priceRange[1].toString());
      }
      if (filtersToUse.availability !== 'all') {
        queryParams.append('availability', filtersToUse.availability);
      }
      
      // Add sortBy to server request for server-side sorting
      if (sortBy) {
        queryParams.append('sortBy', sortBy);
      }
      
      // Add user location for distance calculation if available
      if (userLocation?.coordinates) {
        queryParams.append('lat', userLocation.coordinates.lat.toString());
        queryParams.append('lng', userLocation.coordinates.lng.toString());
      }
      
      // Fetch profiles with filters, pagination, and AbortController signal
      let response;
      try {
        response = await apiClient.get(`/users/profiles?${queryParams.toString()}`, {
          signal: controller.signal
        });
      } catch (fetchError) {
        // Re-throw abort/cancel errors
        if (fetchError.name === 'AbortError' || fetchError.code === 'ERR_CANCELED') {
          throw fetchError;
        }
        // Handle 500 with fallback data
        if (fetchError.response?.status === 500) {
          if (process.env.NODE_ENV !== 'production') {
            console.log('⚠️ API returned 500 error, using fallback data');
          }
          setApiUnavailable(true);
          
          const processedFallbackProfiles = fallbackProfiles.map(user => {
            try {
              if (isAuthenticated && currentUser && currentUser.id === user.id) {
                return null;
              }
              
              return {
                id: user.id,
                username: user.username,
                email: 'sample@example.com',
                profileData: user.profileData,
                verificationTier: user.verificationTier,
                trustScore: user.trustScore,
                createdAt: user.created_at,
                lastActive: user.lastActive,
                subscriptionStatus: user.is_subscribed ? 'subscribed' : 'free',
                subscriptionTier: user.subscription_tier || 'basic',
                isPremium: user.is_subscribed && (user.subscription_tier === 'premium' || user.subscription_tier === 'elite'),
                distance: null
              };
            } catch (profileError) {
              console.error('Error processing fallback profile:', profileError);
              return null;
            }
          }).filter(Boolean);
          
          setProfiles(processedFallbackProfiles);
          setTotalPages(1);
          setPage(1);
          setError('API temporarily unavailable. Showing sample profiles for demonstration.');
          setLoading(false);
          return;
        }
        throw new Error(fetchError.response?.data?.error || `HTTP ${fetchError.response?.status}: Request failed`);
      }
      
      // Ignore stale responses
      if (currentRequestId !== requestIdRef.current || !mountedRef.current) {
        return;
      }
      
      const data = response.data;
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔍 Fetched profiles:', data);
      }
      
      // Validate that we have users data
      if (!data.users || !Array.isArray(data.users)) {
        throw new Error('Invalid response format: missing or invalid users array');
      }
      
      // Process profiles with location data and ensure proper structure
      const processedProfiles = data.users.map(user => {
        try {
          // CRITICAL FIX: Skip the logged-in user's own profile
          if (isAuthenticated && currentUser && currentUser.id === user.id) {
            if (process.env.NODE_ENV !== 'production') {
              console.log('🚫 Skipping logged-in user profile:', user.username);
            }
            return null; // This will be filtered out
          }
          
          // CRITICAL: ProfileBrowse should only show providers (sex workers)
          // Backend filters this, but double-check as safety net
          if (!isProvider(user)) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn(`🚫 Filtering non-provider from browse: ${user.username} (${user.profile_data?.accountType || 'unknown'})`);
            }
            return null;
          }

          // ENHANCED: Add subscription status indicators
          const profileData = user.profile_data || {};
          const hasProfileImage = !!(
            user.profile_image ||
            user.profile_image_url ||
            extractProfileImagePath(profileData)
          );
          
          return {
            id: user.id,
            username: user.username,
            email: user.email,
            profileData: {
              ...profileData,
              firstName: profileData.firstName || user.username || 'User',
              lastName: profileData.lastName || '',
              age: parseInt(profileData.age) || 25,
              bio: profileData.bio || 'Professional service provider',
              location: profileData.location || { city: 'Various', country: 'Unknown' },
              basePrice: parseFloat(profileData.basePrice) || 0,
              availability: Array.isArray(profileData.availability) ? profileData.availability : ['Weekends'],
              languages: Array.isArray(profileData.languages) ? profileData.languages : ['English'],
              specializations: Array.isArray(profileData.specializations) ? profileData.specializations : ['GFE'],
              profilePicture: extractProfileImagePath(profileData)
            },
            hasProfileImage,
            verificationTier: parseInt(user.verification_tier) || 1,
            trustScore: parseFloat(user.reputation_score) || 0,
            // ENHANCED: Subscription status for user differentiation
            subscriptionStatus: user.is_subscribed ? 'subscribed' : 'free',
            subscriptionTier: user.subscription_tier || 'basic',
            isPremium: user.is_subscribed && (user.subscription_tier === 'premium' || user.subscription_tier === 'elite'),
            createdAt: user.created_at,
            lastActive: user.last_active || user.created_at
          };
        } catch (error) {
          console.error('Error processing profile:', error);
          return null;
        }
      }).filter(Boolean); // CRITICAL: Remove null profiles (including logged-in user)
      
      if (process.env.NODE_ENV !== 'production') {
        console.log('📊 Processed profiles count:', processedProfiles.length);
        console.log('📊 Sample processed profile:', processedProfiles[0]);
      }
      
      if (!mountedRef.current) return;
      
      setProfiles(processedProfiles);
      setTotalPages(data.pagination.pages);
      setPage(data.pagination.page);
    } catch (error) {
      // Silently ignore abort/cancel errors - these are expected when cancelling requests
      if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
        return;
      }
      
      // Ignore stale responses
      if (currentRequestId !== requestIdRef.current || !mountedRef.current) {
        return;
      }
      
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error fetching profiles:', error);
      }
      
      // Enhanced error handling
      const errorMessage = error.message || 'Failed to fetch profiles. Please try again.';
      setError(errorMessage);
      setLastErrorTime(new Date().toISOString());
      setProfiles([]);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setIsRetrying(false);
      }
    }
  // Dependencies minimized - filters and userLocation passed as params, not deps
  // This prevents excessive re-creations of the callback
  }, [isAuthenticated, currentUser?.id, sortBy]);

  // FIXED: Initial mount effect - runs once on component mount
  useEffect(() => {
    mountedRef.current = true;
    
    if (isInitialMount.current) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('🚀 ProfileBrowse component mounted, initializing...');
      }
      detectUserLocation();
      fetchProfiles();
      isInitialMount.current = false;
    }
    
    // Cleanup on unmount: cancel pending requests and timers
    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [detectUserLocation, fetchProfiles]); // FIXED: Added missing dependencies

  // FIXED: Separate effect for location-based profile updates
  useEffect(() => {
    if (userLocation && !isInitialMount.current) {
      // Only refetch if location changes after initial mount
      if (process.env.NODE_ENV !== 'production') {
        console.log('📍 Location changed, refetching profiles with distance calculations');
      }
      fetchProfiles(1, filters);
    }
  }, [userLocation]); // Simplified: only re-run when location changes

  // Debug effect to monitor state changes (only in development)
  useEffect(() => {
    if (debugMode && process.env.NODE_ENV !== 'production') {
      console.log('📊 Profiles state updated:', {
        count: profiles.length,
        loading,
        error
      });
    }
  }, [profiles.length, loading, error, debugMode]);

  // FIXED: Stable filter change handler with debouncing
  const handleFilterChange = useCallback((field, value) => {
    const newFilters = {
      ...filters,
      [field]: value
    };
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
    
    // Debounced refetch to prevent excessive API calls
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      fetchProfiles(1, newFilters);
    }, 500); // Increased debounce time to 500ms for better performance
  }, [filters, fetchProfiles]);

  // Handler functions for profile actions
  const handleFavorite = useCallback((profile) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('Favorite profile:', profile.username);
    }
    // Add to favorites logic
    // You can implement this based on your requirements
  }, []);

  const handleViewProfile = useCallback((profile) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('View profile:', profile.username);
    }
    navigate(`/profile/${profile.id}`);
  }, [navigate]);

  const handleLocationPermission = () => {
    if (locationPermission === 'denied') {
      // Show instructions to enable location
      toast.info('Please enable location services in your browser settings to get location-based results.');
    } else {
      detectUserLocation().then(() => {
        // Refetch profiles after location is detected to include distance calculations
        fetchProfiles(1, filters);
      }).catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Location detection failed:', error);
        }
      });
    }
  };

  /**
   * CLIENT-SIDE FILTERING
   * 
   * Note: The server already applies filters via the RecommendationEngine.
   * This client-side filtering provides:
   * 1. Instant UI feedback while waiting for server response
   * 2. Additional refinement for quick search within current page
   * 3. Backup filtering if server doesn't support a specific filter
   * 
   * For pagination consistency, prefer server-driven filtering.
   * Local filtering here is a UX enhancement, not the source of truth.
   */
  // Real-time online status (browse context = public, no conversation gate)
  const profileIds = useMemo(() => profiles.map(p => String(p.id || p._id)), [profiles]);
  const initialStatusMap = useMemo(
    () => profiles.reduce((acc, p) => {
      const id = String(p.id || p._id || '');
      if (id) acc[id] = !!(p.isOnline || p.is_online);
      return acc;
    }, {}),
    [profiles]
  );
  const { isUserOnline, getUserLastSeen } = usePresence(profileIds, { context: 'browse', initialStatusMap });

  // Enhance profiles with real-time online status + lastSeenLabel before filtering
  const liveProfiles = useMemo(() => profiles.map(p => ({
    ...p,
    isOnline: isUserOnline(p.id || p._id) ?? p.isOnline ?? false,
    lastSeenLabel: getUserLastSeen(p.id || p._id) ?? p.lastSeenLabel ?? null,
  })), [profiles, isUserOnline, getUserLastSeen]);

  const filteredProfiles = liveProfiles.filter(profile => {
    // Handle missing profile data gracefully
    if (!profile.profileData) return false;
    
    const matchesCountry = filters.country === 'all' || 
      profile.profileData?.location?.country?.toLowerCase() === filters.country;
    
    const matchesCity = !filters.city || 
      profile.profileData?.location?.city?.toLowerCase().includes(filters.city.toLowerCase());
    
    const matchesAge = profile.profileData?.age >= filters.ageRange[0] && 
      profile.profileData?.age <= filters.ageRange[1];
    
    const matchesVerification = filters.verificationTier === 'all' || 
      profile.verificationTier.toString() === filters.verificationTier;
    
    const matchesTrustScore = profile.trustScore >= filters.trustScore[0] && 
      profile.trustScore <= filters.trustScore[1];
    
    // FIX: Improved distance filter - if distance filter is active AND user has location,
    // profiles without distance should be placed at end (not excluded) unless distance is very restrictive
    const distanceFilterActive = userLocation && filters.distance < 100; // Only apply strict filtering when distance < 100km
    const matchesDistance = !distanceFilterActive || 
      (profile.distance != null && profile.distance <= filters.distance);
    
    // Fix: Add matchesOnline filter for "Online" preset to work
    const matchesOnline = !filters.online || profile.isOnline === true;
    
    const matchesCategory = filters.category === 'all' || 
      profile.profileData?.serviceCategories?.includes(filters.category);
    
    // FIX: Price filter - treat missing price as 0, not as "matches all"
    const profilePrice = profile.profileData?.basePrice ?? 0;
    const matchesPrice = profilePrice >= filters.priceRange[0] && 
      profilePrice <= filters.priceRange[1];
    
    const matchesAvailability = filters.availability === 'all' || 
      profile.profileData?.availability?.includes(filters.availability);
    
    const matchesLanguages = filters.languages.length === 0 || 
      filters.languages.some(lang => 
        profile.profileData?.languages?.includes(lang)
      );
    
    const matchesSpecializations = filters.specializations.length === 0 || 
      filters.specializations.some(spec => 
        profile.profileData?.specializations?.includes(spec)
      );
    
    const matchesSearch = !searchTerm || 
      profile.profileData?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.profileData?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.profileData?.bio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      profile.profileData?.occupation?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesCountry && matchesCity && matchesAge && matchesVerification && 
           matchesTrustScore && matchesDistance && matchesOnline && matchesCategory && matchesPrice &&
           matchesAvailability && matchesLanguages && matchesSpecializations && matchesSearch;
  });

  const sortedProfiles = [...filteredProfiles].sort((a, b) => {
    if (a.hasProfileImage && !b.hasProfileImage) return -1;
    if (!a.hasProfileImage && b.hasProfileImage) return 1;

    switch (sortBy) {
      case 'distance':
        // Null/undefined distances go to end
        if (a.distance == null && b.distance == null) return 0;
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
      case 'trustScore':
        return (b.trustScore ?? 0) - (a.trustScore ?? 0);
      case 'verificationTier':
        return (b.verificationTier ?? 0) - (a.verificationTier ?? 0);
      case 'recent':
        return new Date(b.lastActive || 0) - new Date(a.lastActive || 0);
      case 'price':
        // Low to high - missing prices treated as 0
        return (a.profileData?.basePrice ?? 0) - (b.profileData?.basePrice ?? 0);
      case 'priceHigh':
        // High to low - missing prices treated as 0 (go to end)
        return (b.profileData?.basePrice ?? 0) - (a.profileData?.basePrice ?? 0);
      case 'age':
        return (a.profileData?.age ?? 0) - (b.profileData?.age ?? 0);
      case 'popularity':
        return (b.trustScore ?? 0) - (a.trustScore ?? 0);
      default:
        return 0;
    }
  });

  // Use all profiles since pagination is now handled by the server
  const paginatedProfiles = sortedProfiles;

  const handlePageChange = (event, value) => {
    setPage(value);
    fetchProfiles(value, filters);
  };

  const handleConnect = (user) => {
    if (!isAuthenticated) {
      // Redirect to login if not authenticated
      navigate('/login', { state: { from: '/profiles' } });
      return;
    }
    
    setSelectedUser(user);
    setConnectionDialog(true);
  };

  const handleQuickChat = (profile) => {
    if (!isAuthenticated) {
      // Redirect to login if not authenticated
      navigate('/login', { state: { from: '/profiles' } });
      return;
    }
    
    setSelectedUser(profile);
    setQuickChatDialog(true);
  };

  const getVerificationColor = (tier) => {
    switch (tier) {
      case 4: return '#FFD700'; // Elite
      case 3: return '#9C27B0'; // Pro
      case 2: return '#2196F3'; // Advanced
      case 1: return '#4CAF50'; // Basic
      default: return '#757575';
    }
  };

  const getVerificationLabel = (tier) => {
    switch (tier) {
      case 4: return 'Elite';
      case 3: return 'Pro';
      case 2: return 'Advanced';
      case 1: return 'Basic';
      default: return 'Basic';
    }
  };

  const getTrustScoreColor = (score) => {
    if (score >= 90) return '#4CAF50';
    if (score >= 80) return '#8BC34A';
    if (score >= 70) return '#FFC107';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  if (loading) {
    return (
      <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
          Loading profiles...
        </Typography>
        {isRetrying && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Retrying... (Attempt {retryCount}/3)
          </Typography>
        )}
      </Box>
    );
  }

  // ENHANCED: Show error state with retry options
  if (error) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box display="flex" flexDirection="column" alignItems="center" minHeight="60vh">
          <Typography variant="h4" color="error" gutterBottom>
            Failed to Load Profiles
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 3, maxWidth: 600 }}>
            {error}
          </Typography>
          
          {lastErrorTime && (
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Error occurred at: {new Date(lastErrorTime).toLocaleTimeString()}
            </Typography>
          )}
          
          {retryCount > 0 && (
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Retry attempts: {retryCount}/3
            </Typography>
          )}
          
          <Box display="flex" gap={2} mt={2}>
            <Button 
              variant="contained" 
              onClick={() => {
                setError(null);
                setRetryCount(0);
                fetchProfiles();
              }}
              disabled={isRetrying}
            >
              {isRetrying ? 'Retrying...' : 'Retry Now'}
            </Button>
            
            {retryCount < 3 && (
              <Button 
                variant="outlined" 
                onClick={() => {
                  setError(null);
                  setRetryCount(0);
                  // Auto-retry will handle this
                  fetchProfiles();
                }}
                disabled={isRetrying}
              >
                Auto-Retry
              </Button>
            )}
            
            <Button 
              variant="text" 
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </Box>
          
          {/* Debug information for developers */}
          {debugMode && (
            <Box mt={4} p={2} border={1} borderColor="divider" borderRadius={1}>
              <Typography variant="h6" gutterBottom>
                Debug Information
              </Typography>
              <Typography variant="body2" component="pre" sx={{ fontSize: '0.8rem' }}>
                {JSON.stringify({
                  API_BASE_URL,
                  userLocation,
                  filters,
                  retryCount,
                  lastErrorTime
                }, null, 2)}
              </Typography>
            </Box>
          )}
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: isMobile ? 0.5 : 3, pt: isMobile ? 0 : 3 }}>
      {/* Header */}
      <Box mb={isMobile ? 1 : 3}>
        <Typography 
          variant={isMobile ? "h6" : "h4"} 
          component="h1" 
          gutterBottom 
          align="center" 
          sx={{ fontWeight: 'bold', mb: isMobile ? 0.25 : 1 }}
        >
          Discover
        </Typography>
        <Typography 
          variant="body2" 
          color="text.secondary" 
          align="center"
          sx={{ px: isMobile ? 1 : 0, display: isMobile ? 'none' : 'block' }}
        >
          Find verified profiles
        </Typography>
        
        {/* Enhanced Error Display */}
        {error && (
          <Box display="flex" justifyContent="center" mt={2}>
            <Alert severity="error" sx={{ maxWidth: 600 }}>
              <Typography variant="body1" gutterBottom>
                Failed to load profiles: {error}
              </Typography>
              {lastErrorTime && (
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Error occurred at: {new Date(lastErrorTime).toLocaleTimeString()}
                </Typography>
              )}
              {retryCount > 0 && (
                <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                  Retry attempts: {retryCount}/3
                </Typography>
              )}
              <Box display="flex" gap={1} mt={1}>
                <Button 
                  variant="outlined" 
                  onClick={() => {
                    setError(null);
                    setRetryCount(0);
                    fetchProfiles();
                  }}
                  disabled={isRetrying}
                >
                  {isRetrying ? 'Retrying...' : 'Retry Now'}
                </Button>
                {retryCount < 3 && (
                  <Button 
                    variant="text" 
                    onClick={() => {
                      setError(null);
                      setRetryCount(0);
                      // Auto-retry will handle this
                      fetchProfiles();
                    }}
                    disabled={isRetrying}
                  >
                    Auto-Retry
                  </Button>
                )}
              </Box>
            </Alert>
          </Box>
        )}
        
        {/* Debug Mode Toggle */}
        {debugMode && (
          <Box display="flex" justifyContent="center" mt={2}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                if (process.env.NODE_ENV !== 'production') {
                  console.log('🔍 Debug Info:', {
                  profiles: profiles.length,
                  userLocation,
                  filters,
                  API_BASE_URL,
                  error
                });
              }}
            >
              🔍 Debug Info
            </Button>
          </Box>
        )}
        
        {/* Location Status */}
        <Box display="flex" justifyContent="center" alignItems="center" mt={isMobile ? 1 : 2} gap={1}>
          {userLocation ? (
            <Alert 
              severity="success" 
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                py: isMobile ? 0.25 : 1,
                px: isMobile ? 1 : 2,
                '& .MuiAlert-message': { fontSize: isMobile ? '0.75rem' : 'inherit' }
              }}
            >
              📍 {userLocation.nearestCity.name}, {userLocation.nearestCity.country} 
              ({userLocation.distance.toFixed(1)}km)
            </Alert>
          ) : (
            <Alert 
              severity="info" 
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                py: isMobile ? 0.25 : 1,
                px: isMobile ? 1 : 2,
                '& .MuiAlert-message': { fontSize: isMobile ? '0.75rem' : 'inherit' }
              }}
            >
              📍 Enable location
              <Button 
                size="small" 
                onClick={handleLocationPermission}
                sx={{ ml: 1, minWidth: 'auto', px: 1, fontSize: '0.7rem' }}
              >
                Enable
              </Button>
            </Alert>
          )}
        </Box>
      </Box>

      {/* API Status Alert */}
      {apiUnavailable && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Demo Mode:</strong> The backend API is temporarily unavailable. 
            Showing sample profiles to demonstrate the application functionality. 
            All features like filtering, contact, and real-time updates will work normally once the API is restored.
          </Typography>
        </Alert>
      )}

      {/* Search and Filters */}
      <Box mb={4}>
        <Box 
          display="flex" 
          flexDirection={isMobile ? 'column' : 'row'}
          justifyContent="space-between" 
          alignItems={isMobile ? 'stretch' : 'center'} 
          gap={isMobile ? 2 : 0}
          mb={2}
        >
          <Box 
            display="flex" 
            gap={isMobile ? 1 : 2} 
            flex={1} 
            maxWidth={isMobile ? '100%' : 600}
            flexDirection={isMobile ? 'column' : 'row'}
          >
            <TextField
              fullWidth
              size={isMobile ? 'small' : 'medium'}
              placeholder={isMobile ? 'Search profiles...' : 'Search profiles by name, bio, or occupation...'}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                // Debounce search to avoid too many API calls
                if (searchTimeout.current) {
                  clearTimeout(searchTimeout.current);
                }
                searchTimeout.current = setTimeout(() => {
                  const newFilters = { ...filters };
                  fetchProfiles(1, newFilters);
                }, 500);
              }}
              inputProps={{
                'aria-label': 'Search profiles by name, bio, or occupation'
              }}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                sx: { 
                  height: isMobile ? 40 : 'auto',
                  '& input': { py: isMobile ? 0.75 : 1.5 }
                }
              }}
            />
            <Button
              variant="contained"
              color="primary"
              startIcon={<FilterList />}
              onClick={() => setShowFilters(!showFilters)}
              fullWidth={isMobile}
              aria-expanded={showFilters}
              aria-controls="profile-filters-panel"
              aria-label={showFilters ? 'Hide filter options' : 'Show filter options'}
              sx={{ 
                minHeight: isMobile ? 40 : 48,
                fontWeight: 600,
                bgcolor: showFilters ? 'primary.dark' : 'primary.main',
                boxShadow: showFilters ? 4 : 2
              }}
            >
              {showFilters ? 'Hide' : 'Filters'}
            </Button>
          </Box>
          
          <Box 
            display="flex" 
            gap={1} 
            flexDirection="row"
            alignItems="center"
            width={isMobile ? '100%' : 'auto'}
          >
            <FormControl size="small" sx={{ minWidth: isMobile ? 90 : 120, flex: isMobile ? 1 : 'none' }}>
              <InputLabel sx={{ fontSize: isMobile ? '0.8rem' : 'inherit' }}>Sort</InputLabel>
              <Select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  // Refetch profiles when sorting changes
                  fetchProfiles(1, filters);
                }}
                label="Sort"
                sx={{ height: isMobile ? 36 : 40 }}
              >
                <MenuItem value="distance">📍 Distance</MenuItem>
                <MenuItem value="trustScore">⭐ Trust</MenuItem>
                <MenuItem value="verificationTier">✓ Verified</MenuItem>
                <MenuItem value="recent">🕐 Recent</MenuItem>
                <MenuItem value="price">💰 Price ↑</MenuItem>
                <MenuItem value="priceHigh">💰 Price ↓</MenuItem>
                <MenuItem value="age">👤 Age</MenuItem>
                <MenuItem value="popularity">🔥 Popular</MenuItem>
              </Select>
            </FormControl>
            
            <Box display="flex" gap={0.5}>
              <IconButton
                color={viewMode === 'grid' ? 'primary' : 'default'}
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                title="Grid view"
                sx={{ 
                  bgcolor: viewMode === 'grid' ? 'primary.light' : 'transparent',
                  borderRadius: 1,
                  p: isMobile ? 0.75 : 1
                }}
              >
                <ViewModule fontSize={isMobile ? 'small' : 'medium'} />
              </IconButton>
              <IconButton
                color={viewMode === 'list' ? 'primary' : 'default'}
                onClick={() => setViewMode('list')}
                aria-label="List view"
                title="List view"
                sx={{ 
                  bgcolor: viewMode === 'list' ? 'primary.light' : 'transparent',
                  borderRadius: 1,
                  p: isMobile ? 0.75 : 1
                }}
              >
                <ViewList fontSize={isMobile ? 'small' : 'medium'} />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* Quick Filter Presets - Enhanced Visibility */}
        <Box mb={1}>
          <Box 
            display="flex" 
            gap={1} 
            flexWrap="nowrap"
            sx={{ 
              overflowX: 'auto', 
              pb: 1,
              mx: -1,
              px: 1,
              '&::-webkit-scrollbar': { display: 'none' },
              scrollbarWidth: 'none'
            }}
          >
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                const newFilters = {
                  ...filters,
                  country: 'ghana',
                  city: '',
                  distance: 50
                };
                setFilters(newFilters);
                setPage(1);
                fetchProfiles(1, newFilters);
              }}
              sx={{ 
                minWidth: 'auto', 
                px: 1.5, 
                py: 0.75, 
                fontSize: '0.8rem',
                fontWeight: 600,
                bgcolor: 'rgba(0, 242, 234, 0.15)',
                color: '#00f2ea',
                border: '1.5px solid rgba(0, 242, 234, 0.4)',
                borderRadius: '20px',
                whiteSpace: 'nowrap',
                '&:hover': {
                  bgcolor: 'rgba(0, 242, 234, 0.25)',
                  border: '1.5px solid rgba(0, 242, 234, 0.6)'
                }
              }}
            >
              🔥 Featured
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                const newFilters = {
                  ...filters,
                  distance: 25
                };
                setFilters(newFilters);
                setPage(1);
                fetchProfiles(1, newFilters);
              }}
              sx={{ 
                minWidth: 'auto', 
                px: 1.5, 
                py: 0.75, 
                fontSize: '0.8rem',
                fontWeight: 600,
                bgcolor: 'rgba(0, 242, 234, 0.15)',
                color: '#00f2ea',
                border: '1.5px solid rgba(0, 242, 234, 0.4)',
                borderRadius: '20px',
                whiteSpace: 'nowrap',
                '&:hover': {
                  bgcolor: 'rgba(0, 242, 234, 0.25)',
                  border: '1.5px solid rgba(0, 242, 234, 0.6)'
                }
              }}
            >
              📍 Nearby
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                const newFilters = {
                  ...filters,
                  verificationTier: '3',
                  trustScore: [80, 100]
                };
                setFilters(newFilters);
                setPage(1);
                fetchProfiles(1, newFilters);
              }}
              sx={{ 
                minWidth: 'auto', 
                px: 1.5, 
                py: 0.75, 
                fontSize: '0.8rem',
                fontWeight: 600,
                bgcolor: 'rgba(0, 242, 234, 0.15)',
                color: '#00f2ea',
                border: '1.5px solid rgba(0, 242, 234, 0.4)',
                borderRadius: '20px',
                whiteSpace: 'nowrap',
                '&:hover': {
                  bgcolor: 'rgba(0, 242, 234, 0.25)',
                  border: '1.5px solid rgba(0, 242, 234, 0.6)'
                }
              }}
            >
              ✓ Verified
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                const newFilters = {
                  ...filters,
                  online: true
                };
                setFilters(newFilters);
                setPage(1);
                fetchProfiles(1, newFilters);
              }}
              sx={{ 
                minWidth: 'auto', 
                px: 1.5, 
                py: 0.75, 
                fontSize: '0.8rem',
                fontWeight: 600,
                bgcolor: 'rgba(0, 255, 136, 0.15)',
                color: '#00ff88',
                border: '1.5px solid rgba(0, 255, 136, 0.4)',
                borderRadius: '20px',
                whiteSpace: 'nowrap',
                '&:hover': {
                  bgcolor: 'rgba(0, 255, 136, 0.25)',
                  border: '1.5px solid rgba(0, 255, 136, 0.6)'
                }
              }}
            >
              🟢 Online
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                const newFilters = {
                  ...filters,
                  priceRange: [0, 200],
                  distance: 30
                };
                setFilters(newFilters);
                setPage(1);
                fetchProfiles(1, newFilters);
              }}
              sx={{ 
                minWidth: 'auto', 
                px: 1.5, 
                py: 0.75, 
                fontSize: '0.8rem',
                fontWeight: 600,
                bgcolor: 'rgba(255, 215, 0, 0.15)',
                color: '#ffd700',
                border: '1.5px solid rgba(255, 215, 0, 0.4)',
                borderRadius: '20px',
                whiteSpace: 'nowrap',
                '&:hover': {
                  bgcolor: 'rgba(255, 215, 0, 0.25)',
                  border: '1.5px solid rgba(255, 215, 0, 0.6)'
                }
              }}
            >
              ⭐ Top Rated
            </Button>
            <Button
              size="small"
              variant="text"
              onClick={() => {
                const newFilters = {
                  country: 'all',
                  city: '',
                  ageRange: [18, 50],
                  verificationTier: 'all',
                  trustScore: [0, 100],
                  distance: 100,
                  category: 'all',
                  priceRange: [0, 1000],
                  availability: 'all',
                  languages: [],
                  specializations: []
                };
                setFilters(newFilters);
                setPage(1);
                fetchProfiles(1, newFilters);
              }}
              sx={{ 
                minWidth: 'auto', 
                px: 1.5, 
                py: 0.75, 
                fontSize: '0.8rem',
                fontWeight: 500,
                color: 'rgba(255, 255, 255, 0.6)',
                borderRadius: '20px',
                whiteSpace: 'nowrap'
              }}
            >
              ✕ Clear
            </Button>
          </Box>
        </Box>

        {/* Advanced Filters */}
        {showFilters && (
          <Box
            id="profile-filters-panel"
            role="region"
            aria-label="Profile filter options"
            sx={{ 
              p: isMobile ? 2 : 3, 
              border: '1px solid', 
              borderColor: 'divider', 
              borderRadius: 2, 
              mb: isMobile ? 2 : 3 
            }}
          >
            <Grid container spacing={isMobile ? 2 : 3}>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Country</InputLabel>
                  <Select
                    value={filters.country}
                    onChange={(e) => handleFilterChange('country', e.target.value)}
                    label="Country"
                  >
                    <MenuItem value="all">All Countries</MenuItem>
                    <MenuItem value="ghana">Ghana</MenuItem>
                    <MenuItem value="nigeria">Nigeria</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>City</InputLabel>
                  <Select
                    value={filters.city}
                    onChange={(e) => handleFilterChange('city', e.target.value)}
                    label="City"
                  >
                    <MenuItem value="">All Cities</MenuItem>
                    {filters.country === 'ghana' && ghanaCities.map(city => (
                      <MenuItem key={city.name} value={city.name}>
                        {city.name}, {city.region}
                      </MenuItem>
                    ))}
                    {filters.country === 'nigeria' && nigeriaCities.map(city => (
                      <MenuItem key={city.name} value={city.name}>
                        {city.name}, {city.state}
                      </MenuItem>
                    ))}
                    {filters.country === 'all' && allCities.map(city => (
                      <MenuItem key={`${city.country}-${city.name}`} value={city.name}>
                        {city.name}, {city.country}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Typography gutterBottom>Age Range</Typography>
                <Slider
                  value={filters.ageRange}
                  onChange={(e, newValue) => handleFilterChange('ageRange', newValue)}
                  valueLabelDisplay="auto"
                  min={18}
                  max={60}
                  step={1}
                />
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="caption">{filters.ageRange[0]} years</Typography>
                  <Typography variant="caption">{filters.ageRange[1]} years</Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Typography gutterBottom>Distance (km)</Typography>
                <Slider
                  value={filters.distance}
                  onChange={(e, newValue) => handleFilterChange('distance', newValue)}
                  valueLabelDisplay="auto"
                  min={1}
                  max={200}
                  step={5}
                />
                <Typography variant="caption" align="center" display="block">
                  Within {filters.distance}km
                </Typography>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <Typography gutterBottom>Price Range ($)</Typography>
                <Slider
                  value={filters.priceRange}
                  onChange={(e, newValue) => handleFilterChange('priceRange', newValue)}
                  valueLabelDisplay="auto"
                  min={0}
                  max={1000}
                  step={50}
                />
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="caption">${filters.priceRange[0]}</Typography>
                  <Typography variant="caption">${filters.priceRange[1]}</Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Availability</InputLabel>
                  <Select
                    value={filters.availability}
                    onChange={(e) => handleFilterChange('availability', e.target.value)}
                    label="Availability"
                  >
                    <MenuItem value="all">All Times</MenuItem>
                    <MenuItem value="Weekdays">Weekdays</MenuItem>
                    <MenuItem value="Weekends">Weekends</MenuItem>
                    <MenuItem value="Evenings">Evenings</MenuItem>
                    <MenuItem value="Late Night">Late Night</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Languages</InputLabel>
                  <Select
                    multiple
                    value={filters.languages}
                    onChange={(e) => handleFilterChange('languages', e.target.value)}
                    label="Languages"
                    renderValue={(selected) => selected.join(', ')}
                  >
                    <MenuItem value="English">English</MenuItem>
                    <MenuItem value="French">French</MenuItem>
                    <MenuItem value="Arabic">Arabic</MenuItem>
                    <MenuItem value="Hausa">Hausa</MenuItem>
                    <MenuItem value="Yoruba">Yoruba</MenuItem>
                    <MenuItem value="Igbo">Igbo</MenuItem>
                    <MenuItem value="Twi">Twi</MenuItem>
                    <MenuItem value="Ga">Ga</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Specializations</InputLabel>
                  <Select
                    multiple
                    value={filters.specializations}
                    onChange={(e) => handleFilterChange('specializations', e.target.value)}
                    label="Specializations"
                    renderValue={(selected) => selected.join(', ')}
                  >
                    <MenuItem value="GFE">GFE</MenuItem>
                    <MenuItem value="PSE">PSE</MenuItem>
                    <MenuItem value="Massage">Massage</MenuItem>
                    <MenuItem value="Travel Companion">Travel Companion</MenuItem>
                    <MenuItem value="Role Play">Role Play</MenuItem>
                    <MenuItem value="BDSM">BDSM</MenuItem>
                    <MenuItem value="Couples">Couples</MenuItem>
                    <MenuItem value="Outcall">Outcall</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        )}
      </Box>

      {/* Results Count */}
      <Box mb={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" color="text.secondary">
            Showing {filteredProfiles.length} of {profiles.length} profiles
            {userLocation && ` within ${filters.distance}km of ${userLocation.nearestCity.name}`}
            {apiUnavailable && (
              <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                <Typography variant="body2" color="warning.main">
                  ⚠️ Demo Mode - Sample Profiles
                </Typography>
              </Box>
            )}
          </Typography>
          
          {/* Filter Summary */}
          <Box display="flex" gap={1} flexWrap="wrap">
            {filters.country !== 'all' && (
              <Chip 
                label={`${filters.country.charAt(0).toUpperCase() + filters.country.slice(1)}`} 
                size="small" 
                color="primary" 
                variant="outlined"
              />
            )}
            {filters.city && (
              <Chip 
                label={filters.city} 
                size="small" 
                color="primary" 
                variant="outlined"
              />
            )}
            {filters.verificationTier !== 'all' && (
              <Chip 
                label={`Tier ${filters.verificationTier}`} 
                size="small" 
                color="primary" 
                variant="outlined"
              />
            )}
            {filters.priceRange[1] < 1000 && (
              <Chip 
                label={`$${filters.priceRange[0]}-${filters.priceRange[1]}`} 
                size="small" 
                color="primary" 
                variant="outlined"
              />
            )}
            {filters.availability !== 'all' && (
              <Chip 
                label={filters.availability} 
                size="small" 
                color="primary" 
                variant="outlined"
              />
            )}
          </Box>
        </Box>
        
        {/* Enhanced Statistics */}
        {filteredProfiles.length > 0 && (
          <Box mt={2} display="flex" gap={3} flexWrap="wrap">
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption" color="text.secondary">
                Average Price:
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="primary">
                ${Math.round(filteredProfiles.reduce((sum, p) => sum + (p.profileData?.basePrice || 0), 0) / filteredProfiles.length)}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption" color="text.secondary">
                Average Trust Score:
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="primary">
                {Math.round(filteredProfiles.reduce((sum, p) => sum + p.trustScore, 0) / filteredProfiles.length)}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption" color="text.secondary">
                Countries:
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="primary">
                {new Set(filteredProfiles.map(p => p.profileData?.location?.country)).size}
              </Typography>
            </Box>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption" color="text.secondary">
                Cities:
              </Typography>
              <Typography variant="body2" fontWeight="bold" color="primary">
                {new Set(filteredProfiles.map(p => p.profileData?.location?.city)).size}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Profiles Grid */}
      {paginatedProfiles.length === 0 && !loading ? (
        <Box textAlign="center" py={8}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {apiUnavailable ? 'No sample profiles available' : 'No profiles found'}
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            {apiUnavailable 
              ? 'The sample data is currently unavailable. Please try again later or contact support.'
              : 'Try adjusting your filters or search criteria'
            }
          </Typography>
          {!apiUnavailable && (
            <Button
              variant="outlined"
              onClick={() => {
                setFilters({
                  country: 'all',
                  city: '',
                  ageRange: [18, 50],
                  verificationTier: 'all',
                  trustScore: [0, 100],
                  distance: 100,
                  category: 'all',
                  priceRange: [0, 1000],
                  availability: 'all',
                  languages: [],
                  specializations: []
                });
                fetchProfiles(1);
              }}
            >
              Reset Filters
            </Button>
          )}
        </Box>
      ) : (
        <Grid container spacing={isMobile ? 2 : 3}>
          {paginatedProfiles.map((profile) => (
            <Grid item xs={12} sm={6} md={4} lg={isLargeScreen ? 3 : 4} key={profile.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  position: 'relative', // Added for positioning the badge
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                  }
                }}
              >
                
              {/* Subscription Status Badge */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  zIndex: 10
                }}
              >
                {profile.isPremium ? (
                  <Chip
                    label="PREMIUM"
                    size="small"
                    sx={{
                      bgcolor: 'gold',
                      color: 'black',
                      fontWeight: 'bold',
                      fontSize: '0.7rem'
                    }}
                  />
                ) : (
                  <Chip
                    label="FREE"
                    size="small"
                    variant="outlined"
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.9)',
                      fontSize: '0.7rem'
                    }}
                  />
                )}
              </Box>

              <CardMedia
                component="img"
                height={isMobile ? "200" : "250"}
                image={getUploadUrl(profile.profileData?.profilePicture) || getDefaultImage('PROFILE', profile.profileData?.gender)}
                alt={`${profile.profileData?.firstName || 'User'} ${profile.profileData?.lastName || ''} profile photo`}
                loading="lazy"
                decoding="async"
                sx={{ objectFit: 'cover' }}
                onError={(e) => {
                  // Fallback to default image if profile picture fails to load
                  e.target.src = getDefaultImage('PROFILE', profile.profileData?.gender);
                }}
              />
              
              {/* Online Status Badge */}
              <Box sx={{ position: 'absolute', top: 8, right: 8 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: profile.isOnline ? '#00ff88' : '#6a6a7a',
                    border: '2px solid #1a1a22',
                  }}
                />
              </Box>
              
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Profile Header */}
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={1}>
                  <Typography 
                    variant={isMobile ? "subtitle1" : "h6"} 
                    component="h3" 
                    sx={{ 
                      fontWeight: 'bold', 
                      flex: 1,
                      fontSize: isMobile ? '0.9rem' : 'inherit'
                    }}
                  >
                    {profile.profileData?.firstName} {profile.profileData?.lastName}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => handleFavorite(profile)}
                    aria-label={`Add ${profile.profileData?.firstName || profile.username} to favorites`}
                    title="Add to favorites"
                    sx={{ minWidth: 'auto', p: 0.5 }}
                  >
                    <FavoriteBorder fontSize="small" />
                  </IconButton>
                </Box>

                {/* Subscription and Verification Badges */}
                <Box display="flex" gap={1} mb={1} flexWrap="wrap">
                  {/* Subscription Badge */}
                  {profile.isPremium ? (
                    <Chip 
                      label="Premium" 
                      size="small" 
                      color="primary" 
                      variant="filled"
                      sx={{ fontSize: '0.7rem', fontWeight: 'bold' }}
                    />
                  ) : profile.subscriptionStatus === 'subscribed' ? (
                    <Chip 
                      label="Subscribed" 
                      size="small" 
                      color="secondary" 
                      variant="filled"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  ) : (
                    <Chip 
                      label="Free" 
                      size="small" 
                      color="default" 
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  )}
                  
                  {/* Verification Badge */}
                  {profile.verificationTier >= 4 ? (
                    <Chip 
                      label="Elite" 
                      size="small" 
                      color="warning" 
                      variant="filled"
                      sx={{ fontSize: '0.7rem', fontWeight: 'bold' }}
                    />
                  ) : profile.verificationTier >= 3 ? (
                    <Chip 
                      label="Pro" 
                      size="small" 
                      color="success" 
                      variant="filled"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  ) : profile.verificationTier >= 2 ? (
                    <Chip 
                      label="Advanced" 
                      size="small" 
                      color="info" 
                      variant="filled"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  ) : (
                    <Chip 
                      label="Basic" 
                      size="small" 
                      color="default" 
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  )}
                </Box>

                {/* Age and Location */}
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography 
                    variant={isMobile ? "caption" : "body2"} 
                    color="text.secondary" 
                    sx={{ 
                      mr: 2,
                      fontSize: isMobile ? '0.75rem' : 'inherit'
                    }}
                  >
                    {profile.profileData?.age || 'N/A'} years
                  </Typography>
                  <Box display="flex" alignItems="center">
                    <LocationOn fontSize="small" color="action" sx={{ mr: 0.5 }} />
                    <Typography 
                      variant={isMobile ? "caption" : "body2"} 
                      color="text.secondary"
                      sx={{ fontSize: isMobile ? '0.75rem' : 'inherit' }}
                    >
                      {profile.profileData?.location?.city || 'Various'}, {profile.profileData?.location?.country || 'Unknown'}
                    </Typography>
                  </Box>
                </Box>

                {/* Price and Availability */}
                <Box display="flex" alignItems="center" mb={1}>
                  <Typography 
                    variant={isMobile ? "caption" : "body2"} 
                    color="primary" 
                    sx={{ 
                      mr: 2, 
                      fontWeight: 'bold',
                      fontSize: isMobile ? '0.8rem' : 'inherit'
                    }}
                  >
                    ${profile.profileData?.basePrice || 'N/A'}
                  </Typography>
                  {profile.profileData?.availability && profile.profileData.availability.length > 0 && (
                    <Chip 
                      label={profile.profileData.availability[0]} 
                      size="small" 
                      variant="outlined"
                      sx={{ fontSize: isMobile ? '0.65rem' : '0.7rem' }}
                    />
                  )}
                </Box>

                {/* Distance - show even when 0km (very close) */}
                {profile.distance != null && (
                  <Typography variant="caption" color="primary" sx={{ mb: 1, display: 'block' }}>
                    📍 {profile.distance < 1 ? `${Math.round(profile.distance * 1000)}m` : `${profile.distance.toFixed(1)}km`} away
                  </Typography>
                )}

                {/* Bio */}
                <Typography 
                  variant={isMobile ? "caption" : "body2"} 
                  color="text.secondary" 
                  sx={{ 
                    mb: 2, 
                    flex: 1,
                    fontSize: isMobile ? '0.75rem' : 'inherit',
                    lineHeight: isMobile ? 1.3 : 1.5
                  }}
                >
                  {profile.profileData?.bio || 'Professional adult service provider'}
                </Typography>

                {/* Languages */}
                {profile.profileData?.languages && profile.profileData.languages.length > 0 && (
                  <Box mb={2}>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      Languages:
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {profile.profileData.languages.slice(0, 3).map((lang, index) => (
                        <Chip 
                          key={lang} 
                          label={lang} 
                          size="small" 
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Specializations */}
                {profile.profileData?.specializations && (
                  <Box mb={2}>
                    <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                      Specializations:
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={0.5}>
                      {profile.profileData.specializations.slice(0, 3).map((spec, index) => (
                        <Chip 
                          key={spec} 
                          label={spec} 
                          size="small" 
                          variant="outlined"
                          sx={{ fontSize: '0.7rem' }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}

                {/* Verification, Trust Score, and Subscription Status */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                  <Box display="flex" alignItems="center">
                    <Security fontSize="small" sx={{ color: getVerificationColor(profile.verificationTier), mr: 0.5 }} />
                    <Typography variant="caption" sx={{ color: getVerificationColor(profile.verificationTier) }}>
                      {getVerificationLabel(profile.verificationTier)}
                    </Typography>
                  </Box>
                  <Box display="flex" alignItems="center">
                    <Star fontSize="small" sx={{ color: getTrustScoreColor(profile.trustScore), mr: 0.5 }} />
                    <Typography variant="caption" sx={{ color: getTrustScoreColor(profile.trustScore) }}>
                      {profile.trustScore}
                    </Typography>
                  </Box>
                </Box>
                
                {/* Subscription Status Badge */}
                <Box display="flex" justifyContent="center" mb={2}>
                  <Chip
                    label={profile.subscriptionStatus === 'subscribed' ? 'Premium' : 'Free'}
                    color={profile.subscriptionStatus === 'subscribed' ? 'primary' : 'default'}
                    size="small"
                    variant={profile.isPremium ? 'filled' : 'outlined'}
                    icon={profile.isPremium ? <Star /> : null}
                  />
                </Box>

                {/* Enhanced Action Buttons */}
                <Box display="flex" gap={isMobile ? 0.5 : 1} mt="auto" flexDirection="column">
                  {/* Call Buttons */}
                  <Box display="flex" gap={1} justifyContent="center" mb={1}>
                    <IconButton
                      size="small"
                      aria-label={`Video call ${profile.profileData?.firstName || profile.username}`}
                      title="Start video call"
                      sx={{
                        bgcolor: 'rgba(0, 242, 234, 0.1)',
                        '&:hover': { bgcolor: 'rgba(0, 242, 234, 0.2)' },
                      }}
                      onClick={() => {
                        if (window.startVideoCall) {
                          window.startVideoCall(profile.id);
                        }
                      }}
                    >
                      <Message sx={{ color: '#00f2ea' }} />
                    </IconButton>
                  </Box>
                  
                  <Button
                    variant="contained"
                    fullWidth
                    size={isMobile ? "small" : "medium"}
                    onClick={() => handleViewProfile(profile)}
                    sx={{ mb: 1 }}
                  >
                    View Profile
                  </Button>
                  
                  <Box display="flex" gap={1} mt={1}>
                    <Button
                      variant="contained"
                      size="small"
                      onClick={() => handleConnect(profile)}
                      disabled={!isAuthenticated}
                      sx={{ flex: 1 }}
                      startIcon={<Message />}
                    >
                      {!isAuthenticated ? 'Login to Contact' : 'Contact'}
                    </Button>
                    
                    {isAuthenticated && (
                      <IconButton
                        size="small"
                        onClick={() => handleQuickChat(profile)}
                        color="primary"
                        aria-label={`Quick chat with ${profile.profileData?.firstName || profile.username}`}
                        title="Quick chat"
                        sx={{ 
                          border: 1, 
                          borderColor: 'primary.main',
                          '&:hover': { bgcolor: 'primary.main', color: 'white' }
                        }}
                      >
                        <Chat />
                      </IconButton>
                    )}
                    
                    <IconButton
                      size="small"
                      onClick={() => handleFavorite(profile)}
                      color={profile.isFavorited ? 'error' : 'default'}
                      aria-label={profile.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                      title={profile.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {profile.isFavorited ? <Favorite /> : <FavoriteBorder />}
                    </IconButton>
                  </Box>

                  {/* Subscription Requirement Notice */}
                  {!isSubscribed && isAuthenticated && (
                    <Alert severity="info" sx={{ mt: 1, fontSize: '0.75rem' }}>
                      <Typography variant="caption">
                        💎 Premium features require subscription. 
                        <Button size="small" onClick={() => navigate('/subscription')}>
                          Upgrade Now
                        </Button>
                      </Typography>
                    </Alert>
                  )}
                </Box>
              </CardContent>
            </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box display="flex" justifyContent="center" mt={isMobile ? 2 : 4}>
          <Pagination 
            count={totalPages} 
            page={page} 
            onChange={handlePageChange}
            color="primary"
            size={isMobile ? "medium" : "large"}
            sx={{
              '& .MuiPaginationItem-root': {
                fontSize: isMobile ? '0.8rem' : 'inherit'
              }
            }}
          />
        </Box>
      )}

      {/* No Results */}
      {filteredProfiles.length === 0 && !loading && (
        <Box textAlign="center" py={isMobile ? 4 : 8}>
          <Typography 
            variant={isMobile ? "h5" : "h6"} 
            color="text.secondary" 
            gutterBottom
          >
            No profiles found matching your criteria
          </Typography>
          <Typography 
            variant={isMobile ? "body2" : "body1"} 
            color="text.secondary" 
            mb={isMobile ? 2 : 3}
            sx={{ px: isMobile ? 2 : 0 }}
          >
            Try adjusting your filters or expanding your search area
          </Typography>
          
          {/* Helpful Suggestions */}
          <Box display="flex" justifyContent="center" gap={isMobile ? 1 : 2} flexWrap="wrap" mb={isMobile ? 2 : 3}>
            <Button
              variant="outlined"
              size={isMobile ? "small" : "medium"}
              onClick={() => setFilters({
                ...filters,
                distance: Math.min(filters.distance + 50, 200)
              })}
            >
              📍 Increase Search Radius
            </Button>
            <Button
              variant="outlined"
              size={isMobile ? "small" : "medium"}
              onClick={() => setFilters({
                ...filters,
                country: 'all',
                city: ''
              })}
            >
              🌍 Search All Countries
            </Button>
            <Button
              variant="outlined"
              size={isMobile ? "small" : "medium"}
              onClick={() => setFilters({
                ...filters,
                priceRange: [0, 1000]
              })}
            >
              💰 Remove Price Filter
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setFilters({
                ...filters,
                verificationTier: 'all',
                trustScore: [0, 100]
              })}
            >
              ⭐ Remove Verification Filter
            </Button>
          </Box>
          
          {/* Alternative Suggestions */}
          <Box mt={4}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Popular nearby locations:
            </Typography>
            <Box display="flex" justifyContent="center" gap={1} flexWrap="wrap">
              {userLocation && userLocation.nearestCity && (
                <>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setFilters({
                      ...filters,
                      city: userLocation.nearestCity.name,
                      country: userLocation.nearestCity.country.toLowerCase()
                    })}
                  >
                    📍 {userLocation.nearestCity.name}
                  </Button>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => setFilters({
                      ...filters,
                      country: 'all',
                      city: ''
                    })}
                  >
                    🌍 All Countries
                  </Button>
                </>
              )}
            </Box>
          </Box>
        </Box>
      )}

      {/* User Connection Dialog - Improved accessibility */}
      {connectionDialog && selectedUser && (
        <Dialog
          open={connectionDialog}
          onClose={() => {
            setConnectionDialog(false);
            setSelectedUser(null);
          }}
          maxWidth="md"
          fullWidth
          aria-labelledby="connection-dialog-title"
          PaperProps={{
            sx: { height: { xs: '90vh', md: '80vh' }, maxHeight: '90vh' }
          }}
        >
          <DialogTitle id="connection-dialog-title">
            Connect with {selectedUser.profileData?.firstName || selectedUser.username}
          </DialogTitle>
          <DialogContent 
            sx={{ 
              p: 0, 
              height: '100%', 
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <ChatSystem currentUser={selectedUser} />
          </DialogContent>
        </Dialog>
      )}

        {/* Quick Chat Dialog - Improved scroll handling and accessibility */}
        {quickChatDialog && selectedUser && (
          <Dialog
            open={quickChatDialog}
            onClose={() => {
              setQuickChatDialog(false);
              setSelectedUser(null);
            }}
            maxWidth="md"
            fullWidth
            aria-labelledby="quick-chat-dialog-title"
            PaperProps={{
              sx: { height: { xs: '90vh', md: '80vh' }, maxHeight: '90vh' }
            }}
          >
            <DialogTitle id="quick-chat-dialog-title">
              Quick Chat with {selectedUser.profileData?.firstName || selectedUser.username}
            </DialogTitle>
            <DialogContent 
              sx={{ 
                p: 0, 
                height: '100%', 
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <ChatSystem currentUser={selectedUser} />
            </DialogContent>
            <DialogActions>
              <Button 
                onClick={() => {
                  setQuickChatDialog(false);
                  setSelectedUser(null);
                }}
                aria-label="Close chat dialog"
              >
                Close
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </Container>
    );
  };

export default ProfileBrowse;
