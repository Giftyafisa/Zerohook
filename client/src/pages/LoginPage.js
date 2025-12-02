import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { loginUser } from '../store/slices/authSlice';
import {
  Box,
  Container,
  Typography,
  Alert,
  Divider,
} from '@mui/material';
import { Lock, Person, Email } from '@mui/icons-material';
import { GlassCard, GlassButton, GlassInput } from '../components/ui';

const LoginPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { loading, error: authError } = useSelector((state) => state.auth);
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [localError, setLocalError] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setLocalError(''); // Clear error when user types
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
      // Use Redux action for login
      const resultAction = await dispatch(loginUser({
        email: formData.email,
        password: formData.password
      }));
      
      if (loginUser.fulfilled.match(resultAction)) {
        // Login successful, navigate to dashboard
        navigate('/dashboard');
      } else {
        // Login failed, error is handled by Redux
        console.error('Login failed:', resultAction.error);
      }
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <GlassCard 
        variant="neon"
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
            <Lock sx={{ fontSize: 40, color: '#00f2ea' }} />
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
            Welcome Back
          </Typography>
          <Typography 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.6)',
              fontFamily: '"Outfit", sans-serif',
            }}
          >
            Sign in to your Zerohook account
          </Typography>
        </Box>

        {/* Test Credentials Note */}
        <Box 
          sx={{ 
            mb: 3,
            p: 2,
            borderRadius: '12px',
            background: 'rgba(0, 170, 255, 0.1)',
            border: '1px solid rgba(0, 170, 255, 0.2)',
          }}
        >
          <Typography 
            sx={{ 
              color: '#00aaff', 
              fontSize: '14px',
              fontFamily: '"Outfit", sans-serif',
            }}
          >
            <strong>Test Mode:</strong> Use <code style={{ background: 'rgba(0, 170, 255, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>akua.mensah@ghana.com</code> / <code style={{ background: 'rgba(0, 170, 255, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>AkuaPass123!</code>
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

        {/* Login Form */}
        <Box component="form" onSubmit={handleLogin}>
          <Box sx={{ mb: 3 }}>
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
          </Box>

          <Box sx={{ mb: 3 }}>
            <GlassInput
              name="password"
              label="Password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              startIcon={<Lock sx={{ color: '#00f2ea' }} />}
              placeholder="Enter your password"
            />
          </Box>

          <GlassButton
            type="submit"
            fullWidth
            variant="primary"
            loading={loading}
            glowing
            sx={{ 
              mb: 3, 
              py: 2,
              fontSize: '16px',
            }}
          >
            Sign In
          </GlassButton>

          <Divider sx={{ mb: 3, borderColor: 'rgba(255, 255, 255, 0.1)' }}>
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
              Don't have an account?{' '}
              <Link 
                to="/register" 
                style={{ 
                  color: '#00f2ea', 
                  textDecoration: 'none',
                  fontWeight: 700,
                }}
              >
                Create Account
              </Link>
            </Typography>
          </Box>
        </Box>
      </GlassCard>
    </Container>
  );
};

export default LoginPage;
