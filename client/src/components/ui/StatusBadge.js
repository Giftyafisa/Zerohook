/**
 * StatusBadge - Centralized badge component for verification and subscription tiers
 * 
 * Use this component for consistent badge styling across the application.
 * This is the SINGLE SOURCE OF TRUTH for badge colors, icons, and labels.
 * 
 * @module components/ui/StatusBadge
 */
import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { Verified, Star, Shield, Diamond, WorkspacePremium } from '@mui/icons-material';

/**
 * Verification tier configuration
 * Defines colors, icons, and labels for each verification level
 */
export const VERIFICATION_TIERS = {
  1: {
    label: 'Basic',
    shortLabel: 'Basic',
    color: '#888888',
    bgColor: 'rgba(136, 136, 136, 0.15)',
    borderColor: 'rgba(136, 136, 136, 0.3)',
    icon: Shield,
    description: 'Email verified'
  },
  2: {
    label: 'Verified',
    shortLabel: 'Verified',
    color: '#00f2ea',
    bgColor: 'rgba(0, 242, 234, 0.15)',
    borderColor: 'rgba(0, 242, 234, 0.3)',
    icon: Verified,
    description: 'ID verified'
  },
  3: {
    label: 'Elite',
    shortLabel: 'Elite',
    color: '#FFD700',
    bgColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: 'rgba(255, 215, 0, 0.3)',
    icon: Verified,
    description: 'Fully verified with background check'
  }
};

/**
 * Subscription tier configuration
 * Defines colors, icons, and labels for each subscription level
 */
export const SUBSCRIPTION_TIERS = {
  free: {
    label: 'Free',
    shortLabel: 'Free',
    color: '#888888',
    bgColor: 'rgba(136, 136, 136, 0.15)',
    borderColor: 'rgba(136, 136, 136, 0.3)',
    icon: null,
    description: 'Free tier'
  },
  basic: {
    label: 'Basic',
    shortLabel: 'Basic',
    color: '#888888',
    bgColor: 'rgba(136, 136, 136, 0.15)',
    borderColor: 'rgba(136, 136, 136, 0.3)',
    icon: null,
    description: 'Basic subscription'
  },
  premium: {
    label: 'Premium',
    shortLabel: 'Premium',
    color: '#00f2ea',
    bgColor: 'rgba(0, 242, 234, 0.15)',
    borderColor: 'rgba(0, 242, 234, 0.3)',
    icon: Star,
    description: 'Premium subscription'
  },
  elite: {
    label: 'Elite',
    shortLabel: 'Elite',
    color: '#FFD700',
    bgColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: 'rgba(255, 215, 0, 0.3)',
    icon: Diamond,
    description: 'Elite subscription'
  },
  vip: {
    label: 'VIP',
    shortLabel: 'VIP',
    color: '#ff0055',
    bgColor: 'rgba(255, 0, 85, 0.15)',
    borderColor: 'rgba(255, 0, 85, 0.3)',
    icon: WorkspacePremium,
    description: 'VIP subscription'
  }
};

/**
 * Get verification tier config with fallback
 * @param {number|string} tier - Verification tier (1, 2, or 3)
 * @returns {Object} Tier configuration object
 */
export const getVerificationTierConfig = (tier) => {
  const tierNum = parseInt(tier) || 1;
  return VERIFICATION_TIERS[tierNum] || VERIFICATION_TIERS[1];
};

/**
 * Get subscription tier config with fallback
 * @param {string} tier - Subscription tier name
 * @returns {Object} Tier configuration object
 */
export const getSubscriptionTierConfig = (tier) => {
  const tierKey = (tier || 'basic').toLowerCase();
  return SUBSCRIPTION_TIERS[tierKey] || SUBSCRIPTION_TIERS.basic;
};

/**
 * VerificationBadge - Shows user's verification status
 * 
 * @param {Object} props
 * @param {number} props.tier - Verification tier (1, 2, or 3)
 * @param {string} props.variant - 'icon' | 'chip' | 'full' (default: 'icon')
 * @param {string} props.size - 'small' | 'medium' | 'large' (default: 'medium')
 * @param {boolean} props.showTooltip - Whether to show tooltip on hover
 */
export const VerificationBadge = ({ 
  tier = 1, 
  variant = 'icon', 
  size = 'medium',
  showTooltip = true 
}) => {
  const config = getVerificationTierConfig(tier);
  const IconComponent = config.icon;
  
  // Don't show badge for tier 1 (unverified) unless explicitly using 'full' variant
  if (tier < 2 && variant !== 'full') {
    return null;
  }
  
  const sizeMap = {
    small: { icon: 14, chip: { px: 0.75, py: 0.25, fontSize: '0.65rem' } },
    medium: { icon: 18, chip: { px: 1, py: 0.5, fontSize: '0.75rem' } },
    large: { icon: 24, chip: { px: 1.5, py: 0.75, fontSize: '0.85rem' } }
  };
  
  const currentSize = sizeMap[size] || sizeMap.medium;
  
  const badge = (
    <>
      {variant === 'icon' && IconComponent && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: config.bgColor,
            borderRadius: '50%',
            p: size === 'small' ? 0.25 : 0.5,
          }}
        >
          <IconComponent sx={{ fontSize: currentSize.icon, color: config.color }} />
        </Box>
      )}
      
      {variant === 'chip' && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: config.bgColor,
            border: `1px solid ${config.borderColor}`,
            borderRadius: '20px',
            ...currentSize.chip,
          }}
        >
          {IconComponent && <IconComponent sx={{ fontSize: currentSize.icon - 2, color: config.color }} />}
          <Typography
            sx={{
              color: config.color,
              fontSize: currentSize.chip.fontSize,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {config.shortLabel}
          </Typography>
        </Box>
      )}
      
      {variant === 'full' && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            bgcolor: config.bgColor,
            border: `1px solid ${config.borderColor}`,
            borderRadius: '8px',
            ...currentSize.chip,
          }}
        >
          {IconComponent && <IconComponent sx={{ fontSize: currentSize.icon, color: config.color }} />}
          <Box>
            <Typography
              sx={{
                color: config.color,
                fontSize: currentSize.chip.fontSize,
                fontWeight: 600,
                lineHeight: 1.2,
              }}
            >
              {config.label}
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.65rem',
                lineHeight: 1.2,
              }}
            >
              {config.description}
            </Typography>
          </Box>
        </Box>
      )}
    </>
  );
  
  if (showTooltip) {
    return (
      <Tooltip title={config.description} placement="top">
        {badge}
      </Tooltip>
    );
  }
  
  return badge;
};

