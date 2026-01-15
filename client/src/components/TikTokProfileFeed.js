/**
 * TikTok-Style Full-Screen Profile Feed
 * 
 * Features:
 * - Full-screen profile cards (image fills viewport)
 * - Vertical swipe/scroll navigation with snap
 * - Essential info overlaid with gradient protection
 * - Minimal UI - profile image is hero
 * - Touch-optimized for mobile
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Chip,
  Avatar,
} from '@mui/material';
import {
  LocationOn,
  Favorite,
  FavoriteBorder,
  Message,
  MoreVert,
  Verified,
  Star,
  Circle,
  KeyboardArrowUp,
  KeyboardArrowDown,
  Close,
  FilterList,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSelector } from 'react-redux';
import { selectIsSubscribed, selectUser } from '../store/slices/authSlice';
import { selectUserCountry, selectDetectedCountry } from '../store/slices/countrySlice';
import { API_BASE_URL } from '../config/constants';
import { resolveProfileImage } from '../utils/imageUtils';
import { VerificationBadge } from './ui/StatusBadge';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// FULL-SCREEN PROFILE CARD
// ============================================
const FullScreenProfileCard = ({
  profile,
  isActive,
  onLike,
  onMessage,
  onViewProfile,
  isLiked,
  index,
}) => {
  const profileData = profile.profileData || {};
  const displayName = profileData.firstName || profile.username || 'User';
  const age = profileData.age;
  const city = profileData.location?.city || 'Unknown';
  const country = profileData.location?.country || '';
  const bio = profileData.bio || '';
  const verificationTier = profile.verificationTier || 1;
  const isOnline = profile.isOnline;
  const trustScore = Math.round(parseFloat(profile.trustScore) || 75);
  const price = profile.displayPrice?.amount ?? profileData.basePrice ?? 0;
  const priceSymbol = profile.displayPrice?.symbol || '₦';
  
  // Get profile image
  const profileImage = resolveProfileImage(profileData);
  
  // Available status
  const isAvailable = profileData.availability?.includes?.(
    new Date().toLocaleDateString('en-US', { weekday: 'long' })
  ) ?? true;

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

      {/* Top Gradient Overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '120px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.6) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom Gradient Overlay - Contains all info */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '45%',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 40%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top Left - Verification Badge */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 10,
        }}
      >
        <VerificationBadge
          tier={verificationTier}
          variant="chip"
          size="small"
          showUnverified={false}
        />
      </Box>

      {/* Top Right - Online Status */}
      {isOnline && (
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            borderRadius: '12px',
            px: 1,
            py: 0.5,
          }}
        >
          <Circle sx={{ fontSize: 8, color: '#4ade80' }} />
          <Typography variant="caption" sx={{ color: '#4ade80', fontWeight: 600, fontSize: '0.7rem' }}>
            Online
          </Typography>
        </Box>
      )}

      {/* Right Side Actions - TikTok Style */}
      <Box
        sx={{
          position: 'absolute',
          right: 12,
          bottom: '25%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          zIndex: 10,
        }}
      >
        {/* Like Button */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onLike(profile.id);
            }}
            sx={{
              bgcolor: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              width: 48,
              height: 48,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
            }}
          >
            {isLiked ? (
              <Favorite sx={{ color: '#ff4757', fontSize: 28 }} />
            ) : (
              <FavoriteBorder sx={{ color: '#fff', fontSize: 28 }} />
            )}
          </IconButton>
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, mt: 0.5 }}>
            Like
          </Typography>
        </Box>

        {/* Message Button */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onMessage(profile);
            }}
            sx={{
              bgcolor: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              width: 48,
              height: 48,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
            }}
          >
            <Message sx={{ color: '#00f2ea', fontSize: 28 }} />
          </IconButton>
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, mt: 0.5 }}>
            Chat
          </Typography>
        </Box>

        {/* View Profile Button */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onViewProfile(profile);
            }}
            sx={{
              bgcolor: 'rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              width: 48,
              height: 48,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
            }}
          >
            <MoreVert sx={{ color: '#fff', fontSize: 28 }} />
          </IconButton>
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, mt: 0.5 }}>
            More
          </Typography>
        </Box>
      </Box>

      {/* Bottom Info Overlay */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 70, // Leave space for action buttons
          p: 2,
          pb: 3,
          zIndex: 10,
        }}
      >
        {/* Name & Age */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography
            variant="h5"
            sx={{
              color: '#fff',
              fontWeight: 800,
              fontSize: '1.5rem',
              textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              fontFamily: '"Outfit", sans-serif',
            }}
          >
            {displayName}{age ? `, ${age}` : ''}
          </Typography>
          {verificationTier >= 2 && (
            <Verified sx={{ color: '#00f2ea', fontSize: 20 }} />
          )}
        </Box>

        {/* Location */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <LocationOn sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 16 }} />
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255,255,255,0.9)',
              fontWeight: 500,
              textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}
          >
            {city}{country ? `, ${country}` : ''}
          </Typography>
        </Box>

        {/* Tags Row */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
          {/* Trust Score */}
          <Chip
            icon={<Star sx={{ color: '#FFD700 !important', fontSize: 14 }} />}
            label={`${trustScore}%`}
            size="small"
            sx={{
              bgcolor: 'rgba(255,215,0,0.15)',
              color: '#FFD700',
              border: '1px solid rgba(255,215,0,0.3)',
              fontWeight: 700,
              fontSize: '0.75rem',
              height: 26,
              '& .MuiChip-icon': { ml: 0.5 },
            }}
          />
          
          {/* Availability */}
          {isAvailable && (
            <Chip
              icon={<Circle sx={{ color: '#4ade80 !important', fontSize: 8 }} />}
              label="Available"
              size="small"
              sx={{
                bgcolor: 'rgba(74,222,128,0.15)',
                color: '#4ade80',
                border: '1px solid rgba(74,222,128,0.3)',
                fontWeight: 600,
                fontSize: '0.75rem',
                height: 26,
              }}
            />
          )}

          {/* Price */}
          {price > 0 && (
            <Chip
              label={`${priceSymbol}${Number(price).toLocaleString()}`}
              size="small"
              sx={{
                bgcolor: 'rgba(0,242,234,0.15)',
                color: '#00f2ea',
                border: '1px solid rgba(0,242,234,0.3)',
                fontWeight: 700,
                fontSize: '0.75rem',
                height: 26,
              }}
            />
          )}
        </Box>

        {/* Bio - 2 lines max */}
        {bio && (
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: '0.875rem',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}
          >
            {bio}
          </Typography>
        )}
      </Box>

      {/* Swipe Hint - Only on first card */}
      {index === 0 && (
        <Box
          sx={{
            position: 'absolute',
            bottom: '50%',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            opacity: 0.6,
            animation: 'bounce 2s infinite',
            '@keyframes bounce': {
              '0%, 100%': { transform: 'translateX(-50%) translateY(0)' },
              '50%': { transform: 'translateX(-50%) translateY(-10px)' },
            },
          }}
        >
          <KeyboardArrowUp sx={{ color: '#fff', fontSize: 32 }} />
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>
            Swipe up for more
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// ============================================
// MAIN TIKTOK FEED COMPONENT
// ============================================
const TikTokProfileFeed = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const currentUser = useSelector(selectUser);
  const isSubscribed = useSelector(selectIsSubscribed);
  const userCountry = useSelector(selectUserCountry);
  const detectedCountry = useSelector(selectDetectedCountry);

  // State
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [likedProfiles, setLikedProfiles] = useState(new Set());
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');

  // Refs
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);

  // Filter options
  const filters = [
    { id: 'all', label: 'All' },
    { id: 'nearby', label: 'Nearby' },
    { id: 'online', label: 'Online' },
    { id: 'verified', label: 'Verified' },
    { id: 'new', label: 'New' },
  ];

  // Fetch profiles
  const fetchProfiles = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '10',
        sort: 'recommendation',
        filter: activeFilter,
      });

      // Add user location if available
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
  }, [activeFilter, currentUser?.id]);

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

  // Handle swipe navigation
  const handleSwipe = useCallback((direction) => {
    if (direction === 'up' && currentIndex < profiles.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (direction === 'down' && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
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

  // Wheel handler for desktop
  const handleWheel = useCallback((e) => {
    if (Math.abs(e.deltaY) > 30) {
      handleSwipe(e.deltaY > 0 ? 'up' : 'down');
    }
  }, [handleSwipe]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp' || e.key === 'k') {
        handleSwipe('down');
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        handleSwipe('up');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipe]);

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

  // Handle filter change
  const handleFilterChange = (filterId) => {
    setActiveFilter(filterId);
    setShowFilters(false);
    fetchProfiles(1);
  };

  // Loading state
  if (loading && profiles.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0f0f13',
        }}
      >
        <CircularProgress sx={{ color: '#00f2ea' }} />
      </Box>
    );
  }

  // Error state
  if (error && profiles.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0f0f13',
          color: '#fff',
          gap: 2,
          p: 3,
        }}
      >
        <Typography color="error">{error}</Typography>
        <IconButton
          onClick={() => fetchProfiles(1)}
          sx={{ color: '#00f2ea' }}
        >
          Try Again
        </IconButton>
      </Box>
    );
  }

  // Empty state
  if (profiles.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#0f0f13',
          color: '#fff',
          gap: 2,
          p: 3,
        }}
      >
        <Typography>No profiles found</Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          Try adjusting your filters
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
        // Prevent pull-to-refresh on mobile
        overscrollBehavior: 'none',
        touchAction: 'pan-y',
      }}
    >
      {/* Filter Toggle Button - Top Left */}
      <IconButton
        onClick={() => setShowFilters(!showFilters)}
        sx={{
          position: 'absolute',
          top: 16,
          left: 60, // After verification badge
          zIndex: 100,
          bgcolor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
        }}
      >
        <FilterList sx={{ color: '#fff', fontSize: 20 }} />
      </IconButton>

      {/* Filter Dropdown */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'absolute',
              top: 60,
              left: 16,
              right: 16,
              zIndex: 100,
            }}
          >
            <Box
              sx={{
                bgcolor: 'rgba(20,20,25,0.95)',
                backdropFilter: 'blur(20px)',
                borderRadius: 2,
                p: 2,
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography sx={{ color: '#fff', fontWeight: 600 }}>Filters</Typography>
                <IconButton size="small" onClick={() => setShowFilters(false)}>
                  <Close sx={{ color: '#fff', fontSize: 18 }} />
                </IconButton>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {filters.map(filter => (
                  <Chip
                    key={filter.id}
                    label={filter.label}
                    onClick={() => handleFilterChange(filter.id)}
                    sx={{
                      bgcolor: activeFilter === filter.id ? '#00f2ea' : 'rgba(255,255,255,0.1)',
                      color: activeFilter === filter.id ? '#000' : '#fff',
                      fontWeight: 600,
                      '&:hover': {
                        bgcolor: activeFilter === filter.id ? '#00f2ea' : 'rgba(255,255,255,0.2)',
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Counter - Top Right */}
      <Box
        sx={{
          position: 'absolute',
          top: 56,
          right: 16,
          zIndex: 100,
          bgcolor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          borderRadius: '8px',
          px: 1.5,
          py: 0.5,
        }}
      >
        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600 }}>
          {currentIndex + 1} / {profiles.length}
        </Typography>
      </Box>

      {/* Scroll Progress Indicator */}
      <Box
        sx={{
          position: 'absolute',
          right: 4,
          top: '50%',
          transform: 'translateY(-50%)',
          height: '40%',
          width: 3,
          bgcolor: 'rgba(255,255,255,0.2)',
          borderRadius: 2,
          zIndex: 100,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: '100%',
            height: `${((currentIndex + 1) / profiles.length) * 100}%`,
            bgcolor: '#00f2ea',
            borderRadius: 2,
            transition: 'height 0.3s ease',
          }}
        />
      </Box>

      {/* Profile Cards - Vertical Stack with Animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          style={{ height: '100%', width: '100%' }}
        >
          {profiles[currentIndex] && (
            <FullScreenProfileCard
              profile={profiles[currentIndex]}
              isActive={true}
              index={currentIndex}
              isLiked={likedProfiles.has(profiles[currentIndex].id)}
              onLike={handleLike}
              onMessage={handleMessage}
              onViewProfile={handleViewProfile}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation Hints - Bottom */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 0.5,
          zIndex: 100,
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
                width: actualIndex === currentIndex ? 16 : 6,
                height: 6,
                borderRadius: 3,
                bgcolor: actualIndex === currentIndex ? '#00f2ea' : 'rgba(255,255,255,0.4)',
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
