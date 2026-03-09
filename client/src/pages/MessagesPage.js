import React from 'react';
import { Box, useMediaQuery, useTheme } from '@mui/material';
import { useLocation } from 'react-router-dom';
import ChatSystem from '../components/ChatSystem';

const MessagesPage = () => {
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg')); // >= 1200px
  const {
    recipientId,
    recipientID,
    targetUserId,
    userId,
    recipientName,
    username,
    recipientAvatar,
    avatar,
    conversationId,
    conversationID
  } = location.state || {};
  const searchParams = new URLSearchParams(location.search || '');
  const conversationIdFromQuery = searchParams.get('conversation') || searchParams.get('conversationId');
  const initialConversationId = conversationId || conversationID || conversationIdFromQuery || null;
  const initialRecipientId = recipientId || recipientID || targetUserId || userId || null;
  const initialRecipientName = recipientName || username || null;
  const initialRecipientAvatar = recipientAvatar || avatar || null;

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
        recipientId={initialRecipientId}
        recipientName={initialRecipientName}
        recipientAvatar={initialRecipientAvatar}
        initialConversationId={initialConversationId}
      />
    </Box>
  );
};

export default MessagesPage;
