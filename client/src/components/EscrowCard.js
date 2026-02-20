import React from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  Avatar,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  Lock as HeldIcon,
  CheckCircle as ReleaseIcon,
  Warning as DisputeIcon,
  Info as InfoIcon
} from '@mui/icons-material';

/**
 * EscrowCard - A simple, user-friendly component for escrow transactions
 * Uses simple labels: Held, Release, Dispute, Done
 */
const EscrowCard = ({ 
  escrow, 
  onRelease, 
  onDispute, 
  onViewDetails,
  isProvider = false // true if current user is the service provider
}) => {
  const {
    id,
    amount,
    currency = 'USD',
    status = 'held', // held, released, disputed, done
    providerName,
    providerAvatar,
    clientName,
    clientAvatar,
    serviceTitle,
    createdAt,
    description
  } = escrow;

  const getStatusConfig = (status) => {
    switch (status) {
      case 'held':
        return { 
          label: 'Held', 
          color: '#ffa726', 
          bgColor: 'rgba(255, 167, 38, 0.15)',
          icon: <HeldIcon sx={{ fontSize: 16 }} />,
          description: 'Money is safe. Will be released when service is done.'
        };
      case 'released':
      case 'done':
        return { 
          label: 'Done', 
          color: '#66bb6a', 
          bgColor: 'rgba(102, 187, 106, 0.15)',
          icon: <ReleaseIcon sx={{ fontSize: 16 }} />,
          description: 'Payment has been released to the provider.'
        };
      case 'disputed':
        return { 
          label: 'Dispute', 
          color: '#ef5350', 
          bgColor: 'rgba(239, 83, 80, 0.15)',
          icon: <DisputeIcon sx={{ fontSize: 16 }} />,
          description: 'Under review. Our team will help resolve this.'
        };
      default:
        return { 
          label: 'Pending', 
          color: '#90a4ae', 
          bgColor: 'rgba(144, 164, 174, 0.15)',
          icon: <HeldIcon sx={{ fontSize: 16 }} />,
          description: 'Waiting for payment.'
        };
    }
  };

  const statusConfig = getStatusConfig(status);
  const otherParty = isProvider ? { name: clientName, avatar: clientAvatar } : { name: providerName, avatar: providerAvatar };

  const formatCurrency = (amount, currency) => {
    const symbols = { USD: '$', NGN: '₦', GHS: '₵', KES: 'KSh', EUR: '€', GBP: '£' };
    const symbol = symbols[currency] || '$';
    return `${symbol}${Number(amount).toLocaleString()}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  return (
    <Box sx={styles.card}>
      {/* Header: Other party + Status */}
      <Box sx={styles.header}>
        <Box sx={styles.partyInfo}>
          <Avatar src={otherParty.avatar} sx={styles.avatar}>
            {otherParty.name?.[0] || '?'}
          </Avatar>
          <Box>
            <Typography sx={styles.partyName}>{otherParty.name || 'User'}</Typography>
            <Typography sx={styles.serviceTitle}>{serviceTitle || 'Service'}</Typography>
          </Box>
        </Box>
        
        <Box sx={styles.statusSection}>
          <Chip 
            icon={statusConfig.icon}
            label={statusConfig.label}
            size="small"
            sx={{
              ...styles.statusChip,
              bgcolor: statusConfig.bgColor,
              color: statusConfig.color,
              '& .MuiChip-icon': { color: statusConfig.color }
            }}
          />
          <Tooltip title={statusConfig.description}>
            <IconButton size="small" sx={{ color: 'rgba(255,255,255,0.5)' }}>
              <InfoIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Amount */}
      <Box sx={styles.amountSection}>
        <Typography sx={styles.amount}>
          {formatCurrency(amount, currency)}
        </Typography>
        <Typography sx={styles.date}>
          {formatDate(createdAt)}
        </Typography>
      </Box>

      {/* Description */}
      {description && (
        <Typography sx={styles.description}>
          {description}
        </Typography>
      )}

      {/* Helper text */}
      <Box sx={styles.helperText}>
        <HeldIcon sx={{ fontSize: 14, mr: 0.5 }} />
        <Typography variant="caption">
          {statusConfig.description}
        </Typography>
      </Box>

      {/* Actions - Only show for held status and appropriate user */}
      {status === 'held' && (
        <Box sx={styles.actions}>
          {!isProvider && (
            <>
              <Button
                variant="contained"
                size="small"
                onClick={() => onRelease?.(id)}
                sx={styles.releaseBtn}
                startIcon={<ReleaseIcon />}
              >
                Release Payment
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => onDispute?.(id)}
                sx={styles.disputeBtn}
                startIcon={<DisputeIcon />}
              >
                Report Issue
              </Button>
            </>
          )}
          {isProvider && (
            <Typography sx={styles.waitingText}>
              Waiting for client to confirm service...
            </Typography>
          )}
        </Box>
      )}

      {/* View Details Link */}
      {onViewDetails && (
        <Button 
          size="small" 
          onClick={() => onViewDetails(id)}
          sx={styles.detailsLink}
        >
          View Details →
        </Button>
      )}
    </Box>
  );
};

const styles = {
  card: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '12px',
    transition: 'all 0.2s ease',
    '&:hover': {
      background: 'rgba(255,255,255,0.08)',
      borderColor: 'rgba(0, 242, 234, 0.3)'
    }
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '12px'
  },
  partyInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  avatar: {
    width: 44,
    height: 44,
    bgcolor: 'rgba(0, 242, 234, 0.2)',
    color: '#00f2ea'
  },
  partyName: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '15px'
  },
  serviceTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px'
  },
  statusSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  statusChip: {
    fontWeight: 600,
    fontSize: '12px',
    height: '26px'
  },
  amountSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '8px'
  },
  amount: {
    color: '#00f2ea',
    fontSize: '24px',
    fontWeight: 700
  },
  date: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '12px'
  },
  description: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '14px',
    marginBottom: '8px'
  },
  helperText: {
    display: 'flex',
    alignItems: 'center',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '12px',
    marginBottom: '12px',
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px'
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '12px'
  },
  releaseBtn: {
    flex: 1,
    background: 'linear-gradient(135deg, #00f2ea, #00c9c2)',
    color: '#000',
    fontWeight: 600,
    textTransform: 'none',
    borderRadius: '10px',
    '&:hover': {
      background: 'linear-gradient(135deg, #00d4ce, #00b5ae)'
    }
  },
  disputeBtn: {
    flex: 1,
    borderColor: 'rgba(239, 83, 80, 0.5)',
    color: '#ef5350',
    fontWeight: 600,
    textTransform: 'none',
    borderRadius: '10px',
    '&:hover': {
      borderColor: '#ef5350',
      background: 'rgba(239, 83, 80, 0.1)'
    }
  },
  waitingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
    fontStyle: 'italic',
    textAlign: 'center',
    width: '100%'
  },
  detailsLink: {
    color: '#00f2ea',
    fontSize: '13px',
    textTransform: 'none',
    padding: '4px 0',
    marginTop: '8px',
    '&:hover': {
      background: 'transparent',
      textDecoration: 'underline'
    }
  }
};

export default EscrowCard;
