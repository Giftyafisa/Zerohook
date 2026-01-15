/**
 * TikTok-Style Mobile Layout Wrapper
 * 
 * Provides a consistent, solid mobile layout structure across all pages:
 * - Full-height viewport with proper safe areas
 * - Dark theme optimized for mobile
 * - Snap scrolling sections
 * - Bottom navigation friendly
 * - No overflow issues
 */
import React from 'react';
import { Box, useTheme, useMediaQuery } from '@mui/material';
import MobileBottomNav from './layout/MobileBottomNav';

/**
 * TikTok-Style Mobile Page Container
 * Use this wrapper for ALL mobile pages to ensure consistent layout
 */
export const MobilePageContainer = ({ 
  children, 
  showNav = true,
  fullScreen = false,
  snapScroll = false,
  backgroundColor = '#0a0a0f',
  noPadding = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Desktop fallback - just render children normally
  if (!isMobile && !fullScreen) {
    return children;
  }

  return (
    <Box
      sx={{
        // Full viewport - accounts for mobile browser chrome
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100dvh', // Dynamic viewport height for mobile
        maxHeight: '-webkit-fill-available', // Safari fix
        
        // Dark background
        bgcolor: backgroundColor,
        color: '#fff',
        
        // Prevent any overflow
        overflow: 'hidden',
        
        // Layout
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Main Content Area */}
      <Box
        sx={{
          flex: 1,
          overflow: snapScroll ? 'hidden' : 'auto',
          overflowX: 'hidden',
          
          // Smooth scrolling
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch',
          
          // Hide scrollbar but allow scrolling
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          
          // Snap scrolling if enabled
          ...(snapScroll && {
            scrollSnapType: 'y mandatory',
            '& > *': {
              scrollSnapAlign: 'start',
            },
          }),
          
          // Content padding (unless disabled)
          ...(!noPadding && !fullScreen && {
            pt: 'env(safe-area-inset-top)',
            pb: showNav ? '80px' : 'env(safe-area-inset-bottom)',
          }),
          
          // Full screen mode - no padding, content fills entire area
          ...(fullScreen && {
            pb: showNav ? '60px' : 0,
          }),
        }}
      >
        {children}
      </Box>

      {/* Bottom Navigation */}
      {showNav && <MobileBottomNav />}
    </Box>
  );
};

/**
 * Full-Screen Section (like TikTok video)
 * Each section fills the entire viewport
 */
export const FullScreenSection = ({ children, gradient, backgroundColor }) => (
  <Box
    sx={{
      width: '100%',
      height: '100dvh',
      minHeight: '100dvh',
      maxHeight: '100dvh',
      position: 'relative',
      overflow: 'hidden',
      scrollSnapAlign: 'start',
      
      // Background
      bgcolor: backgroundColor || '#0a0a0f',
      ...(gradient && {
        background: gradient,
      }),
    }}
  >
    {children}
  </Box>
);

/**
 * Scrollable Content Section
 * For pages that need scrolling within a section
 */
export const ScrollableSection = ({ children, maxHeight = '100%' }) => (
  <Box
    sx={{
      width: '100%',
      maxHeight,
      overflow: 'auto',
      WebkitOverflowScrolling: 'touch',
      
      '&::-webkit-scrollbar': {
        width: '4px',
      },
      '&::-webkit-scrollbar-thumb': {
        background: 'rgba(255,255,255,0.2)',
        borderRadius: '4px',
      },
    }}
  >
    {children}
  </Box>
);

/**
 * Bottom Gradient Overlay
 * Protects text readability over images
 */
export const BottomGradientOverlay = ({ height = '60%' }) => (
  <Box
    sx={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height,
      background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 40%, transparent 100%)',
      pointerEvents: 'none',
    }}
  />
);

/**
 * Top Gradient Overlay
 * For status bar protection
 */
export const TopGradientOverlay = ({ height = '120px' }) => (
  <Box
    sx={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height,
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)',
      pointerEvents: 'none',
      zIndex: 5,
    }}
  />
);

/**
 * Action Button Row
 * TikTok-style right-side action buttons
 */
export const ActionButtonColumn = ({ children }) => (
  <Box
    sx={{
      position: 'absolute',
      right: 16,
      bottom: 120,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      alignItems: 'center',
      zIndex: 10,
    }}
  >
    {children}
  </Box>
);

/**
 * Content Overlay
 * For text content over images (left side)
 */
export const ContentOverlay = ({ children }) => (
  <Box
    sx={{
      position: 'absolute',
      left: 16,
      right: 80, // Leave space for action buttons
      bottom: 100,
      zIndex: 10,
    }}
  >
    {children}
  </Box>
);

/**
 * Mobile Header
 * Minimal header for mobile pages
 */
export const MobileHeader = ({ 
  title, 
  leftAction, 
  rightAction,
  transparent = true,
}) => (
  <Box
    sx={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 20,
      pt: 'env(safe-area-inset-top)',
      px: 2,
      py: 1.5,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      
      ...(transparent ? {
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 100%)',
      } : {
        bgcolor: 'rgba(10,10,15,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
      }),
    }}
  >
    <Box sx={{ minWidth: 40 }}>{leftAction}</Box>
    <Box sx={{ 
      flex: 1, 
      textAlign: 'center',
      fontWeight: 600,
      fontSize: '1rem',
      color: '#fff',
    }}>
      {title}
    </Box>
    <Box sx={{ minWidth: 40, textAlign: 'right' }}>{rightAction}</Box>
  </Box>
);

export default MobilePageContainer;
