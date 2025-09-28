import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Grid,
  Avatar,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Chip,
  IconButton,
  Alert,
  LinearProgress,
  FormControlLabel,
  Switch,
  CircularProgress,
  useTheme,
  useMediaQuery,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Badge,
  Tooltip
} from '@mui/material';
import {
  Edit,
  Save,
  Cancel,
  PhotoCamera,
  Verified,
  Security,
  Phone,
  Email,
  Person,
  Shield,
  Settings,
  LocationOn,
  Work,
  School,
  Refresh,
  VideoCall
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { colors, gradients } from '../theme/colors';
import authAPI from '../services/authAPI';
import VideoSystem from '../components/video/VideoSystem';

const ProfilePage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, updateUser } = useAuth();
  const location = useLocation();
  
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileData, setProfileData] = useState({
    id: '',
    username: '',
    email: '',
    phone: '+234 123 456 7890',
    fullName: 'Loading...',
    firstName: '',
    lastName: '',
    bio: 'Loading profile...',
    location: 'Loading...',
    city: '',
    country: '',
    age: 25,
    gender: 'Not specified',
    languages: ['English'],
    education: 'Not specified',
    occupation: 'Service Provider',
    specializations: [],
    serviceCategories: [],
    basePrice: 0,
    availability: [],
    discretion: 'Standard',
    profilePicture: null,
    trustScore: 0,
    verificationTier: 1,
    completedServices: 0,
    totalEarnings: 0,
    memberSince: new Date().getFullYear(),
    lastActive: new Date(),
    preferences: {
      emailNotifications: true,
      smsNotifications: false,
      profileVisible: true,
      showEarnings: false
    }
  });
  const [editData, setEditData] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [photoDialog, setPhotoDialog] = useState(false);
  const [verificationDialog, setVerificationDialog] = useState(false);
  const [videoDialog, setVideoDialog] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Animation variants
  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5 }
  };

  const fetchUserProfile = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔍 Starting profile fetch...');
      const token = localStorage.getItem('token');
      
      // Double-check authentication
      if (!token || !user?.id) {
        console.log('No token or user ID, skipping profile fetch');
        setLoading(false);
        return;
      }
      
      console.log('🔍 User authenticated, fetching dashboard data...');
      
      // Try to fetch dashboard data first (which includes user profile)
      const dashboardResponse = await fetch('/api/dashboard/stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (dashboardResponse.ok) {
        let dashboardData;
        try {
          dashboardData = await dashboardResponse.json();
        } catch (parseError) {
          console.error('Failed to parse dashboard response:', parseError);
          throw new Error('Invalid response from server');
        }
        
        console.log('🔍 Fetched dashboard data for profile:', dashboardData);
        console.log('🔍 User context data:', user);
        
        // Transform dashboard data to profile format with improved data handling
        const transformedData = {
          id: user.id,
          username: user.username || 'user',
          email: user.email || 'email@example.com',
          phone: user.profile_data?.phone || user.phone || '+234 123 456 7890',
          fullName: user.profile_data?.firstName && user.profile_data?.lastName ? 
            `${user.profile_data.firstName} ${user.profile_data.lastName}` : 
            (user.profile_data?.fullName || user.username || 'User'),
          firstName: user.profile_data?.firstName || '',
          lastName: user.profile_data?.lastName || '',
          bio: user.profile_data?.bio || 'Professional adult service provider',
          location: user.profile_data?.location ? 
            `${user.profile_data.location.city || ''}, ${user.profile_data.location.country || ''}` : 
            'Location not set',
          city: user.profile_data?.location?.city || '',
          country: user.profile_data?.location?.country || '',
          age: user.profile_data?.age || 25,
          gender: user.profile_data?.gender || 'Not specified',
          languages: user.profile_data?.languages || ['English'],
          education: user.profile_data?.education || 'Not specified',
          occupation: user.profile_data?.occupation || 'Service Provider',
          specializations: user.profile_data?.specializations || [],
          serviceCategories: user.profile_data?.serviceCategories || [],
          basePrice: user.profile_data?.basePrice || 0,
          availability: user.profile_data?.availability || [],
          discretion: user.profile_data?.discretion || 'Standard',
          profilePicture: user.profile_data?.profile_picture?.url || user.profile_data?.profilePicture || null,
          trustScore: dashboardData.user?.trustScore || parseFloat(user.reputation_score) || 0,
          verificationTier: dashboardData.user?.verificationTier || user.verification_tier || 1,
          completedServices: dashboardData.stats?.completedTransactions || user.profile_data?.completedServices || 0,
          totalEarnings: dashboardData.stats?.totalEarnings || user.profile_data?.totalEarnings || 0,
          memberSince: user.created_at ? new Date(user.created_at).getFullYear() : new Date().getFullYear(),
          lastActive: user.last_active || user.created_at || new Date(),
          preferences: {
            emailNotifications: true,
            smsNotifications: false,
            profileVisible: true,
            showEarnings: false
          }
        };
        
        console.log('🔍 Transformed profile data:', transformedData);
        setProfileData(transformedData);
        setEditData(transformedData);
        console.log('🔍 Profile data state set successfully');
      } else {
        // Fallback: create profile data from user context
        console.log(`Dashboard fetch failed with status ${dashboardResponse.status}, using user context data`);
        
        if (dashboardResponse.status === 401) {
          console.log('Authentication error - user may need to re-login');
        } else if (dashboardResponse.status >= 500) {
          console.log('Server error - dashboard service unavailable');
        }
        
        console.log('🔍 User context for fallback:', user);
        
        const fallbackData = {
          id: user.id,
          username: user.username || 'user',
          email: user.email || 'email@example.com',
          phone: user.profile_data?.phone || user.phone || '+234 123 456 7890',
          fullName: user.profile_data?.firstName && user.profile_data?.lastName ? 
            `${user.profile_data.firstName} ${user.profile_data.lastName}` : 
            (user.profile_data?.fullName || user.username || 'User'),
          firstName: user.profile_data?.firstName || '',
          lastName: user.profile_data?.lastName || '',
          bio: user.profile_data?.bio || 'Professional adult service provider',
          location: user.profile_data?.location ? 
            `${user.profile_data.location.city || ''}, ${user.profile_data.location.country || ''}` : 
            'Location not set',
          city: user.profile_data?.location?.city || '',
          country: user.profile_data?.location?.country || '',
          age: user.profile_data?.age || 25,
          gender: user.profile_data?.gender || 'Not specified',
          languages: user.profile_data?.languages || ['English'],
          education: user.profile_data?.education || 'Not specified',
          occupation: user.profile_data?.occupation || 'Service Provider',
          specializations: user.profile_data?.specializations || [],
          serviceCategories: user.profile_data?.serviceCategories || [],
          basePrice: user.profile_data?.basePrice || 0,
          availability: user.profile_data?.availability || [],
          discretion: user.profile_data?.discretion || 'Standard',
          profilePicture: user.profile_data?.profile_picture?.url || user.profile_data?.profilePicture || null,
          trustScore: parseFloat(user.reputation_score) || 0,
          verificationTier: user.verification_tier || 1,
          completedServices: user.profile_data?.completedServices || 0,
          totalEarnings: user.profile_data?.totalEarnings || 0,
          memberSince: user.created_at ? new Date(user.created_at).getFullYear() : new Date().getFullYear(),
          lastActive: user.last_active || user.created_at || new Date(),
          preferences: {
            emailNotifications: true,
            smsNotifications: false,
            profileVisible: true,
            showEarnings: false
          }
        };
        
        console.log('🔍 Fallback profile data:', fallbackData);
        setProfileData(fallbackData);
        setEditData(fallbackData);
        console.log('🔍 Fallback profile data set successfully');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      
      // Provide specific error feedback
      let errorMessage = 'Failed to load profile data.';
      
      if (error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection.';
      } else if (error.message.includes('JSON')) {
        errorMessage = 'Invalid data received from server.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Even if fetch fails, try to show basic profile from user context
      if (user) {
        console.log('🔍 Creating basic profile from user context due to error');
        const basicData = {
          id: user.id,
          username: user.username || 'user',
          email: user.email || 'email@example.com',
          phone: user.phone || '+234 123 456 7890',
          fullName: user.username || 'User',
          firstName: '',
          lastName: '',
          bio: 'Professional adult service provider',
          location: 'Location not set',
          city: '',
          country: '',
          age: 25,
          gender: 'Not specified',
          languages: ['English'],
          education: 'Not specified',
          occupation: 'Service Provider',
          specializations: [],
          serviceCategories: [],
          basePrice: 0,
          availability: [],
          discretion: 'Standard',
          profilePicture: null,
          trustScore: 0,
          verificationTier: 1,
          completedServices: 0,
          totalEarnings: 0,
          memberSince: user.created_at ? new Date(user.created_at).getFullYear() : new Date().getFullYear(),
          lastActive: user.last_active || user.created_at || new Date(),
          preferences: {
            emailNotifications: true,
            smsNotifications: false,
            profileVisible: true,
            showEarnings: false
          }
        };
        
        console.log('🔍 Basic profile data:', basicData);
        setProfileData(basicData);
        setEditData(basicData);
        console.log('🔍 Basic profile data set successfully');
        
        setSnackbar({
          open: true,
          message: 'Using basic profile data (some features may be limited)',
          severity: 'warning'
        });
      } else {
        setSnackbar({
          open: true,
          message: errorMessage,
          severity: 'error'
        });
      }
    } finally {
      setLoading(false);
      console.log('🔍 Profile fetch completed, loading set to false');
    }
  }, [user]);

  // Simplified useEffect - only fetch when user changes
  useEffect(() => {
    if (user && user.id) {
      console.log('🔍 User detected, fetching profile...');
      fetchUserProfile();
    } else {
      console.log('🔍 No user or user ID, setting loading to false');
      setLoading(false);
    }
  }, [user]); // Remove fetchUserProfile from dependencies to prevent loops

  // Debug useEffect to monitor profileData changes (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Profile data state changed:', profileData);
      console.log('🔍 Loading state:', loading);
      console.log('🔍 User state:', user);
    }
  }, [profileData, loading, user]);

  // Profile picture upload functions
  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setSnackbar({
          open: true,
          message: 'Please select a valid image file (JPEG, PNG, GIF, WebP)',
          severity: 'error'
        });
        return;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setSnackbar({
          open: true,
          message: 'File size must be less than 5MB',
          severity: 'error'
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleUploadPhoto = async () => {
    if (!selectedFile) {
      setSnackbar({
        open: true,
        message: 'Please select a file first',
        severity: 'error'
      });
      return;
    }

    setUploadingPhoto(true);
    try {
      const result = await authAPI.uploadProfilePicture(selectedFile);
      console.log('🔍 Upload result:', result);
      console.log('🔍 Profile picture data:', result.profilePicture);
      
      // Update local profile data
      setProfileData(prev => ({
        ...prev,
        profile_picture: result.profilePicture,
        profilePicture: result.profilePicture.url || result.profilePicture // Use URL from backend response
      }));
      
      // Update user context
      if (user) {
        updateUser({
          ...user,
          profile_data: {
            ...user.profile_data,
            profile_picture: result.profilePicture,
            profilePicture: result.profilePicture.url || result.profilePicture // Use URL from backend response
          }
        });
      }
      
      setSnackbar({
        open: true,
        message: 'Profile picture updated successfully!',
        severity: 'success'
      });
      
      // Refresh profile data to ensure everything is up to date
      setTimeout(() => {
        console.log('🔍 Refreshing profile data after upload...');
        fetchUserProfile();
      }, 500);
      
      setPhotoDialog(false);
      setSelectedFile(null);
      
    } catch (error) {
      console.error('Upload error:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to upload profile picture',
        severity: 'error'
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleVideoUpload = async (videoFile) => {
    try {
      setSnackbar({
        open: true,
        message: 'Video uploaded successfully!',
        severity: 'success'
      });
      
      // Refresh profile data to show new video
      setTimeout(() => {
        fetchUserProfile();
      }, 500);
      
    } catch (error) {
      console.error('Video upload error:', error);
      setSnackbar({
        open: true,
        message: 'Failed to upload video',
        severity: 'error'
      });
    }
  };

  const handleEdit = () => {
    setEditing(true);
    setEditData({ ...profileData });
  };

  const handleCancel = () => {
    setEditing(false);
    setEditData({ ...profileData });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Validate required fields
      const errors = [];
      if (!editData.firstName?.trim()) errors.push('First name is required');
      if (!editData.lastName?.trim()) errors.push('Last name is required');
      if (!editData.bio?.trim()) errors.push('Bio is required');
      if (!editData.city?.trim()) errors.push('City is required');
      if (!editData.country?.trim()) errors.push('Country is required');
      
      if (errors.length > 0) {
        setSnackbar({
          open: true,
          message: `Please fix the following errors: ${errors.join(', ')}`,
          severity: 'error'
        });
        setSaving(false);
        return;
      }
      
      // Prepare data for backend
      const updateData = {
        firstName: editData.firstName,
        lastName: editData.lastName,
        bio: editData.bio,
        phone: editData.phone,
        age: editData.age,
        gender: editData.gender,
        languages: editData.languages,
        education: editData.education,
        occupation: editData.occupation,
        specializations: editData.specializations,
        serviceCategories: editData.serviceCategories,
        basePrice: editData.basePrice,
        availability: editData.availability,
        discretion: editData.discretion,
        profile_picture: profileData.profile_picture || editData.profile_picture, // Include profile picture
        location: {
          city: editData.city,
          country: editData.country
        }
      };

      const response = await fetch(`/api/users/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ profile_data: updateData })
      });

      if (response.ok) {
        const responseData = await response.json().catch(() => ({}));
        console.log('Profile update response:', responseData);
        
        // Merge the updated data with existing profile data
        const updatedProfile = { 
          ...profileData, 
          ...editData,
          // Update nested objects properly
          location: {
            city: editData.city,
            country: editData.country
          }
        };
        
        setProfileData(updatedProfile);
        setEditing(false);
        
        // Update auth context with proper action creator
        if (updateUser) {
          updateUser(updatedProfile);
        }
        
        setSnackbar({
          open: true,
          message: 'Profile updated successfully! Your changes have been saved.',
          severity: 'success'
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to update profile`);
      }
    } catch (error) {
      console.error('Profile update failed:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to update profile. Please try again.';
      
      if (error.message.includes('HTTP 401')) {
        errorMessage = 'Authentication failed. Please log in again.';
      } else if (error.message.includes('HTTP 403')) {
        errorMessage = 'Access denied. You may not have permission to update this profile.';
      } else if (error.message.includes('HTTP 404')) {
        errorMessage = 'Profile not found. Please refresh the page.';
      } else if (error.message.includes('HTTP 500')) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setEditData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePreferenceChange = (preference, value) => {
    setEditData(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [preference]: value
      }
    }));
  };

  const getTrustColor = (score) => {
    if (score >= 80) return colors.success;
    if (score >= 60) return colors.warning;
    return colors.error;
  };

  const getTierInfo = (tier) => {
    const tiers = {
      1: { name: 'Basic', color: '#808080', icon: '🥉', description: 'Basic verification level' },
      2: { name: 'Advanced', color: '#DC143C', icon: '🥈', description: 'Enhanced verification with ID check' },
      3: { name: 'Pro', color: '#8B0000', icon: '🥇', description: 'Professional verification with background check' },
      4: { name: 'Elite', color: '#000000', icon: '💎', description: 'Elite verification with full verification suite' }
    };
    return tiers[tier] || tiers[1];
  };

  const verificationSteps = [
    { 
      label: 'Email Verification', 
      completed: true, 
      icon: <Email color="success" />,
      description: 'Email address verified'
    },
    { 
      label: 'Phone Verification', 
      completed: !!profileData?.phone, 
      icon: <Phone color={profileData?.phone ? "success" : "disabled"} />,
      description: 'Phone number verified'
    },
    { 
      label: 'Identity Verification', 
      completed: (profileData?.verificationTier || 0) >= 2, 
      icon: <Person color={(profileData?.verificationTier || 0) >= 2 ? "success" : "disabled"} />,
      description: 'Government ID verified'
    },
    { 
      label: 'Background Check', 
      completed: (profileData?.verificationTier || 0) >= 3, 
      icon: <Shield color={(profileData?.verificationTier || 0) >= 3 ? "success" : "disabled"} />,
      description: 'Criminal background check completed'
    }
  ];

  if (loading) {
    return (
      <Container maxWidth="xl" sx={{ py: 12 }}>
        <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="60vh">
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading your profile...
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Please wait while we fetch your information
          </Typography>
        </Box>
      </Container>
    );
  }

  if (!profileData) {
    return (
      <Container maxWidth="xl" sx={{ py: 12 }}>
        <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="60vh">
          <Typography variant="h5" color="error" gutterBottom>
            Profile data not available
          </Typography>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            We're having trouble loading your profile. Please try again.
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => {
              console.log('🔍 Manual retry triggered');
              fetchUserProfile();
            }}
            sx={{ mt: 2 }}
          >
            Load Profile
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
      <AnimatePresence mode="wait">
        <motion.div key="header" {...fadeInUp}>
          <Box sx={{ mb: 4, textAlign: 'center' }}>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              My Profile 👤
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your account information and preferences
            </Typography>
          </Box>
        </motion.div>
      </AnimatePresence>

      <Grid container spacing={{ xs: 2, md: 4 }}>
          {/* Profile Overview Card */}
        <Grid item xs={12} md={4}>
            <motion.div key={`profile-overview-${profileData.id}`} {...fadeInUp}>
              <Card elevation={4} sx={{ height: '100%' }}>
              <CardContent sx={{ textAlign: 'center', py: 4 }}>
                <Box sx={{ position: 'relative', display: 'inline-block', mb: 3 }}>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      badgeContent={
                        <Tooltip title="Change Profile Picture">
                  <IconButton
                            size="small"
                            onClick={() => setPhotoDialog(true)}
                    sx={{
                      backgroundColor: 'white',
                      '&:hover': { backgroundColor: 'grey.100' }
                    }}
                  >
                    <PhotoCamera fontSize="small" />
                  </IconButton>
                        </Tooltip>
                      }
                    >
                      <Tooltip title="Click to change profile picture">
                        <Avatar
                          src={profileData.profile_picture?.url || profileData.profilePicture}
                          onClick={() => setPhotoDialog(true)}
                          sx={{
                            width: { xs: 80, md: 100 },
                            height: { xs: 80, md: 100 },
                            background: (profileData.profile_picture?.url || profileData.profilePicture) ? 'transparent' : gradients.redToBlack,
                            fontSize: { xs: '2rem', md: '2.5rem' },
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            '&:hover': {
                              opacity: 0.8,
                              transform: 'scale(1.05)',
                              transition: 'all 0.2s ease-in-out'
                            }
                          }}
                        >
                          {profileData.fullName[0]}
                        </Avatar>
                      </Tooltip>
                    </Badge>
                </Box>

                <Typography variant="h5" fontWeight="bold" gutterBottom>
                  {profileData.fullName}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  @{profileData.username}
                </Typography>

                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 3, flexWrap: 'wrap' }}>
                  <Chip
                    label={`${getTierInfo(profileData.verificationTier).icon} ${getTierInfo(profileData.verificationTier).name}`}
                    sx={{
                      backgroundColor: getTierInfo(profileData.verificationTier).color,
                      color: 'white',
                        fontWeight: 'bold',
                        fontSize: { xs: '0.7rem', md: '0.8rem' }
                    }}
                  />
                  <Chip
                    icon={<Verified />}
                    label="Verified"
                    color="primary"
                    variant="outlined"
                      size="small"
                  />
                </Box>

                  <Typography variant="body2" sx={{ mb: 3, px: 2 }}>
                  {profileData.bio}
                </Typography>

                <Divider sx={{ mb: 3 }} />

                <Grid container spacing={2} sx={{ textAlign: 'center' }}>
                  <Grid item xs={4}>
                    <Typography variant="h6" fontWeight="bold" color="primary.main">
                        {Math.round(Number(profileData.trustScore) || 0)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Trust Score
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="h6" fontWeight="bold" color="primary.main">
                      {profileData.completedServices}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Completed
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="h6" fontWeight="bold" color="primary.main">
                      ${profileData.totalEarnings}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Earned
                    </Typography>
                  </Grid>
                </Grid>

                  <Box sx={{ mt: 3 }}>
                    <Typography variant="caption" color="text.secondary">
                      Member since {profileData.memberSince}
                    </Typography>
                  </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

          {/* Profile Information Card */}
        <Grid item xs={12} md={8}>
            <motion.div key="profile-information" {...fadeInUp}>
            <Card elevation={4}>
              <CardHeader
                title="Profile Information"
                action={
                  !editing ? (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        startIcon={<Edit />}
                        onClick={handleEdit}
                        variant="outlined"
                          size={isMobile ? "small" : "medium"}
                      >
                        Edit Profile
                      </Button>
                      <Button
                        startIcon={<VideoCall />}
                        onClick={() => setVideoDialog(true)}
                        variant="outlined"
                          size={isMobile ? "small" : "medium"}
                      >
                        Manage Videos
                      </Button>
                    </Box>
                  ) : (
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Button
                        startIcon={<Cancel />}
                        onClick={handleCancel}
                        variant="outlined"
                          disabled={saving}
                          size={isMobile ? "small" : "medium"}
                      >
                        Cancel
                      </Button>
                      <Button
                          startIcon={saving ? <CircularProgress size={16} /> : <Save />}
                        onClick={handleSave}
                        variant="contained"
                          disabled={saving}
                          size={isMobile ? "small" : "medium"}
                      >
                          {saving ? 'Saving...' : 'Save'}
                      </Button>
                    </Box>
                  )
                }
              />
              <CardContent>
                {/* Debug Section */}
                <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                  <Typography variant="h6" color="primary">Debug Info</Typography>
                  <Typography variant="body2">First Name: "{profileData.firstName}"</Typography>
                  <Typography variant="body2">Last Name: "{profileData.lastName}"</Typography>
                  <Typography variant="body2">Phone: "{profileData.phone}"</Typography>
                  <Typography variant="body2">Age: {profileData.age}</Typography>
                  <Typography variant="body2">City: "{profileData.city}"</Typography>
                  <Typography variant="body2">Country: "{profileData.country}"</Typography>
                  <Typography variant="body2">Bio: "{profileData.bio}"</Typography>
                </Box>
                
                <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        key={`firstName-${profileData.firstName}`}
                        fullWidth
                        label="First Name"
                        value={editing ? editData.firstName : profileData.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        disabled={!editing || loading}
                        size={isMobile ? "small" : "medium"}
                        helperText={`Current value: "${profileData.firstName}"`}
                        error={loading && !profileData.firstName}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                    <TextField
                      key={`lastName-${profileData.lastName}`}
                      fullWidth
                        label="Last Name"
                        value={editing ? editData.lastName : profileData.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                      disabled={!editing || loading}
                        size={isMobile ? "small" : "medium"}
                        helperText={`Current value: "${profileData.lastName}"`}
                        error={loading && !profileData.lastName}
                    />
                  </Grid>
                  
                    <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Username"
                      value={editing ? editData.username : profileData.username}
                        disabled={true}
                        size={isMobile ? "small" : "medium"}
                      InputProps={{
                        startAdornment: '@'
                      }}
                    />
                  </Grid>

                    <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Email"
                      value={editing ? editData.email : profileData.email}
                        disabled={true}
                        size={isMobile ? "small" : "medium"}
                    />
                  </Grid>

                    <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Phone"
                      value={editing ? editData.phone : profileData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      disabled={!editing}
                        size={isMobile ? "small" : "medium"}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Age"
                        type="number"
                        value={editing ? editData.age : profileData.age}
                        onChange={(e) => handleInputChange('age', parseInt(e.target.value))}
                        disabled={!editing}
                        size={isMobile ? "small" : "medium"}
                        inputProps={{ min: 18, max: 100 }}
                    />
                  </Grid>

                    <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                        label="City"
                        value={editing ? editData.city : profileData.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                      disabled={!editing}
                        size={isMobile ? "small" : "medium"}
                        InputProps={{
                          startAdornment: <LocationOn fontSize="small" />
                        }}
                    />
                  </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Country"
                        value={editing ? editData.country : profileData.country}
                        onChange={(e) => handleInputChange('country', e.target.value)}
                        disabled={!editing}
                        size={isMobile ? "small" : "medium"}
                        select
                      >
                        <option value="Ghana">Ghana 🇬🇭</option>
                        <option value="Nigeria">Nigeria 🇳🇬</option>
                      </TextField>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Bio"
                      value={editing ? editData.bio : profileData.bio}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                      disabled={!editing}
                        multiline
                        rows={3}
                        size={isMobile ? "small" : "medium"}
                      helperText="Tell others about yourself and your expertise"
                    />
                  </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Education"
                        value={editing ? editData.education : profileData.education}
                        onChange={(e) => handleInputChange('education', e.target.value)}
                        disabled={!editing}
                        size={isMobile ? "small" : "medium"}
                        InputProps={{
                          startAdornment: <School fontSize="small" />
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Occupation"
                        value={editing ? editData.occupation : profileData.occupation}
                        onChange={(e) => handleInputChange('occupation', e.target.value)}
                        disabled={!editing}
                        size={isMobile ? "small" : "medium"}
                        InputProps={{
                          startAdornment: <Work fontSize="small" />
                        }}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Base Price ($)"
                        type="number"
                        value={editing ? editData.basePrice : profileData.basePrice}
                        onChange={(e) => handleInputChange('basePrice', parseFloat(e.target.value))}
                        disabled={!editing}
                        size={isMobile ? "small" : "medium"}
                        inputProps={{ min: 0, step: 10 }}
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Discretion Level"
                        value={editing ? editData.discretion : profileData.discretion}
                        onChange={(e) => handleInputChange('discretion', e.target.value)}
                        disabled={!editing}
                        size={isMobile ? "small" : "medium"}
                        select
                      >
                        <option value="Standard">Standard</option>
                        <option value="High">High</option>
                        <option value="Maximum">Maximum</option>
                      </TextField>
                    </Grid>
                </Grid>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

          {/* Trust & Verification Card */}
        <Grid item xs={12} md={6}>
            <motion.div key="trust-verification" {...fadeInUp}>
            <Card elevation={4}>
              <CardHeader
                title="Trust & Verification"
                avatar={<Security color="primary" />}
                  action={
                    <Button
                      startIcon={<Refresh />}
                      onClick={fetchUserProfile}
                      size="small"
                      variant="outlined"
                    >
                      Refresh
                    </Button>
                  }
              />
              <CardContent>
                <Box sx={{ mb: 3 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="body2" color="text.secondary">
                        Trust Score: {profileData.trustScore} {getTierInfo(profileData.verificationTier).name}
                      </Typography>
                      <Typography variant="body2" color="primary">
                        {profileData.trustScore}/100
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                      value={Math.min(Math.max(Number(profileData.trustScore) || 0, 0), 100)}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                        backgroundColor: 'grey.200',
                      '& .MuiLinearProgress-bar': {
                          backgroundColor: getTrustColor(Number(profileData.trustScore) || 0)
                      }
                    }}
                  />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {Math.max(100 - (Number(profileData.trustScore) || 0), 0)} points to next level
                  </Typography>
    </Box>

                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                    Verification Steps
                  </Typography>
                  
                  <Stepper orientation="vertical" sx={{ mt: 2 }}>
                    {verificationSteps.map((step, index) => (
                      <Step key={index} active={step.completed} completed={step.completed}>
                        <StepLabel
                          StepIconComponent={() => (
                            <Box sx={{ color: step.completed ? 'success.main' : 'grey.400' }}>
                              {step.icon}
                            </Box>
                          )}
                        >
                          <Typography variant="body2" fontWeight="medium">
                            {step.label}
                          </Typography>
                        </StepLabel>
                        <StepContent>
                          <Typography variant="caption" color="text.secondary">
                            {step.description}
                </Typography>
                        </StepContent>
                      </Step>
                    ))}
                  </Stepper>

                  <Box sx={{ mt: 3 }}>
                    <Button
                      variant="outlined"
                      startIcon={<Shield />}
                      onClick={() => setVerificationDialog(true)}
                      fullWidth
                      size="small"
                    >
                      Upgrade Verification
                    </Button>
                  </Box>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>

          {/* Account Settings Card */}
        <Grid item xs={12} md={6}>
            <motion.div key="account-settings" {...fadeInUp}>
            <Card elevation={4}>
              <CardHeader
                title="Account Settings"
                avatar={<Settings color="primary" />}
              />
              <CardContent>
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Notification Preferences
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={editing ? editData.preferences.emailNotifications : profileData.preferences.emailNotifications}
                      onChange={(e) => handlePreferenceChange('emailNotifications', e.target.checked)}
                      disabled={!editing}
                    />
                  }
                  label="Email Notifications"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={editing ? editData.preferences.smsNotifications : profileData.preferences.smsNotifications}
                      onChange={(e) => handlePreferenceChange('smsNotifications', e.target.checked)}
                      disabled={!editing}
                    />
                  }
                  label="SMS Notifications"
                />

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Privacy Settings
                </Typography>
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={editing ? editData.preferences.profileVisible : profileData.preferences.profileVisible}
                      onChange={(e) => handlePreferenceChange('profileVisible', e.target.checked)}
                      disabled={!editing}
                    />
                  }
                  label="Profile Visible to Others"
                />
                
                <FormControlLabel
                  control={
                    <Switch
                      checked={editing ? editData.preferences.showEarnings : profileData.preferences.showEarnings}
                      onChange={(e) => handlePreferenceChange('showEarnings', e.target.checked)}
                      disabled={!editing}
                    />
                  }
                  label="Show Earnings Publicly"
                />

                <Alert severity="info" sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    Higher verification levels unlock more features and increase trust with clients.
                  </Typography>
                </Alert>
              </CardContent>
            </Card>
          </motion.div>
        </Grid>
      </Grid>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Photo Upload Dialog */}
      <Dialog open={photoDialog} onClose={() => setPhotoDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Update Profile Picture</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            {!selectedFile ? (
              <>
                <input
                  accept="image/*"
                  style={{ display: 'none' }}
                  id="profile-picture-input"
                  type="file"
                  onChange={handleFileSelect}
                />
                <label htmlFor="profile-picture-input">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<PhotoCamera />}
                    sx={{ mb: 2 }}
                  >
                    Choose Image
                  </Button>
                </label>
                <Typography variant="body2" color="text.secondary">
                  Supported formats: JPEG, PNG, GIF, WebP (Max: 5MB)
                </Typography>
              </>
            ) : (
              <>
                <Box sx={{ mb: 2 }}>
                  <img
                    src={URL.createObjectURL(selectedFile)}
                    alt="Preview"
                    style={{
                      width: '150px',
                      height: '150px',
                      objectFit: 'cover',
                      borderRadius: '50%',
                      border: '2px solid #ddd'
                    }}
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Selected: {selectedFile.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </Typography>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setPhotoDialog(false);
            setSelectedFile(null);
          }}>
            Cancel
          </Button>
          {selectedFile && (
            <Button
              onClick={handleUploadPhoto}
              variant="contained"
              disabled={uploadingPhoto}
              startIcon={uploadingPhoto ? <CircularProgress size={16} /> : null}
            >
              {uploadingPhoto ? 'Uploading...' : 'Upload'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Verification Upgrade Dialog */}
      <Dialog open={verificationDialog} onClose={() => setVerificationDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Upgrade Verification Level</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Verification upgrade functionality will be implemented here.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerificationDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Video Management Section */}
      <Dialog open={videoDialog} onClose={() => setVideoDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Profile Video Management</DialogTitle>
        <DialogContent>
          <VideoSystem 
            mode="upload" 
            onVideoUpload={handleVideoUpload}
            initialVideo={profileData.videos || []}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVideoDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProfilePage;
