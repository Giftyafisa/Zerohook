/**
 * DesktopSidebar - Sidebar navigation for desktop view
 * Mirrors the mobile bottom navigation with expanded desktop layout
 * Zerohook Platform
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Avatar, Chip, Divider } from '@mui/material';
import { styled, keyframes } from '@mui/system';
import {
  Home,
  Chat,
  CalendarToday,
  AccountBalanceWallet,
  Person,
  Explore,
  Whatshot,
  Security,
  Settings,
  Help,
  ExitToApp,
  VerifiedUser,
  Add
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser, selectIsAuthenticated, selectIsSubscribed, logout } from '../../store/slices/authSlice';

const glowPulse = keyframes`
  0%, 100% { box-shadow: 0 0 15px rgba(0, 242, 234, 0.3); }
  50% { box-shadow: 0 0 25px rgba(0, 242, 234, 0.5); }
`;

const GlassSidebar = styled(Box)({
  width: '280px',
  height: '100vh',
  position: 'fixed',
  left: 0,
  top: 0,
  background: 'rgba(15, 15, 19, 0.95)',
  backdropFilter: 'blur(20px)',
  borderRight: '1px solid rgba(255, 255, 255, 0.08)',
  display: 'flex',
  flexDirection: 'column',
  padding: '24px 16px',
  zIndex: 1200,
  overflowY: 'auto',
  
  '&::-webkit-scrollbar': {
    width: '4px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(0, 242, 234, 0.3)',
    borderRadius: '4px',
  },
});

const NavItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'active',
})(({ active }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: '14px',
  padding: '14px 18px',
  borderRadius: '14px',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  background: active ? 'rgba(0, 242, 234, 0.12)' : 'transparent',
  border: active ? '1px solid rgba(0, 242, 234, 0.3)' : '1px solid transparent',
  marginBottom: '4px',
  
  '& .nav-icon': {
    color: active ? '#00f2ea' : 'rgba(255, 255, 255, 0.6)',
    fontSize: '22px',
    transition: 'all 0.3s ease',
  },
  
  '& .nav-label': {
    color: active ? '#00f2ea' : 'rgba(255, 255, 255, 0.8)',
    fontWeight: active ? 600 : 500,
    fontSize: '15px',
    fontFamily: '"Outfit", sans-serif',
    transition: 'all 0.3s ease',
  },
  
  '&:hover': {
    background: active ? 'rgba(0, 242, 234, 0.15)' : 'rgba(255, 255, 255, 0.05)',
    
    '& .nav-icon': {
      color: '#00f2ea',
    },
    '& .nav-label': {
      color: '#ffffff',
    },
  },
}));

const LogoArea = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  marginBottom: '32px',
  padding: '0 8px',
});

const LogoText = styled(Typography)({
  fontFamily: '"Outfit", sans-serif',
  fontWeight: 800,
  fontSize: '26px',
  background: 'linear-gradient(135deg, #00f2ea, #ff0055)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
});

const UserProfileCard = styled(Box)({
  background: 'rgba(255, 255, 255, 0.03)',
  borderRadius: '16px',
  padding: '16px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  marginBottom: '24px',
});

const PremiumBadge = styled(Chip)({
  background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.2), rgba(255, 0, 85, 0.2))',
  color: '#00f2ea',
  border: '1px solid rgba(0, 242, 234, 0.3)',
  fontFamily: '"Outfit", sans-serif',
  fontWeight: 600,
  fontSize: '10px',
  height: '22px',
});

const FreeBadge = styled(Chip)({
  background: 'rgba(255, 255, 255, 0.1)',
  color: 'rgba(255, 255, 255, 0.6)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  fontFamily: '"Outfit", sans-serif',
  fontWeight: 600,
  fontSize: '10px',
  height: '22px',
});

const SectionLabel = styled(Typography)({
  fontSize: '11px',
  fontWeight: 600,
  color: 'rgba(255, 255, 255, 0.4)',
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  padding: '0 18px',
  marginTop: '20px',
  marginBottom: '8px',
});

const CreateServiceButton = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  padding: '14px 18px',
  background: 'linear-gradient(135deg, #00f2ea, #00c2bb)',
  borderRadius: '14px',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  marginTop: '16px',
  animation: `${glowPulse} 3s ease-in-out infinite`,
  
  '& .MuiSvgIcon-root': {
    color: '#0f0f13',
    fontSize: '20px',
  },
  
  '& .btn-label': {
    color: '#0f0f13',
    fontWeight: 700,
    fontSize: '14px',
    fontFamily: '"Outfit", sans-serif',
  },
  
  '&:hover': {
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(0, 242, 234, 0.4)',
  },
  
  '&:active': {
    transform: 'scale(0.98)',
  },
});

const DesktopSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  
  const user = useSelector(selectUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isSubscribed = useSelector(selectIsSubscribed);
  
  const isActive = (path) => location.pathname === path;
  
  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
    localStorage.removeItem('user');
    localStorage.removeItem('userProfile');
  };
  
  const mainNavItems = [
    { icon: <Home />, label: 'Home', path: '/' },
    { icon: <Explore />, label: 'Browse Profiles', path: '/profiles' },
    { icon: <Whatshot />, label: 'Adult Services', path: '/adult-services', accent: true },
  ];
  
  const userNavItems = [
    { icon: <Chat />, label: 'Messages', path: '/chat', badge: 2 },
    { icon: <CalendarToday />, label: 'Bookings', path: '/bookings' },
    { icon: <AccountBalanceWallet />, label: 'Wallet', path: '/wallet' },
    { icon: <Person />, label: 'My Profile', path: '/profile' },
  ];
  
  const settingsNavItems = [
    { icon: <Security />, label: 'Trust Score', path: '/trust-score' },
    { icon: <VerifiedUser />, label: 'Verification', path: '/verification' },
    { icon: <Settings />, label: 'Settings', path: '/settings' },
    { icon: <Help />, label: 'Help & Support', path: '/help' },
  ];
  
  const getUserDisplayName = () => {
    if (!user) return 'Guest';
    return user.username || user.email?.split('@')[0] || 'User';
  };
  
  return (
    <GlassSidebar>
      {/* Logo */}
      <LogoArea>
        <Box
          sx={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.2), rgba(255, 0, 85, 0.2))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(0, 242, 234, 0.3)',
          }}
        >
          <Typography sx={{ fontSize: '24px' }}>∞</Typography>
        </Box>
        <LogoText>Zerohook</LogoText>
      </LogoArea>
      
      {/* User Profile Card (if authenticated) */}
      {isAuthenticated && user && (
        <UserProfileCard>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', mb: 1.5 }}>
            <Avatar
              sx={{
                bgcolor: 'rgba(0, 242, 234, 0.2)',
                color: '#00f2ea',
                width: 44,
                height: 44,
                fontWeight: 700,
                border: '2px solid rgba(0, 242, 234, 0.4)',
              }}
            >
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </Avatar>
            <Box>
              <Typography
                sx={{
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '15px',
                  fontFamily: '"Outfit", sans-serif',
                }}
              >
                {getUserDisplayName()}
              </Typography>
              {isSubscribed ? (
                <PremiumBadge label={user?.subscription_tier?.toUpperCase() || 'PREMIUM'} size="small" />
              ) : (
                <FreeBadge label="FREE" size="small" />
              )}
            </Box>
          </Box>
          
          {/* Trust Score Bar */}
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                Trust Score
              </Typography>
              <Typography sx={{ fontSize: '11px', color: '#00f2ea', fontWeight: 600 }}>
                {user?.trustScore || 85}%
              </Typography>
            </Box>
            <Box
              sx={{
                height: '4px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  width: `${user?.trustScore || 85}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #00f2ea, #00c2bb)',
                  borderRadius: '2px',
                }}
              />
            </Box>
          </Box>
        </UserProfileCard>
      )}
      
      {/* Main Navigation */}
      <SectionLabel>Discover</SectionLabel>
      {mainNavItems.map((item) => (
        <NavItem
          key={item.path}
          active={isActive(item.path)}
          onClick={() => navigate(item.path)}
        >
          <Box 
            className="nav-icon" 
            component="span"
            sx={{ color: item.accent && !isActive(item.path) ? '#ff0055' : undefined }}
          >
            {item.icon}
          </Box>
          <Typography className="nav-label">{item.label}</Typography>
        </NavItem>
      ))}
      
      {/* User Navigation (authenticated only) */}
      {isAuthenticated && (
        <>
          <SectionLabel>Your Activity</SectionLabel>
          {userNavItems.map((item) => (
            <NavItem
              key={item.path}
              active={isActive(item.path)}
              onClick={() => navigate(item.path)}
            >
              <Box className="nav-icon" component="span">{item.icon}</Box>
              <Typography className="nav-label">{item.label}</Typography>
              {item.badge && (
                <Chip
                  label={item.badge}
                  size="small"
                  sx={{
                    ml: 'auto',
                    height: '20px',
                    minWidth: '20px',
                    background: '#ff0055',
                    color: '#fff',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}
                />
              )}
            </NavItem>
          ))}
          
          {/* Create Service Button */}
          <CreateServiceButton onClick={() => navigate('/create-service')}>
            <Add />
            <Typography className="btn-label">Create Service</Typography>
          </CreateServiceButton>
          
          <SectionLabel>Account</SectionLabel>
          {settingsNavItems.map((item) => (
            <NavItem
              key={item.path}
              active={isActive(item.path)}
              onClick={() => navigate(item.path)}
            >
              <Box className="nav-icon" component="span">{item.icon}</Box>
              <Typography className="nav-label">{item.label}</Typography>
            </NavItem>
          ))}
          
          <Divider sx={{ my: 2, borderColor: 'rgba(255, 255, 255, 0.08)' }} />
          
          {/* Logout */}
          <NavItem onClick={handleLogout}>
            <Box className="nav-icon" component="span" sx={{ color: '#ff0055 !important' }}>
              <ExitToApp />
            </Box>
            <Typography className="nav-label" sx={{ color: '#ff0055 !important' }}>
              Log Out
            </Typography>
          </NavItem>
        </>
      )}
      
      {/* Login/Register (if not authenticated) */}
      {!isAuthenticated && (
        <Box sx={{ mt: 'auto', pt: 3 }}>
          <NavItem onClick={() => navigate('/login')}>
            <Box className="nav-icon" component="span"><Person /></Box>
            <Typography className="nav-label">Login</Typography>
          </NavItem>
          <CreateServiceButton onClick={() => navigate('/register')}>
            <Add />
            <Typography className="btn-label">Get Started</Typography>
          </CreateServiceButton>
        </Box>
      )}
      
      {/* Safety Banner */}
      <Box
        sx={{
          mt: 'auto',
          pt: 3,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px',
          background: 'rgba(0, 242, 234, 0.08)',
          borderRadius: '12px',
          border: '1px solid rgba(0, 242, 234, 0.15)',
        }}
      >
        <VerifiedUser sx={{ color: '#00f2ea', fontSize: '18px' }} />
        <Typography
          sx={{
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.7)',
            fontFamily: '"Outfit", sans-serif',
          }}
        >
          All transactions protected by Escrow
        </Typography>
      </Box>
    </GlassSidebar>
  );
};

export default DesktopSidebar;
