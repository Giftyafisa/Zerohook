import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Chip,
  Button,
  IconButton,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab
} from '@mui/material';
import {
  LocationOn,
  Star,
  Security,
  FavoriteBorder,
  Favorite,
  Message,
  VideoCall,
  ArrowBack,
  Work
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { getDefaultImage } from '../config/images';
import { useSocket } from '../contexts/SocketContext';

const ProfileDetailPage = () => {
  const { isAuthenticated, user } = useAuth();
  const { profileId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [contactDialog, setContactDialog] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [contactType, setContactType] = useState('contact_request');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

  // Debug authentication state
  console.log('🔍 ProfileDetailPage auth state:', { 
    isAuthenticated, 
    user: user?.username, 
    userId: user?.id,
    hasToken: !!localStorage.getItem('token')
  });

  // Debug profile data
  console.log('🔍 ProfileDetailPage profile data:', {
    hasProfile: !!profile,
    profileId: profile?.id,
    profileUsername: profile?.username,
    profileData: profile?.profile_data ? 'exists' : 'missing'
  });

  // Debug socket connection
  const { isConnected } = useSocket();
  console.log('🔍 ProfileDetailPage socket state:', {
    isConnected,
    hasToken: !!localStorage.getItem('token')
  });

  // Check connection status with the profile user
  const checkConnectionStatus = useCallback(async () => {
    if (!isAuthenticated || !user || !profile) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/connections/check-status/${profile.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setConnectionStatus(data);
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    }
  }, [isAuthenticated, user, profile, API_BASE_URL]);

  useEffect(() => {
    if (profile) {
      checkConnectionStatus();
    }
  }, [profile, checkConnectionStatus]);

  const fetchProfileDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // CRITICAL: Prevent users from viewing their own profile
      if (isAuthenticated && user && user.id === profileId) {
        setError('You cannot view your own profile in the marketplace. Use your dashboard instead.');
        setLoading(false);
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/users/${profileId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Profile not found');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('🔍 Fetched profile details:', data);
      
      if (!data.user) {
        throw new Error('Invalid response format: missing user data');
      }
      
      setProfile(data.user);
    } catch (error) {
      console.error('Error fetching profile details:', error);
      setError(error.message || 'Failed to fetch profile details');
    } finally {
      setLoading(false);
    }
  }, [profileId, API_BASE_URL, isAuthenticated, user]);

  useEffect(() => {
    if (profileId) {
      fetchProfileDetails();
    }
  }, [profileId, fetchProfileDetails]);

  const handleContact = () => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location.pathname } });
      return;
    }
    
    setContactMessage('');
    setContactType('contact_request');
    setContactDialog(true);
  };

  const handleSendContactRequest = async () => {
    if (!contactMessage.trim()) return;

    setSendingMessage(true);
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        throw new Error('Authentication token not found. Please login again.');
      }
      
      const response = await fetch(`${API_BASE_URL}/connections/contact-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          toUserId: profile.id,
          message: contactMessage,
          connectionType: contactType
        })
      });

      if (response.ok) {
        alert('Contact request sent successfully!');
        setContactDialog(false);
        setContactMessage('');
        // Refresh connection status
        checkConnectionStatus();
      } else {
        const errorData = await response.json();
        
        // Handle specific error cases
        if (response.status === 409) {
          alert('You are already connected with this user!');
        } else if (response.status === 403) {
          alert('Cannot connect with this user due to blocking.');
        } else if (response.status === 404) {
          alert('User not found. Please try again.');
        } else {
          throw new Error(errorData.message || 'Failed to send contact request');
        }
      }
    } catch (error) {
      console.error('Send contact request error:', error);
      alert(`Failed to send contact request: ${error.message}`);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFavoriteToggle = () => {
    setIsFavorite(!isFavorite);
  };

  const getVerificationColor = (tier) => {
    switch (tier) {
      case 4: return '#FFD700'; // Elite
      case 3: return '#9C27B0'; // Pro
      case 2: return '#2196F3'; // Advanced
      case 1: return '#4CAF50'; // Basic
      default: return '#757575';
    }
  };

  const getVerificationLabel = (tier) => {
    switch (tier) {
      case 4: return 'Elite';
      case 3: return 'Pro';
      case 2: return 'Advanced';
      case 1: return 'Basic';
      default: return 'Basic';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box textAlign="center">
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Button
            variant="contained"
            onClick={() => navigate('/profiles')}
            startIcon={<ArrowBack />}
          >
            Back to Profiles
          </Button>
        </Box>
      </Container>
    );
  }

  if (!profile) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box textAlign="center">
          <Typography variant="h5" gutterBottom>
            Profile Not Found
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate('/profiles')}
            startIcon={<ArrowBack />}
          >
            Back to Profiles
          </Button>
        </Box>
      </Container>
    );
  }

  const profileData = profile.profile_data || {};

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box mb={3}>
        <Button
          variant="outlined"
          onClick={() => navigate('/profiles')}
          startIcon={<ArrowBack />}
        >
          Back to Profiles
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Box display="flex" justifyContent="center">
                <CardMedia
                  component="img"
                  height="300"
                  width="300"
                  image={profileData.profilePicture || getDefaultImage('PROFILE', profileData.gender)}
                  alt={`${profileData.firstName} ${profileData.lastName}`}
                  sx={{ 
                    objectFit: 'cover',
                    borderRadius: 2,
                    maxWidth: '100%'
                  }}
                  onError={(e) => {
                    e.target.src = getDefaultImage('PROFILE', profileData.gender);
                  }}
                />
              </Box>
            </Grid>

            <Grid item xs={12} md={8}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box sx={{ position: 'relative' }}>
                  <Typography variant="h4" component="h1" gutterBottom>
                    {profileData.firstName} {profileData.lastName}
                  </Typography>
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    @{profile.username}
                  </Typography>
                  {/* Online Status Badge */}
                  <Box sx={{ position: 'absolute', top: 0, right: -40 }}>
                    <Box
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        bgcolor: profile.isOnline ? '#00ff88' : '#6a6a7a',
                        border: '2px solid #1a1a22',
                      }}
                    />
                  </Box>
                </Box>
                <IconButton
                  size="large"
                  onClick={handleFavoriteToggle}
                  color={isFavorite ? 'primary' : 'default'}
                >
                  {isFavorite ? <Favorite /> : <FavoriteBorder />}
                </IconButton>
              </Box>

              <Box display="flex" gap={2} mb={2}>
                <Chip
                  icon={<Security />}
                  label={getVerificationLabel(profile.verification_tier)}
                  sx={{ 
                    backgroundColor: getVerificationColor(profile.verification_tier),
                    color: 'white'
                  }}
                />
                <Chip
                  icon={<Star />}
                  label={`Trust Score: ${profile.reputation_score || 0}`}
                  color="primary"
                  variant="outlined"
                />
              </Box>
              
              {/* SUBSCRIPTION STATUS - Differentiate subscribed vs non-subscribed users */}
              <Box display="flex" gap={2} mb={2}>
                <Chip
                  icon={<Star />}
                  label={profile.is_subscribed ? 'Premium Member' : 'Free User'}
                  color={profile.is_subscribed ? 'primary' : 'default'}
                  variant={profile.is_subscribed ? 'filled' : 'outlined'}
                />
                {profile.subscription_tier && (
                  <Chip
                    label={`${profile.subscription_tier.charAt(0).toUpperCase() + profile.subscription_tier.slice(1)} Tier`}
                    color="secondary"
                    variant="outlined"
                  />
                )}
              </Box>
              
              {/* Connection Status Indicator */}
              {connectionStatus && (
                <Box display="flex" gap={2} mb={2}>
                  {connectionStatus.exists ? (
                    <Chip
                      label={
                        connectionStatus.status === 'accepted' 
                          ? '✅ Connected' 
                          : connectionStatus.status === 'pending' 
                            ? '⏳ Request Pending' 
                            : connectionStatus.status === 'rejected'
                              ? '❌ Request Rejected'
                              : '📝 Request Sent'
                      }
                      color={
                        connectionStatus.status === 'accepted' 
                          ? 'success' 
                          : connectionStatus.status === 'pending' 
                            ? 'warning' 
                            : connectionStatus.status === 'rejected'
                              ? 'error'
                              : 'info'
                      }
                      variant="outlined"
                      size="medium"
                    />
                  ) : (
                    <Chip
                      label="💬 Not Connected"
                      color="default"
                      variant="outlined"
                      size="medium"
                    />
                  )}
                </Box>
              )}

              <Box display="flex" flexWrap="wrap" gap={2} mb={2}>
                <Box display="flex" alignItems="center" gap={1}>
                  <LocationOn color="action" />
                  <Typography variant="body1">
                    {profileData.location?.city || 'Unknown'}, {profileData.location?.country || 'Unknown'}
                  </Typography>
                </Box>
                <Typography variant="body1">
                  {profileData.age || 'N/A'} years old
                </Typography>
                {profileData.gender && (
                  <Typography variant="body1">
                    {profileData.gender}
                  </Typography>
                )}
              </Box>

              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Typography variant="h6" color="primary" fontWeight="bold">
                  ${profileData.basePrice || 'N/A'}
                </Typography>
                {profileData.availability && profileData.availability.length > 0 && (
                  <Chip 
                    label={profileData.availability[0]} 
                    variant="outlined"
                    color="primary"
                  />
                )}
              </Box>

              <Box display="flex" gap={2} flexWrap="wrap">
                <Button
                  variant={connectionStatus?.exists ? "outlined" : "contained"}
                  size="large"
                  onClick={handleContact}
                  startIcon={<Message />}
                  disabled={connectionStatus?.exists}
                  color={connectionStatus?.exists ? "success" : "primary"}
                >
                  {connectionStatus?.exists ? 
                    (connectionStatus.status === 'accepted' ? 'Connected' : 'Request Sent') : 
                    'Contact'
                  }
                </Button>
                <IconButton
                  size="large"
                  sx={{
                    bgcolor: 'rgba(0, 242, 234, 0.1)',
                    '&:hover': { bgcolor: 'rgba(0, 242, 234, 0.2)' },
                  }}
                  onClick={() => {
                    if (window.startVideoCall) {
                      window.startVideoCall(profile.id);
                      setContactType('video_call');
                      setContactMessage(`Initiating video call with ${profile.username}...`);
                      setContactDialog(true);
                    }
                  }}
                >
                  <VideoCall sx={{ color: '#00f2ea' }} />
                </IconButton>
                
                {/* Enhanced Debug Panel */}
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1, fontSize: '0.75rem' }}>
                  <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                    🔍 Debug Information
                  </Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <div>🔐 Auth: {isAuthenticated ? '✅' : '❌'}</div>
                      <div>👤 User: {user?.username || 'None'}</div>
                      <div>🎯 Target: {profile?.username || 'None'}</div>
                    </Grid>
                    <Grid item xs={6}>
                      <div>🔑 Token: {localStorage.getItem('token') ? '✅' : '❌'}</div>
                      <div>🔌 Socket: {isConnected ? '✅' : '❌'}</div>
                      <div>📱 Profile: {profile ? '✅' : '❌'}</div>
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'grey.300' }}>
                    <Typography variant="caption" color="text.secondary">
                      Token: {localStorage.getItem('token') ? localStorage.getItem('token').substring(0, 20) + '...' : 'None'}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
            <Tab label="About" />
            <Tab label="Services" />
            <Tab label="Reviews" />
            <Tab label="Gallery" />
          </Tabs>
        </Box>

        <CardContent>
          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                About Me
              </Typography>
              <Typography variant="body1" paragraph>
                {profileData.bio || 'No bio available'}
              </Typography>

              {profileData.languages && profileData.languages.length > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle1" gutterBottom>
                    Languages
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {profileData.languages.map((lang, index) => (
                      <Chip key={index} label={lang} variant="outlined" />
                    ))}
                  </Box>
                </Box>
              )}

              {profileData.specializations && profileData.specializations.length > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle1" gutterBottom>
                    Specializations
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {profileData.specializations.map((spec, index) => (
                      <Chip key={index} label={spec} variant="outlined" color="primary" />
                    ))}
                  </Box>
                </Box>
              )}

              {profileData.serviceCategories && profileData.serviceCategories.length > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle1" gutterBottom>
                    Service Categories
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap">
                    {profileData.serviceCategories.map((category, index) => (
                      <Chip key={index} label={category} variant="outlined" color="secondary" />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Services Offered
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Detailed service information will be displayed here.
              </Typography>
            </Box>
          )}

          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Reviews & Ratings
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Customer reviews and ratings will be displayed here.
              </Typography>
            </Box>
          )}

          {activeTab === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Photo Gallery
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Additional photos will be displayed here.
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog 
        open={contactDialog} 
        onClose={() => setContactDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Contact {profileData.firstName} {profileData.lastName}
        </DialogTitle>
        <DialogContent>
          <Box mb={2}>
            <Typography variant="body2" color="text.secondary">
              Choose how you'd like to connect
            </Typography>
          </Box>
          
          <Box mb={2}>
            <Typography variant="subtitle2" gutterBottom>
              Contact Type:
            </Typography>
            <Box display="flex" gap={1}>
              <Button
                variant={contactType === 'contact_request' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setContactType('contact_request')}
                startIcon={<Message />}
              >
                Message
              </Button>
              <Button
                variant={contactType === 'video_call' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setContactType('video_call')}
                startIcon={<VideoCall />}
              >
                Video Call
              </Button>
              <Button
                variant={contactType === 'service_inquiry' ? 'contained' : 'outlined'}
                size="small"
                onClick={() => setContactType('service_inquiry')}
                startIcon={<Work />}
              >
                Service Inquiry
              </Button>
            </Box>
          </Box>
          
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Your Message"
            value={contactMessage}
            onChange={(e) => setContactMessage(e.target.value)}
            placeholder={
              contactType === 'video_call' 
                ? "Hi! I would like to have a video call with you. Are you available?"
                : contactType === 'service_inquiry'
                ? "Hi! I'm interested in your services. Can you tell me more about what you offer?"
                : contactType === 'contact_request'
                ? "Hi! I'd like to connect with you..."
                : "Hi! I'd like to connect with you..."
            }
            variant="outlined"
            sx={{ mb: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setContactDialog(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSendContactRequest}
            variant="contained"
            disabled={!contactMessage.trim() || sendingMessage}
          >
            {sendingMessage ? 'Sending...' : 'Send Request'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProfileDetailPage;

