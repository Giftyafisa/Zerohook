import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import apiClient from '../services/apiClient';
import { 
  incrementUnreadMessages, 
  incrementUnreadNotifications,
  addToNotificationsList,
  setUnreadMessages,
  setUnreadNotifications 
} from '../store/slices/uiSlice';
import { setSubscriptionStatus } from '../store/slices/authSlice';

const SocketContext = createContext({});

const getUserId = (user) => String(user?.id || user?._id || user?.userId || '');

const inferMessageType = (data = {}) => {
  const explicitType = data.messageType || data.type;
  if (explicitType && explicitType !== 'text') return explicitType;

  const mimeType = String(data?.metadata?.mimeType || data?.metadata?.mimetype || '').toLowerCase();
  const fileName = String(data?.metadata?.filename || data?.metadata?.fileName || data?.metadata?.name || '').toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType && !mimeType.startsWith('text/')) return 'file';
  if (/\.(jpe?g|png|gif|webp|heic|bmp|svg|tiff?)$/.test(fileName)) return 'image';
  if (/\.(mp4|mov|avi|webm|mkv|m4v|3gp)$/.test(fileName)) return 'video';
  if (/\.(mp3|wav|ogg|aac|flac|m4a|wma)$/.test(fileName)) return 'audio';

  const content = String(data?.content || '').toLowerCase().split('?')[0].split('#')[0];
  if (content.startsWith('data:image/')) return 'image';
  if (content.startsWith('data:video/')) return 'video';
  if (content.startsWith('data:audio/')) return 'audio';
  if (/\/image\/upload\//.test(content)) return 'image';
  if (/\/video\/upload\//.test(content)) return 'video';
  if (/\.(jpe?g|png|gif|webp|heic|bmp|svg|tiff?)$/.test(content) || /image|photo|img/.test(content)) return 'image';
  if (/\.(mp4|mov|avi|webm|mkv|m4v|3gp)$/.test(content) || /video|vid/.test(content)) return 'video';
  if (/\.(mp3|wav|ogg|aac|flac|m4a|wma)$/.test(content) || /audio|voice/.test(content)) return 'audio';
  if (content.startsWith('http://') || content.startsWith('https://') || content.startsWith('/uploads/') || content.startsWith('data:')) return 'file';

  return explicitType || 'text';
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

// Unified toast notification using react-toastify (replaces raw DOM manipulation)
const showNotification = (title, message, type = 'info') => {
  const toastContent = `${title}: ${message}`;
  switch (type) {
    case 'success':
      toast.success(toastContent, { position: 'bottom-center', autoClose: 4000 });
      break;
    case 'warning':
      toast.warning(toastContent, { position: 'bottom-center', autoClose: 4000 });
      break;
    default:
      toast.info(toastContent, { position: 'bottom-center', autoClose: 4000 });
      break;
  }
};

const showDeviceNotification = (title, message) => {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (document.visibilityState === 'visible') return;
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico'
      });
    }
  } catch (_) {
    // Non-critical: browser/device notifications should never crash app flow
  }
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const dispatch = useDispatch();
  // Stable ref for user ID to avoid reconnect churn when user object reference changes
  const userIdRef = React.useRef(null);
  // Dedup ref to avoid double-counting messages received via both user and conversation rooms
  const processedMessageIds = React.useRef(new Set());

  useEffect(() => {
    const currentUserId = getUserId(user);

    // Only attempt connection if authenticated and have user data
    if (isAuthenticated && user && localStorage.getItem('token')) {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }

      // Prevent reconnect churn: only reconnect if user ID actually changed
      if (socket && userIdRef.current === currentUserId) {
        return; // Same user, same socket — no action needed
      }
      // Clean up previous socket if user switched
      if (socket) {
        socket.disconnect();
      }
      userIdRef.current = currentUserId;

      if (process.env.NODE_ENV !== 'production') {
        console.log('🔌 Attempting socket connection...');
      }
      
      // Use API URL as socket URL fallback (same origin), never hardcode localhost
      const socketUrl = process.env.REACT_APP_SOCKET_URL 
        || process.env.REACT_APP_API_URL?.replace('/api', '') 
        || window.location.origin;
      
      const newSocket = io(socketUrl, {
        auth: {
          token: localStorage.getItem('token')
        },
        timeout: 10000, // 10 second timeout
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000
      });

      newSocket.on('connect', () => {
        setIsConnected(true);
        if (process.env.NODE_ENV !== 'production') {
          console.log('✅ Connected to server');
        }
        // Fetch initial unread counts on connect/reconnect so badges are accurate
        apiClient.get('/chat/unread-count')
          .then(res => {
            if (res.data && typeof res.data.unreadCount === 'number') {
              dispatch(setUnreadMessages(res.data.unreadCount));
            }
          })
          .catch(() => {}); // Non-critical
        apiClient.get('/notifications')
          .then(res => {
            const data = res.data;
            if (data && typeof data.unreadCount === 'number') {
              dispatch({ type: 'ui/setUnreadNotifications', payload: data.unreadCount });
            } else if (data?.notifications) {
              // Fallback: count from list
              const unreadCount = data.notifications.filter(n => !n.is_read).length;
              dispatch({ type: 'ui/setUnreadNotifications', payload: unreadCount });
            }
          })
          .catch(() => {}); // Non-critical
      });

      newSocket.on('disconnect', (reason) => {
        setIsConnected(false);
        if (process.env.NODE_ENV !== 'production') {
          console.log('❌ Disconnected from server:', reason);
        }
      });

      newSocket.on('connect_error', (error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('❌ Socket connection error:', error.message);
        }
      });

      // NEW MESSAGE - increment unread count
      newSocket.on('new_message', (data) => {
        // Dedup: skip if we already processed this message (received via both user + conversation room)
        if (data.id && processedMessageIds.current.has(String(data.id))) return;
        if (data.id) {
          processedMessageIds.current.add(String(data.id));
          // Prevent unbounded growth
          if (processedMessageIds.current.size > 200) {
            const arr = [...processedMessageIds.current];
            processedMessageIds.current = new Set(arr.slice(-100));
          }
        }

        const pathname = window?.location?.pathname || '';
        const isChatRoute = pathname.startsWith('/chat') || pathname.startsWith('/messages');

        if (String(data.senderId || '') !== currentUserId) {
          // Always increment unread badge (ChatSystem handles per-conversation decrement when opened)
          dispatch(incrementUnreadMessages());

          // Format preview based on message type — never show raw URLs for media
          let preview = 'New message';
          const mType = inferMessageType(data);
          if (mType === 'image') preview = '📷 Photo';
          else if (mType === 'video') preview = '🎬 Video';
          else if (mType === 'file') preview = '📎 File';
          else if (mType === 'audio') preview = '🎵 Audio';
          else if (data.content) preview = data.content.substring(0, 50);

          // Only show toast notification when NOT on the chat page
          if (!isChatRoute) {
            const sender = data.senderName || data.senderUsername;
            showNotification(
              '💬 New Message',
              sender ? `${sender}: ${preview}` : 'You have a new message',
              'info'
            );
          }

          const sender = data.senderName || data.senderUsername || 'Someone';
          showDeviceNotification('💬 New Message', `${sender}: ${preview}`);
        }
      });

      // NOTIFICATIONS - general notification handler
      newSocket.on('new_notification', (data) => {
        dispatch(incrementUnreadNotifications());
        dispatch(addToNotificationsList({
          id: data.id || Date.now(),
          title: data.title || 'New Notification',
          message: data.message || '',
          type: data.type || 'info',
          read: false,
          createdAt: new Date().toISOString()
        }));
        // Don't show toast for 'message' type notifications — the 'new_message'
        // socket handler already shows its own toast. Showing both causes double toasts.
        if (data.type !== 'message') {
          showNotification('🔔 ' + (data.title || 'Notification'), data.message || 'You have a new notification', 'info');
        }
        showDeviceNotification('🔔 ' + (data.title || 'Notification'), data.message || 'You have a new notification');
      });

      // CONNECTION REQUEST notification
      newSocket.on('connection_request', (data) => {
        dispatch(incrementUnreadNotifications());
        dispatch(addToNotificationsList({
          id: data.id || Date.now(),
          title: 'Connection Request',
          message: `${data.senderName || 'Someone'} wants to connect with you`,
          type: 'connection_request',
          read: false,
          createdAt: new Date().toISOString(),
          data: data
        }));
        showNotification('🤝 Connection Request', `${data.senderName || 'Someone'} wants to connect`, 'info');
      });

      // INCOMING CALL notification (from call system)
      // Only toast when NOT on a call-eligible route (CallSystem handles its own UI there)
      newSocket.on('incoming_call', (data) => {
        const currentPath = window?.location?.pathname || '';
        const callRoutes = ['/chat', '/messages', '/inbox', '/profile/', '/dashboard'];
        const isOnCallRoute = callRoutes.some(r => currentPath.startsWith(r));
        if (!isOnCallRoute) {
          dispatch(incrementUnreadNotifications());
          const callTypeLabel = data.type === 'audio' ? '📞 Incoming Call' : '📹 Incoming Video Call';
          showNotification(callTypeLabel, `${data.callerName || 'Someone'} is calling you`, 'warning');
        }
        const callTypeLabel = data.type === 'audio' ? '📞 Incoming Call' : '📹 Incoming Video Call';
        showDeviceNotification(callTypeLabel, `${data.callerName || 'Someone'} is calling you`);
      });

      // Escrow notification handlers
      newSocket.on('escrow_created', (data) => {
        dispatch(incrementUnreadNotifications());
        showNotification('💰 Payment Held', data.message || `$${Number(data.amount).toLocaleString()} held for your service`, 'success');
      });

      newSocket.on('escrow_released', (data) => {
        dispatch(incrementUnreadNotifications());
        showNotification('✅ Payment Released', data.message || `$${Number(data.amount).toLocaleString()} added to your wallet`, 'success');
      });

      newSocket.on('escrow_disputed', (data) => {
        dispatch(incrementUnreadNotifications());
        showNotification('⚠️ Dispute Opened', data.message || 'A dispute has been opened on a payment', 'warning');
      });

      // PIN entered - client needs to confirm service delivery
      newSocket.on('pin_entered', (data) => {
        dispatch(incrementUnreadNotifications());
        showNotification('🔑 PIN Entered', data.message || 'Provider entered completion PIN. Please confirm service delivery.', 'info');
      });

      // Provider claimed service complete - client needs to respond urgently
      newSocket.on('provider_claimed_complete', (data) => {
        dispatch(incrementUnreadNotifications());
        showNotification('⚠️ Service Claim', data.message || 'Provider claims the service was delivered. Please respond within 24 hours.', 'warning');
      });

      // Escrow completed (from /:id/complete route)
      newSocket.on('escrow_completed', (data) => {
        dispatch(incrementUnreadNotifications());
        showNotification('✅ Payment Completed', data.message || 'Service completed and payment released!', 'success');
      });

      // Milestone request notification handlers
      newSocket.on('milestone_request', (data) => {
        dispatch(incrementUnreadNotifications());
        showNotification('📩 Payment Request', `${data.senderName} sent you a payment request for $${Number(data.amount).toLocaleString()}`, 'info');
      });

      newSocket.on('milestone_response', (data) => {
        dispatch(incrementUnreadNotifications());
        const statusText = data.status === 'accepted' ? 'accepted' : 'declined';
        showNotification(
          data.status === 'accepted' ? '✅ Request Accepted' : '❌ Request Declined',
          `Your payment request was ${statusText}`,
          data.status === 'accepted' ? 'success' : 'warning'
        );
      });

      // Subscription status update (from payment verification)
      newSocket.on('subscription_updated', (data) => {
        if (data.isSubscribed != null) {
          dispatch(setSubscriptionStatus(data.isSubscribed));
        }
        if (data.status === 'active') {
          showNotification('🌟 Subscription Active', 'Your premium subscription is now active!', 'success');
        }
      });

      setSocket(newSocket);

      return () => {
        if (process.env.NODE_ENV !== 'production') {
          console.log('🔌 Cleaning up socket connection...');
        }
        newSocket.disconnect();
        setSocket(null);
        setIsConnected(false);
        userIdRef.current = null;
      };
    } else {
      // Clear socket if not authenticated
      if (socket) {
        if (process.env.NODE_ENV !== 'production') {
          console.log('🔌 User not authenticated, clearing socket...');
        }
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
        userIdRef.current = null;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, user?._id, user?.userId]); // Only reconnect when auth state or user ID changes (not user object reference)

  const value = {
    socket,
    isConnected
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};
