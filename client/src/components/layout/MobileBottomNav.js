/**
 * MobileBottomNav - Bottom navigation for mobile view
 * Mirrors the mobile app's bottom navigation
 * Zerohook Platform
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, Badge, Menu, MenuItem, Divider } from '@mui/material';
import { styled } from '@mui/system';
import {
  Home,
  Chat,
  CalendarToday,
  AccountBalanceWallet,
  Person,
  MoreHoriz,
  Info,
  Gavel,
  PrivacyTip,
  Help,
  Security,
  ContactSupport
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { selectIsAuthenticated } from '../../store/slices/authSlice';
import { 
  selectUnreadMessages,
  setUnreadMessages 
} from '../../store/slices/uiSlice';
import { API_BASE_URL } from '../../config/constants';
import tokens from '../../theme/tokens';

const BottomNavContainer = styled(Box)({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  height: '56px',
  background: `${tokens.colors.background.primary}f2`,
  backdropFilter: tokens.backdropBlur.md,
  borderTop: `1px solid ${tokens.colors.border.primary}`,
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  paddingBottom: 'env(safe-area-inset-bottom)',
  zIndex: tokens.zIndex.modal,
});

const NavItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'active',
})(({ active }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: `${tokens.spacing.sm}px ${tokens.spacing.lg}px`,
  borderRadius: `${tokens.borderRadius.md}px`,
  cursor: 'pointer',
  transition: tokens.transition.slow,
  minWidth: '60px',
  minHeight: `${tokens.touchTarget.min}px`,
  position: 'relative',
  
  '& .nav-icon': {
    color: active ? tokens.colors.primary.main : tokens.colors.text.tertiary,
    fontSize: '24px',
    transition: tokens.transition.slow,
  },
  
  '& .nav-label': {
    color: active ? tokens.colors.primary.main : tokens.colors.text.tertiary,
    fontSize: `${tokens.fontSize.xs}px`,
    fontWeight: active ? tokens.fontWeight.semibold : tokens.fontWeight.medium,
    marginTop: `${tokens.spacing.xs}px`,
    fontFamily: '"Outfit", sans-serif',
    transition: tokens.transition.slow,
  },
  
  '&:active': {
    transform: 'scale(0.95)',
    
    '& .nav-icon, & .nav-label': {
      color: tokens.colors.primary.main,
    },
  },
}));

const NavBadge = styled(Box)({
  position: 'absolute',
  top: '2px',
  right: `${tokens.spacing.sm}px`,
  minWidth: '18px',
  height: '18px',
  padding: `0 ${tokens.spacing.xs}px`,
  background: tokens.colors.secondary.main,
  borderRadius: tokens.borderRadius.full,
  fontSize: `${tokens.fontSize.xs}px`,
  fontWeight: tokens.fontWeight.bold,
  color: tokens.colors.text.primary,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: tokens.shadows.glow.secondary,
});

const MobileBottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const unreadMessages = useSelector(selectUnreadMessages);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState(null);
  
  // Fetch unread message count on mount
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!isAuthenticated) return;
      
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/chat/unread-count`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          dispatch(setUnreadMessages(data.unreadCount || 0));
        }
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };
    
    fetchUnreadCount();
  }, [isAuthenticated, dispatch]);
  
  const isActive = (paths) => {
    if (Array.isArray(paths)) {
      return paths.some(path => location.pathname === path || location.pathname.startsWith(path + '/'));
    }
    return location.pathname === paths || location.pathname.startsWith(paths + '/');
  };

  const handleMoreClick = (event) => {
    setMoreMenuAnchor(event.currentTarget);
  };

  const handleMoreClose = () => {
    setMoreMenuAnchor(null);
  };

  const moreMenuItems = [
    { icon: <Info />, label: 'About Us', path: '/about' },
    { icon: <Security />, label: 'Trust & Safety', path: '/trust-safety' },
    { icon: <Help />, label: 'How it Works', path: '/how-it-works' },
    { icon: <PrivacyTip />, label: 'Privacy Policy', path: '/privacy' },
    { icon: <Gavel />, label: 'Terms of Service', path: '/terms' },
    { icon: <ContactSupport />, label: 'Contact Us', path: '/contact' },
  ];
  
  const navItems = [
    { 
      icon: <Home />, 
      label: 'Home',
      ariaLabel: 'Go to home page', 
      paths: ['/', '/profiles', '/adult-services'],
      onClick: () => navigate('/')
    },
    { 
      icon: <Chat />, 
      label: 'Messages',
      ariaLabel: unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'View messages', 
      paths: ['/chat', '/messages'],
      onClick: () => isAuthenticated ? navigate('/chat') : navigate('/login'),
      badge: isAuthenticated && unreadMessages > 0 ? unreadMessages : null
    },
    { 
      icon: <CalendarToday />, 
      label: 'Bookings',
      ariaLabel: 'View your bookings', 
      paths: ['/bookings'],
      onClick: () => isAuthenticated ? navigate('/bookings') : navigate('/login')
    },
    { 
      icon: <AccountBalanceWallet />, 
      label: 'Wallet',
      ariaLabel: 'View wallet and transactions', 
      paths: ['/wallet', '/transactions'],
      onClick: () => isAuthenticated ? navigate('/wallet') : navigate('/login')
    },
    { 
      icon: <Person />, 
      label: 'Profile',
      ariaLabel: 'View your profile', 
      paths: ['/profile', '/dashboard', '/settings'],
      onClick: () => isAuthenticated ? navigate('/profile') : navigate('/login')
    },
    { 
      icon: <MoreHoriz />, 
      label: 'More',
      ariaLabel: 'More options', 
      paths: ['/about', '/privacy', '/terms', '/contact', '/trust-safety', '/how-it-works'],
      onClick: handleMoreClick,
      isMore: true
    },
  ];
  
  return (
    <>
      <BottomNavContainer role="navigation" aria-label="Main navigation">
        {navItems.map((item, index) => (
          <NavItem
            key={index}
            active={isActive(item.paths)}
            onClick={item.onClick}
            role="button"
            tabIndex={0}
            aria-label={item.ariaLabel}
            aria-current={isActive(item.paths) ? 'page' : undefined}
            aria-haspopup={item.isMore ? 'menu' : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                item.onClick(e);
              }
            }}
          >
            <Box className="nav-icon" component="span" aria-hidden="true">{item.icon}</Box>
            <Typography className="nav-label" aria-hidden="true">{item.label}</Typography>
            {item.badge && <NavBadge aria-hidden="true">{item.badge}</NavBadge>}
          </NavItem>
        ))}
      </BottomNavContainer>

      {/* More Menu */}
      <Menu
        anchorEl={moreMenuAnchor}
        open={Boolean(moreMenuAnchor)}
        onClose={handleMoreClose}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        PaperProps={{
          sx: {
            bgcolor: tokens.colors.background.secondary,
            backdropFilter: tokens.backdropBlur.md,
            border: `1px solid ${tokens.colors.border.primary}`,
            borderRadius: `${tokens.borderRadius.lg}px`,
            minWidth: 200,
            mb: 1,
          }
        }}
      >
        {moreMenuItems.map((item, index) => (
          <MenuItem
            key={index}
            onClick={() => {
              navigate(item.path);
              handleMoreClose();
            }}
            sx={{
              color: tokens.colors.text.primary,
              py: 1.5,
              gap: 1.5,
              '&:hover': {
                bgcolor: `${tokens.colors.primary.main}20`,
              }
            }}
          >
            <Box sx={{ color: tokens.colors.text.secondary }}>{item.icon}</Box>
            <Typography sx={{ fontSize: '0.9rem' }}>{item.label}</Typography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

export default MobileBottomNav;
