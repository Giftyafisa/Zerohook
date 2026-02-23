import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerUser } from '../store/slices/authSlice';
import {
  Box,
  Container,
  Typography,
  Divider,
  FormControlLabel,
  Checkbox,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  Alert
} from '@mui/material';
import { 
  Lock, 
  Person, 
  Email,
  PersonAdd,
  Cake,
  Wc,
  VerifiedUser,
  Diamond,
  Star
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
    gender: '',
    dateOfBirth: '',
    faceVerificationConsent: false,
    agreeTerms: false
  });
  const [localError, setLocalError] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(AFRICAN_COUNTRIES[0]); // Default to Nigeria
  const [detectingLocation, setDetectingLocation] = useState(true);
  const formRef = useRef(null);
  const errorRef = useRef(null);
  const bottomErrorRef = useRef(null);

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

  // Scroll to error message so user can see what's wrong
  const scrollToError = () => {
    setTimeout(() => {
      if (bottomErrorRef.current) {
        bottomErrorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else if (errorRef.current) {
        errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const validateForm = () => {
    // Check required fields first
    if (!formData.firstName.trim()) {
      setLocalError('Please enter your first name');
      scrollToError();
      return false;
    }
    if (!formData.lastName.trim()) {
      setLocalError('Please enter your last name');
      scrollToError();
      return false;
    }
    if (!formData.email.trim()) {
      setLocalError('Please enter your email address');
      scrollToError();
      return false;
    }
    if (!formData.phone.trim()) {
      setLocalError('Please enter your phone number');
      scrollToError();
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setLocalError('Passwords do not match');
      scrollToError();
      return false;
    }
    if (formData.password.length < 8) {
      setLocalError('Password must be at least 8 characters long');
      scrollToError();
      return false;
    }
    if (!/[A-Z]/.test(formData.password)) {
      setLocalError('Password must contain at least one uppercase letter');
      scrollToError();
      return false;
    }
    if (!/[a-z]/.test(formData.password)) {
      setLocalError('Password must contain at least one lowercase letter');
      scrollToError();
      return false;
    }
    if (!/\d/.test(formData.password)) {
      setLocalError('Password must contain at least one number');
      scrollToError();
      return false;
    }
    if (!formData.gender) {
      setLocalError('Please select your gender');
      scrollToError();
      return false;
    }
    if (!formData.dateOfBirth) {
      setLocalError('Please enter your date of birth');
      scrollToError();
      return false;
    }
    // Validate age (must be 18+)
    const birthDate = new Date(formData.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    if (age < 18) {
      setLocalError('You must be at least 18 years old to register');
      scrollToError();
      return false;
    }
    if (!formData.agreeTerms) {
      setLocalError('You must agree to the Terms of Service and Privacy Policy');
      scrollToError();
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
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth,
        faceVerificationConsent: formData.faceVerificationConsent,
        countryCode: selectedCountry.code
      }));
      
      if (registerUser.fulfilled.match(resultAction)) {
        navigate('/subscription');
      } else {
        console.error('Registration failed:', resultAction.error);
        scrollToError();
      }
    } catch (err) {
      setLocalError('Registration failed. Please try again.');
      scrollToError();
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
            ref={errorRef}
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
        <Box component="form" onSubmit={handleSubmit} ref={formRef} noValidate>
          {/* Section 1: Personal Information */}
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#00f2ea',
                fontFamily: '"Outfit", sans-serif',
                fontWeight: 700,
                fontSize: '16px',
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Person sx={{ fontSize: 20 }} />
              Personal Information
            </Typography>
            <Grid container spacing={2}>
              {/* Name Fields */}
              <Grid item xs={12} sm={6}>
                <GlassInput
                  name="firstName"
                  label="First Name"
                  value={formData.firstName}
                  onChange={handleChange}
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
                  startIcon={<Person sx={{ color: '#00f2ea' }} />}
                  placeholder="Enter last name"
                />
              </Grid>

              {/* Gender Selection */}
              <Grid item xs={12} sm={6}>
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
                  <InputLabel>Gender *</InputLabel>
                  <Select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    label="Gender *"
                    startAdornment={<Wc sx={{ color: '#00f2ea', mr: 1 }} />}
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
                    <MenuItem value="male">Male</MenuItem>
                    <MenuItem value="female">Female</MenuItem>
                    <MenuItem value="non_binary">Non-Binary</MenuItem>
                    <MenuItem value="prefer_not_to_say">Prefer not to say</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Date of Birth */}
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
                    Date of Birth * (Must be 18+)
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
                    <Cake sx={{ color: '#00f2ea', mr: 1.5, flexShrink: 0 }} />
                    <input
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      min="1940-01-01"
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0]}
                      placeholder="YYYY-MM-DD"
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: '#fff',
                        fontSize: '16px',
                        fontFamily: '"Outfit", sans-serif',
                        height: '100%',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        colorScheme: 'dark'
                      }}
                    />
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* Section 2: Contact Details */}
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#00f2ea',
                fontFamily: '"Outfit", sans-serif',
                fontWeight: 700,
                fontSize: '16px',
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <Email sx={{ fontSize: 20 }} />
              Contact Details
            </Typography>
            <Grid container spacing={2}>
              {/* Email Field */}
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

              {/* Phone Number Field */}
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

            </Grid>
          </Box>

          {/* Section 3: Account Setup */}
          <Box sx={{ mb: 4 }}>
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#00f2ea',
                fontFamily: '"Outfit", sans-serif',
                fontWeight: 700,
                fontSize: '16px',
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <PersonAdd sx={{ fontSize: 20 }} />
              Account Setup
            </Typography>
            <Grid container spacing={2}>
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
                  <MenuItem value="client">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Person sx={{ color: '#00f2ea', fontSize: 20 }} />
                      <Box>
                        <Typography sx={{ fontWeight: 600 }}>Client</Typography>
                        <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Looking for services</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="provider">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Star sx={{ color: '#ff0055', fontSize: 20 }} />
                      <Box>
                        <Typography sx={{ fontWeight: 600 }}>Provider</Typography>
                        <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>Offering services</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="sugar_daddy">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Diamond sx={{ color: '#FFD700', fontSize: 20 }} />
                      <Box>
                        <Typography sx={{ fontWeight: 600, color: '#FFD700' }}>Sugar Daddy</Typography>
                        <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>VVIP Member - Enhanced privacy</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                  <MenuItem value="sugar_mommy">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Diamond sx={{ color: '#FF69B4', fontSize: 20 }} />
                      <Box>
                        <Typography sx={{ fontWeight: 600, color: '#FF69B4' }}>Sugar Mommy</Typography>
                        <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>VVIP Member - Enhanced privacy</Typography>
                      </Box>
                    </Box>
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

              {/* Sugar Account Info Box */}
              <Collapse in={formData.accountType === 'sugar_daddy' || formData.accountType === 'sugar_mommy'} sx={{ width: '100%' }}>
                <Grid item xs={12} sx={{ mt: 1 }}>
                  <Alert 
                    severity="info" 
                    icon={<Diamond sx={{ color: '#FFD700' }} />}
                    sx={{ 
                      background: 'rgba(255, 215, 0, 0.1)', 
                      border: '1px solid rgba(255, 215, 0, 0.3)',
                      borderRadius: '12px',
                      '& .MuiAlert-message': {
                        color: 'rgba(255, 255, 255, 0.9)',
                        fontFamily: '"Outfit", sans-serif'
                      }
                    }}
                  >
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#FFD700', mb: 0.5 }}>
                      VVIP Account Benefits
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                      • Your profile is private by default (hidden from providers)<br/>
                      • You can toggle visibility in settings anytime<br/>
                      • Only verified providers with special access can view your profile<br/>
                      • Automatic matching with young, verified providers<br/>
                      • Provider connections are limited to 1 year for your protection
                    </Typography>
                  </Alert>
                </Grid>
              </Collapse>

              {/* Password Fields */}
              <Grid item xs={12} sm={6}>
              <GlassInput
                name="password"
                label="Password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                startIcon={<Lock sx={{ color: '#00f2ea' }} />}
                placeholder="Min 8 chars, A-Z, a-z, 0-9"
              />
              {/* Password Strength Indicator */}
              {formData.password && (
                <Box sx={{ mt: 0.5, px: 1 }}>
                  <Box sx={{ 
                    height: 4, 
                    borderRadius: 2, 
                    bgcolor: 'rgba(255,255,255,0.1)',
                    overflow: 'hidden'
                  }}>
                    <Box sx={{ 
                      height: '100%', 
                      borderRadius: 2,
                      transition: 'all 0.3s',
                      width: `${Math.min(100, (
                        (formData.password.length >= 8 ? 25 : formData.password.length * 3) +
                        (/[A-Z]/.test(formData.password) ? 25 : 0) +
                        (/[a-z]/.test(formData.password) ? 25 : 0) +
                        (/\d/.test(formData.password) ? 25 : 0)
                      ))}%`,
                      bgcolor: (() => {
                        const score = (formData.password.length >= 8 ? 1 : 0) + 
                          (/[A-Z]/.test(formData.password) ? 1 : 0) + 
                          (/[a-z]/.test(formData.password) ? 1 : 0) + 
                          (/\d/.test(formData.password) ? 1 : 0);
                        if (score <= 1) return '#ff4444';
                        if (score === 2) return '#ffaa00';
                        if (score === 3) return '#ffdd00';
                        return '#00f2ea';
                      })()
                    }} />
                  </Box>
                  <Typography variant="caption" sx={{ 
                    color: (() => {
                      const score = (formData.password.length >= 8 ? 1 : 0) + 
                        (/[A-Z]/.test(formData.password) ? 1 : 0) + 
                        (/[a-z]/.test(formData.password) ? 1 : 0) + 
                        (/\d/.test(formData.password) ? 1 : 0);
                      if (score <= 1) return '#ff4444';
                      if (score === 2) return '#ffaa00';
                      if (score === 3) return '#ffdd00';
                      return '#00f2ea';
                    })(),
                    fontSize: '0.7rem'
                  }}>
                    {(() => {
                      const score = (formData.password.length >= 8 ? 1 : 0) + 
                        (/[A-Z]/.test(formData.password) ? 1 : 0) + 
                        (/[a-z]/.test(formData.password) ? 1 : 0) + 
                        (/\d/.test(formData.password) ? 1 : 0);
                      if (score <= 1) return 'Weak';
                      if (score === 2) return 'Fair';
                      if (score === 3) return 'Good';
                      return 'Strong';
                    })()}
                  </Typography>
                </Box>
              )}
            </Grid>

            <Grid item xs={12} sm={6}>
              <GlassInput
                name="confirmPassword"
                label="Confirm Password"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange}
                startIcon={<Lock sx={{ color: '#00f2ea' }} />}
                placeholder="Confirm password"
              />
            </Grid>

            </Grid>
          </Box>

          {/* Section 4: Verification & Terms */}
          <Box sx={{ mb: 3 }}>
            <Typography 
              variant="h6" 
              sx={{ 
                color: '#00f2ea',
                fontFamily: '"Outfit", sans-serif',
                fontWeight: 700,
                fontSize: '16px',
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <VerifiedUser sx={{ fontSize: 20 }} />
              Verification & Terms
            </Typography>
            <Grid container spacing={2}>
              {/* Face Verification Consent */}
              <Grid item xs={12}>
                <Box 
                  sx={{ 
                    p: 2, 
                    borderRadius: '12px', 
                    background: 'rgba(0, 242, 234, 0.05)',
                    border: '1px solid rgba(0, 242, 234, 0.2)'
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        name="faceVerificationConsent"
                        checked={formData.faceVerificationConsent}
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
                      <Box>
                        <Typography 
                          sx={{ 
                            color: '#ffffff',
                            fontFamily: '"Outfit", sans-serif',
                            fontSize: '14px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }}
                        >
                          <VerifiedUser sx={{ color: '#00f2ea', fontSize: 18 }} />
                          I consent to face verification
                        </Typography>
                        <Typography 
                          sx={{ 
                            color: 'rgba(255, 255, 255, 0.5)',
                            fontFamily: '"Outfit", sans-serif',
                            fontSize: '12px',
                            mt: 0.5
                          }}
                        >
                          Face verification helps build trust and unlocks premium features. Your data is securely stored.
                        </Typography>
                      </Box>
                    }
                  />
                </Box>
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
                      <a 
                        href="/terms" 
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ 
                          color: '#00f2ea', 
                          textDecoration: 'none',
                        }}
                      >
                        Terms of Service
                      </a>{' '}
                      and{' '}
                      <a 
                        href="/privacy" 
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ 
                          color: '#00f2ea', 
                          textDecoration: 'none',
                        }}
                      >
                        Privacy Policy
                      </a>
                    </Typography>
                  }
                />
              </Grid>

              {/* Error near submit button (so users see it without scrolling up) */}
              {(authError || localError) && (
                <Grid item xs={12}>
                  <Box 
                    ref={bottomErrorRef}
                    sx={{ 
                      p: 2,
                      borderRadius: '12px',
                      background: 'rgba(255, 0, 85, 0.1)',
                      border: '1px solid rgba(255, 0, 85, 0.3)',
                    }}
                  >
                    <Typography sx={{ color: '#ff0055', fontFamily: '"Outfit", sans-serif', fontSize: '14px', textAlign: 'center' }}>
                      ⚠️ {authError || localError}
                    </Typography>
                  </Box>
                </Grid>
              )}

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
                  {loading ? 'Creating Account...' : 'Create Account'}
                </GlassButton>
              </Grid>
            </Grid>
          </Box>

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
