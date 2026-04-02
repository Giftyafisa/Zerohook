/**
 * TikTok-Style Mobile Home Page
 *
 * A clean, immersive landing experience:
 * - Full-screen hero with animated gradient
 * - Swipeable feature cards
 * - Minimal UI, maximum impact
 * - Clear CTAs at bottom
 */
import React, { useEffect, useState } from 'react';
import { Box, Typography, Chip, Avatar, Button } from '@mui/material';
import {
  Verified,
  Shield,
  Lock,
  Speed,
  ArrowForward,
  KeyboardArrowDown,
  Circle,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../store/slices/authSlice';
import apiClient from '../services/apiClient';
import VideoShowcase from './VideoShowcase';

// UX tuning constants (adjust for snappier or calmer feel)
// "Super quick like TikTok" values below.
const SLIDE_AUTO_ADVANCE_MS = 1600;
const INFO_PAGE_AUTO_ADVANCE_MS = 3600;
const SWIPE_THRESHOLD_PX = 18;
const SWIPE_DRAG_ELASTICITY = 0.28;
const INFO_PAGES_TOTAL = 3;
const PULSE_REFRESH_INTERVAL_MS = 30000;

const compactNumberFormatter = new Intl.NumberFormat('en', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const formatCompactNumber = (value) => compactNumberFormatter.format(Number(value) || 0);

const AnimatedBackground = () => (
  <Box
    sx={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      zIndex: 0,
    }}
  >
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, #0a0a0f 0%, #0f0f1a 50%, #1a0a15 100%)',
      }}
    />

    <motion.div
      style={{
        position: 'absolute',
        top: '10%',
        left: '-20%',
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,242,234,0.3) 0%, transparent 70%)',
        filter: 'blur(40px)',
      }}
      animate={{
        x: [0, 50, 0],
        y: [0, 30, 0],
        scale: [1, 1.2, 1],
      }}
      transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
    />

    <motion.div
      style={{
        position: 'absolute',
        bottom: '20%',
        right: '-20%',
        width: 350,
        height: 350,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,0,85,0.25) 0%, transparent 70%)',
        filter: 'blur(50px)',
      }}
      animate={{
        x: [0, -40, 0],
        y: [0, -20, 0],
        scale: [1, 1.1, 1],
      }}
      transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
    />

    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
        opacity: 0.5,
      }}
    />
  </Box>
);

const FeatureCard = ({ icon: Icon, title, description, color }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      p: 2,
      borderRadius: 2,
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      backdropFilter: 'blur(10px)',
    }}
  >
    <Box
      sx={{
        width: 44,
        height: 44,
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `${color}15`,
        border: `1px solid ${color}30`,
      }}
    >
      <Icon sx={{ color, fontSize: 24 }} />
    </Box>
    <Box>
      <Typography
        sx={{
          color: '#fff',
          fontWeight: 700,
          fontSize: '0.95rem',
          fontFamily: '"Outfit", sans-serif',
        }}
      >
        {title}
      </Typography>
      <Typography
        sx={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.8rem',
          fontFamily: '"Outfit", sans-serif',
        }}
      >
        {description}
      </Typography>
    </Box>
  </Box>
);

const FloatingAvatars = () => {
  const avatars = [
    { top: '15%', left: '8%', delay: 0, size: 40 },
    { top: '25%', right: '10%', delay: 0.5, size: 36 },
    { top: '40%', left: '5%', delay: 1, size: 32 },
    { top: '55%', right: '8%', delay: 1.5, size: 38 },
  ];

  return (
    <>
      {avatars.map((avatar, i) => {
        const horizontalPosition = avatar.left
          ? { left: avatar.left }
          : { right: avatar.right };

        return (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              top: avatar.top,
              ...horizontalPosition,
              zIndex: 5,
            }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: avatar.delay, duration: 0.5 }}
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3 + i, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Avatar
                sx={{
                  width: avatar.size,
                  height: avatar.size,
                  bgcolor: `hsl(${160 + i * 40}, 70%, 50%)`,
                  border: '2px solid rgba(255,255,255,0.2)',
                  fontSize: avatar.size * 0.4,
                }}
              >
                {String.fromCharCode(65 + i)}
              </Avatar>
            </motion.div>
          </motion.div>
        );
      })}
    </>
  );
};

