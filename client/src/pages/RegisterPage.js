import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser } from '../store/slices/authSlice';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Divider,
  FormControlLabel,
  Checkbox,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment
} from '@mui/material';
import { 
  Lock, 
  Person, 
  Email,
  Phone,
  PersonAdd
} from '@mui/icons-material';
import { GlassCard, GlassButton, GlassInput } from '../components/ui';
import { API_BASE_URL } from '../config/constants';

// Supported African countries with phone codes
const AFRICAN_COUNTRIES = [
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', phoneCode: '+234' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', phoneCode: '+233' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', phoneCode: '+254' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', phoneCode: '+27' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬', phoneCode: '+256' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', phoneCode: '+255' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', phoneCode: '+250' },
  { code: 'BW', name: 'Botswana', flag: '🇧🇼', phoneCode: '+267' },
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲', phoneCode: '+260' },
  { code: 'MW', name: 'Malawi', flag: '🇲🇼', phoneCode: '+265' }
];

const RegisterPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error: authError } = useSelector((state) => state.auth);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    accountType: 'client',
    agreeTerms: false
  });
  const [localError, setLocalError] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(AFRICAN_COUNTRIES[0]); // Default to Nigeria
  const [detectingLocation, setDetectingLocation] = useState(true);

  // Detect user's country on mount
  useEffect(() => {
    const detectCountry = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/countries/detect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.detectedCountry) {
            const detected = AFRICAN_COUNTRIES.find(c => c.code === data.detectedCountry.code);
            if (detected) {
              setSelectedCountry(detected);
              console.log('📍 Country detected for phone:', detected.name, detected.phoneCode);
            }
          }
        }
      } catch (error) {
        console.log('Country detection failed, using default:', error);
      } finally {
        setDetectingLocation(false);
      }
    };

    detectCountry();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    setLocalError(''); // Clear error when user types
  };

  const validateForm = () => {
    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match');
      return false;
    }
    if (formData.password.length < 6) {
      setLocalError('Password must be at least 6 characters long');
      return false;
    }
    if (!formData.agreeTerms) {
      setLocalError('You must agree to the Terms of Service');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!validateForm()) {
      return;
    }

    // Combine country code with phone number
    const fullPhoneNumber = `${selectedCountry.phoneCode}${formData.phone.replace(/^0+/, '')}`;

    try {
      const resultAction = await dispatch(registerUser({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: fullPhoneNumber,
        accountType: formData.accountType,
        countryCode: selectedCountry.code
      }));
      
      if (registerUser.fulfilled.match(resultAction)) {
        navigate('/subscription');
      } else {
        console.error('Registration failed:', resultAction.error);
      }
    } catch (err) {
      setLocalError('Registration failed. Please try again.');
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <GlassCard 
        variant="default"
        hoverable={false}
        sx={{ 
          p: 4, 
          borderRadius: 4,
        }}
      >
        {/* Header */}
        <Box textAlign="center" mb={4}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.2), rgba(255, 0, 85, 0.2))',
              border: '1px solid rgba(0, 242, 234, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <PersonAdd sx={{ fontSize: 40, color: '#00f2ea' }} />
          </Box>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 800, 
              fontFamily: '"Outfit", sans-serif',
              background: 'linear-gradient(135deg, #00f2ea, #ff0055)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 1,
            }}
          >
            Join Zerohook
          </Typography>
          <Typography 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.6)',
              fontFamily: '"Outfit", sans-serif',
            }}
          >
            Create your account to get started
          </Typography>
        </Box>

        {/* Error Alert */}
        {(authError || localError) && (
          <Box 
            sx={{ 
              mb: 3,
              p: 2,
              borderRadius: '12px',
              background: 'rgba(255, 0, 85, 0.1)',
              border: '1px solid rgba(255, 0, 85, 0.3)',
            }}
          >
            <Typography sx={{ color: '#ff0055', fontFamily: '"Outfit", sans-serif' }}>
              {authError || localError}
            </Typography>
          </Box>
        )}

        {/* Registration Form */}
        <Box component="form" onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            {/* Name Fields */}
            <Grid item xs={12} sm={6}>
              <GlassInput
                name="firstName"
                label="First Name"
                value={formData.firstName}
                onChange={handleChange}
                required
                startIcon={<Person sx={{ color: '#00f2ea' }} />}
                placeholder="Enter first name"
              />
            </Grid>
            
            <Grid item xs={12} sm={6}>
              <GlassInput
                name="lastName"
                label="Last Name"
                value={formData.lastName}
                onChange={handleChange}
                required
                startIcon={<Person sx={{ color: '#00f2ea' }} />}
                placeholder="Enter last name"
              />
            </Grid>

            {/* Contact Fields - Email and Phone on same row */}
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography 
                  sx={{ 
                    color: 'rgba(255, 255, 255, 0.6)', 
                    fontSize: '14px', 
                    mb: 1,
                    fontFamily: '"Outfit", sans-serif'
                  }}
                >
                  Email Address *
                </Typography>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    height: '56px',
                    px: 2,
                    overflow: 'hidden',
                    '&:hover': {
                      borderColor: 'rgba(0, 242, 234, 0.5)',
                    },
                    '&:focus-within': {
                      borderColor: '#00f2ea',
                      borderWidth: '2px',
                    }
                  }}
                >
                  <Email sx={{ color: '#00f2ea', mr: 1.5, flexShrink: 0 }} />
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    autoComplete="off"
                    placeholder="Enter your email"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#fff',
                      fontSize: '16px',
                      fontFamily: '"Outfit", sans-serif',
                      height: '100%',
                      width: '100%',
                      WebkitBoxShadow: '0 0 0 1000px rgba(30, 30, 35, 0.8) inset',
                      WebkitTextFillColor: '#fff'
                    }}
                  />
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12} sm={6}>
              <Box>
                <Typography 
                  sx={{ 
                    color: 'rgba(255, 255, 255, 0.6)', 
                    fontSize: '14px', 
                    mb: 1,
                    fontFamily: '"Outfit", sans-serif'
                  }}
                >
                  Phone Number *
                </Typography>
                <Box 
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    height: '56px',
                    overflow: 'hidden',
                    '&:hover': {
                      borderColor: 'rgba(0, 242, 234, 0.5)',
                    },
                    '&:focus-within': {
                      borderColor: '#00f2ea',
                      borderWidth: '2px',
                    }
                  }}
                >
                  {/* Country Code Selector */}
                  <Select
                    value={selectedCountry.code}
                    onChange={(e) => {
                      const country = AFRICAN_COUNTRIES.find(c => c.code === e.target.value);
                      if (country) setSelectedCountry(country);
                    }}
                    disabled={detectingLocation}
                    sx={{
                      minWidth: 100,
                      height: '100%',
                      color: '#fff',
                      '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                      '& .MuiSelect-select': { 
                        py: 0,
                        pl: 1.5,
                        pr: 0.5,
                        display: 'flex',
                        alignItems: 'center'
                      },
                      '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.5)', right: 2 }
                    }}
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          background: '#1a1a1f',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          maxHeight: 300,
                          '& .MuiMenuItem-root': {
                            fontFamily: '"Outfit", sans-serif',
                            color: '#ffffff',
                            gap: 1,
                            '&:hover': { background: 'rgba(0, 242, 234, 0.1)' },
                            '&.Mui-selected': { background: 'rgba(0, 242, 234, 0.2)' },
                          },
                        },
                      },
                    }}
                    renderValue={(value) => {
                      const country = AFRICAN_COUNTRIES.find(c => c.code === value);
                      return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <span>{country?.flag}</span>
                          <span style={{ color: '#00f2ea', fontWeight: 600, fontSize: '14px' }}>{country?.phoneCode}</span>
                        </Box>
                      );
                    }}
                  >
                    {AFRICAN_COUNTRIES.map((country) => (
                      <MenuItem key={country.code} value={country.code}>
                        <span>{country.flag}</span>
                        <span>{country.name}</span>
                        <span style={{ color: '#00f2ea', marginLeft: 'auto' }}>{country.phoneCode}</span>
                      </MenuItem>
                    ))}
                  </Select>
                  
                  {/* Divider */}
                  <Box sx={{ width: '1px', height: '30px', bgcolor: 'rgba(255,255,255,0.15)' }} />
                  
                  {/* Phone Number Input */}
                  <input
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    autoComplete="off"
                    placeholder="Enter phone number"
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: '#fff',
                      fontSize: '16px',
                      padding: '0 12px',
                      fontFamily: '"Outfit", sans-serif',
                      WebkitBoxShadow: '0 0 0 1000px transparent inset',
                      WebkitTextFillColor: '#fff'
                    }}
                  />
                </Box>
                {detectingLocation && (
                  <Typography sx={{ color: 'rgba(0, 242, 234, 0.7)', fontSize: '11px', mt: 0.5 }}>
                    🔍 Detecting your location...
                  </Typography>
                )}
              </Box>
            </Grid>

            {/* Account Type */}
            <Grid item xs={12}>
              <FormControl 
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    background: 'rgba(255, 255, 255, 0.05)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: '16px',
                    color: '#ffffff',
                    '& fieldset': {
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '16px',
                    },
                    '&:hover fieldset': {
                      borderColor: 'rgba(0, 242, 234, 0.5)',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#00f2ea',
                      borderWidth: '2px',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontFamily: '"Outfit", sans-serif',
                    '&.Mui-focused': {
                      color: '#00f2ea',
                    },
                  },
                  '& .MuiSelect-icon': {
                    color: 'rgba(255, 255, 255, 0.5)',
                  },
                }}
              >
                <InputLabel>Account Type</InputLabel>
                <Select
                  name="accountType"
                  value={formData.accountType}
                  onChange={handleChange}
                  label="Account Type"
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        background: '#1a1a1f',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        '& .MuiMenuItem-root': {
                          fontFamily: '"Outfit", sans-serif',
                          color: '#ffffff',
                          '&:hover': {
                            background: 'rgba(0, 242, 234, 0.1)',
                          },
                          '&.Mui-selected': {
                            background: 'rgba(0, 242, 234, 0.2)',
                            '&:hover': {
                              background: 'rgba(0, 242, 234, 0.3)',
                            },
                          },
                        },
                      },
                    },
                  }}
                >
                  <MenuItem value="client">Client - Looking for services</MenuItem>
                  <MenuItem value="provider">Provider - Offering services</MenuItem>
                  <MenuItem value="both">Both - Client & Provider</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* Password Fields */}
            <Grid item xs={12} sm={6}>
              <GlassInput
                name="password"
                label="Password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                startIcon={<Lock sx={{ color: '#00f2ea' }} />}
                placeholder="Create password"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <GlassInput
                name="confirmPassword"
                label="Confirm Password"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                startIcon={<Lock sx={{ color: '#00f2ea' }} />}
                placeholder="Confirm password"
              />
            </Grid>

            {/* Terms Checkbox */}
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    name="agreeTerms"
                    checked={formData.agreeTerms}
                    onChange={handleChange}
                    sx={{ 
                      color: 'rgba(255, 255, 255, 0.5)',
                      '&.Mui-checked': {
                        color: '#00f2ea',
                      },
                    }}
                  />
                }
                label={
                  <Typography 
                    sx={{ 
                      color: 'rgba(255, 255, 255, 0.6)',
                      fontFamily: '"Outfit", sans-serif',
                      fontSize: '14px',
                    }}
                  >
                    I agree to the{' '}
                    <Link to="/terms" style={{ color: '#00f2ea', textDecoration: 'none' }}>
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" style={{ color: '#00f2ea', textDecoration: 'none' }}>
                      Privacy Policy
                    </Link>
                  </Typography>
                }
              />
            </Grid>

            {/* Submit Button */}
            <Grid item xs={12}>
              <GlassButton
                type="submit"
                fullWidth
                variant="primary"
                loading={loading}
                glowing
                sx={{ 
                  py: 2,
                  fontSize: '16px',
                }}
              >
                Create Account
              </GlassButton>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
            <Typography 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.4)',
                fontFamily: '"Outfit", sans-serif',
                px: 2,
              }}
            >
              or
            </Typography>
          </Divider>

          <Box textAlign="center">
            <Typography 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.6)',
                fontFamily: '"Outfit", sans-serif',
              }}
            >
              Already have an account?{' '}
              <Link 
                to="/login" 
                style={{ 
                  color: '#00f2ea', 
                  textDecoration: 'none',
                  fontWeight: 700,
                }}
              >
                Sign In
              </Link>
            </Typography>
          </Box>
        </Box>
      </GlassCard>
    </Container>
  );
};

export default RegisterPage;
