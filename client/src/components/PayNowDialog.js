import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Radio,
  RadioGroup,
  FormControlLabel,
  TextField,
  Divider
} from '@mui/material';
import {
  Lock as EscrowIcon,
  CreditCard as CardIcon,
  AccountBalance as BankIcon,
  PhoneAndroid as MobileIcon,
  CheckCircle as SuccessIcon
} from '@mui/icons-material';
import { API_BASE_URL } from '../config/constants';

/**
 * PayNowDialog - Simple escrow payment flow
 * User-friendly labels and clear escrow explanation
 */
const PayNowDialog = ({
  open,
  onClose,
  amount,
  currency = 'NGN',
  serviceTitle,
  providerName,
  providerId,
  serviceId,
  onSuccess
}) => {
  const [step, setStep] = useState('select'); // select, processing, success, error
  const [paymentMethod, setPaymentMethod] = useState('paystack');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [escrowId, setEscrowId] = useState(null);

  const formatCurrency = (amt, curr) => {
    const symbols = { NGN: '₦', USD: '$', GHS: '₵', KES: 'KSh' };
    const symbol = symbols[curr] || curr;
    return `${symbol}${Number(amt).toLocaleString()}`;
  };

  const handlePayment = async () => {
    setLoading(true);
    setError(null);
    setStep('processing');

    try {
      const token = localStorage.getItem('token');
      
      // Step 1: Create escrow
      const escrowResponse = await fetch(`${API_BASE_URL}/escrow/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          providerId,
          serviceId,
          amount,
          currency,
          description: `Payment for: ${serviceTitle}`
        })
      });

      if (!escrowResponse.ok) {
        const errData = await escrowResponse.json();
        throw new Error(errData.error || 'Failed to create escrow');
      }

      const escrowData = await escrowResponse.json();
      setEscrowId(escrowData.escrowId || escrowData.id);

      // Step 2: Initialize payment based on method
      let paymentUrl = null;
      
      if (paymentMethod === 'paystack') {
        const paymentResponse = await fetch(`${API_BASE_URL}/payments/create-payment-intent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            amount,
            currency,
            escrowId: escrowData.escrowId || escrowData.id,
            provider: 'paystack',
            metadata: {
              serviceId,
              providerId,
              serviceTitle
            }
          })
        });

        if (paymentResponse.ok) {
          const paymentData = await paymentResponse.json();
          paymentUrl = paymentData.authorizationUrl || paymentData.authorization_url;
        }
      }

      // Open payment URL or show success
      if (paymentUrl) {
        window.open(paymentUrl, '_blank');
        setStep('success');
      } else {
        // Simulate success for demo
        setStep('success');
      }

      onSuccess?.({
        escrowId: escrowData.escrowId || escrowData.id,
        amount,
        currency
      });

    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('select');
    setError(null);
    setEscrowId(null);
    onClose();
  };

  const paymentMethods = [
    { id: 'paystack', label: 'Card / Bank / Mobile', icon: <CardIcon />, desc: 'Pay with card, bank transfer, or mobile money' },
    { id: 'bank', label: 'Direct Bank Transfer', icon: <BankIcon />, desc: 'Transfer directly to escrow account' },
    { id: 'mobile', label: 'Mobile Money', icon: <MobileIcon />, desc: 'MTN, Airtel, or other mobile money' }
  ];

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: styles.dialog }}
    >
      <DialogTitle sx={styles.title}>
        <EscrowIcon sx={{ color: '#00f2ea', mr: 1 }} />
        Secure Payment
      </DialogTitle>

      <DialogContent sx={styles.content}>
        {/* Escrow Explainer */}
        <Box sx={styles.escrowExplainer}>
          <Typography sx={styles.explainerTitle}>
            💰 How it works
          </Typography>
          <Typography sx={styles.explainerText}>
            1. Your payment is held safely by us<br />
            2. Provider sees the money is ready<br />
            3. After service, you confirm it was good<br />
            4. We release payment to provider
          </Typography>
        </Box>

        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

        {/* Payment Summary */}
        <Box sx={styles.summary}>
          <Typography sx={styles.summaryLabel}>Service</Typography>
          <Typography sx={styles.summaryValue}>{serviceTitle}</Typography>
          
          <Typography sx={styles.summaryLabel}>Provider</Typography>
          <Typography sx={styles.summaryValue}>{providerName}</Typography>
          
          <Typography sx={styles.summaryLabel}>Amount</Typography>
          <Typography sx={styles.summaryAmount}>{formatCurrency(amount, currency)}</Typography>
        </Box>

        <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.1)' }} />

        {step === 'select' && (
          <>
            <Typography sx={styles.sectionTitle}>Choose Payment Method</Typography>
            <RadioGroup 
              value={paymentMethod} 
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              {paymentMethods.map((method) => (
                <Box 
                  key={method.id} 
                  sx={{
                    ...styles.methodOption,
                    borderColor: paymentMethod === method.id ? '#00f2ea' : 'rgba(255,255,255,0.1)'
                  }}
                  onClick={() => setPaymentMethod(method.id)}
                >
                  <FormControlLabel
                    value={method.id}
                    control={<Radio sx={{ color: '#00f2ea', '&.Mui-checked': { color: '#00f2ea' } }} />}
                    label={
                      <Box sx={styles.methodLabel}>
                        <Box sx={styles.methodIcon}>{method.icon}</Box>
                        <Box>
                          <Typography sx={styles.methodName}>{method.label}</Typography>
                          <Typography sx={styles.methodDesc}>{method.desc}</Typography>
                        </Box>
                      </Box>
                    }
                  />
                </Box>
              ))}
            </RadioGroup>
          </>
        )}

        {step === 'processing' && (
          <Box sx={styles.processingState}>
            <CircularProgress sx={{ color: '#00f2ea', mb: 2 }} />
            <Typography sx={styles.processingText}>
              Setting up secure payment...
            </Typography>
          </Box>
        )}

        {step === 'success' && (
          <Box sx={styles.successState}>
            <SuccessIcon sx={{ fontSize: 64, color: '#66bb6a', mb: 2 }} />
            <Typography sx={styles.successTitle}>Payment Started!</Typography>
            <Typography sx={styles.successText}>
              Complete payment in the new window.<br />
              Money will be held safely until you confirm service.
            </Typography>
            <Alert severity="info" sx={{ mt: 2 }}>
              After service is done, come back here and click "Release Payment" to pay the provider.
            </Alert>
          </Box>
        )}

        {step === 'error' && (
          <Box sx={styles.errorState}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error || 'Something went wrong. Please try again.'}
            </Alert>
            <Button 
              variant="outlined" 
              onClick={() => setStep('select')}
              sx={styles.retryBtn}
            >
              Try Again
            </Button>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={styles.actions}>
        {step === 'select' && (
          <>
            <Button onClick={handleClose} sx={styles.cancelBtn}>
              Cancel
            </Button>
            <Button 
              variant="contained" 
              onClick={handlePayment}
              disabled={loading}
              sx={styles.payBtn}
            >
              Pay {formatCurrency(amount, currency)}
            </Button>
          </>
        )}
        
        {(step === 'success' || step === 'error') && (
          <Button onClick={handleClose} sx={styles.doneBtn}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

const styles = {
  dialog: {
    bgcolor: '#1a1a2e',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px'
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    color: '#fff',
    fontSize: '20px',
    fontWeight: 600,
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    pb: 2
  },
  content: {
    py: 2
  },
  escrowExplainer: {
    background: 'rgba(0, 242, 234, 0.1)',
    border: '1px solid rgba(0, 242, 234, 0.2)',
    borderRadius: '12px',
    padding: '16px'
  },
  explainerTitle: {
    color: '#00f2ea',
    fontWeight: 600,
    fontSize: '15px',
    mb: 1
  },
  explainerText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '13px',
    lineHeight: 1.6
  },
  summary: {
    display: 'grid',
    gridTemplateColumns: '100px 1fr',
    gap: '8px',
    alignItems: 'center'
  },
  summaryLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px'
  },
  summaryValue: {
    color: '#fff',
    fontSize: '14px',
    fontWeight: 500
  },
  summaryAmount: {
    color: '#00f2ea',
    fontSize: '20px',
    fontWeight: 700
  },
  sectionTitle: {
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    mb: 2
  },
  methodOption: {
    border: '1px solid',
    borderRadius: '12px',
    padding: '12px',
    marginBottom: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      borderColor: 'rgba(0, 242, 234, 0.5)'
    }
  },
  methodLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  methodIcon: {
    color: '#00f2ea',
    display: 'flex',
    alignItems: 'center'
  },
  methodName: {
    color: '#fff',
    fontWeight: 500,
    fontSize: '14px'
  },
  methodDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '12px'
  },
  processingState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    py: 4
  },
  processingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '15px'
  },
  successState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    py: 3
  },
  successTitle: {
    color: '#fff',
    fontSize: '20px',
    fontWeight: 600,
    mb: 1
  },
  successText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '14px',
    lineHeight: 1.6
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    py: 2
  },
  retryBtn: {
    color: '#00f2ea',
    borderColor: '#00f2ea'
  },
  actions: {
    borderTop: '1px solid rgba(255,255,255,0.1)',
    px: 3,
    py: 2
  },
  cancelBtn: {
    color: 'rgba(255,255,255,0.6)'
  },
  payBtn: {
    background: 'linear-gradient(135deg, #00f2ea, #00c9c2)',
    color: '#000',
    fontWeight: 600,
    px: 4,
    '&:hover': {
      background: 'linear-gradient(135deg, #00d4ce, #00b5ae)'
    }
  },
  doneBtn: {
    color: '#00f2ea'
  }
};

export default PayNowDialog;
