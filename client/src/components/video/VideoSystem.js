import React, { useState, useRef, useCallback } from 'react';
import { Box, IconButton, Typography, LinearProgress, Alert } from '@mui/material';
import {
  CloudUpload,
  PlayArrow,
  Pause,
  VolumeUp,
  VolumeOff,
  Fullscreen,
  FullscreenExit,
  Delete,
  Videocam,
  Close
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

// Glass-morphism styles matching Zerohook mobile design
const styles = {
  container: {
    background: 'rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(20px)',
    borderRadius: '16px',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },

  videoWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: '16/9',
    background: '#0f0f13',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },

  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    color: '#6a6a7a',
  },

  uploadArea: {
    padding: '40px',
    border: '2px dashed rgba(0, 242, 234, 0.3)',
    borderRadius: '16px',
    background: 'rgba(0, 242, 234, 0.05)',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    textAlign: 'center',
    '&:hover': {
      borderColor: 'rgba(0, 242, 234, 0.6)',
      background: 'rgba(0, 242, 234, 0.1)',
    },
  },

  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '16px',
    background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },

  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  progressBar: {
    flex: 1,
    height: '4px',
    borderRadius: '2px',
    cursor: 'pointer',
    '& .MuiLinearProgress-bar': {
      background: 'linear-gradient(90deg, #00f2ea, #ff0055)',
    },
  },

  controlBtn: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    transition: 'all 0.3s ease',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.2)',
      transform: 'scale(1.1)',
    },
  },

  playBtn: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #00f2ea, #8b5cf6)',
    color: '#fff',
    boxShadow: '0 4px 20px rgba(0, 242, 234, 0.3)',
    '&:hover': {
      transform: 'scale(1.1)',
    },
  },

  time: {
    color: '#fff',
    fontSize: '13px',
    fontFamily: 'monospace',
  },

  uploadProgress: {
    padding: '20px',
    textAlign: 'center',
  },

  deleteBtn: {
    position: 'absolute',
    top: '12px',
    right: '12px',
    background: 'rgba(255, 0, 85, 0.2)',
    border: '1px solid rgba(255, 0, 85, 0.3)',
    color: '#ff0055',
    '&:hover': {
      background: 'rgba(255, 0, 85, 0.4)',
    },
  },
};

const VideoSystem = ({ 
  mode = 'player', // 'player', 'upload', 'preview'
  videoUrl = null,
  onUpload = null,
  onDelete = null,
  showControls = true,
  autoPlay = false,
  muted = false,
  loop = false,
}) => {
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showPlayerControls, setShowPlayerControls] = useState(true);
  
  // Upload state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Format time
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Play/Pause toggle
  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Mute toggle
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current?.parentElement?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Seek video
  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    if (videoRef.current) {
      videoRef.current.currentTime = percent * duration;
    }
  };

  // Handle file select
  const handleFileSelect = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('video/')) {
      setUploadError('Please select a valid video file');
      return;
    }

    // Validate file size (100MB max)
    if (file.size > 100 * 1024 * 1024) {
      setUploadError('Video file must be less than 100MB');
      return;
    }

    setUploadError(null);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Simulate upload (or call actual upload function)
    if (onUpload) {
      setIsUploading(true);
      
      // Simulated progress
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setUploadProgress(progress);
        if (progress >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          onUpload(file, url);
        }
      }, 200);
    }
  }, [onUpload]);

  // Handle delete
  const handleDelete = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (onDelete) onDelete();
  };

  // Render upload mode
  const renderUploadMode = () => (
    <Box sx={styles.container}>
      {previewUrl ? (
        <Box sx={styles.videoWrapper}>
          <video
            ref={videoRef}
            src={previewUrl}
            style={styles.video}
            autoPlay={false}
            muted
          />
          <IconButton sx={styles.deleteBtn} onClick={handleDelete}>
            <Delete />
          </IconButton>
          {isUploading && (
            <Box sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              p: 2,
              background: 'rgba(0,0,0,0.8)',
            }}>
              <Typography sx={{ color: '#fff', mb: 1, fontSize: 13 }}>
                Uploading... {uploadProgress}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={uploadProgress}
                sx={{
                  height: 4,
                  borderRadius: 2,
                  bgcolor: 'rgba(255,255,255,0.1)',
                  '& .MuiLinearProgress-bar': {
                    background: 'linear-gradient(90deg, #00f2ea, #ff0055)',
                  },
                }}
              />
            </Box>
          )}
        </Box>
      ) : (
        <Box 
          sx={styles.uploadArea}
          onClick={() => fileInputRef.current?.click()}
        >
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <CloudUpload sx={{ fontSize: 48, color: '#00f2ea', mb: 2 }} />
          </motion.div>
          <Typography sx={{ color: '#fff', fontWeight: 600, mb: 1 }}>
            Upload Video
          </Typography>
          <Typography sx={{ color: '#6a6a7a', fontSize: 14 }}>
            Click or drag to upload (MP4, MOV, max 100MB)
          </Typography>
        </Box>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      {uploadError && (
        <Alert severity="error" sx={{ m: 2 }}>
          {uploadError}
        </Alert>
      )}
    </Box>
  );

  // Render player mode
  const renderPlayerMode = () => (
    <Box 
      sx={styles.container}
      onMouseEnter={() => setShowPlayerControls(true)}
      onMouseLeave={() => setShowPlayerControls(false)}
    >
      <Box sx={styles.videoWrapper}>
        {videoUrl || previewUrl ? (
          <>
            <video
              ref={videoRef}
              src={videoUrl || previewUrl}
              style={styles.video}
              autoPlay={autoPlay}
              muted={isMuted}
              loop={loop}
              onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
              onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            
            {/* Play button overlay */}
            {!isPlaying && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  position: 'absolute',
                  cursor: 'pointer',
                }}
                onClick={togglePlay}
              >
                <IconButton sx={styles.playBtn}>
                  <PlayArrow sx={{ fontSize: 28 }} />
                </IconButton>
              </motion.div>
            )}

            {/* Controls */}
            <AnimatePresence>
              {showControls && showPlayerControls && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={styles.controls}
                >
                  {/* Progress bar */}
                  <Box 
                    sx={styles.progressBar}
                    onClick={handleSeek}
                  >
                    <LinearProgress
                      variant="determinate"
                      value={duration ? (currentTime / duration) * 100 : 0}
                      sx={{
                        height: 4,
                        borderRadius: 2,
                        bgcolor: 'rgba(255,255,255,0.2)',
                        '& .MuiLinearProgress-bar': {
                          background: 'linear-gradient(90deg, #00f2ea, #ff0055)',
                        },
                      }}
                    />
                  </Box>

                  {/* Control buttons */}
                  <Box sx={styles.controlsRow}>
                    <IconButton sx={styles.controlBtn} onClick={togglePlay}>
                      {isPlaying ? <Pause /> : <PlayArrow />}
                    </IconButton>
                    
                    <Typography sx={styles.time}>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </Typography>

                    <Box sx={{ flex: 1 }} />

                    <IconButton sx={styles.controlBtn} onClick={toggleMute}>
                      {isMuted ? <VolumeOff /> : <VolumeUp />}
                    </IconButton>
                    
                    <IconButton sx={styles.controlBtn} onClick={toggleFullscreen}>
                      {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                    </IconButton>
                  </Box>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <Box sx={styles.placeholder}>
            <Videocam sx={{ fontSize: 64, opacity: 0.3 }} />
            <Typography>No video available</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );

  // Render based on mode
  return mode === 'upload' ? renderUploadMode() : renderPlayerMode();
};

export default VideoSystem;
