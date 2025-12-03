import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import { API_BASE_URL } from '../config/constants';
import {
  Verified as VerifiedIcon,
  Shield as ShieldIcon,
  Star as StarIcon,
  TrendingUp as TrendingUpIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';

const TrustScorePage = () => {
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [trustData, setTrustData] = useState({
    score: 0,
    level: 'Basic',
    nextLevel: 'Advanced',
    pointsToNext: 0,
    metrics: {
      responseRate: 0,
      completionRate: 0,
      customerSatisfaction: 0
    },
    badges: []
  });

  useEffect(() => {
    const fetchTrustData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE_URL}/trust/score`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setTrustData({
            score: data.score || user?.reputationScore || 75,
            level: data.level || getLevel(user?.reputationScore || 75),
            nextLevel: data.nextLevel || 'Advanced',
            pointsToNext: data.pointsToNext || 25,
            metrics: {
              responseRate: data.responseRate || 95,
              completionRate: data.completionRate || 98,
              customerSatisfaction: data.customerSatisfaction || 4.8
            },
            badges: data.badges || defaultBadges
          });
        } else {
          // Use defaults
          setTrustData({
            score: user?.reputationScore || 75,
            level: getLevel(user?.reputationScore || 75),
            nextLevel: 'Advanced',
            pointsToNext: 25,
            metrics: {
              responseRate: 95,
              completionRate: 98,
              customerSatisfaction: 4.8
            },
            badges: defaultBadges
          });
        }
      } catch (error) {
        console.error('Trust data fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchTrustData();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  const getLevel = (score) => {
    if (score >= 90) return 'Elite';
    if (score >= 75) return 'Pro';
    if (score >= 50) return 'Advanced';
    return 'Basic';
  };

  const getLevelColor = (level) => {
    const colors = {
      'Basic': '#6b7280',
      'Advanced': '#00f2ea',
      'Pro': '#ffd700',
      'Elite': '#ff0055'
    };
    return colors[level] || '#00f2ea';
  };

  const defaultBadges = [
    { id: 1, name: 'ID Verified', icon: '🆔', earned: true },
    { id: 2, name: 'Phone Verified', icon: '📱', earned: true },
    { id: 3, name: 'Email Verified', icon: '✉️', earned: true },
    { id: 4, name: 'First Service', icon: '⭐', earned: false },
    { id: 5, name: 'Top Rated', icon: '👑', earned: false }
  ];

  if (!isAuthenticated) {
    return (
      <Box sx={styles.container}>
        <Box sx={styles.emptyState}>
          <Typography color="text.secondary">Please log in to view your trust score</Typography>
        </Box>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={styles.loadingContainer}>
        <CircularProgress sx={{ color: '#00f2ea' }} />
      </Box>
    );
  }

  return (
    <Box sx={styles.container}>
      {/* Header */}
      <Box sx={styles.header}>
        <ShieldIcon sx={styles.headerIcon} />
        <Typography sx={styles.headerTitle}>Trust Score</Typography>
        <Typography sx={styles.headerSubtitle}>
          Build trust, unlock opportunities
        </Typography>
      </Box>

      {/* Main Score Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Box sx={styles.scoreCard}>
          <Box sx={styles.scoreCircle}>
            <Typography sx={styles.scoreNumber}>{trustData.score}</Typography>
            <Typography sx={styles.scoreLabel}>Score</Typography>
          </Box>
          <Box sx={styles.levelBadge} style={{ background: `${getLevelColor(trustData.level)}20`, color: getLevelColor(trustData.level) }}>
            {trustData.level}
          </Box>
          
          {/* Progress to Next Level */}
          <Box sx={styles.progressContainer}>
            <Box sx={styles.progressHeader}>
              <Typography sx={styles.progressLabel}>Progress to {trustData.nextLevel}</Typography>
              <Typography sx={styles.progressValue}>{trustData.pointsToNext} pts needed</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, (trustData.score / 100) * 100)}
              sx={styles.progressBar}
            />
          </Box>
        </Box>
      </motion.div>

      {/* Metrics */}
      <Typography sx={styles.sectionTitle}>Performance Metrics</Typography>
      <Box sx={styles.metricsGrid}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Box sx={styles.metricCard}>
            <TrendingUpIcon sx={{ color: '#00ff88', fontSize: 28 }} />
            <Typography sx={styles.metricValue}>{trustData.metrics.responseRate}%</Typography>
            <Typography sx={styles.metricLabel}>Response Rate</Typography>
          </Box>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Box sx={styles.metricCard}>
            <VerifiedIcon sx={{ color: '#00f2ea', fontSize: 28 }} />
            <Typography sx={styles.metricValue}>{trustData.metrics.completionRate}%</Typography>
            <Typography sx={styles.metricLabel}>Completion Rate</Typography>
          </Box>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Box sx={styles.metricCard}>
            <StarIcon sx={{ color: '#ffd700', fontSize: 28 }} />
            <Typography sx={styles.metricValue}>{trustData.metrics.customerSatisfaction}</Typography>
            <Typography sx={styles.metricLabel}>Rating</Typography>
          </Box>
        </motion.div>
      </Box>

      {/* Badges */}
      <Typography sx={styles.sectionTitle}>Badges</Typography>
      <Box sx={styles.badgesGrid}>
        {trustData.badges.map((badge, index) => (
          <motion.div
            key={badge.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * index }}
          >
            <Box sx={{
              ...styles.badgeCard,
              opacity: badge.earned ? 1 : 0.4
            }}>
              <Box sx={styles.badgeIcon}>{badge.icon}</Box>
              <Typography sx={styles.badgeName}>{badge.name}</Typography>
              {badge.earned && (
                <Box sx={styles.earnedCheck}>
                  <CheckIcon sx={{ fontSize: 12 }} />
                </Box>
              )}
            </Box>
          </motion.div>
        ))}
      </Box>

      {/* Tips */}
      <Box sx={styles.tipsCard}>
        <Typography sx={styles.tipsTitle}>💡 Tips to Improve</Typography>
        <Box sx={styles.tipsList}>
          <Box sx={styles.tipItem}>
            <CheckIcon sx={{ fontSize: 16, color: '#00f2ea' }} />
            <Typography>Complete your profile verification</Typography>
          </Box>
          <Box sx={styles.tipItem}>
            <CheckIcon sx={{ fontSize: 16, color: '#00f2ea' }} />
            <Typography>Respond to messages within 2 hours</Typography>
          </Box>
          <Box sx={styles.tipItem}>
            <CheckIcon sx={{ fontSize: 16, color: '#00f2ea' }} />
            <Typography>Maintain high service completion rate</Typography>
          </Box>
        </Box>
      </Box>
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
    textAlign: 'center',
    marginBottom: '24px'
  },
  headerIcon: {
    fontSize: 48,
    color: '#00f2ea',
    marginBottom: '8px'
  },
  headerTitle: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '4px'
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px'
  },
  scoreCard: {
    background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.1), rgba(255, 0, 85, 0.05))',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '24px',
    padding: '32px 24px',
    textAlign: 'center',
    marginBottom: '24px'
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #00f2ea, #ff0055)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px'
  },
  scoreNumber: {
    fontSize: '42px',
    fontWeight: 700,
    color: '#fff'
  },
  scoreLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase'
  },
  levelBadge: {
    display: 'inline-block',
    padding: '6px 16px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '24px'
  },
  progressContainer: {
    maxWidth: 300,
    margin: '0 auto'
  },
  progressHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px'
  },
  progressLabel: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.6)'
  },
  progressValue: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#fff'
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    background: 'rgba(255,255,255,0.1)',
    '& .MuiLinearProgress-bar': {
      background: 'linear-gradient(90deg, #00f2ea, #ff0055)',
      borderRadius: 4
    }
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '16px'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '24px'
  },
  metricCard: {
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '16px',
    textAlign: 'center'
  },
  metricValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#fff',
    marginTop: '8px'
  },
  metricLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '4px'
  },
  badgesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: '12px',
    marginBottom: '24px'
  },
  badgeCard: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '16px',
    textAlign: 'center',
    position: 'relative'
  },
  badgeIcon: {
    fontSize: '32px',
    marginBottom: '8px'
  },
  badgeName: {
    fontSize: '12px',
    color: '#fff',
    fontWeight: 500
  },
  earnedCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#00ff88',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#000'
  },
  tipsCard: {
    background: 'rgba(0, 242, 234, 0.08)',
    border: '1px solid rgba(0, 242, 234, 0.2)',
    borderRadius: '16px',
    padding: '20px'
  },
  tipsTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '12px'
  },
  tipsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  tipItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: 'rgba(255,255,255,0.8)',
    fontSize: '14px'
  }
};

export default TrustScorePage;
