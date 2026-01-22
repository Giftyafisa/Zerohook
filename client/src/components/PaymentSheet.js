import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  RadioGroup,
  Radio,
  FormControlLabel,
  CircularProgress,
  Drawer,
  IconButton,
  Alert,
  Chip
} from '@mui/material';
import {
  Close as CloseIcon,
  Lock as LockIcon,
  CreditCard as CardIcon,
  AccountBalanceWallet as WalletIcon,
  CheckCircle as CheckIcon,
  PhoneAndroid as MobileIcon,
  AccountBalance as BankIcon
} from '@mui/icons-material';
import PaystackPop from '@paystack/inline-js';
import { API_BASE_URL } from '../config/constants';
import useCurrency from '../hooks/useCurrency';

// Country-specific payment channels
const PAYMENT_CHANNELS_BY_COUNTRY = {
  NG: { channels: ['card', 'bank', 'ussd', 'bank_transfer'], name: 'Nigeria' },
  GH: { channels: ['card', 'mobile_money'], name: 'Ghana' },
  KE: { channels: ['card', 'mobile_money'], name: 'Kenya' },
  ZA: { channels: ['card', 'eft', 'qr'], name: 'South Africa' },
  DEFAULT: { channels: ['card'], name: 'International' }
};

const CHANNEL_NAMES = {
  card: 'Card',
  bank: 'Bank',
  ussd: 'USSD',
  bank_transfer: 'Transfer',
  mobile_money: 'Mobile Money',
  eft: 'EFT',
  qr: 'QR'
};

/**
 * PaymentSheet - Simple bottom drawer for holding money (escrow)
 * Uses simple labels: "Hold Money", "Release", "Problem"
 * Mobile-first design for easy one-hand use
 * 
 * CURRENCY: Automatically uses user's detected country currency
 */
const PaymentSheet = ({ 
  open, 
  onClose, 
  providerId,
  providerName,
  suggestedAmount = '',
  conversationId,
  onSuccess 
}) => {
  // Get user's currency based on detected country
  const { symbol, currencyCode, countryCode } = useCurrency();
  
  const [amount, setAmount] = useState(suggestedAmount);
  const [payMethod, setPayMethod] = useState('paystack');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Get country-specific payment channels
  const countryData = PAYMENT_CHANNELS_BY_COUNTRY[countryCode] || PAYMENT_CHANNELS_BY_COUNTRY.DEFAULT;
  
  // Quick amount buttons - adjusted based on currency
  // These are local currency amounts (not USD)
  const quickAmounts = useMemo(() => {
    // Adjust quick amounts based on country
    switch (countryCode) {
      case 'GH':
        return [50, 100, 200, 500]; // Ghana Cedis
      case 'KE':
        return [1000, 2000, 5000, 10000]; // Kenya Shillings
      case 'ZA':
        return [100, 200, 500, 1000]; // South African Rand
      case 'NG':
      default:
        return [5000, 10000, 20000, 50000]; // Nigerian Naira
    }
  }, [countryCode]);

  const handleHoldMoney = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter an amount');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_BASE_URL}/escrow/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          providerId,
          amount: parseFloat(amount),
          currency: currencyCode,
          paymentMethod: payMethod,
          conversationId,
          channels: countryData.channels,
          description: `Payment to ${providerName}`
        })
      });

      const data = await response.json();

      if (response.ok) {
        // If Paystack payment with access_code, use inline popup
        const accessCode = data.accessCode || data.access_code;
        
        if (payMethod === 'paystack' && accessCode) {
          try {
            const popup = new PaystackPop();
            await popup.resumeTransaction(accessCode, {
              onSuccess: (transaction) => {
                console.log('Payment successful:', transaction);
                setSuccess(true);
                setTimeout(() => {
                  onSuccess && onSuccess({
                    escrowId: data.transaction?.id || data.escrowId,
                    amount: parseFloat(amount),
                    currency: currencyCode,
                    symbol: symbol,
                    status: 'held',
                    reference: transaction.reference
                  });
                  onClose();
                }, 1500);
              },
              onCancel: () => {
                console.log('Payment cancelled');
                setLoading(false);
              },
              onError: (error) => {
                console.error('Payment error:', error);
                setError('Payment failed. Please try again.');
                setLoading(false);
              }
            });
            return; // Popup handles the flow
          } catch (popupError) {
            console.error('Popup failed:', popupError);
            // Continue with standard success flow
          }
        }

        // Standard success flow (wallet payment or popup fallback)
        setSuccess(true);
        setTimeout(() => {
          onSuccess && onSuccess({
            escrowId: data.transaction?.id || data.escrowId,
            amount: parseFloat(amount),
            currency: currencyCode,
            symbol: symbol,
            status: 'held'
          });
          onClose();
        }, 1500);
      } else {
        setError(data.error || 'Failed to hold money. Please try again.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setAmount(suggestedAmount);
      setPayMethod('paystack');
      setError(null);
      setSuccess(false);
      onClose();
    }
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: '85vh',
          bgcolor: '#1a1a2e'
        }
      }}
    >
      <Box sx={styles.container}>
        {/* Handle bar */}
        <Box sx={styles.handleBar} />

        {/* Header */}
        <Box sx={styles.header}>
          <Box>
            <Typography sx={styles.title}>
              {success ? '✓ Money Held Safely' : 'Hold Money'}
            </Typography>
            <Typography sx={styles.subtitle}>
              {success 
                ? `${symbol}${parseFloat(amount).toLocaleString()} is held until you release it`
                : `Pay ${providerName} securely`
              }
            </Typography>
          </Box>
          <IconButton onClick={handleClose} sx={{ color: '#fff' }} disabled={loading}>
            <CloseIcon />
          </IconButton>
        </Box>

        {success ? (
          /* Success State */
          <Box sx={styles.successContainer}>
            <Box sx={styles.successIcon}>
              <CheckIcon sx={{ fontSize: 48, color: '#00ff88' }} />
            </Box>
            <Typography sx={styles.successText}>
              Your money is safe. It will only be released when you tap "Release".
            </Typography>
            <Chip 
              icon={<LockIcon />} 
              label="Money Held" 
              sx={styles.heldChip}
            />
          </Box>
        ) : (
          /* Payment Form */
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {error}
              </Alert>
            )}

            {/* Amount Input */}
            <Box sx={styles.section}>
              <Typography sx={styles.label}>Amount ({symbol})</Typography>
              <TextField
                fullWidth
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                InputProps={{
                  startAdornment: <Typography sx={{ color: '#888', mr: 1 }}>{symbol}</Typography>,
                  sx: styles.input
                }}
              />
              
              {/* Quick amount buttons */}
              <Box sx={styles.quickAmounts}>
                {quickAmounts.map((amt) => (
                  <Button
                    key={amt}
                    variant={amount === String(amt) ? 'contained' : 'outlined'}
                    size="small"
                    onClick={() => setAmount(String(amt))}
                    sx={styles.quickBtn}
                  >
                    {symbol}{amt.toLocaleString()}
                  </Button>
                ))}
              </Box>
            </Box>

            {/* Payment Method */}
            <Box sx={styles.section}>
              <Typography sx={styles.label}>How to pay</Typography>
              <RadioGroup
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
              >
                <Box sx={styles.payOption(payMethod === 'paystack')}>
                  <FormControlLabel
                    value="paystack"
                    control={<Radio sx={{ color: '#00f2ea', '&.Mui-checked': { color: '#00f2ea' } }} />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CardIcon sx={{ color: '#00f2ea' }} />
                        <Box>
                          <Typography sx={{ fontWeight: 500 }}>{countryData.name} Payment</Typography>
                          <Typography sx={{ fontSize: 12, color: '#888' }}>
                            {countryData.channels.map(c => CHANNEL_NAMES[c]).join(' • ')}
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                </Box>
                
                <Box sx={styles.payOption(payMethod === 'wallet')}>
                  <FormControlLabel
                    value="wallet"
                    control={<Radio sx={{ color: '#00f2ea', '&.Mui-checked': { color: '#00f2ea' } }} />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <WalletIcon sx={{ color: '#00ff88' }} />
                        <Box>
                          <Typography sx={{ fontWeight: 500 }}>Wallet</Typography>
                          <Typography sx={{ fontSize: 12, color: '#888' }}>Use your Zerohook balance</Typography>
                        </Box>
                      </Box>
                    }
                  />
                </Box>
              </RadioGroup>
            </Box>

            {/* Security Note */}
            <Box sx={styles.securityNote}>
              <LockIcon sx={{ fontSize: 16, color: '#00ff88' }} />
              <Typography sx={{ fontSize: 12, color: '#aaa' }}>
                Money is held safely. Only released when you confirm.
              </Typography>
            </Box>

            {/* Submit Button */}
            <Button
              fullWidth
              variant="contained"
              onClick={handleHoldMoney}
              disabled={loading || !amount}
              sx={styles.submitBtn}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: '#fff' }} />
              ) : (
                <>Hold {symbol}{amount ? parseFloat(amount).toLocaleString() : '0'}</>
              )}
            </Button>
          </>
        )}
      </Box>
    </Drawer>
  );
};

