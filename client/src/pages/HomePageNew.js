import React from 'react';
import { useSelector } from 'react-redux';
import { Box, Container, Typography, Grid, Chip, useMediaQuery, useTheme } from '@mui/material';
import { styled, keyframes } from '@mui/system';
import {
  Shield,
  Speed,
  VerifiedUser,
  TrendingUp,
  Star,
  Explore,
  Whatshot,
  ArrowForward,
  Bolt
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { selectIsAuthenticated, selectIsSubscribed } from '../store/slices/authSlice';
import { GlassCard, GlassButton } from '../components/ui';
import useCurrency from '../hooks/useCurrency';
import MobileHomePage from '../components/MobileHomePage';
import VideoShowcase from '../components/VideoShowcase';

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const pulseDot = keyframes`
  0%, 100% { transform: scale(1); opacity: 0.9; }
  50% { transform: scale(1.35); opacity: 1; }
`;

const HeroSection = styled(Box)(({ theme }) => ({
  minHeight: 'auto',
  paddingTop: theme.spacing(2),
  paddingBottom: theme.spacing(4),
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
  overflow: 'hidden',

  [theme.breakpoints.up('md')]: {
    minHeight: '90vh',
    paddingTop: theme.spacing(5),
    paddingBottom: theme.spacing(5),
  },
  
  [theme.breakpoints.down('md')]: {
    minHeight: 'auto',
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(3),
  },
}));

const GradientText = styled(Typography)({
  fontFamily: '"Outfit", sans-serif',
  fontWeight: 800,
  background: 'linear-gradient(135deg, #00f2ea 0%, #ffffff 50%, #ff0055 100%)',
  backgroundSize: '200% auto',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  animation: `${shimmer} 4s linear infinite`,
});

const FeatureIcon = styled(Box)(({ theme }) => ({
  width: '64px',
  height: '64px',
  borderRadius: '16px',
  background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.2), rgba(255, 0, 85, 0.2))',
  border: '1px solid rgba(0, 242, 234, 0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: '16px',
  transition: 'all 0.3s ease',
  
  [theme.breakpoints.down('sm')]: {
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    marginBottom: '12px',
  },
  
  '&:hover': {
    transform: 'scale(1.1)',
    boxShadow: '0 0 30px rgba(0, 242, 234, 0.4)',
  },
}));

const CategoryCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'accentColor',
})(({ accentColor }) => ({
  position: 'relative',
  padding: '24px',
  borderRadius: '20px',
  background: 'rgba(255, 255, 255, 0.03)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  cursor: 'pointer',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  overflow: 'hidden',
  
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: accentColor || '#00f2ea',
    transform: 'scaleX(0)',
    transformOrigin: 'left',
    transition: 'transform 0.4s ease',
  },
  
  '&:hover': {
    transform: 'translateY(-8px)',
    border: `1px solid ${accentColor || '#00f2ea'}40`,
    boxShadow: `0 20px 40px rgba(0, 0, 0, 0.3), 0 0 20px ${accentColor || '#00f2ea'}20`,
    
    '&::before': {
      transform: 'scaleX(1)',
    },
  },
}));

const StatBox = styled(Box)({
  textAlign: 'center',
  padding: '24px',
  borderRadius: '16px',
  background: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  transition: 'all 0.3s ease',
  
  '&:hover': {
    border: '1px solid rgba(0, 242, 234, 0.3)',
    boxShadow: '0 0 20px rgba(0, 242, 234, 0.1)',
  },
});

