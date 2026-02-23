/**
 * NotificationsPage - Modern notifications center
 * TikTok-inspired design with real data from backend
 * Zerohook Platform
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Tabs,
  Tab,
  Chip,
  Button,
  Skeleton,
  Divider,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Chat,
  Person,
  Payment,
  Security,
  Verified,
  CheckCircle,
  DeleteOutline,
  ArrowBack,
  Refresh
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import { 
  selectNotificationsList,
  selectUnreadNotifications,
  setNotificationsList,
  setUnreadNotifications,
  markNotificationRead,
  clearUnreadNotifications,
  removeFromNotificationsList
} from '../store/slices/uiSlice';
import { API_BASE_URL } from '../config/constants';
import { motion, AnimatePresence } from 'framer-motion';
import tokens from '../theme/tokens';

// Styled components
const styles = {
  container: {
    minHeight: '100vh',
    background: tokens.colors.background.primary,
    pb: 10,
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: tokens.zIndex.sticky,
    background: `${tokens.colors.background.primary}f2`,
    backdropFilter: tokens.backdropBlur.md,
    borderBottom: `1px solid ${tokens.colors.border.primary}`,
    px: 3,
    py: 2,
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: '800px',
    mx: 'auto',
  },
  title: {
    fontFamily: '"Outfit", sans-serif',
    fontWeight: tokens.fontWeight.bold,
    fontSize: `${tokens.fontSize.xl}px`,
    color: tokens.colors.text.primary,
  },
  tabs: {
    maxWidth: '800px',
    mx: 'auto',
    px: 2,
    '& .MuiTabs-indicator': {
      background: 'linear-gradient(135deg, #00f2ea, #ff0055)',
      height: '3px',
      borderRadius: '3px',
    },
    '& .MuiTab-root': {
      color: 'rgba(255, 255, 255, 0.5)',
      fontFamily: '"Outfit", sans-serif',
      fontWeight: 600,
      fontSize: '14px',
      textTransform: 'none',
      minWidth: 'auto',
      px: 3,
      '&.Mui-selected': {
        color: '#fff',
      },
    },
  },
  content: {
    maxWidth: '800px',
    mx: 'auto',
    px: 2,
    py: 2,
  },
  notificationItem: {
    display: 'flex',
    gap: 2,
    p: 2,
    minHeight: '56px',  // Comfortable touch target
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.06)',
    },
    '&:active': {
      transform: 'scale(0.98)',
    },
  },
  notificationItemUnread: {
    background: 'rgba(0, 242, 234, 0.08)',
    borderLeft: '3px solid #00f2ea',
    '&:hover': {
      background: 'rgba(0, 242, 234, 0.12)',
    },
  },
  unreadIndicator: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#00f2ea',
    flexShrink: 0,
    mt: 1.5,
    boxShadow: '0 0 8px rgba(0, 242, 234, 0.6)',
    border: '2px solid #0f0f13',
  },
  avatar: {
    width: tokens.touchTarget.min,
    height: tokens.touchTarget.min,
    bgcolor: `${tokens.colors.primary.main}26`,
    color: tokens.colors.primary.main,
    border: `2px solid ${tokens.colors.border.accent}`,
    fontWeight: tokens.fontWeight.bold,
  },
  emptyState: {
    textAlign: 'center',
    py: 8,
    px: 3,
  },
  markAllBtn: {
    color: tokens.colors.primary.main,
    fontFamily: '"Outfit", sans-serif',
    fontWeight: tokens.fontWeight.semibold,
    fontSize: `${tokens.fontSize.sm}px`,
    textTransform: 'none',
    minHeight: `${tokens.touchTarget.min}px`,
    px: 2,
    '&:hover': {
      background: `${tokens.colors.primary.main}1a`,
    },
  },
  refreshBtn: {
    color: 'rgba(255, 255, 255, 0.70)',
    minWidth: '48px',
    minHeight: '48px',
    '&:hover': {
      color: '#00f2ea',
      background: 'rgba(0, 242, 234, 0.10)',
    },
  },
  deleteBtn: {
    color: 'rgba(255, 255, 255, 0.50)',
    minWidth: '44px',
    minHeight: '44px',
    '&:hover': {
      color: '#ff0055',
      background: 'rgba(255, 0, 85, 0.10)',
    },
  },
  actionText: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#00f2ea',
  },
};

// Notification type configs - maps backend types to UI
const notificationTypes = {
  message: { icon: <Chat />, color: '#00f2ea', route: '/chat' },
  new_message: { icon: <Chat />, color: '#00f2ea', route: '/chat' },
  connection: { icon: <Person />, color: '#ff0055', route: '/chat' },
  connection_request: { icon: <Person />, color: '#ff0055', route: '/chat' },
  connection_accepted: { icon: <Person />, color: '#00ff88', route: '/chat' },
  payment: { icon: <Payment />, color: '#00ff88', route: '/wallet' },
  payment_received: { icon: <Payment />, color: '#00ff88', route: '/wallet' },
  payment_sent: { icon: <Payment />, color: '#ffd700', route: '/wallet' },
  verification: { icon: <Verified />, color: '#ffd700', route: '/verification' },
  verification_approved: { icon: <Verified />, color: '#00ff88', route: '/verification' },
  verification_pending: { icon: <Verified />, color: '#ffd700', route: '/verification' },
  security: { icon: <Security />, color: '#ff6b35', route: '/settings' },
  login_alert: { icon: <Security />, color: '#ff6b35', route: '/settings' },
  booking: { icon: <CheckCircle />, color: '#9c27b0', route: '/bookings' },
  booking_confirmed: { icon: <CheckCircle />, color: '#00ff88', route: '/bookings' },
  booking_cancelled: { icon: <CheckCircle />, color: '#ff0055', route: '/bookings' },
  system: { icon: <NotificationsIcon />, color: '#9c27b0', route: null },
  default: { icon: <NotificationsIcon />, color: '#9c27b0', route: null },
};

// Format time ago
const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return date.toLocaleDateString();
};

const NotificationsPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const notificationsList = useSelector(selectNotificationsList);
  const unreadCount = useSelector(selectUnreadNotifications);
  
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Fetch notifications from API
  const fetchNotifications = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const notifications = data.notifications || [];
        
        // Transform backend data to match UI format
        const transformedNotifications = notifications.map(n => ({
          id: n.id,
          type: n.type || 'system',
          title: n.title || 'Notification',
          body: n.message || '',
          time: formatTimeAgo(n.created_at),
          createdAt: n.created_at,
          read: n.is_read || false,
          metadata: n.metadata || {},
          username: n.metadata?.from_username || null,
        }));
        
        dispatch(setNotificationsList(transformedNotifications));
        
        // Update unread count
        const unread = transformedNotifications.filter(n => !n.read).length;
        dispatch(setUnreadNotifications(unread));
        
        setError(null);
      } else {
        throw new Error('Failed to fetch notifications');
      }
    } catch (err) {
      console.error('Fetch notifications error:', err);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dispatch]);
  
  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);
  
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };
  
  // Handle notification click
  const handleNotificationClick = async (notification) => {
    // Mark as read in backend
    if (!notification.read) {
      try {
        const token = localStorage.getItem('token');
        await fetch(`${API_BASE_URL}/notifications/${notification.id}/read`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        // Update local state
        dispatch(markNotificationRead(notification.id));
        dispatch(setUnreadNotifications(Math.max(0, unreadCount - 1)));
      } catch (err) {
        console.error('Mark read error:', err);
      }
    }
    
    // Navigate to relevant page based on notification type
    const config = notificationTypes[notification.type] || notificationTypes.default;
    if (config.route) {
      // For messages, include conversation context if available
      if (notification.type === 'message' || notification.type === 'new_message') {
        // Check both conversationId and conversation_id for compatibility
        const convId = notification.metadata?.conversationId || notification.metadata?.conversation_id;
        if (convId) {
          navigate(`/chat?conversation=${convId}`);
        } else {
          navigate(config.route);
        }
      } else if (notification.type === 'booking' || notification.type.includes('booking')) {
        const bookingId = notification.metadata?.bookingId || notification.metadata?.booking_id;
        if (bookingId) {
          navigate(`/bookings/${bookingId}`);
        } else {
          navigate(config.route);
        }
      } else {
        navigate(config.route);
      }
    }
  };
  
  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/notifications/mark-all-read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      // Update local state - mark all notifications as read
      const updatedList = notificationsList.map(n => ({ ...n, read: true }));
      dispatch(setNotificationsList(updatedList));
      dispatch(clearUnreadNotifications());
      
      setSnackbar({ open: true, message: 'All notifications marked as read', severity: 'success' });
    } catch (err) {
      console.error('Mark all read error:', err);
      setSnackbar({ open: true, message: 'Failed to mark notifications as read', severity: 'error' });
    }
  };
  
  // Delete notification
  const handleDeleteNotification = async (e, notificationId) => {
    e.stopPropagation();
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      // Decrement unread count if the deleted notification was unread
      const deletedNotification = notificationsList.find(n => n.id === notificationId);
      if (deletedNotification && !deletedNotification.read) {
        dispatch(setUnreadNotifications(Math.max(0, unreadCount - 1)));
      }
      dispatch(removeFromNotificationsList(notificationId));
      setSnackbar({ open: true, message: 'Notification deleted', severity: 'success' });
    } catch (err) {
      console.error('Delete notification error:', err);
      setSnackbar({ open: true, message: 'Failed to delete notification', severity: 'error' });
    }
  };
  
  // Filter notifications based on active tab
  const filteredNotifications = activeTab === 0 
    ? notificationsList 
    : notificationsList.filter(n => !n.read);
  
  const displayUnreadCount = notificationsList.filter(n => !n.read).length;
  
  return (
    <Box sx={styles.container}>
      {/* Header */}
      <Box sx={styles.header}>
        <Box sx={styles.headerContent}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton 
              onClick={() => navigate(-1)}
              sx={{ color: '#fff' }}
              aria-label="Go back"
            >
              <ArrowBack />
            </IconButton>
            <Typography sx={styles.title}>
              Notifications
            </Typography>
            {displayUnreadCount > 0 && (
              <Chip 
                label={displayUnreadCount} 
                size="small"
                sx={{
                  bgcolor: '#ff0055',
                  color: '#fff',
                  fontWeight: 700,
                  height: '24px',
                }}
              />
            )}
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton 
              onClick={() => fetchNotifications(true)}
              disabled={refreshing}
              sx={styles.refreshBtn}
              aria-label={refreshing ? 'Refreshing notifications' : 'Refresh notifications'}
            >
              <Refresh sx={{ 
                animation: refreshing ? 'spin 1s linear infinite' : 'none',
                '@keyframes spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }} />
            </IconButton>
            
            {displayUnreadCount > 0 && (
              <Button 
                sx={styles.markAllBtn}
                onClick={handleMarkAllRead}
              >
                Mark all read
              </Button>
            )}
          </Box>
        </Box>
        
        {/* Tabs */}
        <Tabs 
          value={activeTab} 
          onChange={handleTabChange}
          sx={styles.tabs}
        >
          <Tab label="All" />
          <Tab label={`Unread (${displayUnreadCount})`} />
        </Tabs>
      </Box>
      
      {/* Content */}
      <Box sx={styles.content}>
        {loading ? (
          // Loading skeletons
          [...Array(5)].map((_, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 2, p: 2 }}>
              <Skeleton variant="circular" width={48} height={48} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="60%" height={24} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
                <Skeleton width="80%" height={20} sx={{ bgcolor: 'rgba(255,255,255,0.1)' }} />
              </Box>
            </Box>
          ))
        ) : error ? (
          // Error state
          <Box sx={styles.emptyState}>
            <NotificationsIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
            <Typography sx={{ color: '#ff0055', fontWeight: 600, fontSize: '18px', mb: 1 }}>
              {error}
            </Typography>
            <Button 
              onClick={() => fetchNotifications()}
              sx={{ color: '#00f2ea', textTransform: 'none' }}
            >
              Try Again
            </Button>
          </Box>
        ) : filteredNotifications.length === 0 ? (
          // Empty state
          <Box sx={styles.emptyState}>
            <NotificationsIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.2)', mb: 2 }} />
            <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: '18px', mb: 1 }}>
              {activeTab === 0 ? 'No notifications yet' : 'All caught up!'}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px' }}>
              {activeTab === 0 
                ? "When you get notifications, they'll show up here"
                : "You've read all your notifications"
              }
            </Typography>
          </Box>
        ) : (
          // Notification list
          <AnimatePresence>
            {filteredNotifications.map((notification, index) => {
              const config = notificationTypes[notification.type] || notificationTypes.default;
              
              return (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <Box 
                    sx={{
                      ...styles.notificationItem,
                      ...(!notification.read && styles.notificationItemUnread),
                    }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    {/* Unread indicator */}
                    <Box sx={{ 
                      ...styles.unreadIndicator, 
                      opacity: notification.read ? 0 : 1 
                    }} />
                    
                    {/* Avatar */}
                    <Avatar 
                      sx={{ 
                        ...styles.avatar,
                        bgcolor: `${config.color}20`,
                        color: config.color,
                        border: `2px solid ${config.color}40`,
                      }}
                    >
                      {notification.username 
                        ? notification.username[0].toUpperCase()
                        : config.icon
                      }
                    </Avatar>
                    
                    {/* Content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Typography sx={{ 
                          color: '#fff', 
                          fontWeight: 600, 
                          fontSize: '15px',
                          fontFamily: '"Outfit", sans-serif',
                        }}>
                          {notification.title}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography sx={{ 
                            color: 'rgba(255,255,255,0.4)', 
                            fontSize: '12px',
                            flexShrink: 0,
                          }}>
                            {notification.time}
                          </Typography>
                          <IconButton
                            size="small"
                            onClick={(e) => handleDeleteNotification(e, notification.id)}
                            sx={{ 
                              color: 'rgba(255,255,255,0.3)',
                              p: 0.5,
                              '&:hover': { color: '#ff0055' }
                            }}
                            aria-label={`Delete notification: ${notification.title}`}
                          >
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                      <Typography sx={{ 
                        color: 'rgba(255,255,255,0.6)', 
                        fontSize: '14px',
                        mt: 0.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {notification.body}
                      </Typography>
                    </Box>
                  </Box>
                  
                  {index < filteredNotifications.length - 1 && (
                    <Divider sx={{ borderColor: 'rgba(255,255,255,0.05)', mx: 2 }} />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </Box>
      
      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          severity={snackbar.severity}
          sx={{ 
            background: '#1a1a1a', 
            color: '#fff',
            border: snackbar.severity === 'success' ? '1px solid #00f2ea' : '1px solid #ff0055'
          }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default NotificationsPage;
