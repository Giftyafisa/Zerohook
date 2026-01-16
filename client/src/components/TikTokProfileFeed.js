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
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import { API_BASE_URL } from '../config/constants';
import { resolveProfileImage } from '../utils/imageUtils';
import { VerificationBadge } from './ui/StatusBadge';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// TIKTOK-STYLE TOP NAVIGATION
// ============================================
const TopNavigation = ({ activeTab, onTabChange, onSearchOpen }) => {
  const tabs = [
    { id: 'foryou', label: 'For You' },
    { id: 'following', label: 'Following' },
    { id: 'nearby', label: 'Nearby' },
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
// TIKTOK-STYLE SEARCH OVERLAY
// ============================================
const SearchOverlay = ({ open, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [recentSearches] = useState([
    'night club girl',
    'nana_hemaaa24',
    'sophiaanane',
    'lagos hookup',
  ]);
  const [suggestions] = useState([
    { text: 'massage therapist', trending: true },
    { text: 'escort services', trending: true },
    { text: 'sugar mommy', trending: false },
    { text: 'accra girls', trending: false },
  ]);
  const navigate = useNavigate();

  const handleSearch = (query) => {
    if (query.trim()) {
      navigate(`/profiles?search=${encodeURIComponent(query)}`);
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
          gap: 2,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <IconButton onClick={onClose} sx={{ color: '#fff', p: 0.5 }}>
          <ArrowBack />
        </IconButton>
        
        <TextField
          autoFocus
          fullWidth
          placeholder="Search profiles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.1)',
              borderRadius: '20px',
              '& fieldset': { border: 'none' },
              '& input': { 
                color: '#fff', 
                py: 1,
                '&::placeholder': { color: 'rgba(255,255,255,0.5)' }
              },
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: 'rgba(255,255,255,0.5)' }} />
              </InputAdornment>
            ),
          }}
        />
        
        <Typography
          onClick={() => handleSearch(searchQuery)}
          sx={{
            color: '#fe2c55',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Search
        </Typography>
      </Box>

      {/* Search Content */}
      <Box sx={{ overflow: 'auto', height: 'calc(100% - 60px)' }}>
        {/* Recent Searches */}
        {recentSearches.length > 0 && (
          <List sx={{ py: 0 }}>
            {recentSearches.map((search, index) => (
              <ListItem
                key={index}
                onClick={() => handleSearch(search)}
                sx={{
                  cursor: 'pointer',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <History sx={{ color: 'rgba(255,255,255,0.5)' }} />
                </ListItemIcon>
                <ListItemText
                  primary={search}
                  sx={{ '& .MuiTypography-root': { color: '#fff' } }}
                />
                <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.3)' }}>
                  <Close sx={{ fontSize: 18 }} />
                </IconButton>
              </ListItem>
            ))}
          </List>
        )}

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.1)', my: 1 }} />

        {/* Suggestions */}
        <Box sx={{ px: 2, py: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
              You may like
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', cursor: 'pointer' }}>
              ↻ Refresh
            </Typography>
          </Box>
          
          <List sx={{ py: 0 }}>
            {suggestions.map((item, index) => (
              <ListItem
                key={index}
                onClick={() => handleSearch(item.text)}
                sx={{
                  cursor: 'pointer',
                  px: 0,
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.05)' },
                }}
              >
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <Circle sx={{ fontSize: 8, color: item.trending ? '#fe2c55' : 'rgba(255,255,255,0.3)' }} />
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  sx={{
                    '& .MuiTypography-root': {
                      color: item.trending ? '#fe2c55' : '#fff',
                      fontWeight: item.trending ? 500 : 400,
                    }
                  }}
                />
                {/* Placeholder for thumbnail */}
                <Box
                  sx={{
                    width: 40,
                    height: 50,
                    bgcolor: 'rgba(255,255,255,0.1)',
                    borderRadius: 1,
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      </Box>
    </motion.div>
  );
};

// ============================================
// FULL-SCREEN PROFILE CARD - REDESIGNED
// ============================================
const FullScreenProfileCard = ({
  profile,
  onShare,
  onMessage,
  onViewProfile,
  index,
}) => {
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
  const priceSymbol = profile.displayPrice?.symbol || '₦';
  
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
// ============================================
const TikTokProfileFeed = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const currentUser = useSelector(selectUser);

  // State
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeTab, setActiveTab] = useState('foryou');
  const [showSearch, setShowSearch] = useState(false);

  // Refs
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const isScrolling = useRef(false);

  // Fetch profiles
  const fetchProfiles = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '10',
        sort: activeTab === 'nearby' ? 'distance' : 'recommendation',
      });

      // Add location for nearby tab
      if (activeTab === 'nearby') {
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

      if (append) {
        setProfiles(prev => [...prev, ...newProfiles]);
      } else {
        setProfiles(newProfiles);
        setCurrentIndex(0);
      }

      setHasMore(newProfiles.length === 10);
      setPage(pageNum);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, currentUser?.id]);

  // Initial load
  useEffect(() => {
    fetchProfiles(1);
  }, [fetchProfiles]);

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

  // Handle swipe navigation
  const handleSwipe = useCallback((direction) => {
    if (isScrolling.current) return;
    
    isScrolling.current = true;
    
    if (direction === 'up' && currentIndex < profiles.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (direction === 'down' && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
    
    // Debounce scrolling
    setTimeout(() => {
      isScrolling.current = false;
    }, 300);
  }, [currentIndex, profiles.length]);

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

  // Handle message
  const handleMessage = useCallback((profile) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/profiles' } });
      return;
    }
    const avatar = resolveProfileImage(profile.profileData);
    navigate('/messages', {
      state: {
        recipientId: profile.id,
        recipientName: profile.profileData?.firstName || profile.username,
        recipientAvatar: avatar,
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
