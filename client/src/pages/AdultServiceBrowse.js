import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  Container,
  Grid,
  IconButton,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  FavoriteBorder,
  PlayCircleOutline,
  Star,
  VerifiedUser,
  Search,
  Tune
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config/constants';
import { getDefaultImage } from '../config/images';
import { useAuth } from '../contexts/AuthContext';
import useCurrency from '../hooks/useCurrency';
import TikTokServiceFeed from '../components/TikTokServiceFeed';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { y: 16, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 120 }
  }
};

const categoryTabs = [
  { value: 'all', label: 'For You' },
  { value: 'long-term', label: 'Long Term' },
  { value: 'short-term', label: 'Short Term' },
  { value: 'oral-services', label: 'Oral' },
  { value: 'special-services', label: 'Special' }
];

const shimmerSkeletons = Array.from({ length: 6 });

const AdultServiceBrowse = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isAuthenticated, user: currentUser } = useAuth();
  const { symbol } = useCurrency();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priceRange] = useState([0, 2000]);
  const [sortMode] = useState('trending');

  const headers = useMemo(() => ({ 'Content-Type': 'application/json' }), []);

  const formatPrice = (price) => {
    if (price === undefined || price === null) return `${symbol}--`;
    return `${symbol}${Number(price).toLocaleString()}`;
  };

  useEffect(() => {
    const fetchServices = async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({ page: '1', limit: '24' });
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (priceRange[0]) params.append('minPrice', String(priceRange[0]));
      if (priceRange[1]) params.append('maxPrice', String(priceRange[1]));

      try {
        const res = await fetch(`${API_BASE_URL}/adult-services?${params.toString()}`, { headers });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = await res.json();
        const items = data.services || data.data || [];
        setServices(items);
      } catch (err) {
        console.error('Service fetch failed', err);
        setError('Unable to load services right now. Please retry.');
        setServices([]);
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [categoryFilter, headers, priceRange]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return services
      .filter((svc) => {
        if (!isAuthenticated || !currentUser) return true;
        const providerId = svc.provider?.id || svc.provider_id || svc.user_id;
        return providerId !== currentUser.id;
      })
      .filter((svc) => {
        if (!q) return true;
        return (
          svc.title?.toLowerCase().includes(q) ||
          svc.description?.toLowerCase().includes(q) ||
          svc.category?.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortMode === 'price-asc') return (a.price || 0) - (b.price || 0);
        if (sortMode === 'price-desc') return (b.price || 0) - (a.price || 0);
        if (sortMode === 'new') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        // trending/default: sort by verification + trust_score if present
        const scoreA = (a.trust_score || 0) + (a.verification_tier || 0) * 10;
        const scoreB = (b.trust_score || 0) + (b.verification_tier || 0) * 10;
        return scoreB - scoreA;
      });
  }, [services, searchQuery, sortMode, isAuthenticated, currentUser]);

  const renderServiceCard = (service) => {
    const image = service.images?.[0] || getDefaultImage('SERVICE');
    const hasVideo = service.images?.some((m) => typeof m === 'string' && m.match(/\.mp4|\.mov|\.webm/i));
    const categoryLabel = categoryTabs.find((c) => c.value === service.category)?.label || 'Service';
    const price = service.price;
    const duration = service.duration_minutes || service.duration;
    const providerName = service.provider?.username || service.username || 'Provider';
    const verificationTier = service.provider?.verification_tier || service.verification_tier;
    const trustScore = service.provider?.trust_score || service.trust_score;

    return (
      <Card
        sx={{
          borderRadius: 4,
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 14px 40px rgba(0,0,0,0.18)',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          '&:hover': { transform: 'translateY(-6px)', boxShadow: '0 18px 52px rgba(0,0,0,0.22)' }
        }}
      >
        <CardActionArea onClick={() => navigate(`/adult-services/${service.id}`)}>
          <Box sx={{ position: 'relative' }}>
            <CardMedia
              component="img"
              height={isMobile ? 260 : 320}
              image={image}
              alt={service.title}
              loading="lazy"
              decoding="async"
              sx={{ objectFit: 'cover' }}
            />
            <Box sx={{ position: 'absolute', top: 12, left: 12, display: 'flex', gap: 1 }}>
              <Chip label={categoryLabel} size="small" sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: 'white', backdropFilter: 'blur(6px)' }} />
              {hasVideo && (
                <Chip
                  icon={<PlayCircleOutline sx={{ fontSize: 16 }} />}
                  label="Video"
                  size="small"
                  sx={{ bgcolor: 'rgba(15,23,42,0.8)', color: 'white', backdropFilter: 'blur(6px)' }}
                />
              )}
            </Box>
            <IconButton
              size="small"
              sx={{ position: 'absolute', top: 12, right: 12, bgcolor: 'rgba(255,255,255,0.85)', '&:hover': { bgcolor: 'white' } }}
            >
              <FavoriteBorder fontSize="small" />
            </IconButton>
          </Box>

          <CardContent sx={{ pt: 2.5, pb: 2 }}>
            <Stack spacing={1.2}>
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Typography variant="h6" fontWeight={800} sx={{ fontSize: '1.05rem', lineHeight: 1.3 }}>
                  {service.title || 'Untitled service'}
                </Typography>
                {verificationTier ? <VerifiedUser color="primary" sx={{ fontSize: 18 }} /> : null}
              </Stack>

              <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {service.description || 'No description provided.'}
              </Typography>

              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={formatPrice(price)} size="small" color="primary" sx={{ fontWeight: 700 }} />
                  {duration ? <Chip label={`${duration} mins`} size="small" /> : null}
                </Stack>
                {trustScore ? (
                  <Chip
                    icon={<Star sx={{ fontSize: 16 }} />}
                    label={`Trust ${Math.round(trustScore)}`}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,193,7,0.14)' }}
                  />
                ) : null}
              </Stack>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  fullWidth
                  sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 700, bgcolor: '#111827' }}
                  onClick={(e) => { e.stopPropagation(); navigate(`/adult-services/${service.id}`); }}
                >
                  View / Book
                </Button>
                <Button
                  variant="outlined"
                  sx={{ minWidth: 52, borderRadius: 2.5, borderColor: '#d1d5db', color: '#6b7280' }}
                  onClick={(e) => { e.stopPropagation(); navigate('/chat'); }}
                >
                  Msg
                </Button>
              </Stack>

              <Typography variant="body2" color="text.secondary">
                By {providerName}
              </Typography>
            </Stack>
          </CardContent>
        </CardActionArea>
      </Card>
    );
  };

  const emptyState = (
    <Box sx={{ textAlign: 'center', py: 10 }}>
      <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
        {error || 'No services found for your current filters.'}
      </Typography>
      <Button variant="outlined" onClick={() => { setCategoryFilter('all'); setSearchQuery(''); }}>
        Reset filters
      </Button>
    </Box>
  );

  // Mobile: Use TikTok-style full-screen swipeable feed
  if (isMobile) {
    return <TikTokServiceFeed />;
  }

  // Desktop: Traditional grid view
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0b0c10', pb: 2 }}>
      <Box
        sx={{
          background: '#0d111a',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
          backdropFilter: 'blur(8px)'
        }}
      >
        <Container maxWidth="lg">
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ py: 0.75 }}
          >
            <Tabs
              value={categoryFilter}
              onChange={(e, v) => setCategoryFilter(v)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              textColor="primary"
              indicatorColor="primary"
              sx={{
                minHeight: 0,
                '& .MuiTabs-indicator': { height: 2 },
                '& .MuiTabs-scrollButtons': {
                  color: 'primary.main'
                },
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 700,
                  color: 'rgba(255,255,255,0.7)',
                  minHeight: 36,
                  px: 1.5,
                  minWidth: 'auto'
                },
                '& .Mui-selected': { color: '#60a5fa' }
              }}
            >
              {categoryTabs.map((f) => (
                <Tab key={f.value} value={f.value} label={f.label} />
              ))}
            </Tabs>

            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton
                size="small"
                sx={{ color: 'rgba(255,255,255,0.8)' }}
                onClick={() => {
                  const query = prompt('Search services:');
                  if (query) setSearchQuery(query);
                }}
              >
                <Search fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                sx={{ color: 'rgba(255,255,255,0.8)' }}
                onClick={() => navigate('/adult-services/create')}
              >
                <Tune fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ mt: 0.5 }}>
        <Stack spacing={1.5}>

          {loading ? (
            <Grid container spacing={2}>
              {shimmerSkeletons.map((_, n) => (
                <Grid item xs={12} sm={6} md={4} key={n}>
                  <Skeleton variant="rectangular" height={isMobile ? 260 : 320} sx={{ borderRadius: 3, mb: 1 }} />
                  <Skeleton width="70%" height={28} />
                  <Skeleton width="40%" height={20} />
                </Grid>
              ))}
            </Grid>
          ) : filteredServices.length ? (
            <motion.div variants={containerVariants} initial="hidden" animate="visible">
              <Grid container spacing={2.5}>
                {filteredServices.map((service) => (
                  <Grid item xs={12} sm={6} md={4} key={service.id}>
                    <motion.div variants={itemVariants}>{renderServiceCard(service)}</motion.div>
                  </Grid>
                ))}
              </Grid>
            </motion.div>
          ) : (
            emptyState
          )}
        </Stack>
      </Container>
    </Box>
  );
};

export default AdultServiceBrowse;
