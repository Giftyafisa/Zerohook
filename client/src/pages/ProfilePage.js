import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  TextField,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Autocomplete,
  Paper,
  Switch,
  FormControlLabel,
  InputAdornment,
  Chip
} from '@mui/material';
import apiClient from '../services/apiClient';
import { resolveProfileImage } from '../utils/imageUtils';
import {
  Edit as EditIcon,
  PhotoCamera as CameraIcon,
  Verified as VerifiedIcon,
  LocationOn as LocationIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Star as StarIcon,
  Shield as ShieldIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  Help as HelpIcon,
  Security as SecurityIcon,
  WorkspacePremium as PremiumIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import authAPI from '../services/authAPI';

const ProfilePage = () => {
  const navigate = useNavigate();
  const currentLocation = useLocation();
  const { user, updateUser, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoDialog, setPhotoDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Countries, regions, and cities state
  const [countries, setCountries] = useState([]);
  const [regions, setRegions] = useState([]);
  const [cities, setCities] = useState([]);
  const [regionInputValue, setRegionInputValue] = useState('');
  const [cityInputValue, setCityInputValue] = useState('');
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [, setLocationLookupLoading] = useState(false);
  const [, setLocationSuggestion] = useState(null);
  
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    city: '',
    region: '',
    country: '',
    countryCode: '',
    age: 25,
    basePrice: '',
    priceCurrency: 'USD',
    profilePicture: null,
    trustScore: 0,
    verificationTier: 1,
    completedServices: 0,
    preferProfileLocation: false,
    profileVisibility: 'public'
  });
  const [editData, setEditData] = useState({});

  // Fetch supported countries on mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await apiClient.get('/countries');
        setCountries(response.data.countries || []);
      } catch (error) {
        console.error('Failed to fetch countries:', error);
      }
    };
    fetchCountries();
  }, []);

  // Fetch regions when country changes
  useEffect(() => {
    const fetchRegions = async () => {
      if (!editData.countryCode) {
        setRegions([]);
        return;
      }
      
      setLoadingRegions(true);
      try {
        const response = await apiClient.get(`/countries/${editData.countryCode}/regions`);
        setRegions(response.data.regions || []);
      } catch (error) {
        console.error('Failed to fetch regions:', error);
        setRegions([]);
      } finally {
        setLoadingRegions(false);
      }
    };
    
    fetchRegions();
  }, [editData.countryCode]);

  // Fetch cities when country changes - load all cities for the country
  useEffect(() => {
    const fetchCities = async () => {
      if (!editData.countryCode) {
        setCities([]);
        return;
      }
      
      setLoadingCities(true);
      try {
        // Fetch all cities for the country (search param filters on server side)
        const searchParam = cityInputValue ? `?search=${encodeURIComponent(cityInputValue)}` : '';
        const response = await apiClient.get(`/countries/${editData.countryCode}/cities${searchParam}`);
        setCities(response.data.cities || []);
      } catch (error) {
        console.error('Failed to fetch cities:', error);
        setCities([]);
      } finally {
        setLoadingCities(false);
      }
    };
    
    // Debounce search but load immediately on country change
    const debounceTimer = setTimeout(fetchCities, cityInputValue ? 300 : 0);
    return () => clearTimeout(debounceTimer);
  }, [editData.countryCode, cityInputValue]);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const response = await apiClient.get('/dashboard/stats');

      const data = {
        firstName: user.profile_data?.firstName || user.username || '',
        lastName: user.profile_data?.lastName || '',
        bio: user.profile_data?.bio || '',
        city: user.profile_data?.location?.city || '',
        region: user.profile_data?.location?.region || '',
        country: user.profile_data?.location?.country || '',
        countryCode: user.profile_data?.location?.countryCode || '',
        age: user.profile_data?.age || 25,
        basePrice: user.profile_data?.basePrice || '',
        priceCurrency: user.profile_data?.priceCurrency || 'USD',
        profilePicture: user.profile_data?.profile_picture?.url || user.profile_data?.profilePicture || null,
        trustScore: user.reputation_score || 75,
        verificationTier: user.verificationTier || user.verification_tier || 1,
        completedServices: user.profile_data?.completedServices || 0,
        preferProfileLocation: Boolean(user.profile_data?.location?.preferProfileLocation),
        profileVisibility: user.profile_visibility || user.profile_data?.profileVisibility || 'public'
      };

      if (response.status === 200) {
        const dashboardData = response.data;
        data.trustScore = dashboardData.user?.trustScore || data.trustScore;
        data.completedServices = dashboardData.stats?.completedTransactions || data.completedServices;
      }

      setProfileData(data);
      setEditData(data);
      setRegionInputValue(data.region || '');
      setCityInputValue(data.city || '');
    } catch (error) {
      console.error('Profile fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const resolveLocationCoordinates = async (city, country) => {
    if (!city) return null;
    setLocationLookupLoading(true);
    setLocationSuggestion(null);
    try {
      // Try to get coordinates from geolocation API if available
      const url = `/geolocation/lookup-city?city=${encodeURIComponent(city)}${country ? `&country=${encodeURIComponent(country)}` : ''}`;
      const response = await apiClient.get(url);
      setLocationSuggestion(response.data?.data || null);
      return response.data?.data || null;
    } catch (error) {
      console.warn('Location lookup failed, saving location without coordinates:', error);
      return null;
    } finally {
      setLocationLookupLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let resolvedLocation = null;
      if (editData.city) {
        // Try to get coordinates but don't fail if it doesn't work
        resolvedLocation = await resolveLocationCoordinates(editData.city, editData.country);
      }

      const response = await apiClient.put('/users/me', {
        profile_data: {
          firstName: editData.firstName,
          lastName: editData.lastName,
          bio: editData.bio,
          age: editData.age,
          basePrice: editData.basePrice,
          priceCurrency: editData.priceCurrency,
          location: {
            city: editData.city,
            region: editData.region,
            country: editData.country,
            countryCode: editData.countryCode,
            coordinates: resolvedLocation ? { lat: resolvedLocation.lat, lng: resolvedLocation.lng } : undefined,
            preferProfileLocation: Boolean(editData.preferProfileLocation)
          }
        },
        profile_visibility: editData.profileVisibility || 'public'
      });

      const result = response.data;
      setProfileData(editData);
      setEditing(false);
      setSnackbar({ open: true, message: 'Profile updated!', severity: 'success' });
      // Update user context if available
      if (updateUser && result.user) {
        updateUser(result.user);
      }
    } catch (error) {
      console.error('Profile update error:', error);
      setSnackbar({ open: true, message: error.message || 'Failed to update profile', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // Handle country selection
  const handleCountryChange = (countryCode) => {
    const selectedCountry = countries.find(c => c.code === countryCode);
    setEditData(prev => ({
      ...prev,
      countryCode: countryCode,
      country: selectedCountry?.name || '',
      region: '', // Reset region when country changes
      city: '' // Reset city when country changes
    }));
    setRegionInputValue('');
    setCityInputValue('');
    setRegions([]);
    setCities([]);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.size <= 5 * 1024 * 1024) {
      setSelectedFile(file);
    } else {
      setSnackbar({ open: true, message: 'File must be under 5MB', severity: 'error' });
    }
  };

  const handleOpenPhotoDialog = (event) => {
    if (event?.currentTarget && typeof event.currentTarget.blur === 'function') {
      event.currentTarget.blur();
    }
    setPhotoDialog(true);
  };

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [profileData.profilePicture]);

  const handleUploadPhoto = async () => {
    if (!selectedFile) return;
    setUploadingPhoto(true);
    try {
      const result = await authAPI.uploadProfilePicture(selectedFile);
      const uploadedUrl = result?.profilePicture?.url || result?.profilePicture || null;

      if (!uploadedUrl) {
        throw new Error('Upload response did not include an image URL');
      }

      setProfileData(prev => ({ ...prev, profilePicture: uploadedUrl }));
      setEditData(prev => ({ ...prev, profilePicture: uploadedUrl }));
      setAvatarLoadFailed(false);

      if (updateUser && user) {
        const currentProfileData = user.profile_data || user.profileData || {};
        const currentPictureObject =
          currentProfileData.profile_picture && typeof currentProfileData.profile_picture === 'object'
            ? currentProfileData.profile_picture
            : {};

        const nextProfileData = {
          ...currentProfileData,
          photos: [uploadedUrl],
          profilePicture: uploadedUrl,
          profile_picture: {
            ...currentPictureObject,
            url: uploadedUrl,
            storageType: result?.profilePicture?.storageType || currentPictureObject.storageType,
            publicId: result?.profilePicture?.publicId || currentPictureObject.publicId
          }
        };

        updateUser({
          profile_data: nextProfileData,
          profileData: nextProfileData
        });
      }

      setSnackbar({ open: true, message: 'Photo updated!', severity: 'success' });
      setPhotoDialog(false);
      setSelectedFile(null);
    } catch (error) {
      const debugId = error?.response?.data?.debugId || null;
      const serverMessage =
        error?.response?.data?.message
        || error?.response?.data?.error
        || error?.message
        || 'Upload failed';
      const debugSuffix = debugId ? ` (debugId: ${debugId})` : '';
      setSnackbar({ open: true, message: `${serverMessage}${debugSuffix}`, severity: 'error' });
    } finally {
      setUploadingPhoto(false);
    }
  };

  if (loading) {
    return (
      <Box sx={styles.loadingContainer}>
        <CircularProgress sx={{ color: '#00f2ea' }} />
      </Box>
    );
  }

  const fullName = `${profileData.firstName} ${profileData.lastName}`.trim() || user?.username || 'User';
  const currentAccountType =
    user?.profile_data?.accountType ||
    user?.profileData?.accountType ||
    user?.accountType ||
    user?.account_type ||
    'client';
  const location = profileData.country
    ? [profileData.country, profileData.region, profileData.city].filter(Boolean).join(', ')
    : 'Location not set';
  const profileImageSrc = !avatarLoadFailed ? (resolveProfileImage(profileData) || undefined) : undefined;

  return (
    <Box sx={styles.container}>
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Box sx={styles.profileCard}>
          {/* Avatar */}
          <Box sx={styles.avatarContainer}>
            <Avatar
              src={profileImageSrc}
              sx={styles.avatar}
              imgProps={{
                onError: () => setAvatarLoadFailed(true)
              }}
            >
              {fullName[0]?.toUpperCase()}
            </Avatar>
            <IconButton 
              sx={styles.cameraBtn} 
              onClick={handleOpenPhotoDialog}
              aria-label="Change profile photo"
              title="Change profile photo"
            >
              <CameraIcon />
            </IconButton>
          </Box>

          {/* Name & Info */}
          <Typography sx={styles.name}>{fullName}</Typography>
          <Box sx={styles.verifiedRow}>
            {profileData.verificationTier >= 2 && (
              <Box sx={styles.verifiedBadge}>
                <VerifiedIcon sx={{ fontSize: 14 }} />
                <span>Verified</span>
              </Box>
            )}
          </Box>
          <Box sx={styles.locationRow}>
            <LocationIcon sx={{ fontSize: 16 }} />
            <Typography sx={styles.locationText}>{location}</Typography>
          </Box>

          {/* Stats */}
          <Box sx={styles.statsRow}>
            <Box sx={styles.stat}>
              <Typography sx={styles.statValue}>{profileData.trustScore}%</Typography>
              <Typography sx={styles.statLabel}>Trust Score</Typography>
            </Box>
            <Box sx={styles.statDivider} />
            <Box sx={styles.stat}>
              <Typography sx={styles.statValue}>{profileData.completedServices}</Typography>
              <Typography sx={styles.statLabel}>Completed</Typography>
            </Box>
            <Box sx={styles.statDivider} />
            <Box sx={styles.stat}>
              <Typography sx={styles.statValue}>Tier {profileData.verificationTier}</Typography>
              <Typography sx={styles.statLabel}>Verification</Typography>
            </Box>
          </Box>

          {/* Subscription Status */}
          {(() => {
            const subscribed = user?.is_subscribed ?? user?.isSubscribed ?? false;
            const expiresAt = user?.subscription_expires_at ?? user?.subscriptionExpiresAt;
            const isActuallySubscribed = subscribed && (!expiresAt || new Date(expiresAt) > new Date());
            return isActuallySubscribed ? (
              <Chip
                icon={<PremiumIcon sx={{ color: '#ffd700 !important' }} />}
                label="Premium Member"
                sx={{
                  mt: 2,
                  bgcolor: 'rgba(255, 215, 0, 0.15)',
                  color: '#ffd700',
                  fontWeight: 600,
                  border: '1px solid rgba(255, 215, 0, 0.3)',
                  '& .MuiChip-icon': { color: '#ffd700' }
                }}
              />
            ) : (
              <Button
                variant="contained"
                startIcon={<PremiumIcon />}
                onClick={() => navigate('/subscription', {
                  state: {
                    from: {
                      pathname: currentLocation.pathname,
                      search: currentLocation.search,
                      hash: currentLocation.hash
                    }
                  }
                })}
                fullWidth
                sx={{
                  mt: 2,
                  py: 1.5,
                  background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
                  color: '#000',
                  fontWeight: 700,
                  borderRadius: '14px',
                  fontSize: '0.95rem',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #ffaa00, #ff8800)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 20px rgba(255, 215, 0, 0.4)'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                🌟 Upgrade to Premium
              </Button>
            );
          })()}
        </Box>
      </motion.div>

      {/* Bio Section */}
      <Typography sx={styles.sectionTitle}>About</Typography>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Box sx={styles.bioCard}>
          {editing ? (
            <TextField
              fullWidth
              multiline
              rows={3}
              value={editData.bio}
              onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
              placeholder="Write something about yourself..."
              sx={styles.textField}
            />
          ) : (
            <Typography sx={styles.bioText}>
              {profileData.bio || 'No bio set. Click edit to add one.'}
            </Typography>
          )}
        </Box>
      </motion.div>

      {/* Edit Form */}
      {editing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
        >
          <Typography sx={styles.sectionTitle}>Personal Info</Typography>
          <Box sx={styles.formCard}>
            <Box sx={styles.formRow}>
              <TextField
                label="First Name"
                value={editData.firstName}
                onChange={(e) => setEditData({ ...editData, firstName: e.target.value })}
                sx={styles.textField}
                fullWidth
              />
              <TextField
                label="Last Name"
                value={editData.lastName}
                onChange={(e) => setEditData({ ...editData, lastName: e.target.value })}
                sx={styles.textField}
                fullWidth
              />
            </Box>
            
            {/* Country Row */}
            <Box sx={styles.formRow}>
              {/* Country Dropdown */}
              <FormControl fullWidth sx={styles.selectField}>
                <InputLabel id="country-label" sx={{ color: 'rgba(255,255,255,0.5)' }}>Country</InputLabel>
                <Select
                  labelId="country-label"
                  value={editData.countryCode || ''}
                  label="Country"
                  onChange={(e) => handleCountryChange(e.target.value)}
                  sx={styles.select}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        bgcolor: '#1a1a2e',
                        border: '1px solid rgba(255,255,255,0.1)',
                        '& .MuiMenuItem-root': {
                          color: '#fff',
                          '&:hover': { bgcolor: 'rgba(0,242,234,0.1)' },
                          '&.Mui-selected': { bgcolor: 'rgba(0,242,234,0.2)' }
                        }
                      }
                    }
                  }}
                >
                  {countries.map((country) => (
                    <MenuItem key={country.code} value={country.code}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{country.flag}</span>
                        <span>{country.name}</span>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            
            {/* Region/State and City Row */}
            <Box sx={styles.formRow}>
              {/* Region/State Autocomplete */}
              <Autocomplete
                fullWidth
                freeSolo
                openOnFocus
                selectOnFocus
                handleHomeEndKeys
                options={regions}
                value={editData.region || ''}
                inputValue={regionInputValue}
                onInputChange={(event, newInputValue, reason) => {
                  setRegionInputValue(newInputValue);
                  if (reason === 'input' || reason === 'clear') {
                    setEditData({ ...editData, region: newInputValue || '' });
                  }
                }}
                onChange={(event, newValue) => {
                  const resolvedRegion = typeof newValue === 'string' ? newValue : (newValue || '');
                  setEditData({ ...editData, region: resolvedRegion });
                  setRegionInputValue(resolvedRegion || '');
                }}
                onBlur={() => {
                  if (regionInputValue && regionInputValue !== editData.region) {
                    setEditData(prev => ({ ...prev, region: regionInputValue }));
                  }
                }}
                loading={loadingRegions}
                disabled={!editData.countryCode}
                noOptionsText={editData.countryCode ? "Type to search or enter your region" : "Select country first"}
                PaperComponent={({ children }) => (
                  <Paper sx={{
                    bgcolor: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    maxHeight: '200px',
                    '& .MuiAutocomplete-option': {
                      color: '#fff',
                      padding: '10px 16px',
                      '&:hover': { bgcolor: 'rgba(0,242,234,0.1)' },
                      '&[aria-selected="true"]': { bgcolor: 'rgba(0,242,234,0.2)' }
                    },
                    '& .MuiAutocomplete-listbox': {
                      maxHeight: '200px',
                      padding: 0
                    }
                  }}>
                    {children}
                  </Paper>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Region/State"
                    placeholder={editData.countryCode ? "Tap to see regions or type your own..." : "Select country first"}
                    sx={styles.textField}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingRegions ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
              
              {/* City/Town/Village Autocomplete */}
              <Autocomplete
                fullWidth
                freeSolo
                openOnFocus
                selectOnFocus
                handleHomeEndKeys
                options={cities}
                value={editData.city || ''}
                inputValue={cityInputValue}
                onInputChange={(event, newInputValue, reason) => {
                  setCityInputValue(newInputValue);
                  setLocationSuggestion(null);
                  if (reason === 'input' || reason === 'clear') {
                    setEditData({ ...editData, city: newInputValue || '' });
                  }
                }}
                onChange={(event, newValue) => {
                  const resolvedCity = typeof newValue === 'string' ? newValue : (newValue || '');
                  setEditData({ ...editData, city: resolvedCity });
                  setCityInputValue(resolvedCity || '');
                }}
                onBlur={() => {
                  // Ensure the typed value is saved when user clicks away
                  if (cityInputValue && cityInputValue !== editData.city) {
                    setEditData(prev => ({ ...prev, city: cityInputValue }));
                  }
                }}
                loading={loadingCities}
                disabled={!editData.countryCode}
                noOptionsText={editData.countryCode ? "Type to search or enter your city" : "Select country first"}
                PaperComponent={({ children }) => (
                  <Paper sx={{
                    bgcolor: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    maxHeight: '200px',
                    '& .MuiAutocomplete-option': {
                      color: '#fff',
                      padding: '10px 16px',
                      '&:hover': { bgcolor: 'rgba(0,242,234,0.1)' },
                      '&[aria-selected="true"]': { bgcolor: 'rgba(0,242,234,0.2)' }
                    },
                    '& .MuiAutocomplete-listbox': {
                      maxHeight: '200px',
                      padding: 0
                    }
                  }}>
                    {children}
                  </Paper>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="City/Town/Village"
                    placeholder={editData.countryCode ? "Tap to see cities or type your own..." : "Select country first"}
                    sx={styles.textField}
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <>
                          {loadingCities ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(editData.preferProfileLocation)}
                    onChange={(e) => setEditData({ ...editData, preferProfileLocation: e.target.checked })}
                    color="primary"
                  />
                }
                label="Use this as my primary location"
                sx={{ color: '#fff' }}
              />
              <FormControl fullWidth sx={{ mt: 2, ...styles.textField }}>
                <InputLabel id="profile-visibility-label" sx={{ color: 'rgba(255,255,255,0.7)' }}>Profile Visibility</InputLabel>
                <Select
                  labelId="profile-visibility-label"
                  value={editData.profileVisibility || 'public'}
                  onChange={(e) => setEditData({ ...editData, profileVisibility: e.target.value })}
                  label="Profile Visibility"
                  sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' } }}
                >
                  <MenuItem value="public">Public - Visible to everyone</MenuItem>
                  <MenuItem value="authenticated">Members Only - Visible to logged-in users</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <TextField
              label="Age"
              type="number"
              value={editData.age}
              onChange={(e) => setEditData({ ...editData, age: parseInt(e.target.value) || 18 })}
              sx={styles.textField}
              inputProps={{ min: 18, max: 99 }}
            />
            
            {/* Base Price Settings */}
            <Box sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: 'rgba(0,242,234,0.05)', border: '1px solid rgba(0,242,234,0.2)' }}>
              <Typography sx={{ color: '#00f2ea', fontWeight: 600, mb: 2, fontSize: '0.95rem' }}>
                💰 Service Rate (Optional)
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <FormControl sx={{ minWidth: 120, ...styles.textField }}>
                  <InputLabel sx={{ color: 'rgba(255,255,255,0.7)' }}>Currency</InputLabel>
                  <Select
                    value={editData.priceCurrency || 'USD'}
                    onChange={(e) => setEditData({ ...editData, priceCurrency: e.target.value })}
                    label="Currency"
                    sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' } }}
                  >
                    <MenuItem value="USD">🇺🇸 $ USD</MenuItem>
                    <MenuItem value="NGN">🇳🇬 ₦ NGN</MenuItem>
                    <MenuItem value="GHS">🇬🇭 GH₵ GHS</MenuItem>
                    <MenuItem value="KES">🇰🇪 KSh KES</MenuItem>
                    <MenuItem value="ZAR">🇿🇦 R ZAR</MenuItem>
                    <MenuItem value="USD">🇺🇸 $ USD</MenuItem>
                    <MenuItem value="EUR">🇪🇺 € EUR</MenuItem>
                    <MenuItem value="GBP">🇬🇧 £ GBP</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Base Rate"
                  type="number"
                  value={editData.basePrice || ''}
                  onChange={(e) => setEditData({ ...editData, basePrice: e.target.value })}
                  sx={{ flex: 1, minWidth: 150, ...styles.textField }}
                  placeholder="e.g., 10000"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        {editData.priceCurrency === 'NGN' ? '₦' : 
                         editData.priceCurrency === 'GHS' ? 'GH₵' :
                         editData.priceCurrency === 'KES' ? 'KSh' :
                         editData.priceCurrency === 'ZAR' ? 'R' :
                         editData.priceCurrency === 'USD' ? '$' :
                         editData.priceCurrency === 'EUR' ? '€' :
                         editData.priceCurrency === 'GBP' ? '£' : '$'}
                      </InputAdornment>
                    ),
                  }}
                  helperText="Your starting service rate"
                />
              </Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', mt: 1 }}>
                This rate will be displayed on your public profile
              </Typography>
            </Box>
          </Box>
        </motion.div>
      )}

      {/* Quick Links */}
      <Typography sx={styles.sectionTitle}>Quick Links</Typography>
      <Box sx={styles.linksGrid}>
        <ButtonBase sx={styles.linkCard} onClick={() => navigate('/trust-score')} aria-label="View trust score">
          <ShieldIcon sx={{ color: '#00f2ea' }} />
          <Typography>Trust Score</Typography>
        </ButtonBase>
        <ButtonBase sx={styles.linkCard} onClick={() => navigate('/transactions')} aria-label="View wallet and transactions">
          <StarIcon sx={{ color: '#ffd700' }} />
          <Typography>Wallet</Typography>
        </ButtonBase>
        <ButtonBase sx={styles.linkCard} onClick={() => navigate('/verification')} aria-label="Get verified">
          <VerifiedIcon sx={{ color: '#00ff88' }} />
          <Typography>Verify</Typography>
        </ButtonBase>
        <ButtonBase sx={styles.linkCard} onClick={() => navigate('/settings')} aria-label="Open settings">
          <SettingsIcon sx={{ color: '#ff0055' }} />
          <Typography>Settings</Typography>
        </ButtonBase>
        {currentAccountType === 'provider' && (
          <ButtonBase sx={styles.linkCard} onClick={() => navigate('/clients-discovery')} aria-label="Discover clients">
            <LocationIcon sx={{ color: '#ffa94d' }} />
            <Typography>Discover Clients</Typography>
          </ButtonBase>
        )}
        <ButtonBase sx={styles.linkCard} onClick={() => navigate('/help')} aria-label="Open help and support">
          <HelpIcon sx={{ color: '#00f2ea' }} />
          <Typography>Help</Typography>
        </ButtonBase>
        <ButtonBase sx={styles.linkCard} onClick={() => navigate('/privacy-settings')} aria-label="Open privacy settings">
          <SecurityIcon sx={{ color: '#00f2ea' }} />
          <Typography>Privacy</Typography>
        </ButtonBase>
      </Box>

      {/* Action Buttons */}
      <Box sx={styles.actionButtons}>
        {editing ? (
          <>
            <Button
              variant="outlined"
              startIcon={<CancelIcon />}
              onClick={() => { setEditing(false); setEditData(profileData); }}
              sx={styles.cancelBtn}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              startIcon={<SaveIcon />}
              onClick={handleSave}
              disabled={saving}
              sx={styles.saveBtn}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </>
        ) : (
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => setEditing(true)}
            sx={styles.editBtn}
            fullWidth
          >
            Edit Profile
          </Button>
        )}
      </Box>

      {/* Logout Button */}
      <Button
        variant="outlined"
        startIcon={<LogoutIcon />}
        onClick={() => {
          logout();
            navigate('/login', { state: { from: { pathname: currentLocation.pathname, search: currentLocation.search, hash: currentLocation.hash } } });
        }}
        fullWidth
        sx={{
          mt: 2,
          mb: 4,
          py: 1.5,
          borderColor: '#ff4757',
          color: '#ff4757',
          borderRadius: '14px',
          fontWeight: 600,
          '&:hover': {
            borderColor: '#ff6b7a',
            bgcolor: 'rgba(255,71,87,0.1)'
          }
        }}
      >
        Logout
      </Button>

      {/* Photo Upload Dialog */}
      <Dialog open={photoDialog} onClose={() => setPhotoDialog(false)} PaperProps={{ sx: styles.dialog }}>
        <DialogTitle sx={{ color: '#fff' }}>Update Profile Photo</DialogTitle>
        <DialogContent>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            id="photo-upload"
          />
          <label htmlFor="photo-upload">
            <Box sx={styles.uploadArea}>
              {selectedFile ? (
                <Typography sx={{ color: '#00f2ea' }}>{selectedFile.name}</Typography>
              ) : (
                <Typography sx={{ color: 'rgba(255,255,255,0.5)' }}>Click to select image</Typography>
              )}
            </Box>
          </label>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setPhotoDialog(false); setSelectedFile(null); }} sx={{ color: '#fff' }}>
            Cancel
          </Button>
          <Button
            onClick={handleUploadPhoto}
            disabled={!selectedFile || uploadingPhoto}
            sx={styles.uploadBtn}
          >
            {uploadingPhoto ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'var(--bg-primary, #0f0f13)',
    padding: { xs: '12px', sm: '16px', md: '20px' },
    paddingBottom: '80px'
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-primary, #0f0f13)'
  },
  profileCard: {
    background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.1), rgba(255, 0, 85, 0.05))',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    padding: { xs: '20px 16px', sm: '28px 20px', md: '32px 24px' },
    textAlign: 'center',
    marginBottom: '16px'
  },
  avatarContainer: {
    position: 'relative',
    display: 'inline-block',
    marginBottom: '16px'
  },
  avatar: {
    width: 100,
    height: 100,
    border: '3px solid #00f2ea',
    fontSize: '36px',
    background: 'linear-gradient(135deg, #00f2ea, #ff0055)'
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    background: '#00f2ea',
    color: '#000',
    width: 32,
    height: 32,
    '&:hover': { background: '#00d4ce' }
  },
  name: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '8px'
  },
  verifiedRow: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '8px'
  },
  verifiedBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 12px',
    background: 'rgba(0, 242, 234, 0.15)',
    borderRadius: '12px',
    fontSize: '13px',
    color: '#00f2ea',
    fontWeight: 500
  },
  locationRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    marginBottom: '20px'
  },
  locationText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px'
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '20px'
  },
  stat: {
    textAlign: 'center'
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#00f2ea'
  },
  statLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)'
  },
  statDivider: {
    width: '1px',
    height: '30px',
    background: 'rgba(255,255,255,0.1)'
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '12px'
  },
  bioCard: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '24px'
  },
  bioText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '14px',
    lineHeight: 1.6
  },
  formCard: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '16px',
    marginBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  formRow: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    '@media (max-width: 600px)': {
      flexDirection: 'column'
    }
  },
  textField: {
    '& .MuiOutlinedInput-root': {
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '12px',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&.Mui-focused fieldset': { borderColor: '#00f2ea' }
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
    '& .MuiInputBase-input': { color: '#fff' }
  },
  selectField: {
    '& .MuiOutlinedInput-root': {
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '12px',
      '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
      '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
      '&.Mui-focused fieldset': { borderColor: '#00f2ea' }
    },
    '& .MuiInputLabel-root': { color: 'rgba(255,255,255,0.5)' },
    '& .MuiSelect-select': { color: '#fff' },
    '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.5)' }
  },
  select: {
    color: '#fff',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.1)' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#00f2ea' }
  },
  linksGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '24px'
  },
  linkCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    '&:hover': {
      background: 'rgba(255,255,255,0.1)'
    },
    '& p': {
      color: '#fff',
      fontSize: '14px',
      fontWeight: 500
    }
  },
  actionButtons: {
    display: 'flex',
    gap: '12px'
  },
  editBtn: {
    background: 'linear-gradient(135deg, #00f2ea, #00c2bb)',
    color: '#000',
    borderRadius: '14px',
    padding: '14px',
    fontWeight: 600,
    '&:hover': {
      background: 'linear-gradient(135deg, #00d4ce, #00a8a3)'
    }
  },
  saveBtn: {
    flex: 1,
    background: 'linear-gradient(135deg, #00f2ea, #00c2bb)',
    color: '#000',
    borderRadius: '14px',
    fontWeight: 600
  },
  cancelBtn: {
    flex: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
    borderRadius: '14px'
  },
  dialog: {
    background: 'var(--bg-secondary, #1a1a22)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px'
  },
  uploadArea: {
    border: '2px dashed rgba(255,255,255,0.2)',
    borderRadius: '12px',
    padding: '40px 20px',
    textAlign: 'center',
    cursor: 'pointer',
    '&:hover': {
      borderColor: '#00f2ea'
    }
  },
  uploadBtn: {
    background: '#00f2ea',
    color: '#000',
    '&:hover': { background: '#00d4ce' },
    '&:disabled': { background: 'rgba(0,242,234,0.3)' }
  }
};

export default ProfilePage;