/**
 * SubscriptionBadge - Shows user's subscription status
 * 
 * @param {Object} props
 * @param {string} props.tier - Subscription tier name
 * @param {string} props.variant - 'icon' | 'chip' | 'full' (default: 'chip')
 * @param {string} props.size - 'small' | 'medium' | 'large' (default: 'medium')
 * @param {boolean} props.showTooltip - Whether to show tooltip on hover
 */
export const SubscriptionBadge = ({ 
  tier = 'basic', 
  variant = 'chip', 
  size = 'medium',
  showTooltip = true 
}) => {
  const config = getSubscriptionTierConfig(tier);
  const IconComponent = config.icon;
  
  // Don't show badge for free/basic tiers unless explicitly using 'full' variant
  if ((tier === 'free' || tier === 'basic') && variant !== 'full') {
    return null;
  }
  
  const sizeMap = {
    small: { icon: 12, chip: { px: 0.75, py: 0.25, fontSize: '0.65rem' } },
    medium: { icon: 16, chip: { px: 1, py: 0.5, fontSize: '0.75rem' } },
    large: { icon: 20, chip: { px: 1.5, py: 0.75, fontSize: '0.85rem' } }
  };
  
  const currentSize = sizeMap[size] || sizeMap.medium;
  
  const badge = (
    <>
      {variant === 'icon' && IconComponent && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconComponent sx={{ fontSize: currentSize.icon, color: config.color }} />
        </Box>
      )}
      
      {(variant === 'chip' || variant === 'full') && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            bgcolor: config.bgColor,
            border: `1px solid ${config.borderColor}`,
            borderRadius: '20px',
            ...currentSize.chip,
          }}
        >
          {IconComponent && <IconComponent sx={{ fontSize: currentSize.icon, color: config.color }} />}
          <Typography
            sx={{
              color: config.color,
              fontSize: currentSize.chip.fontSize,
              fontWeight: 600,
              lineHeight: 1,
            }}
          >
            {config.label}
          </Typography>
        </Box>
      )}
    </>
  );
  
  if (showTooltip) {
    return (
      <Tooltip title={config.description} placement="top">
        {badge}
      </Tooltip>
    );
  }
  
  return badge;
};

/**
 * OnlineStatusBadge - Shows user's online status
 * 
 * @param {Object} props
 * @param {boolean} props.isOnline - Whether user is online
 * @param {string} props.variant - 'dot' | 'text' (default: 'dot')
 * @param {string} props.size - 'small' | 'medium' | 'large' (default: 'medium')
 */
export const OnlineStatusBadge = ({ 
  isOnline = false, 
  variant = 'dot', 
  size = 'medium' 
}) => {
  const sizeMap = {
    small: { dot: 8, fontSize: '0.65rem' },
    medium: { dot: 10, fontSize: '0.75rem' },
    large: { dot: 12, fontSize: '0.85rem' }
  };
  
  const currentSize = sizeMap[size] || sizeMap.medium;
  
  if (variant === 'dot') {
    return (
      <Box
        sx={{
          width: currentSize.dot,
          height: currentSize.dot,
          borderRadius: '50%',
          bgcolor: isOnline ? '#00ff88' : '#666',
          boxShadow: isOnline ? '0 0 8px rgba(0, 255, 136, 0.6)' : 'none',
          animation: isOnline ? 'pulse 2s ease-in-out infinite' : 'none',
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1, transform: 'scale(1)' },
            '50%': { opacity: 0.8, transform: 'scale(1.1)' },
          },
        }}
      />
    );
  }
  
  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.5,
        bgcolor: isOnline ? 'rgba(0, 255, 136, 0.15)' : 'rgba(102, 102, 102, 0.15)',
        border: `1px solid ${isOnline ? 'rgba(0, 255, 136, 0.3)' : 'rgba(102, 102, 102, 0.3)'}`,
        borderRadius: '20px',
        px: 1,
        py: 0.25,
      }}
    >
      <Box
        sx={{
          width: currentSize.dot - 2,
          height: currentSize.dot - 2,
          borderRadius: '50%',
          bgcolor: isOnline ? '#00ff88' : '#666',
        }}
      />
      <Typography
        sx={{
          color: isOnline ? '#00ff88' : '#888',
          fontSize: currentSize.fontSize,
          fontWeight: 600,
          lineHeight: 1,
        }}
      >
        {isOnline ? 'Online' : 'Offline'}
      </Typography>
    </Box>
  );
};

export default {
  VerificationBadge,
  SubscriptionBadge,
  OnlineStatusBadge,
  VERIFICATION_TIERS,
  SUBSCRIPTION_TIERS,
  getVerificationTierConfig,
  getSubscriptionTierConfig,
};
