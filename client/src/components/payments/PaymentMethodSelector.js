import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Chip,
  Grid,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  CreditCard,
  AccountBalance,
  CurrencyBitcoin,
  CheckCircle
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { colors } from '../../theme/colors';

const PaymentMethodSelector = ({ 
  amount, 
  currency = 'USD', 
  onPaymentMethodSelect, 
  onPaymentInitiate,
  loading = false 
}) => {
  const [selectedMethod, setSelectedMethod] = useState('paystack');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [selectedCurrency, setSelectedCurrency] = useState(currency);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [loadingMethods, setLoadingMethods] = useState(true);

  useEffect(() => {
    fetchPaymentMethods();
    fetchCurrencies();
  }, []);

  useEffect(() => {
    const currencyData = currencies.find(c => c.code === selectedCurrency);
    if (currencyData) {
      setExchangeRate(currencyData.exchangeRate);
    }
  }, [selectedCurrency, currencies]);

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch('/api/payments/methods', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setPaymentMethods(data.paymentMethods);
    } catch (error) {
      console.error('Failed to fetch payment methods:', error);
    } finally {
      setLoadingMethods(false);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const response = await fetch('/api/payments/currencies', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      setCurrencies(data.currencies);
    } catch (error) {
      console.error('Failed to fetch currencies:', error);
    }
  };

  const handleMethodChange = (method) => {
    setSelectedMethod(method);
    const methodData = paymentMethods.find(m => m.id === method);
    if (methodData && methodData.currencies.length > 0) {
      const preferredCurrency = methodData.currencies.includes(currency) 
        ? currency 
        : methodData.currencies[0];
      setSelectedCurrency(preferredCurrency);
    }
    onPaymentMethodSelect?.(method);
  };

  const handlePaymentInitiate = () => {
    const convertedAmount = amount * exchangeRate;
    onPaymentInitiate?.({
      method: selectedMethod,
      currency: selectedCurrency,
      amount: convertedAmount,
      originalAmount: amount,
      exchangeRate
    });
  };

  const getMethodIcon = (methodId) => {
    switch (methodId) {
      case 'paystack':
        return <AccountBalance sx={{ color: colors.primary }} />;
      case 'crypto':
        return <CurrencyBitcoin sx={{ color: colors.warning }} />;
      case 'stripe':
        return <CreditCard sx={{ color: colors.success }} />;
      default:
        return <CreditCard />;
    }
  };

  const getMethodDescription = (method) => {
    switch (method.id) {
      case 'paystack':
        return 'Fast international payments with local bank support';
      case 'crypto':
        return 'Decentralized payments with Bitcoin, Ethereum, and more';
      case 'stripe':
        return 'Secure credit/debit card and digital wallet payments';
      default:
        return method.description;
    }
  };

  const getAvailableCurrencies = (method) => {
    return method.currencies.map(code => {
      const currencyData = currencies.find(c => c.code === code);
      return currencyData ? currencyData.symbol : code;
    }).join(', ');
  };

  const formatAmount = (amount, currencyCode) => {
    const currencyData = currencies.find(c => c.code === currencyCode);
    if (!currencyData) return `${amount} ${currencyCode}`;
    return `${currencyData.symbol}${(amount * currencyData.exchangeRate).toFixed(2)}`;
  };

  if (loadingMethods) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        Choose Payment Method 💳
      </Typography>

      <RadioGroup
        value={selectedMethod}
        onChange={(e) => handleMethodChange(e.target.value)}
      >
        <Grid container spacing={2}>
          {paymentMethods.map((method) => (
            <Grid item xs={12} md={4} key={method.id}>
              <motion.div
                whileHover={{ y: -5 }}
                transition={{ duration: 0.2 }}
              >
                <Card 
                  sx={{ 
                    cursor: 'pointer',
                    border: selectedMethod === method.id ? `2px solid ${colors.primary}` : '2px solid transparent',
                    '&:hover': {
                      borderColor: colors.primary,
                      boxShadow: 4
                    }
                  }}
                  onClick={() => handleMethodChange(method.id)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      {getMethodIcon(method.id)}
                      <Typography variant="h6" sx={{ ml: 1 }}>
                        {method.name}
                      </Typography>
                      {method.primary && (
                        <Chip 
                          label="Primary" 
                          size="small" 
                          color="primary" 
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {getMethodDescription(method)}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Supported currencies:
                      </Typography>
                    </Box>
                    
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {getAvailableCurrencies(method)}
                    </Typography>

                    <FormControlLabel
                      value={method.id}
                      control={<Radio />}
                      label=""
                      sx={{ position: 'absolute', top: 8, right: 8 }}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </RadioGroup>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Select Currency 💱
        </Typography>
        
        <Grid container spacing={2}>
          {currencies
            .filter(c => {
              const method = paymentMethods.find(m => m.id === selectedMethod);
              return method?.currencies.includes(c.code);
            })
            .map((currencyData) => (
              <Grid item key={currencyData.code}>
                <Chip
                  label={`${currencyData.symbol} ${currencyData.code}`}
                  onClick={() => setSelectedCurrency(currencyData.code)}
                  variant={selectedCurrency === currencyData.code ? 'filled' : 'outlined'}
                  color={selectedCurrency === currencyData.code ? 'primary' : 'default'}
                  sx={{ cursor: 'pointer' }}
                />
              </Grid>
            ))}
        </Grid>
      </Box>

      <Card sx={{ bgcolor: colors.background.light, mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Payment Summary 📋
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography>Original Amount:</Typography>
            <Typography>${amount.toFixed(2)} USD</Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography>Selected Currency:</Typography>
            <Typography>{selectedCurrency}</Typography>
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography>Exchange Rate:</Typography>
            <Typography>1 USD = {exchangeRate.toFixed(4)} {selectedCurrency}</Typography>
          </Box>
          
          <Divider sx={{ my: 1 }} />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="h6">Total Amount:</Typography>
            <Typography variant="h6" color="primary">
              {formatAmount(amount, selectedCurrency)}
            </Typography>
          </Box>
        </CardContent>
      </Card>

      <Alert 
        severity="info" 
        sx={{ mb: 3 }}
        icon={<CheckCircle />}
      >
        <Typography variant="body2">
          <strong>{paymentMethods.find(m => m.id === selectedMethod)?.name}</strong> will be used for this payment.
          {selectedMethod === 'paystack' && ' You\'ll be redirected to a secure payment page.'}
          {selectedMethod === 'crypto' && ' You\'ll receive a unique wallet address for payment.'}
          {selectedMethod === 'stripe' && ' Your payment will be processed securely through Stripe.'}
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          size="large"
          onClick={handlePaymentInitiate}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
          sx={{ 
            py: 1.5, 
            px: 4, 
            fontSize: '1.1rem',
            bgcolor: colors.primary,
            '&:hover': {
              bgcolor: colors.primaryDark
            }
          }}
        >
          {loading ? 'Processing...' : `Pay ${formatAmount(amount, selectedCurrency)}`}
        </Button>
      </Box>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          🔒 All payments are secured with bank-level encryption and held in escrow until service completion
        </Typography>
      </Box>
    </Box>
  );
};

export default PaymentMethodSelector;
