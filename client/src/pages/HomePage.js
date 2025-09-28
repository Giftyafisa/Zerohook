import React from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Chip,
  Alert,
  Paper
} from '@mui/material';
import {
  Shield,
  Speed,
  AccountBalance,
  Lock,
  Star
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { colors, gradients } from '../theme/colors';
import { selectIsAuthenticated, selectIsSubscribed } from '../store/slices/authSlice';

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
        staggerChildren: 0.2
      }
    }
  };

  const serviceCategories = [
    {
      name: 'Long Term',
      displayName: 'Long Term Escort',
      description: 'Professional long-term escort services with maximum discretion',
      color: colors.categories.dgy,
      icon: '💕',
      startingPrice: 250
    },
    {
      name: 'Short Term',
      displayName: 'Short Term Escort',
      description: 'Professional short-term escort services with complete satisfaction',
      color: colors.categories.romans,
      icon: '🔥',
      startingPrice: 180
    },
    {
      name: 'Oral Services',
      displayName: 'Oral Services',
      description: 'Professional oral services and intimate wellness treatments',
      color: colors.categories.ridin,
      icon: '💋',
      startingPrice: 120
    },
    {
      name: 'Special Services',
      displayName: 'Premium Services',
      description: 'Exclusive high-end escort services for discerning clients',
      color: colors.categories.bb_suk,
      icon: '⭐',
      startingPrice: 500
    }
  ];

  const trustFeatures = [
    {
      icon: <Shield sx={{ fontSize: 40, color: colors.primary.red }} />,
      title: 'Verified Profiles',
      description: 'Multi-tier verification with photo ID and social media validation'
    },
    {
      icon: <AccountBalance sx={{ fontSize: 40, color: colors.primary.red }} />,
      title: 'Safe Connections',
      description: 'Advanced safety features protect you from scams and fake profiles'
    },
    {
      icon: <Speed sx={{ fontSize: 40, color: colors.primary.red }} />,
      title: 'Smart Matching',
      description: 'AI-powered compatibility matching based on interests and values'
    }
  ];

  return (
    <Box>
      {/* Subscription Banner for Unsubscribed Users */}
      {isAuthenticated && !isSubscribed && (
        <Box sx={{ bgcolor: 'warning.light', py: 2 }}>
          <Container maxWidth="lg">
            <Alert 
              severity="warning" 
              sx={{ 
                display: 'flex', 
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
              action={
                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={() => navigate('/subscription')}
                  startIcon={<Star />}
                >
                  Subscribe Now
                </Button>
              }
            >
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  🔒 Limited Access
                </Typography>
                <Typography variant="body2">
                  Complete your subscription to access all features and browse services
                </Typography>
              </Box>
            </Alert>
          </Container>
        </Box>
      )}

      {/* Hero Section */}
      <Box
        sx={{
          background: gradients.hero,
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <motion.div
                initial="initial"
                animate="animate"
                variants={fadeInUp}
              >
                <Typography
                  variant="h1"
                  sx={{
                    fontWeight: 800,
                    fontSize: { xs: '2.5rem', md: '4rem' },
                    mb: 3,
                    color: 'white',
                    lineHeight: 1.2
                  }}
                >
                  Premium Adult Services 🔥
                </Typography>
                <Typography
                  variant="h5"
                  sx={{
                    mb: 4,
                    color: 'rgba(255,255,255,0.9)',
                    lineHeight: 1.6
                  }}
                >
                  Connect with verified adult service providers offering premium escort services with complete privacy, security, and discretion.
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    size="large"
                    component={Link}
                    to="/services"
                    sx={{
                      bgcolor: colors.primary.white,
                      color: colors.primary.red,
                      px: 4,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      '&:hover': {
                        bgcolor: 'rgba(255,255,255,0.9)'
                      }
                    }}
                  >
                    Browse Profiles
                  </Button>
                  <Button
                    variant="outlined"
                    size="large"
                    component={Link}
                    to="/register"
                    sx={{
                      borderColor: 'white',
                      color: 'white',
                      px: 4,
                      py: 1.5,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      '&:hover': {
                        borderColor: 'white',
                        backgroundColor: 'rgba(255,255,255,0.1)'
                      }
                    }}
                  >
                    Create Profile
                  </Button>
                </Box>
              </motion.div>
            </Grid>
            <Grid item xs={12} md={6}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: 0.3 }}
              >
                <Box
                  sx={{
                    width: '100%',
                    height: 400,
                    background: 'rgba(255,255,255,0.1)',
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.2)'
                  }}
                >
                  <Typography variant="h3" sx={{ color: 'white', opacity: 0.7 }}>
                    💕 Dating Platform
                  </Typography>
                </Box>
              </motion.div>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* Service Categories Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <motion.div
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          variants={staggerChildren}
        >
          <motion.div variants={fadeInUp}>
            <Box textAlign="center" mb={6}>
              <Typography
                variant="h2"
                sx={{ 
                  fontWeight: 700,
                  mb: 2,
                  color: colors.text.primary
                }}
              >
                Dating Service Categories
              </Typography>
              <Typography
                variant="body1"
                sx={{
                  fontSize: '1.1rem',
                  color: colors.text.secondary,
                  maxWidth: 600,
                  mx: 'auto'
                }}
              >
                Choose from our carefully curated categories of premium dating services, 
                each with verified providers and secure payment protection.
              </Typography>
            </Box>
          </motion.div>

          {/* Limited Access Message for Unsubscribed Users */}
          {isAuthenticated && !isSubscribed && (
            <Grid item xs={12}>
              <motion.div variants={fadeInUp}>
                <Paper 
                  elevation={3}
                  sx={{ 
                    p: 4, 
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)',
                    border: '2px solid #f39c12'
                  }}
                >
                  <Lock sx={{ fontSize: 60, color: 'warning.main', mb: 2 }} />
                  <Typography variant="h5" fontWeight="bold" color="warning.dark" gutterBottom>
                    🔒 Limited Access
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    Subscribe to unlock full access to all dating services and features
                  </Typography>
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    onClick={() => navigate('/subscription')}
                    startIcon={<Star />}
                    sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
                  >
                    Subscribe Now - $20
                  </Button>
                </Paper>
              </motion.div>
            </Grid>
          )}

          <Grid container spacing={3}>
            {serviceCategories.map((category, index) => (
              <Grid item xs={12} sm={6} md={3} key={category.name}>
                <motion.div
                  variants={fadeInUp}
                  whileHover={{ y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card
                    elevation={4}
                    sx={{
                      height: '100%',
                      cursor: isSubscribed ? 'pointer' : 'default',
                      '&:hover': {
                        boxShadow: isSubscribed ? 8 : 4
                      },
                      opacity: isSubscribed ? 1 : 0.6,
                      position: 'relative'
                    }}
                    onClick={() => {
                      if (isSubscribed) {
                        navigate('/adult-services');
                      } else {
                        navigate('/subscription');
                      }
                    }}
                  >
                    <CardContent sx={{ textAlign: 'center', p: 3 }}>
                      <Typography variant="h1" sx={{ mb: 2 }}>
                        {category.icon}
                      </Typography>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          mb: 1,
                          color: colors.text.primary
                        }}
                      >
                        {category.displayName}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: colors.text.secondary,
                          mb: 2,
                          lineHeight: 1.6
                        }}
                      >
                        {category.description}
                      </Typography>
                      <Chip
                        label={`From $${category.startingPrice}`}
                        color="primary"
                        variant="outlined"
                        size="small"
                      />
                    </CardContent>

                    {/* Limited Access Overlay */}
                    {!isSubscribed && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          background: 'rgba(0,0,0,0.7)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 1
                        }}
                      >
                        <Box textAlign="center" sx={{ color: 'white' }}>
                          <Lock sx={{ fontSize: 40, mb: 1 }} />
                          <Typography variant="body2" fontWeight="bold">
                            Subscribe to Access
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </motion.div>
      </Container>

      {/* Trust Features Section */}
      <Box sx={{ bgcolor: colors.background.light, py: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg">
          <motion.div
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerChildren}
          >
            <motion.div variants={fadeInUp}>
              <Box textAlign="center" mb={6}>
                <Typography
                  variant="h2"
                  sx={{
                    fontWeight: 700,
                    mb: 2,
                    color: colors.text.primary
                  }}
                >
                  Built on Trust & Safety
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    fontSize: '1.1rem',
                    color: colors.text.secondary,
                    maxWidth: 600,
                    mx: 'auto'
                  }}
                >
                  Our platform prioritizes your safety and security with advanced verification systems and fraud protection.
                </Typography>
              </Box>
            </motion.div>

            <Grid container spacing={4}>
              {trustFeatures.map((feature, index) => (
                <Grid item xs={12} md={4} key={index}>
                  <motion.div
                    variants={fadeInUp}
                    whileHover={{ y: -5 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Card
                      elevation={2}
                      sx={{
                        height: '100%',
                        textAlign: 'center',
                        p: 3,
                        '&:hover': {
                          boxShadow: 4
                        }
                      }}
                    >
                      <Box sx={{ mb: 2 }}>
                        {feature.icon}
                      </Box>
                      <Typography
                        variant="h6"
                        sx={{
                          fontWeight: 600,
                          mb: 2,
                          color: colors.text.primary
                        }}
                      >
                        {feature.title}
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          color: colors.text.secondary,
                          lineHeight: 1.6
                        }}
                      >
                        {feature.description}
                      </Typography>
                    </Card>
                  </motion.div>
                </Grid>
              ))}
            </Grid>
          </motion.div>
        </Container>
      </Box>

      {/* CTA Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
        <motion.div
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          variants={fadeInUp}
        >
          <Box
            sx={{
              textAlign: 'center',
              bgcolor: colors.primary.red,
              borderRadius: 4,
              p: { xs: 4, md: 6 },
              color: 'white'
            }}
          >
            <Typography
              variant="h2"
              sx={{
                fontWeight: 700,
                mb: 2
              }}
            >
              Ready to Find Love?
            </Typography>
            <Typography
              variant="h6"
              sx={{
                mb: 4,
                opacity: 0.9,
                maxWidth: 600,
                mx: 'auto'
              }}
            >
              Join thousands of singles who have found meaningful connections on our platform.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                component={Link}
                to="/register"
                sx={{
                  bgcolor: 'white',
                  color: colors.primary.red,
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.9)'
                  }
                }}
              >
                Create Profile
              </Button>
              <Button
                variant="outlined"
                size="large"
                component={Link}
                to="/services"
                sx={{
                  borderColor: 'white',
                  color: 'white',
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  '&:hover': {
                    borderColor: 'white',
                    backgroundColor: 'rgba(255,255,255,0.1)'
                  }
                }}
              >
                Browse Profiles
              </Button>
            </Box>
          </Box>
        </motion.div>
      </Container>
    </Box>
  );
};

export default HomePage;
