import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tabs,
  Tab,
  Tooltip,
  Stack,
  Divider,
  Skeleton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { alpha } from '@mui/material/styles';
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
  Work,
  AccessTime,
  MoreVert,
  ContentCopy,
  Flag,
  Schedule,
  Cake
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useCall } from '../contexts/CallContext';
import { getDefaultImage } from '../config/images';
import apiClient from '../services/apiClient';
import { resolveProfileImage } from '../utils/imageUtils';
import useCurrency from '../hooks/useCurrency';
import usePresence from '../hooks/usePresence';

const MAX_CONTACT_MESSAGE_LENGTH = 500;

const CONTACT_MODE_LABELS = {
  contact_request: 'Message Request',
  video_call: 'Video Call Request',
  service_inquiry: 'Service Inquiry'
};

const CONTACT_MODE_PLACEHOLDERS = {
  contact_request: "Hi! I would like to connect with you.",
  video_call: "Hi! I would like to have a video call with you. Are you available?",
  service_inquiry: "Hi! I'm interested in your services. Can you share details?"
};

const normalizeList = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || '').trim()).filter(Boolean);
};

const buildLocationLabel = (location) => {
  const city = String(location?.city || '').trim();
  const country = String(location?.country || '').trim();
  if (city && country) return `${city}, ${country}`;
  if (city) return city;
  if (country) return country;
  return 'Location unavailable';
};

