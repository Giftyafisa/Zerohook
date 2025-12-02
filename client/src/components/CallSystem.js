import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, IconButton, Typography, Avatar } from '@mui/material';
import {
  Call,
  CallEnd,
  Videocam,
  VideocamOff,
  Mic,
  MicOff,
  VolumeUp,
  VolumeOff,
  Fullscreen,
  FullscreenExit,
  SwitchCamera
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';

// CSS-in-JS styles matching mobile Zerohook design
const styles = {
  // Full screen call overlay
  callOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(180deg, #0f0f13 0%, #1a1a22 100%)',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
  },

  // Animated background blobs
  blob: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(100px)',
    opacity: 0.3,
    zIndex: 0,
    pointerEvents: 'none',
  },

  // Video container
  videoContainer: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  remoteVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },

  localVideo: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    width: '120px',
    height: '160px',
    borderRadius: '16px',
    border: '2px solid rgba(0, 242, 234, 0.5)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
    objectFit: 'cover',
    zIndex: 10,
  },

  // Caller info (for audio calls or waiting state)
  callerInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    zIndex: 5,
  },

  callerAvatar: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    border: '3px solid rgba(0, 242, 234, 0.5)',
    boxShadow: '0 0 40px rgba(0, 242, 234, 0.3)',
  },

  callerName: {
    fontSize: '28px',
    fontWeight: 600,
    color: '#fff',
    textShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
  },

  callStatus: {
    fontSize: '16px',
    color: '#a0a0b0',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  callDuration: {
    fontSize: '18px',
    color: '#00f2ea',
    fontFamily: 'monospace',
    fontWeight: 500,
  },

  // Glass panel controls
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '24px',
    background: 'linear-gradient(to top, rgba(0, 0, 0, 0.8), transparent)',
  },

  controlsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    marginBottom: '16px',
  },

  controlBtn: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    color: '#fff',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.2)',
      transform: 'scale(1.05)',
    },
  },

  controlBtnActive: {
    background: 'rgba(255, 0, 85, 0.3)',
    border: '1px solid rgba(255, 0, 85, 0.5)',
  },

  endCallBtn: {
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ff0055, #ff3366)',
    boxShadow: '0 4px 20px rgba(255, 0, 85, 0.4)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    color: '#fff',
    '&:hover': {
      transform: 'scale(1.1)',
      boxShadow: '0 6px 30px rgba(255, 0, 85, 0.6)',
    },
  },

  acceptCallBtn: {
    width: '70px',
    height: '70px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #00ff88, #00cc66)',
    boxShadow: '0 4px 20px rgba(0, 255, 136, 0.4)',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    color: '#fff',
    '&:hover': {
      transform: 'scale(1.1)',
      boxShadow: '0 6px 30px rgba(0, 255, 136, 0.6)',
    },
  },

  // Incoming call modal
  incomingCallOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.95)',
    backdropFilter: 'blur(20px)',
    zIndex: 10000,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pulseRing: {
    position: 'absolute',
    width: '140px',
    height: '140px',
    borderRadius: '50%',
    border: '2px solid rgba(0, 242, 234, 0.3)',
  },

  // Header for active call
  callHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: '20px',
    background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.6), transparent)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },

  headerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },

  headerAvatar: {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    border: '2px solid rgba(0, 242, 234, 0.5)',
  },

  headerName: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '16px',
  },

  headerStatus: {
    color: '#00ff88',
    fontSize: '13px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
};

