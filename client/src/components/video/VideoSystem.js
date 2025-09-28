import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Button,
  Typography,
  IconButton,
  Grid,
  Alert,
  CircularProgress,
  useTheme,
  TextField
} from '@mui/material';
import {
  Videocam,
  VideocamOff,
  Mic,
  MicOff,
  Call,
  CallEnd,
  ScreenShare,
  StopScreenShare,
  Upload,
  PlayArrow,
  Pause,
  VolumeUp,
  VolumeOff,
  Fullscreen,
  FullscreenExit
} from '@mui/icons-material';

const VideoSystem = ({ 
  mode = 'upload', // 'upload', 'call', 'player', 'messaging'
  onVideoUpload,
  onCallStart,
  onCallEnd,
  onMessageSend,
  initialVideo = null,
  isIncomingCall = false,
  callerInfo = null
}) => {
  const theme = useTheme();
  const videoRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // State
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  
  // Video call state
  const [isInCall, setIsInCall] = useState(false);
  const [isLocalVideoEnabled, setIsLocalVideoEnabled] = useState(true);
  const [isLocalAudioEnabled, setIsLocalAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callTimer, setCallTimer] = useState(null);
  
  // Video messaging state
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    if (initialVideo) {
      setVideoUrl(initialVideo.url);
    }
    
    return () => {
      if (callTimer) {
        clearInterval(callTimer);
      }
    };
  }, [initialVideo, callTimer]);

  // Video Upload Functions
  const handleVideoSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) { // 50MB limit
        setError('Video file size must be less than 50MB');
        return;
      }
      
      if (!file.type.startsWith('video/')) {
        setError('Please select a valid video file');
        return;
      }
      
      setVideoFile(file);
      setVideoUrl(URL.createObjectURL(file));
      setError('');
    }
  };

  const handleVideoUpload = async () => {
    if (!videoFile) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    try {
      const formData = new FormData();
      formData.append('video', videoFile);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/uploads/user-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        setUploadProgress(100);
        if (onVideoUpload) {
          onVideoUpload(result.video);
        }
        setError('');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }
    } catch (error) {
      setError(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Video Player Functions
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (!isFullscreen) {
        if (videoRef.current.requestFullscreen) {
          videoRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        }
      }
      setIsFullscreen(!isFullscreen);
    }
  };

  // Video Call Functions
  const startCall = () => {
    setIsInCall(true);
    setCallDuration(0);
    
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    setCallTimer(timer);
    
    if (onCallStart) {
      onCallStart();
    }
  };

  const endCall = () => {
    setIsInCall(false);
    if (callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
    }
    setCallDuration(0);
    
    if (onCallEnd) {
      onCallEnd();
    }
  };

  const toggleLocalVideo = () => {
    setIsLocalVideoEnabled(!isLocalVideoEnabled);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  };

  const toggleLocalAudio = () => {
    setIsLocalAudioEnabled(!isLocalAudioEnabled);
  };

  const toggleScreenShare = () => {
    setIsScreenSharing(!isScreenSharing);
  };

  // Video Messaging Functions
  const sendVideoMessage = async () => {
    if (!videoFile || !messageText.trim()) return;
    
    setSendingMessage(true);
    try {
      if (onMessageSend) {
        await onMessageSend({
          video: videoFile,
          message: messageText,
          timestamp: new Date().toISOString()
        });
      }
      setMessageText('');
      setVideoFile(null);
      setVideoUrl('');
    } catch (error) {
      setError(`Failed to send message: ${error.message}`);
    } finally {
      setSendingMessage(false);
    }
  };

  // Format call duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Render based on mode
  if (mode === 'upload') {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Upload Video
        </Typography>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoSelect}
          style={{ display: 'none' }}
        />
        
        <Button
          variant="outlined"
          startIcon={<Upload />}
          onClick={() => fileInputRef.current?.click()}
          sx={{ mb: 2 }}
        >
          Select Video File
        </Button>
        
        {videoFile && (
          <Box mb={2}>
            <Typography variant="body2" gutterBottom>
              Selected: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
            </Typography>
            
            {videoUrl && (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                style={{ width: '100%', maxWidth: '400px' }}
              />
            )}
            
            <Button
              variant="contained"
              onClick={handleVideoUpload}
              disabled={uploading}
              sx={{ mt: 1 }}
            >
              {uploading ? (
                <Box display="flex" alignItems="center" gap={1}>
                  <CircularProgress size={20} />
                  Uploading... {uploadProgress}%
                </Box>
              ) : (
                'Upload Video'
              )}
            </Button>
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Box>
    );
  }

  if (mode === 'call') {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          {isIncomingCall ? 'Incoming Call' : 'Video Call'}
        </Typography>
        
        {isIncomingCall && callerInfo && (
          <Box mb={2}>
            <Typography variant="body1">
              {callerInfo.username} is calling...
            </Typography>
          </Box>
        )}
        
        {isInCall && (
          <Box mb={2}>
            <Typography variant="body2" color="text.secondary">
              Call Duration: {formatDuration(callDuration)}
            </Typography>
          </Box>
        )}
        
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Local Video
            </Typography>
            <video
              ref={localVideoRef}
              autoPlay
              muted
              style={{
                width: '100%',
                maxWidth: '300px',
                border: '2px solid',
                borderColor: isLocalVideoEnabled ? theme.palette.primary.main : theme.palette.grey[400]
              }}
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>
              Remote Video
            </Typography>
            <video
              ref={remoteVideoRef}
              autoPlay
              style={{
                width: '100%',
                maxWidth: '300px',
                border: '2px solid',
                borderColor: theme.palette.secondary.main
              }}
            />
          </Grid>
        </Grid>
        
        <Box display="flex" gap={1} mt={2} flexWrap="wrap">
          {!isInCall ? (
            <Button
              variant="contained"
              color="success"
              startIcon={<Call />}
              onClick={startCall}
            >
              Start Call
            </Button>
          ) : (
            <Button
              variant="contained"
              color="error"
              startIcon={<CallEnd />}
              onClick={endCall}
            >
              End Call
            </Button>
          )}
          
          <IconButton
            onClick={toggleLocalVideo}
            color={isLocalVideoEnabled ? 'primary' : 'default'}
          >
            {isLocalVideoEnabled ? <Videocam /> : <VideocamOff />}
          </IconButton>
          
          <IconButton
            onClick={toggleLocalAudio}
            color={isLocalAudioEnabled ? 'primary' : 'default'}
          >
            {isLocalAudioEnabled ? <Mic /> : <MicOff />}
          </IconButton>
          
          <IconButton
            onClick={toggleScreenShare}
            color={isScreenSharing ? 'secondary' : 'default'}
          >
            {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
          </IconButton>
        </Box>
      </Box>
    );
  }

  if (mode === 'player') {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Video Player
        </Typography>
        
        {videoUrl && (
          <Box>
            <video
              ref={videoRef}
              src={videoUrl}
              controls
              style={{ width: '100%', maxWidth: '600px' }}
            />
            
            <Box display="flex" gap={1} mt={1}>
              <IconButton onClick={togglePlayPause}>
                {isPlaying ? <Pause /> : <PlayArrow />}
              </IconButton>
              
              <IconButton onClick={toggleMute}>
                {isMuted ? <VolumeOff /> : <VolumeUp />}
              </IconButton>
              
              <IconButton onClick={toggleFullscreen}>
                {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
              </IconButton>
            </Box>
          </Box>
        )}
      </Box>
    );
  }

  if (mode === 'messaging') {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Video Message
        </Typography>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          onChange={handleVideoSelect}
          style={{ display: 'none' }}
        />
        
        <Button
          variant="outlined"
          startIcon={<Upload />}
          onClick={() => fileInputRef.current?.click()}
          sx={{ mb: 2 }}
        >
          Select Video
        </Button>
        
        {videoFile && (
          <Box mb={2}>
            <Typography variant="body2" gutterBottom>
              Selected: {videoFile.name}
            </Typography>
            
            {videoUrl && (
              <video
                src={videoUrl}
                controls
                style={{ width: '100%', maxWidth: '400px' }}
              />
            )}
            
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Add a message"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Add a message to your video..."
              sx={{ mt: 2 }}
            />
            
            <Button
              variant="contained"
              onClick={sendVideoMessage}
              disabled={sendingMessage || !messageText.trim()}
              sx={{ mt: 2 }}
            >
              {sendingMessage ? 'Sending...' : 'Send Video Message'}
            </Button>
          </Box>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </Box>
    );
  }

  return null;
};

export default VideoSystem;



