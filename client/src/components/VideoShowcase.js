import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { motion } from 'framer-motion';
import { ArrowForward } from '@mui/icons-material';
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

const VideoShowcase = () => {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const nextVideoRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentDescription, setCurrentDescription] = useState(videoDescriptions[0]);
  const [isVideoReady, setIsVideoReady] = useState(false);

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
    playVideo();
  }, [playVideo]);

  // Handle video end - go to next
  const handleVideoEnd = useCallback(() => {
    const nextIdx = getNextIndex(currentIndex);
    setCurrentIndex(nextIdx);
    setCurrentDescription(getRandomDescription());
    setIsVideoReady(false);
  }, [currentIndex, getNextIndex, getRandomDescription]);

  // Handle video error - skip to next
  const handleVideoError = useCallback(() => {
    const nextIdx = getNextIndex(currentIndex);
    setCurrentIndex(nextIdx);
    setCurrentDescription(getRandomDescription());
  }, [currentIndex, getNextIndex, getRandomDescription]);

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
    const timer = setTimeout(() => {
      playVideo();
    }, 100);
    return () => clearTimeout(timer);
  }, [currentIndex, playVideo]);

  // Auto-advance if video stalls for too long
  useEffect(() => {
    const stallTimer = setTimeout(() => {
      if (!isVideoReady) {
        // Video taking too long, try next
        handleVideoEnd();
      }
    }, 8000); // 8 seconds timeout
    return () => clearTimeout(stallTimer);
  }, [currentIndex, isVideoReady, handleVideoEnd]);

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
      <video
        ref={videoRef}
        key={currentIndex}
        src={getVideoUrl(currentIndex)}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 1,
        }}
        muted
        playsInline
        autoPlay
        preload="auto"
        onCanPlay={handleCanPlay}
        onEnded={handleVideoEnd}
        onError={handleVideoError}
      />

      {/* Hidden preload video for next */}
      <video
        ref={nextVideoRef}
        style={{ display: 'none' }}
        muted
        playsInline
        preload="auto"
      />

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
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
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