const styles = {
  container: {
    p: 3,
    pb: 4
  },
  handleBar: {
    width: 40,
    height: 4,
    bgcolor: '#444',
    borderRadius: 2,
    mx: 'auto',
    mb: 2
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    mb: 3
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    color: '#fff'
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    mt: 0.5
  },
  section: {
    mb: 3
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: '#fff',
    mb: 1
  },
  input: {
    bgcolor: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    color: '#fff',
    fontSize: 18,
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: '#333'
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: '#00f2ea'
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: '#00f2ea'
    }
  },
  quickAmounts: {
    display: 'flex',
    gap: 1,
    mt: 1.5,
    flexWrap: 'wrap'
  },
  quickBtn: {
    fontSize: 12,
    borderRadius: 2,
    borderColor: '#333',
    color: '#fff',
    '&.MuiButton-contained': {
      bgcolor: '#00f2ea',
      color: '#000'
    }
  },
  payOption: (selected) => ({
    p: 1.5,
    borderRadius: 2,
    border: selected ? '2px solid #00f2ea' : '1px solid #333',
    bgcolor: selected ? 'rgba(0,242,234,0.1)' : 'transparent',
    mb: 1,
    transition: 'all 0.2s'
  }),
  securityNote: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    p: 1.5,
    bgcolor: 'rgba(0,255,136,0.1)',
    borderRadius: 2,
    mb: 3
  },
  submitBtn: {
    py: 1.5,
    fontSize: 16,
    fontWeight: 700,
    borderRadius: 3,
    bgcolor: '#00f2ea',
    color: '#000',
    '&:hover': {
      bgcolor: '#00d4ce'
    },
    '&:disabled': {
      bgcolor: '#333',
      color: '#666'
    }
  },
  successContainer: {
    textAlign: 'center',
    py: 4
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    bgcolor: 'rgba(0,255,136,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    mx: 'auto',
    mb: 2
  },
  successText: {
    fontSize: 14,
    color: '#aaa',
    mb: 2
  },
  heldChip: {
    bgcolor: 'rgba(0,255,136,0.2)',
    color: '#00ff88',
    fontWeight: 600,
    '& .MuiChip-icon': {
      color: '#00ff88'
    }
  }
};

export default PaymentSheet;
