import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext({});

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

// Simple toast notification function (can be enhanced with a proper toast library)
const showNotification = (title, message, type = 'info') => {
  // Create a simple toast notification
  const toast = document.createElement('div');
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'success' ? '#00ff88' : type === 'warning' ? '#ffa726' : '#00f2ea'};
    color: #000;
    padding: 16px 24px;
    border-radius: 12px;
    font-weight: 600;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    animation: slideUp 0.3s ease;
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

  useEffect(() => {
    // Only attempt connection if authenticated and have user data
    if (isAuthenticated && user && localStorage.getItem('token')) {
      console.log('🔌 Attempting socket connection...');
      
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
        console.log('✅ Connected to server');
      });

      newSocket.on('disconnect', (reason) => {
        setIsConnected(false);
        console.log('❌ Disconnected from server:', reason);
        
        // Don't show error for intentional disconnections
        if (reason !== 'io client disconnect') {
          console.log('⚠️ Socket disconnected unexpectedly');
        }
      });

      newSocket.on('connect_error', (error) => {
        console.log('❌ Socket connection error:', error.message);
        
        // Don't show error for authentication failures (expected for unauthenticated users)
        if (error.message !== 'Authentication error') {
          console.log('⚠️ Socket connection failed');
        }
      });

      // Escrow notification handlers
      newSocket.on('escrow_created', (data) => {
        console.log('💰 Escrow created:', data);
        showNotification('💰 Payment Held', data.message || `₦${Number(data.amount).toLocaleString()} held for your service`, 'success');
      });

      newSocket.on('escrow_released', (data) => {
        console.log('✅ Escrow released:', data);
        showNotification('✅ Payment Released', data.message || `₦${Number(data.amount).toLocaleString()} added to your wallet`, 'success');
      });

      newSocket.on('escrow_disputed', (data) => {
        console.log('⚠️ Escrow disputed:', data);
        showNotification('⚠️ Dispute Opened', data.message || 'A dispute has been opened on a payment', 'warning');
      });

      // Milestone request notification handlers
      newSocket.on('milestone_request', (data) => {
        console.log('📩 Milestone request received:', data);
        showNotification('📩 Payment Request', `${data.senderName} sent you a payment request for ₦${Number(data.amount).toLocaleString()}`, 'info');
      });

      newSocket.on('milestone_response', (data) => {
        console.log('📬 Milestone response:', data);
        const statusText = data.status === 'accepted' ? 'accepted' : 'declined';
        showNotification(
          data.status === 'accepted' ? '✅ Request Accepted' : '❌ Request Declined',
          `Your payment request was ${statusText}`,
          data.status === 'accepted' ? 'success' : 'warning'
        );
      });

      setSocket(newSocket);

      return () => {
        console.log('🔌 Cleaning up socket connection...');
        newSocket.disconnect();
        setSocket(null);
        setIsConnected(false);
      };
    } else {
      // Clear socket if not authenticated
      if (socket) {
        console.log('🔌 User not authenticated, clearing socket...');
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
