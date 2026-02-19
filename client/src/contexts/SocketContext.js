import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useDispatch } from 'react-redux';
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

// Simple toast notification function (can be enhanced with a proper toast library)
// Includes aria-live for screen reader accessibility
const showNotification = (title, message, type = 'info') => {
  // Create a simple toast notification
  const toast = document.createElement('div');
  // Set accessibility attributes for screen readers
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.setAttribute('aria-atomic', 'true');
  toast.style.cssText = `
    position: fixed;
    bottom: 140px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? '#00ff88' : type === 'warning' ? '#ffa726' : '#00f2ea'};
    color: #000;
    padding: 16px 24px;
    border-radius: 12px;
    font-weight: 600;
    z-index: 1300;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    animation: slideUp 0.3s ease;
    max-width: calc(100vw - 32px);
    text-align: center;
    pointer-events: auto;
  `;
  toast.innerHTML = `<div style="font-size:14px;font-weight:700">${title}</div><div style="font-size:13px;margin-top:4px">${message}</div>`;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { isAuthenticated, user } = useAuth();
  const dispatch = useDispatch();

  useEffect(() => {
    // Only attempt connection if authenticated and have user data
    if (isAuthenticated && user && localStorage.getItem('token')) {
      if (process.env.NODE_ENV !== 'production') {
        console.log('🔌 Attempting socket connection...');
      }
      
      const newSocket = io(process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000', {
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
        // Only increment if not from self and not currently viewing chat
        const pathname = window?.location?.pathname || '';
        const isChatRoute = pathname.startsWith('/chat') || pathname.startsWith('/messages');

        if (data.senderId !== user?.id && !isChatRoute) {
          dispatch(incrementUnreadMessages());
          showNotification(
            '💬 New Message',
            data.senderName
              ? `${data.senderName}: ${data.content?.substring(0, 50) || 'New message'}`
              : 'You have a new message',
            'info'
          );
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

      // VIDEO CALL notification
      newSocket.on('video_call_request', (data) => {
        dispatch(incrementUnreadNotifications());
        showNotification('📹 Incoming Call', `${data.callerName || 'Someone'} is calling you`, 'warning');
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
      }
    }
  }, [isAuthenticated, user]); // REMOVED 'socket' from dependencies to prevent infinite loop

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
