/**
 * PaystackInlinePayment - Inline Popup Payment Component
 * 
 * Uses Paystack's Popup/Inline JS to display payment form as a modal overlay
 * on your site instead of redirecting to Paystack's hosted page.
 * 
 * Automatically detects user's country and shows appropriate payment channels:
 * - Nigeria: Card, Bank Transfer, USSD
 * - Ghana: Card, Mobile Money (MTN, Telecel, ATMoney)
 * - Kenya: Card, M-PESA, Pesalink
 * - South Africa: Card, EFT (Ozow), QR Code (SnapScan)
 * 
 * @example
 * <PaystackInlinePayment
 *   amount={5000}
 *   email="user@example.com"
 *   onSuccess={(response) => console.log('Payment successful', response)}
 *   onClose={() => console.log('Payment closed')}
 * />
 */

import React, { useState, useCallback } from 'react';
import PaystackPop from '@paystack/inline-js';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Divider,
} from '@mui/material';
import {
  CreditCard as CardIcon,
  PhoneAndroid as MobileIcon,
  AccountBalance as BankIcon,
  QrCode2 as QRIcon,
  Close as CloseIcon,
  Lock as LockIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import apiClient from '../../services/apiClient';
import useCurrency from '../../hooks/useCurrency';

// Payment channel configurations by country
const PAYMENT_CHANNELS_BY_COUNTRY = {
  NG: {
    name: 'Nigeria',
    channels: ['card', 'bank', 'ussd', 'bank_transfer'],
    displayChannels: [
      { id: 'card', name: 'Card', icon: CardIcon, description: 'Pay with Visa, Mastercard, or Verve' },
      { id: 'bank', name: 'Pay with Bank', icon: BankIcon, description: 'Pay directly from your bank account' },
      { id: 'ussd', name: 'USSD', icon: MobileIcon, description: 'Pay using USSD code on your phone' },
      { id: 'bank_transfer', name: 'Bank Transfer', icon: BankIcon, description: 'Transfer to a generated account' },
    ]
  },
  GH: {
    name: 'Ghana',
    channels: ['card', 'mobile_money'],
    displayChannels: [
      { id: 'card', name: 'Card', icon: CardIcon, description: 'Pay with Visa or Mastercard' },
      { id: 'mobile_money', name: 'Mobile Money', icon: MobileIcon, description: 'MTN, Telecel, or ATMoney' },
    ]
  },
  KE: {
    name: 'Kenya',
    channels: ['card', 'mobile_money'],
    displayChannels: [
      { id: 'card', name: 'Card', icon: CardIcon, description: 'Pay with Visa or Mastercard' },
      { id: 'mobile_money', name: 'M-PESA', icon: MobileIcon, description: 'Pay via M-PESA or Airtel Money' },
    ]
  },
  ZA: {
    name: 'South Africa',
    channels: ['card', 'eft', 'qr'],
    displayChannels: [
      { id: 'card', name: 'Card', icon: CardIcon, description: 'Pay with Visa, Mastercard, or Amex' },
      { id: 'eft', name: 'EFT / Ozow', icon: BankIcon, description: 'Instant bank transfer via Ozow' },
      { id: 'qr', name: 'QR Code', icon: QRIcon, description: 'Scan with SnapScan or banking app' },
    ]
  },
  // Default for other countries
  DEFAULT: {
    name: 'International',
    channels: ['card'],
    displayChannels: [
      { id: 'card', name: 'Card', icon: CardIcon, description: 'Pay with Visa or Mastercard' },
    ]
  }
};

/**
 * Get payment channels for a specific country
 */
const getPaymentChannelsForCountry = (countryCode) => {
  return PAYMENT_CHANNELS_BY_COUNTRY[countryCode] || PAYMENT_CHANNELS_BY_COUNTRY.DEFAULT;
};

/**
 * PaystackInlinePayment Component
 */
const PaystackInlinePayment = ({
  // Required props
  amount,
  email,
  
  // Optional configuration
  reference,
  metadata = {},
  channels, // Override channels if needed
  
  // Callbacks
  onSuccess,
  onClose,
  onError,
  
  // UI customization
  buttonText = 'Pay Now',
  buttonVariant = 'contained',
  buttonFullWidth = true,
  showChannelSelector = false,
  disabled = false,
  
  // For controlled mode (use accessCode from backend)
  accessCode,
  useAccessCode = false,
}) => {
  const { symbol, currencyCode, countryCode } = useCurrency();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [showChannelDialog, setShowChannelDialog] = useState(false);
  
  // Get available channels for user's country
  const countryChannels = getPaymentChannelsForCountry(countryCode);
  const availableChannels = channels || countryChannels.channels;
  
  // Get Paystack public key from environment or config
  const publicKey = process.env.REACT_APP_PAYSTACK_PUBLIC_KEY;

  /**
   * Initialize payment via backend and get access_code
   */
  const initializePayment = useCallback(async () => {
    try {
      const response = await apiClient.post('/payments/paystack/inline-initialize', {
        amount,
        email,
        reference,
        metadata: {
          ...metadata,
          countryCode,
          currencyCode,
        },
        channels: availableChannels,
      });

      return response.data;
    } catch (err) {
      console.error('Payment initialization error:', err);
      throw err;
    }
  }, [amount, email, reference, metadata, countryCode, currencyCode, availableChannels]);

  /**
   * Launch Paystack Popup with access_code
   */
  const launchPaystackPopup = useCallback(async (accessCodeToUse) => {
    try {
      const popup = new PaystackPop();
      
      popup.resumeTransaction(accessCodeToUse, {
        onSuccess: (response) => {
          console.log('Payment successful:', response);
          setLoading(false);
          onSuccess?.(response);
        },
        onCancel: () => {
          console.log('Payment cancelled');
          setLoading(false);
          onClose?.();
        },
        onError: (error) => {
          console.error('Payment error:', error);
          setLoading(false);
          setError(error.message || 'Payment failed');
          onError?.(error);
        }
      });
    } catch (err) {
      console.error('Failed to launch Paystack popup:', err);
      setLoading(false);
      setError('Failed to open payment window');
      onError?.(err);
    }
  }, [onSuccess, onClose, onError]);

  /**
   * Alternative: Launch with newTransaction (requires public key)
   */
  const launchWithNewTransaction = useCallback(async () => {
    if (!publicKey) {
      setError('Paystack public key not configured');
      return;
    }

    try {
      const popup = new PaystackPop();
      
      popup.newTransaction({
        key: publicKey,
        email,
        amount: Math.round(amount * 100), // Convert to smallest currency unit
        currency: currencyCode,
        ref: reference || `PS_${Date.now()}`,
        channels: availableChannels,
        metadata: {
          ...metadata,
          countryCode,
        },
        onSuccess: (response) => {
          console.log('Payment successful:', response);
          setLoading(false);
          onSuccess?.(response);
        },
        onCancel: () => {
          console.log('Payment cancelled');
          setLoading(false);
          onClose?.();
        },
      });
    } catch (err) {
      console.error('Failed to launch Paystack popup:', err);
      setLoading(false);
      setError('Failed to open payment window');
      onError?.(err);
    }
  }, [publicKey, email, amount, currencyCode, reference, availableChannels, metadata, countryCode, onSuccess, onClose, onError]);

  /**
   * Handle payment button click
   */
  const handlePayment = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (useAccessCode && accessCode) {
        // Use provided access code
        await launchPaystackPopup(accessCode);
      } else {
        // Initialize from backend and get access code
        const paymentData = await initializePayment();
        
        if (paymentData.accessCode) {
          await launchPaystackPopup(paymentData.accessCode);
        } else if (paymentData.access_code) {
          await launchPaystackPopup(paymentData.access_code);
        } else {
          // Fallback to newTransaction if no access code
          await launchWithNewTransaction();
        }
      }
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Payment failed');
      onError?.(err);
    }
  }, [useAccessCode, accessCode, initializePayment, launchPaystackPopup, launchWithNewTransaction, onError]);

  /**
   * Handle channel selection (if showChannelSelector is true)
   */
  const handleChannelSelect = (channelId) => {
    setSelectedChannel(channelId);
    setShowChannelDialog(false);
    // Could modify available channels based on selection
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Channel Selector (optional) */}
      {showChannelSelector && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
            Available payment methods in {countryChannels.name}:
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {countryChannels.displayChannels.map((channel) => {
              const IconComponent = channel.icon;
              return (
                <Chip
                  key={channel.id}
                  icon={<IconComponent sx={{ fontSize: 16 }} />}
                  label={channel.name}
                  variant={selectedChannel === channel.id ? 'filled' : 'outlined'}
                  onClick={() => handleChannelSelect(channel.id)}
                  sx={{ 
                    borderColor: selectedChannel === channel.id ? 'primary.main' : 'divider',
                    bgcolor: selectedChannel === channel.id ? 'primary.main' : 'transparent',
                    color: selectedChannel === channel.id ? 'white' : 'text.primary',
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}

      {/* Payment Button */}
      <Button
        variant={buttonVariant}
        fullWidth={buttonFullWidth}
        onClick={handlePayment}
        disabled={disabled || loading}
        sx={{
          py: 1.5,
          bgcolor: '#00C853',
          '&:hover': { bgcolor: '#00A843' },
          '&:disabled': { bgcolor: 'rgba(0, 200, 83, 0.5)' },
        }}
        startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <LockIcon />}
      >
        {loading ? 'Processing...' : `${buttonText} ${symbol}${amount?.toLocaleString() || 0}`}
      </Button>

      {/* Security badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 1, gap: 0.5 }}>
        <LockIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
        <Typography variant="caption" color="text.disabled">
          Secured by Paystack
        </Typography>
      </Box>

      {/* Channel Info Dialog */}
      <Dialog open={showChannelDialog} onClose={() => setShowChannelDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Select Payment Method
          <IconButton
            onClick={() => setShowChannelDialog(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {countryChannels.displayChannels.map((channel, index) => {
            const IconComponent = channel.icon;
            return (
              <Box key={channel.id}>
                <Box
                  onClick={() => handleChannelSelect(channel.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 2,
                    cursor: 'pointer',
                    borderRadius: 2,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <IconComponent sx={{ mr: 2, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="subtitle2">{channel.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {channel.description}
                    </Typography>
                  </Box>
                </Box>
                {index < countryChannels.displayChannels.length - 1 && <Divider />}
              </Box>
            );
          })}
        </DialogContent>
      </Dialog>
    </Box>
  );
};

/**
 * PaymentChannelInfo - Display available payment channels for user's country
 */
export const PaymentChannelInfo = ({ countryCode }) => {
  const channels = getPaymentChannelsForCountry(countryCode || 'NG');
  
  return (
    <Box sx={{ 
      p: 2, 
      bgcolor: 'rgba(0, 200, 83, 0.1)', 
      borderRadius: 2,
      border: '1px solid rgba(0, 200, 83, 0.2)'
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <InfoIcon sx={{ fontSize: 18, color: '#00C853', mr: 1 }} />
        <Typography variant="subtitle2" sx={{ color: '#00C853' }}>
          Payment options in {channels.name}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {channels.displayChannels.map((channel) => {
          const IconComponent = channel.icon;
          return (
            <Chip
              key={channel.id}
              size="small"
              icon={<IconComponent sx={{ fontSize: 14 }} />}
              label={channel.name}
              variant="outlined"
              sx={{ borderColor: 'rgba(0, 200, 83, 0.3)', color: 'text.secondary' }}
            />
          );
        })}
      </Box>
    </Box>
  );
};

/**
 * Hook to use Paystack inline payment programmatically
 */
export const usePaystackInline = () => {
  const { currencyCode, countryCode, symbol } = useCurrency();
  
  const pay = useCallback(async ({
    amount,
    email,
    accessCode,
    reference,
    metadata,
    channels,
    onSuccess,
    onClose,
    onError,
  }) => {
    try {
      const popup = new PaystackPop();
      
      if (accessCode) {
        popup.resumeTransaction(accessCode, {
          onSuccess,
          onCancel: onClose,
          onError,
        });
      } else {
        // Initialize from backend first
        const { default: apiClientModule } = await import('../../services/apiClient');
        const response = await apiClientModule.post('/payments/paystack/inline-initialize', {
          amount,
          email,
          reference,
          metadata: { ...metadata, countryCode, currencyCode },
          channels: channels || getPaymentChannelsForCountry(countryCode).channels,
        });

        const data = response.data;
        
        if (data.accessCode || data.access_code) {
          popup.resumeTransaction(data.accessCode || data.access_code, {
            onSuccess,
            onCancel: onClose,
            onError,
          });
        } else {
          throw new Error('Failed to get payment access code');
        }
      }
    } catch (err) {
      console.error('Payment error:', err);
      onError?.(err);
    }
  }, [currencyCode, countryCode]);

  return {
    pay,
    currencyCode,
    countryCode,
    symbol,
    getChannels: () => getPaymentChannelsForCountry(countryCode),
  };
};

export default PaystackInlinePayment;
