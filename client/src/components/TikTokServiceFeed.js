/**
 * TikTok-Style Content Feed for Adult Services
 * 
 * Features:
 * - Full-screen vertical swipeable content cards
 * - Image/video fills viewport with overlay info
 * - Snap scroll between content
 * - Floating action buttons (like, message, share)
 * - Easy content creation with floating "+" button
 * - Category filters as horizontal pills overlay
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Chip,
  Avatar,
  Fab,
  Dialog,
  Slide,
} from '@mui/material';
import {
  Favorite,
  FavoriteBorder,
  ChatBubble,
  Share,
  MoreVert,
  Add,
  Close,
  PlayArrow,
  Pause,
  VolumeOff,
  VolumeUp,
  Verified,
  Star,
  Circle,
  LocationOn,
  AccessTime,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../config/constants';
import { getDefaultImage } from '../config/images';
import useCurrency from '../hooks/useCurrency';
import ContentCreator from './ContentCreator';
import { toast } from 'react-toastify';

// ============================================
// FULL-SCREEN CONTENT CARD
// ============================================
const ContentCard = ({
  service,
  isActive,
  onLike,
  onMessage,
  onShare,
  onViewDetails,
  isLiked,
  isMuted,
  onToggleMute,
}) => {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const { symbol } = useCurrency();
  
  // Extract service data
  const title = service.title || 'Untitled';
  const description = service.description || '';
  const price = service.price;
  const duration = service.duration_minutes || service.duration;
  const category = service.category || 'service';
  const provider = service.provider || {};
  const providerName = provider.username || service.username || 'Provider';
  const providerAvatar = provider.profile_image || provider.avatar;
  const verificationTier = provider.verification_tier || service.verification_tier || 0;
  const trustScore = provider.trust_score || service.trust_score;
  const isOnline = provider.is_online || service.is_online;
  const location = provider.location?.city || service.location?.city || '';
  const likesCount = service.likes_count || service.favorites_count || 0;
  
  // Media handling
  const media = service.images?.[0] || service.media?.[0] || getDefaultImage('SERVICE');
  const isVideo = typeof media === 'string' && /\.(mp4|mov|webm|m3u8)$/i.test(media);
  const hasMultipleMedia = (service.images?.length || service.media?.length || 0) > 1;

  // Video playback control
  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
    }
  }, [isActive]);

  // Toggle video play/pause on tap
  const handleVideoTap = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  // Format price
  const formatPrice = (p) => {
    if (p === undefined || p === null) return null;
    return `${symbol}${Number(p).toLocaleString()}`;
  };

  // Category colors
  const getCategoryColor = (cat) => {
    const colors = {
      'long-term': '#ff6b9d',
      'short-term': '#ffa726',
      'oral-services': '#ab47bc',
      'special-services': '#00bcd4',
      'vip': '#ffd700',
    };
    return colors[cat] || '#00f2ea';
  };

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
      {/* Full-Screen Media */}
      {isVideo ? (
        <Box
          component="video"
          ref={videoRef}
          src={media}
          loop
          muted={isMuted}
          playsInline
          onClick={handleVideoTap}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <Box
          component="img"
          src={media}
          alt={title}
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        />
      )}

      {/* Video Controls Overlay */}
      {isVideo && (
        <>
          {/* Play/Pause indicator */}
          <AnimatePresence>
            {!isPlaying && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 10,
                }}
              >
                <IconButton
                  onClick={handleVideoTap}
                  sx={{
                    bgcolor: 'rgba(0,0,0,0.5)',
                    width: 80,
                    height: 80,
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                  }}
                >
                  <PlayArrow sx={{ fontSize: 48, color: '#fff' }} />
                </IconButton>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mute toggle */}
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute?.();
            }}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              bgcolor: 'rgba(0,0,0,0.5)',
              zIndex: 10,
              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
            }}
          >
            {isMuted ? (
              <VolumeOff sx={{ color: '#fff', fontSize: 20 }} />
            ) : (
              <VolumeUp sx={{ color: '#fff', fontSize: 20 }} />
            )}
          </IconButton>
        </>
      )}

      {/* Top Gradient */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '100px',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* Bottom Gradient */}
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

      {/* Category Badge - Top Left */}
      <Box sx={{ position: 'absolute', top: 16, left: 16, zIndex: 10 }}>
        <Chip
          label={category.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          size="small"
          sx={{
            bgcolor: getCategoryColor(category),
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.7rem',
            textTransform: 'capitalize',
          }}
        />
        {hasMultipleMedia && (
          <Chip
            label={`+${(service.images?.length || service.media?.length || 1) - 1}`}
            size="small"
            sx={{
              ml: 0.5,
              bgcolor: 'rgba(255,255,255,0.2)',
              color: '#fff',
              fontWeight: 600,
              fontSize: '0.7rem',
            }}
          />
        )}
      </Box>

      {/* Right Side Actions - TikTok Style */}
      <Box
        sx={{
          position: 'absolute',
          right: 12,
          bottom: '28%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2.5,
          zIndex: 10,
        }}
      >
        {/* Provider Avatar */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1 }}>
          <Box sx={{ position: 'relative' }}>
            <Avatar
              src={providerAvatar}
              sx={{
                width: 48,
                height: 48,
                border: '2px solid #fff',
                cursor: 'pointer',
              }}
              onClick={(e) => {
                e.stopPropagation();
                onViewDetails?.(service);
              }}
            >
              {providerName.charAt(0).toUpperCase()}
            </Avatar>
            {isOnline && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 14,
                  height: 14,
                  bgcolor: '#4ade80',
                  borderRadius: '50%',
                  border: '2px solid #000',
                }}
              />
            )}
          </Box>
          {verificationTier >= 2 && (
            <Verified sx={{ color: '#00f2ea', fontSize: 16, mt: -1, ml: 3 }} />
          )}
        </Box>

        {/* Like Button */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onLike?.(service.id);
            }}
            sx={{
              bgcolor: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
              width: 48,
              height: 48,
            }}
          >
            {isLiked ? (
              <Favorite sx={{ color: '#ff4757', fontSize: 28 }} />
            ) : (
              <FavoriteBorder sx={{ color: '#fff', fontSize: 28 }} />
            )}
          </IconButton>
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, mt: 0.25 }}>
            {likesCount > 0 ? likesCount : 'Like'}
          </Typography>
        </Box>

        {/* Message Button */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onMessage?.(service);
            }}
            sx={{
              bgcolor: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
              width: 48,
              height: 48,
            }}
          >
            <ChatBubble sx={{ color: '#00f2ea', fontSize: 26 }} />
          </IconButton>
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, mt: 0.25 }}>
            Chat
          </Typography>
        </Box>

        {/* Share Button */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onShare?.(service);
            }}
            sx={{
              bgcolor: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
              width: 48,
              height: 48,
            }}
          >
            <Share sx={{ color: '#fff', fontSize: 26 }} />
          </IconButton>
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, mt: 0.25 }}>
            Share
          </Typography>
        </Box>

        {/* More/Details Button */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails?.(service);
            }}
            sx={{
              bgcolor: 'rgba(0,0,0,0.3)',
              backdropFilter: 'blur(8px)',
              width: 48,
              height: 48,
            }}
          >
            <MoreVert sx={{ color: '#fff', fontSize: 26 }} />
          </IconButton>
          <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, mt: 0.25 }}>
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
          right: 70,
          p: 2,
          pb: 3,
          zIndex: 10,
        }}
      >
        {/* Provider Name & Verification */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography
            variant="subtitle1"
            sx={{
              color: '#fff',
              fontWeight: 700,
              fontSize: '1rem',
              textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}
          >
            @{providerName}
          </Typography>
          {verificationTier >= 2 && (
            <Verified sx={{ color: '#00f2ea', fontSize: 16 }} />
          )}
          {trustScore && (
            <Chip
              icon={<Star sx={{ color: '#FFD700 !important', fontSize: 12 }} />}
              label={`${Math.round(trustScore)}%`}
              size="small"
              sx={{
                bgcolor: 'rgba(255,215,0,0.15)',
                color: '#FFD700',
                height: 20,
                fontSize: '0.65rem',
                fontWeight: 700,
                '& .MuiChip-icon': { ml: 0.5 },
              }}
            />
          )}
        </Box>

        {/* Service Title */}
        <Typography
          variant="h6"
          sx={{
            color: '#fff',
            fontWeight: 800,
            fontSize: '1.25rem',
            lineHeight: 1.2,
            mb: 0.5,
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {title}
        </Typography>

        {/* Description - 2 lines */}
        {description && (
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: '0.85rem',
              lineHeight: 1.4,
              mb: 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textShadow: '0 1px 4px rgba(0,0,0,0.5)',
            }}
          >
            {description}
          </Typography>
        )}

        {/* Tags Row - Price, Duration, Location */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {/* Price */}
          {formatPrice(price) && (
            <Chip
              label={formatPrice(price)}
              size="small"
              sx={{
                bgcolor: 'rgba(0,242,234,0.2)',
                color: '#00f2ea',
                fontWeight: 700,
                fontSize: '0.75rem',
                height: 26,
                border: '1px solid rgba(0,242,234,0.3)',
              }}
            />
          )}

          {/* Duration */}
          {duration && (
            <Chip
              icon={<AccessTime sx={{ color: 'rgba(255,255,255,0.8) !important', fontSize: 14 }} />}
              label={`${duration} min`}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 600,
                fontSize: '0.75rem',
                height: 26,
              }}
            />
          )}

          {/* Location */}
          {location && (
            <Chip
              icon={<LocationOn sx={{ color: 'rgba(255,255,255,0.8) !important', fontSize: 14 }} />}
              label={location}
              size="small"
              sx={{
                bgcolor: 'rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.9)',
                fontWeight: 600,
                fontSize: '0.75rem',
                height: 26,
              }}
            />
          )}
        </Box>
      </Box>
    </Box>
  );
};

