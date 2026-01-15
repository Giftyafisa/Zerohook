/**
 * MobilePageWrapper - Wrapper for pages that adapts to the mobile shell
 * 
 * On mobile, the header is handled by MobileShell/MainLayout.
 * On desktop, pages can render their own headers.
 * 
 * This component provides a consistent page structure that works
 * with the TikTok/Telegram-style shell on mobile.
 * 
 * @module components/layout/MobilePageWrapper
 */

import React from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import tokens from '../../theme/tokens';

/**
 * MobilePageWrapper Component
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Page content
 * @param {React.ReactNode} props.desktopHeader - Header to show only on desktop
 * @param {boolean} props.noPadding - Remove default padding
 * @param {boolean} props.fullHeight - Make content fill available height
 * @param {Object} props.sx - Additional styles
 */
const MobilePageWrapper = ({
  children,
  desktopHeader,
  noPadding = false,
  fullHeight = false,
  sx = {},
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md')); // < 900px
  
  return (
    <Box
      sx={{
        // On mobile, fill the shell's content area
        // On desktop, use min-height for scrolling
        minHeight: isMobile ? '100%' : '100vh',
        ...(fullHeight && {
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
        }),
        // Default background
        background: tokens.colors.background.primary,
        ...sx,
      }}
    >
      {/* Desktop header only - mobile header handled by shell */}
      {!isMobile && desktopHeader}
      
      {/* Main content */}
      <Box
        sx={{
          flex: fullHeight ? 1 : 'unset',
          minHeight: fullHeight ? 0 : 'unset', // For flex scroll
          padding: noPadding ? 0 : `${tokens.spacing.md}px`,
          overflow: fullHeight ? 'auto' : 'visible',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

export default MobilePageWrapper;
