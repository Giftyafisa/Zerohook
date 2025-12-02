/**
 * MainLayout - Responsive layout wrapper
 * Desktop: Sidebar navigation + main content
 * Mobile: Bottom navigation
 * Zerohook Platform
 */

import React from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { styled } from '@mui/system';
import DesktopSidebar from './DesktopSidebar';
import MobileBottomNav from './MobileBottomNav';

const LayoutContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  background: '#0f0f13',
  position: 'relative',
}));

const MainContent = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'hasSidebar',
})(({ hasSidebar }) => ({
  marginLeft: hasSidebar ? '280px' : 0,
  minHeight: '100vh',
  paddingBottom: hasSidebar ? 0 : '80px', // Space for mobile bottom nav
  transition: 'margin-left 0.3s ease',
}));

const MainLayout = ({ children, showNavigation = true }) => {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg')); // >= 1200px
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // < 900px
  
  return (
    <LayoutContainer>
      {/* Desktop Sidebar */}
      {showNavigation && isDesktop && <DesktopSidebar />}
      
      {/* Main Content Area */}
      <MainContent hasSidebar={showNavigation && isDesktop}>
        {children}
      </MainContent>
      
      {/* Mobile Bottom Navigation */}
      {showNavigation && isMobile && <MobileBottomNav />}
    </LayoutContainer>
  );
};

export default MainLayout;
