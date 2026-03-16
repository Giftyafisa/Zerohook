import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectUser } from '../store/slices/authSlice';
import { Box, Typography, IconButton, LinearProgress, Collapse, Fade } from '@mui/material';
import { Close as CloseIcon, ChevronRight as ChevronRightIcon, CheckCircle as CheckCircleIcon } from '@mui/icons-material';

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

  // Check if reminder was recently dismissed
  useEffect(() => {
    const dismissedUntil = localStorage.getItem('profileReminderDismissedUntil');
    if (dismissedUntil && new Date(dismissedUntil) > new Date()) {
      setDismissed(true);
    }
  }, []);

  // Calculate profile completeness
  useEffect(() => {
    if (!user) { setLoading(false); return; }

    const profileData = user.profile_data || user.profileData || {};
    const loc = profileData.location || {};

    const steps = [
      {
        key: 'photo',
        label: 'Profile photo',
        icon: '📸',
        done: !!(
          user.profile_image ||
          user.profile_image_url ||
          profileData.profilePicture ||
          profileData.avatar ||
          profileData.profile_image_url
        ),
        weight: 20,
      },
      {
        key: 'location',
        label: 'Location',
        icon: '📍',
        done: !!(loc.city && loc.country),
        weight: 15,
      },
      {
        key: 'bio',
        label: 'Bio (20+ chars)',
        icon: '✏️',
        done: !!(profileData.bio && profileData.bio.length >= 20),
        weight: 15,
      },
      {
        key: 'name',
        label: 'Display name',
        icon: '👤',
        done: !!(profileData.firstName || profileData.lastName || user.username),
        weight: 10,
      },
      {
        key: 'age',
        label: 'Age',
        icon: '🎂',
        done: !!profileData.age,
        weight: 10,
      },
      {
        key: 'gps',
        label: 'GPS enabled',
        icon: '🛰️',
        done: !!(loc.coordinates?.lat && loc.coordinates?.lng),
        weight: 10,
      },
      {
        key: 'gallery',
        label: '3+ gallery photos',
        icon: '🖼️',
        done: !!(profileData.photos && profileData.photos.length >= 3),
        weight: 10,
      },
      {
        key: 'phone',
        label: 'Phone verified',
        icon: '📱',
        done: !!user.phone_verified,
        weight: 5,
      },
      {
        key: 'services',
        label: 'Services / interests',
        icon: '⭐',
        done: !!(profileData.services && profileData.services.length > 0),
        weight: 5,
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
    });
    setLoading(false);
  }, [user]);

  const handleDismiss = () => {
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000);
    localStorage.setItem('profileReminderDismissedUntil', until.toISOString());
    setDismissed(true);
    onDismiss?.();
  };

  const goToStep = (stepKey) => {
    // Route users to the most relevant flow for the missing step.
    if (stepKey === 'photo' || stepKey === 'bio' || stepKey === 'name' || stepKey === 'age' || stepKey === 'gallery') {
      navigate('/profile');
      return;
    }
    if (stepKey === 'phone') {
      navigate('/settings', { state: { focusSection: 'security', focusVerification: true } });
      return;
    }
    if (stepKey === 'location' || stepKey === 'gps') {
      navigate('/settings', { state: { focusSection: 'location' } });
      return;
    }
    if (stepKey === 'services') {
      navigate('/settings', { state: { focusSection: 'visibility' } });
      return;
    }
    navigate('/settings');
  };

  // Don't render if dismissed, loading, no user, or profile is ≥ 90%
  if (loading || dismissed || !user || !completeness || completeness.score >= 90) return null;

  // ───── Accent colour based on progress ─────
  const accent =
    completeness.score >= 70 ? '#00f2ea'
    : completeness.score >= 40 ? '#ff9800'
    : '#ff4466';

  const accentGlow =
    completeness.score >= 70 ? 'rgba(0,242,234,0.25)'
    : completeness.score >= 40 ? 'rgba(255,152,0,0.25)'
    : 'rgba(255,68,102,0.25)';

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

  // ═══════════════════════════════════════════════════════════════════════════
  // BANNER variant — slim inline bar for feed pages
  // ═══════════════════════════════════════════════════════════════════════════
  if (variant === 'banner') {
    return (
      <Fade in timeout={400}>
        <Box
          onClick={() => goToStep(completeness.nextStep?.key)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.2, sm: 1.5 },
            px: { xs: 1.25, sm: 2.5 },
            py: { xs: 1.1, sm: 1.4 },
            mx: { xs: 0.75, sm: 1.5 },
            mb: 1.5,
            borderRadius: '14px',
            background: `linear-gradient(135deg, rgba(30,30,40,0.85) 0%, rgba(20,20,30,0.95) 100%)`,
            border: `1px solid ${accent}33`,
            boxShadow: `0 4px 20px ${accentGlow}, inset 0 1px 0 rgba(255,255,255,0.04)`,
            backdropFilter: 'blur(16px)',
            cursor: 'pointer',
            transition: 'all 0.25s ease',
            '&:hover': {
              borderColor: `${accent}66`,
              boxShadow: `0 6px 24px ${accentGlow}`,
              transform: 'translateY(-1px)',
            },
            overflow: 'hidden',
            minHeight: { xs: 56, sm: 56 },
            position: 'relative',
          }}
        >
          {/* Circular progress ring */}
            <Box sx={{ position: 'relative', minWidth: { xs: 40, sm: 42 }, minHeight: { xs: 40, sm: 42 }, flexShrink: 0 }}>
            <CircularProgress
              size={38}
              strokeWidth={3}
              value={completeness.score}
              color={accent}
            />
            <Typography
              sx={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                fontSize: { xs: 10, sm: 11 }, fontWeight: 800, color: accent, lineHeight: 1,
                fontFamily: 'monospace',
              }}
            >
              {completeness.score}%
            </Typography>
          </Box>

          {/* Text content */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: { xs: 12.5, sm: 13.5 }, fontWeight: 700,
                color: 'rgba(255,255,255,0.9)', lineHeight: 1.3,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
            >
              {completeness.score < 40
                ? 'Complete your profile to get discovered'
                : completeness.nextStep
                  ? `Next: ${completeness.nextStep.icon} ${completeness.nextStep.label}`
                  : 'Almost done! Finish your profile'}
            </Typography>
            <Typography sx={{ fontSize: { xs: 10.5, sm: 11 }, color: 'rgba(255,255,255,0.45)', lineHeight: 1.2, mt: 0.3 }}>
              {completeness.doneCount}/{completeness.totalCount} steps · Tap to complete
            </Typography>
          </Box>

          {/* Arrow indicator */}
          <ChevronRightIcon sx={{ fontSize: 20, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />

          {/* Dismiss X */}
          {showDismiss && (
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
              sx={{
                color: 'rgba(255,255,255,0.3)', p: 0.8, ml: -0.25,
                width: 32,
                height: 32,
                '&:hover': { color: 'rgba(255,255,255,0.6)', bgcolor: 'rgba(255,255,255,0.05)' },
              }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          )}
        </Box>
      </Fade>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARD variant — full breakdown with step indicators
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <Fade in timeout={500}>
      <Box
        sx={{
          mx: { xs: 0.75, sm: 1.5 },
          mb: 2.5,
          borderRadius: '18px',
          background: `linear-gradient(160deg, rgba(30,30,40,0.9) 0%, rgba(18,18,25,0.97) 100%)`,
          border: `1px solid ${accent}22`,
          boxShadow: `0 8px 32px rgba(0,0,0,0.3), 0 2px 12px ${accentGlow}`,
          backdropFilter: 'blur(20px)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header row ── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1.5, sm: 2 },
            p: { xs: 1.5, sm: 2.5 },
            pb: 0,
          }}
        >
          {/* Big circular progress */}
          <Box sx={{ position: 'relative', minWidth: { xs: 54, sm: 62 }, minHeight: { xs: 54, sm: 62 }, flexShrink: 0 }}>
            <CircularProgress
              size={58}
              strokeWidth={4}
              value={completeness.score}
              color={accent}
            />
            <Typography
              sx={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%) rotate(0deg)',
                fontSize: { xs: 14, sm: 16 }, fontWeight: 800, color: accent, lineHeight: 1,
                fontFamily: 'monospace',
              }}
            >
              {completeness.score}%
            </Typography>
          </Box>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: { xs: 15, sm: 17 }, fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>
              Profile Completion
            </Typography>
            <Typography sx={{ fontSize: { xs: 12, sm: 13 }, color: 'rgba(255,255,255,0.45)', mt: 0.3 }}>
              {completeness.doneCount} of {completeness.totalCount} steps complete
            </Typography>
          </Box>

          {showDismiss && (
            <IconButton
              size="small"
              onClick={handleDismiss}
              sx={{
                color: 'rgba(255,255,255,0.25)',
                width: 36,
                height: 36,
                '&:hover': { color: 'rgba(255,255,255,0.5)', bgcolor: 'rgba(255,255,255,0.05)' },
              }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          )}
        </Box>

        {/* ── Progress bar ── */}
        <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 1.5, pb: 1 }}>
          <LinearProgress
            variant="determinate"
            value={completeness.score}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'rgba(255,255,255,0.06)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                background: `linear-gradient(90deg, ${accent}, ${accent}cc)`,
                transition: 'transform 0.6s ease',
              },
            }}
          />
        </Box>

        {/* ── Low-score warning ── */}
        {completeness.score < 30 && (
          <Box
            sx={{
              mx: { xs: 2, sm: 2.5 }, mt: 0.5, mb: 1,
              p: { xs: 1.2, sm: 1.5 }, borderRadius: '10px',
              background: 'rgba(255,68,102,0.08)',
              border: '1px solid rgba(255,68,102,0.18)',
            }}
          >
            <Typography sx={{ fontSize: { xs: 11.5, sm: 12 }, color: '#ff8a9e', fontWeight: 600, lineHeight: 1.4 }}>
              ⚠️ Your profile is hidden from search results. Complete the steps
              below to appear in the marketplace.
            </Typography>
          </Box>
        )}

        {/* ── Toggle steps ── */}
        <Box
          onClick={() => setShowSteps(!showSteps)}
          sx={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 0.5, py: 0.8, mx: { xs: 1.5, sm: 2.5 }, mt: 0.5,
            minHeight: 44,
            cursor: 'pointer', borderRadius: '8px',
            '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
            transition: 'background 0.15s',
          }}
        >
          <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
            {showSteps ? 'Hide steps' : 'Show all steps'}
          </Typography>
          <ChevronRightIcon
            sx={{
              fontSize: 16, color: 'rgba(255,255,255,0.3)',
              transform: showSteps ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
            }}
          />
        </Box>

        {/* ── Steps list (collapsible) ── */}
        <Collapse in={showSteps || completeness.score < 30} timeout={300}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              px: { xs: 1.5, sm: 2 },
              pb: 1,
              maxHeight: { xs: 260, sm: 300 },
              overflowY: 'auto',
              '&::-webkit-scrollbar': { width: 3 },
              '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
            }}
          >
            {completeness.steps.map((step) => (
              <Box
                key={step.key}
                onClick={(e) => { e.stopPropagation(); if (!step.done) goToStep(step.key); }}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: { xs: 1, sm: 1.2 },
                  px: { xs: 1.2, sm: 1.5 },
                  py: { xs: 0.8, sm: 1 },
                  minHeight: 44,
                  borderRadius: '10px',
                  background: step.done ? `${accent}08` : 'rgba(255,255,255,0.015)',
                  border: `1px solid ${step.done ? `${accent}20` : 'rgba(255,255,255,0.04)'}`,
                  cursor: step.done ? 'default' : 'pointer',
                  transition: 'all 0.15s',
                  ...(!step.done && {
                    '&:hover': { background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.1)' },
                  }),
                }}
              >
                {/* Status icon */}
                <Box sx={{ minWidth: 24, display: 'flex', justifyContent: 'center' }}>
                  {step.done ? (
                    <CheckCircleIcon sx={{ fontSize: 18, color: accent, opacity: 0.7 }} />
                  ) : (
                    <Typography sx={{ fontSize: 16, lineHeight: 1 }}>{step.icon}</Typography>
                  )}
                </Box>
                {/* Label */}
                <Typography
                  sx={{
                    flex: 1,
                    fontSize: { xs: 12, sm: 13 },
                    fontWeight: step.done ? 500 : 600,
                    color: step.done ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.85)',
                    textDecoration: step.done ? 'line-through' : 'none',
                    lineHeight: 1.3,
                  }}
                >
                  {step.label}
                </Typography>
                {/* Arrow for incomplete */}
                {!step.done && (
                  <ChevronRightIcon sx={{ fontSize: 16, color: 'rgba(255,255,255,0.2)' }} />
                )}
              </Box>
            ))}
          </Box>
        </Collapse>

        {/* ── CTA button ── */}
        <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: 2, pt: 1 }}>
          <Box
            onClick={() => goToStep(completeness.nextStep?.key)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                goToStep(completeness.nextStep?.key);
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.8,
              py: { xs: 1.25, sm: 1.4 },
              minHeight: 48,
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
              color: completeness.score >= 70 ? '#000' : '#fff',
              fontWeight: 700,
              fontSize: { xs: 13, sm: 14 },
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: `0 4px 16px ${accentGlow}`,
              '&:hover': { filter: 'brightness(1.12)', transform: 'translateY(-1px)', boxShadow: `0 6px 20px ${accentGlow}` },
              '&:active': { transform: 'scale(0.98)' },
            }}
          >
            {completeness.nextStep
              ? `Complete: ${completeness.nextStep.icon} ${completeness.nextStep.label}`
              : 'Complete Your Profile'}
            <ChevronRightIcon sx={{ fontSize: 18 }} />
          </Box>
        </Box>
      </Box>
    </Fade>
  );
};

export default ProfileCompletionReminder;

