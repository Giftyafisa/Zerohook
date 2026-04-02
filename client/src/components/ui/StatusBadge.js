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
 * 
 * TIERS:
 * - 0: Unverified (email only)
 * - 1: Basic (phone verified)
 * - 2: Verified (ID + phone)
 * - 3: Pro (video verification)
 * - 4: Elite (manual review + background check)
 */
export const VERIFICATION_TIERS = {
  0: {
    label: 'Unverified',
    shortLabel: 'New',
    color: '#ff4444',
    bgColor: 'rgba(255, 68, 68, 0.15)',
    borderColor: 'rgba(255, 68, 68, 0.3)',
    icon: Shield,
    description: 'Email only - verification pending'
  },
  1: {
    label: 'Basic',
    shortLabel: 'Basic',
    color: '#888888',
    bgColor: 'rgba(136, 136, 136, 0.15)',
    borderColor: 'rgba(136, 136, 136, 0.3)',
    icon: Shield,
    description: 'Phone verified'
  },
  2: {
    label: 'Verified',
    shortLabel: 'Verified',
    color: '#00f2ea',
    bgColor: 'rgba(0, 242, 234, 0.15)',
    borderColor: 'rgba(0, 242, 234, 0.3)',
    icon: Verified,
    description: 'ID + phone verified'
  },
  3: {
    label: 'Pro',
    shortLabel: 'Pro',
    color: '#9c27b0',
    bgColor: 'rgba(156, 39, 176, 0.15)',
    borderColor: 'rgba(156, 39, 176, 0.3)',
    icon: Star,
    description: 'Video verification completed'
  },
  4: {
    label: 'Elite',
    shortLabel: 'Elite',
    color: '#FFD700',
    bgColor: 'rgba(255, 215, 0, 0.15)',
    borderColor: 'rgba(255, 215, 0, 0.3)',
    icon: Diamond,
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
 * @param {number|string} tier - Verification tier (0-4)
 * @returns {Object} Tier configuration object
 */
export const getVerificationTierConfig = (tier) => {
  const tierNum = parseInt(tier);
  // Handle NaN, negative, or undefined - default to tier 0
  if (isNaN(tierNum) || tierNum < 0) return VERIFICATION_TIERS[0];
  // Cap at max tier
  if (tierNum > 4) return VERIFICATION_TIERS[4];
  return VERIFICATION_TIERS[tierNum] || VERIFICATION_TIERS[0];
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
 * @param {number} props.tier - Verification tier (0-4)
 * @param {string} props.variant - 'icon' | 'chip' | 'full' (default: 'icon')
 * @param {string} props.size - 'small' | 'medium' | 'large' (default: 'medium')
 * @param {boolean} props.showTooltip - Whether to show tooltip on hover
 * @param {boolean} props.showUnverified - Whether to show badge for tier 0/1 (default: false)
 */
export const VerificationBadge = ({ 
  tier = 1, 
  variant = 'icon', 
  size = 'medium',
  showTooltip = true,
  showUnverified = false
}) => {
  const config = getVerificationTierConfig(tier);
  const IconComponent = config.icon;
  
  // Don't show badge for tier 0/1 (unverified/basic) unless explicitly requested or using 'full' variant
  if (tier < 2 && variant !== 'full' && !showUnverified) {
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

/**
 * TrustScoreBreakdown - Shows detailed breakdown of trust score factors
 * 
 * @param {Object} props
 * @param {Object} props.profile - Profile object with trust data
 * @param {string} props.variant - 'compact' | 'full' (default: 'compact')
 */
export const TrustScoreBreakdown = ({ 
  profile = {}, 
  variant = 'compact'
}) => {
  // Calculate score components
  const verificationTier = parseInt(profile.verification_tier || profile.verificationTier) || 0;
  const averageRating = parseFloat(profile.average_rating || profile.averageRating) || 4.0;
  const completionRate = parseFloat(profile.completion_rate || profile.completionRate) || 80;
  const disputeCount = parseInt(profile.dispute_count || profile.disputeCount) || 0;
  
  // Check if recently active (within last 24 hours)
  const lastActive = profile.last_active || profile.lastActive;
  const isRecentlyActive = lastActive 
    ? (Date.now() - new Date(lastActive).getTime()) < 24 * 60 * 60 * 1000
    : false;

  // Calculate breakdown using the composite scoring formula
  const breakdown = {
    verification: {
      label: 'Verification',
      weight: 0.30,
      current: Math.round((verificationTier / 4) * 30),
      max: 30,
      description: `Tier ${verificationTier}/4`
    },
    reviews: {
      label: 'Reviews & Ratings',
      weight: 0.25,
      current: Math.round((averageRating / 5) * 25),
      max: 25,
      description: `${averageRating.toFixed(1)}/5 rating`
    },
    completion: {
      label: 'Completion Rate',
      weight: 0.20,
      current: Math.round((completionRate / 100) * 20),
      max: 20,
      description: `${Math.round(completionRate)}% completed`
    },
    activity: {
      label: 'Recent Activity',
      weight: 0.15,
      current: isRecentlyActive ? 15 : 0,
      max: 15,
      description: isRecentlyActive ? 'Active today' : 'Inactive'
    },
    disputes: {
      label: 'Dispute History',
      weight: 0.10,
      current: Math.max(0, 10 - (disputeCount * 2)),
      max: 10,
      description: disputeCount === 0 ? 'No disputes' : `${disputeCount} dispute(s)`
    }
  };

  const totalScore = Object.values(breakdown).reduce((sum, item) => sum + item.current, 0);

  if (variant === 'compact') {
    // Compact tooltip-friendly version
    return (
      <Box sx={{ minWidth: 180, p: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
            Trust Score
          </Typography>
          <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#00f2ea' }}>
            {Math.round(totalScore)}%
          </Typography>
        </Box>
        
        {Object.entries(breakdown).map(([key, data]) => (
          <Box key={key} sx={{ mb: 0.75 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
              <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.7)' }}>
                {data.label}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: '#fff' }}>
                {data.current}/{data.max}
              </Typography>
            </Box>
            <Box 
              sx={{ 
                height: 4, 
                bgcolor: 'rgba(255,255,255,0.1)', 
                borderRadius: 2,
                overflow: 'hidden'
              }}
            >
              <Box 
                sx={{ 
                  height: '100%', 
                  width: `${(data.current / data.max) * 100}%`,
                  bgcolor: data.current === data.max ? '#4ade80' : '#00f2ea',
                  borderRadius: 2,
                  transition: 'width 0.3s ease'
                }}
              />
            </Box>
          </Box>
        ))}
      </Box>
    );
  }

  // Full detailed version for profile pages
  return (
    <Box 
      sx={{ 
        p: 2.5, 
        bgcolor: 'rgba(0,242,234,0.08)', 
        borderRadius: 2,
        border: '1px solid rgba(0,242,234,0.15)'
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography 
            sx={{ 
              fontSize: '2rem', 
              fontWeight: 800, 
              color: totalScore >= 80 ? '#4ade80' : totalScore >= 60 ? '#00f2ea' : '#ffa500',
              lineHeight: 1
            }}
          >
            {Math.round(totalScore)}
          </Typography>
          <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
            Trust Score
          </Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Box 
            sx={{ 
              height: 8, 
              bgcolor: 'rgba(255,255,255,0.1)', 
              borderRadius: 4,
              overflow: 'hidden'
            }}
          >
            <Box 
              sx={{ 
                height: '100%', 
                width: `${totalScore}%`,
                background: totalScore >= 80 
                  ? 'linear-gradient(90deg, #4ade80, #22c55e)' 
                  : totalScore >= 60 
                    ? 'linear-gradient(90deg, #00f2ea, #00d4aa)'
                    : 'linear-gradient(90deg, #ffa500, #ff8c00)',
                borderRadius: 4,
                transition: 'width 0.5s ease'
              }}
            />
          </Box>
          <Typography sx={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', mt: 0.5 }}>
            {totalScore >= 80 ? 'Excellent' : totalScore >= 60 ? 'Good' : 'Building Trust'}
          </Typography>
        </Box>
      </Box>
      
      {/* Breakdown */}
      <Typography sx={{ fontWeight: 600, fontSize: '0.85rem', mb: 1.5, color: 'rgba(255,255,255,0.8)' }}>
        Score Breakdown
      </Typography>
      
      {Object.entries(breakdown).map(([key, data]) => (
        <Box key={key} sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Box>
              <Typography sx={{ fontSize: '0.8rem', color: '#fff' }}>
                {data.label}
              </Typography>
              <Typography sx={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)' }}>
                {data.description}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>
              {data.current}/{data.max}
            </Typography>
          </Box>
          <Box 
            sx={{ 
              height: 6, 
              bgcolor: 'rgba(255,255,255,0.1)', 
              borderRadius: 3,
              overflow: 'hidden'
            }}
          >
            <Box 
              sx={{ 
                height: '100%', 
                width: `${(data.current / data.max) * 100}%`,
                bgcolor: data.current === data.max ? '#4ade80' : data.current >= data.max * 0.7 ? '#00f2ea' : '#ffa500',
                borderRadius: 3,
                transition: 'width 0.3s ease'
              }}
            />
          </Box>
        </Box>
      ))}
    </Box>
  );
};

const statusBadgeExports = {
  VerificationBadge,
  SubscriptionBadge,
  OnlineStatusBadge,
  TrustScoreBreakdown,
  VERIFICATION_TIERS,
  SUBSCRIPTION_TIERS,
  getVerificationTierConfig,
  getSubscriptionTierConfig,
};

export default statusBadgeExports;
