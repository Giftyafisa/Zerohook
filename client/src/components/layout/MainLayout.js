/**
 * MainLayout - Responsive layout wrapper
 * 
 * Desktop (≥900px): Sidebar navigation + scrollable main content
 * Mobile/Tablet (<900px): Fixed shell with header + content + bottom nav (TikTok style)
 * 
 * Key Architecture:
 * - Mobile uses fixed positioning shell (MobileShell)
 * - Desktop uses traditional flow layout with sidebar
 * - Consistent spacing and navigation across breakpoints
 * 
 * Zerohook Platform
 */

import React from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useLocation } from 'react-router-dom';
import { styled } from '@mui/system';
import DesktopSidebar from './DesktopSidebar';
import MobileBottomNav from './MobileBottomNav';
import MobileShell from './MobileShell';
import MobileHeader from './MobileHeader';
import tokens from '../../theme/tokens';
import { isChatRoute, isFullHeightRoute } from '../../utils/routeUtils';

// Desktop layout container
const DesktopContainer = styled(Box)({
  minHeight: '100vh',
  background: tokens.colors.background.primary,
  position: 'relative',
});

// Desktop content area with sidebar offset
const DesktopContent = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'hasSidebar',
})(({ hasSidebar }) => ({
  marginLeft: hasSidebar ? `${tokens.layout.sidebarWidth}px` : 0,
  minHeight: '100vh',
  transition: 'margin-left 0.3s ease',
}));

/**
 * Get header configuration based on current route
 */
const getHeaderConfig = (pathname) => {
  // Home page - fullscreen immersive on mobile
  if (pathname === '/' || pathname === '/home') {
    return { showHeader: false, fullScreen: true };
  }
  
  // Browse/feed routes on mobile - TikTok feed handles its own UI
  // On mobile, we hide the shell header for immersive experience
  if (pathname === '/profiles' || pathname === '/browse') {
    return { showHeader: false, fullScreen: true };
  }
  
  // Adult services - TikTok-style full screen on mobile
  if (pathname === '/adult-services') {
    return { showHeader: false, fullScreen: true };
  }
  
  // Chat routes - no header (chat has its own)
  if (isChatRoute(pathname)) {
    return { showHeader: false };
  }
  
  // Detail pages - back button
  if (pathname.includes('/profile/') || pathname.includes('/adult-services/')) {
    return { variant: 'back', showMore: true };
  }
  
  // Profile/settings pages
  if (pathname === '/profile' || pathname === '/dashboard') {
    return { variant: 'title', title: 'Profile', showNotifications: true };
  }
  
  if (pathname === '/wallet') {
    return { variant: 'title', title: 'Wallet' };
  }
  
  if (pathname === '/bookings') {
    return { variant: 'title', title: 'Bookings' };
  }
  
  // Default - title with back
  return { variant: 'back', title: 'Zerohook' };
};

const MainLayout = ({ children, showNavigation = true }) => {
  const theme = useTheme();
  const location = useLocation();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md')); // >= 900px
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // < 900px
  
  // Get header configuration for current route
  const headerConfig = getHeaderConfig(location.pathname);
  const showHeader = headerConfig.showHeader !== false;
  const isFullScreen = headerConfig.fullScreen === true; // TikTok-style full screen
  
  // Check if this is a full-height route (chat, etc.)
  const isFullHeight = isFullHeightRoute(location.pathname);
  
  // Desktop Layout
  if (isDesktop) {
    return (
      <DesktopContainer>
        {/* Desktop Sidebar */}
        {showNavigation && <DesktopSidebar />}
        
        {/* Main Content Area */}
        <DesktopContent hasSidebar={showNavigation}>
          {children}
        </DesktopContent>
      </DesktopContainer>
    );
  }
  
  // Full-screen mode (TikTok feed) - completely immersive, no chrome
  if (isFullScreen) {
    return (
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          bgcolor: '#000',
          display: 'flex',
          flexDirection: 'column',
          // Prevent any overscroll
          overscrollBehavior: 'none',
          touchAction: 'manipulation',
        }}
      >
        {/* Full screen content - takes all space */}
        <Box 
          sx={{ 
            flex: 1, 
            position: 'relative', 
            overflow: 'hidden', // Content handles its own scrolling
          }}
        >
          {children}
        </Box>
        
        {/* Bottom nav overlaid on content with gradient fade */}
        {showNavigation && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 100,
              // TikTok-style gradient fade
              background: 'linear-gradient(0deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.85) 50%, rgba(0,0,0,0.5) 75%, transparent 100%)',
              pt: 4,
              pb: 'env(safe-area-inset-bottom, 0px)',
            }}
          >
            <MobileBottomNav />
          </Box>
        )}
      </Box>
    );
  }
  
  // Mobile/Tablet Layout - Fixed Shell (TikTok/Telegram style)
  return (
    <MobileShell
      header={showHeader ? <MobileHeader {...headerConfig} /> : null}
      bottomNav={showNavigation ? <MobileBottomNav /> : null}
      showHeader={showHeader}
      showBottomNav={showNavigation && !isChatRoute(location.pathname)}
      noPadding={isFullHeight || isChatRoute(location.pathname)}
    >
      {children}
    </MobileShell>
  );
};

export default MainLayout;

