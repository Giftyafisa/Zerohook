/**
 * MobileShell - Fixed layout shell for mobile views (TikTok/Telegram style)
 * 
 * Architecture:
 * ┌─────────────────────────────┐ ← Fixed Header (56px)
 * │         HEADER              │
 * ├─────────────────────────────┤
 * │                             │
 * │      SCROLLABLE CONTENT     │ ← Only this region scrolls
 * │         (flex: 1)           │
 * │                             │
 * ├─────────────────────────────┤
 * │       BOTTOM NAV            │ ← Fixed Bottom Nav (64px)
 * └─────────────────────────────┘
 * 
 * Key principles:
 * - Shell is FIXED, never moves
 * - Content area is the ONLY scrollable region
 * - Header/Footer have absolute positions
 * - Uses dvh (dynamic viewport height) for mobile browsers
 * 
 * @module components/layout/MobileShell
 */

import React from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/system';
import tokens from '../../theme/tokens';

// The outer shell - takes full viewport, never scrolls
const ShellContainer = styled(Box)({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  flexDirection: 'column',
  background: tokens.colors.background.primary,
  overflow: 'hidden', // Shell never scrolls
  // Use dvh for accurate mobile viewport
  height: '100vh',
  '@supports (height: 100dvh)': {
    height: '100dvh',
  },
});

// Fixed header region
const HeaderRegion = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'hasHeader',
})(({ hasHeader }) => ({
  flexShrink: 0,
  height: hasHeader ? `${tokens.layout.mobileHeaderHeight}px` : 0,
  minHeight: hasHeader ? `${tokens.layout.mobileHeaderHeight}px` : 0,
  // Add safe area padding for notched devices
  paddingTop: 'env(safe-area-inset-top, 0px)',
  background: `${tokens.colors.background.primary}f0`,
  backdropFilter: tokens.backdropBlur.md,
  borderBottom: hasHeader ? `1px solid ${tokens.colors.border.primary}` : 'none',
  zIndex: tokens.zIndex.appBar,
  position: 'relative',
}));

// Scrollable content region - THIS IS THE ONLY PART THAT SCROLLS
const ContentRegion = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'hasBottomNav' && prop !== 'noPadding',
})(({ noPadding }) => ({
  flex: 1,
  minHeight: 0, // Critical for flex scroll behavior
  overflow: 'auto',
  overflowX: 'hidden',
  WebkitOverflowScrolling: 'touch', // Smooth iOS scrolling
  scrollBehavior: 'smooth',
  // Default padding, can be overridden per-page
  padding: noPadding ? 0 : `${tokens.spacing.md}px`,
  // Ensure content doesn't get stuck behind nav
  paddingBottom: noPadding ? 0 : `${tokens.spacing.xl}px`,
}));

// Fixed bottom nav region
const NavRegion = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'hasBottomNav',
})(({ hasBottomNav }) => ({
  flexShrink: 0,
  height: hasBottomNav ? `${tokens.layout.bottomNavHeight}px` : 0,
  minHeight: hasBottomNav ? `${tokens.layout.bottomNavHeight}px` : 0,
  // Add safe area padding for home indicator on iPhone
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  background: `${tokens.colors.background.primary}f2`,
  backdropFilter: tokens.backdropBlur.md,
  borderTop: hasBottomNav ? `1px solid ${tokens.colors.border.primary}` : 'none',
  zIndex: tokens.zIndex.sticky,
  position: 'relative',
}));

/**
 * MobileShell - Creates a fixed-position shell layout for mobile
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.header - Header content (TopHeader or custom)
 * @param {React.ReactNode} props.children - Main content (scrollable)
 * @param {React.ReactNode} props.bottomNav - Bottom navigation
 * @param {boolean} props.showHeader - Whether to show header region (default: true)
 * @param {boolean} props.showBottomNav - Whether to show bottom nav (default: true)
 * @param {boolean} props.noPadding - Remove content padding (for full-bleed layouts)
 * @param {Object} props.contentStyle - Additional styles for content region
 */
const MobileShell = ({
  header,
  children,
  bottomNav,
  showHeader = true,
  showBottomNav = true,
  noPadding = false,
  contentStyle = {},
}) => {
  return (
    <ShellContainer>
      {/* Fixed Header */}
      <HeaderRegion hasHeader={showHeader && header}>
        {showHeader && header}
      </HeaderRegion>
      
      {/* Scrollable Content */}
      <ContentRegion noPadding={noPadding} sx={contentStyle}>
        {children}
      </ContentRegion>
      
      {/* Fixed Bottom Nav */}
      <NavRegion hasBottomNav={showBottomNav && bottomNav}>
        {showBottomNav && bottomNav}
      </NavRegion>
    </ShellContainer>
  );
};

export default MobileShell;
