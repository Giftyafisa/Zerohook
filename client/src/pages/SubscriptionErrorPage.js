import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Alert,
  Card,
  CardContent
} from '@mui/material';
import { Error, Payment } from '@mui/icons-material';

const SubscriptionErrorPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const reason = searchParams.get('reason') || 'unknown';

  const getErrorMessage = (reason) => {
    switch (reason) {
      case 'verification_failed':
        return 'Payment verification failed. Please try again or contact support.';
      case 'server_error':
        return 'Server error occurred during payment processing. Please try again.';
      case 'payment_failed':
        return 'Payment was not completed successfully. Please try again.';
      default:
        return 'An error occurred during the subscription process. Please try again.';
    }
  };

  const getErrorTitle = (reason) => {
    switch (reason) {
      case 'verification_failed':
        return 'Payment Verification Failed';
      case 'server_error':
        return 'Server Error';
      case 'payment_failed':
        return 'Payment Failed';
      default:
        return 'Subscription Error';
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 8 }}>
      <Box textAlign="center" mb={6}>
        <Error sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
        <Typography variant="h3" fontWeight="bold" color="error.main" gutterBottom>
          ❌ {getErrorTitle(reason)}
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
          We encountered an issue with your subscription
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Don't worry, this is usually a temporary issue. Please try again or contact our support team.
        </Typography>
      </Box>

      <Card elevation={4} sx={{ mb: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            What Happened:
          </Typography>
          <Alert severity="error" sx={{ mb: 2 }}>
            {getErrorMessage(reason)}
          </Alert>
          
          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Possible Solutions:
          </Typography>
          <Box component="ul" sx={{ mt: 2, pl: 2 }}>
            {[
              'Check your internet connection',
              'Ensure your payment method is valid',
              'Try using a different browser',
              'Clear your browser cache and cookies',
              'Contact support if the issue persists'
            ].map((solution, index) => (
              <Typography key={index} component="li" variant="body1" sx={{ mb: 1 }}>
                {solution}
              </Typography>
            ))}
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate('/subscription')}
          startIcon={<Payment />}
          sx={{ px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold' }}
        >
          Try Again
        </Button>
        <Button
          variant="outlined"
          size="large"
          onClick={() => navigate('/')}
          sx={{ px: 4, py: 1.5, fontSize: '1.1rem', fontWeight: 'bold' }}
        >
          Go to Home
        </Button>
      </Box>

      <Box sx={{ mt: 6, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Need help? Contact our support team at support@zerohook.com
        </Typography>
      </Box>
    </Container>
  );
};

export default SubscriptionErrorPage;

