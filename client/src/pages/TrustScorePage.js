import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Button,
  Divider,
  Avatar,
  Badge
} from '@mui/material';
import {
  TrendingUp,
  CheckCircle,
  Star,
  EmojiEvents,
  Timeline,
  VerifiedUser
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { colors } from '../theme/colors';

const TrustScorePage = () => {
  const [trustData] = useState({
    overallScore: 87,
    level: 'Advanced',
    nextLevel: 'Pro',
    pointsToNext: 13,
    totalPoints: 870,
    maxPoints: 1000,
    verificationTier: 'Advanced',
    badges: [
      { name: 'Identity Verified', icon: '🆔', earned: true, points: 100 },
      { name: 'Phone Verified', icon: '📱', earned: true, points: 50 },
      { name: 'Email Verified', icon: '✉️', earned: true, points: 25 },
      { name: 'Social Connected', icon: '🔗', earned: true, points: 75 },
      { name: 'Payment Method', icon: '💳', earned: true, points: 100 },
      { name: 'First Service', icon: '⭐', earned: true, points: 100 },
      { name: '5+ Reviews', icon: '📝', earned: true, points: 150 },
      { name: 'Response Rate', icon: '⚡', earned: true, points: 100 },
      { name: 'Elite Status', icon: '👑', earned: false, points: 200 }
    ],
    metrics: {
      responseTime: '2.3 hours',
      completionRate: 98.5,
      customerSatisfaction: 4.8,
      disputeRate: 0.2,
      repeatCustomers: 75
    },
    recentActivity: [
      { action: 'Service Completed', points: '+25', date: '2024-01-15' },
      { action: '5-Star Review', points: '+15', date: '2024-01-14' },
      { action: 'Quick Response', points: '+10', date: '2024-01-13' },
      { action: 'Payment Verified', points: '+20', date: '2024-01-12' }
    ]
  });

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  const getLevelColor = (level) => {
    const colors = {
      'Basic': 'info',
      'Advanced': 'success',
      'Pro': 'warning',
      'Elite': 'error'
    };
    return colors[level] || 'default';
  };

  const getProgressColor = (score) => {
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  return (
    <Container maxWidth="xl" sx={{ py: 12 }}>
      {/* Header */}
      <motion.div {...fadeInUp}>
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography variant="h3" fontWeight="bold" gutterBottom>
            Trust Score Dashboard 🛡️
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Build trust, unlock opportunities, and grow your business
          </Typography>
        </Box>
      </motion.div>

      {/* Main Trust Score Card */}
      <Grid container spacing={4} sx={{ mb: 6 }}>
        <Grid item xs={12} md={8}>
          <motion.div {...fadeInUp}>
            <Card elevation={8} sx={{ p: 4, background: `linear-gradient(135deg, ${colors.primary.red}20, ${colors.primary.black}20)` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Badge
                  badgeContent={trustData.verificationTier}
                  color={getLevelColor(trustData.verificationTier)}
                  sx={{ '& .MuiBadge-badge': { fontSize: '0.8rem', height: 24 } }}
                >
                  <Avatar sx={{ width: 80, height: 80, bgcolor: colors.primary.red }}>
                    <VerifiedUser sx={{ fontSize: 40 }} />
                  </Avatar>
                </Badge>
                <Box sx={{ ml: 3 }}>
                  <Typography variant="h2" fontWeight="bold" color={colors.primary.red}>
                    {trustData.overallScore}
                  </Typography>
                  <Typography variant="h6" color="text.secondary">
                    Trust Score
                  </Typography>
                  <Chip
                    label={trustData.level}
                    color={getLevelColor(trustData.level)}
                    size="large"
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Progress to {trustData.nextLevel}
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {trustData.pointsToNext} points needed
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(trustData.totalPoints / trustData.maxPoints) * 100}
                  color={getProgressColor(trustData.overallScore)}
                  sx={{ height: 12, borderRadius: 6 }}
                />
              </Box>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip
                  icon={<TrendingUp />}
                  label={`${trustData.totalPoints} Total Points`}
                  variant="outlined"
                  color="primary"
                />
                <Chip
                  icon={<EmojiEvents />}
                  label={`${trustData.badges.filter(b => b.earned).length} Badges Earned`}
                  variant="outlined"
                  color="success"
                />
                <Chip
                  icon={<Timeline />}
                  label={`${trustData.overallScore}% Success Rate`}
                  variant="outlined"
                  color="info"
                />
              </Box>
            </Card>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={4}>
          <motion.div {...fadeInUp}>
            <Card elevation={4} sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Trust Level Benefits
                </Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Higher Search Rankings"
                      secondary="Appear first in service results"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Lower Commission Rates"
                      secondary="Keep more of your earnings"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Priority Support"
                      secondary="24/7 dedicated assistance"
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <CheckCircle color="success" />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Advanced Features"
                      secondary="Unlock premium tools"
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {/* Trust Metrics */}
      <motion.div {...fadeInUp}>
        <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
          Trust Metrics 📊
        </Typography>
        <Grid container spacing={3} sx={{ mb: 6 }}>
          {Object.entries(trustData.metrics).map(([key, value]) => (
            <Grid item xs={12} sm={6} md={4} key={key}>
              <Card elevation={4}>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" fontWeight="bold" color={colors.primary.red} gutterBottom>
                    {typeof value === 'number' && key.includes('Rate') ? `${value}%` : value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </motion.div>

      {/* Badges Section */}
      <motion.div {...fadeInUp}>
        <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
          Trust Badges 🏆
        </Typography>
        <Grid container spacing={2} sx={{ mb: 6 }}>
          {trustData.badges.map((badge, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card 
                elevation={badge.earned ? 4 : 2}
                sx={{ 
                  opacity: badge.earned ? 1 : 0.6,
                  border: badge.earned ? `2px solid ${colors.success}` : '2px solid transparent'
                }}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <Typography variant="h2" sx={{ mb: 1 }}>
                    {badge.icon}
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    {badge.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {badge.points} points
                  </Typography>
                  <Chip
                    label={badge.earned ? 'Earned' : 'Locked'}
                    color={badge.earned ? 'success' : 'default'}
                    size="small"
                  />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </motion.div>

      {/* Recent Activity */}
      <motion.div {...fadeInUp}>
        <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3 }}>
          Recent Trust Activity 📈
        </Typography>
        <Card elevation={4}>
          <CardContent>
            <List>
              {trustData.recentActivity.map((activity, index) => (
                <React.Fragment key={index}>
                  <ListItem>
                    <ListItemIcon>
                      <TrendingUp color="success" />
                    </ListItemIcon>
                    <ListItemText
                      primary={activity.action}
                      secondary={new Date(activity.date).toLocaleDateString()}
                    />
                    <Chip
                      label={activity.points}
                      color="success"
                      size="small"
                      variant="outlined"
                    />
                  </ListItem>
                  {index < trustData.recentActivity.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      </motion.div>

      {/* Improvement Tips */}
      <motion.div {...fadeInUp}>
        <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3, mt: 6 }}>
          How to Improve Your Trust Score 💡
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom color={colors.primary.red}>
                Complete Verification
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Verify your identity, phone, email, and connect social accounts to earn trust points.
              </Typography>
              <Button variant="outlined" color="primary" startIcon={<VerifiedUser />}>
                Verify Now
              </Button>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper elevation={2} sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom color={colors.primary.red}>
                Provide Excellent Service
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Complete services on time, respond quickly, and maintain high ratings.
              </Typography>
              <Button variant="outlined" color="primary" startIcon={<Star />}>
                View Services
              </Button>
            </Paper>
          </Grid>
        </Grid>
      </motion.div>
    </Container>
  );
};

export default TrustScorePage;
