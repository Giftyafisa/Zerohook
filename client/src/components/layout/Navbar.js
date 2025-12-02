import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Box,
  useTheme,
  useMediaQuery,
  Divider,
  Chip
} from '@mui/material';
import { styled, keyframes } from '@mui/system';
import {
  Menu as MenuIcon,
  Person,
  Dashboard,
  Security,
  Payment,
  Add,
  ExitToApp,
  Explore,
  Whatshot,
  Chat,
  Close
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, selectIsAuthenticated, selectIsSubscribed, logout } from '../../store/slices/authSlice';
import NotificationSystem from '../NotificationSystem';
import { colors } from '../../theme/colors';

const glowPulse = keyframes`
  0%, 100% {
    box-shadow: 0 0 20px rgba(0, 242, 234, 0.3);
  }
  50% {
    box-shadow: 0 0 30px rgba(0, 242, 234, 0.5);
  }
`;

const GlassAppBar = styled(AppBar)({
  background: 'rgba(15, 15, 19, 0.85)',
  backdropFilter: 'blur(20px)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.3)',
});

const NavButton = styled(Button)({
  fontFamily: '"Outfit", sans-serif',
  fontWeight: 600,
  fontSize: '14px',
  color: 'rgba(255, 255, 255, 0.8)',
  textTransform: 'none',
  padding: '8px 16px',
  borderRadius: '12px',
  transition: 'all 0.3s ease',
  
  '&:hover': {
    color: '#00f2ea',
    background: 'rgba(0, 242, 234, 0.1)',
  },
});

const LogoText = styled(Typography)({
  fontFamily: '"Outfit", sans-serif',
  fontWeight: 800,
  fontSize: '28px',
  background: 'linear-gradient(135deg, #00f2ea, #ff0055)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  textDecoration: 'none',
  letterSpacing: '-0.5px',
  
  '&:hover': {
    opacity: 0.9,
  },
});

const GlassMenu = styled(Menu)({
  '& .MuiPaper-root': {
    background: 'rgba(20, 20, 30, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    minWidth: 220,
    padding: '8px',
  },
});

const GlassMenuItem = styled(MenuItem)({
  fontFamily: '"Outfit", sans-serif',
  fontSize: '14px',
  color: 'rgba(255, 255, 255, 0.8)',
  borderRadius: '10px',
  margin: '2px 0',
  padding: '12px 16px',
  transition: 'all 0.2s ease',
  
  '&:hover': {
    background: 'rgba(0, 242, 234, 0.15)',
    color: '#00f2ea',
  },
});

const PremiumChip = styled(Chip)({
  background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.2), rgba(255, 0, 85, 0.2))',
  color: '#00f2ea',
  border: '1px solid rgba(0, 242, 234, 0.3)',
  fontFamily: '"Outfit", sans-serif',
  fontWeight: 600,
  fontSize: '10px',
  height: '22px',
});

const FreeChip = styled(Chip)({
  background: 'rgba(255, 255, 255, 0.1)',
  color: 'rgba(255, 255, 255, 0.6)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  fontFamily: '"Outfit", sans-serif',
  fontWeight: 600,
  fontSize: '10px',
  height: '22px',
});

const GlassAvatar = styled(Avatar)({
  border: '2px solid rgba(0, 242, 234, 0.5)',
  transition: 'all 0.3s ease',
  
  '&:hover': {
    borderColor: '#00f2ea',
    boxShadow: '0 0 15px rgba(0, 242, 234, 0.4)',
  },
});

const RegisterButton = styled(Button)({
  background: '#00f2ea',
  color: '#0f0f13',
  fontFamily: '"Outfit", sans-serif',
  fontWeight: 600,
  fontSize: '14px',
  textTransform: 'none',
  padding: '8px 20px',
  borderRadius: '12px',
  transition: 'all 0.3s ease',
  
  '&:hover': {
    background: '#00f2ea',
    boxShadow: '0 4px 20px rgba(0, 242, 234, 0.4)',
    transform: 'translateY(-2px)',
  },
});

