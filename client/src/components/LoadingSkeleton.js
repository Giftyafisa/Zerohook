import React from 'react';
import { Box, Skeleton } from '@mui/material';

export const BookingCardSkeleton = () => (
  <Box sx={{
    background: 'linear-gradient(135deg, rgba(18, 18, 18, 0.95), rgba(30, 30, 30, 0.95))',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  }}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
      <Skeleton variant="circular" width={48} height={48} sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
      <Box sx={{ flex: 1 }}>
        <Skeleton variant="text" width="60%" sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', fontSize: '1.2rem' }} />
        <Skeleton variant="text" width="40%" sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
      </Box>
    </Box>
    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
      <Skeleton variant="rectangular" width={100} height={32} sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px' }} />
      <Skeleton variant="rectangular" width={80} height={32} sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', borderRadius: '8px' }} />
    </Box>
    <Skeleton variant="text" width="80%" sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
    <Skeleton variant="text" width="50%" sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
  </Box>
);

export const WalletCardSkeleton = () => (
  <Box sx={{
    background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.1), rgba(255, 0, 85, 0.1))',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '16px',
    border: '1px solid rgba(0, 242, 234, 0.3)'
  }}>
    <Skeleton variant="text" width="40%" sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', mb: 1 }} />
    <Skeleton variant="text" width="60%" sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', fontSize: '2rem', mb: 2 }} />
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Skeleton variant="rectangular" width={120} height={40} sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', borderRadius: '8px' }} />
      <Skeleton variant="rectangular" width={120} height={40} sx={{ bgcolor: 'rgba(255, 255, 255, 0.2)', borderRadius: '8px' }} />
    </Box>
  </Box>
);

export const TransactionSkeleton = () => (
  <Box sx={{
    display: 'flex',
    alignItems: 'center',
    padding: '16px',
    marginBottom: '8px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  }}>
    <Skeleton variant="circular" width={40} height={40} sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', mr: 2 }} />
    <Box sx={{ flex: 1 }}>
      <Skeleton variant="text" width="50%" sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
      <Skeleton variant="text" width="30%" sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
    </Box>
    <Skeleton variant="text" width={80} sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)' }} />
  </Box>
);

export const ProfileCardSkeleton = () => (
  <Box sx={{
    background: 'linear-gradient(135deg, rgba(18, 18, 18, 0.95), rgba(30, 30, 30, 0.95))',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  }}>
    <Skeleton variant="rectangular" width="100%" height={200} sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', borderRadius: '12px', mb: 2 }} />
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
      <Skeleton variant="text" width="60%" sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', fontSize: '1.2rem' }} />
      <Skeleton variant="circular" width={24} height={24} sx={{ bgcolor: 'rgba(0, 242, 234, 0.3)' }} />
    </Box>
    <Skeleton variant="text" width="40%" sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', mb: 2 }} />
    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
      <Skeleton variant="rectangular" width={60} height={24} sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', borderRadius: '12px' }} />
      <Skeleton variant="rectangular" width={80} height={24} sx={{ bgcolor: 'rgba(255, 255, 255, 0.1)', borderRadius: '12px' }} />
    </Box>
    <Skeleton variant="rectangular" width="100%" height={48} sx={{ bgcolor: 'rgba(0, 242, 234, 0.2)', borderRadius: '8px' }} />
  </Box>
);

export const ListSkeleton = ({ count = 3, variant = 'booking' }) => {
  const SkeletonComponent = {
    booking: BookingCardSkeleton,
    wallet: WalletCardSkeleton,
    transaction: TransactionSkeleton,
    profile: ProfileCardSkeleton
  }[variant] || BookingCardSkeleton;

  return (
    <Box>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonComponent key={index} />
      ))}
    </Box>
  );
};
