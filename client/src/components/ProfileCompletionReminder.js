import React, { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectUser } from '../store/slices/authSlice';
import { Box, Typography, IconButton, LinearProgress, Collapse, Fade, Paper, Stack, Chip, Button, Avatar, Divider } from '@mui/material';
import { Close as CloseIcon, ChevronRight as ChevronRightIcon, CheckCircle as CheckCircleIcon, PhotoCamera, LocationOn, Edit, Person, CalendarToday, Public, Collections, PhoneAndroid, Star } from '@mui/icons-material';
import { resolveProfileImage } from '../utils/imageUtils';

/**
 * ProfileCompletionReminder — Redesigned v2
 *
 * Modern, responsive card that shows profile completion status with
 * step indicators. Polished for both mobile and desktop viewports.
 * Dismissable for 24 hours.
 *
 * variant="banner" → slim inline bar (used in feeds)
 * variant="card"   → full card with step breakdown (used on dashboard)
 */
const ProfileCompletionReminder = ({ variant = 'card', showDismiss = true, onDismiss = null }) => {
  const navigate = useNavigate();
  const user = useSelector(selectUser);

  const [completeness, setCompleteness] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSteps, setShowSteps] = useState(false);
  const dismissalKey = useMemo(() => {
    const userId = user?.id || user?._id || user?.userId || 'guest';
    return `profileReminderDismissedUntil:${userId}`;
  }, [user?.id, user?._id, user?.userId]);

  // Check if reminder was recently dismissed
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissedUntil = localStorage.getItem(dismissalKey);
    setDismissed(Boolean(dismissedUntil && new Date(dismissedUntil) > new Date()));
  }, [dismissalKey]);

  // Calculate profile completeness
  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const profileData = user.profile_data || user.profileData || {};
    const loc = profileData.location || {};
    const coordinates = loc.coordinates || {};
    const galleryPhotos = [
      ...(Array.isArray(user.gallery_images) ? user.gallery_images : []),
      ...(Array.isArray(user.galleryImages) ? user.galleryImages : []),
      ...(Array.isArray(profileData.gallery_images) ? profileData.gallery_images : []),
      ...(Array.isArray(profileData.galleryImages) ? profileData.galleryImages : [])
    ];
    const galleryPhotoPreview = galleryPhotos
      .map((photo) => {
        if (typeof photo === 'string') return photo.trim() || null;
        if (photo && typeof photo.url === 'string') return photo.url.trim() || null;
        return null;
      })
      .find(Boolean) || null;
    const profileImage = resolveProfileImage({
      ...profileData,
      profile_image: profileData.profile_image || user.profile_image,
      profile_image_url: profileData.profile_image_url || user.profile_image_url,
      profilePicture: profileData.profilePicture || user.profilePicture,
      photos: Array.isArray(profileData.photos) && profileData.photos.length > 0 ? profileData.photos : galleryPhotos,
    }) || galleryPhotoPreview || user.profile_image || user.profile_image_url || user.profilePicture || user.avatar || null;
    const services = Array.isArray(profileData.services)
      ? profileData.services
      : Array.isArray(profileData.specializations)
        ? profileData.specializations
        : Array.isArray(profileData.serviceCategories)
          ? profileData.serviceCategories
          : [];
    const photoCount = (Array.isArray(profileData.photos) ? profileData.photos.length : 0) + galleryPhotos.length;
    const hasDisplayName = Boolean((profileData.firstName && String(profileData.firstName).trim()) || (profileData.lastName && String(profileData.lastName).trim()));
    const hasAge = Number.isFinite(Number(profileData.age));
    const hasLocation = Boolean(loc.city && loc.country);
    const hasGps = Boolean(
      coordinates &&
      Number.isFinite(Number(coordinates.lat)) &&
      Number.isFinite(Number(coordinates.lng))
    );
    const phoneVerified = Boolean(
      user.phone_verified ||
      user.phoneVerified ||
      profileData.phone_verified ||
      profileData.phoneVerified
    );

    const steps = [
      {
        key: 'photo',
        label: 'Add a profile photo',
        detail: profileImage ? 'Photo detected' : 'Profiles with a photo get more attention',
        icon: PhotoCamera,
        done: Boolean(profileImage || photoCount > 0),
        weight: 24,
        route: 'profile',
      },
      {
        key: 'location',
        label: 'Set your city and country',
        detail: hasLocation ? `${loc.city}, ${loc.country}` : 'Location improves nearby discovery',
        icon: LocationOn,
        done: hasLocation,
        weight: 16,
        route: 'location',
      },
      {
        key: 'bio',
        label: 'Write a short bio',
        detail: profileData.bio ? `${String(profileData.bio).trim().length} chars` : 'Add 20+ characters to help matching',
        icon: Edit,
        done: !!(profileData.bio && String(profileData.bio).trim().length >= 20),
        weight: 14,
        route: 'profile',
      },
      {
        key: 'name',
        label: 'Confirm your display name',
        detail: hasDisplayName ? 'Name is visible' : 'Add a first or last name people can recognize',
        icon: Person,
        done: hasDisplayName,
        weight: 10,
        route: 'profile',
      },
      {
        key: 'age',
        label: 'Add your age',
        detail: hasAge ? `Age set to ${profileData.age}` : 'Age improves matching quality',
        icon: CalendarToday,
        done: hasAge,
        weight: 10,
        route: 'profile',
      },
      {
        key: 'gps',
        label: 'Enable GPS precision',
        detail: hasGps ? 'Location precision is enabled' : 'Helps with nearby discovery',
        icon: Public,
        done: hasGps,
        weight: 10,
        route: 'location',
      },
      {
        key: 'gallery',
        label: 'Upload 3+ photos',
        detail: photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? '' : 's'} added` : 'More photos improve visibility',
        icon: Collections,
        done: photoCount >= 3,
        weight: 10,
        route: 'profile',
      },
      {
        key: 'phone',
        label: 'Verify your phone',
        detail: phoneVerified ? 'Phone verified' : 'Adds trust and contact safety',
        icon: PhoneAndroid,
        done: phoneVerified,
        weight: 6,
        route: 'security',
      },
      {
        key: 'services',
        label: 'Add services or interests',
        detail: services.length > 0 ? `${services.length} item${services.length === 1 ? '' : 's'} added` : 'Helps ranking and discovery',
        icon: Star,
        done: services.length > 0,
        weight: 4,
        route: 'visibility',
      },
    ];

    const maxScore = steps.reduce((s, f) => s + f.weight, 0);
    const earned = steps.filter(f => f.done).reduce((s, f) => s + f.weight, 0);
    const score = Math.round((earned / maxScore) * 100);

    setCompleteness({
      score,
      steps,
      doneCount: steps.filter(f => f.done).length,
      totalCount: steps.length,
      nextStep: steps.find(f => !f.done) || null,
      profileImage,
      initials: (user.username || profileData.firstName || 'U')
        .toString()
        .trim()
        .split(/\s+/)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    });
    setLoading(false);
  }, [user]);

  const handleDismiss = () => {
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000);
    if (typeof window !== 'undefined') {
      localStorage.setItem(dismissalKey, until.toISOString());
    }
    setDismissed(true);
    onDismiss?.();
  };

  const goToStep = (stepKey) => {
    const step = completeness?.steps.find((item) => item.key === stepKey);
    if (!step) {
      navigate('/settings');
      return;
    }

    // Route users to the most relevant flow for the missing step.
    if (step.route === 'profile') {
      navigate('/profile');
      return;
    }
    if (step.route === 'security') {
      navigate('/settings', { state: { focusSection: 'security', focusVerification: true } });
      return;
    }
    if (step.route === 'location') {
      navigate('/settings', { state: { focusSection: 'location' } });
      return;
    }
    if (step.route === 'visibility') {
      navigate('/settings', { state: { focusSection: 'visibility' } });
      return;
    }
    navigate('/settings');
  };

  // Don't render if dismissed, loading, no user, or profile is ≥ 90%
  if (loading || dismissed || !user || !completeness || completeness.score >= 90) return null;

  const nextStep = completeness.nextStep;
  const remainingSteps = completeness.steps.filter((step) => !step.done);
  const nextStepLabel = nextStep ? nextStep.label : 'Finish profile setup';

  // ───── Accent colour based on progress ─────
  const tone = completeness.score >= 70
    ? {
        accent: '#00f2ea',
        glow: 'rgba(0,242,234,0.24)',
        surface: 'rgba(0,242,234,0.10)',
        label: 'Strong progress',
      }
    : completeness.score >= 40
      ? {
          accent: '#ffb020',
          glow: 'rgba(255,176,32,0.24)',
          surface: 'rgba(255,176,32,0.10)',
          label: 'Nearly there',
        }
      : {
          accent: '#ff4466',
          glow: 'rgba(255,68,102,0.24)',
          surface: 'rgba(255,68,102,0.10)',
          label: 'Needs attention',
        };

  // ── Circular progress SVG helper ──
  const CircularProgress = ({ size, strokeWidth, value, color }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference - (value / 100) * circumference;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
    );
  };

  const renderStepRow = (step) => {
    const StepIcon = step.icon;
    return (
      <Box
        key={step.key}
        onClick={(e) => {
          e.stopPropagation();
          if (!step.done) goToStep(step.key);
        }}
        role={step.done ? undefined : 'button'}
        tabIndex={step.done ? -1 : 0}
        onKeyDown={(e) => {
          if (!step.done && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            goToStep(step.key);
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          px: 1.4,
          py: 1.1,
          minHeight: 52,
          borderRadius: '14px',
          background: step.done ? `${tone.accent}10` : 'rgba(255,255,255,0.02)',
          border: `1px solid ${step.done ? `${tone.accent}24` : 'rgba(255,255,255,0.06)'}`,
          cursor: step.done ? 'default' : 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': step.done ? {} : { background: 'rgba(255,255,255,0.04)', borderColor: `${tone.accent}40` },
          outline: 'none',
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: step.done ? `${tone.accent}20` : 'rgba(255,255,255,0.04)',
            color: step.done ? tone.accent : 'rgba(255,255,255,0.65)',
          }}
        >
          {step.done ? <CheckCircleIcon sx={{ fontSize: 18 }} /> : <StepIcon sx={{ fontSize: 18 }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: { xs: 12.5, sm: 13.5 },
              fontWeight: step.done ? 500 : 700,
              color: step.done ? 'rgba(255,255,255,0.42)' : 'rgba(255,255,255,0.92)',
              textDecoration: step.done ? 'line-through' : 'none',
              lineHeight: 1.25,
            }}
          >
            {step.label}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,0.48)', mt: 0.2, lineHeight: 1.25 }}>
            {step.detail}
          </Typography>
        </Box>
        {!step.done && <ChevronRightIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.24)', flexShrink: 0 }} />}
      </Box>
    );
  };

  if (variant === 'banner') {
    return (
      <Fade in timeout={350}>
        <Paper
          elevation={0}
          sx={{
            mx: { xs: 0.75, sm: 1.5 },
            mb: 1.5,
            px: { xs: 1.25, sm: 1.75 },
            py: { xs: 1.15, sm: 1.35 },
            borderRadius: '18px',
            background: `linear-gradient(135deg, rgba(12,14,22,0.96) 0%, rgba(24,27,38,0.94) 100%)`,
            border: `1px solid ${tone.accent}24`,
            boxShadow: `0 10px 28px ${tone.glow}`,
            backdropFilter: 'blur(18px)',
            overflow: 'hidden',
          }}
        >
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flex: 1, minWidth: 0 }}>
              <Box sx={{ position: 'relative', flexShrink: 0 }}>
                <Avatar
                  src={completeness.profileImage || undefined}
                  sx={{
                    width: 48,
                    height: 48,
                    bgcolor: tone.surface,
                    color: tone.accent,
                    fontWeight: 800,
                    border: `1px solid ${tone.accent}40`,
                  }}
                >
                  {completeness.initials}
                </Avatar>
                <Box sx={{ position: 'absolute', inset: -6, pointerEvents: 'none' }}>
                  <CircularProgress size={60} strokeWidth={3} value={completeness.score} color={tone.accent} />
                </Box>
              </Box>

              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                  <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: { xs: 13, sm: 14 } }}>
                    Profile completion
                  </Typography>
                  <Chip
                    label={`${completeness.score}%`}
                    size="small"
                    sx={{
                      height: 22,
                      fontSize: 11,
                      fontWeight: 800,
                      color: tone.accent,
                      bgcolor: tone.surface,
                      border: `1px solid ${tone.accent}30`,
                    }}
                  />
                </Stack>
                <Typography sx={{ color: 'rgba(255,255,255,0.86)', fontSize: { xs: 12.5, sm: 13 }, lineHeight: 1.35 }}>
                  {nextStepLabel}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.46)', fontSize: 11.5, mt: 0.25 }}>
                  {completeness.doneCount}/{completeness.totalCount} complete
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={completeness.score}
                  sx={{
                    mt: 1,
                    height: 5,
                    borderRadius: 999,
                    bgcolor: 'rgba(255,255,255,0.06)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 999,
                      background: `linear-gradient(90deg, ${tone.accent}, ${tone.accent}cc)`,
                    },
                  }}
                />
              </Box>
            </Box>

            <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' }, justifyContent: 'flex-end' }}>
              <Button
                onClick={() => goToStep(nextStep?.key)}
                variant="contained"
                size="small"
                disabled={!nextStep}
                sx={{
                  minWidth: { xs: '100%', sm: 118 },
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 800,
                  background: `linear-gradient(135deg, ${tone.accent}, ${tone.accent}cc)`,
                  color: completeness.score >= 70 ? '#001014' : '#fff',
                  boxShadow: `0 8px 20px ${tone.glow}`,
                  '&:hover': { background: `linear-gradient(135deg, ${tone.accent}, ${tone.accent}cc)` },
                }}
              >
                Continue
              </Button>
              {showDismiss && (
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
                  sx={{ color: 'rgba(255,255,255,0.4)', bgcolor: 'rgba(255,255,255,0.03)' }}
                  aria-label="Dismiss profile reminder"
                >
                  <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
              )}
            </Stack>
          </Stack>
        </Paper>
      </Fade>
    );
  }

  return (
    <Fade in timeout={500}>
      <Paper
        elevation={0}
        sx={{
          mx: { xs: 0.75, sm: 1.5 },
          mb: 2.5,
          p: { xs: 1.5, sm: 2.25 },
          borderRadius: '24px',
          background: `linear-gradient(160deg, rgba(12,14,20,0.98) 0%, rgba(20,24,34,0.96) 100%)`,
          border: `1px solid ${tone.accent}22`,
          boxShadow: `0 18px 42px rgba(0,0,0,0.36), 0 0 0 1px rgba(255,255,255,0.02) inset`,
          backdropFilter: 'blur(22px)',
          overflow: 'hidden',
        }}
      >
        <Stack spacing={2.25}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Box sx={{ position: 'relative', width: { xs: 74, sm: 88 }, height: { xs: 74, sm: 88 }, flexShrink: 0 }}>
              <Avatar
                src={completeness.profileImage || undefined}
                sx={{
                  width: '100%',
                  height: '100%',
                  bgcolor: tone.surface,
                  color: tone.accent,
                  fontWeight: 900,
                  fontSize: { xs: 22, sm: 26 },
                  border: `1px solid ${tone.accent}40`,
                }}
              >
                {completeness.initials}
              </Avatar>
              <Box sx={{ position: 'absolute', inset: -8, pointerEvents: 'none' }}>
                <CircularProgress size={100} strokeWidth={4} value={completeness.score} color={tone.accent} />
              </Box>
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ color: '#fff', fontSize: { xs: 17, sm: 19 }, fontWeight: 900, lineHeight: 1.2 }}>
                    Profile Completion
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.58)', fontSize: { xs: 12.5, sm: 13.5 }, mt: 0.45, lineHeight: 1.4 }}>
                    Finish the basics to improve discovery, trust, and message volume.
                  </Typography>
                </Box>
                {showDismiss && (
                  <IconButton
                    size="small"
                    onClick={handleDismiss}
                    sx={{ color: 'rgba(255,255,255,0.34)', bgcolor: 'rgba(255,255,255,0.03)' }}
                    aria-label="Dismiss profile reminder"
                  >
                    <CloseIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                )}
              </Stack>

              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                <Chip
                  label={`${completeness.doneCount}/${completeness.totalCount} complete`}
                  size="small"
                  sx={{ bgcolor: tone.surface, color: tone.accent, border: `1px solid ${tone.accent}26`, fontWeight: 800 }}
                />
                <Chip
                  label={tone.label}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.74)', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 700 }}
                />
                {nextStep && (
                  <Chip
                    label={`Next: ${nextStep.label}`}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.82)', border: '1px solid rgba(255,255,255,0.08)' }}
                  />
                )}
              </Stack>
            </Box>
          </Stack>

          <LinearProgress
            variant="determinate"
            value={completeness.score}
            sx={{
              height: 7,
              borderRadius: 999,
              bgcolor: 'rgba(255,255,255,0.05)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 999,
                background: `linear-gradient(90deg, ${tone.accent}, ${tone.accent}cc)`,
              },
            }}
          />

          {completeness.score < 30 && (
            <Box
              sx={{
                p: { xs: 1.25, sm: 1.5 },
                borderRadius: '14px',
                background: 'rgba(255,68,102,0.10)',
                border: '1px solid rgba(255,68,102,0.22)',
              }}
            >
              <Typography sx={{ fontSize: { xs: 11.5, sm: 12.5 }, color: '#ff9db0', fontWeight: 700, lineHeight: 1.5 }}>
                Your profile is currently underpowered in search. Add the missing basics to become visible faster.
              </Typography>
            </Box>
          )}

          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography sx={{ color: 'rgba(255,255,255,0.52)', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Finish these next
              </Typography>
              <Button
                size="small"
                onClick={() => setShowSteps((prev) => !prev)}
                sx={{ textTransform: 'none', color: tone.accent, fontWeight: 800, minWidth: 0, px: 0.5 }}
              >
                {showSteps ? 'Hide details' : 'View all steps'}
              </Button>
            </Stack>

            <Stack spacing={1}>
              {remainingSteps.slice(0, 3).map(renderStepRow)}
            </Stack>
          </Box>

          <Collapse in={showSteps || completeness.score < 50} timeout={300}>
            <Box sx={{ pt: 0.25 }}>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 1.5 }} />
              <Stack spacing={1}>
                {completeness.steps.map(renderStepRow)}
              </Stack>
            </Box>
          </Collapse>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <Button
              fullWidth
              variant="contained"
              onClick={() => goToStep(nextStep?.key)}
              disabled={!nextStep}
              sx={{
                minHeight: 48,
                borderRadius: '14px',
                textTransform: 'none',
                fontWeight: 900,
                background: `linear-gradient(135deg, ${tone.accent}, ${tone.accent}cc)`,
                color: completeness.score >= 70 ? '#001014' : '#fff',
                boxShadow: `0 12px 24px ${tone.glow}`,
                '&:hover': { background: `linear-gradient(135deg, ${tone.accent}, ${tone.accent}cc)` },
              }}
              endIcon={<ChevronRightIcon />}
            >
              {nextStep ? `Complete: ${nextStep.label}` : 'Profile complete'}
            </Button>

            <Button
              fullWidth
              variant="outlined"
              onClick={() => setShowSteps((prev) => !prev)}
              sx={{
                minHeight: 48,
                borderRadius: '14px',
                textTransform: 'none',
                fontWeight: 800,
                borderColor: 'rgba(255,255,255,0.14)',
                color: 'rgba(255,255,255,0.84)',
                '&:hover': { borderColor: tone.accent, bgcolor: 'rgba(255,255,255,0.03)' },
              }}
            >
              {showSteps ? 'Hide steps' : 'See all steps'}
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Fade>
  );
};

export default ProfileCompletionReminder;