const ProfileDetailPage = () => {
  const { isAuthenticated, user } = useAuth();
  const { startCall } = useCall();
  const { profileId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { formatFromUSD, symbol: currencySymbol } = useCurrency();

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
  const [actionsAnchorEl, setActionsAnchorEl] = useState(null);

  const profileData = useMemo(() => {
    return profile?.profile_data || profile?.profileData || {};
  }, [profile]);

  const resolvedProfileId = useMemo(() => {
    return profile?.id || profile?._id || profile?.userId || profileId || null;
  }, [profile, profileId]);

  const resolvedProfileName = useMemo(() => {
    return profileData?.firstName || profile?.username || 'User';
  }, [profileData, profile]);

  const locationLabel = useMemo(() => {
    return buildLocationLabel(profileData.location);
  }, [profileData.location]);

  const availabilityValues = useMemo(() => {
    return normalizeList(profileData.availability);
  }, [profileData.availability]);

  const languageValues = useMemo(() => {
    return normalizeList(profileData.languages);
  }, [profileData.languages]);

  const specializationValues = useMemo(() => {
    return normalizeList(profileData.specializations);
  }, [profileData.specializations]);

  const serviceCategoryValues = useMemo(() => {
    return normalizeList(profileData.serviceCategories);
  }, [profileData.serviceCategories]);

  const hasServiceData = serviceCategoryValues.length > 0 || specializationValues.length > 0;

  const ageLabel = Number(profileData.age) > 0 ? `${profileData.age} years old` : 'Age not specified';

  const startingPriceLabel = profileData.basePrice
    ? formatFromUSD(profileData.basePrice)
    : `${currencySymbol}0`;

  const availabilityLabel = availabilityValues.length > 0
    ? availabilityValues.join(', ')
    : 'Availability not provided';

  const presenceIds = useMemo(() => {
    if (profile) return [profile.id || profileId];
    return [profileId];
  }, [profile, profileId]);

  const presenceSeed = useMemo(() => {
    const id = String(profile?.id || profileId || '');
    if (!id) return {};
    return { [id]: !!(profile?.isOnline || profile?.is_online) };
  }, [profile, profileId]);

  const { isUserOnline, getUserLastSeen } = usePresence(presenceIds, {
    context: 'browse',
    initialStatusMap: presenceSeed
  });

  const profileOnline = isUserOnline(profile?.id || profileId)
    ?? profile?.isOnline
    ?? profile?.is_online
    ?? false;

  const profileLastSeenLabel = getUserLastSeen(profile?.id || profileId)
    ?? profile?.lastSeenLabel
    ?? profile?.last_seen_label
    ?? null;

  const isConnectionAccepted = connectionStatus?.exists && connectionStatus.status === 'accepted';
  const isConnectionPending = connectionStatus?.exists && connectionStatus.status !== 'accepted';

  const connectionStatusLabel = isConnectionAccepted
    ? 'Connected'
    : isConnectionPending
      ? 'Request Pending'
      : 'Not Connected';

  const getVerificationColor = (tier) => {
    switch (tier) {
      case 4: return '#FFD700';
      case 3: return '#9C27B0';
      case 2: return '#2196F3';
      case 1: return '#4CAF50';
      default: return '#757575';
    }
  };

  const getVerificationLabel = (tier) => {
    switch (tier) {
      case 4: return 'Elite';
      case 3: return 'Pro';
      case 2: return 'Advanced';
      case 1: return 'Basic';
      default: return 'Unverified';
    }
  };

  const checkConnectionStatus = useCallback(async () => {
    const targetUserId = profile?.id || profile?._id || profile?.userId;
    if (!isAuthenticated || !user || !targetUserId) return;

    try {
      const response = await apiClient.get(`/connections/check-status/${targetUserId}`);
      setConnectionStatus(response.data);
    } catch (requestError) {
      console.error('Error checking connection status:', requestError);
    }
  }, [isAuthenticated, user, profile]);

  useEffect(() => {
    if (profile) {
      checkConnectionStatus();
    }
  }, [profile, checkConnectionStatus]);

  const fetchProfileDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (isAuthenticated && user && String(user.id) === String(profileId)) {
        setError('You cannot view your own profile in the marketplace. Use your dashboard instead.');
        setLoading(false);
        return;
      }

      const response = await apiClient.get(`/users/${profileId}`);
      const data = response.data;

      if (!data.user) {
        throw new Error('Invalid response format: missing user data');
      }

      setProfile(data.user);
    } catch (requestError) {
      console.error('Error fetching profile details:', requestError);
      setError(requestError.message || 'Failed to fetch profile details');
    } finally {
      setLoading(false);
    }
  }, [profileId, isAuthenticated, user]);

  useEffect(() => {
    if (profileId) {
      fetchProfileDetails();
    }
  }, [profileId, fetchProfileDetails]);

  const redirectToLogin = useCallback(() => {
    navigate('/login', {
      state: {
        from: {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash
        }
      }
    });
  }, [navigate, location.pathname, location.search, location.hash]);

  const openContactDialog = useCallback((type = 'contact_request') => {
    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }

    setContactType(type);
    setContactMessage('');
    setContactDialog(true);
  }, [isAuthenticated, redirectToLogin]);

  const handleContact = useCallback(() => {
    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }

    const avatar = resolveProfileImage(profileData);
    if (!resolvedProfileId) {
      toast.error('Unable to open chat for this profile right now.');
      return;
    }

    const chatState = {
      recipientId: resolvedProfileId,
      recipientName: resolvedProfileName,
      recipientAvatar: avatar,
      from: location.pathname
    };

    const chatQuery = new URLSearchParams();
    chatQuery.set('recipientId', String(resolvedProfileId));

    navigate(`/chat${chatQuery.toString() ? `?${chatQuery.toString()}` : ''}`, {
      state: chatState
    });
  }, [isAuthenticated, redirectToLogin, profileData, resolvedProfileId, resolvedProfileName, location.pathname, navigate]);

  const handleVideoCall = useCallback(() => {
    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }

    if (!resolvedProfileId) {
      toast.error('Unable to start a call for this profile right now.');
      return;
    }

    const avatar = resolveProfileImage(profileData);
    const chatState = {
      recipientId: resolvedProfileId,
      recipientName: resolvedProfileName,
      recipientAvatar: avatar,
      from: location.pathname
    };
    const chatQuery = new URLSearchParams();
    chatQuery.set('recipientId', String(resolvedProfileId));

    navigate(`/chat${chatQuery.toString() ? `?${chatQuery.toString()}` : ''}`, {
      state: chatState
    });

    startCall(resolvedProfileId, 'video', resolvedProfileName);
  }, [isAuthenticated, redirectToLogin, resolvedProfileId, profileData, resolvedProfileName, location.pathname, navigate, startCall]);

  const handleSendContactRequest = useCallback(async () => {
    if (!contactMessage.trim() || !resolvedProfileId) return;

    setSendingMessage(true);
    try {
      await apiClient.post('/connections/contact-request', {
        toUserId: resolvedProfileId,
        message: contactMessage.trim(),
        connectionType: contactType
      });

      toast.success('Contact request sent successfully.');
      setContactDialog(false);
      setContactMessage('');
      checkConnectionStatus();
    } catch (requestError) {
      console.error('Send contact request error:', requestError);
      const status = requestError.response?.status;
      if (status === 409) {
        toast.info('You are already connected with this user.');
      } else if (status === 403) {
        toast.error('Cannot connect with this user due to blocking.');
      } else if (status === 404) {
        toast.error('User not found. Please try again.');
      } else {
        toast.error(requestError.response?.data?.message || 'Failed to send contact request');
      }
    } finally {
      setSendingMessage(false);
    }
  }, [contactMessage, resolvedProfileId, contactType, checkConnectionStatus]);

  const handleFavoriteToggle = () => {
    setIsFavorite((prev) => !prev);
  };

  const handleOpenActionsMenu = (event) => {
    setActionsAnchorEl(event.currentTarget);
  };

  const handleCloseActionsMenu = () => {
    setActionsAnchorEl(null);
  };

  const handleCopyProfileLink = async () => {
    handleCloseActionsMenu();
    if (typeof window === 'undefined') return;

    const absoluteUrl = `${window.location.origin}/profile/${profileId}`;
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      toast.success('Profile link copied.');
    } catch (copyError) {
      console.error('Copy link failed:', copyError);
      toast.error('Could not copy the profile link.');
    }
  };

  const handleReportProfile = () => {
    handleCloseActionsMenu();
    navigate('/help', {
      state: {
        reportTarget: {
          profileId: resolvedProfileId,
          username: profile?.username,
          source: location.pathname
        }
      }
    });
    toast.info('Describe the issue in Support so our team can review it.');
  };

  const renderTagSection = (title, values, color = 'default') => {
    if (values.length === 0) return null;

    return (
      <Box mb={3}>
        <Typography
          variant="subtitle2"
          fontWeight={700}
          color="text.secondary"
          gutterBottom
          sx={{ textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: 1 }}
        >
          {title}
        </Typography>
        <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
          {values.map((value) => (
            <Chip
              key={`${title}-${value}`}
              label={value}
              size="small"
              color={color}
              variant={color === 'default' ? 'filled' : 'outlined'}
              sx={{ fontWeight: 500 }}
            />
          ))}
        </Box>
      </Box>
    );
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: { xs: 1, md: 4 } }}>
        <Skeleton variant="text" width={120} height={36} sx={{ mb: 2 }} />

        <Card elevation={0} sx={{ borderRadius: 4, p: { xs: 2, md: 3 }, mb: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Skeleton variant="rounded" sx={{ width: '100%', pt: '100%', borderRadius: 3 }} />
            </Grid>
            <Grid item xs={12} md={8}>
              <Skeleton variant="text" width="60%" height={52} />
              <Skeleton variant="text" width="40%" height={28} sx={{ mb: 2 }} />
              <Skeleton variant="rounded" width="100%" height={44} sx={{ mb: 2 }} />
              <Skeleton variant="rounded" width="75%" height={34} sx={{ mb: 3 }} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Skeleton variant="rounded" width={160} height={46} />
                <Skeleton variant="rounded" width={160} height={46} />
              </Stack>
            </Grid>
          </Grid>
        </Card>

        <Card elevation={0} sx={{ borderRadius: 4, p: { xs: 2, md: 3 } }}>
          <Skeleton variant="text" width={180} height={32} sx={{ mb: 2 }} />
          <Skeleton variant="rounded" width="100%" height={120} />
        </Card>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box textAlign="center">
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
            <Button variant="contained" onClick={fetchProfileDetails}>
              Retry
            </Button>
            <Button variant="outlined" onClick={() => navigate('/profiles')} startIcon={<ArrowBack />}>
              Back to Profiles
            </Button>
          </Stack>
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
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            This profile may have been removed or is no longer available.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/profiles')} startIcon={<ArrowBack />}>
            Back to Profiles
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 0.75, sm: 1.5, md: 4 }, pb: { xs: 14, md: 4 } }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        mb={{ xs: 1, md: 2.5 }}
      >
        <Button
          variant="text"
          onClick={() => navigate('/profiles')}
          startIcon={<ArrowBack />}
          sx={{ color: 'text.secondary', minHeight: 40, px: 1.5 }}
        >
          Back to Profiles
        </Button>
        <Typography variant="body2" color="text.secondary">
          Profile Detail
        </Typography>
      </Stack>

      <Card
        elevation={0}
        sx={{
          bgcolor: alpha(theme.palette.background.paper, 0.94),
          borderRadius: 4,
          overflow: 'hidden',
          border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
          boxShadow: `0 24px 40px ${alpha(theme.palette.common.black, 0.28)}`
        }}
      >
        <CardContent sx={{ p: { xs: 2.25, md: 3.5 } }}>
          <Grid container spacing={{ xs: 2.5, md: 3.5 }}>
            <Grid item xs={12} md={4}>
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  paddingTop: '100%',
                  borderRadius: 3,
                  overflow: 'hidden',
                  bgcolor: 'background.default',
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                }}
              >
                <CardMedia
                  component="img"
                  image={resolveProfileImage(profileData) || getDefaultImage('PROFILE', profileData.gender)}
                  alt={`${profileData.firstName || 'Profile'} ${profileData.lastName || ''}`.trim()}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  onError={(event) => {
                    event.target.src = getDefaultImage('PROFILE', profileData.gender);
                  }}
                />

                <Tooltip title={profileOnline ? 'Online now' : (profileLastSeenLabel || 'Offline')}>
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 12,
                      right: 12,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      bgcolor: profileOnline ? 'success.main' : 'grey.500',
                      border: '3px solid',
                      borderColor: 'background.paper',
                      boxShadow: profileOnline ? '0 0 8px rgba(76,175,80,0.65)' : 2
                    }}
                  />
                </Tooltip>

                <Chip
                  size="small"
                  icon={<AccessTime sx={{ fontSize: 16 }} />}
                  label={profileOnline ? 'Online' : (profileLastSeenLabel || 'Offline')}
                  sx={{
                    position: 'absolute',
                    left: 12,
                    bottom: 12,
                    bgcolor: alpha(theme.palette.background.paper, 0.86),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.24)}`,
                    fontWeight: 600
                  }}
                />
              </Box>
            </Grid>

            <Grid item xs={12} md={8}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={1.5}>
                <Box minWidth={0}>
                  <Typography
                    variant="h4"
                    component="h1"
                    fontWeight={700}
                    sx={{
                      fontSize: { xs: '1.6rem', md: '2.15rem' },
                      lineHeight: 1.2,
                      wordBreak: 'break-word'
                    }}
                  >
                    {`${profileData.firstName || ''} ${profileData.lastName || ''}`.trim() || profile.username}
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mt: 0.25, wordBreak: 'break-all' }}>
                    @{profile.username}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={0.5}>
                  <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                    <IconButton
                      onClick={handleFavoriteToggle}
                      sx={{ color: isFavorite ? 'error.main' : 'text.secondary' }}
                      aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      {isFavorite ? <Favorite /> : <FavoriteBorder />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="More actions">
                    <IconButton onClick={handleOpenActionsMenu} aria-label="Open profile actions">
                      <MoreVert />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>

              <Menu
                anchorEl={actionsAnchorEl}
                open={Boolean(actionsAnchorEl)}
                onClose={handleCloseActionsMenu}
              >
                <MenuItem onClick={handleCopyProfileLink}>
                  <ListItemIcon>
                    <ContentCopy fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Copy profile link</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleReportProfile}>
                  <ListItemIcon>
                    <Flag fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>Report profile</ListItemText>
                </MenuItem>
              </Menu>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" mb={2}>
                <Chip
                  size="small"
                  label={connectionStatusLabel}
                  color={isConnectionAccepted ? 'success' : isConnectionPending ? 'warning' : 'default'}
                  variant={isConnectionAccepted ? 'filled' : 'outlined'}
                  sx={{ fontWeight: 600 }}
                />

                <Tooltip title="Verification tier based on profile and trust checks">
                  <Chip
                    icon={<Security sx={{ fontSize: 18 }} />}
                    label={getVerificationLabel(profile.verification_tier)}
                    size="small"
                    sx={{
                      bgcolor: `${getVerificationColor(profile.verification_tier)}22`,
                      color: getVerificationColor(profile.verification_tier),
                      borderColor: getVerificationColor(profile.verification_tier),
                      border: 1,
                      fontWeight: 600
                    }}
                  />
                </Tooltip>

                <Tooltip title="Reputation score based on completed interactions">
                  <Chip
                    icon={<Star sx={{ fontSize: 18 }} />}
                    label={`${profile.reputation_score || 0}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 600 }}
                  />
                </Tooltip>

                {profile.is_subscribed && (
                  <Chip
                    label="Premium"
                    size="small"
                    color="primary"
                    sx={{ fontWeight: 600 }}
                  />
                )}
              </Stack>

              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" mb={2.5}>
                <Chip
                  icon={<LocationOn sx={{ fontSize: 18 }} />}
                  label={locationLabel}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  icon={<Cake sx={{ fontSize: 18 }} />}
                  label={ageLabel}
                  size="small"
                  variant="outlined"
                />
                <Chip
                  icon={<Schedule sx={{ fontSize: 18 }} />}
                  label={availabilityLabel}
                  size="small"
                  variant="outlined"
                />
              </Stack>

              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.09)}, ${alpha(theme.palette.background.default, 0.55)})`,
                  mb: 2.5
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  Starting from
                </Typography>
                <Typography
                  variant="h4"
                  color="primary"
                  fontWeight={700}
                  sx={{ fontSize: { xs: '1.65rem', md: '2rem' }, lineHeight: 1.15, mt: 0.5 }}
                >
                  {startingPriceLabel}
                </Typography>
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} useFlexGap>
                <Button
                  variant="contained"
                  size="large"
                  onClick={handleContact}
                  startIcon={<Message />}
                  disabled={!resolvedProfileId}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 700,
                    px: 3,
                    minWidth: 170
                  }}
                >
                  {isAuthenticated ? 'Message' : 'Login to Message'}
                </Button>

                <Tooltip
                  title={
                    !isAuthenticated
                      ? 'Login to start calls'
                      : profileOnline
                        ? 'Start a live video call'
                        : 'User appears offline. You can still try or send a message first.'
                  }
                >
                  <span>
                    <Button
                      variant="outlined"
                      size="large"
                      startIcon={<VideoCall />}
                      onClick={handleVideoCall}
                      disabled={!resolvedProfileId}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 700,
                        px: 3,
                        minWidth: 170
                      }}
                    >
                      {isAuthenticated ? 'Video Call' : 'Login to Call'}
                    </Button>
                  </span>
                </Tooltip>

                {!isConnectionAccepted && (
                  <Button
                    variant="text"
                    size="large"
                    onClick={() => openContactDialog('contact_request')}
                    disabled={!isAuthenticated || !resolvedProfileId || isConnectionPending}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600,
                      px: 1.25
                    }}
                  >
                    {isConnectionPending ? 'Request Pending' : 'Request Connection'}
                  </Button>
                )}
              </Stack>

              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
                {isConnectionAccepted
                  ? 'You are connected. Messaging opens directly in chat.'
                  : isConnectionPending
                    ? 'Your connection request is waiting for approval.'
                    : 'Send a request first if you want to introduce yourself before a direct chat.'}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card
        elevation={0}
        sx={{
          mt: 3,
          bgcolor: alpha(theme.palette.background.paper, 0.94),
          borderRadius: 4,
          border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: { xs: 0.5, md: 2 } }}>
          <Tabs
            value={activeTab}
            onChange={(event, newValue) => setActiveTab(newValue)}
            variant={isMobile ? 'fullWidth' : 'standard'}
          >
            <Tab label="About" sx={{ textTransform: 'none', fontWeight: 700 }} />
            <Tab label="Services" sx={{ textTransform: 'none', fontWeight: 700 }} />
          </Tabs>
        </Box>

        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
          {activeTab === 0 && (
            <Box>
              <Typography
                variant="h6"
                fontWeight={700}
                sx={{ mb: 1.25, fontSize: { xs: '1.05rem', md: '1.2rem' } }}
              >
                About
              </Typography>

              <Typography
                variant="body1"
                color="text.secondary"
                paragraph
                sx={{ lineHeight: 1.8, wordBreak: 'break-word', overflowWrap: 'anywhere' }}
              >
                {String(profileData.bio || '').trim() || 'This profile has not added a bio yet.'}
              </Typography>

              <Divider sx={{ my: 2 }} />

              {renderTagSection('Languages', languageValues, 'default')}
              {renderTagSection('Specializations', specializationValues, 'primary')}
              {renderTagSection('Service Categories', serviceCategoryValues, 'default')}

              {languageValues.length === 0 && specializationValues.length === 0 && serviceCategoryValues.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Additional profile details have not been shared yet.
                </Typography>
              )}
            </Box>
          )}

          {activeTab === 1 && (
            <Box>
              {hasServiceData ? (
                <>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    sx={{ mb: 1.25, fontSize: { xs: '1.05rem', md: '1.2rem' } }}
                  >
                    Service Highlights
                  </Typography>

                  {renderTagSection('Service Categories', serviceCategoryValues, 'default')}
                  {renderTagSection('Specializations', specializationValues, 'primary')}

                  <Box
                    sx={{
                      mt: 1.5,
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                      bgcolor: alpha(theme.palette.background.default, 0.55)
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      Discuss pricing, availability, and expectations directly in chat before booking.
                    </Typography>
                  </Box>
                </>
              ) : (
                <Box textAlign="center" py={4}>
                  <Work sx={{ fontSize: 48, color: 'text.disabled', mb: 1.5 }} />
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 1.5 }}>
                    Detailed service information has not been added yet.
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={() => openContactDialog('service_inquiry')}
                    startIcon={<Message />}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                  >
                    Send Service Inquiry
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

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
          <Typography variant="h6" fontWeight={700}>
            {CONTACT_MODE_LABELS[contactType]} - {resolvedProfileName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Send a clear first message to improve response quality.
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} mb={2.5}>
            <Button
              variant={contactType === 'contact_request' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setContactType('contact_request')}
              startIcon={<Message />}
              sx={{ flex: 1, borderRadius: 2, textTransform: 'none' }}
            >
              Message
            </Button>
            <Button
              variant={contactType === 'video_call' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setContactType('video_call')}
              startIcon={<VideoCall />}
              sx={{ flex: 1, borderRadius: 2, textTransform: 'none' }}
            >
              Video Call
            </Button>
            <Button
              variant={contactType === 'service_inquiry' ? 'contained' : 'outlined'}
              size="small"
              onClick={() => setContactType('service_inquiry')}
              startIcon={<Work />}
              sx={{ flex: 1, borderRadius: 2, textTransform: 'none' }}
            >
              Service
            </Button>
          </Stack>

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Your Message"
            value={contactMessage}
            onChange={(event) => setContactMessage(event.target.value)}
            placeholder={CONTACT_MODE_PLACEHOLDERS[contactType]}
            variant="outlined"
            autoFocus
            inputProps={{ maxLength: MAX_CONTACT_MESSAGE_LENGTH }}
            helperText={`${contactMessage.length}/${MAX_CONTACT_MESSAGE_LENGTH} characters`}
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
            sx={{ borderRadius: 2, textTransform: 'none', px: 3 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendContactRequest}
            variant="contained"
            disabled={!contactMessage.trim() || sendingMessage || !resolvedProfileId}
            sx={{ borderRadius: 2, textTransform: 'none', px: 3, fontWeight: 700 }}
          >
            {sendingMessage ? 'Sending...' : 'Send Request'}
          </Button>
        </DialogActions>
      </Dialog>

      {isMobile && !contactDialog && (
        <Box
          sx={{
            position: 'fixed',
            left: 12,
            right: 12,
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)',
            zIndex: 1200
          }}
        >
          <Card
            elevation={6}
            sx={{
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.26)}`,
              bgcolor: alpha(theme.palette.background.paper, 0.96)
            }}
          >
            <CardContent sx={{ p: 1.25 }}>
              <Stack direction="row" spacing={1}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<Message />}
                  onClick={handleContact}
                  disabled={!resolvedProfileId}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Message
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<VideoCall />}
                  onClick={handleVideoCall}
                  disabled={!resolvedProfileId}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Call
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      )}
    </Container>
  );
};

export default ProfileDetailPage;