const MobileHomePage = () => {
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [infoPage, setInfoPage] = useState(0);
  const [pulseLoading, setPulseLoading] = useState(true);
  const [marketplacePulse, setMarketplacePulse] = useState({
    onlineUsers: 0,
    verifiedProfiles: 0,
    activeListings: 0,
    completedTransactions: 0,
    newUsersThisWeek: 0,
  });
  const [pulseUpdatedAt, setPulseUpdatedAt] = useState(null);

  const features = [
    { icon: Verified, title: 'Verified Profiles', description: 'ID-verified companions', color: '#00f2ea' },
    { icon: Shield, title: 'Secure & Private', description: 'End-to-end encryption', color: '#4ade80' },
    { icon: Lock, title: 'Escrow Payments', description: 'Protected transactions', color: '#ffd700' },
    { icon: Speed, title: 'Instant Match', description: 'AI-powered matching', color: '#ff0055' },
  ];

  const trustPillars = [
    { icon: Verified, title: 'KYC-Verified Profiles', value: 'Identity + selfie checks' },
    { icon: Lock, title: 'Private Messaging', value: 'Encrypted chat and calls' },
    { icon: Shield, title: 'Safety Layer', value: 'Fraud and abuse protection' },
  ];

  const howItWorks = [
    {
      title: 'Browse verified profiles nearby',
      detail: 'Filter by city, language, budget, and verification tier.',
    },
    {
      title: 'Message and confirm details safely',
      detail: 'In-app messaging keeps your contact details private.',
    },
    {
      title: 'Book with confidence and rate experience',
      detail: 'Escrow and reviews help maintain high service quality.',
    },
  ];

  const platformStats = [
    { value: `${formatCompactNumber(marketplacePulse.verifiedProfiles)}+`, label: 'verified profiles' },
    { value: formatCompactNumber(marketplacePulse.activeListings), label: 'active listings' },
    { value: formatCompactNumber(marketplacePulse.completedTransactions), label: 'completed deals' },
  ];

  const paymentAndSupport = [
    'Escrow supports both crypto and local payment rails.',
    'Disputes are moderated with evidence-based review.',
    `New members this week: ${formatCompactNumber(marketplacePulse.newUsersThisWeek)}.`,
  ];

  useEffect(() => {
    let mounted = true;

    const fetchMarketplacePulse = async () => {
      try {
        const response = await apiClient.get('/status/marketplace-pulse');
        const payload = response.data?.data || response.data || {};

        if (!mounted) return;

        setMarketplacePulse({
          onlineUsers: Number(payload.onlineUsers) || 0,
          verifiedProfiles: Number(payload.verifiedProfiles) || 0,
          activeListings: Number(payload.activeListings) || 0,
          completedTransactions: Number(payload.completedTransactions) || 0,
          newUsersThisWeek: Number(payload.newUsersThisWeek) || 0,
        });
        setPulseUpdatedAt(payload.lastUpdated || new Date().toISOString());
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.debug('Marketplace pulse unavailable:', error?.message || error);
        }
      } finally {
        if (mounted) {
          setPulseLoading(false);
        }
      }
    };

    fetchMarketplacePulse();
    const interval = setInterval(fetchMarketplacePulse, PULSE_REFRESH_INTERVAL_MS);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % features.length);
    }, SLIDE_AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [features.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setInfoPage((prev) => (prev + 1) % INFO_PAGES_TOTAL);
    }, INFO_PAGE_AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: '100vw',
        minHeight: '100vh',
        overflow: 'visible',
        overflowX: 'hidden',
        pb: '80px',
        boxSizing: 'border-box',
      }}
    >
      <VideoShowcase />

      <Box
        sx={{
          position: 'relative',
          minHeight: '100vh',
        }}
      >
        <AnimatedBackground />
        <FloatingAvatars />

        <Box
          sx={{
            position: 'relative',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            px: 3,
            zIndex: 10,
            pt: 4,
            pb: 2,
            gap: 2,
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Chip
              icon={<Circle sx={{ fontSize: '8px !important', color: '#4ade80 !important' }} />}
              label={pulseLoading ? 'Live - syncing marketplace pulse...' : `Live - ${formatCompactNumber(marketplacePulse.onlineUsers)} online now`}
              size="small"
              sx={{
                bgcolor: 'rgba(74,222,128,0.1)',
                color: '#4ade80',
                border: '1px solid rgba(74,222,128,0.3)',
                fontWeight: 600,
                fontSize: '0.75rem',
                mb: 3,
                alignSelf: 'flex-start',
                '& .MuiChip-icon': {
                  animation: 'pulse 2s infinite',
                },
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.5 },
                },
              }}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Typography
              sx={{
                fontSize: '2.5rem',
                fontWeight: 900,
                lineHeight: 1.1,
                fontFamily: '"Outfit", sans-serif',
                background: 'linear-gradient(135deg, #fff 0%, #00f2ea 50%, #ff0055 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1.5,
              }}
            >
              Premium
              <br />
              Connections
            </Typography>

            <Typography
              sx={{
                fontSize: '1rem',
                color: 'rgba(255,255,255,0.7)',
                fontFamily: '"Outfit", sans-serif',
                lineHeight: 1.5,
                mb: 2.3,
                maxWidth: 280,
              }}
            >
              Verified companions. Secure platform.
              Real connections.
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 1,
                maxWidth: 340,
              }}
            >
              {platformStats.map((stat) => (
                <Box
                  key={stat.label}
                  sx={{
                    px: 1,
                    py: 0.9,
                    borderRadius: '10px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    textAlign: 'center',
                  }}
                >
                  <Typography sx={{ color: '#ffffff', fontSize: '0.84rem', fontWeight: 800, fontFamily: '"Outfit", sans-serif' }}>
                    {stat.value}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.66)', fontSize: '0.62rem', fontFamily: '"Outfit", sans-serif' }}>
                    {stat.label}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                mt: 1.4,
                maxWidth: 340,
                p: 1.3,
                borderRadius: '12px',
                background: 'rgba(0,0,0,0.24)',
                border: '1px solid rgba(255,255,255,0.14)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <Typography
                sx={{
                  color: '#c7fff9',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  mb: 1,
                  fontFamily: '"Outfit", sans-serif',
                }}
              >
                Live Marketplace Pulse
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <Box sx={{ p: 1, borderRadius: '9px', background: 'rgba(0, 242, 234, 0.09)', border: '1px solid rgba(0, 242, 234, 0.24)' }}>
                  <Typography sx={{ color: '#e8fffc', fontSize: '0.92rem', fontWeight: 800, fontFamily: '"Outfit", sans-serif' }}>
                    {formatCompactNumber(marketplacePulse.onlineUsers)}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.62rem', fontFamily: '"Outfit", sans-serif' }}>
                    Online now
                  </Typography>
                </Box>
                <Box sx={{ p: 1, borderRadius: '9px', background: 'rgba(255, 0, 85, 0.09)', border: '1px solid rgba(255, 0, 85, 0.24)' }}>
                  <Typography sx={{ color: '#ffe7f2', fontSize: '0.92rem', fontWeight: 800, fontFamily: '"Outfit", sans-serif' }}>
                    {formatCompactNumber(marketplacePulse.newUsersThisWeek)}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.62rem', fontFamily: '"Outfit", sans-serif' }}>
                    New this week
                  </Typography>
                </Box>
              </Box>

              <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.62rem', mt: 1, fontFamily: '"Outfit", sans-serif' }}>
                Updated {pulseUpdatedAt ? new Date(pulseUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now'}
              </Typography>
            </Box>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <FeatureCard {...features[currentSlide]} />
              </motion.div>
            </AnimatePresence>

            <Box sx={{ display: 'flex', gap: 1, mt: 2, justifyContent: 'center' }}>
              {features.map((_, i) => (
                <Box
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  sx={{
                    width: i === currentSlide ? 20 : 8,
                    height: 8,
                    borderRadius: 4,
                    bgcolor: i === currentSlide ? '#00f2ea' : 'rgba(255,255,255,0.3)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Box>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.62 }}
            style={{ overflow: 'hidden', position: 'relative' }}
          >
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={SWIPE_DRAG_ELASTICITY}
              onDragEnd={(_, info) => {
                if (info.offset.x < -SWIPE_THRESHOLD_PX) {
                  setInfoPage((prev) => (prev + 1) % INFO_PAGES_TOTAL);
                }
                if (info.offset.x > SWIPE_THRESHOLD_PX) {
                  setInfoPage((prev) => (prev - 1 + INFO_PAGES_TOTAL) % INFO_PAGES_TOTAL);
                }
              }}
              style={{ cursor: 'grab', touchAction: 'pan-y' }}
            >
              <AnimatePresence mode="wait">
                {infoPage === 0 ? (
                  <motion.div
                    key="trust"
                    initial={{ opacity: 0, x: 32 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -32 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                  >
                    <Typography
                      sx={{
                        color: '#d7fff9',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        mb: 1,
                        fontFamily: '"Outfit", sans-serif',
                      }}
                    >
                      Why Zerohook is safer
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 1.1 }}>
                      {trustPillars.map((item) => (
                        <Box
                          key={item.title}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.2,
                            p: 1.2,
                            borderRadius: '12px',
                            background: 'rgba(10,14,18,0.45)',
                            border: '1px solid rgba(255,255,255,0.09)',
                            backdropFilter: 'blur(10px)',
                          }}
                        >
                          <item.icon sx={{ fontSize: 18, color: '#00f2ea' }} />
                          <Box>
                            <Typography sx={{ color: '#fff', fontSize: '0.82rem', fontWeight: 700, fontFamily: '"Outfit", sans-serif' }}>
                              {item.title}
                            </Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.68)', fontSize: '0.74rem', fontFamily: '"Outfit", sans-serif' }}>
                              {item.value}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </motion.div>
                ) : infoPage === 1 ? (
                  <motion.div
                    key="howItWorks"
                    initial={{ opacity: 0, x: 32 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -32 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                  >
                    <Typography
                      sx={{
                        color: '#ffd8e8',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        mb: 1,
                        fontFamily: '"Outfit", sans-serif',
                      }}
                    >
                      How it works
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 1 }}>
                      {howItWorks.map((step, index) => (
                        <Box key={step.title} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <Box
                            sx={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              color: '#041215',
                              bgcolor: '#00f2ea',
                              boxShadow: '0 0 12px rgba(0,242,234,0.35)',
                              flexShrink: 0,
                            }}
                          >
                            {index + 1}
                          </Box>
                          <Box>
                            <Typography sx={{ color: 'rgba(255,255,255,0.92)', fontSize: '0.8rem', fontWeight: 700, fontFamily: '"Outfit", sans-serif' }}>
                              {step.title}
                            </Typography>
                            <Typography sx={{ color: 'rgba(255,255,255,0.66)', fontSize: '0.74rem', fontFamily: '"Outfit", sans-serif' }}>
                              {step.detail}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                  </motion.div>
                ) : (
                  <motion.div
                    key="paymentsSupport"
                    initial={{ opacity: 0, x: 32 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -32 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                  >
                    <Typography
                      sx={{
                        color: '#ffe9c4',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        mb: 1,
                        fontFamily: '"Outfit", sans-serif',
                      }}
                    >
                      Payments and support
                    </Typography>
                    <Box sx={{ display: 'grid', gap: 1 }}>
                      {paymentAndSupport.map((item) => (
                        <Box
                          key={item}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.2,
                            p: 1.2,
                            borderRadius: '12px',
                            background: 'rgba(18,14,6,0.45)',
                            border: '1px solid rgba(255,210,130,0.2)',
                            backdropFilter: 'blur(10px)',
                          }}
                        >
                          <Box
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              bgcolor: '#ffc96a',
                              boxShadow: '0 0 8px rgba(255,201,106,0.55)',
                              flexShrink: 0,
                            }}
                          />
                          <Typography sx={{ color: 'rgba(255,255,255,0.84)', fontSize: '0.77rem', fontFamily: '"Outfit", sans-serif' }}>
                            {item}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <Box sx={{ display: 'flex', gap: 0.8, mt: 1.5, justifyContent: 'center' }}>
              {Array.from({ length: INFO_PAGES_TOTAL }).map((_, i) => (
                <Box
                  key={i}
                  onClick={() => setInfoPage(i)}
                  sx={{
                    width: i === infoPage ? 18 : 7,
                    height: 7,
                    borderRadius: 4,
                    bgcolor: i === infoPage ? '#00f2ea' : 'rgba(255,255,255,0.28)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Box>
          </motion.div>
        </Box>

        <Box
          sx={{
            position: 'relative',
            zIndex: 10,
            px: 3,
            pb: 3,
            pt: 2,
            background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, transparent 100%)',
          }}
        >
          {!isAuthenticated ? (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
              >
                <Button
                  fullWidth
                  onClick={() => navigate('/register')}
                  sx={{
                    py: 1.75,
                    borderRadius: '14px',
                    background: 'linear-gradient(135deg, #00f2ea 0%, #00d4aa 100%)',
                    color: '#000',
                    fontWeight: 800,
                    fontSize: '1rem',
                    fontFamily: '"Outfit", sans-serif',
                    textTransform: 'none',
                    boxShadow: '0 8px 32px rgba(0,242,234,0.3)',
                    mb: 1.5,
                    '&:hover': {
                      background: 'linear-gradient(135deg, #00f2ea 0%, #00d4aa 100%)',
                      boxShadow: '0 12px 40px rgba(0,242,234,0.4)',
                    },
                  }}
                  endIcon={<ArrowForward />}
                >
                  Get Started
                </Button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
              >
                <Button
                  fullWidth
                  onClick={() => navigate('/login')}
                  sx={{
                    py: 1.5,
                    borderRadius: '14px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.2)',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    fontFamily: '"Outfit", sans-serif',
                    textTransform: 'none',
                    '&:hover': {
                      background: 'rgba(255,255,255,0.05)',
                      borderColor: 'rgba(255,255,255,0.3)',
                    },
                  }}
                >
                  I have an account
                </Button>
              </motion.div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Button
                fullWidth
                onClick={() => navigate('/profiles')}
                sx={{
                  py: 1.75,
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #00f2ea 0%, #00d4aa 100%)',
                  color: '#000',
                  fontWeight: 800,
                  fontSize: '1rem',
                  fontFamily: '"Outfit", sans-serif',
                  textTransform: 'none',
                  boxShadow: '0 8px 32px rgba(0,242,234,0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #00f2ea 0%, #00d4aa 100%)',
                  },
                }}
                endIcon={<ArrowForward />}
              >
                Browse Profiles
              </Button>
            </motion.div>
          )}

          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mt: 2,
              opacity: 0.5,
            }}
          >
            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <KeyboardArrowDown sx={{ color: '#fff', fontSize: 28 }} />
            </motion.div>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default MobileHomePage;
