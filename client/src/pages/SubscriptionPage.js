import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
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
import { CheckCircle, Star, Payment, OpenInNew } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { selectUser, setSubscriptionStatus } from '../store/slices/authSlice';
import subscriptionAPI from '../services/subscriptionAPI';
import { useDispatch } from 'react-redux';

const SubscriptionPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  
  const [loading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const [error, setError] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('NG');

  useEffect(() => {
    if (!user) {
      navigate('/register');
    }
  }, [user, navigate]);

  const handleSubscribe = async () => {
    try {
      setPaymentLoading(true);
      setError('');

      // Use the selected country for the subscription
      const response = await subscriptionAPI.createSubscription({
        planId: 'Basic Access',
        amount: 20,
        currency: 'USD',
        countryCode: selectedCountry
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

  if (loading) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading...
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Box textAlign="center" mb={6}>
        <Typography variant="h3" fontWeight="bold" color="primary.main" gutterBottom>
          Welcome to Hkup! 🎉
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Complete your registration with a subscription to access the platform
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Your account has been created successfully. Now choose your subscription plan to get started.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={4} justifyContent="center">
        <Grid item xs={12} md={6} lg={4}>
          <Card elevation={4} sx={{ height: '100%' }}>
            <CardContent sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h4" fontWeight="bold" color="primary.main" gutterBottom>
                Basic Access
              </Typography>
              
              <Box sx={{ my: 3 }}>
                <Typography variant="h2" fontWeight="bold" color="primary.main">
                  $20
                </Typography>
                <Typography variant="h6" color="text.secondary">
                  USD
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  One-time payment
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

            {/* Country Selector */}
            <Box sx={{ px: 4, pb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom align="center">
                Select your country for localized payment:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[
                  { code: 'NG', name: '🇳🇬 Nigeria', currency: 'NGN' },
                  { code: 'GH', name: '🇬🇭 Ghana', currency: 'GHS' },
                  { code: 'KE', name: '🇰🇪 Kenya', currency: 'KES' },
                  { code: 'ZA', name: '🇿🇦 South Africa', currency: 'ZAR' }
                ].map((country) => (
                  <Button
                    key={country.code}
                    variant={selectedCountry === country.code ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => setSelectedCountry(country.code)}
                    sx={{ minWidth: 'auto', px: 2, fontSize: '0.8rem' }}
                  >
                    {country.name} ({country.currency})
                  </Button>
                ))}
              </Box>
            </Box>

            <CardActions sx={{ p: 4, pt: 0 }}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleSubscribe}
                disabled={paymentLoading}
                startIcon={paymentLoading ? <CircularProgress size={20} /> : <Payment />}
                sx={{
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}
              >
                {paymentLoading ? 'Processing...' : 'Subscribe Now'}
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 8, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Why Subscribe to Hkup?
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
          {paymentData && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Subscription: Basic Access
              </Typography>
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Amount: USD 20
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Country: {selectedCountry === 'NG' ? '🇳🇬 Nigeria' : 
                         selectedCountry === 'GH' ? '🇬🇭 Ghana' : 
                         selectedCountry === 'KE' ? '🇰🇪 Kenya' : 
                         selectedCountry === 'ZA' ? '🇿🇦 South Africa' : selectedCountry}
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
