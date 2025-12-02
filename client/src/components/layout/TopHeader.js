/**
 * TopHeader - Minimal header for tablet/mobile views
 * Clean, simple header with logo and essential actions
 * Zerohook Platform
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, IconButton, Badge, Menu, MenuItem, Divider } from '@mui/material';
import { styled, keyframes } from '@mui/system';
import {
  Search,
  Notifications,
  FilterList,
  Close
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectUser } from '../../store/slices/authSlice';

const glowPulse = keyframes`
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
`;

const HeaderContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px',
  background: 'rgba(15, 15, 19, 0.85)',
  backdropFilter: 'blur(20px)',
  borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  position: 'sticky',
  top: 0,
  zIndex: 1100,
});

const LogoArea = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  cursor: 'pointer',
});

const LogoIcon = styled(Box)({
  width: '36px',
  height: '36px',
  borderRadius: '10px',
  background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.2), rgba(255, 0, 85, 0.2))',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid rgba(0, 242, 234, 0.3)',
  color: '#00f2ea',
  fontSize: '20px',
});

const LogoText = styled(Typography)({
  fontFamily: '"Outfit", sans-serif',
  fontWeight: 800,
  fontSize: '22px',
  background: 'linear-gradient(135deg, #00f2ea, #ff0055)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
});

const ActionButton = styled(IconButton)({
  width: '42px',
  height: '42px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '12px',
  color: 'rgba(255, 255, 255, 0.8)',
  transition: 'all 0.3s ease',
  
  '&:hover': {
    background: 'rgba(0, 242, 234, 0.1)',
    borderColor: 'rgba(0, 242, 234, 0.3)',
    color: '#00f2ea',
  },
  
  '&:active': {
    transform: 'scale(0.95)',
  },
});

const NotificationBadge = styled(Badge)({
  '& .MuiBadge-badge': {
    background: '#ff0055',
    color: 'white',
    fontSize: '10px',
    fontWeight: 700,
    minWidth: '18px',
    height: '18px',
  },
});

const SearchOverlay = styled(Box)(({ open }) => ({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(15, 15, 19, 0.98)',
  zIndex: 1300,
  display: open ? 'flex' : 'none',
  flexDirection: 'column',
  padding: '20px',
  animation: open ? 'fadeIn 0.2s ease' : 'none',
  
  '@keyframes fadeIn': {
    from: { opacity: 0 },
    to: { opacity: 1 },
  },
}));

const SearchInput = styled('input')({
  width: '100%',
  padding: '16px 20px',
  paddingLeft: '50px',
  background: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: '14px',
  fontSize: '16px',
  color: '#ffffff',
  fontFamily: '"Outfit", sans-serif',
  outline: 'none',
  transition: 'all 0.3s ease',
  
  '&::placeholder': {
    color: 'rgba(255, 255, 255, 0.4)',
  },
  
  '&:focus': {
    borderColor: 'rgba(0, 242, 234, 0.5)',
    boxShadow: '0 0 20px rgba(0, 242, 234, 0.15)',
  },
});

const TopHeader = ({ title, showSearch = true, showNotifications = true, showFilter = false, onFilterClick }) => {
  const navigate = useNavigate();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user = useSelector(selectUser);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/profiles?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchOpen(false);
      setSearchQuery('');
    }
  };
  
  return (
    <>
      <HeaderContainer>
        {/* Logo / Title */}
        {title ? (
          <Typography
            sx={{
              fontFamily: '"Outfit", sans-serif',
              fontWeight: 600,
              fontSize: '20px',
              color: '#ffffff',
            }}
          >
            {title}
          </Typography>
        ) : (
          <LogoArea onClick={() => navigate('/')}>
            <LogoIcon>∞</LogoIcon>
            <LogoText>Zerohook</LogoText>
          </LogoArea>
        )}
        
        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: '10px' }}>
          {showSearch && (
            <ActionButton onClick={() => setSearchOpen(true)}>
              <Search fontSize="small" />
            </ActionButton>
          )}
          
          {showFilter && (
            <ActionButton onClick={onFilterClick}>
              <FilterList fontSize="small" />
            </ActionButton>
          )}
          
          {showNotifications && isAuthenticated && (
            <NotificationBadge badgeContent={3}>
              <ActionButton>
                <Notifications fontSize="small" />
              </ActionButton>
            </NotificationBadge>
          )}
        </Box>
      </HeaderContainer>
      
      {/* Search Overlay */}
      <SearchOverlay open={searchOpen}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px', mb: 3 }}>
          <Box sx={{ position: 'relative', flex: 1 }}>
            <Search
              sx={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255, 255, 255, 0.4)',
                fontSize: '22px',
              }}
            />
            <SearchInput
              placeholder="Search profiles, services..."
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
            />
          </Box>
          <ActionButton onClick={() => setSearchOpen(false)}>
            <Close fontSize="small" />
          </ActionButton>
        </Box>
        
        {/* Quick Search Categories */}
        <Box sx={{ mt: 2 }}>
          <Typography
            sx={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.4)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              mb: 2,
            }}
          >
            Quick Search
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {['Nearby', 'Verified', 'Online Now', 'Premium'].map((tag) => (
              <Box
                key={tag}
                onClick={() => {
                  navigate(`/profiles?filter=${tag.toLowerCase().replace(' ', '_')}`);
                  setSearchOpen(false);
                }}
                sx={{
                  padding: '10px 18px',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  
                  '&:hover': {
                    background: 'rgba(0, 242, 234, 0.1)',
                    borderColor: 'rgba(0, 242, 234, 0.3)',
                  },
                  
                  '&:active': {
                    transform: 'scale(0.97)',
                  },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontFamily: '"Outfit", sans-serif',
                  }}
                >
                  {tag}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </SearchOverlay>
    </>
  );
};

export default TopHeader;
