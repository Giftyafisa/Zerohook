import React from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useLocation } from 'react-router-dom';
import ChatSystem from '../components/ChatSystem';

const MessagesPage = () => {
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg')); // >= 1200px
  const { recipientId, recipientName, recipientAvatar, conversationId } = location.state || {};

  // Desktop: No nav bars (sidebar layout), use full viewport
  // Mobile/Tablet: Account for top nav (56px) + bottom nav (56px) - matching global.css
  // Use fixed positioning to prevent page scroll
  return (
    <Box sx={{
      position: isDesktop ? 'relative' : 'fixed',
      top: isDesktop ? 0 : '56px', // Below header
      left: 0,
      right: 0,
      bottom: isDesktop ? 0 : '56px', // Above bottom nav
      height: isDesktop ? '100vh' : 'auto',
      // Modern browsers with dvh support
      '@supports (height: 100dvh)': {
        height: isDesktop ? '100dvh' : 'auto',
      },
      minHeight: 0,
      display: 'flex',
      overflow: 'hidden',
      marginTop: 0,
      paddingTop: 0,
      background: '#0f0f13', // Ensure solid background
      zIndex: 1, // Above main content scroll
    }}>
      <ChatSystem
        recipientId={recipientId}
        recipientName={recipientName}
        recipientAvatar={recipientAvatar}
        initialConversationId={conversationId}
      />
    </Box>
  );
};

export default MessagesPage;