const HomePage = () => {
  const navigate = useNavigate();
  const currentLocation = useLocation();
  const theme = useTheme();
  const isUiBaselineMode = process.env.REACT_APP_UI_BASELINE === '1';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isSubscribed = useSelector(selectIsSubscribed);
  const { formatFromUSD } = useCurrency();

  // Mobile: Use TikTok-style immersive home page
  if (isMobile) {
    return <MobileHomePage />;
  }

  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8 }
  };

  const categories = [
    {
      name: 'Long Term',
      icon: '💕',
      description: 'Premium long-term companionship',
      color: '#ff0055',
      price: `From ${formatFromUSD(150)}`
    },
    {
      name: 'Short Term',
      icon: '🔥',
      description: 'Quality short-term encounters',
      color: '#ff6600',
      price: `From ${formatFromUSD(100)}`
    },
    {
      name: 'VIP Services',
      icon: '⭐',
      description: 'Exclusive premium experiences',
      color: '#00f2ea',
      price: `From ${formatFromUSD(300)}`
    },
    {
      name: 'Special',
      icon: '💎',
      description: 'Unique personalized services',
      color: '#aa00ff',
      price: 'Custom pricing'
    }
  ];

  const features = [
    {
      icon: <Shield sx={{ fontSize: 32, color: '#00f2ea' }} />,
      title: 'Verified Profiles',
      description: 'All providers undergo strict verification with ID and background checks'
    },
    {
      icon: <VerifiedUser sx={{ fontSize: 32, color: '#00f2ea' }} />,
      title: 'Secure Platform',
      description: 'End-to-end encryption and privacy protection for all communications'
    },
    {
      icon: <Speed sx={{ fontSize: 32, color: '#00f2ea' }} />,
      title: 'Instant Matching',
      description: 'AI-powered matching connects you with perfect companions instantly'
    },
    {
      icon: <TrendingUp sx={{ fontSize: 32, color: '#00f2ea' }} />,
      title: 'Trust Scoring',
      description: 'Transparent reputation system built on real user reviews'
    }
  ];

  // Use feature-based proof points (avoids hard claims we can't verify at runtime)
  const stats = [
    { value: 'ID Verified', label: 'Provider verification' },
    { value: 'Encrypted', label: 'Private messaging' },
    { value: 'Escrow', label: 'Safer payments (optional)' },
    { value: 'Live', label: 'Real-time chat & calls' }
  ];

  return (
    <Box>
      {/* Subscription Banner */}
      {isAuthenticated && !isSubscribed && (
        <Box 
          sx={{ 
            py: 2,
            px: 2,
            background: 'linear-gradient(90deg, rgba(255, 0, 85, 0.1), rgba(0, 242, 234, 0.1))',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box>
                <Typography sx={{ color: '#ffffff', fontWeight: 700, fontFamily: '"Outfit", sans-serif' }}>
                  🔒 Unlock Premium Features
                </Typography>
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px', fontFamily: '"Outfit", sans-serif' }}>
                  Subscribe now to access all services and features
                </Typography>
              </Box>
              <GlassButton
                variant="primary"
                onClick={() => navigate('/subscription', { state: { from: { pathname: currentLocation.pathname, search: currentLocation.search, hash: currentLocation.hash } } })}
                startIcon={<Star />}
              >
                Subscribe Now
              </GlassButton>
            </Box>
          </Container>
        </Box>
      )}

      {/* Video Showcase - Top of Page */}
      {!isUiBaselineMode && <VideoShowcase />}

      {/* Hero Section */}
      <HeroSection>
        {/* Ambient animated accents */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: 0.9
          }}
        >
          <motion.div
            style={{
              position: 'absolute',
              top: '-120px',
              left: '-120px',
              width: 320,
              height: 320,
              borderRadius: 999,
              background: 'radial-gradient(circle, rgba(0,242,234,0.35) 0%, rgba(0,242,234,0.0) 65%)',
              filter: 'blur(10px)'
            }}
            animate={{ x: [0, 20, 0], y: [0, 30, 0] }}
            transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            style={{
              position: 'absolute',
              bottom: '-140px',
              right: '-140px',
              width: 360,
              height: 360,
              borderRadius: 999,
              background: 'radial-gradient(circle, rgba(255,0,85,0.28) 0%, rgba(255,0,85,0.0) 70%)',
              filter: 'blur(12px)'
            }}
            animate={{ x: [0, -24, 0], y: [0, -18, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
        </Box>

        <Container maxWidth="lg">
          <Grid container spacing={6} alignItems="center">
            <Grid item xs={12} md={7}>
              <motion.div initial="initial" animate="animate" variants={fadeInUp}>
                <Typography
                  sx={{
                    color: '#00f2ea',
                    fontSize: '14px',
                    fontWeight: 600,
                    letterSpacing: '3px',
                    textTransform: 'uppercase',
                    mb: 2,
                    fontFamily: '"Outfit", sans-serif',
                  }}
                >
                  Premium Adult Services Platform
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip
                    icon={
                      <Box
                        component="span"
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          bgcolor: '#00ff88',
                          boxShadow: '0 0 10px rgba(0,255,136,0.45)',
                          animation: `${pulseDot} 1.4s ease-in-out infinite`
                        }}
                      />
                    }
                    label="Live: real-time messaging"
                    sx={{
                      bgcolor: 'rgba(0, 255, 136, 0.08)',
                      color: 'rgba(255,255,255,0.85)',
                      border: '1px solid rgba(0, 255, 136, 0.22)',
                      fontFamily: '"Outfit", sans-serif',
                      fontWeight: 600,
                      '& .MuiChip-icon': { ml: 1 }
                    }}
                  />
                  <Chip
                    icon={<Bolt sx={{ color: '#00f2ea' }} />}
                    label="Fast matching"
                    sx={{
                      bgcolor: 'rgba(0, 242, 234, 0.08)',
                      color: 'rgba(255,255,255,0.8)',
                      border: '1px solid rgba(0, 242, 234, 0.22)',
                      fontFamily: '"Outfit", sans-serif',
                      fontWeight: 600
                    }}
                  />
                </Box>
                
                <GradientText
                  variant="h1"
                  sx={{
                    fontSize: { xs: '1.75rem', sm: '2.25rem', md: '4rem', lg: '5rem' },
                    lineHeight: 1.1,
                    mb: 3,
                  }}
                >
                  Connect with Verified Companions
                </GradientText>
                
                <Typography
                  sx={{
                    fontSize: { xs: '16px', md: '20px' },
                    color: 'rgba(255, 255, 255, 0.7)',
                    lineHeight: 1.7,
                    mb: 4,
                    maxWidth: '600px',
                    fontFamily: '"Outfit", sans-serif',
                  }}
                >
                  Experience premium adult services with complete privacy, security, and 
                  discretion. All providers are verified and rated by real users.
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <GlassButton
                    variant="primary"
                    glowing
                    onClick={() => navigate('/adult-services')}
                    startIcon={<Whatshot />}
                    endIcon={<ArrowForward />}
                    sx={{ px: 4, py: 2 }}
                  >
                    Browse Services
                  </GlassButton>
                  <GlassButton
                    variant="outlined"
                    onClick={() => navigate('/profiles')}
                    startIcon={<Explore />}
                    sx={{ px: 4, py: 2 }}
                  >
                    Explore Profiles
                  </GlassButton>
                </Box>
              </motion.div>
            </Grid>
            
            <Grid item xs={12} md={5}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    height: { xs: '300px', md: '500px' },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Box
                    sx={{
                      width: '280px',
                      height: '380px',
                      borderRadius: '24px',
                      background: 'linear-gradient(145deg, rgba(0, 242, 234, 0.15), rgba(255, 0, 85, 0.15))',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      backdropFilter: 'blur(12px)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      animation: `${float} 6s ease-in-out infinite`,
                      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)',
                    }}
                  >
                    <Typography sx={{ fontSize: '80px', mb: 2 }}>🔥</Typography>
                    <Typography
                      sx={{
                        color: '#ffffff',
                        fontSize: '24px',
                        fontWeight: 700,
                        fontFamily: '"Outfit", sans-serif',
                        textAlign: 'center',
                      }}
                    >
                      Premium
                    </Typography>
                    <Typography
                      sx={{
                        color: '#00f2ea',
                        fontSize: '16px',
                        fontFamily: '"Outfit", sans-serif',
                      }}
                    >
                      Services Available
                    </Typography>
                  </Box>
                </Box>
              </motion.div>
            </Grid>
          </Grid>
        </Container>
      </HeroSection>

      {/* Stats Section */}
      <Box sx={{ py: { xs: 4, md: 6 }, borderTop: '1px solid rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <Container maxWidth="lg">
          <Grid container spacing={3}>
            {stats.map((stat, index) => (
              <Grid item xs={6} md={3} key={stat.label}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <StatBox>
                    <Typography
                      sx={{
                        fontSize: { xs: '22px', sm: '24px', md: '28px' },
                        fontWeight: 800,
                        color: '#00f2ea',
                        fontFamily: '"Outfit", sans-serif',
                      }}
                    >
                      {stat.value}
                    </Typography>
                    <Typography
                      sx={{
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontSize: '14px',
                        fontFamily: '"Outfit", sans-serif',
                      }}
                    >
                      {stat.label}
                    </Typography>
                  </StatBox>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Categories Section */}
      <Box sx={{ py: 10 }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography
              sx={{
                color: '#00f2ea',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '3px',
                textTransform: 'uppercase',
                mb: 2,
                fontFamily: '"Outfit", sans-serif',
              }}
            >
              Service Categories
            </Typography>
            <Typography
              variant="h2"
              sx={{
                color: '#ffffff',
                fontSize: { xs: '28px', md: '40px' },
                fontWeight: 800,
                fontFamily: '"Outfit", sans-serif',
                mb: 2,
              }}
            >
              Choose Your Experience
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                maxWidth: '600px',
                margin: '0 auto',
                fontFamily: '"Outfit", sans-serif',
              }}
            >
              Browse our curated selection of premium adult services tailored to your preferences
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {categories.map((category, index) => (
              <Grid item xs={12} sm={6} md={3} key={category.name}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <CategoryCard
                    accentColor={category.color}
                    onClick={() => navigate('/adult-services')}
                  >
                    <Typography sx={{ fontSize: '48px', mb: 2 }}>{category.icon}</Typography>
                    <Typography
                      sx={{
                        color: '#ffffff',
                        fontSize: '20px',
                        fontWeight: 700,
                        fontFamily: '"Outfit", sans-serif',
                        mb: 1,
                      }}
                    >
                      {category.name}
                    </Typography>
                    <Typography
                      sx={{
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontSize: '14px',
                        fontFamily: '"Outfit", sans-serif',
                        mb: 2,
                      }}
                    >
                      {category.description}
                    </Typography>
                    <Typography
                      sx={{
                        color: category.color,
                        fontSize: '14px',
                        fontWeight: 600,
                        fontFamily: '"Outfit", sans-serif',
                      }}
                    >
                      {category.price}
                    </Typography>
                  </CategoryCard>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Features Section */}
      <Box sx={{ py: 10, background: 'rgba(0, 0, 0, 0.2)' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography
              sx={{
                color: '#00f2ea',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '3px',
                textTransform: 'uppercase',
                mb: 2,
                fontFamily: '"Outfit", sans-serif',
              }}
            >
              Why Zerohook
            </Typography>
            <Typography
              variant="h2"
              sx={{
                color: '#ffffff',
                fontSize: { xs: '28px', md: '40px' },
                fontWeight: 800,
                fontFamily: '"Outfit", sans-serif',
              }}
            >
              Trust & Security First
            </Typography>
          </Box>

          <Grid container spacing={4}>
            {features.map((feature, index) => (
              <Grid item xs={12} sm={6} md={3} key={feature.title}>
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <GlassCard sx={{ height: '100%', p: 3 }}>
                    <FeatureIcon>{feature.icon}</FeatureIcon>
                    <Typography
                      sx={{
                        color: '#ffffff',
                        fontSize: '18px',
                        fontWeight: 700,
                        fontFamily: '"Outfit", sans-serif',
                        mb: 1,
                      }}
                    >
                      {feature.title}
                    </Typography>
                    <Typography
                      sx={{
                        color: 'rgba(255, 255, 255, 0.6)',
                        fontSize: '14px',
                        lineHeight: 1.6,
                        fontFamily: '"Outfit", sans-serif',
                      }}
                    >
                      {feature.description}
                    </Typography>
                  </GlassCard>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Box sx={{ py: 10 }}>
        <Container maxWidth="md">
          <GlassCard variant="neon" sx={{ p: { xs: 4, md: 6 }, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '48px', mb: 2 }}>🚀</Typography>
            <Typography
              variant="h3"
              sx={{
                color: '#ffffff',
                fontSize: { xs: '24px', md: '36px' },
                fontWeight: 800,
                fontFamily: '"Outfit", sans-serif',
                mb: 2,
              }}
            >
              Ready to Get Started?
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '18px',
                fontFamily: '"Outfit", sans-serif',
                mb: 4,
                maxWidth: '500px',
                margin: '0 auto 32px',
              }}
            >
              Get started in minutes with verified profiles, private chat, and safety-first features.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              {!isAuthenticated ? (
                <>
                  <GlassButton
                    variant="primary"
                    glowing
                    onClick={() => navigate('/register', { state: { from: { pathname: currentLocation.pathname, search: currentLocation.search, hash: currentLocation.hash } } })}
                    sx={{ px: 4, py: 2 }}
                  >
                    Create Account
                  </GlassButton>
                  <GlassButton
                    variant="outlined"
                    onClick={() => navigate('/login', { state: { from: { pathname: currentLocation.pathname, search: currentLocation.search, hash: currentLocation.hash } } })}
                    sx={{ px: 4, py: 2 }}
                  >
                    Sign In
                  </GlassButton>
                </>
              ) : (
                <GlassButton
                  variant="primary"
                  glowing
                  onClick={() => navigate('/adult-services')}
                  startIcon={<Whatshot />}
                  sx={{ px: 4, py: 2 }}
                >
                  Browse Services Now
                </GlassButton>
              )}
            </Box>
          </GlassCard>
        </Container>
      </Box>
    </Box>
  );
};

export default HomePage;
