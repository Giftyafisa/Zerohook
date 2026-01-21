/**
 * TikTok-Style Profile Feed - Redesigned
 * 
 * Based on actual TikTok design:
 * - Top: Horizontal tabs (For You, Following, Nearby) + Search icon
 * - Full-screen profile images
 * - Right-side: Chat, Share, More (not Like - that's for content)
 * - Bottom: Clean name/location/bio overlay
 * - Stats integrated into profile info, not separate chips
 * - NO profile counter (removed per user request)
 * - TikTok-style engagement tracking (view duration, scroll, etc.)
 * - Uber/Bolt-style location sorting (same country first, closest first)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Avatar,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  Snackbar,
} from '@mui/material';
import {
  LocationOn,
  Message,
  Share,
  MoreVert,
  Verified,
  Star,
  Circle,
  Search,
  Close,
  ArrowBack,
  History,
  TrendingUp,
  Person,
  AccessTime,
  MyLocation,
  NearMe,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import { selectDetectedCountry, selectUserCountry } from '../store/slices/countrySlice';
import { API_BASE_URL } from '../config/constants';
import { resolveProfileImage } from '../utils/imageUtils';
import { VerificationBadge } from './ui/StatusBadge';
import ProfileCompletionReminder from './ProfileCompletionReminder';
import { motion, AnimatePresence } from 'framer-motion';
import useCurrency from '../hooks/useCurrency';
import useProfileEngagement from '../hooks/useProfileEngagement';

// ============================================
// TIKTOK-STYLE TOP NAVIGATION
// ============================================
const TopNavigation = ({ activeTab, onTabChange, onSearchOpen }) => {
  // Updated tabs based on user feedback - more relevant filters that work with recommendation engine
  const tabs = [
    { id: 'foryou', label: 'For You' },
    { id: 'online', label: 'Online' },
    { id: 'verified', label: 'Verified' },
    { id: 'toprated', label: 'Top Rated' },
  ];

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        pt: 'env(safe-area-inset-top, 12px)',
        pb: 1,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          position: 'relative',
        }}
      >
        {/* Tabs */}
        <Box sx={{ display: 'flex', gap: 3 }}>
          {tabs.map((tab) => (
            <Box
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              sx={{
                cursor: 'pointer',
                py: 1,
                position: 'relative',
              }}
            >
              <Typography
                sx={{
                  color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.6)',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  fontSize: '1rem',
                  transition: 'all 0.2s',
                }}
              >
                {tab.label}
              </Typography>
              {/* Active indicator */}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 24,
                    height: 3,
                    backgroundColor: '#fff',
                    borderRadius: 2,
                  }}
                />
              )}
            </Box>
          ))}
        </Box>

        {/* Search Icon */}
        <IconButton
          onClick={onSearchOpen}
          sx={{
            position: 'absolute',
            right: 8,
            color: '#fff',
          }}
        >
          <Search />
        </IconButton>
      </Box>
    </Box>
  );
};

