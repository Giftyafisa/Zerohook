import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Badge,
  InputAdornment,
  CircularProgress,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Chip,
  Fab,
  Drawer
} from '@mui/material';
import { toast } from 'react-toastify';
import {
  Send as SendIcon,
  AttachFile as AttachIcon,
  Videocam as VideoIcon,
  Phone as PhoneIcon,
  MoreVert as MoreIcon,
  Search as SearchIcon,
  ArrowBack as BackIcon,
  Lock as LockIcon,
  Check as CheckIcon,
  DoneAll as DoneAllIcon,
  EmojiEmotions as EmojiIcon,
  Block as BlockIcon,
  Report as ReportIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  AccountBalanceWallet as WalletIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  RequestQuote as RequestIcon,
  Clear as ClearIcon,
  SearchOff as SearchOffIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Add as AddIcon,
  ContentCopy as CopyIcon,
  Close as CloseIcon,
  Archive as ArchiveIcon
} from '@mui/icons-material';
import PaymentSheet from './PaymentSheet';
import { MilestoneRequestDialog, MilestoneRequestCard } from './MilestoneRequest';
import { keyframes } from '@emotion/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL, getUploadUrl } from '../config/constants';
import { useDispatch } from 'react-redux';
import { decrementUnreadMessages } from '../store/slices/uiSlice';

// Helper to resolve avatar URL from backend profilePicture (might be string, object, or JSON string)
const resolveAvatarUrl = (profilePicture) => {
  if (!profilePicture) return null;
  
  // If it's already a valid URL, return it
  if (typeof profilePicture === 'string' && (profilePicture.startsWith('http://') || profilePicture.startsWith('https://'))) {
    return profilePicture;
  }
  
  // If it's a string that looks like JSON, try to parse it
  if (typeof profilePicture === 'string' && (profilePicture.startsWith('{') || profilePicture.startsWith('['))) {
    try {
      const parsed = JSON.parse(profilePicture);
      if (parsed.url) {
        return parsed.url.startsWith('http') ? parsed.url : getUploadUrl(parsed.url);
      }
    } catch (e) {
      // Not valid JSON, treat as path
    }
  }
  
  // If it's an object with url property
  if (typeof profilePicture === 'object' && profilePicture.url) {
    return profilePicture.url.startsWith('http') ? profilePicture.url : getUploadUrl(profilePicture.url);
  }
  
  // If it's a simple string path, treat as upload path
  if (typeof profilePicture === 'string') {
    return getUploadUrl(profilePicture);
  }
  
  return null;
};

const typingBlink = keyframes`
  0% { opacity: 0.3; transform: translateY(0px); }
  50% { opacity: 1; transform: translateY(-2px); }
  100% { opacity: 0.3; transform: translateY(0px); }
`;

// Swipeable Conversation Item Component
const SwipeableConversationItem = ({ 
  children, 
  onSwipeLeft, 
  onSwipeRight, 
  conversationId,
  swipedId,
  setSwipedId,
  hasUnread
}) => {
  const [translateX, setTranslateX] = useState(0);
  
  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      const deltaX = eventData.deltaX;
      // Limit swipe distance
      const maxSwipe = 80;
      const newTranslate = Math.max(-maxSwipe, Math.min(maxSwipe, deltaX));
      setTranslateX(newTranslate);
    },
    onSwipedLeft: () => {
      if (translateX < -40) {
        setSwipedId(conversationId);
        setTranslateX(-80);
      } else {
        setTranslateX(0);
      }
    },
    onSwipedRight: () => {
      if (translateX > 40 && hasUnread) {
        onSwipeRight();
        setTranslateX(0);
      } else {
        setTranslateX(0);
      }
    },
    onTouchEndOrOnMouseUp: () => {
      if (Math.abs(translateX) < 40) {
        setTranslateX(0);
      }
    },
    trackMouse: false,
    trackTouch: true,
    preventScrollOnSwipe: true,
    delta: 10
  });

  // Reset when another item is swiped
  React.useEffect(() => {
    if (swipedId && swipedId !== conversationId) {
      setTranslateX(0);
    }
  }, [swipedId, conversationId]);

  return (
    <Box sx={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background actions */}
      <Box sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        alignItems: 'stretch'
      }}>
        {/* Left side - Mark as read (green) */}
        <Box sx={{
          flex: 1,
          background: hasUnread ? 'linear-gradient(90deg, #00ff88, #00cc6a)' : 'rgba(255,255,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          pl: 2,
          color: hasUnread ? '#000' : 'rgba(255,255,255,0.3)'
        }}>
          <DoneAllIcon />
        </Box>
        {/* Right side - Delete (red) */}
        <Box 
          sx={{
            width: 80,
            background: 'linear-gradient(90deg, #ff4444, #cc3333)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer'
          }}
          onClick={() => {
            if (swipedId === conversationId) {
              onSwipeLeft();
            }
          }}
        >
          <DeleteIcon />
        </Box>
      </Box>
      
      {/* Foreground content */}
      <Box
        {...handlers}
        sx={{
          transform: `translateX(${translateX}px)`,
          transition: translateX === 0 ? 'transform 0.2s ease-out' : 'none',
          background: 'var(--bg-secondary, #1a1a22)',
          position: 'relative',
          zIndex: 1
        }}
      >
        {children}
      </Box>
    </Box>
  );
};

