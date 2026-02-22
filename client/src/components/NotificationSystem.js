import React, { useState, useEffect, useCallback } from 'react';
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
import { API_BASE_URL } from '../config/constants';
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
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { 
  setUnreadNotifications, 
  selectUnreadNotifications,
  setNotificationsList,
  selectNotificationsList,
  markNotificationRead,
  clearUnreadNotifications
} from '../store/slices/uiSlice';

const NotificationSystem = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  // Use Redux state for unread count and notifications list
  const unreadCount = useSelector(selectUnreadNotifications);
  const notificationsList = useSelector(selectNotificationsList);
  
  // Local state for UI
  const [notifications, setNotifications] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);

  // Sync local notifications with Redux
  useEffect(() => {
    if (notificationsList && notificationsList.length > 0) {
      setNotifications(notificationsList);
    }
  }, [notificationsList]);

  // Load notifications from API
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  // REMOVED: Duplicate socket.on handlers - SocketContext is the SINGLE source of truth
  // for socket events. It dispatches Redux actions which this component subscribes to.
  // This prevents double counting and event duplication.
  // 
  // The Redux store (via notificationsList selector) will automatically update
  // when SocketContext receives socket events and dispatches addToNotificationsList.

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const notifs = data.notifications || [];
        setNotifications(notifs);
        dispatch(setNotificationsList(notifs));
        const unreadTotal = notifs.filter(n => !n.read).length || 0;
        dispatch(setUnreadNotifications(unreadTotal));
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
    
    // Close menu
    handleMenuClose();
    
    // Handle different notification types - NAVIGATE to appropriate pages
    switch (notification.type) {
      case 'connection_request':
        navigate('/chat');
        break;
      case 'message':
        // Navigate to chat — conversationId passed as query param since /chat/:id route doesn't exist
        if (notification.data?.conversationId) {
          navigate(`/chat?conversation=${notification.data.conversationId}`);
        } else {
          navigate('/chat');
        }
        break;
      case 'video_call':
        // Navigate to chat (video calls are initiated from within chat)
        navigate('/chat');
        break;
      case 'verification':
        navigate('/verification');
        break;
      case 'payment':
        navigate('/wallet');
        break;
      default:
        // For generic notifications, just log
        console.log('Handle notification:', notification);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
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
      // Update Redux state
      dispatch(markNotificationRead(notificationId));
      dispatch(setUnreadNotifications(Math.max(0, unreadCount - 1)));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/notifications/mark-all-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      // Update Redux state
      dispatch(clearUnreadNotifications());
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
