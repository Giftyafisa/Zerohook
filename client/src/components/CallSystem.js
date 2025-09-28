import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  Chip,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Call,
  CallEnd,
  Videocam,
  VideocamOff,
  Mic,
  MicOff,
  ScreenShare,
  StopScreenShare,
  VolumeUp,
  VolumeOff,
  Fullscreen,
  FullscreenExit,
  Phone,
  PhoneDisabled
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

const CallSystem = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  
  // Call state
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callType, setCallType] = useState('audio'); // 'audio' or 'video'
  const [isInCall, setIsInCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callTimer, setCallTimer] = useState(null);
  
  // Media state
  const [isLocalVideoEnabled, setIsLocalVideoEnabled] = useState(true);
  const [isLocalAudioEnabled, setIsLocalAudioEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localAudioRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const screenShareRef = useRef(null);
  
  // Media streams
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);

  // Initialize media devices only when needed (not on mount)
  useEffect(() => {
    // Only cleanup on unmount, don't initialize immediately
    return () => {
      cleanupMediaStreams();
    };
  }, []);

  // Socket event listeners for calls
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Incoming call
    socket.on('incoming_call', (callData) => {
      console.log('📞 Incoming call received:', callData);
      setIncomingCall(callData);
    });

    // Call accepted
    socket.on('call_accepted', (callData) => {
      console.log('✅ Call accepted:', callData);
      setOutgoingCall(null);
      setActiveCall(callData);
      setIsInCall(true);
      startCallTimer();
      establishCallConnection(callData);
    });

    // Call rejected
    socket.on('call_rejected', (callData) => {
      console.log('❌ Call rejected:', callData);
      setOutgoingCall(null);
      setIncomingCall(null);
      showNotification('Call was rejected', 'info');
    });

    // Call ended
    socket.on('call_ended', (callData) => {
      console.log('📞 Call ended:', callData);
      endCall();
    });

    // Remote stream received
    socket.on('remote_stream', (streamData) => {
      console.log('📹 Remote stream received');
      handleRemoteStream(streamData);
    });

    // Call timeout
    socket.on('call_timeout', (callData) => {
      console.log('⏰ Call timeout:', callData);
      setOutgoingCall(null);
      setIncomingCall(null);
      showNotification('Call timed out', 'warning');
    });

    return () => {
      socket.off('incoming_call');
      socket.off('call_accepted');
      socket.off('call_rejected');
      socket.off('call_ended');
      socket.off('remote_stream');
      socket.off('call_timeout');
    };
  }, [socket, isConnected]);

  // Initialize media devices
  const initializeMediaDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      if (localAudioRef.current) {
        localAudioRef.current.srcObject = stream;
      }
    } catch (error) {
      console.warn('Media devices not available:', error.name);
      // Only show notification for non-permission errors
      if (error.name !== 'NotAllowedError') {
        showNotification('Camera/microphone access failed', 'warning');
      }
    }
  };

  // Cleanup media streams
  const cleanupMediaStreams = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }
  };

  // Start outgoing call
  const startCall = useCallback(async (targetUserId, type = 'audio') => {
    if (!socket || !isConnected) {
      showNotification('Not connected to server', 'error');
      return;
    }

    try {
      // Initialize media devices when starting a call
      await initializeMediaDevices();
      
      setCallType(type);
      setOutgoingCall({
        id: Date.now().toString(),
        targetUserId,
        type,
        status: 'calling'
      });

      // Emit call request
      socket.emit('call_request', {
        targetUserId,
        type,
        callerId: user.id,
        callerName: user.username || user.profileData?.firstName || 'User'
      });

      // Start call timeout
      setTimeout(() => {
        if (outgoingCall && outgoingCall.status === 'calling') {
          socket.emit('call_timeout', { targetUserId });
          setOutgoingCall(null);
          showNotification('Call timed out', 'warning');
        }
      }, 30000); // 30 second timeout

    } catch (error) {
      console.error('Failed to start call:', error);
      showNotification('Failed to start call', 'error');
    }
  }, [socket, isConnected, user, outgoingCall]);

  // Accept incoming call
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;

    try {
      // Initialize media devices when accepting a call
      await initializeMediaDevices();
      
      setIsInCall(true);
      setActiveCall(incomingCall);
      setIncomingCall(null);
      
      // Accept call on server
      socket.emit('accept_call', {
        callId: incomingCall.id,
        targetUserId: incomingCall.callerId
      });

      startCallTimer();
      establishCallConnection(incomingCall);

    } catch (error) {
      console.error('Failed to accept call:', error);
      showNotification('Failed to accept call', 'error');
    }
  }, [incomingCall, socket]);

  // Reject incoming call
  const rejectCall = useCallback(() => {
    if (!incomingCall) return;

    socket.emit('reject_call', {
      callId: incomingCall.id,
      targetUserId: incomingCall.callerId
    });

    setIncomingCall(null);
  }, [incomingCall, socket]);

  // End active call
  const endCall = useCallback(() => {
    if (activeCall) {
      socket.emit('end_call', {
        callId: activeCall.id,
        targetUserId: activeCall.targetUserId || activeCall.callerId
      });
    }

    cleanupCall();
  }, [activeCall, socket]);

  // Cleanup call state
  const cleanupCall = () => {
    setIsInCall(false);
    setActiveCall(null);
    setOutgoingCall(null);
    setIncomingCall(null);
    setCallDuration(0);
    if (callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
    }
    cleanupMediaStreams();
  };

  // Start call timer
  const startCallTimer = () => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    setCallTimer(timer);
  };

  // Establish call connection
  const establishCallConnection = async (callData) => {
    try {
      // Create peer connection for WebRTC
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      // Add local stream
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });
      }

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      // Store peer connection
      setActiveCall(prev => ({ ...prev, peerConnection }));

    } catch (error) {
      console.error('Failed to establish call connection:', error);
      showNotification('Failed to establish call connection', 'error');
    }
  };

  // Handle remote stream
  const handleRemoteStream = (streamData) => {
    // Handle incoming remote stream data
    console.log('Processing remote stream:', streamData);
  };

  // Toggle local video
  const toggleLocalVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsLocalVideoEnabled(videoTrack.enabled);
      }
    }
  };

  // Toggle local audio
  const toggleLocalAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsLocalAudioEnabled(audioTrack.enabled);
      }
    }
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
      }
    }
  };

  // Toggle screen sharing
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        setScreenStream(stream);
        setIsScreenSharing(true);
        
        if (screenShareRef.current) {
          screenShareRef.current.srcObject = stream;
        }
      } else {
        if (screenStream) {
          screenStream.getTracks().forEach(track => track.stop());
          setScreenStream(null);
        }
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error('Failed to toggle screen sharing:', error);
      showNotification('Failed to toggle screen sharing', 'error');
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Format call duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Show notification
  const showNotification = (message, type = 'info') => {
    // You can integrate this with your existing notification system
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  // Render call interface
  const renderCallInterface = () => {
    if (activeCall && isInCall) {
      return (
        <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
          {/* Remote Video */}
          {callType === 'video' && (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                borderRadius: theme.shape.borderRadius
              }}
            />
          )}

          {/* Local Video (Picture-in-Picture) */}
          {callType === 'video' && isLocalVideoEnabled && (
            <Box
              sx={{
                position: 'absolute',
                top: 20,
                right: 20,
                width: 120,
                height: 90,
                borderRadius: theme.shape.borderRadius,
                overflow: 'hidden',
                border: `2px solid ${theme.palette.primary.main}`
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </Box>
          )}

          {/* Call Controls */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              gap: 2,
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.7)',
              padding: 2,
              borderRadius: theme.shape.borderRadius
            }}
          >
            {/* Call Duration */}
            <Typography variant="body2" color="white">
              {formatDuration(callDuration)}
            </Typography>

            {/* Video Toggle */}
            {callType === 'video' && (
              <IconButton
                onClick={toggleLocalVideo}
                sx={{ color: isLocalVideoEnabled ? 'white' : 'red' }}
              >
                {isLocalVideoEnabled ? <Videocam /> : <VideocamOff />}
              </IconButton>
            )}

            {/* Audio Toggle */}
            <IconButton
              onClick={toggleLocalAudio}
              sx={{ color: isLocalAudioEnabled ? 'white' : 'red' }}
            >
              {isLocalAudioEnabled ? <Mic /> : <MicOff />}
            </IconButton>

            {/* Mute Toggle */}
            <IconButton
              onClick={toggleMute}
              sx={{ color: isMuted ? 'red' : 'white' }}
            >
              {isMuted ? <VolumeOff /> : <VolumeUp />}
            </IconButton>

            {/* Screen Share */}
            <IconButton
              onClick={toggleScreenShare}
              sx={{ color: isScreenSharing ? 'green' : 'white' }}
            >
              {isScreenSharing ? <StopScreenShare /> : <ScreenShare />}
            </IconButton>

            {/* Fullscreen */}
            <IconButton
              onClick={toggleFullscreen}
              sx={{ color: 'white' }}
            >
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>

            {/* End Call */}
            <IconButton
              onClick={endCall}
              sx={{
                backgroundColor: 'red',
                color: 'white',
                '&:hover': { backgroundColor: 'darkred' }
              }}
            >
              <CallEnd />
            </IconButton>
          </Box>
        </Box>
      );
    }

    return null;
  };

  return (
    <>
      {/* Incoming Call Dialog */}
      <Dialog
        open={!!incomingCall}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogTitle>
          📞 Incoming {incomingCall?.type === 'video' ? 'Video' : 'Audio'} Call
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
            <Avatar
              sx={{ width: 80, height: 80, fontSize: '2rem' }}
            >
              {incomingCall?.callerName?.charAt(0) || 'U'}
            </Avatar>
            <Typography variant="h6">
              {incomingCall?.callerName || 'Unknown'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              is calling you...
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: 2 }}>
          <Button
            variant="contained"
            color="success"
            startIcon={<Call />}
            onClick={acceptCall}
            size="large"
          >
            Accept
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<CallEnd />}
            onClick={rejectCall}
            size="large"
          >
            Decline
          </Button>
        </DialogActions>
      </Dialog>

      {/* Outgoing Call Dialog */}
      <Dialog
        open={!!outgoingCall}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown
      >
        <DialogTitle>
          📞 Calling...
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
            <CircularProgress size={60} />
            <Typography variant="h6">
              Calling user...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {outgoingCall?.type === 'video' ? 'Video' : 'Audio'} call
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="error"
            startIcon={<CallEnd />}
            onClick={() => {
              socket.emit('cancel_call', {
                targetUserId: outgoingCall.targetUserId
              });
              setOutgoingCall(null);
            }}
            size="large"
          >
            Cancel Call
          </Button>
        </DialogActions>
      </Dialog>

      {/* Active Call Interface */}
      {renderCallInterface()}

      {/* Hidden audio elements for audio calls */}
      <audio ref={localAudioRef} autoPlay muted />
      <audio ref={remoteAudioRef} autoPlay />
      <video ref={screenShareRef} autoPlay muted style={{ display: 'none' }} />
    </>
  );
};

export default CallSystem;
