import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { 
  incrementUnreadMessages, 
  incrementUnreadNotifications,
  addToNotificationsList 
} from '../store/slices/uiSlice';

const SocketContext = createContext({});

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
    // Only attempt connection if authenticated and have user data
    if (isAuthenticated && user && localStorage.getItem('token')) {
      // Prevent reconnect churn: only reconnect if user ID actually changed
      if (socket && userIdRef.current === user.id) {
        return; // Same user, same socket — no action needed
      }
      // Clean up previous socket if user switched
      if (socket) {
        socket.disconnect();
      }
      userIdRef.current = user.id;

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
        reconnectionAttempts: 3,
        reconnectionDelay: 1000
      });

      newSocket.on('connect', () => {
        setIsConnected(true);
        if (process.env.NODE_ENV !== 'production') {
          console.log('✅ Connected to server');
        }
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

        if (data.senderId !== user?.id) {
          // Always increment unread badge (ChatSystem handles per-conversation decrement when opened)
          dispatch(incrementUnreadMessages());

          // Only show toast notification when NOT on the chat page
          if (!isChatRoute) {
            const sender = data.senderName || data.senderUsername;
            // Format preview based on message type — never show raw URLs for media
            let preview = 'New message';
            const mType = data.messageType || 'text';
            if (mType === 'image') preview = '📷 Photo';
            else if (mType === 'video') preview = '🎬 Video';
            else if (mType === 'file') preview = '📎 File';
            else if (mType === 'audio') preview = '🎵 Audio';
            else if (data.content) preview = data.content.substring(0, 50);

            showNotification(
              '💬 New Message',
              sender ? `${sender}: ${preview}` : 'You have a new message',
              'info'
            );
          }
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
        showNotification('🔔 ' + (data.title || 'Notification'), data.message || 'You have a new notification', 'info');
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
  }, [isAuthenticated, user?.id]); // Only reconnect when auth state or user ID changes (not user object reference)

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
