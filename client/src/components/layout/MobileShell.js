/**
 * MobileShell - Fixed layout shell for mobile views (TikTok/Telegram style)
 * 
 * Architecture:
 * ┌─────────────────────────────┐ ← Safe Area Top
 * │         HEADER              │ ← Fixed Header (56px)
 * ├─────────────────────────────┤
 * │                             │
 * │      SCROLLABLE CONTENT     │ ← Only this region scrolls
 * │         (flex: 1)           │
 * │                             │
 * ├─────────────────────────────┤
 * │       BOTTOM NAV            │ ← Fixed Bottom Nav (52px)
 * └─────────────────────────────┘ ← Safe Area Bottom
 * 
 * Key principles:
 * - Shell is FIXED, never moves (TikTok-style)
 * - Content area is the ONLY scrollable region
 * - Pure black background for immersive experience
 * - Safe areas respected for notches/home indicator
 * - Pixel-perfect spacing with 8px grid
 * 
 * @module components/layout/MobileShell
 */

import React from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/system';
import tokens from '../../theme/tokens';

// The outer shell - takes full viewport, NEVER scrolls
// Uses pure black (#000) for TikTok-style immersive experience
const ShellContainer = styled(Box)({
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100vw',
  maxWidth: '100vw',
  display: 'flex',
  flexDirection: 'column',
  background: '#000', // Pure black for immersive TikTok feel
  overflow: 'hidden',
  overflowX: 'hidden', // CRITICAL: Explicitly prevent horizontal overflow
  // Use dvh for accurate mobile viewport (handles address bar)
  height: '100vh',
  '@supports (height: 100dvh)': {
    height: '100dvh',
  },
  // Prevent any overscroll behavior
  overscrollBehavior: 'none',
  touchAction: 'manipulation',
  // CRITICAL: CSS containment for performance and overflow prevention
  contain: 'layout style paint',
  boxSizing: 'border-box',
});

// Fixed header region - locked at top with safe area
const HeaderRegion = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'hasHeader',
})(({ hasHeader }) => ({
  flexShrink: 0,
  width: '100%',
  maxWidth: '100vw',
  height: hasHeader ? `${tokens.layout.mobileHeaderHeight}px` : 0,
  minHeight: hasHeader ? `${tokens.layout.mobileHeaderHeight}px` : 0,
  // Safe area for notched devices (iPhone X+)
  paddingTop: 'env(safe-area-inset-top, 0px)',
  background: hasHeader ? 'rgba(0, 0, 0, 0.95)' : 'transparent',
  backdropFilter: hasHeader ? 'blur(20px) saturate(180%)' : 'none',
  WebkitBackdropFilter: hasHeader ? 'blur(20px) saturate(180%)' : 'none',
  borderBottom: hasHeader ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
  zIndex: tokens.zIndex.appBar,
  position: 'relative',
  // Subtle shadow for depth
  boxShadow: hasHeader ? '0 1px 0 rgba(255, 255, 255, 0.05)' : 'none',
}));

// Scrollable content region - THIS IS THE ONLY PART THAT SCROLLS
const ContentRegion = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'noPadding' && prop !== 'isFullBleed',
})(({ noPadding, isFullBleed }) => ({
  flex: 1,
  width: '100%',
  maxWidth: '100vw', // CRITICAL: Prevent content from exceeding viewport
  minWidth: 0, // Allow flex shrink
  minHeight: 0, // Critical for flex scroll behavior
  overflow: 'auto',
  overflowX: 'hidden', // CRITICAL: Prevent horizontal scroll
  WebkitOverflowScrolling: 'touch', // Smooth iOS momentum scrolling
  scrollBehavior: 'smooth',
  // Full bleed for immersive content (TikTok feed, etc.)
  padding: isFullBleed || noPadding ? 0 : `${tokens.spacing.md}px`,
  paddingBottom: isFullBleed || noPadding ? 0 : `${tokens.spacing.lg}px`,
  // Hide scrollbar for cleaner look (TikTok style)
  '&::-webkit-scrollbar': {
    display: 'none',
  },
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
  // Prevent rubber-banding on iOS
  overscrollBehavior: 'contain',
  // CRITICAL: Box sizing for proper padding calculation
  boxSizing: 'border-box',
  // Children should not overflow
  '& > *': {
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
}));

// Fixed bottom nav region - locked at bottom with safe area
const NavRegion = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'hasBottomNav' && prop !== 'isOverlay',
})(({ hasBottomNav, isOverlay }) => ({
  flexShrink: 0,
  width: '100%',
  maxWidth: '100vw',
  height: hasBottomNav ? `${tokens.layout.bottomNavHeight}px` : 0,
  minHeight: hasBottomNav ? `${tokens.layout.bottomNavHeight}px` : 0,
  // Safe area for home indicator (iPhone)
  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
  background: isOverlay 
    ? 'linear-gradient(0deg, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.85) 60%, rgba(0,0,0,0.6) 80%, transparent 100%)'
    : 'rgba(0, 0, 0, 0.95)',
  backdropFilter: hasBottomNav ? 'blur(20px) saturate(180%)' : 'none',
  WebkitBackdropFilter: hasBottomNav ? 'blur(20px) saturate(180%)' : 'none',
  borderTop: hasBottomNav && !isOverlay ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
  zIndex: tokens.zIndex.bottomNav,
  position: 'relative',
}));

/**
 * MobileShell - Creates a fixed-position shell layout for mobile (TikTok/Telegram style)
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.header - Header content
 * @param {React.ReactNode} props.children - Main content (scrollable)
 * @param {React.ReactNode} props.bottomNav - Bottom navigation
 * @param {boolean} props.showHeader - Whether to show header region (default: true)
 * @param {boolean} props.showBottomNav - Whether to show bottom nav (default: true)
 * @param {boolean} props.noPadding - Remove content padding (for full-bleed layouts)
 * @param {boolean} props.isFullBleed - Full immersive content (TikTok feed style)
 * @param {boolean} props.overlayNav - Bottom nav overlays content (gradient fade)
 * @param {Object} props.contentStyle - Additional styles for content region
 */
const MobileShell = ({
  header,
  children,
  bottomNav,
  showHeader = true,
  showBottomNav = true,
  noPadding = false,
  isFullBleed = false,
  overlayNav = false,
  contentStyle = {},
}) => {
  return (
    <ShellContainer>
      {/* Fixed Header */}
      <HeaderRegion hasHeader={showHeader && header}>
        {showHeader && header}
      </HeaderRegion>
      
      {/* Scrollable Content */}
      <ContentRegion 
        noPadding={noPadding} 
        isFullBleed={isFullBleed}
        sx={contentStyle}
      >
        {children}
      </ContentRegion>
      
      {/* Fixed Bottom Nav */}
      <NavRegion 
        hasBottomNav={showBottomNav && bottomNav}
        isOverlay={overlayNav}
      >
        {showBottomNav && bottomNav}
      </NavRegion>
    </ShellContainer>
  );
};

export default MobileShell;
