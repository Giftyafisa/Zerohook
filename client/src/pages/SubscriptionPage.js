import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
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
  DialogActions
} from '@mui/material';
import { CheckCircle, Star, Payment, OpenInNew, LocationOn } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { selectUser, setSubscriptionStatus } from '../store/slices/authSlice';
import { detectUserCountry } from '../store/slices/countrySlice';
import subscriptionAPI from '../services/subscriptionAPI';

// Supported countries with pricing
const SUPPORTED_COUNTRIES = [
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', currency: 'NGN', symbol: '₦', price: 30000, phoneCode: '+234' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', currency: 'GHS', symbol: '₵', price: 500, phoneCode: '+233' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', currency: 'KES', symbol: 'KSh', price: 6500, phoneCode: '+254' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', currency: 'ZAR', symbol: 'R', price: 750, phoneCode: '+27' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬', currency: 'UGX', symbol: 'USh', price: 150000, phoneCode: '+256' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', currency: 'TZS', symbol: 'TSh', price: 100000, phoneCode: '+255' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', currency: 'RWF', symbol: 'FRw', price: 50000, phoneCode: '+250' },
  { code: 'BW', name: 'Botswana', flag: '🇧🇼', currency: 'BWP', symbol: 'P', price: 550, phoneCode: '+267' },
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲', currency: 'ZMW', symbol: 'ZK', price: 1000, phoneCode: '+260' },
  { code: 'MW', name: 'Malawi', flag: '🇲🇼', currency: 'MWK', symbol: 'MK', price: 70000, phoneCode: '+265' }
];

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { userCountry, detectedCountry, loading: countryLoading } = useSelector(state => state.country);
  
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

      // Use the selected country for the subscription with local pricing
      const response = await subscriptionAPI.createSubscription({
        planId: 'Basic Access',
        amount: selectedCountry.price,
        currency: selectedCountry.currency,
        countryCode: selectedCountry.code
      });

                if (response.success) {
            // Store the payment reference for verification
            const paymentDataWithRef = {
              ...response.paymentData,
              paystackReference: response.paymentData.reference || response.paymentData.paystackReference
            };
            setPaymentData(paymentDataWithRef);
            setShowPaymentDialog(true);
            
            if (response.paymentData.isTestMode) {
              toast.info('Test Mode: Using fallback payment method');
            } else {
              toast.success('Subscription created! Redirecting to payment...');
            }
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

  const handlePaymentClose = () => {
    setShowPaymentDialog(false);
    setPaymentData(null);
  };

  const handlePaymentRedirect = () => {
    if (paymentData?.authorizationUrl) {
      // For Paystack, open in new window/tab for better user experience
      const paymentWindow = window.open(paymentData.authorizationUrl, '_blank', 'width=800,height=600');
      
      if (paymentWindow) {
        // Check if payment window was blocked
        toast.info('Payment window opened. Please complete your payment.');
        
        // Monitor payment completion with status polling
        const checkPayment = setInterval(async () => {
          if (paymentWindow.closed) {
            clearInterval(checkPayment);
            
            // Poll for payment status every 2 seconds for up to 30 seconds
            let attempts = 0;
            const maxAttempts = 15;
            
            const pollPaymentStatus = async () => {
              try {
                // First try to verify the specific payment
                if (paymentData?.paystackReference) {
                  const verifyResponse = await subscriptionAPI.verifyPaymentByReference(paymentData.paystackReference);
                  if (verifyResponse.success && verifyResponse.isSubscribed) {
                    // Update Redux state
                    dispatch(setSubscriptionStatus(true));
                    toast.success('🎉 Payment completed! Subscription activated successfully!');
                    setTimeout(() => navigate('/dashboard'), 2000);
                    return;
                  }
                }
                
                // Fallback to general status check
                const statusResponse = await subscriptionAPI.checkStatus();
                if (statusResponse.success && statusResponse.isSubscribed) {
                  // Update Redux state
                  dispatch(setSubscriptionStatus(true));
                  toast.success('🎉 Payment completed! Subscription activated successfully!');
                  setTimeout(() => navigate('/dashboard'), 2000);
                  return;
                }
              } catch (error) {
                console.error('Error checking subscription status:', error);
              }
              
              attempts++;
              if (attempts < maxAttempts) {
                setTimeout(pollPaymentStatus, 2000);
              } else {
                toast.warning('Payment completed but subscription not yet activated. Please wait a moment and refresh the page.');
                setTimeout(() => navigate('/dashboard'), 3000);
              }
            };
            
            // Start polling
            pollPaymentStatus();
          }
        }, 1000);
      } else {
        // Fallback if popup was blocked
        toast.warning('Popup blocked. Please allow popups and try again, or click the link below.');
        // Show manual link
        setShowPaymentDialog(false);
        setPaymentData({ ...paymentData, showManualLink: true });
      }
    }
  };

  if (loading || detectingLocation) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          {detectingLocation ? '📍 Detecting your location...' : 'Loading...'}
        </Typography>
      </Container>
    );
  }

  // Format price with proper formatting
  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box textAlign="center" mb={6}>
        <Typography variant="h3" fontWeight="bold" color="primary.main" gutterBottom>
          Welcome to Zerohook! 🎉
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Complete your registration with a subscription to access the platform
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={4} justifyContent="center">
        <Grid item xs={12} md={6} lg={5}>
          <Card elevation={4} sx={{ height: '100%', border: '2px solid', borderColor: 'primary.main' }}>
            {/* Country Badge at Top */}
            {selectedCountry && (
              <Box 
                sx={{ 
                  bgcolor: 'primary.main', 
                  color: 'white', 
                  py: 1.5, 
                  px: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1
                }}
              >
                <LocationOn />
                <Typography variant="body1" fontWeight="bold">
                  {selectedCountry.flag} Paying from {selectedCountry.name}
                </Typography>
              </Box>
            )}
            
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="primary.main" gutterBottom>
                Basic Access
              </Typography>
              
              <Box sx={{ my: 3 }}>
                {selectedCountry && (
                  <>
                    <Typography variant="h2" fontWeight="bold" color="primary.main">
                      {selectedCountry.symbol}{formatPrice(selectedCountry.price)}
                    </Typography>
                    <Typography variant="h6" color="text.secondary">
                      {selectedCountry.currency}
                    </Typography>
                  </>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  One-time payment • Lifetime access
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              <List sx={{ textAlign: 'left' }}>
                {[
                  'Full access to the platform',
                  'Browse all services',
                  'Create and manage services',
                  'Secure messaging system',
                  'Trust and reputation system',
                  '24/7 customer support'
                ].map((feature, index) => (
                  <ListItem key={index} sx={{ px: 0 }}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={feature}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>

            <CardActions sx={{ p: 4, pt: 2 }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleSubscribe}
                disabled={paymentLoading || !selectedCountry}
                startIcon={paymentLoading ? <CircularProgress size={20} /> : <Payment />}
                sx={{
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}
              >
                {paymentLoading ? 'Processing...' : `Pay ${selectedCountry?.symbol}${formatPrice(selectedCountry?.price || 0)} ${selectedCountry?.currency || ''}`}
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 8, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Why Subscribe to Zerohook?
        </Typography>
        <Grid container spacing={3} justifyContent="center" sx={{ mt: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Box textAlign="center">
              <Star sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Premium User Experience
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Payment Dialog */}
      <Dialog 
        open={showPaymentDialog} 
        onClose={handlePaymentClose}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <Payment sx={{ mr: 1, color: 'primary.main' }} />
            {paymentData?.isTestMode ? 'Test Payment Mode' : 'Complete Payment'}
          </Box>
        </DialogTitle>
        <DialogContent>
          {paymentData && selectedCountry && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Subscription: Basic Access
              </Typography>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Amount: {selectedCountry.symbol}{formatPrice(selectedCountry.price)} {selectedCountry.currency}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Country: {selectedCountry.flag} {selectedCountry.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {paymentData.isTestMode 
                  ? 'This is a test payment. Click the button below to simulate a successful payment.'
                  : 'You will be redirected to Paystack to complete your payment securely.'
                }
              </Typography>
              
              {paymentData.isTestMode ? (
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={async () => {
                    try {
                      // Simulate successful payment for test mode
                      // Update Redux state immediately for test mode
                      dispatch(setSubscriptionStatus(true));
                      toast.success('Test payment successful! Subscription activated successfully!');
                      setTimeout(() => navigate('/dashboard'), 2000);
                    } catch (error) {
                      console.error('Error updating subscription status:', error);
                      toast.success('Test payment successful! Redirecting to dashboard...');
                      setTimeout(() => navigate('/dashboard'), 2000);
                    }
                  }}
                  startIcon={<Star />}
                  sx={{
                    py: 1.5,
                    fontSize: '1.1rem',
                    fontWeight: 'bold',
                    bgcolor: 'success.main'
                  }}
                >
                  Complete Test Payment
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handlePaymentRedirect}
                  startIcon={<OpenInNew />}
                  sx={{
                    py: 1.5,
                    fontSize: '1.1rem',
                    fontWeight: 'bold'
                  }}
                >
                  Pay with Paystack
                </Button>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePaymentClose} color="inherit">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Manual Payment Link Dialog */}
      <Dialog 
        open={paymentData?.showManualLink || false} 
        onClose={() => setPaymentData(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <Payment sx={{ mr: 1, color: 'warning.main' }} />
            Manual Payment Link
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Popup was blocked. Please click the link below to complete your payment:
          </Typography>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="body2" component="a" 
              href={paymentData?.authorizationUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              sx={{ 
                color: 'primary.main', 
                textDecoration: 'none',
                wordBreak: 'break-all'
              }}
            >
              {paymentData?.authorizationUrl}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentData(null)} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SubscriptionPage;
