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
  ContactSupport,
  Search,
  Favorite
} from '@mui/icons-material';
import { useSelector, useDispatch } from 'react-redux';
import { selectIsAuthenticated } from '../../store/slices/authSlice';
import { 
  selectUnreadMessages,
  setUnreadMessages 
} from '../../store/slices/uiSlice';
import apiClient from '../../services/apiClient';
import tokens from '../../theme/tokens';

// TikTok/Telegram style bottom nav - fixed position, proper touch targets
const BottomNavContainer = styled(Box)({
  // Position handled by MobileShell, but keep for standalone use
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  height: '100%',
  width: '100%',
  padding: `0 ${tokens.spacing.sm}px`,
  background: 'transparent', // Background handled by shell
});

// Nav item with proper touch target - TikTok style compact layout
const NavItem = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'active',
})(({ active }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  // Flexible sizing - allow labels to fit without wrapping
  minWidth: '52px',
  minHeight: '44px', // WCAG minimum touch target
  flex: '1 1 0', // Equal flexible distribution
  maxWidth: '72px', // Prevent oversized items
  padding: '2px 4px',
  gap: '2px', // Slight gap between icon and label
  borderRadius: `${tokens.borderRadius.md}px`,
  cursor: 'pointer',
  transition: tokens.transition.fast,
  position: 'relative',
  // Haptic feedback styling
  WebkitTapHighlightColor: 'transparent',
  userSelect: 'none',
  
  // Active state indicator - subtle dot above icon
  '&::before': {
    content: '""',
    position: 'absolute',
    top: '0px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: active ? '4px' : 0,
    height: '4px',
    borderRadius: '50%',
    background: tokens.colors.primary.main,
    transition: tokens.transition.fast,
  },
  
  '& .nav-icon': {
    color: active ? tokens.colors.primary.main : tokens.colors.text.tertiary,
    fontSize: '20px', // Compact icon size
    transition: tokens.transition.fast,
    lineHeight: 1,
  },
  
  '& .nav-label': {
    color: active ? tokens.colors.primary.main : tokens.colors.text.tertiary,
    fontSize: '10px', // Slightly larger for readability
    fontWeight: active ? tokens.fontWeight.semibold : tokens.fontWeight.medium,
    marginTop: '0', // No margin, use gap instead
    fontFamily: '"Outfit", sans-serif',
    transition: tokens.transition.fast,
    lineHeight: 1,
    letterSpacing: '0.2px',
    whiteSpace: 'nowrap', // CRITICAL: Prevent text wrapping
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: 'center',
    maxWidth: '100%',
  },
  
  // Touch feedback
  '&:active': {
    transform: 'scale(0.92)',
    background: `${tokens.colors.primary.main}10`,
    
    '& .nav-icon, & .nav-label': {
      color: tokens.colors.primary.main,
    },
  },
  
  // Hover for desktop/tablets
  '@media (hover: hover)': {
    '&:hover': {
      background: `${tokens.colors.primary.main}08`,
      
      '& .nav-icon, & .nav-label': {
        color: active ? tokens.colors.primary.main : tokens.colors.text.secondary,
      },
    },
  },
}));

// Badge with better positioning
const NavBadge = styled(Box)({
  position: 'absolute',
  top: '0px',
  right: '6px',
  minWidth: '18px',
  height: '18px',
  padding: '0 5px',
  background: tokens.colors.secondary.main,
  borderRadius: tokens.borderRadius.full,
  fontSize: '10px',
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
        const response = await apiClient.get('/chat/unread-count');
        dispatch(setUnreadMessages(response.data.unreadCount || 0));
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

  // More menu items - includes bookings for authenticated users
  const moreMenuItems = [
    ...(isAuthenticated ? [
      { icon: <CalendarToday />, label: 'Bookings', path: '/bookings' }
    ] : []),
    { icon: <Info />, label: 'About Us', path: '/about' },
    { icon: <Security />, label: 'Trust & Safety', path: '/trust-safety' },
    { icon: <Help />, label: 'How it Works', path: '/how-it-works' },
    { icon: <PrivacyTip />, label: 'Privacy Policy', path: '/privacy' },
    { icon: <Gavel />, label: 'Terms of Service', path: '/terms' },
    { icon: <ContactSupport />, label: 'Contact Us', path: '/contact' },
  ];
  
  // Navigation items based on authentication status
  const unauthenticatedNavItems = [
    { 
      icon: <Home />, 
      label: 'Home',
      ariaLabel: 'Go to home page', 
      paths: ['/'],
      onClick: () => navigate('/')
    },
    { 
      icon: <Search />, 
      label: 'Browse',
      ariaLabel: 'Browse profiles', 
      paths: ['/profiles', '/browse'],
      onClick: () => navigate('/profiles')
    },
    { 
      icon: <Favorite />, 
      label: 'Services',
      ariaLabel: 'Browse adult services', 
      paths: ['/adult-services'],
      onClick: () => navigate('/adult-services')
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

  const authenticatedNavItems = [
    { 
      icon: <Search />, 
      label: 'Browse',
      ariaLabel: 'Browse profiles', 
      paths: ['/profiles', '/browse'],
      onClick: () => navigate('/profiles')
    },
    { 
      icon: <Favorite />, 
      label: 'Services',
      ariaLabel: 'Browse adult services', 
      paths: ['/adult-services'],
      onClick: () => navigate('/adult-services')
    },
    { 
      icon: <Chat />, 
      label: 'Messages',
      ariaLabel: unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'View messages', 
      paths: ['/chat', '/messages'],
      onClick: () => navigate('/chat'),
      badge: unreadMessages > 0 ? unreadMessages : null
    },
    { 
      icon: <AccountBalanceWallet />, 
      label: 'Wallet',
      ariaLabel: 'View wallet and transactions', 
      paths: ['/wallet', '/transactions'],
      onClick: () => navigate('/wallet')
    },
    { 
      icon: <Person />, 
      label: 'Profile',
      ariaLabel: 'View your profile', 
      paths: ['/profile', '/dashboard', '/settings'],
      onClick: () => navigate('/profile')
    },
  ];

  // Select nav items based on authentication
  const navItems = isAuthenticated ? authenticatedNavItems : unauthenticatedNavItems;
  
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
            minWidth: { xs: 'calc(100vw - 32px)', sm: 200 }, // FIXED: Responsive minWidth
            maxWidth: 'calc(100vw - 32px)', // FIXED: Prevent overflow
            mb: 1,
          }
        }}
      >
        {moreMenuItems.map((item, index) => (
          <React.Fragment key={index}>
            {index === 1 && isAuthenticated && <Divider sx={{ my: 0.5, borderColor: tokens.colors.border.primary }} />}
            <MenuItem
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
          </React.Fragment>
        ))}
      </Menu>
    </>
  );
};

export default MobileBottomNav;
