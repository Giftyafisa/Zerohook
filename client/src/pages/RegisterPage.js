import React, { useState } from 'react';
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
  MenuItem
} from '@mui/material';
import { 
  Lock, 
  Person, 
  Email,
  Phone,
  PersonAdd
} from '@mui/icons-material';
import { GlassCard, GlassButton, GlassInput } from '../components/ui';

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

    try {
      const resultAction = await dispatch(registerUser({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        accountType: formData.accountType
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

            {/* Contact Fields */}
            <Grid item xs={12} sm={6}>
              <GlassInput
                name="email"
                label="Email Address"
                type="email"
                value={formData.email}
                onChange={handleChange}
                required
                startIcon={<Email sx={{ color: '#00f2ea' }} />}
                placeholder="Enter your email"
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <GlassInput
                name="phone"
                label="Phone Number"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                required
                startIcon={<Phone sx={{ color: '#00f2ea' }} />}
                placeholder="Enter phone number"
              />
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