// ============================================
// MAIN TIKTOK SERVICE FEED
// ============================================
const TikTokServiceFeed = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user: currentUser } = useAuth();

  // State
  const [services, setServices] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [likedServices, setLikedServices] = useState(new Set());
  const [isMuted, setIsMuted] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [showCategories, setShowCategories] = useState(false);
  const [showContentCreator, setShowContentCreator] = useState(false);

  // Refs
  const containerRef = useRef(null);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);
  const lastSwipeTime = useRef(0);

  // Categories
  const categories = [
    { id: 'all', label: 'For You', color: '#00f2ea' },
    { id: 'long-term', label: 'Long Term', color: '#ff6b9d' },
    { id: 'short-term', label: 'Short Term', color: '#ffa726' },
    { id: 'oral-services', label: 'Oral', color: '#ab47bc' },
    { id: 'special-services', label: 'Special', color: '#00bcd4' },
  ];

  // Fetch services
  const fetchServices = useCallback(async (pageNum = 1, append = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '10',
      });
      
      if (activeCategory !== 'all') {
        params.append('category', activeCategory);
      }

      const token = localStorage.getItem('token');
      const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const response = await fetch(
        `${API_BASE_URL}/adult-services?${params}`,
        { headers }
      );

      if (!response.ok) throw new Error('Failed to load content');
      
      const data = await response.json();
      let items = data.services || data.data || [];

      // Filter out current user's services
      if (currentUser?.id) {
        items = items.filter(s => {
          const providerId = s.provider?.id || s.provider_id || s.user_id;
          return providerId !== currentUser.id;
        });
      }

      if (append) {
        setServices(prev => [...prev, ...items]);
      } else {
        setServices(items);
        setCurrentIndex(0);
      }

      setHasMore(items.length === 10);
      setPage(pageNum);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, currentUser?.id]);

  // Initial load
  useEffect(() => {
    fetchServices(1);
  }, [fetchServices]);

  // Load more when near end
  useEffect(() => {
    if (currentIndex >= services.length - 3 && hasMore && !loading) {
      fetchServices(page + 1, true);
    }
  }, [currentIndex, services.length, hasMore, loading, page, fetchServices]);

  // Swipe navigation with debounce
  const handleSwipe = useCallback((direction) => {
    const now = Date.now();
    if (now - lastSwipeTime.current < 300) return; // Debounce
    lastSwipeTime.current = now;

    if (direction === 'up' && currentIndex < services.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else if (direction === 'down' && currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex, services.length]);

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
      if (e.key === 'ArrowUp' || e.key === 'k') handleSwipe('down');
      else if (e.key === 'ArrowDown' || e.key === 'j') handleSwipe('up');
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSwipe]);

  // Handle like
  const handleLike = useCallback((serviceId) => {
    setLikedServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  }, []);

  // Handle message
  const handleMessage = useCallback((service) => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/adult-services' } });
      return;
    }
    const provider = service.provider || {};
    navigate('/messages', {
      state: {
        recipientId: provider.id || service.provider_id || service.user_id,
        recipientName: provider.username || service.username,
        recipientAvatar: provider.profile_image || provider.avatar,
      }
    });
  }, [isAuthenticated, navigate]);

  // Handle share
  const handleShare = useCallback(async (service) => {
    const url = `${window.location.origin}/adult-services/${service.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: service.title,
          text: service.description,
          url,
        });
      } catch (err) {
        // User cancelled
      }
    } else {
      navigator.clipboard.writeText(url);
      // Could show a toast here
    }
  }, []);

  // Handle view details
  const handleViewDetails = useCallback((service) => {
    navigate(`/adult-services/${service.id}`);
  }, [navigate]);

  // Handle create - Opens content creator modal for TikTok-style posting
  const handleCreate = () => {
    console.log('📸 Create Post clicked, isAuthenticated:', isAuthenticated);
    if (!isAuthenticated) {
      toast.info('Please login to create a post');
      navigate('/login', { state: { from: '/adult-services' } });
      return;
    }
    // Open the content creator modal instead of navigating
    console.log('📸 Opening ContentCreator modal');
    setShowContentCreator(true);
  };

  // Handle content created successfully
  const handleContentCreated = (newContent) => {
    // Add new content to the top of the feed
    if (newContent) {
      setServices(prev => [
        {
          id: newContent.id,
          title: newContent.caption || 'New Post',
          description: newContent.caption || '',
          images: [newContent.url],
          media: [newContent.url],
          category: newContent.category,
          price: newContent.price,
          provider: {
            id: newContent.userId,
            username: newContent.username,
            profile_image: currentUser?.profilePicture || currentUser?.profile_data?.photos?.[0],
          },
          likes_count: 0,
          isNew: true,
        },
        ...prev
      ]);
      setCurrentIndex(0);
    }
  };

  // Handle category change
  const handleCategoryChange = (categoryId) => {
    setActiveCategory(categoryId);
    setShowCategories(false);
    fetchServices(1);
  };

  // Loading state
  if (loading && services.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#000',
        }}
      >
        <CircularProgress sx={{ color: '#00f2ea' }} />
      </Box>
    );
  }

  // Error state
  if (error && services.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#000',
          color: '#fff',
          gap: 2,
          p: 3,
        }}
      >
        <Typography color="error" textAlign="center">{error}</Typography>
        <Chip
          label="Retry"
          onClick={() => fetchServices(1)}
          sx={{ bgcolor: '#00f2ea', color: '#000', fontWeight: 700 }}
        />
      </Box>
    );
  }

  // Empty state - but still render ContentCreator so modal can open
  if (services.length === 0) {
    return (
      <>
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: '#000',
            color: '#fff',
            gap: 2,
            p: 3,
          }}
        >
          <Typography variant="h6">No content yet</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>
            Be the first to share something!
          </Typography>
          <Chip
            label="Create Post"
            onClick={handleCreate}
            sx={{ bgcolor: '#00f2ea', color: '#000', fontWeight: 700, mt: 2 }}
          />
        </Box>
        
        {/* Content Creator Modal - Must be outside Box to render when empty */}
        <ContentCreator
          open={showContentCreator}
          onClose={() => {
            console.log('📸 ContentCreator onClose called');
            setShowContentCreator(false);
          }}
          onSuccess={handleContentCreated}
        />
      </>
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
      {/* Category Pills - Top */}
      <Box
        sx={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 70,
          zIndex: 100,
          display: 'flex',
          gap: 0.75,
          overflowX: 'auto',
          pb: 0.5,
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {categories.map(cat => (
          <Chip
            key={cat.id}
            label={cat.label}
            size="small"
            onClick={() => handleCategoryChange(cat.id)}
            sx={{
              bgcolor: activeCategory === cat.id ? cat.color : 'rgba(0,0,0,0.5)',
              color: activeCategory === cat.id ? '#000' : '#fff',
              fontWeight: 700,
              fontSize: '0.7rem',
              backdropFilter: 'blur(8px)',
              border: activeCategory === cat.id ? 'none' : '1px solid rgba(255,255,255,0.2)',
              flexShrink: 0,
              '&:hover': {
                bgcolor: activeCategory === cat.id ? cat.color : 'rgba(0,0,0,0.7)',
              },
            }}
          />
        ))}
      </Box>

      {/* Progress Indicator - Right Side */}
      <Box
        sx={{
          position: 'absolute',
          right: 4,
          top: '50%',
          transform: 'translateY(-50%)',
          height: '30%',
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
            height: `${((currentIndex + 1) / services.length) * 100}%`,
            bgcolor: '#00f2ea',
            borderRadius: 2,
            transition: 'height 0.3s ease',
          }}
        />
      </Box>

      {/* Content Counter */}
      <Box
        sx={{
          position: 'absolute',
          top: 50,
          right: 12,
          zIndex: 100,
          bgcolor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(8px)',
          borderRadius: '8px',
          px: 1,
          py: 0.25,
        }}
      >
        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 600, fontSize: '0.65rem' }}>
          {currentIndex + 1}/{services.length}
        </Typography>
      </Box>

      {/* Content Cards */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          style={{ height: '100%', width: '100%' }}
        >
          {services[currentIndex] && (
            <ContentCard
              service={services[currentIndex]}
              isActive={true}
              isLiked={likedServices.has(services[currentIndex].id)}
              isMuted={isMuted}
              onLike={handleLike}
              onMessage={handleMessage}
              onShare={handleShare}
              onViewDetails={handleViewDetails}
              onToggleMute={() => setIsMuted(!isMuted)}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Swipe Dots */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 12,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: 0.5,
          zIndex: 100,
        }}
      >
        {services.slice(
          Math.max(0, currentIndex - 2),
          Math.min(services.length, currentIndex + 3)
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

      {/* Floating Create Button - TikTok Style */}
      <Fab
        onClick={handleCreate}
        sx={{
          position: 'absolute',
          bottom: 80,
          right: 16,
          zIndex: 100,
          bgcolor: '#00f2ea',
          color: '#000',
          width: 56,
          height: 56,
          '&:hover': {
            bgcolor: '#00d4d4',
          },
          boxShadow: '0 4px 20px rgba(0,242,234,0.4)',
        }}
      >
        <Add sx={{ fontSize: 32 }} />
      </Fab>

      {/* Content Creator Modal - Always rendered, visibility controlled by 'open' prop */}
      {console.log('📸 Rendering ContentCreator, showContentCreator:', showContentCreator)}
      <ContentCreator
        open={showContentCreator}
        onClose={() => {
          console.log('📸 ContentCreator onClose called');
          setShowContentCreator(false);
        }}
        onSuccess={handleContentCreated}
      />
    </Box>
  );
};

export default TikTokServiceFeed;
