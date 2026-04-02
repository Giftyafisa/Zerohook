import React, { useState, useMemo } from 'react';
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
  AccountBalanceWallet as WalletIcon,
  CheckCircle as CheckIcon,
  CurrencyBitcoin as CryptoIcon
} from '@mui/icons-material';
import apiClient from '../services/apiClient';
import useCurrency from '../hooks/useCurrency';
import CryptoPayment from './payments/CryptoPayment';

// Supported crypto symbols
const SUPPORTED_CRYPTOS = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'LTC'];

/**
 * PaymentSheet - Simple bottom drawer for holding money (escrow)
 * Uses crypto payments - fee-free direct blockchain transactions
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
  const [payMethod, setPayMethod] = useState('crypto');
  const [cryptoSymbol, setCryptoSymbol] = useState('USDT');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [cryptoPaymentData, setCryptoPaymentData] = useState(null);
  const [showCryptoPayment, setShowCryptoPayment] = useState(false);
  
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
      const response = await apiClient.post('/escrow/create', {
        providerId,
        amount: parseFloat(amount),
        currency: currencyCode,
        paymentMethod: payMethod === 'crypto' ? 'crypto' : 'wallet',
        cryptoSymbol: payMethod === 'crypto' ? cryptoSymbol : undefined,
        conversationId,
        description: `Payment to ${providerName}`
      });

      const data = response.data;

      if (payMethod === 'crypto' && data.walletAddress) {
          // Show crypto payment dialog
          setCryptoPaymentData({
            walletAddress: data.walletAddress,
            cryptoAmount: data.cryptoAmount,
            cryptoSymbol: data.cryptoSymbol || cryptoSymbol,
            reference: data.reference,
            expiresAt: data.expiresAt
          });
          setShowCryptoPayment(true);
          setLoading(false);
          return;
        }

        // Standard success flow (wallet payment)
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
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCryptoPaymentConfirmed = (paymentResult) => {
    setShowCryptoPayment(false);
    setCryptoPaymentData(null);
    setSuccess(true);
    setTimeout(() => {
      onSuccess && onSuccess({
        escrowId: paymentResult?.escrowId,
        amount: parseFloat(amount),
        currency: currencyCode,
        symbol: symbol,
        status: 'held'
      });
      onClose();
    }, 1500);
  };

  const handleClose = () => {
    if (!loading) {
      setAmount(suggestedAmount);
      setPayMethod('crypto');
      setCryptoSymbol('USDT');
      setError(null);
      setSuccess(false);
      setShowCryptoPayment(false);
      setCryptoPaymentData(null);
      onClose();
    }
  };

  return (
    <>
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
                <Box sx={styles.payOption(payMethod === 'crypto')}>
                  <FormControlLabel
                    value="crypto"
                    control={<Radio sx={{ color: '#00f2ea', '&.Mui-checked': { color: '#00f2ea' } }} />}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CryptoIcon sx={{ color: '#f7931a' }} />
                        <Box>
                          <Typography sx={{ fontWeight: 500 }}>Crypto (Fee-Free)</Typography>
                          <Typography sx={{ fontSize: 12, color: '#888' }}>
                            BTC • ETH • USDT • USDC • BNB • SOL • LTC
                          </Typography>
                        </Box>
                      </Box>
                    }
                  />
                  {payMethod === 'crypto' && (
                    <Box sx={{ pl: 4, pt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {SUPPORTED_CRYPTOS.map(sym => (
                        <Chip
                          key={sym}
                          label={sym}
                          size="small"
                          onClick={() => setCryptoSymbol(sym)}
                          sx={{
                            bgcolor: cryptoSymbol === sym ? 'rgba(0,242,234,0.2)' : 'rgba(255,255,255,0.05)',
                            color: cryptoSymbol === sym ? '#00f2ea' : '#aaa',
                            border: cryptoSymbol === sym ? '1px solid #00f2ea' : '1px solid #333',
                            cursor: 'pointer',
                            fontWeight: cryptoSymbol === sym ? 600 : 400
                          }}
                        />
                      ))}
                    </Box>
                  )}
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
    
    {/* Crypto Payment Dialog */}
    <CryptoPayment
      open={showCryptoPayment}
      onClose={() => { setShowCryptoPayment(false); setCryptoPaymentData(null); }}
      paymentData={cryptoPaymentData}
      onSuccess={handleCryptoPaymentConfirmed}
      title="Escrow Crypto Payment"
    />
    </>
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
