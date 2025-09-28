import React, { useState, useEffect } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Badge,
  Button
} from '@mui/material';
import {
  Call,
  Videocam,
  Phone
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const CallButton = ({ 
  targetUser, 
  variant = 'icon', // 'icon' or 'button'
  size = 'medium',
  showBadge = false,
  badgeContent = null,
  disabled = false,
  onCallStart = null
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const { socket, isConnected } = useSocket();
  const { user, isAuthenticated } = useAuth();

  const open = Boolean(anchorEl);

  // Enhanced debugging
  useEffect(() => {
    console.log('🔍 CallButton mounted with props:', {
      targetUser: targetUser?.username || targetUser?.id,
      variant,
      size,
      disabled,
      hasOnCallStart: !!onCallStart
    });
  }, [targetUser, variant, size, disabled, onCallStart]);

  useEffect(() => {
    console.log('🔍 CallButton auth state changed:', {
      isAuthenticated,
      user: user?.username || user?.id,
      hasToken: !!localStorage.getItem('token')
    });
  }, [isAuthenticated, user]);

  useEffect(() => {
    console.log('🔍 CallButton socket state changed:', {
      hasSocket: !!socket,
      isConnected,
      socketId: socket?.id
    });
  }, [socket, isConnected]);

  const handleClick = (event) => {
    console.log('🔍 CallButton clicked:', { 
      disabled, 
      targetUser: targetUser?.username, 
      isConnected, 
      socket: !!socket,
      user: user?.username,
      isAuthenticated,
      hasToken: !!localStorage.getItem('token')
    });
    
    if (disabled || !targetUser || !isConnected) {
      console.log('❌ CallButton blocked:', { 
        disabled, 
        hasTargetUser: !!targetUser, 
        isConnected,
        reason: !disabled ? (targetUser ? 'socket not connected' : 'no target user') : 'disabled'
      });
      return;
    }
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleCallStart = async (callType) => {
    console.log('🚀 handleCallStart called:', { callType, targetUser: targetUser?.username });
    
    if (!socket || !isConnected || !targetUser) {
      console.error('❌ Cannot start call:', { 
        hasSocket: !!socket, 
        isConnected, 
        hasTargetUser: !!targetUser 
      });
      return;
    }

    try {
      setIsCalling(true);
      handleClose();

      const callData = {
        targetUserId: targetUser.id,
        type: callType,
        callerId: user.id,
        callerName: user.username || user.profileData?.firstName || 'User'
      };

      console.log('📡 Emitting call_request:', callData);

      // Emit call request
      socket.emit('call_request', callData);

      // Callback for parent component
      if (onCallStart) {
        console.log('📞 Calling onCallStart callback');
        onCallStart(callType, targetUser);
      }

      console.log(`✅ ${callType} call initiated with ${targetUser.username || targetUser.id}`);

    } catch (error) {
      console.error('❌ Failed to start call:', error);
    } finally {
      setIsCalling(false);
    }
  };

  const canCall = !disabled && isConnected && targetUser && targetUser.id !== user?.id;

  // Enhanced render state logging
  console.log('🔍 CallButton render state:', { 
    canCall, 
    disabled, 
    isConnected, 
    hasTargetUser: !!targetUser, 
    userId: user?.id, 
    targetUserId: targetUser?.id,
    isAuthenticated,
    hasToken: !!localStorage.getItem('token'),
    hasSocket: !!socket,
    socketId: socket?.id
  });

  // Render icon button variant
  if (variant === 'icon') {
    return (
      <>
        <Tooltip title={canCall ? "Call User" : "Cannot call this user"}>
          <span>
            <IconButton
              onClick={handleClick}
              disabled={!canCall || isCalling}
              size={size}
              color="primary"
              sx={{
                opacity: canCall ? 1 : 0.5,
                '&:hover': {
                  backgroundColor: canCall ? 'primary.light' : 'transparent'
                }
              }}
            >
              <Badge
                badgeContent={showBadge && badgeContent ? badgeContent : 0}
                color="error"
              >
                <Call />
              </Badge>
            </IconButton>
          </span>
        </Tooltip>
        
        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <MenuItem onClick={() => handleCallStart('audio')}>
            <ListItemIcon>
              <Phone fontSize="small" />
            </ListItemIcon>
            <ListItemText>Audio Call</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleCallStart('video')}>
            <ListItemIcon>
              <Videocam fontSize="small" />
            </ListItemIcon>
            <ListItemText>Video Call</ListItemText>
          </MenuItem>
        </Menu>
      </>
    );
  }

  // Render button variant
  return (
    <Button
      onClick={handleClick}
      disabled={!canCall || isCalling}
      variant="outlined"
      size={size}
      startIcon={<Call />}
      sx={{
        opacity: canCall ? 1 : 0.5,
        '&:hover': {
          backgroundColor: canCall ? 'primary.light' : 'transparent'
        }
      }}
    >
      {isCalling ? 'Calling...' : 'Call'}
      
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
      >
        <MenuItem onClick={() => handleCallStart('audio')}>
          <ListItemIcon>
            <Phone fontSize="small" />
          </ListItemIcon>
          <ListItemText>Audio Call</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleCallStart('video')}>
          <ListItemIcon>
            <Videocam fontSize="small" />
          </ListItemIcon>
          <ListItemText>Video Call</ListItemText>
        </MenuItem>
      </Menu>
    </Button>
  );
};

export default CallButton;
