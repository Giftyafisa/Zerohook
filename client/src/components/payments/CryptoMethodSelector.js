/**
 * CryptoMethodSelector - Crypto-Only Payment Method Selector
 * 
 * Displays supported cryptocurrencies and lets user choose which to pay with.
 * Shows live exchange rates. Replaces the old PaymentMethodSelector (Paystack/Stripe).
 */

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
  Grid,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  CurrencyBitcoin,
  CheckCircle,
  Lock,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { API_BASE_URL } from '../../config/constants';

const CRYPTO_INFO = {
  BTC: { name: 'Bitcoin', logo: '₿', color: '#f7931a' },
  ETH: { name: 'Ethereum', logo: 'Ξ', color: '#627eea' },
  USDT: { name: 'Tether (USDT)', logo: '₮', color: '#26a17b' },
  USDC: { name: 'USD Coin', logo: '💵', color: '#2775ca' },
  BNB: { name: 'BNB', logo: '🟡', color: '#f3ba2f' },
  SOL: { name: 'Solana', logo: '◎', color: '#14f195' },
  LTC: { name: 'Litecoin', logo: 'Ł', color: '#bfbbbb' },
};

const CryptoMethodSelector = ({
  amount,
  currency = 'USD',
  onCryptoSelect,
  onPaymentInitiate,
  loading = false,
  defaultCrypto = 'USDT',
}) => {
  const [selectedCrypto, setSelectedCrypto] = useState(defaultCrypto);
  const [rates, setRates] = useState({});
  const [loadingRates, setLoadingRates] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRates();
  }, [currency]);

  const fetchRates = async () => {
    try {
      setLoadingRates(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/payments/rates?fiatCurrency=${currency}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && data.rates) {
        setRates(data.rates);
      }
    } catch (err) {
      console.error('Failed to fetch rates:', err);
      setError('Could not load exchange rates');
    } finally {
      setLoadingRates(false);
    }
  };

  const handleSelect = (crypto) => {
    setSelectedCrypto(crypto);
    onCryptoSelect?.(crypto);
  };

  const handleInitiate = () => {
    const rate = rates[selectedCrypto];
    const cryptoAmount = rate ? amount / rate : 0;
    onPaymentInitiate?.({
      cryptoSymbol: selectedCrypto,
      cryptoAmount,
      fiatAmount: amount,
      fiatCurrency: currency,
      rate,
    });
  };

  const formatCryptoAmount = (symbol) => {
    const rate = rates[symbol];
    if (!rate || !amount) return '—';
    const cryptoAmt = amount / rate;
    return cryptoAmt < 0.001 ? cryptoAmt.toFixed(8) : cryptoAmt.toFixed(6);
  };

  if (loadingRates) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={32} sx={{ color: '#00f2ea' }} />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ mb: 2, color: '#fff' }}>
        Choose Cryptocurrency 🪙
      </Typography>

      {error && (
        <Alert severity="warning" sx={{ mb: 2, bgcolor: 'rgba(255,165,0,0.1)', color: '#ffa500' }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Lock sx={{ fontSize: 16, color: '#00ff88' }} />
        <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>
          Fee-free direct blockchain payments • No intermediaries
        </Typography>
      </Box>

      <RadioGroup value={selectedCrypto} onChange={(e) => handleSelect(e.target.value)}>
        <Grid container spacing={1.5}>
          {Object.entries(CRYPTO_INFO).map(([symbol, info]) => (
            <Grid item xs={12} sm={6} key={symbol}>
              <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.15 }}>
                <Card
                  onClick={() => handleSelect(symbol)}
                  sx={{
                    cursor: 'pointer',
                    bgcolor: selectedCrypto === symbol
                      ? 'rgba(0, 242, 234, 0.1)'
                      : 'rgba(255,255,255,0.03)',
                    border: selectedCrypto === symbol
                      ? '2px solid #00f2ea'
                      : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 2,
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: 'rgba(0, 242, 234, 0.05)' },
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Typography sx={{ fontSize: '1.5rem' }}>{info.logo}</Typography>
                        <Box>
                          <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>
                            {info.name}
                          </Typography>
                          {amount > 0 && (
                            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                              ≈ {formatCryptoAmount(symbol)} {symbol}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      {selectedCrypto === symbol && (
                        <CheckCircle sx={{ color: '#00f2ea', fontSize: 22 }} />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </RadioGroup>

      <Button
        fullWidth
        variant="contained"
        size="large"
        onClick={handleInitiate}
        disabled={loading || !selectedCrypto}
        sx={{
          mt: 3,
          py: 1.5,
          fontSize: '1rem',
          fontWeight: 700,
          borderRadius: 2,
          background: 'linear-gradient(135deg, #00f2ea, #00d4aa)',
          color: '#000',
          '&:hover': {
            background: 'linear-gradient(135deg, #00f2ea, #00f2ea)',
          },
          '&:disabled': {
            background: 'rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.3)',
          },
        }}
      >
        {loading ? (
          <CircularProgress size={24} sx={{ color: '#000' }} />
        ) : (
          `Pay with ${CRYPTO_INFO[selectedCrypto]?.name || selectedCrypto}`
        )}
      </Button>
    </Box>
  );
};

export default CryptoMethodSelector;
