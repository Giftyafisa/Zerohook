import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectUser } from '../store/slices/authSlice';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Button,
  Collapse,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Alert,
  Chip,
  Stack,
  Divider
} from '@mui/material';
import {
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  LocationOn as LocationIcon,
  Photo as PhotoIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Description as BioIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Close as CloseIcon,
  Star as StarIcon
} from '@mui/icons-material';

/**
 * ProfileCompletionReminder
 * 
 * Shows users their profile completion status and prompts them to complete
 * missing fields. Integrates with the backend ProfileCompletenessService.
 */
const ProfileCompletionReminder = ({ variant = 'card', showDismiss = true, onDismiss = null }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  
  const [completeness, setCompleteness] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check if reminder was dismissed in localStorage
  useEffect(() => {
    const dismissedUntil = localStorage.getItem('profileReminderDismissedUntil');
    if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
      setDismissed(true);
    }
  }, []);

  // Calculate profile completeness on the frontend
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Calculate completeness based on user data
    const calculateCompleteness = () => {
      const profileData = user.profile_data || user.profileData || {};
      const location = profileData.location || {};
      
      const fields = {
        // Critical fields (40%)
        location: {
          complete: !!(location.city && location.country),
          weight: 15,
          category: 'critical',
          description: 'Add your location to appear in local searches',
          icon: <LocationIcon />
        },
        coordinates: {
          complete: !!(location.coordinates?.lat && location.coordinates?.lng),
          weight: 10,
          category: 'critical',
          description: 'Enable GPS for precise location',
          icon: <LocationIcon color="primary" />
        },
        profilePhoto: {
          complete: !!(user.profile_image || profileData.profilePicture || profileData.avatar),
          weight: 15,
          category: 'critical',
          description: 'Add a profile photo - 10x more messages!',
          icon: <PhotoIcon />
        },
        
        // Important fields (35%)
        basicInfo: {
          complete: !!(profileData.firstName || profileData.lastName || user.username),
          weight: 10,
          category: 'important',
          description: 'Add your name',
          icon: <PersonIcon />
        },
        age: {
          complete: !!profileData.age,
          weight: 5,
          category: 'important',
          description: 'Add your age',
          icon: <PersonIcon />
        },
        bio: {
          complete: !!(profileData.bio && profileData.bio.length > 20),
          weight: 10,
          category: 'important',
          description: 'Write a bio (at least 20 characters)',
          icon: <BioIcon />
        },
        phoneVerified: {
          complete: !!user.phone_verified,
          weight: 5,
          category: 'important',
          description: 'Verify your phone number',
          icon: <PhoneIcon />
        },
        
        // Optional fields (25%)
        galleryPhotos: {
          complete: !!(profileData.photos && profileData.photos.length >= 3),
          weight: 10,
          category: 'optional',
          description: 'Add at least 3 gallery photos',
          icon: <PhotoIcon color="action" />
        },
        services: {
          complete: !!(profileData.services && profileData.services.length > 0),
          weight: 5,
          category: 'optional',
          description: 'List your services or interests',
          icon: <StarIcon />
        }
      };

      let totalScore = 0;
      let maxScore = 0;
      const missingFields = [];
      const completedFields = [];

      Object.entries(fields).forEach(([name, field]) => {
        maxScore += field.weight;
        if (field.complete) {
          totalScore += field.weight;
          completedFields.push({ name, ...field });
        } else {
          missingFields.push({ name, ...field });
        }
      });

      const score = Math.round((totalScore / maxScore) * 100);
      
      let level = 'incomplete';
      if (score >= 90) level = 'excellent';
      else if (score >= 70) level = 'good';
      else if (score >= 50) level = 'fair';
      else if (score >= 30) level = 'poor';

      return {
        score,
        level,
        missingFields: missingFields.sort((a, b) => {
          const categoryOrder = { critical: 0, important: 1, optional: 2 };
          return categoryOrder[a.category] - categoryOrder[b.category];
        }),
        completedFields,
        canAppearInFeed: score >= 30,
        needsReminder: score < 70
      };
    };

    setCompleteness(calculateCompleteness());
    setLoading(false);
  }, [user]);

  const handleDismiss = () => {
    // Dismiss for 24 hours
    const dismissUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    localStorage.setItem('profileReminderDismissedUntil', dismissUntil.toISOString());
    setDismissed(true);
    onDismiss?.();
  };

  const handleCompleteProfile = () => {
    navigate('/settings/profile');
  };

  // Don't show if loading, dismissed, not logged in, or profile is excellent
  if (loading || dismissed || !user || !completeness || completeness.level === 'excellent') {
    return null;
  }

  // Don't show reminder for users with good profiles unless they have critical missing fields
  if (completeness.level === 'good' && !completeness.missingFields.some(f => f.category === 'critical')) {
    return null;
  }

  const getStatusColor = () => {
    switch (completeness.level) {
      case 'excellent': return 'success';
      case 'good': return 'info';
      case 'fair': return 'warning';
      case 'poor': return 'error';
      default: return 'error';
    }
  };

  const getStatusMessage = () => {
    if (!completeness.canAppearInFeed) {
      return '⚠️ Your profile is hidden from search results!';
    }
    switch (completeness.level) {
      case 'good': return '👍 Almost there! Add a few more details.';
      case 'fair': return '📝 Complete your profile to get more messages.';
      case 'poor': return '⚠️ Your profile needs attention!';
      default: return '❌ Please complete your profile.';
    }
  };

  // Compact banner variant
  if (variant === 'banner') {
    return (
      <Alert
        severity={getStatusColor()}
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <Button size="small" variant="outlined" onClick={handleCompleteProfile}>
              Complete Profile
            </Button>
            {showDismiss && (
              <IconButton size="small" onClick={handleDismiss}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Stack>
        }
        sx={{ mb: 2 }}
      >
        <Typography variant="body2">
          Profile {completeness.score}% complete - {getStatusMessage()}
        </Typography>
      </Alert>
    );
  }

  // Full card variant
  return (
    <Card 
      sx={{ 
        mb: 2, 
        border: 2, 
        borderColor: `${getStatusColor()}.main`,
        position: 'relative'
      }}
    >
      {showDismiss && (
        <IconButton
          size="small"
          onClick={handleDismiss}
          sx={{ position: 'absolute', top: 8, right: 8 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
      
      <CardContent>
        <Stack spacing={2}>
          {/* Header */}
          <Box>
            <Stack direction="row" alignItems="center" spacing={1}>
              {completeness.level === 'poor' || completeness.level === 'incomplete' ? (
                <WarningIcon color="error" />
              ) : (
                <CheckIcon color={getStatusColor()} />
              )}
              <Typography variant="h6">
                Profile Completion
              </Typography>
              <Chip 
                label={`${completeness.score}%`} 
                color={getStatusColor()} 
                size="small" 
              />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {getStatusMessage()}
            </Typography>
          </Box>

          {/* Progress bar */}
          <Box>
            <LinearProgress
              variant="determinate"
              value={completeness.score}
              color={getStatusColor()}
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Box>

          {/* Hidden profile warning */}
          {!completeness.canAppearInFeed && (
            <Alert severity="error">
              <Typography variant="body2">
                <strong>Your profile is currently hidden</strong> from search results because it's less than 30% complete.
                Please complete the critical fields below.
              </Typography>
            </Alert>
          )}

          {/* Critical missing fields always shown */}
          {completeness.missingFields.filter(f => f.category === 'critical').length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="error.main" gutterBottom>
                ⚠️ Critical - Complete these first:
              </Typography>
              <List dense disablePadding>
                {completeness.missingFields
                  .filter(f => f.category === 'critical')
                  .map((field, index) => (
                    <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {field.icon}
                      </ListItemIcon>
                      <ListItemText 
                        primary={field.description}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
              </List>
            </Box>
          )}

          {/* Expandable section for other fields */}
          {completeness.missingFields.filter(f => f.category !== 'critical').length > 0 && (
            <>
              <Button
                size="small"
                onClick={() => setExpanded(!expanded)}
                endIcon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                sx={{ alignSelf: 'flex-start' }}
              >
                {expanded ? 'Show Less' : `Show ${completeness.missingFields.filter(f => f.category !== 'critical').length} more suggestions`}
              </Button>
              
              <Collapse in={expanded}>
                <Divider sx={{ my: 1 }} />
                <List dense disablePadding>
                  {completeness.missingFields
                    .filter(f => f.category !== 'critical')
                    .map((field, index) => (
                      <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          {field.icon}
                        </ListItemIcon>
                        <ListItemText 
                          primary={field.description}
                          secondary={field.category === 'important' ? 'Recommended' : 'Optional'}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                      </ListItem>
                    ))}
                </List>
              </Collapse>
            </>
          )}

          {/* Action button */}
          <Button
            variant="contained"
            color={getStatusColor()}
            onClick={handleCompleteProfile}
            fullWidth
          >
            Complete Your Profile
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ProfileCompletionReminder;
