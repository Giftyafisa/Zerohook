import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, Button, Chip, IconButton } from '@mui/material';
import { motion } from 'framer-motion';
import {
  ArrowForward,
  ChevronLeft,
  ChevronRight,
  Pause,
  PlayArrow,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

// Video descriptions that rotate with videos
const videoDescriptions = [
  "Chat her today 💬",
  "Enjoy all these 🔥",
  "Do you like what you see? 👀",
  "You can nack her now 💋",
  "Order me now let have fun 🎉",
  "How is your night? 🌙",
  "Shorts or long? ⏱️",
  "Premium pleasure awaits 💎",
  "Available 24/7 for you 🌟",
  "Experience the difference ✨"
];

// Video files - served from public/videos/
const videoFiles = [
  'video1.mp4',
  'video2.mp4',
  'video3.mp4',
  'video4.mp4',
  'video5.mp4',
  'video6.mp4',
  'video7.mp4',
  'video8.mp4',
  'video9.mp4',
  'video10.mp4'
];

const VIDEO_SWIPE_THRESHOLD_PX = 42;

const VideoShowcase = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const nextVideoRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentDescription, setCurrentDescription] = useState(videoDescriptions[0]);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [videoCycle, setVideoCycle] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showHint, setShowHint] = useState(true);

  // Get video URL
  const getVideoUrl = useCallback((index) => {
    return `${process.env.PUBLIC_URL || ''}/videos/${videoFiles[index]}`;
  }, []);

  // Get random description
  const getRandomDescription = useCallback(() => {
    return videoDescriptions[Math.floor(Math.random() * videoDescriptions.length)];
  }, []);

  // Next video index
  const getNextIndex = useCallback((current) => {
    return (current + 1) % videoFiles.length;
  }, []);

  // Play current video
  const playVideo = useCallback(() => {
    if (videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay was prevented, try again with user interaction simulation
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
          }, 100);
        });
      }
    }
  }, []);

  // Handle video can play - immediate play
  const handleCanPlay = useCallback(() => {
    setIsVideoReady(true);
    setPlaybackProgress(0);
    playVideo();
  }, [playVideo]);

  // Handle video end - go to next
  const handleVideoEnd = useCallback(() => {
    const nextIdx = getNextIndex(currentIndex);
    setCurrentIndex(nextIdx);
    setCurrentDescription(getRandomDescription());
    setIsVideoReady(false);
    setPlaybackProgress(0);
    setIsPaused(false);
    setVideoCycle((prev) => prev + 1);
  }, [currentIndex, getNextIndex, getRandomDescription]);

  // Handle video error - skip to next
  const handleVideoError = useCallback(() => {
    const nextIdx = getNextIndex(currentIndex);
    setCurrentIndex(nextIdx);
    setCurrentDescription(getRandomDescription());
    setPlaybackProgress(0);
    setIsPaused(false);
    setVideoCycle((prev) => prev + 1);
  }, [currentIndex, getNextIndex, getRandomDescription]);

  const handleTimeUpdate = useCallback(() => {
    const element = videoRef.current;
    if (!element || !element.duration || !Number.isFinite(element.duration)) return;
    const ratio = Math.min(1, Math.max(0, element.currentTime / element.duration));
    setPlaybackProgress(ratio);
  }, []);

  const goToVideo = useCallback((targetIndex) => {
    setCurrentIndex(targetIndex);
    setCurrentDescription(getRandomDescription());
    setIsVideoReady(false);
    setPlaybackProgress(0);
    setIsPaused(false);
    setVideoCycle((prev) => prev + 1);
  }, [getRandomDescription]);

  const handleNextVideo = useCallback(() => {
    goToVideo(getNextIndex(currentIndex));
  }, [currentIndex, getNextIndex, goToVideo]);

  const handlePreviousVideo = useCallback(() => {
    goToVideo((currentIndex - 1 + videoFiles.length) % videoFiles.length);
  }, [currentIndex, goToVideo]);

  const handleVideoSurfaceSwipe = useCallback((offsetX) => {
    if (offsetX <= -VIDEO_SWIPE_THRESHOLD_PX) {
      handleNextVideo();
      return;
    }
    if (offsetX >= VIDEO_SWIPE_THRESHOLD_PX) {
      handlePreviousVideo();
    }
  }, [handleNextVideo, handlePreviousVideo]);

  const togglePause = useCallback(() => {
    const element = videoRef.current;
    if (!element) return;

    if (element.paused) {
      element.play().catch(() => {});
      setIsPaused(false);
      return;
    }

    element.pause();
    setIsPaused(true);
  }, []);

  // Preload next video
  useEffect(() => {
    const nextIdx = getNextIndex(currentIndex);
    if (nextVideoRef.current) {
      nextVideoRef.current.src = getVideoUrl(nextIdx);
      nextVideoRef.current.load();
    }
  }, [currentIndex, getNextIndex, getVideoUrl]);

  // Initial play attempt
  useEffect(() => {
    if (isPaused) return undefined;

    const timer = setTimeout(() => {
      playVideo();
    }, 100);
    return () => clearTimeout(timer);
  }, [currentIndex, isPaused, playVideo]);

  // Auto-advance if video stalls for too long
  useEffect(() => {
    const stallTimer = setTimeout(() => {
      if (!isVideoReady && !isPaused) {
        // Video taking too long, try next
        handleVideoEnd();
      }
    }, 8000); // 8 seconds timeout
    return () => clearTimeout(stallTimer);
  }, [currentIndex, isVideoReady, isPaused, handleVideoEnd]);

  useEffect(() => {
    const hintTimer = setTimeout(() => {
      setShowHint(false);
    }, 7000);
    return () => clearTimeout(hintTimer);
  }, []);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: { xs: '70vh', sm: '80vh', md: '85vh' },
        maxHeight: { xs: '550px', sm: '700px', md: '800px' },
        minHeight: { xs: '400px', sm: '500px' },
        background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0f0f23 100%)',
        overflow: 'hidden',
      }}
    >
      {/* Main Video Player */}
      <motion.video
        ref={videoRef}
        key={currentIndex}
        src={getVideoUrl(currentIndex)}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.12}
        dragMomentum={false}
        onDragEnd={(_, info) => handleVideoSurfaceSwipe(info.offset.x)}
        onPointerDown={() => setShowHint(false)}
        initial={{ opacity: 0, scale: 1.14, filter: 'blur(4px)' }}
        animate={{
          opacity: isVideoReady ? 1 : 0.7,
          scale: isVideoReady ? 1.01 : 1.08,
          filter: isVideoReady ? 'blur(0px)' : 'blur(2px)',
        }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 1,
          transformOrigin: 'center center',
          touchAction: 'pan-y',
        }}
        muted
        playsInline
        autoPlay
        preload="auto"
        onCanPlay={handleCanPlay}
        onEnded={handleVideoEnd}
        onError={handleVideoError}
        onTimeUpdate={handleTimeUpdate}
      />

      {/* Hidden preload video for next */}
      <video
        ref={nextVideoRef}
        style={{ display: 'none' }}
        muted
        playsInline
        preload="auto"
      />

      {/* Lightweight mobile controls */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 8,
          pointerEvents: 'none',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '42%',
            left: 0,
            right: 0,
            px: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <IconButton
            onClick={handlePreviousVideo}
            sx={{
              pointerEvents: 'auto',
              bgcolor: 'rgba(0,0,0,0.32)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
            size="small"
            aria-label="Previous video"
          >
            <ChevronLeft />
          </IconButton>
          <IconButton
            onClick={togglePause}
            sx={{
              pointerEvents: 'auto',
              bgcolor: 'rgba(0,0,0,0.36)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
            size="small"
            aria-label={isPaused ? 'Play video' : 'Pause video'}
          >
            {isPaused ? <PlayArrow /> : <Pause />}
          </IconButton>
          <IconButton
            onClick={handleNextVideo}
            sx={{
              pointerEvents: 'auto',
              bgcolor: 'rgba(0,0,0,0.32)',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.25)',
            }}
            size="small"
            aria-label="Next video"
          >
            <ChevronRight />
          </IconButton>
        </Box>
      </Box>

      {/* Gradient Overlay - Bottom only */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '55%',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.9))',
          pointerEvents: 'none',
          zIndex: 2
        }}
      />

      {/* Cinematic top overlay + status chips */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          p: { xs: 1.2, sm: 1.6, md: 2 },
          zIndex: 9,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.0) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexWrap: 'wrap' }}>
          <Chip
            size="small"
            label="Live Preview"
            sx={{
              color: '#d7fff9',
              bgcolor: 'rgba(0, 242, 234, 0.16)',
              border: '1px solid rgba(0, 242, 234, 0.38)',
              fontWeight: 700,
              fontSize: '0.7rem',
            }}
          />
          <Chip
            size="small"
            label="HD"
            sx={{
              color: '#ffe8f1',
              bgcolor: 'rgba(255, 0, 85, 0.18)',
              border: '1px solid rgba(255, 0, 85, 0.38)',
              fontWeight: 700,
              fontSize: '0.7rem',
            }}
          />
          <Chip
            size="small"
            label={isPaused ? 'Paused' : 'Auto-play'}
            sx={{
              color: '#d7fff9',
              bgcolor: isPaused ? 'rgba(255,255,255,0.14)' : 'rgba(0, 242, 234, 0.16)',
              border: '1px solid rgba(255,255,255,0.28)',
              fontWeight: 700,
              fontSize: '0.7rem',
            }}
          />
        </Box>
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.88)',
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            fontFamily: '"Outfit", sans-serif',
          }}
        >
          Clip {currentIndex + 1}/{videoFiles.length}
        </Typography>
      </Box>

      {/* Segmented progress like story reels */}
      <Box
        sx={{
          position: 'absolute',
          top: { xs: 44, sm: 52, md: 56 },
          left: 12,
          right: 12,
          zIndex: 9,
          display: 'grid',
          gridTemplateColumns: `repeat(${videoFiles.length}, minmax(0, 1fr))`,
          gap: 0.5,
        }}
      >
        {videoFiles.map((_, index) => {
          const width = index < currentIndex
            ? '100%'
            : index === currentIndex
              ? `${Math.max(2, Math.round(playbackProgress * 100))}%`
              : '0%';

          return (
            <Box
              key={`progress-${index}`}
              sx={{
                height: 3,
                borderRadius: 999,
                overflow: 'hidden',
                bgcolor: 'rgba(255,255,255,0.20)',
              }}
            >
              <motion.div
                key={`${currentIndex}-${videoCycle}-${index}`}
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, #00f2ea 0%, #00d4aa 45%, #ff4f93 100%)',
                  borderRadius: '999px',
                }}
                animate={{ width }}
                transition={{ duration: index === currentIndex ? 0.15 : 0.3, ease: 'linear' }}
              />
            </Box>
          );
        })}
      </Box>

      {/* Bottom Content */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          p: { xs: 2.5, sm: 3, md: 5 },
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          alignItems: { xs: 'center', md: 'flex-start' },
        }}
      >
        {/* Description */}
        <motion.div
          key={currentDescription}
          initial={{ opacity: 0, y: 18, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.45 }}
        >
          <Typography
            variant="h4"
            sx={{
              color: 'white',
              fontWeight: 800,
              mb: 0.5,
              textShadow: '0 2px 20px rgba(0,0,0,0.8)',
              fontSize: { xs: '1.4rem', sm: '1.8rem', md: '2.5rem' },
              textAlign: { xs: 'center', md: 'left' },
              fontFamily: '"Outfit", sans-serif',
            }}
          >
            {currentDescription}
          </Typography>
        </motion.div>

        {/* Tagline */}
        <Typography
          sx={{
            color: 'rgba(255,255,255,0.85)',
            mb: 2.5,
            fontSize: { xs: '0.85rem', sm: '0.95rem', md: '1.1rem' },
            textAlign: { xs: 'center', md: 'left' },
            fontFamily: '"Outfit", sans-serif',
            textShadow: '0 1px 10px rgba(0,0,0,0.5)',
          }}
        >
          Real profiles • Verified providers • Safe connections
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: { xs: 'center', md: 'flex-start' },
            flexWrap: 'wrap',
            gap: 0.8,
            mb: 2.3,
          }}
        >
          {['Escrow-secured', 'KYC-verified', '24/7 support'].map((item) => (
            <Chip
              key={item}
              size="small"
              label={item}
              sx={{
                color: '#e5fffb',
                bgcolor: 'rgba(0, 242, 234, 0.12)',
                border: '1px solid rgba(0, 242, 234, 0.3)',
                fontWeight: 700,
                fontSize: '0.68rem',
              }}
            />
          ))}
        </Box>

        {showHint && (
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.68)',
              fontSize: '0.72rem',
              mb: 1.4,
              fontFamily: '"Outfit", sans-serif',
              textAlign: { xs: 'center', md: 'left' },
            }}
          >
            Tap arrows to preview more clips and pause anytime.
          </Typography>
        )}

        {/* CTA Button */}
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          <Button
            variant="contained"
            size="large"
            endIcon={<ArrowForward />}
            onClick={() => navigate('/register')}
            sx={{
              background: 'linear-gradient(135deg, #00f2ea, #00d4aa)',
              color: '#000',
              py: { xs: 1.25, sm: 1.5, md: 2 },
              px: { xs: 3.5, sm: 4, md: 6 },
              borderRadius: 3,
              fontWeight: 800,
              fontSize: { xs: '0.95rem', sm: '1rem', md: '1.2rem' },
              textTransform: 'none',
              boxShadow: '0 8px 30px rgba(0,242,234,0.4)',
              fontFamily: '"Outfit", sans-serif',
              '&:hover': {
                background: 'linear-gradient(135deg, #00d4aa, #00f2ea)',
                boxShadow: '0 12px 40px rgba(0,242,234,0.5)'
              }
            }}
          >
            Join Us Now
          </Button>
        </motion.div>
      </Box>
    </Box>
  );
};

export default VideoShowcase;
