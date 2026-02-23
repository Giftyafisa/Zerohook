/**
 * MobileHeader - Unified header component for mobile views
 * 
 * Provides consistent header experience across all mobile pages.
 * Features:
 * - Back button (optional)
 * - Title
 * - Right actions (search, notifications, etc.)
 * - Consistent styling matching bottom nav
 * 
 * @module components/layout/MobileHeader
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Typography, IconButton, Badge } from '@mui/material';
import { styled } from '@mui/system';
import {
  ArrowBack,
  Search,
  Notifications,
  MoreVert,
  FilterList,
  Close,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '../../store/slices/authSlice';
import { selectUnreadNotifications } from '../../store/slices/uiSlice';
import tokens from '../../theme/tokens';

// Header container with glass effect
const HeaderContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: '100%',
  padding: `0 ${tokens.spacing.md}px`,
  gap: tokens.spacing.sm,
});

// Logo area for home/main pages
const LogoArea = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.spacing.sm,
  cursor: 'pointer',
  padding: `${tokens.spacing.xs}px 0`,
});

const LogoIcon = styled(Box)({
  width: '32px',
  height: '32px',
  borderRadius: tokens.borderRadius.sm,
  background: `linear-gradient(135deg, ${tokens.colors.primary.main}30, ${tokens.colors.secondary.main}30)`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${tokens.colors.primary.main}50`,
  color: tokens.colors.primary.main,
  fontSize: '16px',
  fontWeight: tokens.fontWeight.bold,
});

const LogoText = styled(Typography)({
  fontFamily: '"Outfit", sans-serif',
  fontWeight: tokens.fontWeight.extrabold,
  fontSize: `${tokens.fontSize.lg}px`,
  background: `linear-gradient(135deg, ${tokens.colors.primary.main}, ${tokens.colors.secondary.main})`,
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
});

// Title for interior pages
const PageTitle = styled(Typography)({
  fontFamily: '"Outfit", sans-serif',
  fontWeight: tokens.fontWeight.semibold,
  fontSize: `${tokens.fontSize.lg}px`,
  color: tokens.colors.text.primary,
  flex: 1,
  textAlign: 'center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

// Action button with proper touch target
const ActionButton = styled(IconButton)({
  width: `${tokens.touchTarget.min}px`,
  height: `${tokens.touchTarget.min}px`,
  minWidth: `${tokens.touchTarget.min}px`,
  minHeight: `${tokens.touchTarget.min}px`,
  padding: tokens.spacing.sm,
  borderRadius: tokens.borderRadius.md,
  background: tokens.colors.overlay.light,
  border: `1px solid ${tokens.colors.border.primary}`,
  color: tokens.colors.text.secondary,
  transition: tokens.transition.fast,
  
  '&:hover, &:focus': {
    background: `${tokens.colors.primary.main}20`,
    borderColor: `${tokens.colors.primary.main}50`,
    color: tokens.colors.primary.main,
  },
  
  '&:active': {
    transform: 'scale(0.95)',
  },
});

// Back button specifically styled
const BackButton = styled(ActionButton)({
  background: 'transparent',
  border: 'none',
  marginLeft: `-${tokens.spacing.sm}px`,
});

// Notification badge
const NotificationBadge = styled(Badge)({
  '& .MuiBadge-badge': {
    background: tokens.colors.secondary.main,
    color: tokens.colors.text.primary,
    fontSize: `${tokens.fontSize.xs}px`,
    fontWeight: tokens.fontWeight.bold,
    minWidth: '16px',
    height: '16px',
    padding: '0 4px',
  },
});

// Actions container
const ActionsContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: tokens.spacing.sm,
});

// Spacer for centering title
const Spacer = styled(Box)({
  width: `${tokens.touchTarget.min}px`,
});

/**
 * MobileHeader Component
 * 
 * @param {Object} props
 * @param {'logo' | 'title' | 'back'} props.variant - Header style
 * @param {string} props.title - Page title (for 'title' and 'back' variants)
 * @param {boolean} props.showBack - Show back button
 * @param {boolean} props.showSearch - Show search button
 * @param {boolean} props.showNotifications - Show notifications
 * @param {boolean} props.showFilter - Show filter button
 * @param {boolean} props.showMore - Show more menu button
 * @param {number} props.notificationCount - Notification badge count
 * @param {Function} props.onBack - Custom back handler
 * @param {Function} props.onSearch - Search button handler
 * @param {Function} props.onFilter - Filter button handler
 * @param {Function} props.onMore - More button handler
 * @param {Function} props.onNotifications - Notifications button handler
 * @param {React.ReactNode} props.rightContent - Custom right content
 */
const MobileHeader = ({
  variant = 'logo',
  title,
  showBack = false,
  showSearch = false,
  showNotifications = false,
  showFilter = false,
  showMore = false,
  notificationCount = 0,
  onBack,
  onSearch,
  onFilter,
  onMore,
  onNotifications,
  rightContent,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const reduxNotificationCount = useSelector(selectUnreadNotifications);
  // Use Redux count if caller didn't pass an explicit count
  const effectiveNotificationCount = notificationCount || reduxNotificationCount;
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };
  
  const handleLogoClick = () => {
    navigate('/');
  };
  
  // Determine if we should show back button
  const shouldShowBack = showBack || variant === 'back';
  
  // Render left section
  const renderLeft = () => {
    if (shouldShowBack) {
      return (
        <BackButton onClick={handleBack} aria-label="Go back">
          <ArrowBack />
        </BackButton>
      );
    }
    
    if (variant === 'logo') {
      return (
        <LogoArea onClick={handleLogoClick}>
          <LogoIcon>Z</LogoIcon>
          <LogoText>Zerohook</LogoText>
        </LogoArea>
      );
    }
    
    // For title variant without back, add spacer for centering
    return <Spacer />;
  };
  
  // Render center section
  const renderCenter = () => {
    if (variant === 'logo') return null;
    
    return <PageTitle>{title || ''}</PageTitle>;
  };
  
  // Render right section
  const renderRight = () => {
    if (rightContent) return rightContent;
    
    return (
      <ActionsContainer>
        {showSearch && (
          <ActionButton onClick={onSearch} aria-label="Search">
            <Search fontSize="small" />
          </ActionButton>
        )}
        
        {showFilter && (
          <ActionButton onClick={onFilter} aria-label="Filter">
            <FilterList fontSize="small" />
          </ActionButton>
        )}
        
        {showNotifications && isAuthenticated && (
          <NotificationBadge badgeContent={effectiveNotificationCount} max={99}>
            <ActionButton onClick={onNotifications || (() => navigate('/notifications'))} aria-label="Notifications">
              <Notifications fontSize="small" />
            </ActionButton>
          </NotificationBadge>
        )}
        
        {showMore && (
          <ActionButton onClick={onMore} aria-label="More options">
            <MoreVert fontSize="small" />
          </ActionButton>
        )}
        
        {/* If nothing to show on right, add spacer for centering */}
        {!showSearch && !showFilter && !showNotifications && !showMore && (
          <Spacer />
        )}
      </ActionsContainer>
    );
  };
  
  return (
    <HeaderContainer>
      {renderLeft()}
      {renderCenter()}
      {renderRight()}
    </HeaderContainer>
  );
};

export default MobileHeader;
