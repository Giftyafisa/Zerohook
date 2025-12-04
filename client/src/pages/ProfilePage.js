import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Avatar,
  IconButton,
  TextField,
  Button,
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
  Paper
} from '@mui/material';
import { API_BASE_URL, getUploadUrl } from '../config/constants';
import {
  Edit as EditIcon,
  PhotoCamera as CameraIcon,
  Verified as VerifiedIcon,
  LocationOn as LocationIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Star as StarIcon,
  Shield as ShieldIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import authAPI from '../services/authAPI';

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoDialog, setPhotoDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Countries and cities state
  const [countries, setCountries] = useState([]);
  const [cities, setCities] = useState([]);
  const [cityInputValue, setCityInputValue] = useState('');
  const [loadingCities, setLoadingCities] = useState(false);
  
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    city: '',
    country: '',
    countryCode: '',
    age: 25,
    profilePicture: null,
    trustScore: 0,
    verificationTier: 1,
    completedServices: 0
  });
  const [editData, setEditData] = useState({});

  // Fetch supported countries on mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/countries`);
        if (response.ok) {
          const data = await response.json();
          setCountries(data.countries || []);
        }
      } catch (error) {
        console.error('Failed to fetch countries:', error);
      }
    };
    fetchCountries();
  }, []);

  // Fetch cities when country changes
  useEffect(() => {
    const fetchCities = async () => {
      if (!editData.countryCode) {
        setCities([]);
        return;
      }
      
      setLoadingCities(true);
      try {
        const response = await fetch(`${API_BASE_URL}/countries/${editData.countryCode}/cities?search=${cityInputValue}`);
        if (response.ok) {
          const data = await response.json();
          setCities(data.cities || []);
        }
      } catch (error) {
        console.error('Failed to fetch cities:', error);
      } finally {
        setLoadingCities(false);
      }
    };
    
    const debounceTimer = setTimeout(fetchCities, 300);
    return () => clearTimeout(debounceTimer);
  }, [editData.countryCode, cityInputValue]);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = {
        firstName: user.profile_data?.firstName || user.username || '',
        lastName: user.profile_data?.lastName || '',
        bio: user.profile_data?.bio || '',
        city: user.profile_data?.location?.city || '',
        country: user.profile_data?.location?.country || '',
        countryCode: user.profile_data?.location?.countryCode || '',
        age: user.profile_data?.age || 25,
        profilePicture: user.profile_data?.profile_picture?.url || user.profile_data?.profilePicture || null,
        trustScore: user.reputation_score || 75,
        verificationTier: user.verification_tier || 1,
        completedServices: user.profile_data?.completedServices || 0
      };

      if (response.ok) {
        const dashboardData = await response.json();
        data.trustScore = dashboardData.trustScore || data.trustScore;
        data.completedServices = dashboardData.stats?.completedTransactions || data.completedServices;
      }

      setProfileData(data);
      setEditData(data);
      setCityInputValue(data.city);
    } catch (error) {
      console.error('Profile fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          profile_data: {
            firstName: editData.firstName,
            lastName: editData.lastName,
            bio: editData.bio,
            age: editData.age,
            location: {
              city: editData.city,
              country: editData.country,
              countryCode: editData.countryCode
            }
          }
        })
      });

      if (response.ok) {
        const result = await response.json();
        setProfileData(editData);
        setEditing(false);
        setSnackbar({ open: true, message: 'Profile updated!', severity: 'success' });
        // Update user context if available
        if (updateUser && result.user) {
          updateUser(result.user);
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Update failed');
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
      city: '' // Reset city when country changes
    }));
    setCityInputValue('');
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

  const handleUploadPhoto = async () => {
    if (!selectedFile) return;
    setUploadingPhoto(true);
    try {
      const result = await authAPI.uploadProfilePicture(selectedFile);
      setProfileData(prev => ({ ...prev, profilePicture: result.profilePicture?.url || result.profilePicture }));
      setSnackbar({ open: true, message: 'Photo updated!', severity: 'success' });
      setPhotoDialog(false);
      setSelectedFile(null);
    } catch (error) {
      setSnackbar({ open: true, message: 'Upload failed', severity: 'error' });
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
  const location = profileData.city && profileData.country 
    ? `${profileData.city}, ${profileData.country}` 
    : 'Location not set';

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
              src={getUploadUrl(profileData.profilePicture)}
              sx={styles.avatar}
            >
              {fullName[0]?.toUpperCase()}
            </Avatar>
            <IconButton sx={styles.cameraBtn} onClick={() => setPhotoDialog(true)}>
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
              
              {/* City Autocomplete */}
              <Autocomplete
                fullWidth
                freeSolo
                options={cities}
                value={editData.city || ''}
                inputValue={cityInputValue}
                onInputChange={(event, newInputValue) => {
                  setCityInputValue(newInputValue);
                }}
                onChange={(event, newValue) => {
                  setEditData({ ...editData, city: newValue || '' });
                }}
                loading={loadingCities}
                disabled={!editData.countryCode}
                PaperComponent={({ children }) => (
                  <Paper sx={{
                    bgcolor: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    '& .MuiAutocomplete-option': {
                      color: '#fff',
                      '&:hover': { bgcolor: 'rgba(0,242,234,0.1)' },
                      '&[aria-selected="true"]': { bgcolor: 'rgba(0,242,234,0.2)' }
                    }
                  }}>
                    {children}
                  </Paper>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="City"
                    placeholder={editData.countryCode ? "Start typing your city..." : "Select country first"}
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
            <TextField
              label="Age"
              type="number"
              value={editData.age}
              onChange={(e) => setEditData({ ...editData, age: parseInt(e.target.value) || 18 })}
              sx={styles.textField}
              inputProps={{ min: 18, max: 99 }}
            />
          </Box>
        </motion.div>
      )}

      {/* Quick Links */}
      <Typography sx={styles.sectionTitle}>Quick Links</Typography>
      <Box sx={styles.linksGrid}>
        <Box sx={styles.linkCard} onClick={() => navigate('/trust')}>
          <ShieldIcon sx={{ color: '#00f2ea' }} />
          <Typography>Trust Score</Typography>
        </Box>
        <Box sx={styles.linkCard} onClick={() => navigate('/transactions')}>
          <StarIcon sx={{ color: '#ffd700' }} />
          <Typography>Wallet</Typography>
        </Box>
        <Box sx={styles.linkCard} onClick={() => navigate('/verification')}>
          <VerifiedIcon sx={{ color: '#00ff88' }} />
          <Typography>Verify</Typography>
        </Box>
        <Box sx={styles.linkCard}>
          <SettingsIcon sx={{ color: '#ff0055' }} />
          <Typography>Settings</Typography>
        </Box>
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
  profileCard: {
    background: 'linear-gradient(135deg, rgba(0, 242, 234, 0.1), rgba(255, 0, 85, 0.05))',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '24px',
    padding: '32px 24px',
    textAlign: 'center',
    marginBottom: '24px'
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
    gap: '12px'
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
