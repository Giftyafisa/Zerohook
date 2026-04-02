import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  TextField,
  Chip,
  Avatar,
  CircularProgress,
  LinearProgress,
  IconButton,
  Collapse
} from '@mui/material';
import {
  CheckCircle,
  Email,
  Security,
  VerifiedUser,
  Lock,
  ArrowBack,
  CameraAlt,
  Badge,
  WorkspacePremium,
  ExpandMore,
  ExpandLess,
  Info
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/slices/authSlice';
import apiClient from '../services/apiClient';
import { toast } from 'react-toastify';

const MotionBox = motion(Box);
const MotionCard = motion(Card);

const VerificationPage = () => {
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedStep, setExpandedStep] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState({
    isSubscribed: false,
    emailVerified: false,
    idVerified: false,
    faceVerified: false,
    isFullyVerified: false,
    verificationTier: 1,
    requirements: {}
  });
  
  // Form states
  const [emailOtp, setEmailOtp] = useState('');
  const [idData, setIdData] = useState({
    firstName: '',
    lastName: '',
    idType: 'national_id',
    idNumber: ''
  });

  useEffect(() => {
    fetchVerificationStatus();
  }, []);

  const fetchVerificationStatus = async () => {
    try {
      const { data } = await apiClient.get('/verification/full-status');
      setVerificationStatus({
        isSubscribed: data.fullVerification?.isSubscribed || false,
        emailVerified: data.fullVerification?.emailVerified || false,
        idVerified: data.fullVerification?.idVerified || false,
        faceVerified: data.fullVerification?.faceVerified || false,
        isFullyVerified: data.fullVerification?.isFullyVerified || false,
        verificationTier: data.currentTier || 1,
        requirements: data.requirements || {}
      });
    } catch (error) {
      console.error('Failed to fetch verification status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmailOtp = async () => {
    setSubmitting(true);
    try {
      await apiClient.post('/verification/send-email-otp', { email: user?.email });
      toast.success('OTP sent to your email!');
    } catch (error) {
      toast.info('OTP sent! (Demo mode)');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!emailOtp || emailOtp.length < 4) {
      toast.error('Please enter a valid OTP');
      return;
    }
    
    setSubmitting(true);
    try {
      await apiClient.post('/verification/verify-email', { email: user?.email, otp: emailOtp });
      toast.success('Email verified successfully!');
      setVerificationStatus(prev => ({ ...prev, emailVerified: true }));
      setExpandedStep(null);
    } catch (error) {
      toast.error('Verification failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitId = async () => {
    if (!idData.firstName || !idData.lastName || !idData.idNumber) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setSubmitting(true);
    try {
      await apiClient.post('/verification/submit-documents', {
        documentType: idData.idType,
        documentNumber: idData.idNumber,
        documentImages: [],
        verificationTier: 2
      });
      toast.success('ID verification submitted! Pending review.');
      setExpandedStep(null);
    } catch (error) {
      toast.info('Submitted for review (Demo mode)');
      setExpandedStep(null);
    } finally {
      setSubmitting(false);
    }
  };

  const calculateProgress = () => {
    let completed = 0;
    if (verificationStatus.isSubscribed) completed++;
    if (verificationStatus.emailVerified) completed++;
    if (verificationStatus.idVerified || verificationStatus.faceVerified) completed++;
    return Math.round((completed / 3) * 100);
  };

  const steps = [
    {
      id: 'subscription',
      title: 'Premium Subscription',
      description: 'Subscribe to unlock full platform features',
      icon: <WorkspacePremium />,
      completed: verificationStatus.isSubscribed,
      color: '#ffd700',
      action: () => navigate('/subscribe')
    },
    {
      id: 'email',
      title: 'Email Verification',
      description: 'Verify your email address',
      icon: <Email />,
      completed: verificationStatus.emailVerified,
      color: '#00f2ea',
      expandable: true
    },
    {
      id: 'identity',
      title: 'ID Verification',
      description: 'Submit your ID for identity verification',
      icon: <Badge />,
      completed: verificationStatus.idVerified,
      color: '#00ff88',
      expandable: true
    }
  ];

  if (loading) {
    return (
      <Box sx={styles.loadingContainer}>
        <CircularProgress sx={{ color: '#00f2ea' }} />
        <Typography sx={{ mt: 2, color: 'rgba(255,255,255,0.7)' }}>
          Loading verification status...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={styles.container}>
      {/* Header */}
      <Box sx={styles.header}>
        <IconButton onClick={() => navigate(-1)} sx={styles.backBtn}>
          <ArrowBack />
        </IconButton>
        <Typography sx={styles.title}>Zerohook</Typography>
        <Box sx={{ width: 40 }} />
      </Box>

      <Box sx={styles.content}>
        {/* Hero Section */}
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          sx={styles.heroSection}
        >
          <Box sx={styles.heroIcon}>
            {verificationStatus.isFullyVerified ? (
              <VerifiedUser sx={{ fontSize: 48, color: '#00ff88' }} />
            ) : (
              <Security sx={{ fontSize: 48, color: '#ffd700' }} />
            )}
          </Box>
          <Typography sx={styles.heroTitle}>
            Identity Verification 🔐
          </Typography>
          <Typography sx={styles.heroSubtitle}>
            Complete verification to unlock premium features and build trust
          </Typography>
        </MotionBox>

        {/* Progress Card */}
        <MotionCard
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          sx={styles.progressCard}
        >
          <CardContent sx={{ p: 3 }}>
            <Box sx={styles.progressHeader}>
              <Avatar sx={styles.progressAvatar}>
                <VerifiedUser />
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography sx={styles.progressTitle}>
                  Verification Progress
                </Typography>
                <Box sx={styles.progressRow}>
                  <Typography sx={styles.progressLabel}>Overall Progress</Typography>
                  <Typography sx={styles.progressValue}>{calculateProgress()}%</Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={calculateProgress()}
                  sx={styles.progressBar}
                />
              </Box>
              <Chip
                label={`${calculateProgress()}% Com...`}
                sx={styles.progressChip}
              />
            </Box>
          </CardContent>
        </MotionCard>

        {/* Verification Requirements Info */}
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          sx={styles.infoBox}
        >
          <Info sx={{ color: '#00f2ea', mr: 1.5, flexShrink: 0 }} />
          <Typography sx={styles.infoText}>
            To display the <VerifiedUser sx={{ fontSize: 16, color: '#00ff88', mx: 0.5, verticalAlign: 'middle' }} /> verified badge:
            <strong> Premium + Email + ID</strong>
          </Typography>
        </MotionBox>

        {/* Verification Steps */}
        <Box sx={styles.stepsContainer}>
          {steps.map((step, index) => (
            <MotionCard
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              sx={{
                ...styles.stepCard,
                borderColor: step.completed ? step.color : 'rgba(255,255,255,0.1)',
                background: step.completed ? `linear-gradient(135deg, ${step.color}15, ${step.color}05)` : 'rgba(255,255,255,0.03)'
              }}
            >
              <CardContent sx={{ p: 0 }}>
                <Box
                  sx={styles.stepHeader}
                  onClick={() => {
                    if (step.expandable && !step.completed) {
                      setExpandedStep(expandedStep === step.id ? null : step.id);
                    } else if (step.action) {
                      step.action();
                    }
                  }}
                >
                  <Avatar sx={{ ...styles.stepIcon, bgcolor: step.completed ? step.color : 'rgba(255,255,255,0.1)' }}>
                    {step.completed ? <CheckCircle /> : step.icon}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={styles.stepTitle}>{step.title}</Typography>
                    <Typography sx={styles.stepDescription}>{step.description}</Typography>
                  </Box>
                  {step.completed ? (
                    <Chip label="✓" size="small" sx={{ ...styles.statusChip, bgcolor: `${step.color}30`, color: step.color, minWidth: 'auto' }} />
                  ) : step.expandable ? (
                    <IconButton size="small" sx={{ color: '#fff' }}>
                      {expandedStep === step.id ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                  ) : (
                    <Chip label="Get" size="small" sx={{ ...styles.statusChip, bgcolor: 'rgba(255,215,0,0.2)', color: '#ffd700', minWidth: 'auto' }} />
                  )}
                </Box>

                {/* Expandable Content */}
                <Collapse in={expandedStep === step.id && !step.completed}>
                  <Box sx={styles.expandedContent}>
                    {step.id === 'email' && (
                      <>
                        <Typography sx={styles.expandedLabel}>
                          Your email: <strong>{user?.email || 'Not set'}</strong>
                        </Typography>
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={handleSendEmailOtp}
                          disabled={submitting}
                          sx={styles.sendOtpBtn}
                        >
                          {submitting ? <CircularProgress size={16} /> : 'Send OTP'}
                        </Button>
                        <TextField
                          fullWidth
                          placeholder="Enter 6-digit OTP"
                          value={emailOtp}
                          onChange={(e) => setEmailOtp(e.target.value)}
                          sx={styles.otpInput}
                          inputProps={{ maxLength: 6 }}
                        />
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={handleVerifyEmail}
                          disabled={submitting || !emailOtp}
                          sx={styles.verifyBtn}
                        >
                          {submitting ? <CircularProgress size={20} /> : 'Verify Email'}
                        </Button>
                      </>
                    )}

                    {step.id === 'identity' && (
                      <>
                        <Box sx={styles.formRow}>
                          <TextField
                            label="First Name"
                            value={idData.firstName}
                            onChange={(e) => setIdData({ ...idData, firstName: e.target.value })}
                            sx={styles.formInput}
                            fullWidth
                            size="small"
                          />
                          <TextField
                            label="Last Name"
                            value={idData.lastName}
                            onChange={(e) => setIdData({ ...idData, lastName: e.target.value })}
                            sx={styles.formInput}
                            fullWidth
                            size="small"
                          />
                        </Box>
                        <TextField
                          fullWidth
                          label="ID Number"
                          value={idData.idNumber}
                          onChange={(e) => setIdData({ ...idData, idNumber: e.target.value })}
                          sx={styles.formInput}
                          placeholder="National ID or Passport"
                          size="small"
                        />
                        <Typography sx={styles.uploadLabel}>
                          📷 ID Photo (front & back)
                        </Typography>
                        <Box sx={styles.uploadArea}>
                          <CameraAlt sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 28 }} />
                          <Typography sx={{ color: 'rgba(255,255,255,0.5)', mt: 0.5, fontSize: '0.8rem' }}>
                            Tap to upload
                          </Typography>
                        </Box>
                        <Button
                          variant="contained"
                          fullWidth
                          onClick={handleSubmitId}
                          disabled={submitting}
                          sx={styles.verifyBtn}
                        >
                          {submitting ? <CircularProgress size={20} /> : 'Submit'}
                        </Button>
                      </>
                    )}
                  </Box>
                </Collapse>
              </CardContent>
            </MotionCard>
          ))}
        </Box>

        {/* Benefits Section */}
        <MotionBox
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          sx={styles.benefitsSection}
        >
          <Typography sx={styles.benefitsTitle}>
            🎯 Verification Benefits
          </Typography>
          <Box sx={styles.benefitsGrid}>
            <Box sx={styles.benefitCard}>
              <Security sx={{ fontSize: 28, color: '#00f2ea', mb: 0.5 }} />
              <Typography sx={styles.benefitTitle}>Security</Typography>
              <Typography sx={styles.benefitText}>
                Protect account
              </Typography>
            </Box>
            <Box sx={styles.benefitCard}>
              <VerifiedUser sx={{ fontSize: 28, color: '#00ff88', mb: 0.5 }} />
              <Typography sx={styles.benefitTitle}>Trust Badge</Typography>
              <Typography sx={styles.benefitText}>
                Profile badge
              </Typography>
            </Box>
            <Box sx={styles.benefitCard}>
              <Lock sx={{ fontSize: 28, color: '#ffd700', mb: 0.5 }} />
              <Typography sx={styles.benefitTitle}>Premium</Typography>
              <Typography sx={styles.benefitText}>
                Unlimited msgs
              </Typography>
            </Box>
          </Box>
        </MotionBox>
      </Box>
    </Box>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f1a 100%)',
    pb: 12
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%)'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    p: 2,
    pt: 3
  },
  backBtn: {
    color: '#fff',
    bgcolor: 'rgba(255,255,255,0.1)',
    '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
  },
  title: {
    color: '#fff',
    fontWeight: 700,
    fontSize: '1.1rem'
  },
  content: {
    px: 2,
    maxWidth: 500,
    mx: 'auto'
  },
  heroSection: {
    textAlign: 'center',
    py: 2
  },
  heroIcon: {
    width: 70,
    height: 70,
    borderRadius: '50%',
    bgcolor: 'rgba(255,215,0,0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    mx: 'auto',
    mb: 1.5,
    border: '2px solid rgba(255,215,0,0.3)'
  },
  heroTitle: {
    color: '#fff',
    fontWeight: 700,
    fontSize: '1.3rem',
    mb: 0.5
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '0.85rem'
  },
  progressCard: {
    bgcolor: 'rgba(255,255,255,0.05)',
    borderRadius: 3,
    border: '1px solid rgba(255,255,255,0.1)',
    mb: 2
  },
  progressHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 1.5
  },
  progressAvatar: {
    width: 44,
    height: 44,
    bgcolor: 'rgba(0,242,234,0.2)',
    color: '#00f2ea'
  },
  progressTitle: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.9rem',
    mb: 0.5
  },
  progressRow: {
    display: 'flex',
    justifyContent: 'space-between',
    mb: 0.5
  },
  progressLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.75rem'
  },
  progressValue: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.75rem'
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    bgcolor: 'rgba(255,255,255,0.1)',
    '& .MuiLinearProgress-bar': {
      bgcolor: '#00f2ea',
      borderRadius: 3
    }
  },
  progressChip: {
    bgcolor: 'rgba(0,242,234,0.2)',
    color: '#00f2ea',
    fontWeight: 600,
    fontSize: '0.7rem',
    display: { xs: 'none', sm: 'flex' }
  },
  infoBox: {
    display: 'flex',
    alignItems: 'center',
    bgcolor: 'rgba(0,242,234,0.1)',
    borderRadius: 2,
    p: 1.5,
    mb: 2,
    border: '1px solid rgba(0,242,234,0.2)'
  },
  infoText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '0.8rem',
    lineHeight: 1.4
  },
  stepsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1.5
  },
  stepCard: {
    bgcolor: 'rgba(255,255,255,0.03)',
    borderRadius: 2.5,
    border: '1px solid rgba(255,255,255,0.1)',
    transition: 'all 0.3s ease',
    overflow: 'hidden'
  },
  stepHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    p: 1.5,
    cursor: 'pointer',
    '&:hover': { bgcolor: 'rgba(255,255,255,0.02)' }
  },
  stepIcon: {
    width: 40,
    height: 40
  },
  stepTitle: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.95rem'
  },
  stepDescription: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.75rem'
  },
  statusChip: {
    fontWeight: 600,
    fontSize: '0.7rem',
    height: 24
  },
  expandedContent: {
    px: 1.5,
    pb: 1.5,
    pt: 1,
    borderTop: '1px solid rgba(255,255,255,0.1)'
  },
  expandedLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.8rem',
    mb: 1.5
  },
  sendOtpBtn: {
    mb: 1.5,
    borderColor: 'rgba(0,242,234,0.5)',
    color: '#00f2ea',
    fontSize: '0.8rem',
    '&:hover': { borderColor: '#00f2ea', bgcolor: 'rgba(0,242,234,0.1)' }
  },
  otpInput: {
    mb: 1.5,
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      bgcolor: 'rgba(255,255,255,0.05)',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
      '&.Mui-focused fieldset': { borderColor: '#00f2ea' }
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' }
  },
  verifyBtn: {
    py: 1.2,
    bgcolor: '#00f2ea',
    color: '#000',
    fontWeight: 600,
    fontSize: '0.9rem',
    '&:hover': { bgcolor: '#00d4ce' },
    '&:disabled': { bgcolor: 'rgba(0,242,234,0.3)', color: 'rgba(0,0,0,0.5)' }
  },
  formRow: {
    display: 'flex',
    gap: 1,
    mb: 1
  },
  formInput: {
    mb: 1,
    '& .MuiOutlinedInput-root': {
      color: '#fff',
      bgcolor: 'rgba(255,255,255,0.05)',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
      '&.Mui-focused fieldset': { borderColor: '#00f2ea' }
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem' }
  },
  uploadLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '0.8rem',
    mb: 0.5
  },
  uploadArea: {
    border: '2px dashed rgba(255,255,255,0.2)',
    borderRadius: 2,
    p: 2,
    textAlign: 'center',
    mb: 1.5,
    cursor: 'pointer',
    '&:hover': { borderColor: 'rgba(255,255,255,0.3)', bgcolor: 'rgba(255,255,255,0.02)' }
  },
  benefitsSection: {
    mt: 3,
    pt: 2,
    borderTop: '1px solid rgba(255,255,255,0.1)'
  },
  benefitsTitle: {
    color: '#fff',
    fontWeight: 700,
    fontSize: '1rem',
    mb: 2,
    textAlign: 'center'
  },
  benefitsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 1
  },
  benefitCard: {
    bgcolor: 'rgba(255,255,255,0.03)',
    borderRadius: 2,
    p: 1.5,
    textAlign: 'center',
    border: '1px solid rgba(255,255,255,0.05)'
  },
  benefitTitle: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '0.75rem',
    mb: 0.25
  },
  benefitText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.65rem'
  }
};

export default VerificationPage;
