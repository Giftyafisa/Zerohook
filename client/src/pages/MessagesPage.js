import React from 'react';
import { Box } from '@mui/material';
import ChatSystem from '../components/ChatSystem';

const MessagesPage = () => {
  return (
    <Box sx={{ 
      height: 'calc(100vh - 64px)', 
      marginTop: '-20px',
      marginLeft: { xs: 0, md: '-20px' },
      marginRight: { xs: 0, md: '-20px' }
    }}>
      <ChatSystem />
    </Box>
  );
};

export default MessagesPage;
