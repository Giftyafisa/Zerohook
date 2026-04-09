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
import { useCall } from '../contexts/CallContext';
import { traceRealtime } from '../utils/realtimeTrace';

const getUserId = (user) => String(user?.id || user?._id || user?.userId || '');

// Tunable network quality thresholds (higher sensitivity = lower thresholds)
const NET_QUALITY_POLL_MS = 3500;
const NET_QUALITY_THRESHOLDS = {
  poor: { lossRate: 0.08, rttMs: 400, jitter: 0.05 },
  fair: { lossRate: 0.02, rttMs: 150, jitter: 0.02 },
};

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
    paddingBottom: 'max(24px, env(safe-area-inset-bottom))',
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
    paddingTop: 'max(20px, env(safe-area-inset-top))',
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
  const currentUserId = getUserId(user);
  const { registerStartCall, setIsInCall: setGlobalIsInCall } = useCall();
  
  // Call state
  const [incomingCall, setIncomingCall] = useState(null);
  const incomingCallRef = useRef(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const outgoingCallRef = useRef(null);
  const outgoingTimeoutRef = useRef(null);
  const [outgoingElapsed, setOutgoingElapsed] = useState(0);
  const outgoingTimerRef = useRef(null);
  const [activeCall, setActiveCall] = useState(null);
  const activeCallRef = useRef(null);
  const [callType, setCallType] = useState('video');
  const callTypeRef = useRef('video');
  const peerUserIdRef = useRef(null);
  const [isInCall, setIsInCall] = useState(false);
  const isInCallRef = useRef(false);
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef(null);
  
  // Media state
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Network quality state — derived from WebRTC getStats() polling
  // 'connecting' | 'good' | 'fair' | 'poor'
  const [networkQuality, setNetworkQuality] = useState('connecting');
  const netQualityIntervalRef = useRef(null);
  const prevRttRef = useRef(null);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const mediaInitPromiseRef = useRef(null);
  const mediaInitTokenRef = useRef(0);
  const ringAudioContextRef = useRef(null);
  const ringToneIntervalRef = useRef(null);
  const initializeMediaRef = useRef(null);
  const createAndSendOfferRef = useRef(null);
  const handleWebRTCOfferRef = useRef(null);
  const endCallRef = useRef(null);

  /**
   * ICE candidate queue — buffers candidates that arrive before
   * setRemoteDescription has been called.  Drained once the remote
   * description is successfully applied.
   */
  const iceCandidateQueue = useRef([]);

  /**
   * WebRTC role flag — prevents glare (dual-offer race condition).
   * true  = this peer is the CALLER → creates the offer
   * false = this peer is the CALLEE → only answers offers
   * The caller is "impolite" (always keeps its offer); the callee is "polite".
   */
  const isCallerRef = useRef(false);

  /**
   * Negotiation lock — serialises setLocalDescription / setRemoteDescription
   * so that two async socket events can never interleave SDP operations.
   */
  const negotiationBusy = useRef(false);

  const stopOutgoingRingFeedback = useCallback(() => {
    if (ringToneIntervalRef.current) {
      clearInterval(ringToneIntervalRef.current);
      ringToneIntervalRef.current = null;
    }
    if (ringAudioContextRef.current) {
      const context = ringAudioContextRef.current;
      ringAudioContextRef.current = null;
      if (typeof context.close === 'function' && context.state !== 'closed') {
        context.close().catch(() => {});
      }
    }
  }, []);

  const playOutgoingRingPulse = useCallback(async () => {
    if (typeof window === 'undefined') return;

    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      if (!ringAudioContextRef.current) {
        ringAudioContextRef.current = new AudioCtx();
      }
      const ctx = ringAudioContextRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const playTone = (offsetSec, frequency, durationSec, gainPeak) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency, ctx.currentTime + offsetSec);
        gainNode.gain.setValueAtTime(0.0001, ctx.currentTime + offsetSec);
        gainNode.gain.exponentialRampToValueAtTime(gainPeak, ctx.currentTime + offsetSec + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offsetSec + durationSec);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start(ctx.currentTime + offsetSec);
        osc.stop(ctx.currentTime + offsetSec + durationSec + 0.03);
      };

      // Two short pulses to mimic a subtle outgoing call ringtone cadence.
      playTone(0, 950, 0.22, 0.045);
      playTone(0.36, 760, 0.18, 0.035);

      // Haptic-like vibration feedback on mobile browsers that support the Vibration API (best-effort).
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([100, 60, 80]);
      }
    } catch (_) {
      // Audio + haptic feedback is best-effort and should never block call flow.
    }
  }, []);

  useEffect(() => {
    if (outgoingCall && !isInCall) {
      if (!outgoingTimerRef.current) {
        outgoingTimerRef.current = setInterval(() => {
          setOutgoingElapsed((prev) => prev + 1);
        }, 1000);
      }

      playOutgoingRingPulse();
      if (!ringToneIntervalRef.current) {
        ringToneIntervalRef.current = setInterval(() => {
          playOutgoingRingPulse();
        }, 2600);
      }
      return;
    }

    if (outgoingTimerRef.current) {
      clearInterval(outgoingTimerRef.current);
      outgoingTimerRef.current = null;
    }
    setOutgoingElapsed(0);
    stopOutgoingRingFeedback();
  }, [outgoingCall, isInCall, playOutgoingRingPulse, stopOutgoingRingFeedback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current);
        outgoingTimeoutRef.current = null;
      }
      if (outgoingTimerRef.current) {
        clearInterval(outgoingTimerRef.current);
        outgoingTimerRef.current = null;
      }
      stopOutgoingRingFeedback();
      cleanupMediaStreams();
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [stopOutgoingRingFeedback]);

  // ── CRITICAL FIX: Attach local stream to <video> element after React renders it.
  // initializeMedia() runs BEFORE setActiveCall/setIsInCall, so localVideoRef.current
  // is null at that point. This effect re-attaches whenever the active call UI mounts.
  useEffect(() => {
    if (isInCall && localStreamRef.current && localVideoRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [isInCall, activeCall, isVideoEnabled]);

  // ── CRITICAL FIX: Attach remote stream to <video>/<audio> element after React renders it.
  // ontrack may fire before the active-call UI mounts; the stream is stored in
  // remoteStreamRef but never wired to the DOM element. This effect ensures it
  // gets attached once the element exists.
  useEffect(() => {
    if (!isInCall || !remoteStreamRef.current) return;

    if (remoteVideoRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.play().catch(() => {});
      }
    }

    if (remoteAudioRef.current) {
      if (remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
        remoteAudioRef.current.play().catch(() => {});
      }
      remoteAudioRef.current.muted = isMuted;
    }
  }, [isInCall, activeCall, isMuted]);

  // Keep refs in sync with state so socket handlers always see current value
  useEffect(() => { callTypeRef.current = callType; }, [callType]);
  useEffect(() => { activeCallRef.current = activeCall; }, [activeCall]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

  // Timer
  const startCallTimer = useCallback(() => {
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    const timer = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
    callTimerRef.current = timer;
  }, []);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    const getCallId = (payload) => payload?.callId || payload?.id || null;

    const handleIncomingCall = (callData) => {
      console.log('📞 Incoming call:', callData);
      traceRealtime('call', 'incoming_call', {
        callId: getCallId(callData),
        callerId: callData?.callerId || null,
        callType: callData?.type || callData?.callType || 'video'
      });
      if (isInCall || outgoingCall || incomingCall) {
        console.log('📵 Busy: auto rejecting incoming call because another call state is active');
        socket.emit('reject_call', {
          callId: getCallId(callData),
          targetUserId: callData.callerId,
          reason: 'busy'
        });
        return;
      }
      const normalized = {
        ...callData,
        id: getCallId(callData),
        callId: getCallId(callData),
        type: callData?.type || callData?.callType || 'video'
      };
      setIncomingCall(normalized);
      peerUserIdRef.current = String(callData?.callerId || callData?.peerUserId || callData?.targetUserId || '');
    };

    const handleCallRequestSent = (data) => {
      const canonicalCallId = getCallId(data);
      if (!canonicalCallId) return;

      // Ensure we keep outgoing state in sync even if the state update lags behind
      const base = outgoingCallRef.current || {};
      const updated = {
        ...base,
        id: canonicalCallId,
        callId: canonicalCallId,
        status: 'ringing'
      };

      setOutgoingCall(updated);
      outgoingCallRef.current = updated;
    };

    const handleCallAccepted = async (callData) => {
      console.log('✅ Call accepted:', callData);
      traceRealtime('call', 'accepted', {
        callId: getCallId(callData),
        peerUserId: callData?.targetUserId || callData?.peerUserId || callData?.callerId || null,
        callType: callData?.callType || callTypeRef.current || 'video'
      });
      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current);
        outgoingTimeoutRef.current = null;
      }
      const prevOutgoing = outgoingCallRef.current;
      const resolvedCallId = getCallId(callData) || getCallId(prevOutgoing);
      const activeCallData = {
        ...callData,
        id: resolvedCallId,
        callId: resolvedCallId,
        targetUserId: callData.targetUserId || callData.peerUserId || prevOutgoing?.targetUserId || callData.callerId,
        peerUserId: callData.targetUserId || callData.peerUserId || prevOutgoing?.targetUserId || callData.callerId,
        targetName: prevOutgoing?.targetName || callData.targetName || 'User',
      };
      setOutgoingCall(null);
      outgoingCallRef.current = null;
      setActiveCall(activeCallData);
      setIsInCall(true);
      startCallTimer();

      const currentCallType = callData.callType || callTypeRef.current || 'video';
      const peerUserId = String(activeCallData.peerUserId || activeCallData.targetUserId || '');
      peerUserIdRef.current = peerUserId;

      if (!localStreamRef.current) {
        console.log('🎤 Initializing media on call_accepted (was not yet ready)');
        await initializeMediaRef.current?.(currentCallType === 'video');
      }

      isCallerRef.current = true;
      if (peerUserId) {
        await createAndSendOfferRef.current?.(peerUserId);
      } else {
        console.warn('⚠️ call_accepted missing peer user ID; cannot send WebRTC offer');
      }
    };

    const handleCallRejected = () => {
      console.log('❌ Call rejected');
      traceRealtime('call', 'rejected', {
        callId: outgoingCallRef.current?.callId || null,
      });
      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current);
        outgoingTimeoutRef.current = null;
      }
      setOutgoingCall(null);
      outgoingCallRef.current = null;
      cleanupMediaStreams();
    };

    const handleCallEnded = () => {
      console.log('📞 Call ended by remote — cleaning up all call state');
      traceRealtime('call', 'ended_remote', {
        callId: outgoingCallRef.current?.callId || activeCallRef.current?.callId || null,
      });
      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current);
        outgoingTimeoutRef.current = null;
      }
      // Use endCall(true) to avoid re-emitting end_call back to the remote peer.
      // This MUST clean up all state immediately so the UI dismisses the call screen.
      endCallRef.current?.(true);
    };

    const handleCallTimeout = () => {
      console.log('⏰ Call timeout');
      traceRealtime('call', 'timeout', {
        callId: outgoingCallRef.current?.callId || incomingCall?.callId || null,
      });
      if (outgoingTimeoutRef.current) {
        clearTimeout(outgoingTimeoutRef.current);
        outgoingTimeoutRef.current = null;
      }
      setOutgoingCall(null);
      outgoingCallRef.current = null;
      setIncomingCall(null);
      cleanupMediaStreams();
    };

    const handleCallCancelled = () => {
      console.log('🚫 Call cancelled by caller');
      traceRealtime('call', 'cancelled', {
        callId: incomingCall?.callId || outgoingCallRef.current?.callId || null,
      });
      setIncomingCall(null);
      cleanupMediaStreams();
    };

    const handleWebrtcOffer = async (data) => {
      console.log('📡 Received WebRTC offer from:', data.callerId);
      traceRealtime('webrtc', 'offer_received', {
        callId: data?.callId || incomingCall?.callId || activeCallRef.current?.callId || null,
        callerId: data?.callerId || null,
        callType: data?.callType || data?.type || 'video'
      });
      try {
        // Ensure local media is ready before constructing an answer.
        // This avoids cases where the remote peer never receives our audio/video.
        await initializeMediaRef.current?.((data.callType || data.type || 'video') === 'video');
        await handleWebRTCOfferRef.current?.(data);
      } catch (error) {
        console.error('Error handling WebRTC offer:', error);
      }
    };

    const handleWebrtcAnswer = async (data) => {
      console.log('📡 Received WebRTC answer from:', data.answererId);
      traceRealtime('webrtc', 'answer_received', {
        callId: data?.callId || outgoingCallRef.current?.callId || activeCallRef.current?.callId || null,
        answererId: data?.answererId || null,
      });
      try {
        const pc = peerConnectionRef.current;
        if (!pc) return;
        if (pc.signalingState !== 'have-local-offer') {
          traceRealtime('webrtc', 'answer_ignored', {
            callId: data?.callId || outgoingCallRef.current?.callId || activeCallRef.current?.callId || null,
            signalingState: pc.signalingState,
          });
          console.warn('⚠️ Ignoring WebRTC answer — signalingState is', pc.signalingState);
          return;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        await drainIceCandidateQueue(pc);
      } catch (error) {
        console.error('Error handling WebRTC answer:', error);
      }
    };

    const handleIceCandidate = async (data) => {
      try {
        if (!data.candidate) return;
        const pc = peerConnectionRef.current;
        if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
          traceRealtime('webrtc', 'ice_candidate_buffered', {
            callId: data?.callId || outgoingCallRef.current?.callId || activeCallRef.current?.callId || null,
          });
          console.log('🧊 Buffering ICE candidate (remote description not yet set)');
          iceCandidateQueue.current.push(data.candidate);
          return;
        }
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        traceRealtime('webrtc', 'ice_candidate_error', {
          callId: data?.callId || outgoingCallRef.current?.callId || activeCallRef.current?.callId || null,
          reason: error?.message || 'unknown'
        });
        console.warn('ICE candidate error (non-fatal):', error.message);
      }
    };

    socket.on('incoming_call', handleIncomingCall);
    socket.on('call_request_sent', handleCallRequestSent);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_timeout', handleCallTimeout);
    socket.on('call_cancelled', handleCallCancelled);
    socket.on('webrtc_offer', handleWebrtcOffer);
    socket.on('webrtc_answer', handleWebrtcAnswer);
    socket.on('ice_candidate', handleIceCandidate);

    return () => {
      socket.off('incoming_call', handleIncomingCall);
      socket.off('call_request_sent', handleCallRequestSent);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_rejected', handleCallRejected);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_timeout', handleCallTimeout);
      socket.off('call_cancelled', handleCallCancelled);
      socket.off('webrtc_offer', handleWebrtcOffer);
      socket.off('webrtc_answer', handleWebrtcAnswer);
      socket.off('ice_candidate', handleIceCandidate);
    };
  }, [socket, isConnected, isInCall, incomingCall, outgoingCall, startCallTimer]);

  // Initialize media — shows user-friendly errors and retries audio-only on camera fail.
  // Uses professional audio constraints for clear voice quality.
  const initializeMedia = async (videoEnabled = true) => {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }
    if (mediaInitPromiseRef.current) {
      return mediaInitPromiseRef.current;
    }

    const mediaToken = ++mediaInitTokenRef.current;
    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1,          // Mono is better for voice
    };
    const mediaPromise = (async () => {
      const isCurrent = () => mediaInitTokenRef.current === mediaToken;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoEnabled ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } } : false,
          audio: audioConstraints
        });

        if (!isCurrent()) {
          stream.getTracks().forEach((track) => track.stop());
          return null;
        }

        localStreamRef.current = stream;
        traceRealtime('call', 'media_ready', {
          callType: videoEnabled ? 'video' : 'audio',
          tracks: stream.getTracks().map((track) => track.kind),
        });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        // If we already have a PeerConnection, inject the new tracks into it
        // (handles the case where PC was created before media was ready)
        addLocalTracksToPeerConnection(stream);
        return stream;
      } catch (error) {
        console.warn('Media access failed:', error);
        // If video was requested but denied, fall back to audio-only
        if (videoEnabled) {
          console.log('📹 Camera denied — falling back to audio-only');
          traceRealtime('call', 'media_fallback_audio_only', {
            reason: error?.name || error?.message || 'video_denied'
          });
          try {
            const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: audioConstraints });

            if (!isCurrent()) {
              audioStream.getTracks().forEach((track) => track.stop());
              return null;
            }

            localStreamRef.current = audioStream;
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = audioStream;
            }
            setIsVideoEnabled(false);
            addLocalTracksToPeerConnection(audioStream);
            return audioStream;
          } catch (audioError) {
            traceRealtime('call', 'media_denied', {
              reason: audioError?.name || audioError?.message || 'audio_denied'
            });
            console.error('🎤 Microphone also denied:', audioError);
          }
        }
        traceRealtime('call', 'media_denied', {
          reason: error?.name || error?.message || 'unknown'
        });
        console.error('❌ No media access — call will have no audio/video');
        return null;
      }
    })();

    mediaInitPromiseRef.current = mediaPromise;
    try {
      return await mediaPromise;
    } finally {
      if (mediaInitTokenRef.current === mediaToken) {
        mediaInitPromiseRef.current = null;
      }
    }
  };

  /**
   * Inject local media tracks into an existing PeerConnection.
   * Handles the race condition where acceptCall creates the PC before
   * getUserMedia has resolved — once the stream arrives, this function
   * adds the tracks so the remote peer receives our audio/video.
   */
  const addLocalTracksToPeerConnection = (stream) => {
    const pc = peerConnectionRef.current;
    if (!pc || !stream) return;
    const existingTrackKinds = new Set(
      pc.getSenders()
        .filter(s => s.track)
        .map(s => s.track.kind)
    );
    stream.getTracks().forEach(track => {
      if (!existingTrackKinds.has(track.kind)) {
        console.log(`➕ Late-adding ${track.kind} track to PeerConnection`);
        pc.addTrack(track, stream);
      }
    });
  };

  // Cleanup media
  const stopNetQualityPolling = useCallback(() => {
    if (netQualityIntervalRef.current) {
      clearInterval(netQualityIntervalRef.current);
      netQualityIntervalRef.current = null;
    }
    setNetworkQuality('connecting');
    prevRttRef.current = null;
  }, []);

  const startNetQualityPolling = useCallback(() => {
    stopNetQualityPolling();
    netQualityIntervalRef.current = setInterval(async () => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        let packetsLost = 0;
        let totalPackets = 1; // avoid division by zero
        let rtt = null;
        let jitter = 0;
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && (report.mediaType === 'audio' || report.kind === 'audio')) {
            packetsLost += report.packetsLost || 0;
            totalPackets += report.packetsReceived || 1;
            jitter = report.jitter || 0;
          }
          if (report.type === 'remote-inbound-rtp') {
            rtt = report.roundTripTime ?? rtt;
          }
        });
        const lossRate = packetsLost / totalPackets;
        const rttMs = rtt != null ? rtt * 1000 : (prevRttRef.current ?? 0);
        prevRttRef.current = rttMs;
        if (
          lossRate > NET_QUALITY_THRESHOLDS.poor.lossRate ||
          rttMs > NET_QUALITY_THRESHOLDS.poor.rttMs ||
          jitter > NET_QUALITY_THRESHOLDS.poor.jitter
        ) {
          setNetworkQuality('poor');
        } else if (
          lossRate > NET_QUALITY_THRESHOLDS.fair.lossRate ||
          rttMs > NET_QUALITY_THRESHOLDS.fair.rttMs ||
          jitter > NET_QUALITY_THRESHOLDS.fair.jitter
        ) {
          setNetworkQuality('fair');
        } else {
          setNetworkQuality('good');
        }
      } catch (_) {
        // getStats unavailable or pc closed — ignore silently.
      }
    }, NET_QUALITY_POLL_MS);
  }, [stopNetQualityPolling]);

  const cleanupMediaStreams = () => {
    mediaInitTokenRef.current += 1;
    mediaInitPromiseRef.current = null;
    if (netQualityIntervalRef.current) {
      clearInterval(netQualityIntervalRef.current);
      netQualityIntervalRef.current = null;
    }
    setNetworkQuality('connecting');
    prevRttRef.current = null;
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
    isCallerRef.current = false;
    negotiationBusy.current = false;
    iceCandidateQueue.current = [];
  };

  /**
   * Drain any ICE candidates that were buffered before remote description
   * was set.  Call this immediately after every successful setRemoteDescription.
   */
  const drainIceCandidateQueue = async (pc) => {
    const queued = iceCandidateQueue.current.splice(0);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Buffered ICE candidate failed:', err.message);
      }
    }
    if (queued.length) console.log(`🧊 Drained ${queued.length} buffered ICE candidate(s)`);
    if (queued.length) {
      traceRealtime('webrtc', 'ice_candidates_drained', {
        count: queued.length,
      });
    }
  };

  // Start call
  const startCall = useCallback(async (targetUserId, type = 'video', targetName = null) => {
    if (!socket || !isConnected) return;
    if (!targetUserId || String(targetUserId) === currentUserId) return;
    if (isInCallRef.current || outgoingCallRef.current || incomingCallRef.current) {
      console.log('📵 Cannot start call while another call is active or pending');
      return;
    }

    void initializeMediaRef.current?.(type === 'video');
    setCallType(type);
    const generatedCallId = Date.now().toString();
    const callData = {
      id: generatedCallId,
      callId: generatedCallId,
      targetUserId,
      peerUserId: targetUserId,
      targetName: targetName || 'User',
      type,
      status: 'calling'
    };
    setOutgoingElapsed(0);
    setOutgoingCall(callData);
    outgoingCallRef.current = callData;
    peerUserIdRef.current = String(targetUserId || '');

    socket.emit('call_request', {
      targetUserId,
      type,
      callerId: currentUserId,
      callerName: user.username || 'User',
      callId: generatedCallId
    });

    // Timeout after 30s — use ref to avoid stale closure
    if (outgoingTimeoutRef.current) {
      clearTimeout(outgoingTimeoutRef.current);
    }
    outgoingTimeoutRef.current = setTimeout(() => {
      if (outgoingCallRef.current && outgoingCallRef.current.status !== 'connected') {
        socket.emit('call_timeout', {
          callId: outgoingCallRef.current?.callId || outgoingCallRef.current?.id,
          targetUserId
        });
        setOutgoingCall(null);
        outgoingCallRef.current = null;
        cleanupMediaStreams();
      }
      outgoingTimeoutRef.current = null;
    }, 30000);
  }, [socket, isConnected, user, currentUserId]);

  // Register startCall with CallContext so ChatSystem can trigger calls
  useEffect(() => {
    registerStartCall(startCall);
    return () => registerStartCall(null);
  }, [registerStartCall, startCall]);

  // Sync local isInCall with global CallContext
  useEffect(() => {
    isInCallRef.current = isInCall;
    setGlobalIsInCall(isInCall);
  }, [isInCall, setGlobalIsInCall]);

  // Network quality: start polling WebRTC stats when call is active, stop when it ends.
  useEffect(() => {
    if (isInCall) {
      // Slight delay so PeerConnection is fully established before first getStats().
      const startDelay = setTimeout(() => startNetQualityPolling(), 2000);
      return () => {
        clearTimeout(startDelay);
        stopNetQualityPolling();
      };
    } else {
      stopNetQualityPolling();
    }
  }, [isInCall, startNetQualityPolling, stopNetQualityPolling]);

  // Accept call — IMMEDIATELY sends accept_call via socket, THEN initializes media.
  // This eliminates the 3-10 second getUserMedia permission delay that made the
  // pick button feel "slow and stiff". The caller sees the call accepted instantly;
  // media tracks are injected into the PeerConnection once getUserMedia resolves.
  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;

    const resolvedType = incomingCall.type || 'video';
    const resolvedPeerUserId = String(incomingCall.callerId || incomingCall.peerUserId || incomingCall.targetUserId || '');

    // ── Step 1: Accept and update UI (fast) ─────────────────────
    setCallType(resolvedType);
    setActiveCall({
      ...incomingCall,
      peerUserId: resolvedPeerUserId,
      targetUserId: resolvedPeerUserId
    });
    setIncomingCall(null);
    setIsInCall(true);
    peerUserIdRef.current = resolvedPeerUserId;
    isCallerRef.current = false;
    startCallTimer();

    void initializeMediaRef.current?.(resolvedType === 'video');

    // Emit accept immediately so the caller can start signaling while media
    // setup continues in the background on this device.
    socket.emit('accept_call', {
      callId: incomingCall.callId || incomingCall.id,
      targetUserId: incomingCall.callerId,
      callType: resolvedType
    });
  }, [incomingCall, socket, startCallTimer]);

  // Reject call
  const rejectCall = useCallback(() => {
    if (!incomingCall) return;
    socket.emit('reject_call', {
      callId: incomingCall.callId || incomingCall.id,
      targetUserId: incomingCall.callerId
    });
    setIncomingCall(null);
  }, [incomingCall, socket]);

  // End call — remoteInitiated=true means the OTHER peer ended, so we
  // must NOT re-emit 'end_call' back to them (would cause infinite loop).
  // Uses activeCallRef to avoid stale closure when called from onconnectionstatechange.
  //
  // CRITICAL: This now handles ALL call states — incoming, outgoing, AND active.
  // Previously, ending a call during the ringing phase (outgoing but not yet accepted)
  // would leave the remote side ringing forever because only activeCallRef was checked.
  const endCall = useCallback((remoteInitiated = false) => {
    // Determine what to notify the remote side about
    const call = activeCallRef.current;
    const outgoing = outgoingCallRef.current;
    const incoming = incomingCallRef.current;
    const peerUserId = String(
      call?.peerUserId || call?.targetUserId || call?.callerId ||
      outgoing?.targetUserId || outgoing?.peerUserId ||
      incoming?.callerId || incoming?.peerUserId ||
      peerUserIdRef.current || ''
    );

    if (!remoteInitiated && socket && peerUserId) {
      if (call) {
        // Active call — send end_call
        socket.emit('end_call', {
          callId: call.callId || call.id,
          targetUserId: peerUserId
        });
      } else if (outgoing) {
        // Still ringing — send cancel_call
        socket.emit('cancel_call', {
          callId: outgoing.callId || outgoing.id,
          targetUserId: peerUserId
        });
      }
      // incoming but not accepted = rejection (handled by rejectCall, but defensive)
    }

    // Clear ALL call state unconditionally
    setIsInCall(false);
    setActiveCall(null);
    activeCallRef.current = null;
    setOutgoingCall(null);
    outgoingCallRef.current = null;
    setIncomingCall(null);
    setCallDuration(0);
    if (outgoingTimeoutRef.current) {
      clearTimeout(outgoingTimeoutRef.current);
      outgoingTimeoutRef.current = null;
    }
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    cleanupMediaStreams();
    peerUserIdRef.current = null;
  }, [socket]);

  // Create (or reuse) peer connection with ICE handling.
  // IMPORTANT: If a PC already exists and is not closed, we reuse it to
  // prevent leaking connections and losing buffered ICE candidates.
  const createPeerConnection = (targetUserId) => {
    const existing = peerConnectionRef.current;
    if (existing && existing.connectionState !== 'closed') {
      traceRealtime('webrtc', 'peer_connection_reused', { targetUserId: targetUserId || null });
      console.log('♻️ Reusing existing PeerConnection');
      return existing;
    }

    // Close stale PC if any
    if (existing) {
      try { existing.close(); } catch (_) {}
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        // STUN servers — help discover public IP
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        // Additional public STUN servers for reliability
        { urls: 'stun:stun.stunprotocol.org:3478' },
        // TURN servers should be provided via environment variables only
        ...(process.env.REACT_APP_TURN_URL ? [{
          urls: process.env.REACT_APP_TURN_URL,
          username: process.env.REACT_APP_TURN_USERNAME || '',
          credential: process.env.REACT_APP_TURN_CREDENTIAL || ''
        }] : [])
      ],
      // Prefer relay candidates when TURN is available — ensures media flows
      // even through the most restrictive NATs
      iceTransportPolicy: process.env.REACT_APP_FORCE_RELAY === 'true' ? 'relay' : 'all'
    });
    peerConnectionRef.current = pc;
    traceRealtime('webrtc', 'peer_connection_created', {
      targetUserId: targetUserId || null,
      relayOnly: process.env.REACT_APP_FORCE_RELAY === 'true'
    });

    // Add local tracks to connection (may be empty if getUserMedia hasn't
    // resolved yet — addLocalTracksToPeerConnection() handles late injection)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    } else {
      console.log('ℹ️ No local media yet — tracks will be added once getUserMedia resolves');
    }

    // Handle remote tracks — this fires when the other peer's media arrives.
    // We use a single MediaStream to collect all incoming tracks (audio + video)
    // so the <video> element plays both audio and video from one source.
    pc.ontrack = (event) => {
      console.log('📹 Received remote track:', event.track.kind, '| readyState:', event.track.readyState);
      let stream = remoteStreamRef.current;
      if (!stream) {
        stream = event.streams[0] || new MediaStream();
        remoteStreamRef.current = stream;
      }
      traceRealtime('webrtc', 'remote_track', {
        kind: event.track.kind,
        trackId: event.track.id || null,
      });
      // Add track to existing stream if not already present
      const existingTrackIds = new Set(stream.getTracks().map(t => t.id));
      if (!existingTrackIds.has(event.track.id)) {
        stream.addTrack(event.track);
      }
      // ✅ CRITICAL: Attach based on track kind.
      // Video → remoteVideoRef; Audio → remoteAudioRef.
      // Previously audio was never attached to a DOM element, causing silence.
      if (event.track.kind === 'audio') {
        if (remoteAudioRef.current) {
          if (remoteAudioRef.current.srcObject !== stream) {
            remoteAudioRef.current.srcObject = stream;
          }
          remoteAudioRef.current.play().catch(e => console.warn('Remote audio play blocked:', e.message));
        }
      } else if (event.track.kind === 'video') {
        if (remoteVideoRef.current) {
          if (remoteVideoRef.current.srcObject !== stream) {
            remoteVideoRef.current.srcObject = stream;
          }
          remoteVideoRef.current.play().catch(e => console.warn('Remote video play blocked:', e.message));
        }
      }
    };

    // onnegotiationneeded — fires when tracks are added/removed after the
    // initial offer/answer. ONLY the caller triggers re-negotiation to
    // prevent glare (simultaneous offers from both peers).
    pc.onnegotiationneeded = async () => {
      traceRealtime('webrtc', 'negotiation_needed', {
        caller: !!isCallerRef.current,
        signalingState: pc.signalingState,
      });
      console.log('🔄 Negotiation needed (caller:', isCallerRef.current, ')');
      if (!isCallerRef.current) return;
      if (negotiationBusy.current) return;
      negotiationBusy.current = true;
      try {
        const offer = await pc.createOffer();
        // Check state again — may have changed while we awaited
        if (pc.signalingState !== 'stable') {
          traceRealtime('webrtc', 'negotiation_skipped', {
            reason: 'signaling_not_stable',
            signalingState: pc.signalingState,
          });
          console.log('⏳ onnegotiationneeded: signalingState not stable, skipping');
          return;
        }
        await pc.setLocalDescription(offer);
        const targetId = peerUserIdRef.current;
        if (targetId && socket) {
          traceRealtime('webrtc', 'offer_sent', {
            targetUserId: targetId,
          });
          socket.emit('webrtc_offer', {
            offer: pc.localDescription,
            targetUserId: targetId,
            callType: callTypeRef.current
          });
        }
      } catch (err) {
        console.error('onnegotiationneeded error:', err);
      } finally {
        negotiationBusy.current = false;
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket) {
        traceRealtime('webrtc', 'ice_candidate_sent', {
          targetUserId,
          callId: outgoingCallRef.current?.callId || activeCallRef.current?.callId || null,
        });
        socket.emit('ice_candidate', {
          callId: outgoingCallRef.current?.callId || activeCallRef.current?.callId || null,
          candidate: event.candidate,
          targetUserId
        });
      }
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      traceRealtime('webrtc', 'connection_state', {
        state: pc.connectionState,
      });
      console.log('📶 Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed') {
        traceRealtime('webrtc', 'connection_failed', {
          state: pc.connectionState,
        });
        endCall();
      } else if (pc.connectionState === 'disconnected') {
        console.warn('⚠️ WebRTC connection disconnected (may recover) — not ending call yet');
      }
    };

    // ICE connection state — fires more reliably in some browsers (Firefox, older Chrome)
    pc.oniceconnectionstatechange = () => {
      traceRealtime('webrtc', 'ice_state', {
        state: pc.iceConnectionState,
      });
      console.log('🧊 ICE connection state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'failed') {
        // Attempt ICE restart before giving up
        traceRealtime('webrtc', 'ice_restart', {
          caller: !!isCallerRef.current,
        });
        console.warn('🔄 ICE failed — attempting ICE restart');
        if (isCallerRef.current && !negotiationBusy.current) {
          pc.restartIce();
        }
      }
    };

    return pc;
  };

  // Create and send WebRTC offer — CALLER ONLY.
  // Guards: (1) must be the caller, (2) prevents duplicate offers via negotiationBusy.
  const createAndSendOffer = async (targetUserId) => {
    if (!isCallerRef.current) {
      console.log('⛔ createAndSendOffer skipped — we are the callee');
      return;
    }
    if (negotiationBusy.current) {
      console.log('⏳ createAndSendOffer skipped — negotiation already in progress');
      return;
    }
    negotiationBusy.current = true;
    try {
      const pc = createPeerConnection(targetUserId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      traceRealtime('webrtc', 'offer_sent', {
        targetUserId,
        callId: outgoingCallRef.current?.callId || activeCallRef.current?.callId || null,
      });
      console.log('📡 Sending WebRTC offer to:', targetUserId);
      socket.emit('webrtc_offer', {
        callId: outgoingCallRef.current?.callId || activeCallRef.current?.callId || null,
        offer: pc.localDescription,
        targetUserId,
        callType: callTypeRef.current
      });
    } catch (error) {
      console.error('Error creating WebRTC offer:', error);
    } finally {
      negotiationBusy.current = false;
    }
  };

  // Handle incoming WebRTC offer — CALLEE ONLY.
  // Reuses existing PeerConnection; sets remote description and creates answer.
  const handleWebRTCOffer = async (data) => {
    try {
      const targetUserId = data.callerId;
      // Reuse or create PC
      const pc = createPeerConnection(targetUserId);

      // Guard: if we already have an offer set, skip to prevent glare
      if (pc.signalingState !== 'stable' && pc.signalingState !== 'have-remote-offer') {
        console.warn('⚠️ handleWebRTCOffer ignored — signalingState:', pc.signalingState);
        return;
      }

      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      await drainIceCandidateQueue(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      traceRealtime('webrtc', 'answer_sent', {
        targetUserId,
        callId: incomingCall?.callId || activeCallRef.current?.callId || null,
      });
      console.log('📡 Sending WebRTC answer to:', targetUserId);
      socket.emit('webrtc_answer', {
        callId: incomingCall?.callId || activeCallRef.current?.callId || null,
        answer: pc.localDescription,
        targetUserId
      });
    } catch (error) {
      console.error('Error handling WebRTC offer:', error);
    }
  };

  initializeMediaRef.current = initializeMedia;
  createAndSendOfferRef.current = createAndSendOffer;
  handleWebRTCOfferRef.current = handleWebRTCOffer;
  endCallRef.current = endCall;

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
    const next = !isMuted;
    setIsMuted(next);
    // Actually mute/unmute the remote audio output
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = next;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = next;
    }
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
                  {outgoingCall.targetName?.charAt(0) || 'U'}
                </Avatar>
              </motion.div>
              
              <Typography sx={styles.callerName}>{outgoingCall.targetName || 'Calling...'}</Typography>
              
              <Typography sx={styles.callStatus}>
                <motion.span
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  ●
                </motion.span>
                {outgoingCall.status === 'calling' ? 'Dialing secure line...' : 'Ringing recipient...'}
              </Typography>

              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.78)',
                  fontSize: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                {outgoingCall.type === 'video' ? '📹 Video call' : '📞 Audio call'} • {formatDuration(outgoingElapsed)}
              </Typography>

              <Box sx={{ display: 'flex', gap: 0.6, mt: 0.5 }}>
                {[0, 1, 2, 3].map((index) => (
                  <motion.div
                    key={index}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'rgba(0, 242, 234, 0.9)',
                      boxShadow: '0 0 10px rgba(0, 242, 234, 0.55)'
                    }}
                    animate={{ opacity: [0.2, 1, 0.2], scale: [0.9, 1.1, 0.9] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: index * 0.15 }}
                  />
                ))}
              </Box>
            </Box>
          </Box>

          <Box sx={styles.controlsContainer}>
            <Box sx={styles.controlsRow}>
              <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}>
                <IconButton
                  onClick={() => {
                      if (outgoingTimeoutRef.current) {
                        clearTimeout(outgoingTimeoutRef.current);
                        outgoingTimeoutRef.current = null;
                      }
                    socket.emit('cancel_call', {
                      callId: outgoingCall.callId || outgoingCall.id,
                      targetUserId: outgoingCall.targetUserId
                    });
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
                {(activeCall.targetName || activeCall.callerName)?.charAt(0) || 'U'}
              </Avatar>
              <Box>
                <Typography sx={styles.headerName}>
                  {activeCall.targetName || activeCall.callerName || 'User'}
                </Typography>
                <Typography sx={styles.headerStatus}>
                  <span style={{ color: '#00ff88' }}>●</span> {formatDuration(callDuration)}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {/* Network quality badge — derived from WebRTC getStats() polling */}
              <Box sx={{
                display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25,
                borderRadius: 10, fontSize: '0.65rem', fontWeight: 600,
                backdropFilter: 'blur(6px)',
                backgroundColor:
                  networkQuality === 'good' ? 'rgba(0,220,100,0.22)' :
                  networkQuality === 'fair' ? 'rgba(255,180,0,0.22)' :
                  networkQuality === 'poor' ? 'rgba(255,80,60,0.22)' :
                  'rgba(180,180,180,0.18)',
                color:
                  networkQuality === 'good' ? '#00dc64' :
                  networkQuality === 'fair' ? '#ffb400' :
                  networkQuality === 'poor' ? '#ff5040' :
                  '#ccc',
                border: '1px solid',
                borderColor:
                  networkQuality === 'good' ? 'rgba(0,220,100,0.35)' :
                  networkQuality === 'fair' ? 'rgba(255,180,0,0.35)' :
                  networkQuality === 'poor' ? 'rgba(255,80,60,0.35)' :
                  'rgba(180,180,180,0.25)',
              }}>
                <Box sx={{
                  width: 6, height: 6, borderRadius: '50%',
                  backgroundColor: 'currentColor',
                  animation: networkQuality === 'connecting' ? 'pulse 1.4s ease-in-out infinite' : 'none',
                }} />
                {networkQuality === 'connecting' ? 'Connecting…' :
                 networkQuality === 'good' ? 'Good' :
                 networkQuality === 'fair' ? 'Fair' : 'Poor'}
              </Box>
              <IconButton onClick={toggleFullscreen} sx={{ color: '#fff' }}>
                {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
              </IconButton>
            </Box>
          </Box>

          {/* Video container */}
          <Box sx={styles.videoContainer}>
            {/* Remote stream element — always rendered so audio plays for both call types */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                ...styles.remoteVideo,
                // Hide video element for audio-only calls but keep it in DOM for audio playback
                ...(callType !== 'video' ? { position: 'absolute', width: 0, height: 0, opacity: 0 } : {})
              }}
            />
            {/* Fallback audio element to ensure audio plays in audio-only calls and when video is muted */}
            <audio
              ref={remoteAudioRef}
              autoPlay
              style={{
                position: 'absolute',
                width: 1,
                height: 1,
                opacity: 0,
                pointerEvents: 'none',
                left: -9999,
              }}
            />
            {callType === 'video' ? (
              <>
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
                  {(activeCall.targetName || activeCall.callerName)?.charAt(0) || 'U'}
                </Avatar>
                <Typography sx={styles.callerName}>
                  {activeCall.targetName || activeCall.callerName || 'User'}
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
                  <IconButton
                    onClick={async () => {
                      try {
                        const stream = localStreamRef.current;
                        if (!stream) return;
                        const videoTrack = stream.getVideoTracks()[0];
                        if (!videoTrack) return;
                        // Use facingMode constraint to switch cameras
                        const currentFacing = videoTrack.getSettings().facingMode || 'user';
                        const newFacing = currentFacing === 'user' ? 'environment' : 'user';
                        const newStream = await navigator.mediaDevices.getUserMedia({
                          video: { facingMode: newFacing },
                          audio: false
                        });
                        const newVideoTrack = newStream.getVideoTracks()[0];
                        // Replace track in peer connection
                        const pc = peerConnectionRef.current;
                        if (pc) {
                          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
                          if (sender) await sender.replaceTrack(newVideoTrack);
                        }
                        // Replace track in local stream
                        stream.removeTrack(videoTrack);
                        videoTrack.stop();
                        stream.addTrack(newVideoTrack);
                        if (localVideoRef.current) {
                          localVideoRef.current.srcObject = stream;
                        }
                      } catch (err) {
                        console.warn('Camera switch failed:', err.message);
                      }
                    }}
                    sx={styles.controlBtn}
                  >
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
