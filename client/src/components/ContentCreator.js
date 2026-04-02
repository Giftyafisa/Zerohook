/**
 * Content Creator Modal - TikTok-style post creation
 * 
 * Features:
 * - Image/video upload with preview
 * - Caption/description input
 * - Category selection
 * - Price setting (optional)
 * - Location tagging
 * - Direct upload to Cloudinary
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  TextField,
  Chip,
  Dialog,
  Slide,
  CircularProgress,
  LinearProgress,
} from '@mui/material';
import {
  Close,
  AddPhotoAlternate,
  Videocam,
  LocationOn,
  AttachMoney,
  ArrowBack,
  CloudUpload,
  Delete,
  PlayArrow,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/apiClient';
import { toast } from 'react-toastify';

// Slide up transition
const SlideTransition = React.forwardRef(function Transition(props, ref) {
  return <Slide direction="up" ref={ref} {...props} />;
});

// Categories for content
const CONTENT_CATEGORIES = [
  { id: 'showcase', label: 'Showcase', icon: '✨', color: '#00f2ea' },
  { id: 'promo', label: 'Promotion', icon: '🔥', color: '#ff0055' },
  { id: 'lifestyle', label: 'Lifestyle', icon: '💫', color: '#ffd700' },
  { id: 'behind-scenes', label: 'Behind Scenes', icon: '🎬', color: '#aa00ff' },
  { id: 'announcement', label: 'Announcement', icon: '📢', color: '#4ade80' },
];

const ContentCreator = ({ open, onClose, onSuccess }) => {
  const { isAuthenticated } = useAuth();
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  
  // State
  const [step, setStep] = useState(1); // 1: upload, 2: details
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isVideo, setIsVideo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Content details
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState('showcase');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');

  // Handle file selection
  const handleFileSelect = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const isVideoFile = file.type.startsWith('video/');
    const isImageFile = file.type.startsWith('image/');
    
    if (!isVideoFile && !isImageFile) {
      toast.error('Please select an image or video file');
      return;
    }

    // Validate file size (50MB for video, 10MB for image)
    const maxSize = isVideoFile ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`File too large. Max size: ${isVideoFile ? '50MB' : '10MB'}`);
      return;
    }

    setSelectedFile(file);
    setIsVideo(isVideoFile);
    setPreviewUrl(URL.createObjectURL(file));
    setStep(2);
  }, []);

  // Handle upload
  const handleUpload = async () => {
    if (!selectedFile || !isAuthenticated) {
      toast.error('Please login to upload content');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('media', selectedFile);
      formData.append('caption', caption);
      formData.append('category', category);
      formData.append('price', price || '0');
      formData.append('location', location);
      formData.append('contentType', isVideo ? 'video' : 'image');

      const result = await apiClient.post('/content/posts', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100);
            setUploadProgress(percent);
          }
        }
      });
      
      toast.success('Content uploaded successfully!');
      onSuccess?.(result.data.content || result.data);
      handleClose();
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload content');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Reset and close
  const handleClose = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setStep(1);
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsVideo(false);
    setCaption('');
    setCategory('showcase');
    setPrice('');
    setLocation('');
    onClose?.();
  }, [onClose, previewUrl]);

  // Remove selected file
  const handleRemoveFile = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsVideo(false);
    setStep(1);
  }, [previewUrl]);

  if (!open) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      TransitionComponent={SlideTransition}
      fullScreen
      sx={{
        zIndex: 9999, // Ensure it's above everything including MobileShell
      }}
      PaperProps={{
        sx: {
          bgcolor: '#0f0f13',
          backgroundImage: 'none',
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <IconButton onClick={step === 2 ? handleRemoveFile : handleClose}>
          {step === 2 ? <ArrowBack sx={{ color: '#fff' }} /> : <Close sx={{ color: '#fff' }} />}
        </IconButton>
        
        <Typography
          sx={{
            color: '#fff',
            fontWeight: 700,
            fontSize: '1.1rem',
            fontFamily: '"Outfit", sans-serif',
          }}
        >
          {step === 1 ? 'Create Post' : 'Add Details'}
        </Typography>
        
        {step === 2 ? (
          <Button
            onClick={handleUpload}
            disabled={uploading || !caption.trim()}
            sx={{
              bgcolor: '#00f2ea',
              color: '#000',
              fontWeight: 700,
              borderRadius: '8px',
              px: 2,
              '&:hover': { bgcolor: '#00d4aa' },
              '&:disabled': { bgcolor: 'rgba(0,242,234,0.3)', color: '#000' },
            }}
          >
            {uploading ? <CircularProgress size={20} sx={{ color: '#000' }} /> : 'Post'}
          </Button>
        ) : (
          <Box sx={{ width: 48 }} />
        )}
      </Box>

      {/* Upload Progress */}
      {uploading && (
        <LinearProgress
          variant="determinate"
          value={uploadProgress}
          sx={{
            height: 3,
            bgcolor: 'rgba(0,242,234,0.2)',
            '& .MuiLinearProgress-bar': {
              bgcolor: '#00f2ea',
            },
          }}
        />
      )}

      {/* Step 1: File Selection */}
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
          >
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 4,
              }}
            >
              {/* Upload Area */}
              <Box
                onClick={() => fileInputRef.current?.click()}
                sx={{
                  width: '100%',
                  maxWidth: 300,
                  aspectRatio: '9/16',
                  borderRadius: 3,
                  border: '2px dashed rgba(0,242,234,0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 2,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    borderColor: '#00f2ea',
                    bgcolor: 'rgba(0,242,234,0.05)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    bgcolor: 'rgba(0,242,234,0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CloudUpload sx={{ color: '#00f2ea', fontSize: 40 }} />
                </Box>
                
                <Typography
                  sx={{
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '1.1rem',
                    fontFamily: '"Outfit", sans-serif',
                  }}
                >
                  Tap to upload
                </Typography>
                
                <Typography
                  sx={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: '0.85rem',
                    textAlign: 'center',
                  }}
                >
                  Photo (max 10MB) or Video (max 50MB)
                </Typography>
              </Box>

              {/* Quick action buttons */}
              <Box sx={{ display: 'flex', gap: 2, mt: 4 }}>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  startIcon={<AddPhotoAlternate />}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    borderRadius: 2,
                    px: 3,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                  }}
                >
                  Photo
                </Button>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  startIcon={<Videocam />}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                    borderRadius: 2,
                    px: 3,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
                  }}
                >
                  Video
                </Button>
              </Box>
            </Box>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </motion.div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {/* Preview */}
              <Box
                sx={{
                  position: 'relative',
                  width: '100%',
                  aspectRatio: '9/16',
                  maxHeight: 300,
                  borderRadius: 2,
                  overflow: 'hidden',
                  bgcolor: '#000',
                  mb: 3,
                }}
              >
                {isVideo ? (
                  <video
                    ref={videoRef}
                    src={previewUrl}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                    playsInline
                    muted
                    loop
                  />
                ) : (
                  <Box
                    component="img"
                    src={previewUrl}
                    alt="Preview"
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                )}
                
                {/* Video play overlay */}
                {isVideo && (
                  <Box
                    onClick={() => videoRef.current?.paused ? videoRef.current.play() : videoRef.current?.pause()}
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'rgba(0,0,0,0.3)',
                      cursor: 'pointer',
                    }}
                  >
                    <PlayArrow sx={{ color: '#fff', fontSize: 60 }} />
                  </Box>
                )}
                
                {/* Remove button */}
                <IconButton
                  onClick={handleRemoveFile}
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    bgcolor: 'rgba(0,0,0,0.5)',
                    '&:hover': { bgcolor: 'rgba(255,0,0,0.5)' },
                  }}
                >
                  <Delete sx={{ color: '#fff', fontSize: 20 }} />
                </IconButton>
              </Box>

              {/* Caption */}
              <TextField
                fullWidth
                multiline
                rows={3}
                placeholder="Write a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderRadius: 2,
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&.Mui-focused fieldset': { borderColor: '#00f2ea' },
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: 'rgba(255,255,255,0.4)',
                  },
                }}
                inputProps={{ maxLength: 500 }}
                helperText={
                  <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', textAlign: 'right' }}>
                    {caption.length}/500
                  </Typography>
                }
              />

              {/* Category Selection */}
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: '0.85rem',
                  mb: 1,
                  fontWeight: 600,
                }}
              >
                Category
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 3 }}>
                {CONTENT_CATEGORIES.map((cat) => (
                  <Chip
                    key={cat.id}
                    label={`${cat.icon} ${cat.label}`}
                    onClick={() => setCategory(cat.id)}
                    sx={{
                      bgcolor: category === cat.id ? cat.color : 'rgba(255,255,255,0.1)',
                      color: category === cat.id ? '#000' : '#fff',
                      fontWeight: 600,
                      '&:hover': {
                        bgcolor: category === cat.id ? cat.color : 'rgba(255,255,255,0.15)',
                      },
                    }}
                  />
                ))}
              </Box>

              {/* Price (Optional) */}
              <TextField
                fullWidth
                placeholder="Price (optional)"
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
                InputProps={{
                  startAdornment: <AttachMoney sx={{ color: 'rgba(255,255,255,0.4)', mr: 1 }} />,
                }}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderRadius: 2,
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&.Mui-focused fieldset': { borderColor: '#00f2ea' },
                  },
                }}
              />

              {/* Location */}
              <TextField
                fullWidth
                placeholder="Add location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                InputProps={{
                  startAdornment: <LocationOn sx={{ color: 'rgba(255,255,255,0.4)', mr: 1 }} />,
                }}
                sx={{
                  mb: 2,
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'rgba(255,255,255,0.05)',
                    borderRadius: 2,
                    color: '#fff',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.1)' },
                    '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                    '&.Mui-focused fieldset': { borderColor: '#00f2ea' },
                  },
                }}
              />
            </Box>
          </motion.div>
        )}
      </AnimatePresence>
    </Dialog>
  );
};

export default ContentCreator;
