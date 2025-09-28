import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Grid,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Avatar,
  Paper,
  CircularProgress,
  LinearProgress
} from '@mui/material';
import {
  CheckCircle,
  Phone,
  Email,
  Security,
  AccountCircle,
  Facebook,
  Twitter,
  LinkedIn,
  Instagram,
  VerifiedUser,
  Lock
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { colors } from '../theme/colors';

const VerificationPage = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [verificationData, setVerificationData] = useState({
    identity: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      idNumber: '',
      idType: 'passport',
      status: 'pending'
    },
    phone: {
      number: '',
      countryCode: '+1',
      otp: '',
      status: 'pending'
    },
    email: {
      address: '',
      otp: '',
      status: 'pending'
    },
    social: {
      facebook: { connected: false, username: '', status: 'pending' },
      twitter: { connected: false, username: '', status: 'pending' },
      linkedin: { connected: false, username: '', status: 'pending' },
      instagram: { connected: false, username: '', status: 'pending' }
    }
  });

  const [loading, setLoading] = useState(false);

  const steps = [
    {
      label: 'Identity Verification',
      description: 'Verify your personal identity with official documents',
      icon: <Security />
    },
    {
      label: 'Phone Verification',
      description: 'Verify your phone number with SMS OTP',
      icon: <Phone />
    },
    {
      label: 'Email Verification',
      description: 'Verify your email address with email OTP',
      icon: <Email />
    },
    {
      label: 'Social Verification',
      description: 'Connect your social media accounts',
      icon: <AccountCircle />
    }
  ];

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleIdentitySubmit = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setVerificationData(prev => ({
      ...prev,
      identity: { ...prev.identity, status: 'verified' }
    }));
    setLoading(false);
    handleNext();
  };

  const handlePhoneSubmit = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setVerificationData(prev => ({
      ...prev,
      phone: { ...prev.phone, status: 'verified' }
    }));
    setLoading(false);
    handleNext();
  };

  const handleEmailSubmit = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    setVerificationData(prev => ({
      ...prev,
      email: { ...prev.email, status: 'verified' }
    }));
    setLoading(false);
    handleNext();
  };

  const handleSocialConnect = async (platform) => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setVerificationData(prev => ({
      ...prev,
      social: {
        ...prev.social,
        [platform]: { 
          ...prev.social[platform], 
          connected: true, 
          status: 'verified' 
        }
      }
    }));
    setLoading(false);
  };

  const calculateProgress = () => {
    const totalSteps = 4;
    const completedSteps = [
      verificationData.identity.status === 'verified',
      verificationData.phone.status === 'verified',
      verificationData.email.status === 'verified',
      Object.values(verificationData.social).some(s => s.connected)
    ].filter(Boolean).length;
    return (completedSteps / totalSteps) * 100;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 12 }}>
      {/* Header */}
      <motion.div {...fadeInUp}>
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Typography variant="h3" fontWeight="bold" gutterBottom>
            Identity Verification 🔐
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Complete verification to unlock premium features and build trust
          </Typography>
        </Box>
      </motion.div>

      {/* Progress Overview */}
      <motion.div {...fadeInUp}>
        <Card elevation={4} sx={{ mb: 6, p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Avatar sx={{ width: 60, height: 60, bgcolor: colors.primary.red, mr: 2 }}>
              <VerifiedUser sx={{ fontSize: 30 }} />
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Verification Progress
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Overall Progress
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {Math.round(calculateProgress())}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={calculateProgress()}
                    color="primary"
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
                <Chip
                  label={`${Math.round(calculateProgress())}% Complete`}
                  color="primary"
                  variant="outlined"
                />
              </Box>
            </Box>
          </Box>
        </Card>
      </motion.div>

      {/* Verification Stepper */}
      <motion.div {...fadeInUp}>
        <Card elevation={4}>
          <CardContent sx={{ p: 4 }}>
            <Stepper activeStep={activeStep} orientation="vertical">
              {steps.map((step, index) => (
                <Step key={step.label}>
                  <StepLabel
                    StepIconComponent={() => (
                      <Avatar sx={{ width: 32, height: 32, bgcolor: colors.primary.red }}>
                        {step.icon}
                      </Avatar>
                    )}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="h6" fontWeight="bold">
                        {step.label}
                      </Typography>
                      {index === 0 && (
                        <Chip
                          label={verificationData.identity.status}
                          color={getStatusColor(verificationData.identity.status)}
                          size="small"
                        />
                      )}
                      {index === 1 && (
                        <Chip
                          label={verificationData.phone.status}
                          color={getStatusColor(verificationData.phone.status)}
                          size="small"
                        />
                      )}
                      {index === 2 && (
                        <Chip
                          label={verificationData.email.status}
                          color={getStatusColor(verificationData.email.status)}
                          size="small"
                        />
                      )}
                    </Box>
                  </StepLabel>
                  <StepContent>
                    <Typography color="text.secondary" sx={{ mb: 3 }}>
                      {step.description}
                    </Typography>

                    {/* Identity Verification Step */}
                    {index === 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Grid container spacing={3}>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              label="First Name"
                              value={verificationData.identity.firstName}
                              onChange={(e) => setVerificationData(prev => ({
                                ...prev,
                                identity: { ...prev.identity, firstName: e.target.value }
                              }))}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              label="Last Name"
                              value={verificationData.identity.lastName}
                              onChange={(e) => setVerificationData(prev => ({
                                ...prev,
                                identity: { ...prev.identity, lastName: e.target.value }
                              }))}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              label="Date of Birth"
                              type="date"
                              value={verificationData.identity.dateOfBirth}
                              onChange={(e) => setVerificationData(prev => ({
                                ...prev,
                                identity: { ...prev.identity, dateOfBirth: e.target.value }
                              }))}
                              InputLabelProps={{ shrink: true }}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <FormControl fullWidth>
                              <InputLabel>ID Type</InputLabel>
                              <Select
                                value={verificationData.identity.idType}
                                label="ID Type"
                                onChange={(e) => setVerificationData(prev => ({
                                  ...prev,
                                  identity: { ...prev.identity, idType: e.target.value }
                                }))}
                              >
                                <MenuItem value="passport">Passport</MenuItem>
                                <MenuItem value="drivers_license">Driver's License</MenuItem>
                                <MenuItem value="national_id">National ID</MenuItem>
                                <MenuItem value="ssn">Social Security Number</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              label="ID Number"
                              value={verificationData.identity.idNumber}
                              onChange={(e) => setVerificationData(prev => ({
                                ...prev,
                                identity: { ...prev.identity, idNumber: e.target.value }
                              }))}
                            />
                          </Grid>
                        </Grid>
                        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                          <Button
                            variant="contained"
                            onClick={handleIdentitySubmit}
                            disabled={loading || !verificationData.identity.firstName || !verificationData.identity.lastName}
                            startIcon={loading ? <CircularProgress size={20} /> : <Security />}
                          >
                            {loading ? 'Verifying...' : 'Verify Identity'}
                          </Button>
                        </Box>
                      </Box>
                    )}

                    {/* Phone Verification Step */}
                    {index === 1 && (
                      <Box sx={{ mt: 2 }}>
                        <Grid container spacing={3}>
                          <Grid item xs={12} sm={4}>
                            <FormControl fullWidth>
                              <InputLabel>Country Code</InputLabel>
                              <Select
                                value={verificationData.phone.countryCode}
                                label="Country Code"
                                onChange={(e) => setVerificationData(prev => ({
                                  ...prev,
                                  phone: { ...prev.phone, countryCode: e.target.value }
                                }))}
                              >
                                <MenuItem value="+1">+1 (US/CA)</MenuItem>
                                <MenuItem value="+44">+44 (UK)</MenuItem>
                                <MenuItem value="+33">+33 (FR)</MenuItem>
                                <MenuItem value="+49">+49 (DE)</MenuItem>
                                <MenuItem value="+81">+81 (JP)</MenuItem>
                              </Select>
                            </FormControl>
                          </Grid>
                          <Grid item xs={12} sm={8}>
                            <TextField
                              fullWidth
                              label="Phone Number"
                              value={verificationData.phone.number}
                              onChange={(e) => setVerificationData(prev => ({
                                ...prev,
                                phone: { ...prev.phone, number: e.target.value }
                              }))}
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              label="OTP Code"
                              value={verificationData.phone.otp}
                              onChange={(e) => setVerificationData(prev => ({
                                ...prev,
                                phone: { ...prev.phone, otp: e.target.value }
                              }))}
                              placeholder="Enter 6-digit OTP"
                            />
                          </Grid>
                        </Grid>
                        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                          <Button
                            variant="contained"
                            onClick={handlePhoneSubmit}
                            disabled={loading || !verificationData.phone.number || !verificationData.phone.otp}
                            startIcon={loading ? <CircularProgress size={20} /> : <Phone />}
                          >
                            {loading ? 'Verifying...' : 'Verify Phone'}
                          </Button>
                        </Box>
                      </Box>
                    )}

                    {/* Email Verification Step */}
                    {index === 2 && (
                      <Box sx={{ mt: 2 }}>
                        <Grid container spacing={3}>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              label="Email Address"
                              type="email"
                              value={verificationData.email.address}
                              onChange={(e) => setVerificationData(prev => ({
                                ...prev,
                                email: { ...prev.email, address: e.target.value }
                              }))}
                            />
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              label="OTP Code"
                              value={verificationData.email.otp}
                              onChange={(e) => setVerificationData(prev => ({
                                ...prev,
                                email: { ...prev.email, otp: e.target.value }
                              }))}
                              placeholder="Enter 6-digit OTP"
                            />
                          </Grid>
                        </Grid>
                        <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                          <Button
                            variant="contained"
                            onClick={handleEmailSubmit}
                            disabled={loading || !verificationData.email.address || !verificationData.email.otp}
                            startIcon={loading ? <CircularProgress size={20} /> : <Email />}
                          >
                            {loading ? 'Verifying...' : 'Verify Email'}
                          </Button>
                        </Box>
                      </Box>
                    )}

                    {/* Social Verification Step */}
                    {index === 3 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                          Connect your social media accounts to enhance your profile and build trust
                        </Typography>
                        <Grid container spacing={2}>
                          {Object.entries(verificationData.social).map(([platform, data]) => (
                            <Grid item xs={12} sm={6} key={platform}>
                              <Card 
                                elevation={data.connected ? 4 : 2}
                                sx={{ 
                                  border: data.connected ? `2px solid ${colors.success}` : '2px solid transparent',
                                  opacity: data.connected ? 1 : 0.8
                                }}
                              >
                                <CardContent sx={{ textAlign: 'center' }}>
                                  <Avatar 
                                    sx={{ 
                                      width: 48, 
                                      height: 48, 
                                      bgcolor: data.connected ? colors.success : colors.border.medium,
                                      mx: 'auto',
                                      mb: 2
                                    }}
                                  >
                                    {platform === 'facebook' && <Facebook />}
                                    {platform === 'twitter' && <Twitter />}
                                    {platform === 'linkedin' && <LinkedIn />}
                                    {platform === 'instagram' && <Instagram />}
                                  </Avatar>
                                  <Typography variant="h6" fontWeight="bold" gutterBottom sx={{ textTransform: 'capitalize' }}>
                                    {platform}
                                  </Typography>
                                  <Chip
                                    label={data.connected ? 'Connected' : 'Connect'}
                                    color={data.connected ? 'success' : 'default'}
                                    size="small"
                                    sx={{ mb: 2 }}
                                  />
                                  {!data.connected && (
                                    <Button
                                      variant="outlined"
                                      size="small"
                                      onClick={() => handleSocialConnect(platform)}
                                      disabled={loading}
                                      startIcon={loading ? <CircularProgress size={16} /> : <AccountCircle />}
                                    >
                                      Connect
                                    </Button>
                                  )}
                                </CardContent>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      </Box>
                    )}

                    <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                      <Button
                        disabled={index === 0}
                        onClick={handleBack}
                        sx={{ mr: 1 }}
                      >
                        Back
                      </Button>
                      <Box sx={{ flex: '1' }} />
                      {index === steps.length - 1 ? (
                        <Button
                          variant="contained"
                          onClick={() => console.log('Verification complete!')}
                          startIcon={<CheckCircle />}
                        >
                          Complete Verification
                        </Button>
                      ) : (
                        <Button
                          variant="contained"
                          onClick={handleNext}
                          disabled={index === 0 && verificationData.identity.status !== 'verified'}
                        >
                          Next
                        </Button>
                      )}
    </Box>
                  </StepContent>
                </Step>
              ))}
            </Stepper>
          </CardContent>
        </Card>
      </motion.div>

      {/* Verification Benefits */}
      <motion.div {...fadeInUp}>
        <Typography variant="h5" fontWeight="bold" gutterBottom sx={{ mb: 3, mt: 6 }}>
          Verification Benefits 🎯
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
              <Security sx={{ fontSize: 48, color: colors.primary.red, mb: 2 }} />
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Enhanced Security
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Protect your account with multi-factor verification and secure access
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
              <VerifiedUser sx={{ fontSize: 48, color: colors.success, mb: 2 }} />
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Trust Building
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Build credibility with clients and increase your service visibility
              </Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper elevation={2} sx={{ p: 3, textAlign: 'center' }}>
              <Lock sx={{ fontSize: 48, color: colors.warning, mb: 2 }} />
              <Typography variant="h6" fontWeight="bold" gutterBottom>
                Premium Features
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Unlock advanced tools, lower fees, and priority support
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </motion.div>
    </Container>
  );
};

export default VerificationPage;
