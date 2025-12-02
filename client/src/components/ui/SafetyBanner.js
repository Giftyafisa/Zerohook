/**
 * SafetyBanner - Trust and safety indicator banner
 * Consistent visual element across pages
 * Zerohook Platform
 */

import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/system';
import { VerifiedUser, Lock, Security, Shield } from '@mui/icons-material';

const BannerContainer = styled(Box)(({ variant }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '10px',
  padding: '12px 20px',
  
  background: variant === 'escrow' 
    ? 'rgba(0, 242, 234, 0.08)'
    : variant === 'warning'
      ? 'rgba(255, 170, 0, 0.08)'
      : 'rgba(0, 242, 234, 0.05)',
  
  borderBottom: variant === 'escrow'
    ? '1px solid rgba(0, 242, 234, 0.15)'
    : variant === 'warning'
      ? '1px solid rgba(255, 170, 0, 0.15)'
      : '1px solid rgba(255, 255, 255, 0.05)',
}));

const IconWrapper = styled(Box)(({ variant }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  
  '& .MuiSvgIcon-root': {
    fontSize: '18px',
    color: variant === 'escrow' 
      ? '#00f2ea'
      : variant === 'warning'
        ? '#ffaa00'
        : '#00f2ea',
  },
}));

const SafetyBanner = ({ 
  variant = 'default', 
  message,
  icon,
  showEscrowAmount,
  escrowAmount = '$0.00'
}) => {
  const getIcon = () => {
    if (icon) return icon;
    
    switch (variant) {
      case 'escrow':
        return <Lock />;
      case 'verified':
        return <VerifiedUser />;
      case 'warning':
        return <Security />;
      default:
        return <Shield />;
    }
  };
  
  const getMessage = () => {
    if (message) return message;
    
    switch (variant) {
      case 'escrow':
        return showEscrowAmount 
          ? `Escrow: ${escrowAmount} held securely`
          : 'All transactions protected by Escrow';
      case 'verified':
        return 'All providers verified with ID checks';
      case 'warning':
        return 'Exercise caution and trust your instincts';
      default:
        return 'Safe. Private. Trusted.';
    }
  };
  
  return (
    <BannerContainer variant={variant}>
      <IconWrapper variant={variant}>
        {getIcon()}
      </IconWrapper>
      <Typography
        sx={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'rgba(255, 255, 255, 0.8)',
          fontFamily: '"Outfit", sans-serif',
          
          '& strong': {
            color: variant === 'escrow' ? '#00f2ea' : '#ffffff',
            fontWeight: 700,
          },
        }}
        dangerouslySetInnerHTML={{ __html: getMessage() }}
      />
    </BannerContainer>
  );
};

export default SafetyBanner;
