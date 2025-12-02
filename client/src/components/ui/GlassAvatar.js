import React from 'react';
import { Box, Avatar, Typography, Badge } from '@mui/material';
import { styled, keyframes } from '@mui/system';

const onlinePulse = keyframes`
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
  }
`;

const borderRotate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
`;

const AvatarContainer = styled(Box)(({ size, premium, hasStory }) => ({
  position: 'relative',
  width: size,
  height: size,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  
  ...(hasStory && {
    '&::before': {
      content: '""',
      position: 'absolute',
      top: '-3px',
      left: '-3px',
      right: '-3px',
      bottom: '-3px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #00f2ea, #ff0055, #00f2ea)',
      backgroundSize: '200% 200%',
      animation: `${borderRotate} 3s linear infinite`,
      zIndex: 0,
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      borderRadius: '50%',
      background: '#0f0f13',
      zIndex: 1,
    },
  }),
  
  ...(premium && !hasStory && {
    '&::before': {
      content: '""',
      position: 'absolute',
      top: '-2px',
      left: '-2px',
      right: '-2px',
      bottom: '-2px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #ffaa00, #ff6600)',
      zIndex: 0,
    },
    '&::after': {
      content: '""',
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      borderRadius: '50%',
      background: '#0f0f13',
      zIndex: 1,
    },
  }),
}));

const StyledAvatar = styled(Avatar)(({ size }) => ({
  width: size - 6,
  height: size - 6,
  border: '2px solid rgba(255, 255, 255, 0.1)',
  zIndex: 2,
  transition: 'transform 0.3s ease',
  
  '&:hover': {
    transform: 'scale(1.05)',
  },
}));

const OnlineBadge = styled(Box)(({ size }) => ({
  position: 'absolute',
  bottom: size > 48 ? '2px' : '0',
  right: size > 48 ? '2px' : '0',
  width: size > 48 ? '14px' : '10px',
  height: size > 48 ? '14px' : '10px',
  borderRadius: '50%',
  background: '#00f2ea',
  border: '2px solid #0f0f13',
  zIndex: 3,
  animation: `${onlinePulse} 2s ease-in-out infinite`,
}));

const VerifiedBadge = styled(Box)(({ size }) => ({
  position: 'absolute',
  top: '-2px',
  right: '-2px',
  width: size > 48 ? '20px' : '16px',
  height: size > 48 ? '20px' : '16px',
  borderRadius: '50%',
  background: '#00f2ea',
  border: '2px solid #0f0f13',
  zIndex: 3,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: size > 48 ? '12px' : '10px',
}));

const AvatarWithNameContainer = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
});

const NameContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
});

const GlassAvatar = ({
  src,
  alt,
  size = 48,
  isOnline = false,
  isVerified = false,
  isPremium = false,
  hasStory = false,
  name,
  subtitle,
  showName = false,
  onClick,
  ...props
}) => {
  const avatarContent = (
    <AvatarContainer 
      size={size} 
      premium={isPremium} 
      hasStory={hasStory}
      onClick={onClick}
      sx={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <StyledAvatar src={src} alt={alt} size={size} {...props}>
        {!src && alt ? alt.charAt(0).toUpperCase() : null}
      </StyledAvatar>
      {isOnline && <OnlineBadge size={size} />}
      {isVerified && (
        <VerifiedBadge size={size}>
          ✓
        </VerifiedBadge>
      )}
    </AvatarContainer>
  );
  
  if (showName && name) {
    return (
      <AvatarWithNameContainer>
        {avatarContent}
        <NameContainer>
          <Typography
            sx={{
              color: '#ffffff',
              fontSize: '16px',
              fontWeight: 600,
              fontFamily: '"Outfit", sans-serif',
              lineHeight: 1.2,
            }}
          >
            {name}
          </Typography>
          {subtitle && (
            <Typography
              sx={{
                color: isOnline ? '#00f2ea' : 'rgba(255, 255, 255, 0.5)',
                fontSize: '13px',
                fontFamily: '"Outfit", sans-serif',
              }}
            >
              {subtitle || (isOnline ? 'Online' : 'Offline')}
            </Typography>
          )}
        </NameContainer>
      </AvatarWithNameContainer>
    );
  }
  
  return avatarContent;
};

export default GlassAvatar;
