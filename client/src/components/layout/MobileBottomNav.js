/**
 * MobileBottomNav - Bottom navigation for mobile view
 * Mirrors the mobile app's bottom navigation
 * Zerohook Platform
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Badge } from '@mui/material';
import { styled } from '@mui/system';
import {
  Home,
  Chat,
  CalendarToday,
  AccountBalanceWallet,
  Person
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../../store/slices/authSlice';

const BottomNavContainer = styled(Box)({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  background: 'rgba(15, 15, 19, 0.95)',
  backdropFilter: 'blur(20px)',
  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  padding: '8px 0',
  paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
  zIndex: 1200,
});

const NavItem = styled(Box)(({ active }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '8px 16px',
  borderRadius: '12px',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  minWidth: '60px',
  position: 'relative',
  
  '& .nav-icon': {
    color: active ? '#00f2ea' : 'rgba(255, 255, 255, 0.5)',
    fontSize: '24px',
    transition: 'all 0.3s ease',
  },
  
  '& .nav-label': {
    color: active ? '#00f2ea' : 'rgba(255, 255, 255, 0.5)',
    fontSize: '11px',
    fontWeight: active ? 600 : 500,
    marginTop: '4px',
    fontFamily: '"Outfit", sans-serif',
    transition: 'all 0.3s ease',
  },
  
  '&:active': {
    transform: 'scale(0.95)',
    
    '& .nav-icon, & .nav-label': {
      color: '#00f2ea',
    },
  },
}));

const NavBadge = styled(Box)({
  position: 'absolute',
  top: '2px',
  right: '8px',
  minWidth: '18px',
  height: '18px',
  padding: '0 5px',
  background: '#ff0055',
  borderRadius: '9px',
  fontSize: '10px',
  fontWeight: 700,
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  
  const isActive = (paths) => {
    if (Array.isArray(paths)) {
      return paths.some(path => location.pathname === path || location.pathname.startsWith(path + '/'));
    }
    return location.pathname === paths || location.pathname.startsWith(paths + '/');
  };
  
  const navItems = [
    { 
      icon: <Home />, 
      label: 'Home', 
      paths: ['/', '/profiles', '/adult-services'],
      onClick: () => navigate('/')
    },
    { 
      icon: <Chat />, 
      label: 'Messages', 
      paths: ['/chat', '/messages'],
      onClick: () => isAuthenticated ? navigate('/chat') : navigate('/login'),
      badge: isAuthenticated ? 2 : null
    },
    { 
      icon: <CalendarToday />, 
      label: 'Bookings', 
      paths: ['/bookings'],
      onClick: () => isAuthenticated ? navigate('/bookings') : navigate('/login')
    },
    { 
      icon: <AccountBalanceWallet />, 
      label: 'Wallet', 
      paths: ['/wallet', '/transactions'],
      onClick: () => isAuthenticated ? navigate('/wallet') : navigate('/login')
    },
    { 
      icon: <Person />, 
      label: 'Profile', 
      paths: ['/profile', '/dashboard', '/settings'],
      onClick: () => isAuthenticated ? navigate('/profile') : navigate('/login')
    },
  ];
  
  return (
    <BottomNavContainer>
      {navItems.map((item, index) => (
        <NavItem
          key={index}
          active={isActive(item.paths)}
          onClick={item.onClick}
        >
          <Box className="nav-icon" component="span">{item.icon}</Box>
          <Typography className="nav-label">{item.label}</Typography>
          {item.badge && <NavBadge>{item.badge}</NavBadge>}
        </NavItem>
      ))}
    </BottomNavContainer>
  );
};

export default MobileBottomNav;
