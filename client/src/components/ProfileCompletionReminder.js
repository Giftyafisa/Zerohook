import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectUser } from '../store/slices/authSlice';
import { Box, Typography, IconButton, LinearProgress } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

/**
 * ProfileCompletionReminder — Redesigned
 *
 * Modern glassmorphism card that shows profile completion status with
 * step indicators. Responsive for both mobile and desktop. Dismissable
 * for 24 hours.
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
        emoji: '📸',
        done: !!(user.profile_image || profileData.profilePicture || profileData.avatar),
        weight: 20,
      },
      {
        key: 'location',
        label: 'Location',
        emoji: '📍',
        done: !!(loc.city && loc.country),
        weight: 15,
      },
      {
        key: 'bio',
        label: 'Bio (20+ chars)',
        emoji: '✏️',
        done: !!(profileData.bio && profileData.bio.length >= 20),
        weight: 15,
      },
      {
        key: 'name',
        label: 'Display name',
        emoji: '👤',
        done: !!(profileData.firstName || profileData.lastName || user.username),
        weight: 10,
      },
      {
        key: 'age',
        label: 'Age',
        emoji: '🎂',
        done: !!profileData.age,
        weight: 10,
      },
      {
        key: 'gps',
        label: 'GPS enabled',
        emoji: '🛰️',
        done: !!(loc.coordinates?.lat && loc.coordinates?.lng),
        weight: 10,
      },
      {
        key: 'gallery',
        label: '3+ gallery photos',
        emoji: '🖼️',
        done: !!(profileData.photos && profileData.photos.length >= 3),
        weight: 10,
      },
      {
        key: 'phone',
        label: 'Phone verified',
        emoji: '📱',
        done: !!user.phone_verified,
        weight: 5,
      },
      {
        key: 'services',
        label: 'Services / interests',
        emoji: '⭐',
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

  // Don't render if dismissed, loading, no user, or profile is ≥ 90%
  if (loading || dismissed || !user || !completeness || completeness.score >= 90) return null;

  // ───── Accent colour based on progress ─────
  const accent =
    completeness.score >= 70 ? '#00f2ea'
    : completeness.score >= 40 ? '#ff9800'
    : '#ff4466';

  const accentBg =
    completeness.score >= 70 ? 'rgba(0,242,234,0.10)'
    : completeness.score >= 40 ? 'rgba(255,152,0,0.10)'
    : 'rgba(255,68,102,0.10)';

  // ═══════════════════════════════════════════════════════════════════════════
  // BANNER variant — slim one-liner used inside feed pages
  // ═══════════════════════════════════════════════════════════════════════════
  if (variant === 'banner') {
    return (
      <Box
        onClick={() => navigate('/settings')}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: { xs: 1.5, sm: 2 },
          py: { xs: 1, sm: 1.2 },
          mx: { xs: 0, sm: 1 },
          mb: 1.5,
          borderRadius: '12px',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${accent}44`,
          backdropFilter: 'blur(12px)',
          cursor: 'pointer',
          transition: 'all 0.2s',
          '&:hover': { background: 'rgba(255,255,255,0.07)', borderColor: `${accent}88` },
          overflow: 'hidden',
          minHeight: 44,
        }}
      >
        {/* Circular progress ring */}
        <Box sx={{ position: 'relative', minWidth: 34, minHeight: 34 }}>
          <svg width={34} height={34} viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15" fill="none"
              stroke={accent} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${completeness.score * 0.942} 100`}
            />
          </svg>
          <Typography
            sx={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              fontSize: 9, fontWeight: 800, color: accent, lineHeight: 1,
            }}
          >
            {completeness.score}%
          </Typography>
        </Box>

        {/* Text */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontSize: { xs: 12, sm: 13 }, fontWeight: 600,
              color: 'rgba(255,255,255,0.85)', lineHeight: 1.3,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}
          >
            {completeness.score < 40
              ? 'Your profile is barely visible — complete it now'
              : completeness.nextStep
                ? `Next: ${completeness.nextStep.emoji} ${completeness.nextStep.label}`
                : 'Almost there! Finish your profile'}
          </Typography>
          <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', lineHeight: 1.2, mt: 0.2 }}>
            {completeness.doneCount}/{completeness.totalCount} steps done · Tap to complete
          </Typography>
        </Box>

        {/* Dismiss X */}
        {showDismiss && (
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
            sx={{ color: 'rgba(255,255,255,0.3)', p: 0.5, '&:hover': { color: 'rgba(255,255,255,0.6)' } }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        )}
      </Box>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CARD variant — full breakdown with step indicators
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <Box
      sx={{
        mx: { xs: 0, sm: 1 },
        mb: 2,
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${accent}33`,
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
      }}
    >
      {/* ── Header row ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: { xs: 2, sm: 2.5 },
          pb: 0,
        }}
      >
        {/* Big circular progress */}
        <Box sx={{ position: 'relative', minWidth: 56, minHeight: 56 }}>
          <svg width={56} height={56} viewBox="0 0 60 60" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
            <circle
              cx="30" cy="30" r="26" fill="none"
              stroke={accent} strokeWidth="4" strokeLinecap="round"
              strokeDasharray={`${completeness.score * 1.634} 200`}
            />
          </svg>
          <Typography
            sx={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              fontSize: 15, fontWeight: 800, color: accent, lineHeight: 1,
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
            sx={{ color: 'rgba(255,255,255,0.25)', '&:hover': { color: 'rgba(255,255,255,0.5)' } }}
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
            },
          }}
        />
      </Box>

      {/* ── Low-score warning ── */}
      {completeness.score < 30 && (
        <Box
          sx={{
            mx: { xs: 2, sm: 2.5 }, mt: 0.5, mb: 1,
            p: 1.5, borderRadius: '10px',
            background: 'rgba(255,68,102,0.08)',
            border: '1px solid rgba(255,68,102,0.2)',
          }}
        >
          <Typography sx={{ fontSize: 12, color: '#ff8a9e', fontWeight: 600, lineHeight: 1.4 }}>
            ⚠️ Your profile is hidden from search results. Complete the steps
            below to appear in the marketplace.
          </Typography>
        </Box>
      )}

      {/* ── Steps grid ── */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' },
          gap: 1,
          p: { xs: 1.5, sm: 2 },
          pt: 1,
        }}
      >
        {completeness.steps.map((step) => (
          <Box
            key={step.key}
            onClick={() => !step.done && navigate('/settings')}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.2,
              py: 0.8,
              borderRadius: '8px',
              background: step.done ? `${accent}11` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${step.done ? `${accent}33` : 'rgba(255,255,255,0.06)'}`,
              cursor: step.done ? 'default' : 'pointer',
              transition: 'all 0.15s',
              ...(!step.done && {
                '&:hover': { background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.12)' },
              }),
              opacity: step.done ? 0.7 : 1,
            }}
          >
            <Typography sx={{ fontSize: 15, lineHeight: 1 }}>
              {step.done ? '✅' : step.emoji}
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: 11, sm: 12 },
                fontWeight: step.done ? 500 : 600,
                color: step.done ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.8)',
                textDecoration: step.done ? 'line-through' : 'none',
                lineHeight: 1.2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {step.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── CTA button ── */}
      <Box sx={{ px: { xs: 1.5, sm: 2 }, pb: 2, pt: 0.5 }}>
        <Box
          onClick={() => navigate('/settings')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            py: 1.2,
            borderRadius: '10px',
            background: `linear-gradient(135deg, ${accent}, ${accent}bb)`,
            color: completeness.score >= 70 ? '#000' : '#fff',
            fontWeight: 700,
            fontSize: { xs: 13, sm: 14 },
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': { filter: 'brightness(1.15)', transform: 'translateY(-1px)' },
            '&:active': { transform: 'scale(0.98)' },
          }}
        >
          {completeness.nextStep
            ? `Complete: ${completeness.nextStep.emoji} ${completeness.nextStep.label}`
            : 'Complete Your Profile'}
        </Box>
      </Box>
    </Box>
  );
};

export default ProfileCompletionReminder;

