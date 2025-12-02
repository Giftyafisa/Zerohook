import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import { styled, keyframes } from '@mui/system';

const shimmer = keyframes`
  0% {
    left: -100%;
  }
  100% {
    left: 100%;
  }
`;

const GlassButtonStyled = styled(Button)(({ theme, variant, glowing }) => ({
  position: 'relative',
  overflow: 'hidden',
  fontFamily: '"Outfit", sans-serif',
  fontWeight: 600,
  fontSize: '16px',
  padding: '14px 28px',
  borderRadius: '16px',
  textTransform: 'none',
  transition: 'all 0.3s ease',
  
  ...(variant === 'primary' && {
    background: '#00f2ea',
    color: '#0f0f13',
    border: 'none',
    '&:hover': {
      background: '#00f2ea',
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 20px rgba(0, 242, 234, 0.4)',
    },
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: '-100%',
      width: '100%',
      height: '100%',
      background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
    },
    '&:hover::before': {
      animation: `${shimmer} 0.6s forwards`,
    },
  }),
  
  ...(variant === 'secondary' && {
    background: '#ff0055',
    color: '#ffffff',
    border: 'none',
    '&:hover': {
      background: '#ff0055',
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 20px rgba(255, 0, 85, 0.4)',
    },
  }),
  
  ...(variant === 'outlined' && {
    background: 'transparent',
    color: '#00f2ea',
    border: '2px solid #00f2ea',
    '&:hover': {
      background: 'rgba(0, 242, 234, 0.1)',
      borderColor: '#00f2ea',
      transform: 'translateY(-2px)',
    },
  }),
  
  ...(variant === 'glass' && {
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(8px)',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.1)',
      borderColor: '#00f2ea',
    },
  }),
  
  ...(glowing && {
    boxShadow: '0 0 20px rgba(0, 242, 234, 0.4)',
    '&:hover': {
      boxShadow: '0 0 30px rgba(0, 242, 234, 0.6)',
    },
  }),
  
  '&:active': {
    transform: 'scale(0.98)',
  },
  
  '&:disabled': {
    opacity: 0.6,
    cursor: 'not-allowed',
    transform: 'none',
    boxShadow: 'none',
  },
}));

const GlassButton = ({
  children,
  variant = 'primary',
  loading = false,
  glowing = false,
  startIcon,
  endIcon,
  ...props
}) => {
  return (
    <GlassButtonStyled
      variant={variant}
      glowing={glowing ? 1 : 0}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <CircularProgress size={20} sx={{ color: 'inherit', mr: children ? 1 : 0 }} />
      ) : (
        startIcon && <span style={{ marginRight: '8px', display: 'flex' }}>{startIcon}</span>
      )}
      {children}
      {!loading && endIcon && <span style={{ marginLeft: '8px', display: 'flex' }}>{endIcon}</span>}
    </GlassButtonStyled>
  );
};

export default GlassButton;
