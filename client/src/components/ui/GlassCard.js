import React from 'react';
import { Box, Typography } from '@mui/material';
import { keyframes } from '@mui/system';

const glowPulse = keyframes`
  0%, 100% {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  }
  50% {
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 20px rgba(0, 242, 234, 0.15);
  }
`;

const GlassCard = ({
  children,
  title,
  subtitle,
  icon,
  onClick,
  hoverable = true,
  glowing = false,
  variant = 'default',
  sx = {},
  ...props
}) => {
  const variants = {
    default: {
      background: 'rgba(255, 255, 255, 0.05)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    primary: {
      background: 'rgba(0, 242, 234, 0.1)',
      borderColor: 'rgba(0, 242, 234, 0.3)',
    },
    secondary: {
      background: 'rgba(255, 0, 85, 0.1)',
      borderColor: 'rgba(255, 0, 85, 0.3)',
    },
    elevated: {
      background: 'rgba(255, 255, 255, 0.08)',
      borderColor: 'rgba(255, 255, 255, 0.15)',
    },
  };

  const currentVariant = variants[variant] || variants.default;

  return (
    <Box
      onClick={onClick}
      sx={{
        background: currentVariant.background,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '24px',
        padding: { xs: '16px', md: '24px' },
        border: `1px solid ${currentVariant.borderColor}`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        transition: 'all 0.3s ease',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        ...(hoverable && {
          '&:hover': {
            transform: 'translateY(-4px)',
            borderColor: '#00f2ea',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 242, 234, 0.15)',
          },
        }),
        ...(glowing && {
          animation: `${glowPulse} 3s infinite ease-in-out`,
        }),
        ...sx,
      }}
      {...props}
    >
      {/* Shimmer effect overlay */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '100%',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.05), transparent)',
          transition: 'left 0.8s ease',
          pointerEvents: 'none',
          '.MuiBox-root:hover > &': {
            left: '100%',
          },
        }}
      />

      {/* Card Header */}
      {(title || icon) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            mb: 2,
            pb: subtitle ? 2 : 0,
            borderBottom: subtitle ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
          }}
        >
          {icon && (
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #00f2ea 0%, #ff0055 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '24px',
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ flex: 1 }}>
            {title && (
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  color: '#ffffff',
                  fontSize: { xs: '16px', md: '18px' },
                }}
              >
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography
                variant="body2"
                sx={{
                  color: '#a0a0b0',
                  fontSize: '14px',
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
      )}

      {/* Card Content */}
      {children}
    </Box>
  );
};

export default GlassCard;