const ChatSystem = ({
  recipientId: propRecipientId = null,
  recipientName: propRecipientName = null,
  recipientAvatar: propRecipientAvatar = null,
  initialConversationId: propInitialConversationId = null
}) => {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  // Recipient / navigation state
  const routeState = location?.state || {};
  const targetRecipientId = propRecipientId || routeState.recipientId || null;
  const targetRecipientName = propRecipientName || routeState.recipientName || null;
  const targetRecipientAvatar = propRecipientAvatar || routeState.recipientAvatar || null;
  const initialConversationId = propInitialConversationId || routeState.conversationId || routeState.conversationID || null;
  
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [startingConversation, setStartingConversation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [typingConversations, setTypingConversations] = useState([]);
  
  // Call states
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [callType, setCallType] = useState(null); // 'audio' or 'video'
  const [isCallActive, setIsCallActive] = useState(false);
  
  // Payment / Escrow states
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [activeEscrow, setActiveEscrow] = useState(null);
  const [escrowLoading, setEscrowLoading] = useState(false);
  
  // Milestone request states
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [pendingMilestones, setPendingMilestones] = useState([]);
  const [isProvider, setIsProvider] = useState(false); // Is current user a provider?
  
  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const menuOpen = Boolean(menuAnchorEl);

  // Emoji picker (lightweight)
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const emojiMenuOpen = Boolean(emojiAnchorEl);
  
  // Scroll-to-bottom FAB state
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  // Mobile action drawer for input buttons
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  
  // Message long-press menu state
  const [messageMenuAnchor, setMessageMenuAnchor] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const longPressTimer = useRef(null);
  
  // Attachment preview state
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  
  // Swipe action state for conversations
  const [swipedConversationId, setSwipedConversationId] = useState(null);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const hasBootstrappedRef = useRef(false);
  const prevConversationIdRef = useRef(null);

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      if (socket && isConnected) {
        socket.emit('join_conversation', selectedConversation.id);
      }
      setRemoteTyping(false);
    }
  }, [selectedConversation, socket, isConnected]);

  // Emit typing_stop when switching conversations or unmounting to avoid stuck indicators
  useEffect(() => {
    const prevId = prevConversationIdRef.current;
    if (prevId && prevId !== selectedConversation?.id && socket && isConnected) {
      socket.emit('typing_stop', { conversationId: prevId });
    }
    prevConversationIdRef.current = selectedConversation?.id || null;

    return () => {
      if (prevConversationIdRef.current && socket && isConnected) {
        socket.emit('typing_stop', { conversationId: prevConversationIdRef.current });
      }
    };
  }, [selectedConversation, socket, isConnected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle scroll position for scroll-to-bottom FAB
  const handleMessagesScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Auto-scroll to bottom when keyboard appears (mobile viewport resize)
  useEffect(() => {
    const handleViewportResize = () => {
      if (window.visualViewport && selectedConversation) {
        // When keyboard appears, viewport height decreases - scroll to bottom
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    };

    window.visualViewport?.addEventListener('resize', handleViewportResize);
    return () => window.visualViewport?.removeEventListener('resize', handleViewportResize);
  }, [selectedConversation]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (messageData) => {
      let conversationFound = false;
      if (selectedConversation && messageData.conversationId === selectedConversation.id) {
        setMessages(prev => [...prev, messageData]);
        if (messageData.senderId !== user?.id) {
          setRemoteTyping(false);
          markConversationRead(messageData.conversationId);
        }
      }
      setConversations(prev =>
        sortConversations(prev.map(conv => {
          if (conv.id !== messageData.conversationId) return conv;
          conversationFound = true;
          const isOwn = messageData.senderId === user?.id;
          const isActive = selectedConversation?.id === conv.id;
          return {
            ...conv,
            lastMessage: messageData.content,
            lastMessageTime: messageData.createdAt,
            unreadCount: isOwn || isActive ? 0 : (conv.unreadCount || 0) + 1
          };
        }))
      );
      if (!conversationFound) {
        // Fetch latest conversations to include new thread
        loadConversations({ silent: true });
      }
    };

    socket.on('new_message', handleNewMessage);
    const handleTypingStart = ({ conversationId }) => {
      setTypingConversations((prev) => (prev.includes(conversationId) ? prev : [...prev, conversationId]));
      if (selectedConversation?.id === conversationId) {
        setRemoteTyping(true);
      }
    };
    const handleTypingStop = ({ conversationId }) => {
      setTypingConversations((prev) => prev.filter((id) => id !== conversationId));
      if (selectedConversation?.id === conversationId) {
        setRemoteTyping(false);
      }
    };

    socket.on('typing_start', handleTypingStart);
    socket.on('typing_stop', handleTypingStop);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('typing_start', handleTypingStart);
      socket.off('typing_stop', handleTypingStop);
    };
  }, [socket, isConnected, selectedConversation, user]);

  // Bootstrap target recipient or conversation from props / navigation state
  useEffect(() => {
    console.log('💬 Bootstrap effect:', { user: !!user, loading, hasBootstrapped: hasBootstrappedRef.current, targetRecipientId, initialConversationId });
    
    if (!user || loading || hasBootstrappedRef.current) return;

    const tryBootstrap = async () => {
      try {
        if (targetRecipientId) {
          console.log('💬 Bootstrapping with targetRecipientId:', targetRecipientId);
          hasBootstrappedRef.current = true;
          await startConversationWithRecipient(targetRecipientId);
        } else if (initialConversationId) {
          const existing = conversations.find(c => c.id === initialConversationId);
          if (existing) {
            hasBootstrappedRef.current = true;
            selectConversation(existing);
          }
        }
      } catch (error) {
        console.error('Bootstrap chat failed:', error);
      }
    };

    tryBootstrap();
  }, [user, loading, targetRecipientId, initialConversationId, conversations]);

  const sortConversations = (list = []) =>
    [...list].sort((a, b) => new Date(b.lastMessageTime || b.createdAt || 0) - new Date(a.lastMessageTime || a.createdAt || 0));

  const resolveMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    return getUploadUrl(url);
  };

  const loadConversations = async ({ silent = false } = {}) => {
    try {
      console.log('🔄 Loading conversations...');
      if (!silent) setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/chat/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('📡 Conversations API response:', response.status, response.ok);
      if (response.ok) {
        const data = await response.json();
        console.log('📋 Raw conversations data:', data);
        // Transform API response to expected frontend format
        const transformedConversations = (data.conversations || []).map(conv => ({
          id: conv.id,
          participantName: conv.otherUser?.username || 'Unknown',
          participantAvatar: resolveAvatarUrl(conv.otherUser?.profilePicture),
          participantOnline: false, // Will be updated via socket
          participantVerified: (conv.otherUser?.verificationTier || 0) >= 2,
          participantId: conv.otherUser?.id,
          lastMessage: conv.lastMessage,
          lastMessageTime: conv.lastMessageTime,
          unreadCount: conv.unreadCount || 0,
          hasActiveEscrow: conv.hasActiveEscrow || false,
          createdAt: conv.createdAt
        }));
        console.log('🔄 Transformed conversations:', transformedConversations);
        const sorted = sortConversations(transformedConversations);
        setConversations(sorted);
        console.log('✅ Conversations loaded successfully:', sorted.length, 'conversations');
        return sorted;
      } else {
        console.error('❌ Conversations API failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Failed to load conversations:', error);
      toast.error('Unable to load conversations right now.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      console.log('📨 Loading messages for conversation:', conversationId);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/chat/messages/${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      console.log('📨 Messages API response:', response.status, response.ok);
      if (response.ok) {
        const data = await response.json();
        console.log('💬 Messages data:', data);
        setMessages(data.messages || []);
        console.log('💬 Messages set to state:', data.messages?.length || 0);
        setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c));
        await markConversationRead(conversationId);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      toast.error('Unable to load messages right now.');
    }
  };

  const startConversationWithRecipient = async (recipientId) => {
    console.log('💬 startConversationWithRecipient called with:', recipientId, typeof recipientId);
    
    if (!recipientId || startingConversation) {
      console.log('💬 Skipping - no recipientId or already starting:', { recipientId, startingConversation });
      return null;
    }
    
    const existing = conversations.find(c => c.participantId === recipientId || String(c.participantId) === String(recipientId));
    if (existing) {
      console.log('💬 Found existing conversation:', existing.id);
      selectConversation(existing);
      return existing;
    }

    try {
      setStartingConversation(true);
      const token = localStorage.getItem('token');
      
      // Ensure recipientId is sent correctly
      const payload = { otherUserId: recipientId };
      const apiUrl = `${API_BASE_URL}/chat/start`;
      console.log('💬 Sending chat/start with payload:', payload);
      console.log('💬 API URL:', apiUrl, '| API_BASE_URL:', API_BASE_URL);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('💬 Chat start failed:', response.status, errorData);
        throw new Error(errorData.message || 'Failed to start conversation');
      }
      
      const data = await response.json();
      console.log('💬 Chat start success:', data);
      
      const convList = await loadConversations({ silent: true });
      const created = convList?.find(c => c.participantId === recipientId || String(c.participantId) === String(recipientId) || c.id === data.conversationId);
      if (created) {
        selectConversation(created);
      }
      return created || null;
    } catch (error) {
      console.error('Failed to start conversation:', error);
      toast.error(error.message || 'Unable to start conversation right now.');
      return null;
    } finally {
      setStartingConversation(false);
    }
  };

  const sendMessagePayload = async ({ content, messageType = 'text', metadata = {} }) => {
    if (!content || !selectedConversation) return;

    const tempId = `temp-${Date.now()}`;
    const tempMessage = {
      id: tempId,
      content,
      senderId: user.id,
      conversationId: selectedConversation.id,
      createdAt: new Date().toISOString(),
      status: 'sending',
      messageType,
      metadata
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      console.log('📤 Sending message payload:', { content, messageType, metadata }, 'to conversation:', selectedConversation.id);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          content,
          messageType,
          metadata
        })
      });

      console.log('📤 Send API response:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('📤 Message sent successfully, data:', data);
        const saved = data.message;
        if (saved) {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === tempId ? { ...saved, status: 'sent' } : msg
            )
          );
          setConversations(prev =>
            prev
              .map(conv => conv.id === selectedConversation.id
                ? { ...conv, lastMessage: messageType === 'text' ? saved.content : '[Attachment]', lastMessageTime: saved.createdAt }
                : conv)
              .sort((a, b) => new Date(b.lastMessageTime || b.createdAt || 0) - new Date(a.lastMessageTime || a.createdAt || 0))
          );
        }
      } else {
        console.error('📤 Send failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message.');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    const messageContent = newMessage.trim();
    setNewMessage('');
    await sendMessagePayload({ content: messageContent, messageType: 'text' });
  };

  // Show preview before uploading attachment
  const handleFilePreview = (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedConversation) return;
    
    // Store the file for later upload
    setPendingFile(file);
    
    // Generate preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setAttachmentPreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      // For non-images, show generic preview
      setAttachmentPreview('file');
    }
    
    // Clear the input
    event.target.value = '';
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedConversation) return;
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await fetch(`${API_BASE_URL}/uploads/chat-attachment`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const data = await uploadRes.json();
      const fileType = data.fileType || (file.type.startsWith('video/') ? 'video' : file.type.startsWith('image/') ? 'image' : 'file');
      const contentUrl = resolveMediaUrl(data.url || data.path || data.publicUrl);
      const metadata = {
        filename: data.filename || file.name,
        size: data.size || file.size,
        mimeType: data.mimeType || file.type
      };
      await sendMessagePayload({ content: contentUrl, messageType: fileType, metadata });
    } catch (err) {
      console.error('Attachment upload failed:', err);
      toast.error('Failed to upload attachment.');
    } finally {
      event.target.value = '';
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (socket && isConnected && selectedConversation && !isTyping) {
      setIsTyping(true);
      socket.emit('typing_start', { conversationId: selectedConversation.id });
    }
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (socket && isConnected && selectedConversation) {
        setIsTyping(false);
        socket.emit('typing_stop', { conversationId: selectedConversation.id });
      }
    }, 2000);
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = new Date();
    const date = new Date(timestamp);
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  // Handle voice call
  const handleVoiceCall = () => {
    if (!selectedConversation) return;
    setCallType('audio');
    setCallDialogOpen(true);
    
    // Emit call request via socket
    if (socket && isConnected) {
      socket.emit('call_request', {
        conversationId: selectedConversation.id,
        targetUserId: selectedConversation.participantId,
        callType: 'audio'
      });
    }
  };

  // Handle video call
  const handleVideoCall = () => {
    if (!selectedConversation) return;
    setCallType('video');
    setCallDialogOpen(true);
    
    // Emit call request via socket
    if (socket && isConnected) {
      socket.emit('call_request', {
        conversationId: selectedConversation.id,
        targetUserId: selectedConversation.participantId,
        callType: 'video'
      });
    }
  };

  // Cancel/end call
  const handleEndCall = () => {
    setCallDialogOpen(false);
    setIsCallActive(false);
    setCallType(null);
    
    if (socket && isConnected && selectedConversation) {
      socket.emit('call_end', {
        conversationId: selectedConversation.id,
        targetUserId: selectedConversation.participantId
      });
    }
  };

  // View user profile
  const handleViewProfile = () => {
    if (selectedConversation?.participantId) {
      navigate(`/profile/${selectedConversation.participantId}`);
    }
    setMenuAnchorEl(null);
  };

  // Open more menu
  const handleMenuOpen = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  // Close menu
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  // Block user
  const handleBlockUser = async () => {
    if (!selectedConversation?.participantId) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/users/block/${selectedConversation.participantId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Remove conversation from list
      setConversations(prev => prev.filter(c => c.id !== selectedConversation.id));
      setSelectedConversation(null);
      setShowMobileChat(false);
    } catch (error) {
      console.error('Failed to block user:', error);
    }
    setMenuAnchorEl(null);
  };

  // Report user
  const handleReportUser = () => {
    if (selectedConversation?.participantId) {
      navigate(`/report?userId=${selectedConversation.participantId}&type=user`);
    }
    setMenuAnchorEl(null);
  };

  // Delete conversation
  const handleDeleteConversation = async () => {
    if (!selectedConversation) return;
    
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/chat/conversations/${selectedConversation.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setConversations(prev => prev.filter(c => c.id !== selectedConversation.id));
      setSelectedConversation(null);
      setShowMobileChat(false);
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
    setMenuAnchorEl(null);
  };

  // Delete conversation by ID (for swipe action)
  const handleDeleteConversationById = async (conversationId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/chat/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (selectedConversation?.id === conversationId) {
        setSelectedConversation(null);
        setShowMobileChat(false);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
    setSwipedConversationId(null);
  };

  // Mark conversation as read (swipe right action)
  const handleMarkAsRead = async (conversationId) => {
    try {
      await markConversationRead(conversationId);
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
    setSwipedConversationId(null);
  };

  // Check for active escrow and pending milestones when conversation changes
  useEffect(() => {
    const checkActiveEscrow = async () => {
      if (!selectedConversation?.participantId) {
        setActiveEscrow(null);
        setPendingMilestones([]);
        return;
      }
      try {
        const token = localStorage.getItem('token');
        
        // Check escrow
        const escrowResponse = await fetch(`${API_BASE_URL}/escrow/list`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (escrowResponse.ok) {
          const data = await escrowResponse.json();
          // Find escrow with this participant
          const escrow = (data.escrows || []).find(e => 
            (e.provider_id === selectedConversation.participantId || 
             e.client_id === selectedConversation.participantId) &&
            e.status === 'held'
          );
          setActiveEscrow(escrow || null);
          
          // Check if current user is the provider in any escrow
          const isUserProvider = (data.escrows || []).some(e => e.provider_id === user?.id);
          setIsProvider(isUserProvider);
        }
        
        // Check pending milestone requests
        const milestoneResponse = await fetch(`${API_BASE_URL}/milestone/pending/${selectedConversation.participantId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (milestoneResponse.ok) {
          const milestoneData = await milestoneResponse.json();
          setPendingMilestones(milestoneData.requests || []);
        }
      } catch (error) {
        console.error('Failed to check escrow/milestones:', error);
      }
    };
    checkActiveEscrow();
  }, [selectedConversation, user?.id]);

  // Handle escrow payment success
  const handlePaymentSuccess = (escrowData) => {
    setActiveEscrow(escrowData);
    setPaymentSheetOpen(false);
    // Update conversation to show escrow active
    if (selectedConversation) {
      setConversations(prev => prev.map(c => 
        c.id === selectedConversation.id 
          ? { ...c, hasActiveEscrow: true, escrowAmount: escrowData.amount }
          : c
      ));
      setSelectedConversation(prev => prev ? { ...prev, hasActiveEscrow: true, escrowAmount: escrowData.amount } : prev);
    }
  };

  // Release payment (confirm service completed)
  const handleReleasePayment = async () => {
    if (!activeEscrow) return;
    setEscrowLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/escrow/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ escrowId: activeEscrow.id })
      });
      if (response.ok) {
        setActiveEscrow(null);
        // Update conversation
        if (selectedConversation) {
          setConversations(prev => prev.map(c => 
            c.id === selectedConversation.id 
              ? { ...c, hasActiveEscrow: false, escrowAmount: null }
              : c
          ));
          setSelectedConversation(prev => prev ? { ...prev, hasActiveEscrow: false, escrowAmount: null } : prev);
        }
        toast.success('Payment released! The provider has received the funds.');
      } else {
        toast.error('Failed to release payment. Please try again.');
      }
    } catch (error) {
      console.error('Failed to release payment:', error);
      toast.error('Error releasing payment.');
    } finally {
      setEscrowLoading(false);
    }
  };

  // Report a problem with the escrow
  const handleReportProblem = async () => {
    if (!activeEscrow) return;
    const reason = prompt('What went wrong? Briefly describe the issue:');
    if (!reason) return;
    
    setEscrowLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/escrow/dispute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ escrowId: activeEscrow.id, reason })
      });
      if (response.ok) {
        setActiveEscrow(prev => prev ? { ...prev, status: 'disputed' } : null);
        toast.info('Issue reported. Our support team will review and contact you soon.');
      } else {
        toast.error('Failed to report issue. Please try again.');
      }
    } catch (error) {
      console.error('Failed to report problem:', error);
      toast.error('Error reporting issue.');
    } finally {
      setEscrowLoading(false);
    }
  };

  // Handle milestone request success
  const handleMilestoneRequestSuccess = (data) => {
    setPendingMilestones(prev => [...prev, data.request]);
    setMilestoneDialogOpen(false);
    toast.success('Payment request sent!');
  };

  // Accept milestone request
  const handleAcceptMilestone = async (requestId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/milestone/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requestId, action: 'accept' })
      });
      if (response.ok) {
        setPendingMilestones(prev => prev.map(m => 
          m.id === requestId ? { ...m, status: 'accepted' } : m
        ));
      }
    } catch (error) {
      console.error('Failed to accept milestone:', error);
      toast.error('Failed to accept request');
    }
  };

  // Decline milestone request
  const handleDeclineMilestone = async (requestId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/milestone/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requestId, action: 'decline' })
      });
      if (response.ok) {
        setPendingMilestones(prev => prev.filter(m => m.id !== requestId));
      }
    } catch (error) {
      console.error('Failed to decline milestone:', error);
      toast.error('Failed to decline request');
    }
  };

  // Pay for accepted milestone
  const handlePayMilestone = async (request) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/milestone/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requestId: request.id })
      });
      if (response.ok) {
        const data = await response.json();
        setActiveEscrow(data.escrow);
        setPendingMilestones(prev => prev.filter(m => m.id !== request.id));
        toast.success('Payment held successfully!');
      }
    } catch (error) {
      console.error('Failed to pay milestone:', error);
      toast.error('Payment failed. Try again.');
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.participantName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const markConversationRead = async (conversationId) => {
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/chat/read/${conversationId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Failed to mark conversation read:', error);
    }
  };

  const selectConversation = (conv) => {
    if (!conv) return;
    const decrementBy = Number(conv.unreadCount || 0);
    const mergedConv = {
      ...conv,
      participantName: conv.participantName || (conv.participantId === targetRecipientId ? targetRecipientName : conv.participantName),
      participantAvatar: conv.participantAvatar || (conv.participantId === targetRecipientId ? targetRecipientAvatar : conv.participantAvatar)
    };
    setSelectedConversation(mergedConv);
    setShowMobileChat(true);
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
    markConversationRead(conv.id);

    // Keep global unread badge in sync when a thread is opened.
    if (decrementBy > 0) {
      dispatch(decrementUnreadMessages(decrementBy));
    }
  };

  const handleBackToList = () => {
    setShowMobileChat(false);
    setSelectedConversation(null);
  };

  if (!user) return null;

  return (
    <Box sx={styles.container}>
      {/* Chat Area - center; full width on mobile when open */}
      <Box sx={{ ...styles.chatArea, display: { xs: showMobileChat ? 'flex' : 'none', md: 'flex' } }}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <Box sx={styles.chatHeader}>
              <IconButton 
                sx={{ ...styles.backBtn, display: { xs: 'flex', md: 'none' } }}
                onClick={handleBackToList}
              >
                <BackIcon />
              </IconButton>
              <Box 
                sx={{ ...styles.chatHeaderInfo, cursor: 'pointer' }}
                onClick={handleViewProfile}
                title="View Profile"
              >
                <Avatar src={selectedConversation.participantAvatar} sx={styles.chatAvatar}>
                  {selectedConversation.participantName?.[0]}
                </Avatar>
                <Box>
                  <Typography sx={styles.chatUserName}>
                    {selectedConversation.participantName}
                  </Typography>
                  <Typography sx={styles.chatUserStatus}>
                    {remoteTyping ? 'Typing…' : selectedConversation.participantOnline ? 'Online' : 'Offline'}
                  </Typography>
                </Box>
              </Box>
              <Box sx={styles.chatHeaderActions}>
                <IconButton 
                  sx={{ ...styles.headerActionBtn, display: { xs: 'none', sm: 'inline-flex' } }}
                  onClick={handleVoiceCall}
                  title="Voice Call"
                  aria-label="Start voice call"
                >
                  <PhoneIcon />
                </IconButton>
                <IconButton 
                  sx={{ ...styles.headerActionBtn, display: { xs: 'none', sm: 'inline-flex' } }}
                  onClick={handleVideoCall}
                  title="Video Call"
                  aria-label="Start video call"
                >
                  <VideoIcon />
                </IconButton>
                <IconButton 
                  sx={styles.headerActionBtn}
                  onClick={handleMenuOpen}
                  title="More Options"
                  aria-label="Open conversation options menu"
                >
                  <MoreIcon />
                </IconButton>
              </Box>
              
              {/* More Options Menu */}
              <Menu
                anchorEl={menuAnchorEl}
                open={menuOpen}
                onClose={handleMenuClose}
                PaperProps={{
                  sx: {
                    bgcolor: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    '& .MuiMenuItem-root': {
                      color: '#fff',
                      gap: 1.5,
                      minHeight: 48,
                      '&:hover': { bgcolor: 'rgba(0,242,234,0.1)' }
                    }
                  }
                }}
              >
                {/* Mobile-only: Voice and Video Call options */}
                <MenuItem 
                  onClick={() => { handleMenuClose(); handleVoiceCall(); }}
                  sx={{ display: { xs: 'flex', sm: 'none' } }}
                >
                  <PhoneIcon fontSize="small" sx={{ color: '#00f2ea' }} /> Voice Call
                </MenuItem>
                <MenuItem 
                  onClick={() => { handleMenuClose(); handleVideoCall(); }}
                  sx={{ display: { xs: 'flex', sm: 'none' } }}
                >
                  <VideoIcon fontSize="small" sx={{ color: '#00f2ea' }} /> Video Call
                </MenuItem>
                <MenuItem onClick={handleViewProfile}>
                  <PersonIcon fontSize="small" /> View Profile
                </MenuItem>
                <MenuItem onClick={handleBlockUser} sx={{ color: '#ff6b6b !important' }}>
                  <BlockIcon fontSize="small" /> Block User
                </MenuItem>
                <MenuItem onClick={handleReportUser} sx={{ color: '#ffa726 !important' }}>
                  <ReportIcon fontSize="small" /> Report
                </MenuItem>
                <MenuItem onClick={handleDeleteConversation} sx={{ color: '#ff6b6b !important' }}>
                  <DeleteIcon fontSize="small" /> Delete Chat
                </MenuItem>
              </Menu>
            </Box>

            {/* Escrow Bar - Shows when money is held */}
            {activeEscrow && (
              <Box sx={styles.escrowBar}>
                <LockIcon sx={{ fontSize: 18 }} />
                <Typography sx={{ fontWeight: 500 }}>
                  Money Held: ₦{Number(activeEscrow.amount).toLocaleString()}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
                  <Chip
                    icon={<CheckCircleIcon />}
                    label="Release"
                    onClick={handleReleasePayment}
                    disabled={escrowLoading}
                    sx={{
                      bgcolor: 'rgba(0, 255, 136, 0.2)',
                      color: '#00ff88',
                      fontWeight: 600,
                      '&:hover': { bgcolor: 'rgba(0, 255, 136, 0.3)' }
                    }}
                  />
                  <Chip
                    icon={<WarningIcon />}
                    label="Problem"
                    onClick={handleReportProblem}
                    disabled={escrowLoading}
                    sx={{
                      bgcolor: 'rgba(255, 167, 38, 0.2)',
                      color: '#ffa726',
                      fontWeight: 600,
                      '&:hover': { bgcolor: 'rgba(255, 167, 38, 0.3)' }
                    }}
                  />
                </Box>
              </Box>
            )}

            {/* Messages */}
            <Box 
              ref={messagesContainerRef}
              sx={styles.messagesContainer}
              role="log"
              aria-live="polite"
              aria-label="Chat messages"
              onScroll={handleMessagesScroll}
            >
              {messages.map((message, index) => (
                <motion.div
                  key={message.id || index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Box
                    sx={{
                      ...styles.messageRow,
                      justifyContent: message.senderId === user.id ? 'flex-end' : 'flex-start'
                    }}
                  >
                    <Box
                      sx={{
                        ...styles.messageBubble,
                        ...(message.senderId === user.id ? styles.sentBubble : styles.receivedBubble),
                        cursor: 'pointer',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                        WebkitTouchCallout: 'none'
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setSelectedMessage(message);
                        setMessageMenuAnchor({ mouseX: e.clientX, mouseY: e.clientY });
                      }}
                      onTouchStart={() => {
                        longPressTimer.current = setTimeout(() => {
                          setSelectedMessage(message);
                          setMessageMenuAnchor({ mouseX: null, mouseY: null });
                        }, 500);
                      }}
                      onTouchEnd={() => {
                        if (longPressTimer.current) {
                          clearTimeout(longPressTimer.current);
                        }
                      }}
                      onTouchMove={() => {
                        if (longPressTimer.current) {
                          clearTimeout(longPressTimer.current);
                        }
                      }}
                    >
                      <Typography sx={styles.messageText}>{message.content}</Typography>
                      <Box sx={styles.messageFooter}>
                        <Typography sx={styles.messageTime}>
                          {formatTime(message.createdAt)}
                        </Typography>
                        {message.senderId === user.id && (
                          message.status === 'sending' ? (
                            <CheckIcon sx={{ fontSize: 14, opacity: 0.5 }} />
                          ) : (
                            <DoneAllIcon sx={{ fontSize: 14, color: '#00f2ea' }} />
                          )
                        )}
                      </Box>
                    </Box>
                  </Box>
                </motion.div>
              ))}
              <div ref={messagesEndRef} />
              
              {/* Scroll to bottom FAB */}
              {showScrollButton && (
                <Fab
                  size="small"
                  aria-label="Scroll to latest messages"
                  onClick={scrollToBottom}
                  sx={{
                    position: 'absolute',
                    bottom: 90,
                    right: 16,
                    background: 'rgba(0, 242, 234, 0.95)',
                    color: '#000',
                    width: 44,
                    height: 44,
                    boxShadow: '0 4px 12px rgba(0,242,234,0.4)',
                    '&:hover': {
                      background: '#00f2ea'
                    }
                  }}
                >
                  <KeyboardArrowDownIcon />
                </Fab>
              )}
            </Box>

            {/* Pending Milestone Requests */}
            {pendingMilestones.length > 0 && (
              <Box sx={styles.milestoneRequestsArea}>
                {pendingMilestones.map((request) => (
                  <MilestoneRequestCard
                    key={request.id}
                    request={request}
                    currentUserId={user?.id}
                    onAccept={handleAcceptMilestone}
                    onDecline={handleDeclineMilestone}
                    onPay={handlePayMilestone}
                  />
                ))}
              </Box>
            )}

            {/* Input Area */}
            {selectedConversation && (
              <Box sx={styles.inputArea}>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept="image/*,video/*"
                  onChange={handleFilePreview}
                />
                
                {/* More Actions Button (shows drawer with payment options on mobile) */}
                <IconButton 
                  sx={{
                    ...styles.inputActionBtn,
                    display: { xs: 'flex', sm: 'none' }
                  }}
                  onClick={() => setMoreActionsOpen(true)}
                  aria-label="More actions"
                >
                  <AddIcon />
                </IconButton>
                
                {/* Desktop: Show payment buttons inline */}
                {/* Request Payment button - for sending milestone requests */}
                {!activeEscrow && pendingMilestones.length === 0 && (
                  <IconButton 
                    sx={{
                      ...styles.requestBtn,
                      background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
                      color: '#000',
                      display: { xs: 'none', sm: 'flex' }
                    }} 
                    onClick={() => setMilestoneDialogOpen(true)}
                    title={isProvider ? "Request Payment" : "Request Hold"}
                    aria-label={isProvider ? "Request payment from client" : "Request escrow hold"}
                  >
                    <RequestIcon />
                  </IconButton>
                )}
                {/* Pay Now button - only show if no active escrow */}
                {!activeEscrow && (
                  <IconButton 
                    sx={{
                      ...styles.payNowBtn,
                      background: 'linear-gradient(135deg, #00ff88, #00cc6a)',
                      color: '#000',
                      display: { xs: 'none', sm: 'flex' }
                    }} 
                    onClick={() => setPaymentSheetOpen(true)}
                    title="Hold Money"
                    aria-label="Open payment to hold money in escrow"
                  >
                    <WalletIcon />
                  </IconButton>
                )}
                {/* Attachment button - always visible */}
                <IconButton 
                  sx={{
                    ...styles.inputActionBtn,
                    display: { xs: 'none', sm: 'flex' }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file"
                  aria-label="Attach photo or video file"
                >
                  <AttachIcon />
                </IconButton>
                <TextField
                  fullWidth
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={handleTyping}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  sx={styles.messageInput}
                  multiline
                  maxRows={4}
                  inputProps={{
                    'aria-label': 'Type a message'
                  }}
                />
                <IconButton
                  sx={{
                    ...styles.inputActionBtn,
                    display: { xs: 'none', sm: 'flex' }
                  }}
                  title="Emoji"
                  aria-label="Open emoji picker"
                  onClick={(e) => setEmojiAnchorEl(e.currentTarget)}
                >
                  <EmojiIcon />
                </IconButton>
                <Menu
                  anchorEl={emojiAnchorEl}
                  open={emojiMenuOpen}
                  onClose={() => setEmojiAnchorEl(null)}
                  PaperProps={{
                    sx: {
                      bgcolor: 'rgba(20, 20, 30, 0.98)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: '14px',
                      backdropFilter: 'blur(18px)',
                      '& .MuiMenuItem-root': {
                        color: '#fff',
                        fontSize: 20,
                        minHeight: 44,
                        borderRadius: '10px',
                        '&:hover': { bgcolor: 'rgba(0,242,234,0.10)' }
                      }
                    }
                  }}
                >
                  {['😀', '😂', '😍', '😘', '🔥', '👍', '🙏', '💯'].map((emo) => (
                    <MenuItem
                      key={emo}
                      onClick={() => {
                        setNewMessage((prev) => `${prev || ''}${emo}`);
                        setEmojiAnchorEl(null);
                      }}
                    >
                      {emo}
                    </MenuItem>
                  ))}
                </Menu>
                {/* Always show Send button, disabled when empty */}
                <IconButton 
                  sx={{
                    ...styles.sendBtn,
                    opacity: newMessage.trim() ? 1 : 0.5,
                    cursor: newMessage.trim() ? 'pointer' : 'default'
                  }} 
                  onClick={sendMessage}
                  disabled={!newMessage.trim()}
                  title="Send message"
                  aria-label="Send message"
                >
                  <SendIcon />
                </IconButton>
              </Box>
            )}
          </>
        ) : (
          <Box sx={styles.noChatSelected}>
            <Box sx={styles.noChatIcon}>💬</Box>
            <Typography sx={styles.noChatTitle}>Select a conversation</Typography>
            <Typography sx={styles.noChatSubtitle}>
              Choose from your existing conversations or start a new one
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/profiles')}
              sx={styles.primaryCta}
            >
              Find people to chat
            </Button>
          </Box>
        )}
      </Box>

      {/* Conversations List - TikTok Inbox Style */}
      <Box sx={{ ...styles.conversationsList, display: showMobileChat ? { xs: 'none', md: 'flex' } : 'flex' }}>
        {/* TikTok-style header */}
        <Box sx={styles.listHeader}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AddIcon sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 24 }} />
          </Box>
          <Typography sx={styles.listTitle}>Inbox</Typography>
          <IconButton 
            onClick={() => {/* Could open search overlay */}}
            sx={{ color: '#fff', p: 0.5 }}
          >
            <SearchIcon sx={{ fontSize: 24 }} />
          </IconButton>
        </Box>

        {/* Search - Hidden by default, TikTok uses overlay */}
        <Box sx={{ ...styles.searchContainer, display: searchQuery ? 'block' : 'none' }}>
          <TextField
            fullWidth
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={styles.searchInput}
            inputProps={{
              'aria-label': 'Search conversations'
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'rgba(255,255,255,0.4)' }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    sx={{ 
                      color: 'rgba(255,255,255,0.5)',
                      minWidth: 44,
                      minHeight: 44,
                      '&:hover': { color: '#fff' }
                    }}
                  >
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        </Box>

        {/* Conversations */}
        <Box 
          sx={styles.conversationsScroll}
          role="list"
          aria-label="Conversations"
        >
          {loading ? (
            <Box sx={styles.loadingContainer}>
              <CircularProgress size={32} sx={{ color: '#00f2ea' }} />
            </Box>
          ) : filteredConversations.length === 0 && searchQuery ? (
            <Box sx={styles.emptyState}>
              <SearchOffIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.3)', mb: 1 }} />
              <Typography sx={styles.emptyText}>No results found</Typography>
              <Typography sx={styles.emptySubtext}>
                Try a different search term or clear your search.
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setSearchQuery('')}
                sx={{ 
                  mt: 2, 
                  borderColor: 'rgba(0,242,234,0.4)', 
                  color: '#00f2ea',
                  minHeight: 44,
                  '&:hover': { borderColor: '#00f2ea', background: 'rgba(0,242,234,0.08)' }
                }}
              >
                Clear Search
              </Button>
            </Box>
          ) : filteredConversations.length === 0 ? (
            <Box sx={styles.emptyState}>
              <Typography sx={styles.emptyText}>No conversations yet</Typography>
              <Typography sx={styles.emptySubtext}>Start by browsing profiles and sending a message.</Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/profiles')}
                sx={styles.primaryCta}
              >
                Explore Profiles
              </Button>
            </Box>
          ) : (
            <AnimatePresence>
              {filteredConversations.map((conv, index) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.2 }}
                >
                  <SwipeableConversationItem
                    conversationId={conv.id}
                    swipedId={swipedConversationId}
                    setSwipedId={setSwipedConversationId}
                    hasUnread={conv.unreadCount > 0}
                    onSwipeLeft={() => handleDeleteConversationById(conv.id)}
                    onSwipeRight={() => handleMarkAsRead(conv.id)}
                  >
                    <Box
                      role="listitem"
                      tabIndex={0}
                      aria-label={`Conversation with ${conv.participantName}${conv.unreadCount > 0 ? `, ${conv.unreadCount} unread messages` : ''}`}
                      sx={{
                        ...styles.conversationItem,
                        background: selectedConversation?.id === conv.id ? 'rgba(0, 242, 234, 0.18)' : 'transparent'
                      }}
                      onClick={() => {
                        if (swipedConversationId === conv.id) {
                          setSwipedConversationId(null);
                        } else {
                          selectConversation(conv);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectConversation(conv);
                        }
                      }}
                    >
                      <Badge
                        overlap="circular"
                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                        badgeContent={
                          conv.participantOnline && (
                            <Box sx={styles.onlineBadge} />
                          )
                        }
                      >
                        <Avatar src={conv.participantAvatar} sx={styles.avatar}>
                          {conv.participantName?.[0]}
                        </Avatar>
                      </Badge>
                      <Box sx={styles.conversationInfo}>
                        <Box sx={styles.conversationHeader}>
                          <Typography sx={styles.conversationName}>
                            {conv.participantName}
                            {conv.participantVerified && (
                              <Box component="span" sx={styles.verifiedIcon}>✓</Box>
                            )}
                          </Typography>
                          <Typography sx={styles.conversationTime}>
                            {formatTimeAgo(conv.lastMessageTime)}
                          </Typography>
                        </Box>
                        {typingConversations.includes(conv.id) ? (
                          <Box sx={styles.typingIndicator}>
                            <Box sx={styles.typingDot} />
                            <Box sx={styles.typingDot} />
                            <Box sx={styles.typingDot} />
                          </Box>
                        ) : (
                          <Typography sx={styles.conversationPreview} noWrap>
                            {conv.lastMessage || 'Start a conversation'}
                          </Typography>
                        )}
                      </Box>
                      {conv.unreadCount > 0 && (
                        <Box sx={styles.unreadBadge}>{conv.unreadCount}</Box>
                      )}
                      {conv.hasActiveEscrow && (
                        <Box sx={styles.escrowIndicator}>
                          <LockIcon sx={{ fontSize: 14 }} />
                        </Box>
                      )}
                    </Box>
                  </SwipeableConversationItem>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </Box>
      </Box>
      
      {/* Call Dialog */}
      <Dialog 
        open={callDialogOpen} 
        onClose={handleEndCall}
        PaperProps={{
          sx: {
            bgcolor: '#1a1a2e',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px',
            minWidth: 300
          }
        }}
      >
        <DialogTitle sx={{ color: '#fff', textAlign: 'center' }}>
          {callType === 'video' ? '📹 Video Call' : '📞 Voice Call'}
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', py: 3 }}>
          <Avatar 
            src={selectedConversation?.participantAvatar}
            sx={{ 
              width: 80, 
              height: 80, 
              margin: '0 auto 16px',
              border: '3px solid #00f2ea'
            }}
          >
            {selectedConversation?.participantName?.[0]}
          </Avatar>
          <Typography sx={{ color: '#fff', fontSize: '18px', fontWeight: 600 }}>
            {selectedConversation?.participantName}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.5)', mt: 1 }}>
            {isCallActive ? 'Call in progress...' : 'Calling...'}
          </Typography>
          {!isCallActive && (
            <CircularProgress 
              sx={{ color: '#00f2ea', mt: 2 }} 
              size={30}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', pb: 3 }}>
          <Button 
            onClick={handleEndCall}
            variant="contained"
            sx={{
              bgcolor: '#ff4444',
              color: '#fff',
              borderRadius: '12px',
              px: 4,
              '&:hover': { bgcolor: '#cc3333' }
            }}
          >
            {isCallActive ? 'End Call' : 'Cancel'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Payment Sheet - Bottom drawer for holding money */}
      <PaymentSheet
        open={paymentSheetOpen}
        onClose={() => setPaymentSheetOpen(false)}
        providerId={selectedConversation?.participantId}
        providerName={selectedConversation?.participantName}
        onSuccess={handlePaymentSuccess}
      />

      {/* Milestone Request Dialog */}
      <MilestoneRequestDialog
        open={milestoneDialogOpen}
        onClose={() => setMilestoneDialogOpen(false)}
        recipientId={selectedConversation?.participantId}
        recipientName={selectedConversation?.participantName}
        isProvider={isProvider}
        onSuccess={handleMilestoneRequestSuccess}
      />

      {/* Mobile Actions Drawer */}
      <Drawer
        anchor="bottom"
        open={moreActionsOpen}
        onClose={() => setMoreActionsOpen(false)}
        PaperProps={{
          sx: {
            background: 'rgba(20, 20, 30, 0.98)',
            borderTopLeftRadius: '20px',
            borderTopRightRadius: '20px',
            backdropFilter: 'blur(20px)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            maxHeight: '60vh'
          }
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ 
            width: 40, 
            height: 4, 
            background: 'rgba(255,255,255,0.3)', 
            borderRadius: 2, 
            mx: 'auto', 
            mb: 2 
          }} />
          <Typography sx={{ color: '#fff', fontWeight: 600, mb: 2, textAlign: 'center' }}>
            Actions
          </Typography>
          
          {!activeEscrow && pendingMilestones.length === 0 && (
            <MenuItem 
              onClick={() => {
                setMoreActionsOpen(false);
                setMilestoneDialogOpen(true);
              }}
              sx={{ 
                color: '#fff', 
                borderRadius: '12px', 
                minHeight: 56,
                gap: 2,
                '&:hover': { background: 'rgba(255,215,0,0.1)' }
              }}
            >
              <RequestIcon sx={{ color: '#ffd700' }} />
              <Typography>{isProvider ? 'Request Payment' : 'Request Hold'}</Typography>
            </MenuItem>
          )}
          
          {!activeEscrow && (
            <MenuItem 
              onClick={() => {
                setMoreActionsOpen(false);
                setPaymentSheetOpen(true);
              }}
              sx={{ 
                color: '#fff', 
                borderRadius: '12px', 
                minHeight: 56,
                gap: 2,
                '&:hover': { background: 'rgba(0,255,136,0.1)' }
              }}
            >
              <WalletIcon sx={{ color: '#00ff88' }} />
              <Typography>Hold Money</Typography>
            </MenuItem>
          )}
          
          <MenuItem 
            onClick={() => {
              setMoreActionsOpen(false);
              fileInputRef.current?.click();
            }}
            sx={{ 
              color: '#fff', 
              borderRadius: '12px', 
              minHeight: 56,
              gap: 2,
              '&:hover': { background: 'rgba(0,242,234,0.1)' }
            }}
          >
            <AttachIcon sx={{ color: '#00f2ea' }} />
            <Typography>Attach Photo/Video</Typography>
          </MenuItem>
          
          <MenuItem 
            onClick={(e) => {
              setMoreActionsOpen(false);
              setEmojiAnchorEl(e.currentTarget);
            }}
            sx={{ 
              color: '#fff', 
              borderRadius: '12px', 
              minHeight: 56,
              gap: 2,
              '&:hover': { background: 'rgba(255,255,255,0.05)' }
            }}
          >
            <EmojiIcon sx={{ color: 'rgba(255,255,255,0.8)' }} />
            <Typography>Emoji</Typography>
          </MenuItem>
        </Box>
      </Drawer>

      {/* Message Long-Press Context Menu */}
      <Menu
        open={Boolean(messageMenuAnchor)}
        onClose={() => {
          setMessageMenuAnchor(null);
          setSelectedMessage(null);
        }}
        anchorReference={messageMenuAnchor?.mouseX ? "anchorPosition" : "none"}
        anchorPosition={
          messageMenuAnchor?.mouseX
            ? { top: messageMenuAnchor.mouseY, left: messageMenuAnchor.mouseX }
            : undefined
        }
        sx={{
          // Center menu when no anchor position (mobile long-press)
          ...(!messageMenuAnchor?.mouseX && {
            '& .MuiPaper-root': {
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)'
            }
          })
        }}
        PaperProps={{
          sx: {
            bgcolor: 'rgba(20, 20, 30, 0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '14px',
            backdropFilter: 'blur(18px)',
            minWidth: 180,
            '& .MuiMenuItem-root': {
              color: '#fff',
              gap: 1.5,
              minHeight: 48,
              '&:hover': { bgcolor: 'rgba(0,242,234,0.1)' }
            }
          }
        }}
      >
        <MenuItem onClick={() => {
          if (selectedMessage?.content) {
            navigator.clipboard.writeText(selectedMessage.content);
          }
          setMessageMenuAnchor(null);
          setSelectedMessage(null);
        }}>
          <CopyIcon fontSize="small" sx={{ color: '#00f2ea' }} /> Copy
        </MenuItem>
        {selectedMessage?.senderId === user?.id && (
          <MenuItem 
            onClick={async () => {
              if (!selectedMessage) return;
              try {
                const token = localStorage.getItem('token');
                await fetch(`${API_BASE_URL}/chat/messages/${selectedMessage.id}`, {
                  method: 'DELETE',
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
              } catch (error) {
                console.error('Failed to delete message:', error);
              }
              setMessageMenuAnchor(null);
              setSelectedMessage(null);
            }}
            sx={{ color: '#ff6b6b !important' }}
          >
            <DeleteIcon fontSize="small" /> Delete
          </MenuItem>
        )}
      </Menu>

      {/* Attachment Preview Modal */}
      {attachmentPreview && (
        <Box sx={{
          position: 'fixed',
          bottom: 80,
          left: 0,
          right: 0,
          mx: 2,
          p: 2,
          background: 'rgba(20, 20, 30, 0.98)',
          borderRadius: '16px',
          border: '1px solid rgba(0,242,234,0.3)',
          backdropFilter: 'blur(20px)',
          zIndex: 1300,
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <Box sx={{ 
            width: 60, 
            height: 60, 
            borderRadius: '10px', 
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {pendingFile?.type?.startsWith('image/') ? (
              <img 
                src={attachmentPreview} 
                alt="Preview" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
            ) : (
              <Box sx={{ 
                width: '100%', 
                height: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                background: 'rgba(0,242,234,0.1)'
              }}>
                <AttachIcon sx={{ color: '#00f2ea' }} />
              </Box>
            )}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ color: '#fff', fontWeight: 500, fontSize: '14px' }} noWrap>
              {pendingFile?.name || 'File'}
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>
              {pendingFile?.size ? `${(pendingFile.size / 1024).toFixed(1)} KB` : ''}
            </Typography>
          </Box>
          <IconButton 
            onClick={() => {
              setAttachmentPreview(null);
              setPendingFile(null);
            }}
            sx={{ color: 'rgba(255,255,255,0.7)' }}
          >
            <CloseIcon />
          </IconButton>
          <IconButton 
            onClick={async () => {
              if (pendingFile) {
                // Create a synthetic event for handleFileSelect
                const syntheticEvent = { target: { files: [pendingFile], value: '' } };
                await handleFileSelect(syntheticEvent);
              }
              setAttachmentPreview(null);
              setPendingFile(null);
            }}
            sx={{ 
              background: 'linear-gradient(135deg, #00f2ea, #00c2bb)',
              color: '#000',
              '&:hover': { background: '#00f2ea' }
            }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      )}
    </Box>
  );
};

const styles = {
  container: {
    display: 'flex',
    flex: 1,
    height: '100%',
    minHeight: 0,
    background: 'var(--bg-primary, #0f0f13)',
    overflow: 'hidden'
  },
  conversationsList: {
    width: { xs: '100%', md: '30vw' },
    minWidth: { md: 260 },
    maxWidth: { md: 340 },
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-secondary, #1a1a22)',
    order: 2,
    minHeight: 0
  },
  listHeader: {
    padding: { xs: '10px 12px', sm: '16px 16px' },
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#0f0f13',
    // No border - cleaner TikTok look
  },
  listTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },
  connectionStatus: {
    display: 'none', // Hidden - TikTok doesn't show this
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: '50%'
  },
  statusText: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)'
  },
  searchContainer: {
    padding: { xs: '8px 10px', sm: '12px 16px' }
  },
  searchInput: {
    '& .MuiOutlinedInput-root': {
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '14px',
      '& fieldset': { border: 'none' },
      '& input': { color: '#fff', padding: '12px 14px' }
    }
  },
  conversationsScroll: {
    flex: 1,
    overflow: 'auto',
    padding: '8px 10px',
    minHeight: 0
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '40px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12
  },
  emptyText: {
    color: 'rgba(255,255,255,0.7)',
    fontWeight: 700
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: '14px',
    maxWidth: 320
  },
  conversationItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: { xs: '10px 12px', sm: '16px 14px' },
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    marginBottom: '4px',
    minHeight: { xs: '64px', sm: '84px' },
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    '&:hover': {
      background: 'rgba(255,255,255,0.05)'
    },
    '&:active': {
      transform: 'scale(0.98)',
      background: 'rgba(0, 242, 234, 0.15)'
    },
    '&:focus-visible': {
      outline: '2px solid #00f2ea',
      outlineOffset: '2px'
    }
  },
  avatar: {
    width: { xs: 44, sm: 56 },
    height: { xs: 44, sm: 56 }
  },
  onlineBadge: {
    width: 14,
    height: 14,
    background: '#00ff88',
    border: '2px solid var(--bg-secondary, #1a1a22)',
    borderRadius: '50%'
  },
  conversationInfo: {
    flex: 1,
    minWidth: 0
  },
  conversationHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px'
  },
  conversationName: {
    fontWeight: 600,
    fontSize: '15px',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  verifiedIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#00f2ea',
    color: '#000',
    fontSize: '10px',
    fontWeight: 700
  },
  conversationTime: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.90)',
    marginLeft: 'auto',
    textAlign: 'right',
    fontWeight: 500
  },
  conversationPreview: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.85)'
  },
  typingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    height: '20px'
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.7)',
    animation: `${typingBlink} 1s ease-in-out infinite`,
    '&:nth-of-type(2)': { animationDelay: '0.15s' },
    '&:nth-of-type(3)': { animationDelay: '0.3s' }
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    padding: '0 7px',
    background: 'linear-gradient(135deg, #ff1744, #d50000)',
    borderRadius: 11,
    fontSize: '12px',
    fontWeight: 700,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(255,23,68,0.4)'
  },
  escrowIndicator: {
    color: '#00ff88',
    marginLeft: '8px'
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary, #0f0f13)',
    minHeight: 0
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 14px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(15, 15, 19, 0.9)',
    backdropFilter: 'blur(20px)'
  },
  backBtn: {
    color: '#fff',
    marginRight: '8px'
  },
  chatHeaderInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1
  },
  chatAvatar: {
    width: 44,
    height: 44
  },
  chatUserName: {
    fontWeight: 600,
    fontSize: '16px',
    color: '#fff'
  },
  chatUserStatus: {
    fontSize: '12px',
    color: '#00ff88',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: { xs: '120px', sm: '150px' }
  },
  chatHeaderActions: {
    display: 'flex',
    gap: '4px'
  },
  headerActionBtn: {
    color: '#fff',
    minWidth: '44px',
    minHeight: '44px',
    '&:hover': {
      background: 'rgba(255,255,255,0.1)'
    },
    '&:focus-visible': {
      outline: '2px solid #00f2ea',
      outlineOffset: '2px'
    }
  },
  escrowBar: {
    display: 'flex',
    alignItems: { xs: 'flex-start', sm: 'center' },
    flexDirection: { xs: 'column', sm: 'row' },
    gap: { xs: '10px', sm: '8px' },
    padding: { xs: '12px 16px', sm: '10px 16px' },
    background: 'rgba(0, 255, 136, 0.1)',
    borderBottom: '1px solid rgba(0, 255, 136, 0.15)',
    color: '#00ff88',
    fontSize: '13px'
  },
  escrowAmount: {
    fontWeight: 700
  },
  escrowBtn: {
    padding: '4px 10px',
    background: 'rgba(0, 255, 136, 0.2)',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer'
  },
  messagesContainer: {
    flex: 1,
    overflow: 'auto',
    padding: { xs: '8px 10px', sm: '20px 24px' },
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    minHeight: 0,
    position: 'relative'
  },
  messageRow: {
    display: 'flex'
  },
  messageBubble: {
    maxWidth: { xs: '75%', sm: '70%', md: '65%' },
    padding: { xs: '10px 14px', sm: '12px 16px' },
    borderRadius: { xs: '16px', sm: '18px' },
    wordBreak: 'break-word'
  },
  sentBubble: {
    background: 'linear-gradient(135deg, #00f2ea, #00c2bb)',
    color: '#000',
    borderBottomRightRadius: '6px'
  },
  receivedBubble: {
    background: 'rgba(255,255,255,0.08)',
    color: '#fff',
    borderBottomLeftRadius: '6px'
  },
  messageText: {
    fontSize: { xs: '16px', sm: '16px' },
    lineHeight: 1.5
  },
  imageAttachment: {
    maxWidth: 280,
    borderRadius: '12px',
    display: 'block'
  },
  videoAttachment: {
    maxWidth: 280,
    borderRadius: '12px'
  },
  messageFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '4px',
    marginTop: '4px'
  },
  messageTime: {
    fontSize: '12px',
    opacity: 0.85
  },
  inputArea: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: { xs: '4px', sm: '8px' },
    padding: { xs: '4px 6px', sm: '10px 14px' },
    paddingBottom: { xs: '4px', sm: '10px' },
    borderTop: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(20, 20, 30, 0.98)',
    backdropFilter: 'blur(24px)',
    boxShadow: '0 -2px 12px rgba(0,0,0,0.25)',
    flexShrink: 0,
    minHeight: { xs: 44, sm: 56 }
  },
  inputActionBtn: {
    width: { xs: 40, sm: 48 },
    height: { xs: 40, sm: 48 },
    minWidth: { xs: 40, sm: 48 },
    minHeight: { xs: 40, sm: 48 },
    color: 'rgba(255,255,255,0.75)',
    flexShrink: 0,
    '&:hover': {
      color: '#fff',
      background: 'rgba(255,255,255,0.08)'
    },
    '&:focus-visible': {
      outline: '2px solid #00f2ea',
      outlineOffset: '2px'
    }
  },
  messageInput: {
    flex: 1,
    minWidth: 0,
    '& .MuiOutlinedInput-root': {
      background: 'rgba(255,255,255,0.06)',
      borderRadius: { xs: '18px', sm: '22px' },
      '& fieldset': { border: '1px solid rgba(255,255,255,0.12)' },
      '&:hover fieldset': { border: '1px solid rgba(255,255,255,0.20)' },
      '&.Mui-focused fieldset': { border: '2px solid #00f2ea' },
      '& input, & textarea': { 
        color: '#fff', 
        padding: { xs: '8px 12px', sm: '10px 14px' },
        fontSize: { xs: '15px', sm: '16px' }
      }
    }
  },
  sendBtn: {
    width: { xs: 40, sm: 48 },
    height: { xs: 40, sm: 48 },
    minWidth: { xs: 40, sm: 48 },
    minHeight: { xs: 40, sm: 48 },
    background: 'linear-gradient(135deg, #00f2ea, #00c9c2)',
    color: '#000',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(0,242,234,0.3)',
    '&:hover': {
      background: 'linear-gradient(135deg, #00d4ce, #00b0a9)',
      boxShadow: '0 4px 12px rgba(0,242,234,0.4)'
    },
    '&:disabled': {
      background: 'rgba(255,255,255,0.1)',
      boxShadow: 'none'
    },
    '&:focus-visible': {
      outline: '2px solid #00f2ea',
      outlineOffset: '2px'
    }
  },
  payNowBtn: {
    borderRadius: '12px',
    width: 48,
    height: 48,
    minWidth: 48,
    minHeight: 48,
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(0,255,136,0.25)',
    '&:hover': {
      background: 'linear-gradient(135deg, #00cc6a, #00aa55) !important',
      boxShadow: '0 4px 12px rgba(0,255,136,0.35)'
    },
    '&:focus-visible': {
      outline: '2px solid #00ff88',
      outlineOffset: '2px'
    }
  },
  requestBtn: {
    borderRadius: '12px',
    width: 48,
    height: 48,
    minWidth: 48,
    minHeight: 48,
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(255,170,0,0.25)',
    '&:hover': {
      background: 'linear-gradient(135deg, #ffaa00, #ff8800) !important',
      boxShadow: '0 4px 12px rgba(255,170,0,0.35)'
    },
    '&:focus-visible': {
      outline: '2px solid #ffaa00',
      outlineOffset: '2px'
    }
  },
  milestoneRequestsArea: {
    padding: '12px 16px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    background: 'rgba(255, 215, 0, 0.05)',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  noChatSelected: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '32px'
  },
  noChatIcon: {
    fontSize: '64px'
  },
  noChatTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#fff'
  },
  noChatSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    maxWidth: 300
  },
  primaryCta: {
    background: '#00f2ea',
    color: '#000',
    mt: 1,
    '&:hover': { background: '#00d4ce' }
  },
  newChatBtn: {
    borderColor: 'rgba(0,242,234,0.35)',
    color: '#00f2ea',
    fontWeight: 700,
    borderRadius: '12px',
    textTransform: 'none',
    px: 1.5,
    minWidth: 0,
    '&:hover': {
      borderColor: 'rgba(0,242,234,0.55)',
      background: 'rgba(0,242,234,0.08)'
    }
  }
};

export default ChatSystem;
