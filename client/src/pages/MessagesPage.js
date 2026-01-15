import React from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useLocation } from 'react-router-dom';
import ChatSystem from '../components/ChatSystem';

const MessagesPage = () => {
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg')); // >= 1200px
  const { recipientId, recipientName, recipientAvatar, conversationId } = location.state || {};

  // Mobile: MobileShell handles header/nav, this fills the content area
  // Desktop: Uses sidebar layout, full viewport height
  return (
    <Box sx={{
      // On mobile, fill the shell's content region (flex:1 handles height)
      // On desktop, take full viewport
      height: isDesktop ? '100vh' : '100%',
      '@supports (height: 100dvh)': {
        height: isDesktop ? '100dvh' : '100%',
      },
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: '#0f0f13',
      // Fill the parent container
      flex: 1,
      minHeight: 0,
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