const Navbar = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isSubscribed = useSelector(selectIsSubscribed);

  // ENHANCED: Better user display logic
  const getUserDisplayName = () => {
    if (!user) return 'Guest';
    return user.username || user.email?.split('@')[0] || 'User';
  };

  const getSubscriptionBadge = () => {
    if (!isAuthenticated) return null;
    if (isSubscribed) {
      const tier = user?.subscription_tier || 'premium';
      return (
        <PremiumChip 
          label={tier.toUpperCase()} 
          size="small"
        />
      );
    }
    return (
      <FreeChip 
        label="FREE" 
        size="small"
      />
    );
  };
  
  const [anchorEl, setAnchorEl] = useState(null);
  const [mobileMenuAnchor, setMobileMenuAnchor] = useState(null);

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMobileMenuOpen = (event) => {
    setMobileMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMobileMenuAnchor(null);
  };

  const handleLogout = () => {
    try {
      dispatch(logout());
      handleMenuClose();
      navigate('/');
      // Clear any stored user data
      localStorage.removeItem('user');
      localStorage.removeItem('userProfile');
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout even if there's an error
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('userProfile');
      window.location.href = '/';
    }
  };

  const menuItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <Dashboard /> },
    { label: 'Profile', path: '/profile', icon: <Person /> },
    { label: 'Trust Score', path: '/trust-score', icon: <Security /> },
    { label: 'Transactions', path: '/transactions', icon: <Payment /> },
    { label: 'Create Service', path: '/create-service', icon: <Add /> },
  ];

  const renderMenu = (
    <GlassMenu
      anchorEl={anchorEl}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      keepMounted
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      open={Boolean(anchorEl)}
      onClose={handleMenuClose}
      aria-label="User menu"
    >
      {menuItems.map((item) => (
        <GlassMenuItem
          key={item.path}
          onClick={() => {
            navigate(item.path);
            handleMenuClose();
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ color: '#00f2ea' }}>{item.icon}</Box>
            {item.label}
          </Box>
        </GlassMenuItem>
      ))}
      <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
      <GlassMenuItem 
        onClick={handleLogout}
        sx={{ 
          '&:hover': { 
            background: 'rgba(255, 0, 85, 0.15)', 
            color: '#ff0055' 
          } 
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ color: '#ff0055' }}><ExitToApp /></Box>
          Logout
        </Box>
      </GlassMenuItem>
    </GlassMenu>
  );

  const renderMobileMenu = (
    <GlassMenu
      anchorEl={mobileMenuAnchor}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      keepMounted
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      open={Boolean(mobileMenuAnchor)}
      onClose={handleMenuClose}
      aria-label="Mobile navigation menu"
      sx={{
        '& .MuiPaper-root': {
          maxHeight: '80vh',
          overflow: 'auto',
          minWidth: 260,
        }
      }}
    >
      <GlassMenuItem
        onClick={() => {
          navigate('/profiles');
          handleMenuClose();
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Explore sx={{ color: '#00f2ea' }} />
          Browse Profiles
        </Box>
      </GlassMenuItem>
      <GlassMenuItem
        onClick={() => {
          navigate('/adult-services');
          handleMenuClose();
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Whatshot sx={{ color: '#ff0055' }} />
          Adult Services
        </Box>
      </GlassMenuItem>
      {isAuthenticated && (
        <>
          <GlassMenuItem
            onClick={() => {
              navigate('/chat');
              handleMenuClose();
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Chat sx={{ color: '#00f2ea' }} />
              Messages
            </Box>
          </GlassMenuItem>
          <GlassMenuItem
            onClick={() => {
              navigate('/create-service');
              handleMenuClose();
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Add sx={{ color: '#00f2ea' }} />
              Create Service
            </Box>
          </GlassMenuItem>
          <GlassMenuItem
            onClick={() => {
              navigate('/dashboard');
              handleMenuClose();
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Dashboard sx={{ color: '#00f2ea' }} />
              Dashboard
            </Box>
          </GlassMenuItem>
        </>
      )}
      {!isAuthenticated && (
        <>
          <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
          <GlassMenuItem
            onClick={() => {
              navigate('/login');
              handleMenuClose();
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Person sx={{ color: '#00f2ea' }} />
              Login
            </Box>
          </GlassMenuItem>
          <GlassMenuItem
            onClick={() => {
              navigate('/register');
              handleMenuClose();
            }}
            sx={{ 
              background: 'rgba(0, 242, 234, 0.1)',
              '&:hover': { background: 'rgba(0, 242, 234, 0.2)' }
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Add sx={{ color: '#00f2ea' }} />
              Register
            </Box>
          </GlassMenuItem>
        </>
      )}
      {isAuthenticated && (
        <>
          <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.1)' }} />
          <GlassMenuItem
            onClick={() => {
              navigate('/profile');
              handleMenuClose();
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Person sx={{ color: '#00f2ea' }} />
              My Profile
            </Box>
          </GlassMenuItem>
          <GlassMenuItem
            onClick={handleLogout}
            sx={{ 
              '&:hover': { 
                background: 'rgba(255, 0, 85, 0.15)', 
                color: '#ff0055' 
              } 
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ExitToApp sx={{ color: '#ff0055' }} />
              Logout
            </Box>
          </GlassMenuItem>
        </>
      )}
    </GlassMenu>
  );

  return (
    <>
      <GlassAppBar position="sticky">
        <Toolbar sx={{ py: 1 }}>
          {/* Mobile Menu Button */}
          {isMobile && (
            <IconButton
              size="large"
              edge="start"
              aria-label="menu"
              onClick={handleMobileMenuOpen}
              sx={{ 
                mr: 2,
                color: 'rgba(255, 255, 255, 0.8)',
                '&:hover': {
                  color: '#00f2ea',
                  background: 'rgba(0, 242, 234, 0.1)',
                }
              }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Logo */}
          <LogoText
            component={Link}
            to="/"
            sx={{
              flexGrow: isMobile ? 1 : 0,
              mr: 4,
            }}
          >
            Zerohook
          </LogoText>

          {/* Desktop Navigation */}
          {!isMobile && (
            <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
              <NavButton
                component={Link}
                to="/profiles"
                startIcon={<Explore sx={{ fontSize: 18 }} />}
              >
                Browse
              </NavButton>
              <NavButton
                component={Link}
                to="/adult-services"
                startIcon={<Whatshot sx={{ fontSize: 18, color: '#ff0055' }} />}
              >
                Adult Services
              </NavButton>
              {isAuthenticated && (
                <>
                  <NavButton
                    component={Link}
                    to="/chat"
                    startIcon={<Chat sx={{ fontSize: 18 }} />}
                  >
                    Messages
                  </NavButton>
                  <NavButton
                    component={Link}
                    to="/create-service"
                    startIcon={<Add sx={{ fontSize: 18 }} />}
                  >
                    Create Service
                  </NavButton>
                </>
              )}
            </Box>
          )}

          {/* Right Side */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {isAuthenticated ? (
              <>
                {/* Notifications */}
                <NotificationSystem />

                {/* User Menu */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {!isMobile && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <Typography 
                        sx={{ 
                          color: '#ffffff', 
                          fontWeight: 600,
                          fontFamily: '"Outfit", sans-serif',
                          fontSize: '14px',
                        }}
                      >
                        {getUserDisplayName()}
                      </Typography>
                      {getSubscriptionBadge()}
                    </Box>
                  )}
                  <IconButton
                    onClick={handleProfileMenuOpen}
                    sx={{ p: 0 }}
                  >
                    <GlassAvatar
                      sx={{
                        bgcolor: 'rgba(0, 242, 234, 0.2)',
                        color: '#00f2ea',
                        width: 42,
                        height: 42,
                        fontWeight: 700,
                      }}
                    >
                      {user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                    </GlassAvatar>
                  </IconButton>
                </Box>
              </>
            ) : (
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <NavButton
                  component={Link}
                  to="/login"
                >
                  Login
                </NavButton>
                <RegisterButton
                  component={Link}
                  to="/register"
                >
                  Get Started
                </RegisterButton>
              </Box>
            )}
          </Box>
        </Toolbar>
      </GlassAppBar>

      {/* Render Menus */}
      {renderMenu}
      {renderMobileMenu}
    </>
  );
};

export default Navbar;
