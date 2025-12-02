import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  Badge,
  CircularProgress
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Verified as VerifiedIcon,
  TrendingUp as TrendingUpIcon,
  Message as MessageIcon,
  People as PeopleIcon,
  AccountBalanceWallet as WalletIcon,
  Star as StarIcon,
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    walletBalance: 0,
    escrowHeld: 0,
    trustScore: 0,
    unreadMessages: 0,
    activeConnections: 0,
    pendingRequests: 0
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/dashboard/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setStats({
            walletBalance: data.walletBalance || 0,
            escrowHeld: data.escrowHeld || 0,
            trustScore: data.trustScore || user?.reputationScore || 85,
            unreadMessages: data.unreadMessages || 0,
            activeConnections: data.activeConnections || 0,
            pendingRequests: data.pendingRequests || 0
          });
        }
      } catch (error) {
        console.error('Dashboard fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchDashboardData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  if (!isAuthenticated) {
    return (
      <Box sx={styles.container}>
        <Box sx={styles.emptyState}>
          <Typography variant="h6" color="text.secondary">
            Please log in to access your dashboard
          </Typography>
        </Box>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={styles.loadingContainer}>
        <CircularProgress sx={{ color: 'var(--accent-cyan)' }} />
      </Box>
    );
  }

  const quickActions = [
    { icon: <MessageIcon />, label: 'Messages', badge: stats.unreadMessages, path: '/messages', color: '#00f2ea' },
    { icon: <PeopleIcon />, label: 'Connections', badge: stats.pendingRequests, path: '/browse', color: '#ff0055' },
    { icon: <WalletIcon />, label: 'Wallet', badge: null, path: '/transactions', color: '#8b5cf6' },
    { icon: <StarIcon />, label: 'Trust Score', badge: null, path: '/trust', color: '#ffd700' }
  ];

  return (
    <Box sx={styles.container}>
      {/* Header */}
      <Box sx={styles.header}>
        <Box sx={styles.headerLeft}>
          <Avatar
            src={user?.profilePicture}
            sx={styles.avatar}
          >
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </Avatar>
          <Box>
            <Typography variant="h5" sx={styles.greeting}>
              Hey, {user?.profileData?.firstName || user?.username || 'there'}! 👋
            </Typography>
            <Box sx={styles.verifiedRow}>
              {user?.verificationTier >= 2 && (
                <Box sx={styles.verifiedBadge}>
                  <VerifiedIcon sx={{ fontSize: 14 }} />
                  <span>Verified</span>
                </Box>
              )}
              <Typography variant="body2" sx={styles.memberSince}>
                Member since {new Date(user?.createdAt || Date.now()).getFullYear()}
              </Typography>
            </Box>
          </Box>
        </Box>
        <IconButton sx={styles.notificationBtn}>
          <Badge badgeContent={stats.unreadMessages} color="error">
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Box>

      {/* Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Box sx={styles.balanceCard}>
          <Typography sx={styles.balanceLabel}>Available Balance</Typography>
          <Typography sx={styles.balanceAmount}>
            ${stats.walletBalance.toFixed(2)}
          </Typography>
          <Box sx={styles.escrowRow}>
            <Box sx={styles.escrowItem}>
              <Typography sx={styles.escrowLabel}>In Escrow</Typography>
              <Typography sx={styles.escrowValue}>${stats.escrowHeld.toFixed(2)}</Typography>
            </Box>
            <Box sx={styles.divider} />
            <Box sx={styles.escrowItem}>
              <Typography sx={styles.escrowLabel}>Trust Score</Typography>
              <Typography sx={styles.escrowValue}>{stats.trustScore}%</Typography>
            </Box>
          </Box>
        </Box>
      </motion.div>

      {/* Quick Actions */}
      <Typography sx={styles.sectionTitle}>Quick Actions</Typography>
      <Box sx={styles.quickActionsGrid}>
        {quickActions.map((action, index) => (
          <motion.div
            key={action.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
          >
            <Box
              sx={styles.quickActionCard}
              onClick={() => navigate(action.path)}
            >
              <Badge badgeContent={action.badge} color="error" sx={styles.actionBadge}>
                <Box sx={{ ...styles.actionIcon, background: `${action.color}20` }}>
                  {React.cloneElement(action.icon, { sx: { color: action.color } })}
                </Box>
              </Badge>
              <Typography sx={styles.actionLabel}>{action.label}</Typography>
            </Box>
          </motion.div>
        ))}
      </Box>

      {/* Stats Overview */}
      <Typography sx={styles.sectionTitle}>Overview</Typography>
      <Box sx={styles.statsGrid}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Box sx={styles.statCard}>
            <Box sx={styles.statHeader}>
              <TrendingUpIcon sx={{ color: '#00ff88' }} />
              <Typography sx={styles.statLabel}>Active Connections</Typography>
            </Box>
            <Typography sx={styles.statValue}>{stats.activeConnections}</Typography>
          </Box>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Box sx={styles.statCard}>
            <Box sx={styles.statHeader}>
              <PeopleIcon sx={{ color: '#ff0055' }} />
              <Typography sx={styles.statLabel}>Pending Requests</Typography>
            </Box>
            <Typography sx={styles.statValue}>{stats.pendingRequests}</Typography>
          </Box>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <Box sx={styles.statCard}>
            <Box sx={styles.statHeader}>
              <MessageIcon sx={{ color: '#00f2ea' }} />
              <Typography sx={styles.statLabel}>Unread Messages</Typography>
            </Box>
            <Typography sx={styles.statValue}>{stats.unreadMessages}</Typography>
          </Box>
        </motion.div>
      </Box>

      {/* View Profile Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Box sx={styles.viewProfileBtn} onClick={() => navigate('/profile')}>
          <Typography>View My Profile</Typography>
          <ArrowForwardIcon />
        </Box>
      </motion.div>
    </Box>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'var(--bg-primary, #0f0f13)',
    padding: '20px',
    paddingBottom: '100px'
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-primary, #0f0f13)'
  },
  emptyState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px'
  },
  avatar: {
    width: 56,
    height: 56,
    border: '2px solid var(--accent-cyan, #00f2ea)',
    background: 'linear-gradient(135deg, #00f2ea, #ff0055)'
  },
  greeting: {
    fontWeight: 700,
    color: '#fff',
    fontSize: '1.25rem'
  },
  verifiedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '4px'
  },
  verifiedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    background: 'rgba(0, 242, 234, 0.15)',
    borderRadius: '12px',
    fontSize: '12px',
    color: '#00f2ea',
    fontWeight: 500
  },
  memberSince: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '12px'
  },
  notificationBtn: {
    background: 'rgba(255,255,255,0.05)',
    color: '#fff',
    '&:hover': {
      background: 'rgba(255,255,255,0.1)'
    }
  },
  balanceCard: {
    background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.1), rgba(255, 0, 85, 0.1))',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '24px',
    padding: '24px',
    textAlign: 'center',
    marginBottom: '24px'
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
    marginBottom: '8px'
  },
  balanceAmount: {
    fontSize: '42px',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #00f2ea, #ff0055)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '20px'
  },
  escrowRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '24px'
  },
  escrowItem: {
    textAlign: 'center'
  },
  escrowLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '12px'
  },
  escrowValue: {
    color: '#fff',
    fontSize: '18px',
    fontWeight: 600
  },
  divider: {
    width: '1px',
    height: '30px',
    background: 'rgba(255,255,255,0.1)'
  },
  sectionTitle: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '16px',
    marginBottom: '16px'
  },
  quickActionsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '24px',
    '@media (max-width: 600px)': {
      gridTemplateColumns: 'repeat(2, 1fr)'
    }
  },
  quickActionCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '16px',
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      background: 'rgba(255,255,255,0.1)',
      transform: 'translateY(-2px)'
    }
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionBadge: {
    '& .MuiBadge-badge': {
      top: 5,
      right: 5
    }
  },
  actionLabel: {
    color: '#fff',
    fontSize: '13px',
    fontWeight: 500
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '24px',
    '@media (max-width: 600px)': {
      gridTemplateColumns: '1fr'
    }
  },
  statCard: {
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '16px'
  },
  statHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px'
  },
  statLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '13px'
  },
  statValue: {
    color: '#fff',
    fontSize: '28px',
    fontWeight: 700
  },
  viewProfileBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '16px',
    background: 'linear-gradient(135deg, #00f2ea, #00c2bb)',
    borderRadius: '14px',
    color: '#000',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      transform: 'scale(0.98)',
      boxShadow: '0 4px 20px rgba(0, 242, 234, 0.3)'
    }
  }
};

export default DashboardPage;
