import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  Card,
  CardContent
} from '@mui/material';
import { CheckCircle, Star } from '@mui/icons-material';
import { toast } from 'react-toastify';
import { setSubscriptionStatus } from '../store/slices/authSlice';
import subscriptionAPI from '../services/subscriptionAPI';

const SubscriptionSuccessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  
  const verified = searchParams.get('verified') === 'true';

  useEffect(() => {
    if (verified) {
      // Update Redux state to mark user as subscribed
      dispatch(setSubscriptionStatus(true));
      
      // Show success message
      toast.success('🎉 Subscription activated successfully! You now have full access to the platform.');
      
      // Check subscription status from backend to confirm
      const confirmSubscription = async () => {
        try {
          const statusResponse = await subscriptionAPI.checkStatus();
          if (statusResponse.success && statusResponse.isSubscribed) {
            console.log('✅ Subscription confirmed from backend');
            // Redux state already updated above
          } else {
            console.log('⚠️ Subscription not confirmed from backend');
          }
        } catch (error) {
          console.error('Error confirming subscription:', error);
        }
      };
      
      confirmSubscription();
    }
  }, [verified, dispatch]);

  const handleGoToDashboard = () => {
    navigate('/dashboard');
  };

  const handleBrowseServices = () => {
    navigate('/adult-services');
  };

  if (!verified) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 4 }}>
          Invalid subscription verification. Please contact support.
        </Alert>
        <Button variant="contained" onClick={() => navigate('/subscription')}>
          Go to Subscription Page
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Box textAlign="center" mb={6}>
        <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
        <Typography variant="h3" fontWeight="bold" color="success.main" gutterBottom>
          🎉 Subscription Successful!
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          Welcome to Zerohook Premium!
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Your subscription has been activated and you now have full access to all platform features.
        </Typography>
      </Box>

      <Card elevation={4} sx={{ mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            ✅ What's Now Available:
          </Typography>
          <Box component="ul" sx={{ mt: 2, pl: 2 }}>
            {[
              'Full access to browse all services',
              'Create and manage your own services',
              'Secure messaging with other users',
              'Access to trust and reputation system',
              'Premium customer support',
              'Advanced search and filtering'
            ].map((feature, index) => (
              <Typography key={index} component="li" variant="body1" sx={{ mb: 1 }}>
                {feature}
              </Typography>
            ))}
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleGoToDashboard}
          startIcon={<Star />}
          sx={{ px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold' }}
        >
          Go to Dashboard
        </Button>
        <Button
          variant="outlined"
          size="large"
          onClick={handleBrowseServices}
          sx={{ px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold' }}
        >
          Browse Services
        </Button>
      </Box>

      <Box sx={{ mt: 6, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Thank you for choosing Zerohook! Your subscription is now active.
        </Typography>
      </Box>
    </Container>
  );
};

export default SubscriptionSuccessPage;

