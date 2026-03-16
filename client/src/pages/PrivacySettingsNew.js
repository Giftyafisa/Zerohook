/**
 * PrivacySettings - Modern Settings Page
 * TikTok-inspired clean design with collapsible sections
 * Zerohook Platform
 * 
 * NOW WITH BACKEND PERSISTENCE - settings are loaded on mount and saved to server
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Switch,
  IconButton,
  Collapse,
  TextField,
  Select,
  MenuItem,
  FormControl,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import {
  ArrowBack,
  ChevronRight,
  Lock,
  Visibility,
  LocationOn,
  Chat,
  PhotoCamera,
  Notifications,
  Security,
  AttachMoney,
  Delete,
  Download,
  Shield,
  CheckCircle,
  ExpandMore,
  ExpandLess
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { API_BASE_URL } from '../config/constants';
import apiClient from '../services/apiClient';
import { isSugarAccount, getAccountType } from '../utils/accountTypeUtils';

// Modern TikTok-style design system
const styles = {
  container: {
    minHeight: '100vh',
    background: '#0f0f13',
    pb: 10,
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    background: 'rgba(15, 15, 19, 0.95)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    px: { xs: 1.25, sm: 2 },
    py: { xs: 1.25, sm: 1.5 },
  },
  headerContent: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    maxWidth: '600px',
    mx: 'auto',
  },
  title: {
    fontFamily: '"Outfit", sans-serif',
    fontWeight: 700,
    fontSize: { xs: '18px', sm: '20px' },
    color: '#fff',
  },
  content: {
    maxWidth: '600px',
    mx: 'auto',
    px: { xs: 1.25, sm: 2 },
    py: { xs: 2, sm: 3 },
  },
  section: {
    mb: 1,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    p: { xs: 1.25, sm: 2 },
    borderRadius: { xs: '14px', sm: '16px' },
    minHeight: 52,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.03)',
    },
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
  },
  sectionIcon: {
    width: { xs: 36, sm: 40 },
    height: { xs: 36, sm: 40 },
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionContent: {
    px: { xs: 1.25, sm: 2 },
    pb: { xs: 1.5, sm: 2 },
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    py: { xs: 1.25, sm: 1.5 },
    px: { xs: 1.25, sm: 2 },
    minHeight: 52,
    borderRadius: '12px',
    transition: 'all 0.2s ease',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.02)',
    },
  },
  switch: {
    '& .MuiSwitch-switchBase.Mui-checked': {
      color: '#00f2ea',
    },
    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
      backgroundColor: '#00f2ea',
    },
  },
  divider: {
    height: '1px',
    background: 'rgba(255, 255, 255, 0.06)',
    mx: { xs: 1.25, sm: 2 },
  },
  dangerSection: {
    mt: 4,
    p: { xs: 2, sm: 3 },
    borderRadius: '16px',
    border: '1px solid rgba(255, 0, 85, 0.2)',
    background: 'rgba(255, 0, 85, 0.05)',
  },
  saveButton: {
    position: 'fixed',
    bottom: { xs: 'calc(84px + env(safe-area-inset-bottom, 0px))', sm: 100 },
    left: { xs: 12, sm: '50%' },
    right: { xs: 12, sm: 'auto' },
    transform: { xs: 'none', sm: 'translateX(-50%)' },
    width: { xs: 'auto', sm: 'auto' },
    background: 'linear-gradient(135deg, #00f2ea, #00c2bb)',
    color: '#0f0f13',
    fontWeight: 700,
    fontFamily: '"Outfit", sans-serif',
    px: { xs: 2.5, sm: 6 },
    py: { xs: 1.6, sm: 1.5 },
    minHeight: 48,
    borderRadius: '30px',
    textTransform: 'none',
    boxShadow: '0 4px 20px rgba(0, 242, 234, 0.3)',
    '&:hover': {
      background: 'linear-gradient(135deg, #00f2ea, #00c2bb)',
      transform: { xs: 'translateY(-2px)', sm: 'translateX(-50%) translateY(-2px)' },
      boxShadow: '0 6px 25px rgba(0, 242, 234, 0.4)',
    },
  },
};

// Section configurations
const sections = [
  {
    id: 'privacy',
    title: 'Privacy Level',
    subtitle: 'Control who can see your profile',
    icon: <Lock />,
    color: '#00f2ea',
  },
  {
    id: 'visibility',
    title: 'Profile Visibility',
    subtitle: 'Manage visible information',
    icon: <Visibility />,
    color: '#ff0055',
  },
  {
    id: 'pricing',
    title: 'Pricing Display',
    subtitle: 'Set your service rates',
    icon: <AttachMoney />,
    color: '#00ff88',
  },
  {
    id: 'location',
    title: 'Location Settings',
    subtitle: 'Control location sharing',
    icon: <LocationOn />,
    color: '#ffd700',
  },
  {
    id: 'communication',
    title: 'Communication',
    subtitle: 'Manage contact preferences',
    icon: <Chat />,
    color: '#9c27b0',
  },
  {
    id: 'photos',
    title: 'Photo Privacy',
    subtitle: 'Control photo sharing',
    icon: <PhotoCamera />,
    color: '#ff6b35',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    subtitle: 'Manage alerts and updates',
    icon: <Notifications />,
    color: '#00bcd4',
  },
  {
    id: 'security',
    title: 'Security',
    subtitle: 'Account protection settings',
    icon: <Security />,
    color: '#4caf50',
  },
];

const privacyLevels = [
  { value: 'minimal', label: 'Minimal', desc: 'Only username visible' },
  { value: 'standard', label: 'Standard', desc: 'Basic info visible' },
  { value: 'enhanced', label: 'Enhanced', desc: 'Full profile visible' },
  { value: 'premium', label: 'Premium', desc: 'Maximum visibility' },
];

const PrivacySettings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token, user } = useSelector((state) => state.auth);
  const [expandedSection, setExpandedSection] = useState('privacy');
  const [hasChanges, setHasChanges] = useState(false);
  const [showSaveSnackbar, setShowSaveSnackbar] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  
  // Default settings - will be overwritten by backend data
  const defaultSettings = {
    // Privacy Level
    privacyLevel: 'standard',
    
    // Profile Visibility
    showPhotos: true,
    showAge: true,
    showLocation: true,
    showContactInfo: false,
    showVerificationStatus: true,
    showTrustScore: true,
    showReviews: true,
    
    // Sugar Account Visibility (for sugar_daddy/sugar_mommy only)
    sugarVisibility: 'hidden', // 'hidden' or 'visible'
    
    // Pricing
    showPriceOnProfile: true,
    basePrice: '',
    priceCurrency: 'USD',
    
    // Location
    locationPrecision: 'city',
    showTravelHistory: false,
    allowLocationServices: true,
    
    // Communication
    allowDirectMessages: true,
    allowPhoneCalls: false,
    allowWhatsApp: false,
    allowEmail: true,
    
    // Photos
    showFaceInPhotos: false,
    allowPhotoDownload: false,
    allowPhotoSharing: false,
    
    // Notifications
    pushNotifications: true,
    emailNotifications: true,
    messageNotifications: true,
    marketingEmails: false,
    
    // Security
    twoFactorAuth: false,
    loginAlerts: true,
    sessionTimeout: true,
  };

  const [settings, setSettings] = useState(defaultSettings);

  // Load settings from backend on mount
  const loadSettings = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setLoadError(null);
      
      const response = await apiClient.get('/users/me');

      const data = response.data;
      const profileData = data.user?.profile_data || {};
      const userSettings = profileData.settings || {};

      // Merge backend settings with defaults (backend takes precedence)
      setSettings(prev => ({
        ...prev,
        ...userSettings,
        // Also pull in specific profile fields that might be stored separately
        basePrice: profileData.basePrice || prev.basePrice,
        priceCurrency: profileData.currency || prev.priceCurrency,
      }));

    } catch (error) {
      console.error('Error loading settings:', error);
      setLoadError('Failed to load your settings. Using defaults.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Accept focus intent from other pages (e.g. profile completion reminders).
  useEffect(() => {
    const focusSection = location.state?.focusSection;
    const focusVerification = location.state?.focusVerification;
    if (focusSection) {
      setExpandedSection(focusSection);
    } else if (focusVerification) {
      setExpandedSection('security');
    }
  }, [location.state]);
  
  const handleToggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    setHasChanges(true);
  };
  
  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };
  
  const toggleSection = (sectionId) => {
    setExpandedSection(expandedSection === sectionId ? null : sectionId);
  };
  
  const handleSave = async () => {
    if (!token) {
      setSaveError('You must be logged in to save settings');
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);

      const response = await apiClient.put('/users/me', {
        profile_data: {
          settings: settings,
          basePrice: settings.basePrice,
          currency: settings.priceCurrency,
        }
      });

      setHasChanges(false);
      setShowSaveSnackbar(true);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveError(error.message || 'Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Setting row component
  const SettingRow = ({ label, description, checked, onChange, children }) => (
    <Box sx={styles.settingRow}>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ color: '#fff', fontSize: { xs: '14px', sm: '15px' }, fontWeight: 500, pr: 1 }}>
          {label}
        </Typography>
        {description && (
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: { xs: '12px', sm: '13px' }, mt: 0.3, pr: 1 }}>
            {description}
          </Typography>
        )}
      </Box>
      {children || (
        <Switch
          checked={checked}
          onChange={onChange}
          sx={{ ...styles.switch, mr: -0.5 }}
        />
      )}
    </Box>
  );
  
  // Section component
  const Section = ({ section, children }) => {
    const isExpanded = expandedSection === section.id;
    
    return (
      <Box sx={styles.section}>
        <Box 
          sx={styles.sectionHeader}
          onClick={() => toggleSection(section.id)}
        >
          <Box sx={styles.sectionTitle}>
            <Box sx={{ ...styles.sectionIcon, background: `${section.color}15` }}>
              <Box sx={{ color: section.color }}>{section.icon}</Box>
            </Box>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 600, fontSize: { xs: '15px', sm: '16px' } }}>
                {section.title}
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: { xs: '12px', sm: '13px' } }}>
                {section.subtitle}
              </Typography>
            </Box>
          </Box>
          <IconButton
            size="small"
            sx={{ color: 'rgba(255,255,255,0.5)', width: 36, height: 36 }}
            aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
          >
            {isExpanded ? <ExpandLess /> : <ExpandMore />}
          </IconButton>
        </Box>
        
        <Collapse in={isExpanded}>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <Box sx={styles.sectionContent}>
              {children}
            </Box>
          </motion.div>
        </Collapse>
      </Box>
    );
  };
  
  return (
    <Box sx={styles.container}>
      {/* Header */}
      <Box sx={styles.header}>
        <Box sx={styles.headerContent}>
          <IconButton onClick={() => navigate(-1)} sx={{ color: '#fff', width: 44, height: 44 }} aria-label="Go back">
            <ArrowBack />
          </IconButton>
          <Typography sx={styles.title}>Settings</Typography>
        </Box>
      </Box>
      
      {/* Content */}
      <Box sx={styles.content}>
        
        {/* Loading State */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
            <CircularProgress sx={{ color: '#00f2ea' }} />
          </Box>
        )}

        {/* Error Alert */}
        {loadError && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>
            {loadError}
          </Alert>
        )}

        {saveError && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
            {saveError}
          </Alert>
        )}

        {/* Settings Content - only show when not loading */}
        {!isLoading && (
          <>
        {/* Privacy Level Section */}
        <Section section={sections[0]}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {privacyLevels.map((level) => (
              <Box
                key={level.value}
                onClick={() => handleChange('privacyLevel', level.value)}
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  minHeight: 56,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  border: settings.privacyLevel === level.value 
                    ? '2px solid #00f2ea' 
                    : '2px solid rgba(255,255,255,0.1)',
                  background: settings.privacyLevel === level.value 
                    ? 'rgba(0, 242, 234, 0.08)' 
                    : 'transparent',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    background: 'rgba(255,255,255,0.03)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 600 }}>{level.label}</Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>
                      {level.desc}
                    </Typography>
                  </Box>
                  {settings.privacyLevel === level.value && (
                    <CheckCircle sx={{ color: '#00f2ea' }} />
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        </Section>
        
        <Box sx={styles.divider} />
        
        {/* Profile Visibility Section */}
        <Section section={sections[1]}>
          <SettingRow 
            label="Show Photos" 
            description="Display your photos on profile"
            checked={settings.showPhotos}
            onChange={() => handleToggle('showPhotos')}
          />
          <SettingRow 
            label="Show Age"
            checked={settings.showAge}
            onChange={() => handleToggle('showAge')}
          />
          <SettingRow 
            label="Show Location"
            checked={settings.showLocation}
            onChange={() => handleToggle('showLocation')}
          />
          <SettingRow 
            label="Show Contact Info"
            checked={settings.showContactInfo}
            onChange={() => handleToggle('showContactInfo')}
          />
          <SettingRow 
            label="Show Verification Badge"
            checked={settings.showVerificationStatus}
            onChange={() => handleToggle('showVerificationStatus')}
          />
          <SettingRow 
            label="Show Trust Score"
            checked={settings.showTrustScore}
            onChange={() => handleToggle('showTrustScore')}
          />
          
          {/* Sugar Account Visibility - Only shown for sugar_daddy/sugar_mommy accounts */}
          {isSugarAccount(user) && (
            <Box sx={{ 
              mt: 2, 
              p: 2, 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, rgba(255, 215, 0, 0.1) 0%, rgba(255, 105, 180, 0.1) 100%)',
              border: '1px solid rgba(255, 215, 0, 0.3)'
            }}>
              <Typography sx={{ 
                color: '#ffd700', 
                fontWeight: 600, 
                fontSize: '14px',
                mb: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <Shield sx={{ fontSize: 18 }} />
                Sugar Profile Visibility
              </Typography>
              <Typography sx={{ 
                color: 'rgba(255,255,255,0.6)', 
                fontSize: '12px',
                mb: 2
              }}>
                Control whether providers with paid access can see your profile.
                Your profile is hidden by default for maximum privacy.
              </Typography>
              <SettingRow 
                label="Allow Profile Discovery"
                description={settings.sugarVisibility === 'visible' 
                  ? "Providers with paid sugar access can see your profile"
                  : "Your profile is completely hidden from providers"}
                checked={settings.sugarVisibility === 'visible'}
                onChange={() => handleChange('sugarVisibility', 
                  settings.sugarVisibility === 'visible' ? 'hidden' : 'visible'
                )}
              />
            </Box>
          )}
        </Section>
        
        <Box sx={styles.divider} />
        
        {/* Pricing Section */}
        <Section section={sections[2]}>
          <SettingRow 
            label="Show Price on Profile"
            description="Display your base rate publicly"
            checked={settings.showPriceOnProfile}
            onChange={() => handleToggle('showPriceOnProfile')}
          />
          <Box sx={{ px: 2, py: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: { xs: 104, sm: 120 } }}>
                <Select
                  value={settings.priceCurrency}
                  onChange={(e) => handleChange('priceCurrency', e.target.value)}
                  sx={{
                    color: '#fff',
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                    '& .MuiSvgIcon-root': { color: '#fff' },
                  }}
                >
                  <MenuItem value="USD">🇺🇸 USD</MenuItem>
                  <MenuItem value="NGN">🇳🇬 NGN</MenuItem>
                  <MenuItem value="GHS">🇬🇭 GHS</MenuItem>
                  <MenuItem value="KES">🇰🇪 KES</MenuItem>
                  <MenuItem value="ZAR">🇿🇦 ZAR</MenuItem>
                </Select>
              </FormControl>
              <TextField
                size="small"
                placeholder="Base Rate"
                type="number"
                value={settings.basePrice}
                onChange={(e) => handleChange('basePrice', e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                      {settings.priceCurrency === 'NGN' ? '₦' : 
                       settings.priceCurrency === 'GHS' ? 'GH₵' :
                       settings.priceCurrency === 'KES' ? 'KSh' :
                       settings.priceCurrency === 'ZAR' ? 'R' : '$'}
                    </InputAdornment>
                  ),
                }}
                sx={{
                  flex: 1,
                  minWidth: { xs: 132, sm: 150 },
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  },
                }}
              />
            </Box>
          </Box>
        </Section>
        
        <Box sx={styles.divider} />
        
        {/* Location Section */}
        <Section section={sections[3]}>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', mb: 1 }}>
              Location Precision
            </Typography>
            <FormControl fullWidth size="small">
              <Select
                value={settings.locationPrecision}
                onChange={(e) => handleChange('locationPrecision', e.target.value)}
                sx={{
                  color: '#fff',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  '& .MuiSvgIcon-root': { color: '#fff' },
                }}
              >
                <MenuItem value="exact">Exact Location</MenuItem>
                <MenuItem value="neighborhood">Neighborhood</MenuItem>
                <MenuItem value="city">City Only</MenuItem>
                <MenuItem value="region">Region Only</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <SettingRow 
            label="Show Travel History"
            checked={settings.showTravelHistory}
            onChange={() => handleToggle('showTravelHistory')}
          />
          <SettingRow 
            label="Location-Based Services"
            description="Allow location for better matching"
            checked={settings.allowLocationServices}
            onChange={() => handleToggle('allowLocationServices')}
          />
        </Section>
        
        <Box sx={styles.divider} />
        
        {/* Communication Section */}
        <Section section={sections[4]}>
          <SettingRow 
            label="Direct Messages"
            checked={settings.allowDirectMessages}
            onChange={() => handleToggle('allowDirectMessages')}
          />
          <SettingRow 
            label="Phone Calls"
            checked={settings.allowPhoneCalls}
            onChange={() => handleToggle('allowPhoneCalls')}
          />
          <SettingRow 
            label="WhatsApp"
            checked={settings.allowWhatsApp}
            onChange={() => handleToggle('allowWhatsApp')}
          />
          <SettingRow 
            label="Email Contact"
            checked={settings.allowEmail}
            onChange={() => handleToggle('allowEmail')}
          />
        </Section>
        
        <Box sx={styles.divider} />
        
        {/* Photo Privacy Section */}
        <Section section={sections[5]}>
          <SettingRow 
            label="Show Face in Photos"
            description="Allow face to be visible"
            checked={settings.showFaceInPhotos}
            onChange={() => handleToggle('showFaceInPhotos')}
          />
          <SettingRow 
            label="Allow Photo Download"
            checked={settings.allowPhotoDownload}
            onChange={() => handleToggle('allowPhotoDownload')}
          />
          <SettingRow 
            label="Allow Photo Sharing"
            checked={settings.allowPhotoSharing}
            onChange={() => handleToggle('allowPhotoSharing')}
          />
        </Section>
        
        <Box sx={styles.divider} />
        
        {/* Notifications Section */}
        <Section section={sections[6]}>
          <SettingRow 
            label="Push Notifications"
            checked={settings.pushNotifications}
            onChange={() => handleToggle('pushNotifications')}
          />
          <SettingRow 
            label="Email Notifications"
            checked={settings.emailNotifications}
            onChange={() => handleToggle('emailNotifications')}
          />
          <SettingRow 
            label="Message Alerts"
            checked={settings.messageNotifications}
            onChange={() => handleToggle('messageNotifications')}
          />
          <SettingRow 
            label="Marketing Emails"
            description="Receive promotional content"
            checked={settings.marketingEmails}
            onChange={() => handleToggle('marketingEmails')}
          />
        </Section>
        
        <Box sx={styles.divider} />
        
        {/* Security Section */}
        <Section section={sections[7]}>
          {location.state?.focusVerification && (
            <Alert
              severity="info"
              sx={{ mb: 2 }}
              action={
                <Button
                  size="small"
                  variant="contained"
                  onClick={() => navigate('/verification', { state: { from: '/settings' } })}
                  sx={{
                    ml: 1,
                    bgcolor: '#00f2ea',
                    color: '#000',
                    fontWeight: 700,
                    '&:hover': { bgcolor: '#00cfc8' },
                  }}
                >
                  Verify Now
                </Button>
              }
            >
              Phone verification is incomplete. Continue to verification to unlock full profile visibility and trust boosts.
            </Alert>
          )}
          <SettingRow 
            label="Two-Factor Authentication"
            description="Extra layer of security"
            checked={settings.twoFactorAuth}
            onChange={() => handleToggle('twoFactorAuth')}
          />
          <SettingRow 
            label="Login Alerts"
            description="Get notified of new logins"
            checked={settings.loginAlerts}
            onChange={() => handleToggle('loginAlerts')}
          />
          <SettingRow 
            label="Auto Session Timeout"
            checked={settings.sessionTimeout}
            onChange={() => handleToggle('sessionTimeout')}
          />
        </Section>
        
        {/* Danger Zone */}
        <Box sx={styles.dangerSection}>
          <Typography sx={{ color: '#ff0055', fontWeight: 700, fontSize: '16px', mb: 2 }}>
            Danger Zone
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => setShowExportDialog(true)}
              sx={{
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.3)',
                textTransform: 'none',
                justifyContent: 'flex-start',
                minHeight: 44,
                '&:hover': {
                  borderColor: '#fff',
                  background: 'rgba(255,255,255,0.05)',
                },
              }}
            >
              Export My Data
            </Button>
            <Button
              variant="outlined"
              startIcon={<Delete />}
              onClick={() => setShowDeleteDialog(true)}
              sx={{
                color: '#ff0055',
                borderColor: '#ff0055',
                textTransform: 'none',
                justifyContent: 'flex-start',
                minHeight: 44,
                '&:hover': {
                  borderColor: '#ff0055',
                  background: 'rgba(255, 0, 85, 0.1)',
                },
              }}
            >
              Delete Account
            </Button>
          </Box>
        </Box>
          </>
        )}
      </Box>
      
      {/* Save Button - only show when there are changes and not saving */}
      <AnimatePresence>
        {hasChanges && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Button 
              sx={styles.saveButton} 
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <CircularProgress size={20} sx={{ color: '#0f0f13', mr: 1 }} />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Save Success Snackbar */}
      <Snackbar
        open={showSaveSnackbar}
        autoHideDuration={3000}
        onClose={() => setShowSaveSnackbar(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          severity="success" 
          sx={{ background: '#1a1a1a', color: '#fff', border: '1px solid #00f2ea' }}
        >
          Settings saved successfully!
        </Alert>
      </Snackbar>
      
      {/* Delete Account Dialog */}
      <Dialog 
        open={showDeleteDialog} 
        onClose={() => setShowDeleteDialog(false)}
        PaperProps={{
          sx: {
            background: '#1a1a1a',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
          }
        }}
      >
        <DialogTitle sx={{ color: '#ff0055' }}>Delete Account</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
            This action cannot be undone. All your data will be permanently deleted.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDeleteDialog(false)} sx={{ color: '#fff' }}>
            Cancel
          </Button>
          <Button 
            sx={{ color: '#ff0055' }}
            onClick={() => {
              // Handle delete
              setShowDeleteDialog(false);
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Export Data Dialog */}
      <Dialog 
        open={showExportDialog} 
        onClose={() => setShowExportDialog(false)}
        PaperProps={{
          sx: {
            background: '#1a1a1a',
            borderRadius: '16px',
            border: '1px solid rgba(255,255,255,0.1)',
          }
        }}
      >
        <DialogTitle sx={{ color: '#fff' }}>Export Your Data</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
            We'll prepare a download of all your data. This may take a few minutes.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowExportDialog(false)} sx={{ color: '#fff' }}>
            Cancel
          </Button>
          <Button 
            sx={{ color: '#00f2ea' }}
            onClick={() => {
              // Handle export
              setShowExportDialog(false);
            }}
          >
            Export
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PrivacySettings;