// ============================================
// TIKTOK-STYLE SEARCH OVERLAY (Redesigned)
// - Autocomplete suggestions as you type
// - Full search results view with tabs
// - Grid and list view options like TikTok
// ============================================
const SearchOverlay = ({ open, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [autocompleteSuggestions, setAutocompleteSuggestions] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState('users');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const navigate = useNavigate();
  const searchTimeoutRef = useRef(null);
  const { convertFromUSD } = useCurrency();

  // Trending suggestions (like TikTok's suggestions)
  const trendingSuggestions = [
    'massage services',
    'escort in accra',
    'sugar mommy',
    'hookup lagos',
    'companion services',
    'nightlife kumasi',
  ];

  // Search result tabs like TikTok
  const searchTabs = [
    { id: 'users', label: 'Users' },
    { id: 'verified', label: 'Verified' },
    { id: 'online', label: 'Online' },
    { id: 'nearby', label: 'Nearby' },
  ];

  // Load recent searches on mount
  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem('zerohook_recent_searches');
      if (saved) {
        try {
          setRecentSearches(JSON.parse(saved).slice(0, 6));
        } catch (e) {
          setRecentSearches([]);
        }
      }
      // Reset state when opening
      setHasSearched(false);
      setSearchResults([]);
      setSearchQuery('');
    }
  }, [open]);

  // Generate autocomplete suggestions as user types
  useEffect(() => {
    if (searchQuery.trim().length >= 1 && !hasSearched) {
      // Generate suggestions based on query
      const query = searchQuery.toLowerCase();
      const suggestions = [];
      
      // Add matching recent searches first
      recentSearches.forEach(s => {
        if (s.toLowerCase().includes(query) && suggestions.length < 3) {
          suggestions.push({ text: s, type: 'recent' });
        }
      });
      
      // Add trending suggestions that match
      trendingSuggestions.forEach(s => {
        if (s.toLowerCase().includes(query) && suggestions.length < 6) {
          suggestions.push({ text: s, type: 'trending' });
        }
      });
      
      // Add the raw query as a suggestion
      if (!suggestions.find(s => s.text.toLowerCase() === query)) {
        suggestions.unshift({ text: searchQuery, type: 'query' });
      }
      
      // Add variations
      if (suggestions.length < 8) {
        const variations = [
          `${searchQuery} in ghana`,
          `${searchQuery} services`,
          `${searchQuery} near me`,
        ];
        variations.forEach(v => {
          if (suggestions.length < 8 && !suggestions.find(s => s.text === v)) {
            suggestions.push({ text: v, type: 'suggestion' });
          }
        });
      }
      
      setAutocompleteSuggestions(suggestions.slice(0, 8));
    } else if (!searchQuery.trim()) {
      setAutocompleteSuggestions([]);
    }
  }, [searchQuery, recentSearches, hasSearched]);

  // Execute search and show results
  const executeSearch = async (query, tab = 'users') => {
    if (!query.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    
    // Save to recent searches
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 8);
    setRecentSearches(updated);
    localStorage.setItem('zerohook_recent_searches', JSON.stringify(updated));
    
    try {
      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      const params = new URLSearchParams({
        search: query,
        limit: '20',
      });
      
      // Add filter based on tab
      if (tab === 'verified') params.set('filter', 'verified');
      if (tab === 'online') params.set('filter', 'online');
      if (tab === 'nearby') params.set('filter', 'nearby');

      const response = await fetch(
        `${API_BASE_URL}/users/browse?${params}`,
        { headers }
      );
      
      if (response.ok) {
        const data = await response.json();
        const profiles = (data.data || data.users || []).map(profile => {
          const profileData = profile.profile_data || profile.profileData || {};
          const basePrice = profileData.basePrice != null ? parseFloat(profileData.basePrice) : null;
          const converted = basePrice != null ? convertFromUSD(basePrice) : null;
          return {
            ...profile,
            profileData,
            displayPrice: converted,
          };
        });
        setSearchResults(profiles);
      }
    } catch (e) {
      console.log('Search failed:', e);
      setSearchResults([]);
    }
    setLoading(false);
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    setSearchQuery(suggestion);
    executeSearch(suggestion, activeTab);
  };

  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (hasSearched && searchQuery.trim()) {
      executeSearch(searchQuery, tab);
    }
  };

  // Navigate to profile
  const goToProfile = (profile) => {
    navigate(`/profile/${profile.id || profile._id}`);
    onClose();
  };

  // Remove from history
  const removeFromHistory = (searchText, e) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== searchText);
    setRecentSearches(updated);
    localStorage.setItem('zerohook_recent_searches', JSON.stringify(updated));
  };

  // Clear all history
  const clearHistory = () => {
    setRecentSearches([]);
    localStorage.removeItem('zerohook_recent_searches');
  };

  // Go back to suggestions from results
  const goBack = () => {
    if (hasSearched) {
      setHasSearched(false);
      setSearchResults([]);
    } else {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: '#0a0a0f',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Search Header */}
      <Box
        sx={{
          pt: 'env(safe-area-inset-top, 12px)',
          px: 2,
          pb: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          flexShrink: 0,
        }}
      >
        <IconButton onClick={goBack} sx={{ color: '#fff', p: 0.5 }}>
          <ArrowBack />
        </IconButton>
        
        <TextField
          autoFocus
          fullWidth
          placeholder="Search profiles..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (hasSearched) setHasSearched(false);
          }}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && searchQuery.trim()) {
              executeSearch(searchQuery, activeTab);
            }
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.1)',
              borderRadius: '8px',
              '& fieldset': { border: 'none' },
              '& input': { 
                color: '#fff', 
                py: 1,
                fontSize: '0.95rem',
                '&::placeholder': { color: 'rgba(255,255,255,0.5)' }
              },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 20 }} />
              </InputAdornment>
            ),
            endAdornment: searchQuery && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => { setSearchQuery(''); setHasSearched(false); }}>
                  <Close sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 18 }} />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
        
        <Typography
          onClick={() => searchQuery.trim() && executeSearch(searchQuery, activeTab)}
          sx={{
            color: searchQuery.trim() ? '#fe2c55' : 'rgba(255,255,255,0.3)',
            fontWeight: 600,
            cursor: searchQuery.trim() ? 'pointer' : 'default',
            whiteSpace: 'nowrap',
            fontSize: '0.95rem',
          }}
        >
          Search
        </Typography>
      </Box>

      {/* Results Tabs - Only show when we have results */}
      {hasSearched && (
        <Box
          sx={{
            display: 'flex',
            gap: 0,
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            flexShrink: 0,
          }}
        >
          {searchTabs.map(tab => (
            <Box
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              sx={{
                flex: 1,
                py: 1.5,
                textAlign: 'center',
                color: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.5)',
                fontWeight: activeTab === tab.id ? 600 : 400,
                fontSize: '0.9rem',
                cursor: 'pointer',
                borderBottom: activeTab === tab.id ? '2px solid #fff' : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
            </Box>
          ))}
        </Box>
      )}

      {/* Content Area */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {/* Loading State */}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} sx={{ color: '#00f2ea' }} />
          </Box>
        )}

        {/* Search Results - TikTok User List Style */}
        {hasSearched && !loading && (
          <Box>
            {searchResults.length > 0 ? (
              <List sx={{ py: 0 }}>
                {searchResults.map((profile) => {
                  const profileData = profile.profileData || profile.profile_data || {};
                  const displayName = profileData.firstName || profile.username;
                  const profileImage = resolveProfileImage(profileData);
                  const bio = profileData.bio || '';
                  const location = profileData.location?.city || '';
                  const isVerified = (profile.verification_tier || profile.verificationTier || 0) >= 2;
                  const isOnline = profile.isOnline || profile.is_online;
                  
                  return (
                    <ListItem
                      key={profile.id || profile._id}
                      onClick={() => goToProfile(profile)}
                      sx={{
                        cursor: 'pointer',
                        px: 2,
                        py: 1.5,
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                      }}
                    >
                      {/* Profile Image */}
                      <Box sx={{ position: 'relative', mr: 1.5 }}>
                        <Avatar
                          src={profileImage}
                          sx={{ width: 52, height: 52 }}
                        >
                          {displayName?.charAt(0)?.toUpperCase()}
                        </Avatar>
                        {isOnline && (
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: 2,
                              right: 2,
                              width: 12,
                              height: 12,
                              borderRadius: '50%',
                              bgcolor: '#4ade80',
                              border: '2px solid #0a0a0f',
                            }}
                          />
                        )}
                      </Box>
                      
                      {/* Profile Info */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography 
                            sx={{ 
                              color: '#fff', 
                              fontWeight: 600, 
                              fontSize: '0.95rem',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {displayName}
                          </Typography>
                          {isVerified && (
                            <Verified sx={{ color: '#20d5ec', fontSize: 16 }} />
                          )}
                        </Box>
                        <Typography 
                          sx={{ 
                            color: 'rgba(255,255,255,0.5)', 
                            fontSize: '0.8rem',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          @{profile.username}{location ? ` • ${location}` : ''}
                        </Typography>
                        {bio && (
                          <Typography 
                            sx={{ 
                              color: 'rgba(255,255,255,0.6)', 
                              fontSize: '0.8rem',
                              mt: 0.25,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {bio}
                          </Typography>
                        )}
                      </Box>
                      
                      {/* Follow/View Button */}
                      <Box
                        sx={{
                          bgcolor: '#fe2c55',
                          color: '#fff',
                          px: 2,
                          py: 0.75,
                          borderRadius: '4px',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          ml: 1,
                        }}
                      >
                        View
                      </Box>
                    </ListItem>
                  );
                })}
              </List>
            ) : (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Person sx={{ fontSize: 64, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '1rem' }}>
                  No users found for "{searchQuery}"
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', mt: 0.5 }}>
                  Try a different search term
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Autocomplete Suggestions - Show while typing (before search) */}
        {!hasSearched && searchQuery.trim() && autocompleteSuggestions.length > 0 && (
          <List sx={{ py: 0 }}>
            {autocompleteSuggestions.map((suggestion, index) => (
              <ListItem
                key={index}
                onClick={() => handleSuggestionClick(suggestion.text)}
                sx={{
                  cursor: 'pointer',
                  px: 2,
                  py: 1.25,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {suggestion.type === 'recent' ? (
                    <History sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }} />
                  ) : suggestion.type === 'trending' ? (
                    <TrendingUp sx={{ color: '#fe2c55', fontSize: 20 }} />
                  ) : (
                    <Search sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }} />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={suggestion.text}
                  sx={{ 
                    '& .MuiTypography-root': { 
                      color: '#fff',
                      fontSize: '0.95rem',
                    } 
                  }}
                />
                <NearMe 
                  sx={{ 
                    fontSize: 18, 
                    color: 'rgba(255,255,255,0.3)', 
                    transform: 'rotate(-45deg)' 
                  }} 
                />
              </ListItem>
            ))}
          </List>
        )}

        {/* Initial State - Recent & Trending (when no search query) */}
        {!hasSearched && !searchQuery.trim() && (
          <>
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5 }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500, fontSize: '0.9rem' }}>
                    Recent
                  </Typography>
                  <Typography
                    onClick={clearHistory}
                    sx={{ color: '#fe2c55', fontSize: '0.8rem', cursor: 'pointer' }}
                  >
                    Clear all
                  </Typography>
                </Box>
                <List sx={{ py: 0 }}>
                  {recentSearches.map((search, index) => (
                    <ListItem
                      key={index}
                      onClick={() => handleSuggestionClick(search)}
                      sx={{
                        cursor: 'pointer',
                        px: 2,
                        py: 1,
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <History sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 20 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={search}
                        sx={{ '& .MuiTypography-root': { color: '#fff', fontSize: '0.95rem' } }}
                      />
                      <IconButton
                        size="small"
                        onClick={(e) => removeFromHistory(search, e)}
                        sx={{ color: 'rgba(255,255,255,0.3)' }}
                      >
                        <Close sx={{ fontSize: 18 }} />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              </>
            )}

            {/* Trending / You May Like */}
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500, fontSize: '0.9rem', mb: 1 }}>
                You may like
              </Typography>
              <List sx={{ py: 0 }}>
                {trendingSuggestions.map((suggestion, index) => (
                  <ListItem
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    sx={{
                      cursor: 'pointer',
                      px: 0,
                      py: 1,
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <Circle sx={{ fontSize: 8, color: index < 2 ? '#fe2c55' : 'rgba(255,255,255,0.3)' }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={suggestion}
                      sx={{
                        '& .MuiTypography-root': {
                          color: index < 2 ? '#fe2c55' : '#fff',
                          fontWeight: index < 2 ? 500 : 400,
                          fontSize: '0.95rem',
                        }
                      }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </>
        )}
      </Box>
    </motion.div>
  );
};

// ============================================
// FULL-SCREEN PROFILE CARD - REDESIGNED
// With TikTok-style engagement tracking
// ============================================
const FullScreenProfileCard = ({
  profile,
  onShare,
  onMessage,
  onViewProfile,
  index,
}) => {
  // Use the currency hook for consistent currency symbol based on detected country
  const { symbol: detectedCurrencySymbol } = useCurrency();
  
  // TikTok-style engagement tracking
  const {
    startTracking,
    stopTracking,
    trackScrollDepth,
    trackBioExpand,
    trackContactClick
  } = useProfileEngagement(profile?.id);
  
  // Track view start time for this profile
  const viewStartRef = useRef(null);
  const hasTrackedRef = useRef(false);
  
  // Start tracking when profile becomes visible
  useEffect(() => {
    if (profile?.id && !hasTrackedRef.current) {
      viewStartRef.current = Date.now();
      startTracking();
      hasTrackedRef.current = true;
    }
    
    // Cleanup: stop tracking when profile changes or unmounts
    return () => {
      if (hasTrackedRef.current && profile?.id) {
        stopTracking('exit');
        hasTrackedRef.current = false;
      }
    };
  }, [profile?.id, startTracking, stopTracking]);
  
  const profileData = profile.profileData || {};
  const displayName = profileData.firstName || profile.username || 'User';
  const age = profileData.age;
  const city = profileData.location?.city || '';
  const country = profileData.location?.country || '';
  const bio = profileData.bio || '';
  const verificationTier = profile.verificationTier || 1;
  const isOnline = profile.isOnline;
  const trustScore = Math.round(parseFloat(profile.trustScore) || 75);
  const price = profile.displayPrice?.amount ?? profileData.basePrice;
  // Use displayPrice symbol if available, otherwise use detected currency symbol (not hardcoded ₦)
  const priceSymbol = profile.displayPrice?.symbol || detectedCurrencySymbol;
  
  const profileImage = resolveProfileImage(profileData);
  const isAvailable = profileData.availability?.includes?.(
    new Date().toLocaleDateString('en-US', { weekday: 'long' })
  ) ?? true;

  const location = [city, country].filter(Boolean).join(', ');

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        bgcolor: '#000',
      }}
    >
      {/* Full-Screen Profile Image */}
      {profileImage ? (
        <Box
          component="img"
          src={profileImage}
          alt={displayName}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
          }}
        />
      ) : (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f13 100%)',
          }}
        >
          <Avatar
            sx={{
              width: 120,
              height: 120,
              fontSize: 48,
              bgcolor: 'rgba(0,242,234,0.2)',
              color: '#00f2ea',
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </Avatar>
        </Box>
      )}

      {/* Bottom Gradient Overlay */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '50%',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 50%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Right Side Actions - TikTok Style (Chat, Share, More) */}
      <Box
        sx={{
          position: 'absolute',
          right: 12,
          bottom: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2.5,
          zIndex: 10,
        }}
      >
        {/* Chat Button */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              trackContactClick(); // Track engagement before navigating
              onMessage(profile);
            }}
            sx={{
              bgcolor: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(8px)',
              width: 48,
              height: 48,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
            }}
          >
            <Message sx={{ color: '#fff', fontSize: 26 }} />
          </IconButton>
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 500, mt: 0.5, fontSize: '0.7rem' }}>
            Chat
          </Typography>
        </Box>

        {/* Share Button */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onShare(profile);
            }}
            sx={{
              bgcolor: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(8px)',
              width: 48,
              height: 48,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
            }}
          >
            <Share sx={{ color: '#fff', fontSize: 26 }} />
          </IconButton>
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 500, mt: 0.5, fontSize: '0.7rem' }}>
            Share
          </Typography>
        </Box>

        {/* More/View Profile Button */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onViewProfile(profile);
            }}
            sx={{
              bgcolor: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(8px)',
              width: 48,
              height: 48,
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
            }}
          >
            <MoreVert sx={{ color: '#fff', fontSize: 26 }} />
          </IconButton>
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 500, mt: 0.5, fontSize: '0.7rem' }}>
            More
          </Typography>
        </Box>
      </Box>

      {/* Bottom Info Overlay - Cleaner Design */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 70,
          p: 2,
          pb: 4,
          zIndex: 10,
        }}
      >
        {/* Name, Age & Verification */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
          <Typography
            sx={{
              color: '#fff',
              fontWeight: 700,
              fontSize: '1.4rem',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              fontFamily: '"Outfit", sans-serif',
            }}
          >
            {displayName}{age ? `, ${age}` : ''}
          </Typography>
          {verificationTier >= 2 && (
            <Verified sx={{ color: '#20d5ec', fontSize: 20 }} />
          )}
        </Box>

        {/* Location */}
        {location && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <LocationOn sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 16 }} />
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 500,
                fontSize: '0.9rem',
              }}
            >
              {location}
            </Typography>
          </Box>
        )}

        {/* Stats Row - Clean inline design */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5 }}>
          {/* Trust Score */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Star sx={{ color: '#ffd700', fontSize: 16 }} />
            <Typography sx={{ color: '#ffd700', fontWeight: 700, fontSize: '0.9rem' }}>
              {trustScore}%
            </Typography>
          </Box>

          {/* Availability */}
          {isAvailable && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Circle sx={{ color: '#4ade80', fontSize: 8 }} />
              <Typography sx={{ color: '#4ade80', fontWeight: 600, fontSize: '0.85rem' }}>
                Available
              </Typography>
            </Box>
          )}

          {/* Price */}
          {price > 0 && (
            <Typography sx={{ color: '#00f2ea', fontWeight: 700, fontSize: '0.9rem' }}>
              {priceSymbol}{Number(price).toLocaleString()}
            </Typography>
          )}
        </Box>

        {/* Bio */}
        {bio && (
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: '0.9rem',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {bio}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

// ============================================
// MAIN TIKTOK FEED COMPONENT - REDESIGNED
// With engagement tracking for algorithm learning
// NOW WITH: Uber/Bolt-style location sorting
// ============================================
const TikTokProfileFeed = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { isAuthenticated } = useAuth();
  const currentUser = useSelector(selectUser);
  const detectedCountry = useSelector(selectDetectedCountry);
  const userCountry = useSelector(selectUserCountry);

  // State
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState('foryou');
  const [showSearch, setShowSearch] = useState(false);
  
  // Location state for Uber/Bolt-style sorting
  const [userLocation, setUserLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState(null);
  
  // Track view time for current profile (for skip/swipe engagement)
  const viewStartTimeRef = useRef(Date.now());
  const currentProfileIdRef = useRef(null);

  // Refs
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const isScrolling = useRef(false);

  // Get user's GPS location on mount (like Uber detects driver location)
  useEffect(() => {
    const getGPSLocation = async () => {
      setLocationLoading(true);
      
      // First try to get GPS
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
            );
          });
          
          const country = userCountry?.code || detectedCountry?.code || 'GH';
          const countryName = userCountry?.name || detectedCountry?.name || 'Ghana';
          
          // Find nearest city using the API
          try {
            const cityResponse = await fetch(
              `${API_BASE_URL}/geolocation/nearest-city?lat=${position.coords.latitude}&lng=${position.coords.longitude}&country=${country}`
            );
            const cityData = await cityResponse.json();
            
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              city: cityData.success ? cityData.city : null,
              country: countryName,
              countryCode: country,
              source: 'gps',
              accuracy: position.coords.accuracy
            });
            console.log('📍 Mobile GPS location:', position.coords.latitude, position.coords.longitude, cityData.city);
          } catch (e) {
            // Fallback without city name
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              country: countryName,
              countryCode: country,
              source: 'gps'
            });
          }
          
          setLocationLoading(false);
          return;
        } catch (gpsError) {
          console.log('📍 GPS failed, using fallback:', gpsError.message);
        }
      }
      
      // Fallback to saved manual location
      const savedLocation = localStorage.getItem('userManualLocation');
      if (savedLocation) {
        try {
          const loc = JSON.parse(savedLocation);
          setUserLocation({
            ...loc,
            source: 'manual'
          });
          setLocationLoading(false);
          return;
        } catch (e) {}
      }
      
      // Final fallback: use detected country with no coordinates
      const country = userCountry || detectedCountry;
      if (country) {
        setUserLocation({
          country: country.name,
          countryCode: country.code,
          source: 'country_only'
        });
      }
      
      setLocationLoading(false);
    };
    
    getGPSLocation();
  }, [userCountry, detectedCountry]);

  // Use the currency hook for converting prices
  const { convertFromUSD } = useCurrency();

  // Fetch profiles with location data
  const fetchProfiles = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      
      // Map tab IDs to API filter parameters
      const filterMap = {
        'foryou': 'all',
        'online': 'online',
        'verified': 'verified',
        'toprated': 'trending',
      };
      
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '10',
        filter: filterMap[activeTab] || 'all',
        sort: 'recommendation',
      });

      // CRITICAL: Always send location for Uber/Bolt-style sorting
      if (userLocation) {
        if (userLocation.lat && userLocation.lng) {
          params.append('userLat', userLocation.lat.toString());
          params.append('userLng', userLocation.lng.toString());
        }
        if (userLocation.city) {
          params.append('userCity', userLocation.city);
        }
        if (userLocation.country) {
          params.append('userCountry', userLocation.country);
        }
        if (userLocation.countryCode) {
          params.append('countryCode', userLocation.countryCode);
        }
        params.append('locationSource', userLocation.source || 'unknown');
      } else {
        // Fallback: try saved manual location
        const savedLocation = localStorage.getItem('userManualLocation');
        if (savedLocation) {
          try {
            const loc = JSON.parse(savedLocation);
            if (loc.lat && loc.lng) {
              params.append('lat', loc.lat);
              params.append('lng', loc.lng);
            }
          } catch (e) {}
        }
      }

      const token = localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const response = await fetch(
        `${API_BASE_URL}/users/browse?${params}`,
        { headers }
      );

      if (!response.ok) throw new Error('Failed to load profiles');
      
      const data = await response.json();
      let newProfiles = data.data || data.users || [];

      // Filter out current user
      if (currentUser?.id) {
        newProfiles = newProfiles.filter(p => p.id !== currentUser.id);
      }

      // Process profiles with currency conversion
      const processedProfiles = newProfiles.map(profile => {
        const profileData = profile.profile_data || profile.profileData || {};
        const basePrice = profileData.basePrice != null ? parseFloat(profileData.basePrice) : null;
        const converted = basePrice != null ? convertFromUSD(basePrice) : null;
        
        return {
          ...profile,
          id: profile._id || profile.id,
          profileData,
          profile_data: profileData,
          verificationTier: parseInt(profile.verification_tier || profile.verificationTier) || 1,
          trustScore: parseFloat(profile.reputation_score || profile.reputationScore || profile.trustScore) || 75,
          isOnline: profile.isOnline || profile.is_online || false,
          displayPrice: converted, // Currency-converted price
        };
      });

      if (append) {
        setProfiles(prev => [...prev, ...processedProfiles]);
      } else {
        setProfiles(processedProfiles);
        setCurrentIndex(0);
      }

      setHasMore(processedProfiles.length === 10);
      setPage(pageNum);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentUser?.id, userLocation, convertFromUSD]);

  // Initial load - wait for location
  useEffect(() => {
    if (!locationLoading) {
      fetchProfiles(1);
    }
  }, [fetchProfiles, locationLoading]);

  // Load more when near end
  useEffect(() => {
    if (currentIndex >= profiles.length - 3 && hasMore && !loading) {
      fetchProfiles(page + 1, true);
    }
  }, [currentIndex, profiles.length, hasMore, loading, page, fetchProfiles]);

  // Handle tab change
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setProfiles([]);
    setCurrentIndex(0);
    fetchProfiles(1);
  };

  // Handle swipe navigation with engagement tracking
  const handleSwipe = useCallback((direction) => {
    if (isScrolling.current) return;
    
    isScrolling.current = true;
    
    // Calculate view duration for the current profile being swiped away
    const viewDuration = Date.now() - viewStartTimeRef.current;
    const currentProfile = profiles[currentIndex];
    
    // Send engagement data for the profile being swiped away
    if (currentProfile?.id) {
      // Determine if this was a quick skip (< 2 seconds = low interest)
      const action = viewDuration < 2000 ? 'skip' : 'exit';
      
      // Send engagement event via API (the FullScreenProfileCard handles socket)
      try {
        const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
        const token = localStorage.getItem('token');
        fetch(`${API_BASE}/api/users/engagement`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify({
            profileId: currentProfile.id,
            viewDuration,
            action,
            swipeDirection: direction
          })
        }).catch(() => {}); // Silent fail
      } catch (e) {}
    }
    
    if (direction === 'up' && currentIndex < profiles.length - 1) {
      setCurrentIndex(prev => prev + 1);
      // Reset view timer for next profile
      viewStartTimeRef.current = Date.now();
    } else if (direction === 'down' && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      // Reset view timer for previous profile
      viewStartTimeRef.current = Date.now();
    }
    
    // Debounce scrolling
    setTimeout(() => {
      isScrolling.current = false;
    }, 300);
  }, [currentIndex, profiles]);

  // Touch handlers
  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    const diff = touchStartY.current - touchEndY.current;
    const threshold = 50;
    if (Math.abs(diff) > threshold) {
      handleSwipe(diff > 0 ? 'up' : 'down');
    }
  };

  // Wheel handler
  const handleWheel = useCallback((e) => {
    if (Math.abs(e.deltaY) > 30) {
      handleSwipe(e.deltaY > 0 ? 'up' : 'down');
    }
  }, [handleSwipe]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp') handleSwipe('down');
      if (e.key === 'ArrowDown') handleSwipe('up');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipe]);

  // Handle share
  const handleShare = useCallback(async (profile) => {
    const profileUrl = `${window.location.origin}/profile/${profile.id}`;
    const shareData = {
      title: `Check out ${profile.profileData?.firstName || profile.username} on Zerohook`,
      text: profile.profileData?.bio || 'View this profile on Zerohook',
      url: profileUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(profileUrl);
        // Could show a toast here
      }
    } catch (err) {
      console.log('Share failed:', err);
    }
  }, []);

  // Handle message - Navigate to chat with this user
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

  // Handle view profile
  const handleViewProfile = useCallback((profile) => {
    navigate(`/profile/${profile.id}`);
  }, [navigate]);

  // Loading state
  if (loading && profiles.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0a0a0f',
        }}
      >
        <CircularProgress sx={{ color: '#00f2ea' }} />
      </Box>
    );
  }

  // Empty state
  if (!loading && profiles.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0a0a0f',
          color: '#fff',
          gap: 2,
          p: 3,
        }}
      >
        <TopNavigation
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onSearchOpen={() => setShowSearch(true)}
        />
        <Typography variant="h6">No profiles found</Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          Try a different filter or come back later
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      sx={{
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        bgcolor: '#000',
        position: 'relative',
        overscrollBehavior: 'none',
        touchAction: 'pan-y',
      }}
    >
      {/* Profile Completion Reminder - Shows at top if profile incomplete */}
      {isAuthenticated && currentIndex === 0 && (
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 'env(safe-area-inset-top, 60px)', 
            left: 0, 
            right: 0, 
            zIndex: 200,
            px: 1,
            pt: 1
          }}
        >
          <ProfileCompletionReminder variant="banner" showDismiss={true} />
        </Box>
      )}

      {/* Top Navigation - TikTok Style */}
      <TopNavigation
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onSearchOpen={() => setShowSearch(true)}
      />

      {/* Search Overlay */}
      <AnimatePresence>
        {showSearch && (
          <SearchOverlay open={showSearch} onClose={() => setShowSearch(false)} />
        )}
      </AnimatePresence>

      {/* Profile Cards */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{ height: '100%', width: '100%' }}
        >
          {profiles[currentIndex] && (
            <FullScreenProfileCard
              profile={profiles[currentIndex]}
              index={currentIndex}
              onShare={handleShare}
              onMessage={handleMessage}
              onViewProfile={handleViewProfile}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Scroll Progress - Minimal dots (NO counter) */}
      <Box
        sx={{
          position: 'absolute',
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          zIndex: 50,
        }}
      >
        {profiles.slice(
          Math.max(0, currentIndex - 2),
          Math.min(profiles.length, currentIndex + 3)
        ).map((_, i) => {
          const actualIndex = Math.max(0, currentIndex - 2) + i;
          return (
            <Box
              key={actualIndex}
              sx={{
                width: 4,
                height: actualIndex === currentIndex ? 16 : 4,
                borderRadius: 2,
                bgcolor: actualIndex === currentIndex ? '#fff' : 'rgba(255,255,255,0.3)',
                transition: 'all 0.3s ease',
              }}
            />
          );
        })}
      </Box>
    </Box>
  );
};

export default TikTokProfileFeed;
