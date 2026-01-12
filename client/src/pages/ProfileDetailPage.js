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
import { toast } from 'react-toastify';
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
import { API_BASE_URL, getUploadUrl } from '../config/constants';
import { resolveProfileImage } from '../utils/imageUtils';

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

  const { isConnected } = useSocket();

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
        toast.success('Contact request sent successfully!');
        setContactDialog(false);
        setContactMessage('');
        // Refresh connection status
        checkConnectionStatus();
      } else {
        const errorData = await response.json();
        
        // Handle specific error cases
        if (response.status === 409) {
          toast.info('You are already connected with this user!');
        } else if (response.status === 403) {
          toast.error('Cannot connect with this user due to blocking.');
        } else if (response.status === 404) {
          toast.error('User not found. Please try again.');
        } else {
          throw new Error(errorData.message || 'Failed to send contact request');
        }
      }
    } catch (error) {
      console.error('Send contact request error:', error);
      toast.error(`Failed to send contact request: ${error.message}`);
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
    <Container maxWidth="lg" sx={{ py: { xs: 0.5, sm: 1, md: 4 }, pt: { xs: 0, sm: 0.5, md: 4 } }}>
      {/* Back Button */}
      <Button
        variant="text"
        onClick={() => navigate('/profiles')}
        startIcon={<ArrowBack />}
        sx={{ mb: { xs: 0.5, sm: 1, md: 3 }, color: 'text.secondary', minHeight: 36 }}
      >
        Back
      </Button>

      {/* Hero Card - Clean & Modern */}
      <Card 
        elevation={0}
        sx={{ 
          bgcolor: 'background.paper',
          borderRadius: 3,
          overflow: 'hidden'
        }}
      >
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Grid container spacing={4}>
            {/* Profile Image */}
            <Grid item xs={12} md={4}>
              <Box 
                sx={{ 
                  position: 'relative',
                  width: '100%',
                  paddingTop: '100%', // 1:1 aspect ratio
                  borderRadius: 3,
                  overflow: 'hidden',
                  bgcolor: 'background.default'
                }}
              >
                <CardMedia
                  component="img"
                  image={resolveProfileImage(profileData) || getDefaultImage('PROFILE', profileData.gender)}
                  alt={`${profileData.firstName} ${profileData.lastName}`}
                  sx={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                    e.target.src = getDefaultImage('PROFILE', profileData.gender);
                  }}
                />
                {/* Online Status Badge */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 16,
                    right: 16,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    bgcolor: profile.isOnline ? 'success.main' : 'grey.500',
                    border: '3px solid',
                    borderColor: 'background.paper',
                    boxShadow: 2
                  }}
                />
              </Box>
            </Grid>

            {/* Profile Info */}
            <Grid item xs={12} md={8}>
              {/* Name & Favorite */}
              <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography variant="h4" component="h1" fontWeight={600} gutterBottom>
                    {profileData.firstName} {profileData.lastName}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    @{profile.username}
                  </Typography>
                </Box>
                <IconButton
                  onClick={handleFavoriteToggle}
                  sx={{ color: isFavorite ? 'error.main' : 'text.secondary' }}
                  aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {isFavorite ? <Favorite /> : <FavoriteBorder />}
                </IconButton>
              </Box>

              {/* Consolidated Status Line */}
              <Box display="flex" gap={1} flexWrap="wrap" alignItems="center" mb={3}>
                <Chip
                  icon={<Security sx={{ fontSize: 18 }} />}
                  label={getVerificationLabel(profile.verification_tier)}
                  size="small"
                  sx={{ 
                    bgcolor: `${getVerificationColor(profile.verification_tier)}20`,
                    color: getVerificationColor(profile.verification_tier),
                    borderColor: getVerificationColor(profile.verification_tier),
                    border: 1,
                    fontWeight: 500
                  }}
                />
                <Chip
                  icon={<Star sx={{ fontSize: 18 }} />}
                  label={`${profile.reputation_score || 0}`}
                  size="small"
                  variant="outlined"
                />
                {profile.is_subscribed && (
                  <Chip
                    label="Premium"
                    size="small"
                    color="primary"
                    sx={{ fontWeight: 500 }}
                  />
                )}
              </Box>

              {/* Location & Age */}
              <Box display="flex" alignItems="center" gap={2} mb={2} color="text.secondary">
                <Box display="flex" alignItems="center" gap={0.5}>
                  <LocationOn sx={{ fontSize: 20 }} />
                  <Typography variant="body2">
                    {profileData.location?.city}, {profileData.location?.country}
                  </Typography>
                </Box>
                <Typography variant="body2">•</Typography>
                <Typography variant="body2">
                  {profileData.age} years old
                </Typography>
              </Box>

              {/* Price & Availability - Single Line */}
              <Box display="flex" alignItems="center" gap={2} mb={3}>
                <Typography variant="h5" color="primary" fontWeight={600}>
                  ${profileData.basePrice}
                </Typography>
                {profileData.availability && profileData.availability.length > 0 && (
                  <>
                    <Typography variant="body2" color="text.secondary">•</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {profileData.availability.join(', ')}
                    </Typography>
                  </>
                )}
              </Box>

              {/* Action Buttons */}
              <Box display="flex" gap={2}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleContact}
                  startIcon={<Message />}
                  disabled={connectionStatus?.exists && connectionStatus.status === 'accepted'}
                  sx={{ 
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 3
                  }}
                >
                  {connectionStatus?.exists && connectionStatus.status === 'accepted' 
                    ? 'Connected' 
                    : connectionStatus?.exists 
                      ? 'Pending' 
                      : 'Contact'
                  }
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<VideoCall />}
                  onClick={() => {
                    if (window.startVideoCall) {
                      window.startVideoCall(profile.id);
                    }
                  }}
                  sx={{ 
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 3
                  }}
                >
                  Video Call
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs Card - Only Show Populated Sections */}
      <Card 
        elevation={0}
        sx={{ 
          mt: 3,
          bgcolor: 'background.paper',
          borderRadius: 3
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, newValue) => setActiveTab(newValue)}
            sx={{ px: 2 }}
          >
            <Tab label="About" sx={{ textTransform: 'none', fontWeight: 600 }} />
            <Tab label="Services" sx={{ textTransform: 'none', fontWeight: 600 }} />
          </Tabs>
        </Box>

        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          {/* About Tab */}
          {activeTab === 0 && (
            <Box>
              <Typography variant="body1" color="text.secondary" paragraph sx={{ lineHeight: 1.8 }}>
                {profileData.bio || 'No bio available'}
              </Typography>

              {profileData.languages && profileData.languages.length > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom sx={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>
                    Languages
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                    {profileData.languages.map((lang, index) => (
                      <Chip 
                        key={index} 
                        label={lang} 
                        size="small"
                        sx={{ bgcolor: 'background.default', fontWeight: 500 }}
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {profileData.specializations && profileData.specializations.length > 0 && (
                <Box mb={3}>
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom sx={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>
                    Specializations
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                    {profileData.specializations.map((spec, index) => (
                      <Chip 
                        key={index} 
                        label={spec} 
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}

              {profileData.serviceCategories && profileData.serviceCategories.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} color="text.secondary" gutterBottom sx={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}>
                    Service Categories
                  </Typography>
                  <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                    {profileData.serviceCategories.map((category, index) => (
                      <Chip 
                        key={index} 
                        label={category} 
                        size="small"
                        sx={{ bgcolor: 'background.default', fontWeight: 500 }}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}

          {/* Services Tab */}
          {activeTab === 1 && (
            <Box textAlign="center" py={4}>
              <Work sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="body1" color="text.secondary">
                Detailed service information coming soon
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Contact Dialog - Modern & Clean */}
      <Dialog 
        open={contactDialog} 
        onClose={() => setContactDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            bgcolor: 'background.paper'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" fontWeight={600}>
            Contact {profileData.firstName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose how you'd like to connect
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box display="flex" gap={1} mb={3}>
            <Button
              variant={contactType === 'contact_request' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setContactType('contact_request')}
              startIcon={<Message />}
              sx={{ 
                flex: 1,
                borderRadius: 2,
                textTransform: 'none'
              }}
            >
              Message
            </Button>
            <Button
              variant={contactType === 'video_call' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setContactType('video_call')}
              startIcon={<VideoCall />}
              sx={{ 
                flex: 1,
                borderRadius: 2,
                textTransform: 'none'
              }}
            >
              Video Call
            </Button>
            <Button
              variant={contactType === 'service_inquiry' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setContactType('service_inquiry')}
              startIcon={<Work />}
              sx={{ 
                flex: 1,
                borderRadius: 2,
                textTransform: 'none'
              }}
            >
              Service
            </Button>
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
                ? "Hi! I'm interested in your services. Can you tell me more?"
                : "Hi! I'd like to connect with you..."
            }
            variant="outlined"
            sx={{ 
              '& .MuiOutlinedInput-root': {
                borderRadius: 2
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button 
            onClick={() => setContactDialog(false)}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              px: 3
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSendContactRequest}
            variant="contained"
            disabled={!contactMessage.trim() || sendingMessage}
            sx={{ 
              borderRadius: 2,
              textTransform: 'none',
              px: 3,
              fontWeight: 600
            }}
          >
            {sendingMessage ? 'Sending...' : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProfileDetailPage;

