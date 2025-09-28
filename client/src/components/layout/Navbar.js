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
import {
  Menu as MenuIcon,
  Person,
  Dashboard,
  Security,
  Payment,
  Add,
  ExitToApp
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, selectIsAuthenticated, selectIsSubscribed, logout } from '../../store/slices/authSlice';
import NotificationSystem from '../NotificationSystem';
import { colors } from '../../theme/colors';

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
        <Chip 
          label={tier.toUpperCase()} 
          size="small" 
          color="success" 
          sx={{ ml: 1, fontSize: '0.7rem' }}
        />
      );
    }
    return (
      <Chip 
        label="FREE" 
        size="small" 
        color="default" 
        sx={{ ml: 1, fontSize: '0.7rem' }}
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
    <Menu
      anchorEl={anchorEl}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      keepMounted
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      open={Boolean(anchorEl)}
      onClose={handleMenuClose}
      aria-label="User menu"
      sx={{
        '& .MuiPaper-root': {
          minWidth: 200,
          maxWidth: '90vw'
        }
      }}
    >
      {menuItems.map((item) => (
        <MenuItem
          key={item.path}
          onClick={() => {
            navigate(item.path);
            handleMenuClose();
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {item.icon}
            {item.label}
          </Box>
        </MenuItem>
      ))}
      <MenuItem 
        onClick={handleLogout}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ExitToApp />
          Logout
        </Box>
      </MenuItem>
    </Menu>
  );

  const renderMobileMenu = (
    <Menu
      anchorEl={mobileMenuAnchor}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      keepMounted
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      open={Boolean(mobileMenuAnchor)}
      onClose={handleMenuClose}
      aria-label="Mobile navigation menu"
      sx={{
        '& .MuiPaper-root': {
          minWidth: 200,
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflow: 'auto'
        }
      }}
    >
      <MenuItem
        onClick={() => {
          navigate('/profiles');
          handleMenuClose();
        }}
        sx={{ py: 1.5 }}
      >
        Browse Profiles
      </MenuItem>
      <MenuItem
        onClick={() => {
          navigate('/adult-services');
          handleMenuClose();
        }}
        sx={{ py: 1.5 }}
      >
        Adult Services 🔥
      </MenuItem>
      {isAuthenticated && (
        <>
          <MenuItem
            onClick={() => {
              navigate('/create-service');
              handleMenuClose();
            }}
          >
            Create Service
          </MenuItem>
          <MenuItem
            onClick={() => {
              navigate('/dashboard');
              handleMenuClose();
            }}
          >
            Dashboard
          </MenuItem>
        </>
      )}
      {!isAuthenticated && (
        <>
          <MenuItem
            onClick={() => {
              navigate('/login');
              handleMenuClose();
            }}
          >
            Login
          </MenuItem>
          <MenuItem
            onClick={() => {
              navigate('/register');
              handleMenuClose();
            }}
          >
            Register
          </MenuItem>
        </>
      )}
      {isAuthenticated && (
        <>
          <Divider />
          <MenuItem
            onClick={() => {
              navigate('/profile');
              handleMenuClose();
            }}
          >
            My Profile
          </MenuItem>
          <MenuItem
            onClick={handleLogout}
          >
            Logout
          </MenuItem>
        </>
      )}
    </Menu>
  );

  return (
    <>
      <AppBar position="static" sx={{ bgcolor: colors.primary.red }}>
        <Toolbar>
          {/* Mobile Menu Button */}
          {isMobile && (
            <IconButton
              size="large"
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={handleMobileMenuOpen}
              sx={{ mr: 2 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Logo */}
          <Typography
            variant="h4"
            component={Link}
            to="/"
            sx={{
              fontWeight: 800,
              color: 'white',
              textDecoration: 'none',
              flexGrow: isMobile ? 1 : 0,
              mr: 4,
              '&:hover': {
                opacity: 0.8
              }
            }}
          >
            Hkup
          </Typography>

          {/* Desktop Navigation */}
          {!isMobile && (
            <Box sx={{ flexGrow: 1, display: 'flex', gap: 2 }}>
              <Button
                color="inherit"
                component={Link}
                to="/profiles"
                sx={{ 
                  fontWeight: 600,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                  minWidth: 'auto',
                  px: 2
                }}
              >
                Browse Profiles
              </Button>
              <Button
                color="inherit"
                component={Link}
                to="/adult-services"
                sx={{ 
                  fontWeight: 600,
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                  minWidth: 'auto',
                  px: 2
                }}
              >
                Adult Services 🔥
              </Button>
              {isAuthenticated && (
                <Button
                  color="inherit"
                  component={Link}
                  to="/create-service"
                  sx={{ 
                    fontWeight: 600,
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
                    minWidth: 'auto',
                    px: 2
                  }}
                >
                  Create Service
                </Button>
              )}
            </Box>
          )}

          {/* Right Side */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isAuthenticated ? (
              <>
                {/* Notifications */}
                <NotificationSystem />

                {/* User Menu */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 600 }}>
                      {getUserDisplayName()}
                    </Typography>
                    {getSubscriptionBadge()}
                  </Box>
                  <IconButton
                    onClick={handleProfileMenuOpen}
                    sx={{ p: 0 }}
                  >
                    <Avatar
                      sx={{
                        bgcolor: colors.primary.white,
                        color: colors.primary.red,
                        width: 40,
                        height: 40
                      }}
                    >
                      {user?.username?.[0] || user?.email?.[0] || 'U'}
                    </Avatar>
                  </IconButton>
                </Box>
              </>
            ) : (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  color="inherit"
                  component={Link}
                  to="/login"
                  sx={{ fontWeight: 600 }}
                >
                  Login
                </Button>
                <Button
                  variant="contained"
                  component={Link}
                  to="/register"
                  sx={{
                    bgcolor: 'white',
                    color: colors.primary.red,
                    fontWeight: 600,
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.9)'
                    }
                  }}
                >
                  Register
                </Button>
              </Box>
            )}
          </Box>
        </Toolbar>
      </AppBar>

      {/* Render Menus */}
      {renderMenu}
      {renderMobileMenu}
    </>
  );
};

export default Navbar;
