import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import {
  ErrorOutline as ErrorIcon,
  Refresh as RefreshIcon,
  WifiOff as OfflineIcon,
  Warning as WarningIcon
} from '@mui/icons-material';

export const ErrorState = ({ 
  title = 'Something went wrong',
  message = 'We couldn\'t load this content. Please try again.',
  onRetry,
  showRetry = true,
  variant = 'error', // 'error', 'timeout', 'offline', 'empty'
  icon
}) => {
  const getIcon = () => {
    if (icon) return icon;
    switch (variant) {
      case 'timeout':
        return <WarningIcon sx={{ fontSize: 64, color: '#ffd700' }} />;
      case 'offline':
        return <OfflineIcon sx={{ fontSize: 64, color: '#ff8080' }} />;
      case 'error':
      default:
        return <ErrorIcon sx={{ fontSize: 64, color: '#ff8080' }} />;
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 24px',
      textAlign: 'center',
      minHeight: '400px'
    }}>
      {getIcon()}
      
      <Typography sx={{
        fontSize: '1.25rem',
        fontWeight: 600,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: '24px',
        marginBottom: '12px'
      }}>
        {title}
      </Typography>
      
      <Typography sx={{
        fontSize: '0.95rem',
        color: 'rgba(255, 255, 255, 0.6)',
        marginBottom: '32px',
        maxWidth: '400px',
        lineHeight: 1.6
      }}>
        {message}
      </Typography>
      
      {showRetry && onRetry && (
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={onRetry}
          sx={{
            minHeight: '48px',
            minWidth: '160px',
            background: 'linear-gradient(135deg, #00f2ea 0%, #ff0055 100%)',
            color: '#fff',
            fontWeight: 600,
            fontSize: '1rem',
            borderRadius: '12px',
            textTransform: 'none',
            '&:hover': {
              background: 'linear-gradient(135deg, #00d4cc 0%, #e6004d 100%)',
            }
          }}
        >
          Try Again
        </Button>
      )}
    </Box>
  );
};

export const TimeoutError = ({ onRetry }) => (
  <ErrorState
    variant="timeout"
    title="Request Timed Out"
    message="This is taking longer than expected. Please check your connection and try again."
    onRetry={onRetry}
  />
);

export const OfflineError = ({ onRetry }) => (
  <ErrorState
    variant="offline"
    title="No Internet Connection"
    message="Please check your network connection and try again."
    onRetry={onRetry}
  />
);

export const EmptyState = ({ 
  icon,
  title,
  message,
  actionLabel,
  onAction
}) => (
  <Box sx={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    textAlign: 'center',
    minHeight: '300px'
  }}>
    {icon}
    
    <Typography sx={{
      fontSize: '1.15rem',
      fontWeight: 600,
      color: 'rgba(255, 255, 255, 0.8)',
      marginTop: '24px',
      marginBottom: '8px'
    }}>
      {title}
    </Typography>
    
    <Typography sx={{
      fontSize: '0.9rem',
      color: 'rgba(255, 255, 255, 0.5)',
      marginBottom: '24px',
      maxWidth: '350px'
    }}>
      {message}
    </Typography>
    
    {actionLabel && onAction && (
      <Button
        variant="contained"
        onClick={onAction}
        sx={{
          minHeight: '48px',
          minWidth: '140px',
          background: 'linear-gradient(135deg, #00f2ea 0%, #ff0055 100%)',
          color: '#fff',
          fontWeight: 600,
          borderRadius: '12px',
          textTransform: 'none',
          '&:hover': {
            background: 'linear-gradient(135deg, #00d4cc 0%, #e6004d 100%)',
          }
        }}
      >
        {actionLabel}
      </Button>
    )}
  </Box>
);
