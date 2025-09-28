import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  LinearProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Divider,
  Paper,
  useTheme
} from '@mui/material';
import {
  Security,
  Verified,
  Pending,
  Error,
  CheckCircle,
  Upload,
  CameraAlt,
  Fingerprint,
  Face,
  DocumentScanner,
  LocationOn,
  Phone,
  Email,
  Warning,
  Info,
  Lock,
  Star,
  Shield,
  Camera,
  CloudUpload,
  Delete,
  Edit,
  Visibility,
  VisibilityOff
} from '@mui/icons-material';

const VerificationCenter = () => {
  const theme = useTheme();
  
  const [currentTier, setCurrentTier] = useState(1);
  const [verificationStatus, setVerificationStatus] = useState({
    basic: { completed: true, score: 100, documents: ['phone', 'email', 'age'] },
    advanced: { completed: false, score: 60, documents: ['id', 'facial', 'address'] },
    pro: { completed: false, score: 0, documents: ['biometrics', 'background', 'references'] },
    elite: { completed: false, score: 0, documents: ['decentralized_id', 'behavioral', 'financial'] }
  });
  
  const [uploading, setUploading] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationStep, setVerificationStep] = useState(0);

  const verificationTiers = [
    {
      id: 1,
      name: 'Basic',
      description: 'Phone + Email + Age Verification',
      requirements: ['Phone OTP', 'Email OTP', 'Age Verification'],
      benefits: ['Basic profile access', 'Browse services', 'Basic messaging'],
      icon: <Lock />,
      color: '#4CAF50',
      minScore: 0,
      maxScore: 100
    },
    {
      id: 2,
      name: 'Advanced',
      description: 'Government ID + Facial Biometrics + Address',
      requirements: ['Government ID', 'Facial Recognition', 'Address Verification', 'Basic Tier Complete'],
      benefits: ['Enhanced profile features', 'Contact other users', 'Create service listings', 'Higher trust score'],
      icon: <Shield />,
      color: '#2196F3',
      minScore: 100,
      maxScore: 200
    },
    {
      id: 3,
      name: 'Pro',
      description: 'Biometric Verification + Background Check + References',
      requirements: ['Fingerprint Biometrics', 'Background Check', 'Professional References', 'Advanced Tier Complete'],
      benefits: ['Premium features', 'Priority support', 'Verified badge', 'Enhanced matching'],
      icon: <Star />,
      color: '#9C27B0',
      minScore: 200,
      maxScore: 300
    },
    {
      id: 4,
      name: 'Elite',
      description: 'Decentralized ID + Behavioral Analysis + Financial Verification',
      requirements: ['Decentralized Identity', 'Behavioral Biometrics', 'Financial Verification', 'Pro Tier Complete'],
      benefits: ['Elite status', 'VIP support', 'Exclusive features', 'Maximum trust score'],
      icon: <Verified />,
      color: '#FFD700',
      minScore: 300,
      maxScore: 400
    }
  ];

  const documentTypes = [
    { value: 'phone', label: 'Phone Verification', icon: <Phone />, description: 'SMS OTP verification' },
    { value: 'email', label: 'Email Verification', icon: <Email />, description: 'Email OTP verification' },
    { value: 'age', label: 'Age Verification', icon: <Info />, description: 'Government ID for age proof' },
    { value: 'id', label: 'Government ID', icon: <DocumentScanner />, description: 'Passport, Driver License, or National ID' },
    { value: 'facial', label: 'Facial Recognition', icon: <Face />, description: 'Live photo with face detection' },
    { value: 'address', label: 'Address Verification', icon: <LocationOn />, description: 'Utility bill or bank statement' },
    { value: 'biometrics', label: 'Fingerprint Biometrics', icon: <Fingerprint />, description: 'Fingerprint scanning' },
    { value: 'background', label: 'Background Check', icon: <Security />, description: 'Criminal record verification' },
    { value: 'references', label: 'Professional References', icon: <Star />, description: 'Work or character references' },
    { value: 'decentralized_id', label: 'Decentralized ID', icon: <Verified />, description: 'Blockchain-based identity' },
    { value: 'behavioral', label: 'Behavioral Analysis', icon: <Camera />, description: 'Behavioral pattern analysis' },
    { value: 'financial', label: 'Financial Verification', icon: <Shield />, description: 'Bank account verification' }
  ];

  useEffect(() => {
    // In real app, this would load verification status from backend
    console.log('Loading verification status...');
  }, []);

  const getTierStatus = (tierId) => {
    const tier = verificationTiers.find(t => t.id === tierId);
    if (!tier) return 'locked';
    
    const tierKey = tier.name.toLowerCase();
    const status = verificationStatus[tierKey];
    
    if (status.completed) return 'completed';
    if (status.score > 0) return 'in_progress';
    if (tierId === 1 || (tierId > 1 && verificationStatus[verificationTiers[tierId - 2].name.toLowerCase()]?.completed)) {
      return 'available';
    }
    return 'locked';
  };

  const getTierProgress = (tierId) => {
    const tier = verificationTiers.find(t => t.id === tierId);
    if (!tier) return 0;
    
    const tierKey = tier.name.toLowerCase();
    const status = verificationStatus[tierKey];
    
    if (status.completed) return 100;
    return Math.min((status.score / tier.maxScore) * 100, 100);
  };

  const handleDocumentUpload = async (documentType) => {
    setSelectedDocument(documentType);
    setShowUploadDialog(true);
  };

  const handleUpload = async () => {
    setUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
    
    try {
      // In real app, this would upload to backend
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update verification status
      const tierKey = verificationTiers[currentTier - 1].name.toLowerCase();
      setVerificationStatus(prev => ({
        ...prev,
        [tierKey]: {
          ...prev[tierKey],
          score: Math.min(prev[tierKey].score + 20, verificationTiers[currentTier - 1].maxScore),
          documents: [...prev[tierKey].documents, selectedDocument]
        }
      }));
      
      setShowUploadDialog(false);
      setSelectedDocument('');
      setUploadProgress(0);
      
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleVerificationStart = () => {
    setShowVerificationDialog(true);
    setVerificationStep(0);
  };

  const handleVerificationNext = () => {
    setVerificationStep(prev => prev + 1);
  };

  const handleVerificationComplete = async () => {
    try {
      // In real app, this would submit verification to backend
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mark tier as completed
      const tierKey = verificationTiers[currentTier - 1].name.toLowerCase();
      setVerificationStatus(prev => ({
        ...prev,
        [tierKey]: {
          ...prev[tierKey],
          completed: true,
          score: verificationTiers[currentTier - 1].maxScore
        }
      }));
      
      setShowVerificationDialog(false);
      setVerificationStep(0);
      
    } catch (error) {
      console.error('Verification failed:', error);
    }
  };

  const getDocumentIcon = (documentType) => {
    const doc = documentTypes.find(d => d.value === documentType);
    return doc ? doc.icon : <DocumentScanner />;
  };

  const getDocumentLabel = (documentType) => {
    const doc = documentTypes.find(d => d.value === documentType);
    return doc ? doc.label : documentType;
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={4} textAlign="center">
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Verification Center 🔐
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Complete verification to unlock premium features and build trust
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {/* Left Column - Verification Tiers */}
        <Grid item xs={12} md={8}>
          {verificationTiers.map((tier, index) => {
            const status = getTierStatus(tier.id);
            const progress = getTierProgress(tier.id);
            const isCurrentTier = tier.id === currentTier;
            
            return (
              <Card key={tier.id} sx={{ mb: 3, position: 'relative' }}>
                <CardContent>
                  {/* Tier Header */}
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <Avatar 
                      sx={{ 
                        bgcolor: status === 'completed' ? tier.color : 'grey.300',
                        color: status === 'completed' ? 'white' : 'grey.600'
                      }}
                    >
                      {tier.icon}
                    </Avatar>
                    <Box flex={1}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {tier.name} Tier
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {tier.description}
                      </Typography>
                    </Box>
                    <Box textAlign="right">
                      {status === 'completed' && (
                        <Chip 
                          icon={<CheckCircle />} 
                          label="Completed" 
                          color="success" 
                          size="small"
                        />
                      )}
                      {status === 'in_progress' && (
                        <Chip 
                          icon={<Pending />} 
                          label="In Progress" 
                          color="warning" 
                          size="small"
                        />
                      )}
                      {status === 'locked' && (
                        <Chip 
                          icon={<Lock />} 
                          label="Locked" 
                          color="default" 
                          size="small"
                        />
                      )}
                    </Box>
                  </Box>

                  {/* Progress Bar */}
                  <Box mb={2}>
                    <Box display="flex" justifyContent="space-between" mb={1}>
                      <Typography variant="body2" color="text.secondary">
                        Progress: {Math.round(progress)}%
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {verificationStatus[tier.name.toLowerCase()]?.score || 0} / {tier.maxScore} points
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={progress} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        bgcolor: 'grey.200',
                        '& .MuiLinearProgress-bar': {
                          bgcolor: status === 'completed' ? tier.color : 'primary.main'
                        }
                      }}
                    />
                  </Box>

                  {/* Requirements */}
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Requirements:
                    </Typography>
                    <List dense>
                      {tier.requirements.map((req, reqIndex) => {
                        const isCompleted = verificationStatus[tier.name.toLowerCase()]?.documents?.some(doc => 
                          req.toLowerCase().includes(doc)
                        );
                        
                        return (
                          <ListItem key={reqIndex} sx={{ py: 0 }}>
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              {isCompleted ? (
                                <CheckCircle color="success" fontSize="small" />
                              ) : (
                                <Pending color="action" fontSize="small" />
                              )}
                            </ListItemIcon>
                            <ListItemText 
                              primary={req}
                              primaryTypographyProps={{
                                color: isCompleted ? 'text.primary' : 'text.secondary'
                              }}
                            />
                          </ListItem>
                        );
                      })}
                    </List>
                  </Box>

                  {/* Benefits */}
                  <Box mb={2}>
                    <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                      Benefits:
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {tier.benefits.map((benefit, benefitIndex) => (
                        <Chip
                          key={benefitIndex}
                          label={benefit}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      ))}
                    </Box>
                  </Box>

                  {/* Action Buttons */}
                  <Box display="flex" gap={2}>
                    {status === 'available' && (
                      <Button
                        variant="contained"
                        startIcon={<Security />}
                        onClick={handleVerificationStart}
                        disabled={!isCurrentTier}
                      >
                        Start Verification
                      </Button>
                    )}
                    
                    {status === 'in_progress' && (
                      <Button
                        variant="outlined"
                        startIcon={<Upload />}
                        onClick={() => handleDocumentUpload('id')}
                      >
                        Upload Documents
                      </Button>
                    )}
                    
                    {status === 'completed' && (
                      <Button
                        variant="outlined"
                        color="success"
                        startIcon={<Verified />}
                        disabled
                      >
                        Verification Complete
                      </Button>
                    )}
                    
                    {status === 'locked' && (
                      <Button
                        variant="outlined"
                        disabled
                        startIcon={<Lock />}
                      >
                        Complete Previous Tier
                      </Button>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Grid>

        {/* Right Column - Status & Actions */}
        <Grid item xs={12} md={4}>
          {/* Current Status */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Status
              </Typography>
              
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Current Tier
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                  {verificationTiers[currentTier - 1]?.name} Tier
                </Typography>
              </Box>
              
              <Box mb={2}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Overall Progress
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={Object.values(verificationStatus).reduce((acc, tier) => acc + tier.score, 0) / 400 * 100} 
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Typography variant="caption" color="text.secondary">
                  {Object.values(verificationStatus).reduce((acc, tier) => acc + tier.score, 0)} / 400 points
                </Typography>
              </Box>
              
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Completed Tiers
                </Typography>
                <Box display="flex" gap={1}>
                  {verificationTiers.map(tier => {
                    const isCompleted = verificationStatus[tier.name.toLowerCase()]?.completed;
                    return (
                      <Chip
                        key={tier.id}
                        label={tier.name}
                        size="small"
                        color={isCompleted ? 'success' : 'default'}
                        variant={isCompleted ? 'filled' : 'outlined'}
                      />
                    );
                  })}
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              
              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Upload />}
                  onClick={() => handleDocumentUpload('id')}
                >
                  Upload Documents
                </Button>
                
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Camera />}
                  onClick={() => handleDocumentUpload('facial')}
                >
                  Facial Verification
                </Button>
                
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Fingerprint />}
                  onClick={() => handleDocumentUpload('biometrics')}
                >
                  Biometric Scan
                </Button>
              </Box>
            </CardContent>
          </Card>

          {/* Verification Tips */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Verification Tips 🔐
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <Info color="info" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Complete each tier fully"
                    secondary="Don't skip requirements"
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <Security color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Use clear documents"
                    secondary="Good quality photos work better"
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <Warning color="warning" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Be patient"
                    secondary="Verification takes 24-48 hours"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Document Upload Dialog */}
      <Dialog open={showUploadDialog} onClose={() => setShowUploadDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Document</DialogTitle>
        <DialogContent>
          <Box mb={3}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Document Type: {getDocumentLabel(selectedDocument)}
            </Typography>
            
            {uploadProgress > 0 && (
              <Box mt={2}>
                <LinearProgress variant="determinate" value={uploadProgress} />
                <Typography variant="caption" color="text.secondary">
                  Uploading... {uploadProgress}%
                </Typography>
              </Box>
            )}
            
            <Box mt={2} textAlign="center">
              <Button
                variant="outlined"
                component="label"
                startIcon={<CloudUpload />}
                disabled={uploading}
              >
                Choose File
                <input type="file" hidden accept="image/*,.pdf" />
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowUploadDialog(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Verification Process Dialog */}
      <Dialog open={showVerificationDialog} onClose={() => setShowVerificationDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Verification Process - {verificationTiers[currentTier - 1]?.name} Tier</DialogTitle>
        <DialogContent>
          <Stepper activeStep={verificationStep} orientation="vertical" sx={{ mb: 3 }}>
            {verificationTiers[currentTier - 1]?.requirements.map((req, index) => (
              <Step key={index}>
                <StepLabel>{req}</StepLabel>
                <StepContent>
                  <Typography variant="body2" color="text.secondary">
                    Complete this requirement to proceed to the next step.
                  </Typography>
                </StepContent>
              </Step>
            ))}
          </Stepper>
          
          {verificationStep === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Ready to start verification for {verificationTiers[currentTier - 1]?.name} Tier?
              This process will guide you through each requirement step by step.
            </Alert>
          )}
          
          {verificationStep > 0 && verificationStep < verificationTiers[currentTier - 1]?.requirements.length && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Step {verificationStep + 1}: {verificationTiers[currentTier - 1]?.requirements[verificationStep]}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Please complete this requirement before proceeding to the next step.
              </Typography>
            </Box>
          )}
          
          {verificationStep === verificationTiers[currentTier - 1]?.requirements.length && (
            <Alert severity="success" sx={{ mb: 2 }}>
              All requirements completed! You're ready to submit your verification for review.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowVerificationDialog(false)}>
            Cancel
          </Button>
          
          {verificationStep > 0 && (
            <Button onClick={() => setVerificationStep(prev => prev - 1)}>
              Back
            </Button>
          )}
          
          {verificationStep < verificationTiers[currentTier - 1]?.requirements.length ? (
            <Button 
              variant="contained"
              onClick={handleVerificationNext}
            >
              Next
            </Button>
          ) : (
            <Button 
              variant="contained"
              onClick={handleVerificationComplete}
            >
              Submit for Review
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default VerificationCenter;
