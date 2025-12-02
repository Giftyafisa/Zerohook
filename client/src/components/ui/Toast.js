import React, { createContext, useContext, useState, useCallback } from 'react';
import { Box, IconButton, Typography, Slide } from '@mui/material';
import { styled, keyframes } from '@mui/system';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';

const slideIn = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOut = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
`;

const progressBar = keyframes`
  from {
    width: 100%;
  }
  to {
    width: 0%;
  }
`;

const ToastContainer = styled(Box)({
  position: 'fixed',
  top: '20px',
  right: '20px',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  gap: '12px',
  maxWidth: '400px',
  pointerEvents: 'none',
});

const ToastItem = styled(Box)(({ variant, isExiting }) => {
  const colors = {
    success: { bg: 'rgba(0, 242, 234, 0.15)', border: '#00f2ea', icon: '#00f2ea' },
    error: { bg: 'rgba(255, 0, 85, 0.15)', border: '#ff0055', icon: '#ff0055' },
    warning: { bg: 'rgba(255, 170, 0, 0.15)', border: '#ffaa00', icon: '#ffaa00' },
    info: { bg: 'rgba(0, 170, 255, 0.15)', border: '#00aaff', icon: '#00aaff' },
  };
  
  const color = colors[variant] || colors.info;
  
  return {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    background: color.bg,
    backdropFilter: 'blur(12px)',
    border: `1px solid ${color.border}`,
    borderRadius: '16px',
    boxShadow: `0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px ${color.border}33`,
    pointerEvents: 'auto',
    animation: `${isExiting ? slideOut : slideIn} 0.3s ease forwards`,
    position: 'relative',
    overflow: 'hidden',
    
    '&::after': {
      content: '""',
      position: 'absolute',
      bottom: 0,
      left: 0,
      height: '3px',
      background: color.border,
      animation: `${progressBar} 5s linear forwards`,
    },
  };
});

const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  
  const addToast = useCallback((message, variant = 'info', duration = 5000) => {
    const id = Date.now() + Math.random();
    
    setToasts(prev => [...prev, { id, message, variant, isExiting: false }]);
    
    // Start exit animation before removal
    setTimeout(() => {
      setToasts(prev =>
        prev.map(t => (t.id === id ? { ...t, isExiting: true } : t))
      );
    }, duration - 300);
    
    // Remove toast
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
    
    return id;
  }, []);
  
  const removeToast = useCallback((id) => {
    setToasts(prev =>
      prev.map(t => (t.id === id ? { ...t, isExiting: true } : t))
    );
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 300);
  }, []);
  
  const success = useCallback((message, duration) => addToast(message, 'success', duration), [addToast]);
  const error = useCallback((message, duration) => addToast(message, 'error', duration), [addToast]);
  const warning = useCallback((message, duration) => addToast(message, 'warning', duration), [addToast]);
  const info = useCallback((message, duration) => addToast(message, 'info', duration), [addToast]);
  
  const getIcon = (variant) => {
    const icons = {
      success: <CheckCircleIcon sx={{ color: '#00f2ea', fontSize: 24 }} />,
      error: <ErrorIcon sx={{ color: '#ff0055', fontSize: 24 }} />,
      warning: <WarningIcon sx={{ color: '#ffaa00', fontSize: 24 }} />,
      info: <InfoIcon sx={{ color: '#00aaff', fontSize: 24 }} />,
    };
    return icons[variant] || icons.info;
  };
  
  return (
    <ToastContext.Provider value={{ addToast, removeToast, success, error, warning, info }}>
      {children}
      <ToastContainer>
        {toasts.map(toast => (
          <ToastItem key={toast.id} variant={toast.variant} isExiting={toast.isExiting}>
            {getIcon(toast.variant)}
            <Box sx={{ flex: 1 }}>
              <Typography
                sx={{
                  color: '#ffffff',
                  fontFamily: '"Outfit", sans-serif',
                  fontSize: '14px',
                  lineHeight: 1.5,
                }}
              >
                {toast.message}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => removeToast(toast.id)}
              sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </ToastItem>
        ))}
      </ToastContainer>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
