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
import apiClient from '../services/apiClient';
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
    setNotifications(notificationsList || []);
  }, [notificationsList]);

  // REMOVED: Duplicate socket.on handlers - SocketContext is the SINGLE source of truth
  // for socket events. It dispatches Redux actions which this component subscribes to.
  // This prevents double counting and event duplication.
  // 
  // The Redux store (via notificationsList selector) will automatically update
  // when SocketContext receives socket events and dispatches addToNotificationsList.

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/notifications');
      const notifs = (response.data.notifications || []).map((n) => ({
        ...n,
        read: Boolean(n.read ?? n.is_read),
        data: n.data || n.metadata || {},
        message: n.message || n.body || ''
      }));
      setNotifications(notifs);
      dispatch(setNotificationsList(notifs));
      const unreadTotal = notifs.filter(n => !Boolean(n.read)).length || 0;
      dispatch(setUnreadNotifications(unreadTotal));
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  // Load notifications from API
  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user, loadNotifications]);

  const handleNotificationClick = (notification) => {
    // Mark as read
    markAsRead(notification.id);
    
    // Close menu
    handleMenuClose();
    
    // Handle different notification types - NAVIGATE to appropriate pages
    switch (notification.type) {
      case 'connection_request':
        {
          const metadata = notification?.data || notification?.metadata || {};
          const requesterId =
            metadata.fromUserId ||
            metadata.from_user_id ||
            metadata.senderId ||
            metadata.sender_id ||
            notification?.fromUserId ||
            notification?.senderId ||
            null;

          if (requesterId) {
            navigate(`/profile/${requesterId}`);
          } else {
            navigate('/profiles');
          }
        }
        break;
      case 'message':
      case 'new_message': {
        const chatTarget = resolveChatTarget(notification);
        const chatQuery = new URLSearchParams();
        if (chatTarget.recipientId) chatQuery.set('recipientId', chatTarget.recipientId);
        if (chatTarget.conversationId) chatQuery.set('conversationId', chatTarget.conversationId);
        const chatPath = `/chat${chatQuery.toString() ? `?${chatQuery.toString()}` : ''}`;
        if (chatTarget.conversationId || chatTarget.recipientId) {
          navigate(chatPath, {
            state: {
              ...chatTarget,
              from: '/notifications'
            }
          });
        } else {
          navigate('/chat');
        }
        break;
      }
      case 'video_call':
        // Navigate to chat (video calls are initiated from within chat)
        navigate('/messages');
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
      await apiClient.put(`/notifications/${notificationId}/read`);

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
      await apiClient.put('/notifications/mark-all-read');

      const updatedNotifications = notifications.map(n => ({ ...n, read: true }));
      setNotifications(updatedNotifications);
      dispatch(setNotificationsList(updatedNotifications));
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

  const resolveChatTarget = (notification) => {
    const data = notification?.data || notification?.metadata || {};
    return {
      conversationId:
        data.conversationId ||
        data.conversation_id ||
        notification?.conversationId ||
        notification?.conversation_id ||
        null,
      recipientId:
        data.senderId ||
        data.sender_id ||
        data.recipientId ||
        data.recipient_id ||
        notification?.senderId ||
        notification?.sender_id ||
        notification?.recipientId ||
        notification?.recipient_id ||
        null,
      recipientName:
        data.senderName ||
        data.sender_name ||
        data.recipientName ||
        data.recipient_name ||
        notification?.senderName ||
        notification?.sender_name ||
        notification?.recipientName ||
        notification?.recipient_name ||
        null,
      recipientAvatar:
        data.senderAvatar ||
        data.sender_avatar ||
        data.recipientAvatar ||
        data.recipient_avatar ||
        notification?.senderAvatar ||
        notification?.recipientAvatar ||
        null,
    };
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
            width: isMobile ? 'calc(100vw - 24px)' : 400,
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 'min(70vh, 540px)',
            borderRadius: 3,
            overflow: 'hidden'
          }
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', background: 'rgba(255,255,255,0.02)' }}>
          <Box display="flex" justifyContent="space-between" alignItems="center" gap={1}>
            <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 700 }}>Notifications</Typography>
            {unreadCount > 0 && (
              <Button
                size="small"
                onClick={markAllAsRead}
                disabled={loading}
                sx={{ minHeight: 40, textTransform: 'none' }}
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
                      py: 1.25,
                      px: 2,
                      minHeight: 72,
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
