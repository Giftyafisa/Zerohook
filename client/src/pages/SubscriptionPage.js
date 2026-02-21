import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import CryptoPayment from '../components/payments/CryptoPayment';
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  CardActions,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  LinearProgress,
  Avatar,
  IconButton
} from '@mui/material';
import { 
  CheckCircle, 
  Star, 
  Payment, 
  OpenInNew, 
  LocationOn, 
  Lock, 
  Shield,
  Verified,
  Message,
  TrendingUp,
  Support,
  AutoAwesome,
  Bolt,
  ArrowForward,
  Close
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { selectUser, setSubscriptionStatus } from '../store/slices/authSlice';
import { detectUserCountry } from '../store/slices/countrySlice';
import subscriptionAPI from '../services/subscriptionAPI';

// Motion components
const MotionBox = motion(Box);
const MotionCard = motion(Card);

// Base price in USD - $20 for 6-month subscription
const BASE_PRICE_USD = 20;

// Supported countries with pricing
// Prices calculated based on $20 USD base price using current exchange rates
const SUPPORTED_COUNTRIES = [
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', currency: 'NGN', symbol: '₦', price: 32000, phoneCode: '+234' },  // $20 * 1580
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', currency: 'GHS', symbol: '₵', price: 300, phoneCode: '+233' },  // $20 * 15.2
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', currency: 'KES', symbol: 'KSh', price: 3100, phoneCode: '+254' },  // $20 * 154
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', currency: 'ZAR', symbol: 'R', price: 380, phoneCode: '+27' },  // $20 * 18.8
  { code: 'UG', name: 'Uganda', flag: '🇺🇬', currency: 'UGX', symbol: 'USh', price: 76000, phoneCode: '+256' },  // $20 * 3780
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', currency: 'TZS', symbol: 'TSh', price: 52000, phoneCode: '+255' },  // $20 * 2580
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', currency: 'RWF', symbol: 'FRw', price: 26500, phoneCode: '+250' },  // $20 * 1320
  { code: 'BW', name: 'Botswana', flag: '🇧🇼', currency: 'BWP', symbol: 'P', price: 280, phoneCode: '+267' },  // $20 * 13.8
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲', currency: 'ZMW', symbol: 'ZK', price: 550, phoneCode: '+260' },  // $20 * 27.5
  { code: 'MW', name: 'Malawi', flag: '🇲🇼', currency: 'MWK', symbol: 'MK', price: 35000, phoneCode: '+265' }  // $20 * 1750
];

// Supported crypto payment methods
const SUPPORTED_CRYPTOS = ['BTC', 'ETH', 'USDT', 'USDC'];

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { userCountry, detectedCountry } = useSelector(state => state.country);
  
  const [loading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [detectingLocation, setDetectingLocation] = useState(true);

  // Detect country on mount
  useEffect(() => {
    const detectCountry = async () => {
      try {
        // Check if country already detected in Redux
        if (userCountry?.code || detectedCountry?.code) {
          const countryCode = userCountry?.code || detectedCountry?.code;
          const country = SUPPORTED_COUNTRIES.find(c => c.code === countryCode);
          if (country) {
            setSelectedCountry(country);
            console.log('📍 Using stored country:', country.name);
          }
          setDetectingLocation(false);
          return;
        }

        // Otherwise detect from API
        const result = await dispatch(detectUserCountry()).unwrap();
        if (result.success && result.detectedCountry) {
          const country = SUPPORTED_COUNTRIES.find(c => c.code === result.detectedCountry.code);
          if (country) {
            setSelectedCountry(country);
            console.log('📍 Country auto-detected:', country.name);
            toast.success(`📍 Location detected: ${country.flag} ${country.name}`);
          }
        }
      } catch (error) {
        console.log('Country detection failed, defaulting to Nigeria:', error);
      } finally {
        setDetectingLocation(false);
      }
    };

    detectCountry();
  }, [dispatch, userCountry, detectedCountry]);

  // Set default country if none detected
  useEffect(() => {
    if (!detectingLocation && !selectedCountry) {
      setSelectedCountry(SUPPORTED_COUNTRIES[0]); // Default to Nigeria
    }
  }, [detectingLocation, selectedCountry]);

  useEffect(() => {
    if (!user) {
      navigate('/register');
    }
  }, [user, navigate]);

  const handleSubscribe = async () => {
    if (!selectedCountry) {
      toast.error('Please select your country first');
      return;
    }

    try {
      setPaymentLoading(true);
      setError('');

      // Create crypto subscription
      const response = await subscriptionAPI.createSubscription({
        planId: 'Basic Access',
        amount: selectedCountry.price,
        currency: selectedCountry.currency,
        countryCode: selectedCountry.code,
        cryptoSymbol: 'USDT'
      });

      if (response.success && response.paymentData) {
        // Store payment data for the CryptoPayment dialog
        setPaymentData(response.paymentData);
        setShowPaymentDialog(true);
        toast.info('Crypto payment invoice created. Send the exact amount to the address shown.');
      } else {
        setError(response.error || 'Failed to create subscription');
        toast.error('Failed to create subscription');
      }
    } catch (error) {
      console.error('Subscription error:', error);
      const errorMessage = error.response?.data?.error || 'Failed to create subscription. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setPaymentLoading(false);
    }
  };

  const handlePaymentSuccess = async (data) => {
    // Payment confirmed on blockchain
    dispatch(setSubscriptionStatus(true));
    toast.success('🎉 Subscription activated successfully!');
    setTimeout(() => navigate('/dashboard'), 2000);
  };

  const handlePaymentClose = () => {
    setShowPaymentDialog(false);
    setPaymentData(null);
  };

  if (loading || detectingLocation) {
    return (
      <Box sx={{ 
        minHeight: '100vh', 
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 3
      }}>
        <MotionBox
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <Box sx={{ 
            width: 80, 
            height: 80, 
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #00f2ea, #ff00d4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 40px rgba(0, 242, 234, 0.3)'
          }}>
            <LocationOn sx={{ fontSize: 40, color: '#fff' }} />
          </Box>
        </MotionBox>
        <Typography variant="h6" sx={{ color: '#fff', fontWeight: 600 }}>
          {detectingLocation ? '📍 Detecting your location...' : 'Loading...'}
        </Typography>
        <LinearProgress sx={{ width: 200, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.1)' }} />
      </Box>
    );
  }

  // Format price with proper formatting
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  // Feature list for the subscription
  const features = [
    { icon: <Verified />, text: 'Full Platform Access', highlight: true },
    { icon: <Message />, text: 'Unlimited Messaging' },
    { icon: <Shield />, text: 'Secure Escrow Payments' },
    { icon: <TrendingUp />, text: 'Trust & Reputation System' },
    { icon: <Support />, text: '24/7 Priority Support' },
    { icon: <AutoAwesome />, text: 'Premium Profile Badge' }
  ];

  return (
    <Box sx={{ 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%)',
      py: { xs: 4, md: 8 },
      px: 2
    }}>
      <Container maxWidth="lg">
        {/* Header Section */}
        <MotionBox
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}
        >
          <Typography 
            variant="h3" 
            sx={{ 
              fontWeight: 800,
              background: 'linear-gradient(135deg, #00f2ea 0%, #ff00d4 50%, #00f2ea 100%)',
              backgroundSize: '200% auto',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: 'gradient 3s ease infinite',
              mb: 2,
              fontSize: { xs: '2rem', md: '3rem' },
              '@keyframes gradient': {
                '0%': { backgroundPosition: '0% center' },
                '50%': { backgroundPosition: '100% center' },
                '100%': { backgroundPosition: '0% center' }
              }
            }}
          >
            Welcome to Zerohook 🔥
          </Typography>
          <Typography 
            variant="h6" 
            sx={{ 
              color: 'rgba(255,255,255,0.7)', 
              maxWidth: 500, 
              mx: 'auto',
              fontSize: { xs: '0.95rem', md: '1.1rem' }
            }}
          >
            Complete your registration to unlock the full platform experience
          </Typography>
        </MotionBox>

        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 4, 
              bgcolor: 'rgba(255, 51, 51, 0.1)',
              color: '#ff5555',
              border: '1px solid rgba(255, 51, 51, 0.3)'
            }}
          >
            {error}
          </Alert>
        )}

        {/* Main Pricing Card */}
        <Grid container spacing={4} justifyContent="center" alignItems="stretch">
          {/* Pricing Card */}
          <Grid item xs={12} md={6} lg={5}>
            <MotionCard
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              sx={{
                height: '100%',
                background: 'linear-gradient(145deg, rgba(26, 26, 46, 0.9), rgba(10, 10, 15, 0.95))',
                borderRadius: 4,
                border: '2px solid',
                borderColor: '#00f2ea',
                boxShadow: '0 20px 60px rgba(0, 242, 234, 0.15)',
                overflow: 'hidden',
                position: 'relative',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: 'linear-gradient(90deg, #00f2ea, #ff00d4, #00f2ea)',
                  backgroundSize: '200% auto',
                  animation: 'gradient 3s ease infinite'
                }
              }}
            >
              {/* Country Badge */}
              {selectedCountry && (
                <Box sx={{ 
                  background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.15), rgba(255, 0, 212, 0.15))',
                  py: 2,
                  px: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1.5,
                  borderBottom: '1px solid rgba(255,255,255,0.1)'
                }}>
                  <LocationOn sx={{ color: '#00f2ea', fontSize: 22 }} />
                  <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '1rem' }}>
                    {selectedCountry.flag} Paying from {selectedCountry.name}
                  </Typography>
                  <Chip 
                    label={selectedCountry.currency} 
                    size="small" 
                    sx={{ 
                      bgcolor: 'rgba(0, 242, 234, 0.2)', 
                      color: '#00f2ea',
                      fontWeight: 700,
                      fontSize: '0.75rem'
                    }} 
                  />
                </Box>
              )}

              <CardContent sx={{ p: { xs: 3, md: 4 } }}>
                {/* Plan Name & Badge */}
                <Box sx={{ textAlign: 'center', mb: 3 }}>
                  <Chip 
                    icon={<Bolt sx={{ color: '#ffd700 !important' }} />}
                    label="6-MONTH ACCESS" 
                    sx={{ 
                      bgcolor: 'rgba(255, 215, 0, 0.15)',
                      color: '#ffd700',
                      fontWeight: 700,
                      mb: 2,
                      fontSize: '0.8rem',
                      px: 1
                    }}
                  />
                  <Typography variant="h5" sx={{ color: '#fff', fontWeight: 700 }}>
                    Premium Membership
                  </Typography>
                </Box>

                {/* Price Display */}
                {selectedCountry && (
                  <Box sx={{ 
                    textAlign: 'center', 
                    py: 3,
                    my: 2,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.08), rgba(255, 0, 212, 0.08))',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', mb: 0.5 }}>
                      One-time payment
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 1 }}>
                      <Typography sx={{ 
                        fontSize: { xs: '2.5rem', md: '3.5rem' },
                        fontWeight: 800,
                        color: '#fff',
                        lineHeight: 1
                      }}>
                        {selectedCountry.symbol}{formatPrice(selectedCountry.price)}
                      </Typography>
                    </Box>
                    <Typography sx={{ color: '#00f2ea', fontWeight: 600, mt: 1 }}>
                      for 6 months
                    </Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', mt: 1 }}>
                      ≈ ${BASE_PRICE_USD} USD • Manual renewal required (crypto)
                    </Typography>
                  </Box>
                )}

                {/* Features List */}
                <List sx={{ py: 0 }}>
                  {features.map((feature, index) => (
                    <ListItem 
                      key={index} 
                      sx={{ 
                        px: 0, 
                        py: 1,
                        borderBottom: index < features.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <Box sx={{ 
                          color: feature.highlight ? '#00f2ea' : 'rgba(255,255,255,0.6)',
                          '& svg': { fontSize: 22 }
                        }}>
                          {feature.icon}
                        </Box>
                      </ListItemIcon>
                      <ListItemText 
                        primary={feature.text}
                        primaryTypographyProps={{ 
                          sx: { 
                            color: feature.highlight ? '#fff' : 'rgba(255,255,255,0.8)',
                            fontWeight: feature.highlight ? 600 : 400,
                            fontSize: '0.95rem'
                          }
                        }}
                      />
                      <CheckCircle sx={{ color: '#00ff88', fontSize: 20 }} />
                    </ListItem>
                  ))}
                </List>

                {/* Crypto Payment Methods */}
                <Box sx={{ 
                  mt: 3, 
                  p: 2, 
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <Lock sx={{ fontSize: 16, color: '#00ff88' }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
                      Fee-free crypto payment:
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {SUPPORTED_CRYPTOS.map((crypto) => (
                      <Chip
                        key={crypto}
                        label={crypto}
                        size="small"
                        sx={{ 
                          bgcolor: 'rgba(255,255,255,0.08)',
                          color: 'rgba(255,255,255,0.7)',
                          fontSize: '0.7rem',
                          height: 26,
                        }}
                      />
                    ))}
                  </Box>
                </Box>
              </CardContent>

              <CardActions sx={{ p: { xs: 3, md: 4 }, pt: 0 }}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleSubscribe}
                  disabled={paymentLoading || !selectedCountry}
                  endIcon={paymentLoading ? null : <ArrowForward />}
                  sx={{
                    py: 2,
                    fontSize: '1.1rem',
                    fontWeight: 700,
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #00f2ea, #00d4aa)',
                    color: '#000',
                    boxShadow: '0 8px 30px rgba(0, 242, 234, 0.3)',
                    transition: 'all 0.3s ease',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 12px 40px rgba(0, 242, 234, 0.4)',
                      background: 'linear-gradient(135deg, #00f2ea, #00f2ea)'
                    },
                    '&:disabled': {
                      background: 'rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.3)'
                    }
                  }}
                >
                  {paymentLoading ? (
                    <CircularProgress size={24} sx={{ color: '#000' }} />
                  ) : (
                    `Get Access Now`
                  )}
                </Button>
              </CardActions>
            </MotionCard>
          </Grid>

          {/* Benefits Side */}
          <Grid item xs={12} md={6} lg={5}>
            <MotionBox
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}
            >
              {/* Trust Stats */}
              <Box sx={{ 
                p: 3,
                borderRadius: 3,
                background: 'linear-gradient(145deg, rgba(26, 26, 46, 0.6), rgba(10, 10, 15, 0.8))',
                border: '1px solid rgba(255,255,255,0.08)'
              }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, mb: 2, fontSize: '1.1rem' }}>
                  🛡️ Why Zerohook?
                </Typography>
                <Grid container spacing={2}>
                  {[
                    { label: 'Verified Users', value: '10K+', icon: '✓' },
                    { label: 'Countries', value: '10+', icon: '🌍' },
                    { label: 'Satisfaction', value: '98%', icon: '⭐' },
                    { label: 'Secure', value: '100%', icon: '🔒' }
                  ].map((stat, i) => (
                    <Grid item xs={6} key={i}>
                      <Box sx={{ 
                        p: 2, 
                        borderRadius: 2, 
                        bgcolor: 'rgba(255,255,255,0.03)',
                        textAlign: 'center'
                      }}>
                        <Typography sx={{ fontSize: '1.5rem', mb: 0.5 }}>{stat.icon}</Typography>
                        <Typography sx={{ color: '#00f2ea', fontWeight: 700, fontSize: '1.3rem' }}>
                          {stat.value}
                        </Typography>
                        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                          {stat.label}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Box>

              {/* Testimonial */}
              <Box sx={{ 
                p: 3,
                borderRadius: 3,
                background: 'linear-gradient(145deg, rgba(26, 26, 46, 0.6), rgba(10, 10, 15, 0.8))',
                border: '1px solid rgba(255,255,255,0.08)',
                flex: 1
              }}>
                <Typography sx={{ color: '#fff', fontWeight: 700, mb: 2, fontSize: '1.1rem' }}>
                  💬 What Users Say
                </Typography>
                <Box sx={{ 
                  p: 2, 
                  borderRadius: 2, 
                  bgcolor: 'rgba(0, 242, 234, 0.05)',
                  border: '1px solid rgba(0, 242, 234, 0.1)'
                }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', mb: 2, lineHeight: 1.6 }}>
                    "The escrow system gives me peace of mind. I know my payments are secure until the service is complete."
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Avatar sx={{ width: 36, height: 36, bgcolor: '#00f2ea', color: '#000' }}>A</Avatar>
                    <Box>
                      <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>
                        Ama K.
                      </Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                        Verified User • Accra
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>

              {/* Money Back Guarantee */}
              <Box sx={{ 
                p: 2.5,
                borderRadius: 3,
                background: 'linear-gradient(135deg, rgba(0, 255, 136, 0.1), rgba(0, 242, 234, 0.1))',
                border: '1px solid rgba(0, 255, 136, 0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 2
              }}>
                <Shield sx={{ color: '#00ff88', fontSize: 36 }} />
                <Box>
                  <Typography sx={{ color: '#00ff88', fontWeight: 700, fontSize: '0.95rem' }}>
                    7-Day Money Back Guarantee
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
                    Not satisfied? Get a full refund within 7 days.
                  </Typography>
                </Box>
              </Box>
            </MotionBox>
          </Grid>
        </Grid>

        {/* Country Selector (if needed) */}
        <MotionBox
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          sx={{ textAlign: 'center', mt: 4 }}
        >
          <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem', mb: 1 }}>
            Not in {selectedCountry?.name}? Select your country:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
            {SUPPORTED_COUNTRIES.map((country) => (
              <Chip
                key={country.code}
                label={`${country.flag} ${country.code}`}
                onClick={() => setSelectedCountry(country)}
                sx={{
                  bgcolor: selectedCountry?.code === country.code ? 'rgba(0, 242, 234, 0.2)' : 'rgba(255,255,255,0.05)',
                  color: selectedCountry?.code === country.code ? '#00f2ea' : 'rgba(255,255,255,0.6)',
                  border: selectedCountry?.code === country.code ? '1px solid #00f2ea' : '1px solid transparent',
                  fontWeight: 600,
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'rgba(0, 242, 234, 0.1)'
                  }
                }}
              />
            ))}
          </Box>
        </MotionBox>
      </Container>

      {/* Crypto Payment Dialog */}
      {paymentData && (
        <CryptoPayment
          open={showPaymentDialog}
          paymentData={paymentData}
          onSuccess={handlePaymentSuccess}
          onClose={handlePaymentClose}
          title="Subscription Payment"
        />
      )}
    </Box>
  );
};

export default SubscriptionPage;
