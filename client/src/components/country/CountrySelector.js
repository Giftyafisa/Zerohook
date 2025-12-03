import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  CircularProgress,
  Avatar
} from '@mui/material';
import {
  Language,
  LocationOn,
  CheckCircle,
  Public,
  Payment,
  AccountBalance,
  Smartphone
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { colors } from '../../theme/colors';
import { API_BASE_URL } from '../../config/constants';

const CountrySelector = ({ 
  onCountryChange, 
  currentCountry = null,
  showDetected = true 
}) => {
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(currentCountry);
  const [detectedCountry, setDetectedCountry] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCountries();
    if (showDetected) {
      detectUserCountry();
    }
  }, [showDetected]);

  const fetchCountries = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/countries`);
      const data = await response.json();
      
      if (data.success) {
        setCountries(data.countries);
      } else {
        setError('Failed to fetch countries');
      }
    } catch (error) {
      setError('Failed to fetch countries');
    } finally {
      setLoading(false);
    }
  };

  const detectUserCountry = async () => {
    try {
      // Get user's IP address (simplified - in production use a proper IP service)
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();
      
      const response = await fetch(`${API_BASE_URL}/countries/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ ipAddress: ipData.ip })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setDetectedCountry(data.detectedCountry);
        if (!selectedCountry) {
          setSelectedCountry(data.detectedCountry);
          onCountryChange?.(data.detectedCountry);
        }
      }
    } catch (error) {
      console.error('Country detection failed:', error);
    }
  };

  const handleCountrySelect = (country) => {
    setSelectedCountry(country);
    onCountryChange?.(country);
    setDialogOpen(false);
  };

  const getCountryFeatures = (country) => {
    const features = [];
    
    if (country.paystackSupport) features.push('Paystack Payments');
    if (country.localBanks) features.push('Local Banks');
    if (country.mobileMoney) features.push('Mobile Money');
    if (country.cryptoPlatforms?.length > 0) features.push('Crypto Support');
    
    return features;
  };

  const getFeatureIcon = (feature) => {
    switch (feature) {
      case 'Paystack Payments':
        return <Payment sx={{ color: colors.primary }} />;
      case 'Local Banks':
        return <AccountBalance sx={{ color: colors.success }} />;
      case 'Mobile Money':
        return <Smartphone sx={{ color: colors.warning }} />;
      case 'Crypto Support':
        return <Public sx={{ color: colors.info }} />;
      default:
        return <CheckCircle />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Current Country Display */}
      {selectedCountry && (
        <Card sx={{ mb: 3, bgcolor: colors.background.light }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ mr: 2 }}>
                🌍 Your Country
              </Typography>
              {detectedCountry && detectedCountry.code === selectedCountry.code && (
                <Chip 
                  label="Auto-detected" 
                  size="small" 
                  color="success" 
                  icon={<LocationOn />}
                />
              )}
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h4" sx={{ mr: 2 }}>
                {selectedCountry.flag}
              </Typography>
              <Box>
                <Typography variant="h6">
                  {selectedCountry.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedCountry.currency} ({selectedCountry.currencySymbol})
                </Typography>
              </Box>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Features available:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {getCountryFeatures(selectedCountry).map((feature, index) => (
                  <Chip
                    key={index}
                    label={feature}
                    size="small"
                    icon={getFeatureIcon(feature)}
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>

            <Button
              variant="outlined"
              startIcon={<Language />}
              onClick={() => setDialogOpen(true)}
            >
              Change Country
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Country Selection Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Language sx={{ mr: 1 }} />
            Select Your Country
          </Box>
        </DialogTitle>
        
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose your country to get localized payment methods, currencies, and features.
          </Typography>

          <Grid container spacing={2}>
            {countries.map((country) => (
              <Grid item xs={12} md={6} key={country.code}>
                <motion.div
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      border: selectedCountry?.code === country.code ? `2px solid ${colors.primary}` : '2px solid transparent',
                      '&:hover': {
                        borderColor: colors.primary,
                        boxShadow: 2
                      }
                    }}
                    onClick={() => handleCountrySelect(country)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h4" sx={{ mr: 2 }}>
                          {country.flag}
                        </Typography>
                        <Box>
                          <Typography variant="h6">
                            {country.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {country.currency} ({country.currencySymbol})
                          </Typography>
                        </Box>
                      </Box>

                      <Box sx={{ mb: 2 }}>
                        <Typography variant="caption" color="text.secondary" gutterBottom>
                          Available features:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                          {getCountryFeatures(country).slice(0, 3).map((feature, index) => (
                            <Chip
                              key={index}
                              label={feature}
                              size="small"
                              icon={getFeatureIcon(feature)}
                              variant="outlined"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          ))}
                          {getCountryFeatures(country).length > 3 && (
                            <Chip
                              label={`+${getCountryFeatures(country).length - 3} more`}
                              size="small"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          )}
                        </Box>
                      </Box>

                      {detectedCountry?.code === country.code && (
                        <Chip 
                          label="Detected from your location" 
                          size="small" 
                          color="success" 
                          icon={<LocationOn />}
                          sx={{ mt: 1 }}
                        />
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Special Ghanaian Features */}
      {selectedCountry?.code === 'GH' && (
        <Card sx={{ mt: 3, bgcolor: colors.warning.light }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              🇬🇭 Special Ghanaian Features
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              Ghana users get access to exclusive local payment methods and crypto platforms.
            </Typography>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip 
                label="Bitnob Crypto Platform" 
                icon={<Public />}
                color="primary"
              />
              <Chip 
                label="Mobile Money (MTN, Vodafone, AirtelTigo)" 
                icon={<Smartphone />}
                color="success"
              />
              <Chip 
                label="Local Bank Integration" 
                icon={<AccountBalance />}
                color="info"
              />
              <Chip 
                label="24/7 Local Support" 
                icon={<CheckCircle />}
                color="success"
              />
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default CountrySelector;
