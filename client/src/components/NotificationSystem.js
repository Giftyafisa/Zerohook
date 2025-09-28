import React, { useState, useEffect } from 'react';
import {
  Box,
  Badge,
  IconButton,
  Menu,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Button,
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Notifications,
  NotificationsActive,
  NotificationsNone,
  Message,
  VideoCall,
  PersonAdd,
  Security,
  CheckCircle,
  Info
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const NotificationSystem = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);

  // Load notifications from API
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  // Socket.io real-time notifications
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Listen for new notifications
    socket.on('new_notification', (notification) => {
      console.log('🔔 New notification received:', notification);
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    // Listen for connection requests
    socket.on('connection_request', (request) => {
      console.log('🔔 Connection request received:', request);
      const notification = {
        id: Date.now(),
        type: 'connection_request',
        title: 'New Connection Request',
        message: `${request.fromUser || request.fromUsername || 'Someone'} wants to connect with you`,
        timestamp: new Date(),
        read: false,
        data: request
      };
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    // Listen for messages
    socket.on('new_message', (message) => {
      console.log('🔔 New message received:', message);
      const notification = {
        id: Date.now(),
        type: 'message',
        title: 'New Message',
        message: `New message from ${message.senderName || message.senderUsername || 'Someone'}`,
        timestamp: new Date(),
        read: false,
        data: message
      };
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    // Listen for video call requests
    socket.on('video_call_request', (call) => {
      console.log('🔔 Video call request received:', call);
      const notification = {
        id: Date.now(),
        type: 'video_call',
        title: 'Video Call Request',
        message: `${call.callerName || call.callerUsername || 'Someone'} wants to video call you`,
        timestamp: new Date(),
        read: false,
        data: call
      };
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    // Listen for verification updates
    socket.on('verification_update', (update) => {
      console.log('🔔 Verification update received:', update);
      const notification = {
        id: Date.now(),
        type: 'verification',
        title: 'Verification Update',
        message: update.message || 'Your verification status has been updated',
        timestamp: new Date(),
        read: false,
        data: update
      };
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    // Listen for payment confirmations
    socket.on('payment_confirmation', (payment) => {
      console.log('🔔 Payment confirmation received:', payment);
      const notification = {
        id: Date.now(),
        type: 'payment',
        title: 'Payment Confirmed',
        message: `Payment of $${payment.amount || 'N/A'} has been confirmed`,
        timestamp: new Date(),
        read: false,
        data: payment
      };
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    return () => {
      socket.off('new_notification');
      socket.off('connection_request');
      socket.off('new_message');
      socket.off('video_call_request');
      socket.off('verification_update');
      socket.off('payment_confirmation');
    };
  }, [socket, isConnected]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.notifications?.filter(n => !n.read).length || 0);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read
    markAsRead(notification.id);
    
    // Handle different notification types
    switch (notification.type) {
      case 'connection_request':
        // Navigate to connections page or show connection dialog
        console.log('Handle connection request:', notification.data);
        break;
      case 'message':
        // Navigate to chat or open chat dialog
        console.log('Handle new message:', notification.data);
        break;
      case 'video_call':
        // Handle video call request
        console.log('Handle video call:', notification.data);
        break;
      default:
        console.log('Handle notification:', notification);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/notifications/mark-all-read', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'connection_request':
        return <PersonAdd color="primary" />;
      case 'message':
        return <Message color="info" />;
      case 'video_call':
        return <VideoCall color="success" />;
      case 'security':
        return <Security color="warning" />;
      case 'verification':
        return <CheckCircle color="success" />;
      default:
        return <Info color="default" />;
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'connection_request':
        return 'primary';
      case 'message':
        return 'info';
      case 'video_call':
        return 'success';
      case 'security':
        return 'warning';
      case 'verification':
        return 'success';
      default:
        return 'default';
    }
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diff = now - new Date(timestamp);
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  if (!user) return null;

  return (
    <Box>
      <IconButton
        color="inherit"
        onClick={handleMenuOpen}
        sx={{ position: 'relative' }}
      >
        <Badge badgeContent={unreadCount} color="error">
          {unreadCount > 0 ? <NotificationsActive /> : <Notifications />}
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            width: isMobile ? '90vw' : 400,
            maxHeight: 500
          }
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Notifications</Typography>
            {unreadCount > 0 && (
              <Button
                size="small"
                onClick={markAllAsRead}
                disabled={loading}
              >
                Mark all read
              </Button>
            )}
          </Box>
        </Box>

        <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
          {notifications.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <NotificationsNone sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                No notifications yet
              </Typography>
            </Box>
          ) : (
            <List sx={{ p: 0 }}>
              {notifications.map((notification, index) => (
                <React.Fragment key={notification.id}>
                  <ListItem
                    button
                    onClick={() => handleNotificationClick(notification)}
                    sx={{
                      backgroundColor: notification.read ? 'transparent' : 'action.hover',
                      '&:hover': {
                        backgroundColor: 'action.selected'
                      }
                    }}
                  >
                    <ListItemIcon>
                      {getNotificationIcon(notification.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="subtitle2" component="span">
                            {notification.title}
                          </Typography>
                          <Chip
                            label={notification.type.replace('_', ' ')}
                            size="small"
                            color={getNotificationColor(notification.type)}
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.primary">
                            {notification.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatTimestamp(notification.timestamp)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < notifications.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </Box>
      </Menu>
    </Box>
  );
};

export default NotificationSystem;
