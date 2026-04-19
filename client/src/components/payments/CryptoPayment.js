/**
 * CryptoPayment - Crypto-Only Payment Component
 * 
 * Displays crypto payment details (address, QR, amount) for users to complete
 * blockchain payments. Polls for confirmation status.
 * 
 * Replaces the old PaystackInlinePayment component.
 * 
 * @example
 * <CryptoPayment
 *   paymentData={{ reference, address, cryptoAmount, cryptoSymbol, network, qrData, expiresAt, fiatAmount, fiatCurrency }}
 *   onSuccess={(data) => console.log('Payment confirmed', data)}
 *   onClose={() => console.log('Payment closed')}
 * />
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Divider,
  Chip,
  TextField,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  CheckCircle as CheckIcon,
  Timer as TimerIcon,
  QrCode2 as QRIcon,
  CurrencyBitcoin as CryptoIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import apiClient from '../../services/apiClient';

const CRYPTO_LOGOS = {
  BTC: '₿',
  ETH: 'Ξ',
  USDT: '₮',
  USDC: '💵',
  BNB: '🟡',
  SOL: '◎',
  LTC: 'Ł',
};

const POLL_INTERVAL = 10000; // 10 seconds
const MAX_POLL_DURATION = 30 * 60 * 1000; // 30 minutes

const CryptoPayment = ({
  paymentData,
  onSuccess,
  onClose,
  open = true,
  title = 'Complete Crypto Payment',
  verifyEndpoint = '/payments/verify-inline',
  verifyPayloadBuilder,
}) => {
  const [status, setStatus] = useState('pending'); // pending, checking, confirmed, failed, expired
  const [copied, setCopied] = useState(null); // 'address' | 'amount' | null
  const [timeLeft, setTimeLeft] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const paymentDataRef = useRef(paymentData);

  useEffect(() => {
    paymentDataRef.current = paymentData;
  }, [paymentData]);

  // Copy to clipboard
  const handleCopy = useCallback(async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    }
  }, []);

  // Poll for payment confirmation
  const checkPayment = useCallback(async () => {
    const currentPaymentData = paymentDataRef.current;
    if (!currentPaymentData?.reference) return;
    
    try {
      setStatus('checking');

      const payload = verifyPayloadBuilder
        ? verifyPayloadBuilder(currentPaymentData)
        : { reference: currentPaymentData.reference };

      const response = await apiClient.post(verifyEndpoint, payload);
      const data = response.data;

      if (data?.status === 'expired') {
        setStatus('expired');
        setError(data?.error || data?.message || 'Invoice has expired. Create a new deposit invoice.');
        return false;
      }
      
      const isConfirmedStatus = data?.status === 'confirmed' || data?.status === 'already_verified';
      const isImplicitSuccess = data?.success && !data?.status;
      const isSubscriptionSuccess = data?.isSubscribed === true;

      if (data?.success && (isConfirmedStatus || isImplicitSuccess || isSubscriptionSuccess)) {
        setStatus('confirmed');
        setError(null);
        onSuccess?.(data);
        return true;
      } else {
        setStatus('pending');
        return false;
      }
    } catch (err) {
      console.error('Payment check error:', err);
      if (err.response?.status === 401) {
        setStatus('failed');
        setError('Authentication failed. Please login again.');
      } else {
        setStatus('failed');
        setError('Could not verify payment right now. Please try again.');
      }
      return false;
    }
  }, [onSuccess, verifyEndpoint, verifyPayloadBuilder]);

  // Auto-poll for confirmation
  useEffect(() => {
    if (!paymentData?.reference || status === 'confirmed' || status === 'expired') return;

    const poll = async () => {
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed > MAX_POLL_DURATION) {
        setStatus('expired');
        setError('Payment check timed out. If you sent the payment, it may still be confirmed. Check back later.');
        return;
      }
      
      const confirmed = await checkPayment();
      if (!confirmed) {
        pollRef.current = setTimeout(poll, POLL_INTERVAL);
      }
    };

    pollRef.current = setTimeout(poll, POLL_INTERVAL);

    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, [paymentData?.reference, status, checkPayment]);

  // Countdown timer
  useEffect(() => {
    if (!paymentData?.expiresAt) return;
    
    const updateTimer = () => {
      const now = Date.now();
      const expiry = new Date(paymentData.expiresAt).getTime();
      const remaining = Math.max(0, expiry - now);
      
      if (remaining <= 0) {
        setTimeLeft('Expired');
        setStatus('expired');
        return;
      }
      
      const minutes = Math.floor(remaining / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      setTimeLeft(`${minutes}:${String(seconds).padStart(2, '0')}`);
    };
    
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [paymentData?.expiresAt]);

  if (!paymentData) return null;

  const { reference, address: rawAddress, walletAddress, cryptoAmount, cryptoSymbol, network, fiatAmount, fiatCurrency, rate } = paymentData;
  const address = rawAddress || walletAddress; // Support both field names from different callers
  const logo = CRYPTO_LOGOS[cryptoSymbol] || '🪙';

  return (
    <Dialog
      open={open}
      onClose={status === 'confirmed' ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#0a0a0f',
          color: '#fff',
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.1)',
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CryptoIcon sx={{ color: '#00f2ea' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
        </Box>
        {onClose && status !== 'confirmed' && (
          <IconButton onClick={onClose} sx={{ color: 'rgba(255,255,255,0.5)' }}>
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent>
        {/* Status Banner */}
        {status === 'confirmed' && (
          <Alert
            severity="success"
            icon={<CheckIcon />}
            sx={{ mb: 2, bgcolor: 'rgba(0, 255, 136, 0.1)', color: '#00ff88', border: '1px solid rgba(0, 255, 136, 0.3)' }}
          >
            Payment confirmed on blockchain!
          </Alert>
        )}
        {error && (
          <Alert severity="warning" sx={{ mb: 2, bgcolor: 'rgba(255, 165, 0, 0.1)', color: '#ffa500' }}>
            {error}
          </Alert>
        )}
        {(status === 'expired' || status === 'failed') && (
          <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(0, 242, 234, 0.1)', color: '#00f2ea', fontSize: '0.85rem' }}>
            If you already sent crypto to the address above, don't worry — your deposit is recorded and will be confirmed by an admin within 24 hours. You'll receive a notification once it's credited.
          </Alert>
        )}

        {/* Timer */}
        {timeLeft && status !== 'confirmed' && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
            <TimerIcon sx={{ color: timeLeft === 'Expired' ? '#ff5555' : '#ffa500', fontSize: 20 }} />
            <Typography sx={{ color: timeLeft === 'Expired' ? '#ff5555' : '#ffa500', fontWeight: 600 }}>
              {timeLeft === 'Expired' ? 'Invoice Expired' : `Expires in ${timeLeft}`}
            </Typography>
          </Box>
        )}

        {/* Crypto Amount */}
        <Box sx={{
          textAlign: 'center',
          py: 3,
          mb: 2,
          borderRadius: 3,
          background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.08), rgba(255, 0, 212, 0.08))',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', mb: 0.5 }}>
            Send exactly
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: '2rem', lineHeight: 1 }}>{logo}</Typography>
            <Typography sx={{ fontSize: '2rem', fontWeight: 800, color: '#fff' }}>
              {cryptoAmount}
            </Typography>
            <Typography sx={{ fontSize: '1.2rem', fontWeight: 600, color: '#00f2ea' }}>
              {cryptoSymbol}
            </Typography>
            <Tooltip title="Copy amount">
              <IconButton
                onClick={() => handleCopy(String(cryptoAmount), 'amount')}
                size="small"
                sx={{ color: copied === 'amount' ? '#00ff88' : 'rgba(255,255,255,0.4)' }}
              >
                {copied === 'amount' ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Box>
          {fiatAmount && fiatCurrency && (
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', mt: 1 }}>
              ≈ {fiatCurrency} {Number(fiatAmount).toLocaleString()}
              {rate && ` • Rate: 1 ${cryptoSymbol} = ${fiatCurrency} ${Number(rate).toLocaleString()}`}
            </Typography>
          )}
        </Box>

        {/* Network */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Chip
            label={`Network: ${network || cryptoSymbol}`}
            sx={{
              bgcolor: 'rgba(0, 242, 234, 0.15)',
              color: '#00f2ea',
              fontWeight: 600,
              fontSize: '0.8rem',
            }}
          />
        </Box>

        {/* Wallet Address */}
        <Box sx={{ mb: 2 }}>
          <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem', mb: 1 }}>
            Send to this address:
          </Typography>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <TextField
              value={address || ''}
              fullWidth
              size="small"
              InputProps={{
                readOnly: true,
                sx: {
                  color: '#fff',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                },
              }}
            />
            <Tooltip title={copied === 'address' ? 'Copied!' : 'Copy address'}>
              <IconButton
                onClick={() => handleCopy(address, 'address')}
                sx={{ color: copied === 'address' ? '#00ff88' : '#00f2ea' }}
              >
                {copied === 'address' ? <CheckIcon /> : <CopyIcon />}
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* QR Code Placeholder */}
        {paymentData.qrData && (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Box sx={{
              display: 'inline-flex',
              p: 2,
              borderRadius: 2,
              bgcolor: '#fff',
              mb: 1,
            }}>
              <QRIcon sx={{ fontSize: 120, color: '#000' }} />
            </Box>
            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
              Scan QR code with your wallet app
            </Typography>
          </Box>
        )}

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', my: 2 }} />

        {/* Status */}
        <Box sx={{ textAlign: 'center' }}>
          {status === 'pending' && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
              <CircularProgress size={20} sx={{ color: '#ffa500' }} />
              <Typography sx={{ color: '#ffa500', fontWeight: 500 }}>
                Waiting for payment...
              </Typography>
            </Box>
          )}
          {status === 'checking' && (
            <Box>
              <LinearProgress sx={{ mb: 1, borderRadius: 2, bgcolor: 'rgba(0, 242, 234, 0.1)', '& .MuiLinearProgress-bar': { bgcolor: '#00f2ea' } }} />
              <Typography sx={{ color: '#00f2ea', fontWeight: 500 }}>
                Checking blockchain...
              </Typography>
            </Box>
          )}
          {status === 'confirmed' && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
              <CheckIcon sx={{ color: '#00ff88' }} />
              <Typography sx={{ color: '#00ff88', fontWeight: 700 }}>
                Payment Confirmed!
              </Typography>
            </Box>
          )}
        </Box>

        {/* Reference */}
        {reference && (
          <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem', textAlign: 'center', mt: 2 }}>
            Reference: {reference}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 0, justifyContent: 'space-between' }}>
        {status !== 'confirmed' && (
          <Button
            startIcon={<RefreshIcon />}
            onClick={checkPayment}
            disabled={status === 'checking'}
            sx={{ color: '#00f2ea', textTransform: 'none' }}
          >
            Check Now
          </Button>
        )}
        <Button
          onClick={onClose}
          variant={status === 'confirmed' ? 'contained' : 'outlined'}
          sx={status === 'confirmed' ? {
            bgcolor: '#00ff88',
            color: '#000',
            fontWeight: 700,
            '&:hover': { bgcolor: '#00dd77' },
          } : {
            color: 'rgba(255,255,255,0.5)',
            borderColor: 'rgba(255,255,255,0.2)',
          }}
        >
          {status === 'confirmed' ? 'Done' : 'Close'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CryptoPayment;
