/**
 * TikTok-Style Mobile Home Page
 * 
 * A clean, immersive landing experience:
 * - Full-screen hero with animated gradient
 * - Swipeable feature cards
 * - Minimal UI, maximum impact
 * - Clear CTAs at bottom
 */
import React, { useState, useEffect } from 'react';
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
import VideoShowcase from './VideoShowcase';

// Animated gradient background
const AnimatedBackground = () => (
  <Box
    sx={{
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
      zIndex: 0,
    }}
  >
    {/* Base dark gradient */}
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, #0a0a0f 0%, #0f0f1a 50%, #1a0a15 100%)',
      }}
    />
    
    {/* Animated orbs */}
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
    
    {/* Grid pattern overlay */}
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

// Feature highlight card
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

// Floating profile avatars for social proof
const FloatingAvatars = () => {
  const avatars = [
    { top: '15%', left: '8%', delay: 0, size: 40 },
    { top: '25%', right: '10%', delay: 0.5, size: 36 },
    { top: '40%', left: '5%', delay: 1, size: 32 },
    { top: '55%', right: '8%', delay: 1.5, size: 38 },
  ];

  return (
    <>
      {avatars.map((avatar, i) => (
        <motion.div
          key={i}
          style={{
            position: 'absolute',
            top: avatar.top,
            left: avatar.left,
            right: avatar.right,
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
      ))}
    </>
  );
};

const MobileHomePage = () => {
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const features = [
    { icon: Verified, title: 'Verified Profiles', description: 'ID-verified companions', color: '#00f2ea' },
    { icon: Shield, title: 'Secure & Private', description: 'End-to-end encryption', color: '#4ade80' },
    { icon: Lock, title: 'Escrow Payments', description: 'Protected transactions', color: '#ffd700' },
    { icon: Speed, title: 'Instant Match', description: 'AI-powered matching', color: '#ff0055' },
  ];

  // Auto-cycle features
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % features.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [features.length]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        // Ensure content can be scrolled
        overflow: 'visible',
        pb: '80px', // Space for bottom nav
      }}
    >
      {/* Video Showcase - At the Very Top */}
      <VideoShowcase />
      
      {/* Content Section with Background */}
      <Box
        sx={{
          position: 'relative',
          minHeight: '100vh',
        }}
      >
        <AnimatedBackground />
        <FloatingAvatars />
      
      {/* Main Content */}
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: 3,
          zIndex: 10,
          pt: 4,
        }}
      >
        {/* Live Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Chip
            icon={<Circle sx={{ fontSize: '8px !important', color: '#4ade80 !important' }} />}
            label="Live • 2.4k+ online now"
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

        {/* Hero Text */}
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
              mb: 4,
              maxWidth: 280,
            }}
          >
            Verified companions. Secure platform. 
            Real connections.
          </Typography>
        </motion.div>

        {/* Feature Carousel */}
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
          
          {/* Carousel Dots */}
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
      </Box>

      {/* Bottom CTA Section */}
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
            {/* Primary CTA */}
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
            
            {/* Secondary CTA */}
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

        {/* Scroll hint */}
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
      {/* End of Bottom CTA Section */}
      </Box>
      {/* End of Content Section with Background */}
    </Box>
  );
};

export default MobileHomePage;
