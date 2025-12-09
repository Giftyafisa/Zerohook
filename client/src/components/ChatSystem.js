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
  Button
} from '@mui/material';
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
  Mic as MicIcon,
  Block as BlockIcon,
  Report as ReportIcon,
  Delete as DeleteIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { keyframes } from '@emotion/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { API_BASE_URL, getUploadUrl } from '../config/constants';

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

const ChatSystem = ({
  recipientId: propRecipientId = null,
  recipientName: propRecipientName = null,
  recipientAvatar: propRecipientAvatar = null,
  initialConversationId: propInitialConversationId = null
}) => {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
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
  
  // Menu state
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const menuOpen = Boolean(menuAnchorEl);
  
  const messagesEndRef = useRef(null);
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
    if (!user || loading || hasBootstrappedRef.current) return;

    const tryBootstrap = async () => {
      try {
        if (targetRecipientId) {
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
      if (!silent) setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/chat/conversations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
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
        const sorted = sortConversations(transformedConversations);
        setConversations(sorted);
        return sorted;
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      alert('Unable to load conversations right now.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/chat/messages/${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setConversations(prev => prev.map(c => c.id === conversationId ? { ...c, unreadCount: 0 } : c));
        await markConversationRead(conversationId);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      alert('Unable to load messages right now.');
    }
  };

  const startConversationWithRecipient = async (recipientId) => {
    if (!recipientId || startingConversation) return null;
    const existing = conversations.find(c => c.participantId === recipientId);
    if (existing) {
      selectConversation(existing);
      return existing;
    }

    try {
      setStartingConversation(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/chat/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ otherUserId: recipientId })
      });

      if (!response.ok) throw new Error('Failed to start conversation');
      const data = await response.json();
      const convList = await loadConversations({ silent: true });
      const created = convList?.find(c => c.participantId === recipientId || c.id === data.conversationId);
      if (created) {
        selectConversation(created);
      }
      return created || null;
    } catch (error) {
      console.error('Failed to start conversation:', error);
      alert('Unable to start conversation right now.');
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

      if (response.ok) {
        const data = await response.json();
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
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message.');
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;
    const messageContent = newMessage.trim();
    setNewMessage('');
    await sendMessagePayload({ content: messageContent, messageType: 'text' });
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
      alert('Failed to upload attachment.');
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
    const mergedConv = {
      ...conv,
      participantName: conv.participantName || (conv.participantId === targetRecipientId ? targetRecipientName : conv.participantName),
      participantAvatar: conv.participantAvatar || (conv.participantId === targetRecipientId ? targetRecipientAvatar : conv.participantAvatar)
    };
    setSelectedConversation(mergedConv);
    setShowMobileChat(true);
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
    markConversationRead(conv.id);
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
                >
                  <PhoneIcon />
                </IconButton>
                <IconButton 
                  sx={{ ...styles.headerActionBtn, display: { xs: 'none', sm: 'inline-flex' } }}
                  onClick={handleVideoCall}
                  title="Video Call"
                >
                  <VideoIcon />
                </IconButton>
                <IconButton 
                  sx={styles.headerActionBtn}
                  onClick={handleMenuOpen}
                  title="More Options"
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
                      '&:hover': { bgcolor: 'rgba(0,242,234,0.1)' }
                    }
                  }
                }}
              >
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

            {/* Escrow Bar */}
            {selectedConversation.hasActiveEscrow && (
              <Box sx={{ ...styles.escrowBar, display: { xs: 'none', md: 'flex' } }}>
                <LockIcon sx={{ fontSize: 18 }} />
                <Typography>Escrow Active:</Typography>
                <Typography sx={styles.escrowAmount}>
                  ${selectedConversation.escrowAmount?.toFixed(2) || '0.00'}
                </Typography>
                <Box sx={styles.escrowBtn}>Details</Box>
              </Box>
            )}

            {/* Messages */}
            <Box sx={styles.messagesContainer}>
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
                        ...(message.senderId === user.id ? styles.sentBubble : styles.receivedBubble)
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
            </Box>

            {/* Input Area */}
            {selectedConversation && (
              <Box sx={styles.inputArea}>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept="image/*,video/*"
                />
                {/* Attachment disabled until upload flow is implemented */}
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
                />
                <IconButton sx={styles.inputActionBtn}>
                  <EmojiIcon />
                </IconButton>
                {newMessage.trim() ? (
                  <IconButton sx={styles.sendBtn} onClick={sendMessage}>
                    <SendIcon />
                  </IconButton>
                ) : (
                  <IconButton sx={styles.inputActionBtn}>
                    <MicIcon />
                  </IconButton>
                )}
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
          </Box>
        )}
      </Box>

      {/* Conversations List - right; always visible on desktop */}
      <Box sx={{ ...styles.conversationsList, display: showMobileChat ? { xs: 'none', md: 'flex' } : 'flex' }}>
        <Box sx={styles.listHeader}>
          <Typography sx={styles.listTitle}>Messages</Typography>
          <Box sx={styles.connectionStatus}>
            <Box sx={{ ...styles.statusDot, background: isConnected ? '#00ff88' : '#ff3333' }} />
            <Typography sx={styles.statusText}>
              {isConnected ? 'Connected' : 'Offline'}
            </Typography>
          </Box>
        </Box>

        {/* Search */}
        <Box sx={styles.searchContainer}>
          <TextField
            fullWidth
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={styles.searchInput}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'rgba(255,255,255,0.4)' }} />
                </InputAdornment>
              )
            }}
          />
        </Box>

        {/* Conversations */}
        <Box sx={styles.conversationsScroll}>
          {loading ? (
            <Box sx={styles.loadingContainer}>
              <CircularProgress size={32} sx={{ color: '#00f2ea' }} />
            </Box>
          ) : filteredConversations.length === 0 ? (
            <Box sx={styles.emptyState}>
              <Typography sx={styles.emptyText}>No conversations yet</Typography>
            </Box>
          ) : (
            <AnimatePresence>
              {filteredConversations.map((conv, index) => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Box
                    sx={{
                      ...styles.conversationItem,
                      background: selectedConversation?.id === conv.id ? 'rgba(0, 242, 234, 0.18)' : 'transparent'
                    }}
                    onClick={() => selectConversation(conv)}
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
    </Box>
  );
};

const styles = {
  container: {
    display: 'flex',
    flex: 1,
    minHeight: 'calc(100vh - 0px)',
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
    order: 2
  },
  listHeader: {
    padding: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid rgba(255,255,255,0.08)'
  },
  listTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#fff'
  },
  connectionStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
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
    padding: '12px 20px'
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
    padding: '8px 10px'
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '40px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 20px'
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)'
  },
  conversationItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '16px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '6px',
    '&:hover': {
      background: 'rgba(255,255,255,0.05)'
    }
  },
  avatar: {
    width: 52,
    height: 52
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
    color: 'rgba(255,255,255,0.4)',
    marginLeft: 'auto',
    textAlign: 'right'
  },
  conversationPreview: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)'
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
    minWidth: 20,
    height: 20,
    padding: '0 6px',
    background: '#ff0055',
    borderRadius: 10,
    fontSize: '12px',
    fontWeight: 600,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  escrowIndicator: {
    color: '#00ff88',
    marginLeft: '8px'
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-primary, #0f0f13)'
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '16px 20px',
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
    color: '#00ff88'
  },
  chatHeaderActions: {
    display: 'flex',
    gap: '4px'
  },
  headerActionBtn: {
    color: '#fff',
    '&:hover': {
      background: 'rgba(255,255,255,0.1)'
    }
  },
  escrowBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 16px',
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
    padding: '16px 20px 72px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  messageRow: {
    display: 'flex'
  },
  messageBubble: {
    maxWidth: '75%',
    padding: '12px 16px',
    borderRadius: '20px'
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
    fontSize: '15px',
    lineHeight: 1.4
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
    fontSize: '11px',
    opacity: 0.7
  },
  inputArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    background: 'var(--bg-secondary, #1a1a22)',
    position: 'sticky',
    bottom: 0,
    zIndex: 2
  },
  inputActionBtn: {
    color: 'rgba(255,255,255,0.6)',
    '&:hover': {
      color: '#fff'
    }
  },
  messageInput: {
    flex: 1,
    '& .MuiOutlinedInput-root': {
      background: 'rgba(255,255,255,0.05)',
      borderRadius: '24px',
      '& fieldset': { border: '1px solid rgba(255,255,255,0.08)' },
      '&:hover fieldset': { border: '1px solid rgba(255,255,255,0.15)' },
      '&.Mui-focused fieldset': { border: '1px solid #00f2ea' },
      '& input, & textarea': { color: '#fff', padding: '12px 16px' }
    }
  },
  sendBtn: {
    background: '#00f2ea',
    color: '#000',
    '&:hover': {
      background: '#00d4ce'
    }
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
  }
};

export default ChatSystem;
