import React from 'react';
import { Box, Typography, Avatar, Chip } from '@mui/material';
import { styled, keyframes } from '@mui/system';
import VerifiedIcon from '@mui/icons-material/Verified';
import StarIcon from '@mui/icons-material/Star';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import FavoriteIcon from '@mui/icons-material/Favorite';

const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
`;

const shimmer = keyframes`
  0% {
    background-position: -200% center;
  }
  100% {
    background-position: 200% center;
  }
`;

const ProfileCardContainer = styled(Box)(({ online }) => ({
  position: 'relative',
  borderRadius: '24px',
  overflow: 'hidden',
  background: 'linear-gradient(145deg, rgba(30, 30, 40, 0.9) 0%, rgba(20, 20, 30, 0.95) 100%)',
  backdropFilter: 'blur(12px)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
  cursor: 'pointer',
  
  '&:hover': {
    transform: 'translateY(-8px) scale(1.02)',
    border: '1px solid rgba(0, 242, 234, 0.3)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4), 0 0 30px rgba(0, 242, 234, 0.15)',
    
    '& .profile-image': {
      transform: 'scale(1.1)',
    },
    
    '& .overlay-gradient': {
      opacity: 0.7,
    },
    
    '& .like-button': {
      opacity: 1,
      transform: 'translateY(0)',
    },
  },
}));

const ImageContainer = styled(Box)({
  position: 'relative',
  width: '100%',
  aspectRatio: '3/4',
  overflow: 'hidden',
});

const ProfileImage = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  transition: 'transform 0.5s ease',
});

const OverlayGradient = styled(Box)({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  height: '60%',
  background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.9))',
  transition: 'opacity 0.3s ease',
});

const OnlineIndicator = styled(Box)(({ online }) => ({
  position: 'absolute',
  top: '12px',
  right: '12px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 12px',
  borderRadius: '20px',
  background: online ? 'rgba(0, 242, 234, 0.2)' : 'rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(8px)',
  border: `1px solid ${online ? 'rgba(0, 242, 234, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
  
  '&::before': {
    content: '""',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: online ? '#00f2ea' : '#666',
    animation: online ? `${pulse} 2s ease-in-out infinite` : 'none',
  },
}));

const LikeButton = styled(Box)({
  position: 'absolute',
  top: '12px',
  left: '12px',
  width: '40px',
  height: '40px',
  borderRadius: '50%',
  background: 'rgba(255, 0, 85, 0.2)',
  backdropFilter: 'blur(8px)',
  border: '1px solid rgba(255, 0, 85, 0.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  opacity: 0,
  transform: 'translateY(-10px)',
  transition: 'all 0.3s ease',
  
  '&:hover': {
    background: 'rgba(255, 0, 85, 0.4)',
    transform: 'scale(1.1)',
  },
});

const ContentArea = styled(Box)({
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  padding: '20px',
});

const NameRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  marginBottom: '4px',
});

const PriceTag = styled(Box)({
  display: 'inline-flex',
  alignItems: 'center',
  padding: '6px 12px',
  borderRadius: '12px',
  background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.2), rgba(0, 242, 234, 0.1))',
  border: '1px solid rgba(0, 242, 234, 0.3)',
  marginTop: '12px',
});

const SpecializationChip = styled(Chip)({
  background: 'rgba(255, 255, 255, 0.1)',
  color: '#ffffff',
  fontSize: '11px',
  height: '24px',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  
  '&:hover': {
    background: 'rgba(0, 242, 234, 0.2)',
    border: '1px solid rgba(0, 242, 234, 0.3)',
  },
});

const ProfileCard = ({
  id,
  name,
  age,
  location,
  rating,
  reviewCount,
  price,
  currency = 'NGN',
  image,
  isOnline = false,
  isVerified = false,
  isPremium = false,
  specializations = [],
  onClick,
  onLike,
}) => {
  const handleLikeClick = (e) => {
    e.stopPropagation();
    onLike?.(id);
  };
  
  return (
    <ProfileCardContainer online={isOnline} onClick={() => onClick?.(id)}>
      <ImageContainer>
        <ProfileImage
          className="profile-image"
          src={image || '/default-avatar.png'}
          alt={name}
          loading="lazy"
        />
        <OverlayGradient className="overlay-gradient" />
        
        <OnlineIndicator online={isOnline}>
          <Typography
            sx={{
              color: isOnline ? '#00f2ea' : '#999',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: '"Outfit", sans-serif',
            }}
          >
            {isOnline ? 'Online' : 'Offline'}
          </Typography>
        </OnlineIndicator>
        
        <LikeButton className="like-button" onClick={handleLikeClick}>
          <FavoriteIcon sx={{ color: '#ff0055', fontSize: 20 }} />
        </LikeButton>
        
        <ContentArea>
          <NameRow>
            <Typography
              sx={{
                color: '#ffffff',
                fontSize: '20px',
                fontWeight: 700,
                fontFamily: '"Outfit", sans-serif',
              }}
            >
              {name}
            </Typography>
            {age && (
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  fontSize: '18px',
                  fontWeight: 500,
                  fontFamily: '"Outfit", sans-serif',
                }}
              >
                {age}
              </Typography>
            )}
            {isVerified && (
              <VerifiedIcon sx={{ color: '#00f2ea', fontSize: 20 }} />
            )}
            {isPremium && (
              <StarIcon sx={{ color: '#ffaa00', fontSize: 20 }} />
            )}
          </NameRow>
          
          {location && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <LocationOnIcon sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: 16 }} />
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '14px',
                  fontFamily: '"Outfit", sans-serif',
                }}
              >
                {location}
              </Typography>
            </Box>
          )}
          
          {rating && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <StarIcon sx={{ color: '#ffaa00', fontSize: 16 }} />
              <Typography
                sx={{
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 600,
                  fontFamily: '"Outfit", sans-serif',
                }}
              >
                {rating.toFixed(1)}
              </Typography>
              {reviewCount && (
                <Typography
                  sx={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '12px',
                    fontFamily: '"Outfit", sans-serif',
                  }}
                >
                  ({reviewCount} reviews)
                </Typography>
              )}
            </Box>
          )}
          
          {specializations.length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {specializations.slice(0, 3).map((spec, index) => (
                <SpecializationChip key={index} label={spec} size="small" />
              ))}
            </Box>
          )}
          
          {price && (
            <PriceTag>
              <Typography
                sx={{
                  color: '#00f2ea',
                  fontSize: '16px',
                  fontWeight: 700,
                  fontFamily: '"Outfit", sans-serif',
                }}
              >
                {currency} {price.toLocaleString()}
              </Typography>
              <Typography
                sx={{
                  color: 'rgba(255, 255, 255, 0.5)',
                  fontSize: '12px',
                  fontFamily: '"Outfit", sans-serif',
                  ml: 0.5,
                }}
              >
                /hr
              </Typography>
            </PriceTag>
          )}
        </ContentArea>
      </ImageContainer>
    </ProfileCardContainer>
  );
};

export default ProfileCard;
