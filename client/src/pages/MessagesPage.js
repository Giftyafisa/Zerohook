import React from 'react';
import { Box } from '@mui/material';
import { useLocation } from 'react-router-dom';
import ChatSystem from '../components/ChatSystem';

const MessagesPage = () => {
  const location = useLocation();
  const { recipientId, recipientName, recipientAvatar, conversationId } = location.state || {};

  return (
    <Box sx={{ 
      height: 'calc(100vh - 64px)', 
      marginTop: '-20px',
      marginLeft: { xs: 0, md: '-20px' },
      marginRight: { xs: 0, md: '-20px' }
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