const CallSystem = () => {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  
  // Call state
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callType, setCallType] = useState('video');
  const [isInCall, setIsInCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [callTimer, setCallTimer] = useState(null);
  
  // Media state
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMediaStreams();
      if (callTimer) clearInterval(callTimer);
    };
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on('incoming_call', (callData) => {
      console.log('📞 Incoming call:', callData);
      setIncomingCall(callData);
    });

    socket.on('call_accepted', (callData) => {
      console.log('✅ Call accepted:', callData);
      setOutgoingCall(null);
      setActiveCall(callData);
      setIsInCall(true);
      startCallTimer();
      establishConnection(callData);
    });

    socket.on('call_rejected', () => {
      console.log('❌ Call rejected');
      setOutgoingCall(null);
    });

    socket.on('call_ended', () => {
      console.log('📞 Call ended');
      endCall();
    });

    socket.on('call_timeout', () => {
      console.log('⏰ Call timeout');
      setOutgoingCall(null);
      setIncomingCall(null);
    });

    return () => {
      socket.off('incoming_call');
      socket.off('call_accepted');
      socket.off('call_rejected');
      socket.off('call_ended');
      socket.off('call_timeout');
    };
  }, [socket, isConnected]);

  // Initialize media
  const initializeMedia = async (videoEnabled = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoEnabled,
        audio: true
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (error) {
      console.warn('Media access failed:', error);
      return null;
    }
  };

  // Cleanup media
  const cleanupMediaStreams = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach(track => track.stop());
      remoteStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  // Start call
  const startCall = useCallback(async (targetUserId, type = 'video') => {
    if (!socket || !isConnected) return;

    await initializeMedia(type === 'video');
    setCallType(type);
    setOutgoingCall({
      id: Date.now().toString(),
      targetUserId,
      type,
      status: 'calling'
    });

    socket.emit('call_request', {
      targetUserId,
      type,
      callerId: user.id,
      callerName: user.username || 'User'
    });

    // Timeout after 30s
    setTimeout(() => {
      if (outgoingCall?.status === 'calling') {
        socket.emit('call_timeout', { targetUserId });
        setOutgoingCall(null);
      }
    }, 30000);
  }, [socket, isConnected, user, outgoingCall]);

  // Accept call
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;

    await initializeMedia(incomingCall.type === 'video');
    setCallType(incomingCall.type || 'video');
    setActiveCall(incomingCall);
    setIncomingCall(null);
    setIsInCall(true);

    socket.emit('accept_call', {
      callId: incomingCall.id,
      targetUserId: incomingCall.callerId
    });

    startCallTimer();
    establishConnection(incomingCall);
  }, [incomingCall, socket]);

  // Reject call
  const rejectCall = useCallback(() => {
    if (!incomingCall) return;
    socket.emit('reject_call', {
      callId: incomingCall.id,
      targetUserId: incomingCall.callerId
    });
    setIncomingCall(null);
  }, [incomingCall, socket]);

  // End call
  const endCall = useCallback(() => {
    if (activeCall) {
      socket.emit('end_call', {
        callId: activeCall.id,
        targetUserId: activeCall.targetUserId || activeCall.callerId
      });
    }
    setIsInCall(false);
    setActiveCall(null);
    setOutgoingCall(null);
    setCallDuration(0);
    if (callTimer) {
      clearInterval(callTimer);
      setCallTimer(null);
    }
    cleanupMediaStreams();
  }, [activeCall, socket, callTimer]);

  // Timer
  const startCallTimer = () => {
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    setCallTimer(timer);
  };

  // WebRTC connection
  const establishConnection = async (callData) => {
    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });
      peerConnectionRef.current = pc;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      pc.ontrack = (event) => {
        remoteStreamRef.current = event.streams[0];
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };
    } catch (error) {
      console.error('WebRTC connection failed:', error);
    }
  };

  // Toggle controls
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getVideoTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsVideoEnabled(track.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const track = localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = !track.enabled;
        setIsAudioEnabled(track.enabled);
      }
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Format duration
  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Render incoming call modal
  const renderIncomingCall = () => (
    <AnimatePresence>
      {incomingCall && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={styles.incomingCallOverlay}
        >
          {/* Animated background blobs */}
          <motion.div
            style={{
              ...styles.blob,
              width: '350px',
              height: '350px',
              background: '#00f2ea',
              top: '-150px',
              left: '-100px',
            }}
            animate={{
              x: [0, 30, -20, 20, 0],
              y: [0, -30, 20, 30, 0],
              scale: [1, 1.1, 0.9, 1.05, 1],
            }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            style={{
              ...styles.blob,
              width: '300px',
              height: '300px',
              background: '#ff0055',
              bottom: '-100px',
              right: '-100px',
            }}
            animate={{
              x: [0, -20, 30, -10, 0],
              y: [0, 30, -20, 20, 0],
              scale: [1, 0.9, 1.1, 0.95, 1],
            }}
            transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          />

          <Box sx={{ position: 'relative', mb: 4 }}>
            {/* Pulse rings */}
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                style={styles.pulseRing}
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: i * 0.5,
                  ease: 'easeOut',
                }}
              />
            ))}
            <Avatar
              sx={styles.callerAvatar}
              src={incomingCall.callerAvatar}
            >
              {incomingCall.callerName?.charAt(0) || 'U'}
            </Avatar>
          </Box>

          <Typography sx={styles.callerName}>
            {incomingCall.callerName || 'Unknown'}
          </Typography>
          
          <Typography sx={{ ...styles.callStatus, mb: 6 }}>
            {incomingCall.type === 'video' ? '📹 Video Call' : '📞 Audio Call'}
          </Typography>

          <Box sx={{ display: 'flex', gap: 6 }}>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <IconButton onClick={rejectCall} sx={styles.endCallBtn}>
                <CallEnd sx={{ fontSize: 32 }} />
              </IconButton>
            </motion.div>
            <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
              <IconButton onClick={acceptCall} sx={styles.acceptCallBtn}>
                <Call sx={{ fontSize: 32 }} />
              </IconButton>
            </motion.div>
          </Box>

          <Typography sx={{ color: '#6a6a7a', mt: 3, fontSize: 14 }}>
            Swipe up to answer with video
          </Typography>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Render outgoing call
  const renderOutgoingCall = () => (
    <AnimatePresence>
      {outgoingCall && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={styles.callOverlay}
        >
          {/* Background blobs */}
          <motion.div
            style={{
              ...styles.blob,
              width: '350px',
              height: '350px',
              background: '#00f2ea',
              top: '-150px',
              left: '-100px',
            }}
            animate={{
              x: [0, 30, -20, 0],
              y: [0, -30, 20, 0],
            }}
            transition={{ duration: 10, repeat: Infinity }}
          />
          <motion.div
            style={{
              ...styles.blob,
              width: '300px',
              height: '300px',
              background: '#8b5cf6',
              bottom: '-100px',
              right: '-100px',
            }}
            animate={{
              x: [0, -30, 20, 0],
              y: [0, 30, -20, 0],
            }}
            transition={{ duration: 12, repeat: Infinity }}
          />

          <Box sx={styles.videoContainer}>
            <Box sx={styles.callerInfo}>
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Avatar sx={styles.callerAvatar}>
                  {outgoingCall.callerName?.charAt(0) || 'U'}
                </Avatar>
              </motion.div>
              
              <Typography sx={styles.callerName}>Calling...</Typography>
              
              <Typography sx={styles.callStatus}>
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  ●
                </motion.span>
                {outgoingCall.type === 'video' ? 'Video Call' : 'Audio Call'}
              </Typography>
            </Box>
          </Box>

          <Box sx={styles.controlsContainer}>
            <Box sx={styles.controlsRow}>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <IconButton
                  onClick={() => {
                    socket.emit('cancel_call', { targetUserId: outgoingCall.targetUserId });
                    setOutgoingCall(null);
                    cleanupMediaStreams();
                  }}
                  sx={styles.endCallBtn}
                >
                  <CallEnd sx={{ fontSize: 32 }} />
                </IconButton>
              </motion.div>
            </Box>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Render active call
  const renderActiveCall = () => (
    <AnimatePresence>
      {isInCall && activeCall && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={styles.callOverlay}
        >
          {/* Header */}
          <Box sx={styles.callHeader}>
            <Box sx={styles.headerInfo}>
              <Avatar sx={styles.headerAvatar}>
                {activeCall.callerName?.charAt(0) || 'U'}
              </Avatar>
              <Box>
                <Typography sx={styles.headerName}>
                  {activeCall.callerName || 'User'}
                </Typography>
                <Typography sx={styles.headerStatus}>
                  <span style={{ color: '#00ff88' }}>●</span> {formatDuration(callDuration)}
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={toggleFullscreen} sx={{ color: '#fff' }}>
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Box>

          {/* Video container */}
          <Box sx={styles.videoContainer}>
            {callType === 'video' ? (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={styles.remoteVideo}
                />
                {isVideoEnabled && (
                  <motion.video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={styles.localVideo}
                    drag
                    dragConstraints={{
                      top: 0,
                      left: -200,
                      right: 0,
                      bottom: 300,
                    }}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  />
                )}
              </>
            ) : (
              <Box sx={styles.callerInfo}>
                <Avatar sx={styles.callerAvatar}>
                  {activeCall.callerName?.charAt(0) || 'U'}
                </Avatar>
                <Typography sx={styles.callerName}>
                  {activeCall.callerName || 'User'}
                </Typography>
                <Typography sx={styles.callDuration}>
                  {formatDuration(callDuration)}
                </Typography>
              </Box>
            )}
          </Box>

          {/* Controls */}
          <Box sx={styles.controlsContainer}>
            <Box sx={styles.controlsRow}>
              {/* Video toggle */}
              {callType === 'video' && (
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <IconButton
                    onClick={toggleVideo}
                    sx={{
                      ...styles.controlBtn,
                      ...((!isVideoEnabled) && styles.controlBtnActive),
                    }}
                  >
                    {isVideoEnabled ? <Videocam /> : <VideocamOff />}
                  </IconButton>
                </motion.div>
              )}

              {/* Audio toggle */}
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <IconButton
                  onClick={toggleAudio}
                  sx={{
                    ...styles.controlBtn,
                    ...((!isAudioEnabled) && styles.controlBtnActive),
                  }}
                >
                  {isAudioEnabled ? <Mic /> : <MicOff />}
                </IconButton>
              </motion.div>

              {/* Mute toggle */}
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <IconButton
                  onClick={toggleMute}
                  sx={{
                    ...styles.controlBtn,
                    ...(isMuted && styles.controlBtnActive),
                  }}
                >
                  {isMuted ? <VolumeOff /> : <VolumeUp />}
                </IconButton>
              </motion.div>

              {/* Camera switch (for mobile) */}
              {callType === 'video' && (
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                  <IconButton sx={styles.controlBtn}>
                    <SwitchCamera />
                  </IconButton>
                </motion.div>
              )}
            </Box>

            <Box sx={styles.controlsRow}>
              {/* End call */}
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <IconButton onClick={endCall} sx={styles.endCallBtn}>
                  <CallEnd sx={{ fontSize: 32 }} />
                </IconButton>
              </motion.div>
            </Box>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Expose startCall method to parent components
  useEffect(() => {
    window.startVideoCall = (userId) => startCall(userId, 'video');
    window.startAudioCall = (userId) => startCall(userId, 'audio');
    return () => {
      delete window.startVideoCall;
      delete window.startAudioCall;
    };
  }, [startCall]);

  return (
    <>
      {renderIncomingCall()}
      {renderOutgoingCall()}
      {renderActiveCall()}
    </>
  );
};

export default CallSystem;
