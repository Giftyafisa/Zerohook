import React from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useLocation } from 'react-router-dom';
import ChatSystem from '../components/ChatSystem';

const MessagesPage = () => {
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg')); // >= 1200px
  const { recipientId, recipientName, recipientAvatar, conversationId } = location.state || {};

  return (
    <Box sx={{ 
      height: isDesktop ? 'calc(100vh - 24px)' : 'calc(100vh - 160px)', 
      // Desktop: full height minus small padding
      // Mobile/Tablet: account for navbar (80px) + bottom nav (80px)
      marginTop: { xs: '-16px', lg: '0' },
      overflow: 'hidden'
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
