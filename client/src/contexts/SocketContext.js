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

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    // Only attempt connection if authenticated and have user data
    if (isAuthenticated && user && localStorage.getItem('token')) {
      console.log('🔌 Attempting socket connection...');
      
      const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000', {
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
