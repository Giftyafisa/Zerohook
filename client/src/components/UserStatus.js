import React, { useState, useEffect } from 'react';
import {
  Box,
  Chip,
  Avatar,
  Typography,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  Circle,
  AccessTime,
  OfflineBolt
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';

const UserStatus = ({ 
  user, 
  showAvatar = true, 
  showUsername = false, 
  size = 'medium',
  variant = 'chip' // 'chip', 'dot', 'text'
}) => {
  const theme = useTheme();
  const { socket, isConnected } = useSocket();
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [status, setStatus] = useState('offline');

  useEffect(() => {
    if (!user || !socket || !isConnected) return;

    // Listen for user status updates
    const handleUserStatus = (data) => {
      if (data.userId === user.id) {
        setIsOnline(data.isOnline);
        setLastSeen(data.lastSeen);
        setStatus(data.status || 'offline');
      }
    };

    // Listen for user activity
    const handleUserActivity = (data) => {
      if (data.userId === user.id) {
        setIsOnline(true);
        setLastSeen(new Date().toISOString());
        setStatus('online');
      }
    };

    // Listen for user offline
    const handleUserOffline = (data) => {
      if (data.userId === user.id) {
        setIsOnline(false);
        setLastSeen(data.timestamp);
        setStatus('offline');
      }
    };

    socket.on('user_status', handleUserStatus);
    socket.on('user_activity', handleUserActivity);
    socket.on('user_offline', handleUserOffline);

    // Request initial status
    socket.emit('get_user_status', { userId: user.id });

    return () => {
      socket.off('user_status', handleUserStatus);
      socket.off('user_activity', handleUserActivity);
      socket.off('user_offline', handleUserOffline);
    };
  }, [user, socket, isConnected]);

  // Calculate time since last seen
  const getTimeSinceLastSeen = () => {
    if (!lastSeen) return 'Unknown';
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffInMinutes = Math.floor((now - lastSeenDate) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  // Get status color
  const getStatusColor = () => {
    switch (status) {
      case 'online':
        return theme.palette.success.main;
      case 'away':
        return theme.palette.warning.main;
      case 'busy':
        return theme.palette.error.main;
      case 'offline':
      default:
        return theme.palette.grey[500];
    }
  };

  // Get status text
  const getStatusText = () => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'away':
        return 'Away';
      case 'busy':
        return 'Busy';
      case 'offline':
      default:
        return 'Offline';
    }
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (status) {
      case 'online':
        return <Circle sx={{ fontSize: 12, color: getStatusColor() }} />;
      case 'away':
        return <AccessTime sx={{ fontSize: 12, color: getStatusColor() }} />;
      case 'busy':
        return <OfflineBolt sx={{ fontSize: 12, color: getStatusColor() }} />;
      case 'offline':
      default:
        return <Circle sx={{ fontSize: 12, color: getStatusColor() }} />;
    }
  };

  // Render chip variant
  if (variant === 'chip') {
    return (
      <Tooltip title={`${getStatusText()} - ${getTimeSinceLastSeen()}`}>
        <Chip
          icon={getStatusIcon()}
          label={getStatusText()}
          size={size}
          variant="outlined"
          sx={{
            borderColor: getStatusColor(),
            color: getStatusColor(),
            '& .MuiChip-icon': {
              color: getStatusColor()
            }
          }}
        />
      </Tooltip>
    );
  }

  // Render dot variant
  if (variant === 'dot') {
    return (
      <Tooltip title={`${getStatusText()} - ${getTimeSinceLastSeen()}`}>
        <Box display="flex" alignItems="center" gap={1}>
          {showAvatar && (
            <Avatar
              src={user.profileData?.profilePicture}
              sx={{ 
                width: size === 'small' ? 24 : size === 'large' ? 48 : 32,
                height: size === 'small' ? 24 : size === 'large' ? 48 : 32
              }}
            >
              {user.username?.charAt(0) || user.profileData?.firstName?.charAt(0) || 'U'}
            </Avatar>
          )}
          <Box
            sx={{
              width: size === 'small' ? 8 : size === 'large' ? 16 : 12,
              height: size === 'small' ? 8 : size === 'large' ? 16 : 12,
              borderRadius: '50%',
              backgroundColor: getStatusColor(),
              border: `2px solid ${theme.palette.background.paper}`,
              boxShadow: `0 0 0 2px ${getStatusColor()}20`
            }}
          />
          {showUsername && (
            <Typography variant="body2" color="text.secondary">
              {user.username || user.profileData?.firstName || 'User'}
            </Typography>
          )}
        </Box>
      </Tooltip>
    );
  }

  // Render text variant
  return (
    <Tooltip title={`${getStatusText()} - ${getTimeSinceLastSeen()}`}>
      <Box display="flex" alignItems="center" gap={1}>
        {showAvatar && (
          <Avatar
            src={user.profileData?.profilePicture}
            sx={{ 
              width: size === 'small' ? 24 : size === 'large' ? 48 : 32,
              height: size === 'small' ? 24 : size === 'large' ? 48 : 32
            }}
          >
            {user.username?.charAt(0) || user.profileData?.firstName?.charAt(0) || 'U'}
          </Avatar>
        )}
        <Box display="flex" flexDirection="column">
          {showUsername && (
            <Typography variant="body2" fontWeight="medium">
              {user.username || user.profileData?.firstName || 'User'}
            </Typography>
          )}
          <Typography 
            variant="caption" 
            color={getStatusColor()}
            display="flex"
            alignItems="center"
            gap={0.5}
          >
            {getStatusIcon()}
            {getStatusText()}
            {!isOnline && lastSeen && (
              <span style={{ color: theme.palette.text.secondary }}>
                • {getTimeSinceLastSeen()}
              </span>
            )}
          </Typography>
        </Box>
      </Box>
    </Tooltip>
  );
};

export default UserStatus;
