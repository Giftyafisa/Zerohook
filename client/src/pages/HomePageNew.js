import React from 'react';
import { useSelector } from 'react-redux';
import { Box, Container, Typography, Grid } from '@mui/material';
import { styled, keyframes } from '@mui/system';
import {
  Shield,
  Speed,
  VerifiedUser,
  TrendingUp,
  Star,
  Explore,
  Whatshot,
  ArrowForward
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { selectIsAuthenticated, selectIsSubscribed } from '../store/slices/authSlice';
import { GlassCard, GlassButton } from '../components/ui';

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-20px); }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 20px rgba(0, 242, 234, 0.3); }
  50% { box-shadow: 0 0 40px rgba(0, 242, 234, 0.6); }
`;

const shimmer = keyframes`
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
`;

const HeroSection = styled(Box)({
  minHeight: '90vh',
  display: 'flex',
  alignItems: 'center',
  position: 'relative',
  overflow: 'hidden',
  padding: '40px 0',
});

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

const FeatureIcon = styled(Box)({
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
  
  '&:hover': {
    transform: 'scale(1.1)',
    boxShadow: '0 0 30px rgba(0, 242, 234, 0.4)',
  },
});

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
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isSubscribed = useSelector(selectIsSubscribed);

  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8 }
  };

  const staggerChildren = {
    animate: {
      transition: {
        staggerChildren: 0.15
      }
    }
  };

  const categories = [
    {
      name: 'Long Term',
      icon: '💕',
      description: 'Premium long-term companionship',
      color: '#ff0055',
      price: 'From ₦250,000'
    },
    {
      name: 'Short Term',
      icon: '🔥',
      description: 'Quality short-term encounters',
      color: '#ff6600',
      price: 'From ₦150,000'
    },
    {
      name: 'VIP Services',
      icon: '⭐',
      description: 'Exclusive premium experiences',
      color: '#00f2ea',
      price: 'From ₦500,000'
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

  const stats = [
    { value: '50K+', label: 'Active Users' },
    { value: '99.9%', label: 'Satisfaction Rate' },
    { value: '24/7', label: 'Support Available' },
    { value: '100%', label: 'Verified Profiles' }
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
                onClick={() => navigate('/subscription')}
                startIcon={<Star />}
              >
                Subscribe Now
              </GlassButton>
            </Box>
          </Container>
        </Box>
      )}

      {/* Hero Section */}
      <HeroSection>
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
                
                <GradientText
                  variant="h1"
                  sx={{
                    fontSize: { xs: '2.5rem', md: '4rem', lg: '5rem' },
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
      <Box sx={{ py: 6, borderTop: '1px solid rgba(255, 255, 255, 0.05)', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <Container maxWidth="lg">
          <Grid container spacing={3}>
            {stats.map((stat, index) => (
              <Grid item xs={6} md={3} key={index}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <StatBox>
                    <Typography
                      sx={{
                        fontSize: { xs: '32px', md: '40px' },
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
              <Grid item xs={12} sm={6} md={3} key={index}>
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
              <Grid item xs={12} sm={6} md={3} key={index}>
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
              Join thousands of users enjoying premium adult services with complete privacy and security.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              {!isAuthenticated ? (
                <>
                  <GlassButton
                    variant="primary"
                    glowing
                    onClick={() => navigate('/register')}
                    sx={{ px: 4, py: 2 }}
                  >
                    Create Account
                  </GlassButton>
                  <GlassButton
                    variant="outlined"
                    onClick={() => navigate('/login')}
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
