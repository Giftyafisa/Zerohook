import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Switch,
  FormControlLabel,
  FormGroup,
  Divider,
  Button,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Slider,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme
} from '@mui/material';
import {
  Security,
  Visibility,
  VisibilityOff,
  LocationOn,
  Phone,
  Email,
  Chat,
  PhotoCamera,
  Public,
  Lock,
  Verified,
  ExpandMore,
  Save,
  Refresh,
  Delete,
  Download,
  Settings,
  PrivacyTip,
  Shield,
  Notifications,
  Block,
  CheckCircle,
  Warning
} from '@mui/icons-material';

const PrivacySettings = () => {
  const theme = useTheme();
  
  const [privacySettings, setPrivacySettings] = useState({
    // Privacy Level
    privacyLevel: 'standard',
    
    // Profile Visibility
    showPhotos: true,
    showAge: true,
    showLocation: true,
    showContactInfo: false,
    showVerificationStatus: true,
    showTrustScore: true,
    showBookingHistory: false,
    showReviews: true,
    
    // Data Sharing
    allowDataAnalytics: true,
    allowMarketingEmails: false,
    allowThirdPartySharing: false,
    allowLocationTracking: false,
    allowBehavioralTracking: true,
    
    // Communication Preferences
    allowDirectMessages: true,
    allowPhoneCalls: false,
    allowWhatsApp: false,
    allowTelegram: false,
    allowEmail: true,
    
    // Location Privacy
    locationPrecision: 'city', // exact, neighborhood, city, region
    showTravelHistory: false,
    allowLocationBasedServices: true,
    
    // Photo Privacy
    showFaceInPhotos: false,
    allowPhotoDownload: false,
    allowPhotoSharing: false,
    
    // Verification Privacy
    showVerificationDocuments: false,
    showVerificationProcess: true,
    allowVerificationChecks: true
  });

  const [consentHistory, setConsentHistory] = useState([
    {
      id: 1,
      type: 'Profile Data Sharing',
      description: 'Sharing basic profile information with other users',
      status: 'granted',
      date: '2024-01-15',
      version: '1.0'
    },
    {
      id: 2,
      type: 'Location Services',
      description: 'Using location for service matching',
      status: 'granted',
      date: '2024-01-15',
      version: '1.0'
    },
    {
      id: 3,
      type: 'Marketing Communications',
      description: 'Receiving promotional emails and updates',
      status: 'denied',
      date: '2024-01-15',
      version: '1.0'
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  const privacyLevels = [
    {
      value: 'minimal',
      label: 'Minimal',
      description: 'Only username and verification tier visible',
      icon: <Lock />,
      color: '#F44336'
    },
    {
      value: 'standard',
      label: 'Standard',
      description: 'Add photos and basic bio',
      icon: <Public />,
      color: '#FF9800'
    },
    {
      value: 'enhanced',
      label: 'Enhanced',
      description: 'Add location and detailed preferences',
      icon: <Verified />,
      color: '#2196F3'
    },
    {
      value: 'premium',
      label: 'Premium',
      description: 'Full profile with contact options',
      icon: <Security />,
      color: '#4CAF50'
    }
  ];

  const locationOptions = [
    { value: 'exact', label: 'Exact Location', description: 'Show precise address' },
    { value: 'neighborhood', label: 'Neighborhood', description: 'Show general area' },
    { value: 'city', label: 'City Only', description: 'Show city name only' },
    { value: 'region', label: 'Region Only', description: 'Show state/province only' }
  ];

  useEffect(() => {
    // In real app, this would load user's privacy settings from backend
    console.log('Loading privacy settings...');
  }, []);

  const handlePrivacyChange = (field, value) => {
    setPrivacySettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    
    try {
      // In real app, this would save to backend
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
    } catch (error) {
      console.error('Error saving privacy settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSettings = () => {
    setPrivacySettings({
      privacyLevel: 'standard',
      showPhotos: true,
      showAge: true,
      showLocation: true,
      showContactInfo: false,
      showVerificationStatus: true,
      showTrustScore: true,
      showBookingHistory: false,
      showReviews: true,
      allowDataAnalytics: true,
      allowMarketingEmails: false,
      allowThirdPartySharing: false,
      allowLocationTracking: false,
      allowBehavioralTracking: true,
      allowDirectMessages: true,
      allowPhoneCalls: false,
      allowWhatsApp: false,
      allowTelegram: false,
      allowEmail: true,
      locationPrecision: 'city',
      showTravelHistory: false,
      allowLocationBasedServices: true,
      showFaceInPhotos: false,
      allowPhotoDownload: false,
      allowPhotoSharing: false,
      showVerificationDocuments: false,
      showVerificationProcess: true,
      allowVerificationChecks: true
    });
  };

  const handleDataDeletion = async () => {
    try {
      // In real app, this would request data deletion from backend
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setShowDeleteDialog(false);
      // Redirect to logout or show success message
      
    } catch (error) {
      console.error('Error requesting data deletion:', error);
    }
  };

  const handleDataExport = async () => {
    try {
      // In real app, this would generate and download data export
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setShowExportDialog(false);
      // Trigger download
      
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const getPrivacyLevelInfo = (level) => {
    return privacyLevels.find(l => l.value === level) || privacyLevels[1];
  };

  const currentPrivacyLevel = getPrivacyLevelInfo(privacySettings.privacyLevel);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Box mb={4} textAlign="center">
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          Privacy Settings 🔒
        </Typography>
        <Typography variant="h6" color="text.secondary">
          Control your data privacy and profile visibility
        </Typography>
      </Box>

      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Privacy settings saved successfully!
        </Alert>
      )}

      <Grid container spacing={4}>
        {/* Left Column - Privacy Controls */}
        <Grid item xs={12} md={8}>
          {/* Privacy Level Selection */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Privacy Level
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choose how much of your profile is visible to other users
              </Typography>
              
              <Grid container spacing={2}>
                {privacyLevels.map((level) => (
                  <Grid item xs={12} sm={6} key={level.value}>
                    <Card
                      sx={{
                        p: 2,
                        cursor: 'pointer',
                        border: privacySettings.privacyLevel === level.value ? '2px solid' : '1px solid',
                        borderColor: privacySettings.privacyLevel === level.value ? 'primary.main' : 'divider',
                        bgcolor: privacySettings.privacyLevel === level.value ? 'primary.50' : 'background.paper'
                      }}
                      onClick={() => handlePrivacyChange('privacyLevel', level.value)}
                    >
                      <Box display="flex" alignItems="center" gap={2}>
                        <Box sx={{ color: level.color }}>
                          {level.icon}
                        </Box>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {level.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {level.description}
                          </Typography>
                        </Box>
                      </Box>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          {/* Profile Visibility Settings */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Profile Visibility
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Control what information is visible on your profile
              </Typography>
              
              <FormGroup>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.showPhotos}
                          onChange={(e) => handlePrivacyChange('showPhotos', e.target.checked)}
                        />
                      }
                      label="Show Photos"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.showAge}
                          onChange={(e) => handlePrivacyChange('showAge', e.target.checked)}
                        />
                      }
                      label="Show Age"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.showLocation}
                          onChange={(e) => handlePrivacyChange('showLocation', e.target.checked)}
                        />
                      }
                      label="Show Location"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.showContactInfo}
                          onChange={(e) => handlePrivacyChange('showContactInfo', e.target.checked)}
                        />
                      }
                      label="Show Contact Info"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.showVerificationStatus}
                          onChange={(e) => handlePrivacyChange('showVerificationStatus', e.target.checked)}
                        />
                      }
                      label="Show Verification Status"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.showTrustScore}
                          onChange={(e) => handlePrivacyChange('showTrustScore', e.target.checked)}
                        />
                      }
                      label="Show Trust Score"
                    />
                  </Grid>
                </Grid>
              </FormGroup>
            </CardContent>
          </Card>

          {/* Data Sharing Controls */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Data Sharing & Analytics
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Control how your data is used for platform improvement
              </Typography>
              
              <FormGroup>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.allowDataAnalytics}
                          onChange={(e) => handlePrivacyChange('allowDataAnalytics', e.target.checked)}
                        />
                      }
                      label="Allow Data Analytics"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.allowMarketingEmails}
                          onChange={(e) => handlePrivacyChange('allowMarketingEmails', e.target.checked)}
                        />
                      }
                      label="Marketing Emails"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.allowThirdPartySharing}
                          onChange={(e) => handlePrivacyChange('allowThirdPartySharing', e.target.checked)}
                        />
                      }
                      label="Third-Party Sharing"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.allowBehavioralTracking}
                          onChange={(e) => handlePrivacyChange('allowBehavioralTracking', e.target.checked)}
                        />
                      }
                      label="Behavioral Tracking"
                    />
                  </Grid>
                </Grid>
              </FormGroup>
            </CardContent>
          </Card>

          {/* Communication Preferences */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Communication Preferences
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choose how other users can contact you
              </Typography>
              
              <FormGroup>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.allowDirectMessages}
                          onChange={(e) => handlePrivacyChange('allowDirectMessages', e.target.checked)}
                        />
                      }
                      label="Direct Messages"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.allowPhoneCalls}
                          onChange={(e) => handlePrivacyChange('allowPhoneCalls', e.target.checked)}
                        />
                      }
                      label="Phone Calls"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.allowWhatsApp}
                          onChange={(e) => handlePrivacyChange('allowWhatsApp', e.target.checked)}
                        />
                      }
                      label="WhatsApp"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.allowEmail}
                          onChange={(e) => handlePrivacyChange('allowEmail', e.target.checked)}
                        />
                      }
                      label="Email"
                    />
                  </Grid>
                </Grid>
              </FormGroup>
            </CardContent>
          </Card>

          {/* Location Privacy */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Location Privacy
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Control how precise your location is shared
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Location Precision</InputLabel>
                <Select
                  value={privacySettings.locationPrecision}
                  onChange={(e) => handlePrivacyChange('locationPrecision', e.target.value)}
                  label="Location Precision"
                >
                  {locationOptions.map(option => (
                    <MenuItem key={option.value} value={option.value}>
                      <Box>
                        <Typography variant="body1">{option.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.description}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormGroup>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.showTravelHistory}
                          onChange={(e) => handlePrivacyChange('showTravelHistory', e.target.checked)}
                        />
                      }
                      label="Show Travel History"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.allowLocationBasedServices}
                          onChange={(e) => handlePrivacyChange('allowLocationBasedServices', e.target.checked)}
                        />
                      }
                      label="Location-Based Services"
                    />
                  </Grid>
                </Grid>
              </FormGroup>
            </CardContent>
          </Card>

          {/* Photo Privacy */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Photo Privacy
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Control how your photos are shared and used
              </Typography>
              
              <FormGroup>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.showFaceInPhotos}
                          onChange={(e) => handlePrivacyChange('showFaceInPhotos', e.target.checked)}
                        />
                      }
                      label="Show Face in Photos"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.allowPhotoDownload}
                          onChange={(e) => handlePrivacyChange('allowPhotoDownload', e.target.checked)}
                        />
                      }
                      label="Allow Photo Download"
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={privacySettings.allowPhotoSharing}
                          onChange={(e) => handlePrivacyChange('allowPhotoSharing', e.target.checked)}
                        />
                      }
                      label="Allow Photo Sharing"
                    />
                  </Grid>
                </Grid>
              </FormGroup>
            </CardContent>
          </Card>
        </Grid>

        {/* Right Column - Summary & Actions */}
        <Grid item xs={12} md={4}>
          {/* Current Privacy Level */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Current Privacy Level
              </Typography>
              
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Box sx={{ color: currentPrivacyLevel.color }}>
                  {currentPrivacyLevel.icon}
                </Box>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    {currentPrivacyLevel.label}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {currentPrivacyLevel.description}
                  </Typography>
                </Box>
              </Box>
              
              <Typography variant="body2" color="text.secondary">
                Your profile is currently set to {currentPrivacyLevel.label.toLowerCase()} privacy level.
                {privacySettings.privacyLevel === 'minimal' && ' Only essential information is visible.'}
                {privacySettings.privacyLevel === 'standard' && ' Basic profile information is visible to help with matching.'}
                {privacySettings.privacyLevel === 'enhanced' && ' Detailed profile information is visible for better connections.'}
                {privacySettings.privacyLevel === 'premium' && ' Full profile information is visible for maximum engagement.'}
              </Typography>
            </CardContent>
          </Card>

          {/* Privacy Tips */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Privacy Tips 🔒
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <PrivacyTip color="info" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Start with minimal privacy"
                    secondary="You can always increase visibility later"
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <Shield color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Verify your profile"
                    secondary="Higher verification increases trust"
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <LocationOn color="warning" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Be careful with location"
                    secondary="Consider using city-level precision"
                  />
                </ListItem>
                
                <ListItem>
                  <ListItemIcon>
                    <PhotoCamera color="error" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Photo privacy matters"
                    secondary="Consider not showing your face initially"
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Actions
              </Typography>
              
              <Box display="flex" flexDirection="column" gap={2}>
                <Button
                  variant="contained"
                  fullWidth
                  startIcon={<Save />}
                  onClick={handleSaveSettings}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Settings'}
                </Button>
                
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Refresh />}
                  onClick={handleResetSettings}
                >
                  Reset to Default
                </Button>
                
                <Button
                  variant="outlined"
                  fullWidth
                  startIcon={<Download />}
                  onClick={() => setShowExportDialog(true)}
                >
                  Export My Data
                </Button>
                
                <Button
                  variant="outlined"
                  color="error"
                  fullWidth
                  startIcon={<Delete />}
                  onClick={() => setShowDeleteDialog(true)}
                >
                  Request Data Deletion
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Consent History */}
      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Consent History
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Track your data sharing consent decisions
          </Typography>
          
          <List>
            {consentHistory.map((consent) => (
              <ListItem key={consent.id} divider>
                <ListItemIcon>
                  {consent.status === 'granted' ? (
                    <CheckCircle color="success" />
                  ) : (
                    <Block color="error" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={consent.type}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {consent.description}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Version {consent.version} • {consent.date}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Chip
                    label={consent.status}
                    color={consent.status === 'granted' ? 'success' : 'error'}
                    size="small"
                  />
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* Data Deletion Dialog */}
      <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)}>
        <DialogTitle>Request Data Deletion</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This action cannot be undone. All your data will be permanently deleted.
          </Alert>
          <Typography variant="body2">
            When you request data deletion, we will:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <Warning color="warning" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Remove all your profile information" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Warning color="warning" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Delete all your photos and media" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Warning color="warning" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Cancel any pending bookings" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <Warning color="warning" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Remove your account permanently" />
            </ListItem>
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            color="error"
            onClick={handleDataDeletion}
          >
            Delete My Data
          </Button>
        </DialogActions>
      </Dialog>

      {/* Data Export Dialog */}
      <Dialog open={showExportDialog} onClose={() => setShowExportDialog(false)}>
        <DialogTitle>Export My Data</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            We'll prepare a comprehensive export of all your data, including:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Profile information" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Photos and media" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Booking history" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Messages and communications" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary="Privacy settings and consents" />
            </ListItem>
          </List>
          <Alert severity="info" sx={{ mt: 2 }}>
            The export will be prepared and sent to your email within 24 hours.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExportDialog(false)}>
            Cancel
          </Button>
          <Button 
            variant="contained"
            onClick={handleDataExport}
          >
            Export Data
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default PrivacySettings;
