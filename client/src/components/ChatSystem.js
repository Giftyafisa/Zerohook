import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Avatar,
  Badge,
  InputAdornment,
  CircularProgress
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
  Mic as MicIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config/constants';

const ChatSystem = () => {
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      if (socket && isConnected) {
        socket.emit('join_conversation', selectedConversation.id);
      }
    }
  }, [selectedConversation, socket, isConnected]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Socket listeners
  useEffect(() => {
    if (!socket || !isConnected) return;

    const handleNewMessage = (messageData) => {
      if (selectedConversation && messageData.conversationId === selectedConversation.id) {
        setMessages(prev => [...prev, messageData]);
      }
      setConversations(prev =>
        prev.map(conv =>
          conv.id === messageData.conversationId
            ? { ...conv, lastMessage: messageData.content, lastMessageTime: messageData.createdAt }
            : conv
        )
      );
    };

    socket.on('new_message', handleNewMessage);
    return () => socket.off('new_message', handleNewMessage);
  }, [socket, isConnected, selectedConversation]);

  const loadConversations = async () => {
    try {
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
          participantAvatar: conv.otherUser?.profilePicture || null,
          participantOnline: false, // Will be updated via socket
          participantVerified: (conv.otherUser?.verificationTier || 0) >= 2,
          participantId: conv.otherUser?.id,
          lastMessage: conv.lastMessage,
          lastMessageTime: conv.lastMessageTime,
          unreadCount: conv.unreadCount || 0,
          hasActiveEscrow: conv.hasActiveEscrow || false,
          createdAt: conv.createdAt
        }));
        setConversations(transformedConversations);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
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
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    const messageContent = newMessage.trim();
    setNewMessage('');

    // Optimistic update
    const tempMessage = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      senderId: user.id,
      conversationId: selectedConversation.id,
      createdAt: new Date().toISOString(),
      status: 'sending'
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
          content: messageContent,
          messageType: 'text' // Explicitly send message type
        })
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(prev =>
          prev.map(msg =>
            msg.id === tempMessage.id ? { ...data.message, status: 'sent' } : msg
          )
        );
      }
    } catch (error) {
      console.error('Failed to send message:', error);
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

  const filteredConversations = conversations.filter(conv =>
    conv.participantName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectConversation = (conv) => {
    setSelectedConversation(conv);
    setShowMobileChat(true);
  };

  if (!user) return null;

  return (
    <Box sx={styles.container}>
      {/* Chat Area - Now on the left/center */}
      <Box sx={{ ...styles.chatArea, display: !selectedConversation && !showMobileChat ? { xs: 'none', md: 'flex' } : 'flex' }}>
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <Box sx={styles.chatHeader}>
              <IconButton 
                sx={{ ...styles.backBtn, display: { xs: 'flex', md: 'none' } }}
                onClick={() => setShowMobileChat(false)}
              >
                <BackIcon />
              </IconButton>
              <Box sx={styles.chatHeaderInfo}>
                <Avatar src={selectedConversation.participantAvatar} sx={styles.chatAvatar}>
                  {selectedConversation.participantName?.[0]}
                </Avatar>
                <Box>
                  <Typography sx={styles.chatUserName}>
                    {selectedConversation.participantName}
                  </Typography>
                  <Typography sx={styles.chatUserStatus}>
                    {selectedConversation.participantOnline ? 'Online' : 'Offline'}
                  </Typography>
                </Box>
              </Box>
              <Box sx={styles.chatHeaderActions}>
                <IconButton sx={styles.headerActionBtn}>
                  <PhoneIcon />
                </IconButton>
                <IconButton sx={styles.headerActionBtn}>
                  <VideoIcon />
                </IconButton>
                <IconButton sx={styles.headerActionBtn}>
                  <MoreIcon />
                </IconButton>
              </Box>
            </Box>

            {/* Escrow Bar */}
            {selectedConversation.hasActiveEscrow && (
              <Box sx={styles.escrowBar}>
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
            <Box sx={styles.inputArea}>
              <input
                ref={fileInputRef}
                type="file"
                style={{ display: 'none' }}
                accept="image/*,video/*"
              />
              <IconButton sx={styles.inputActionBtn} onClick={() => fileInputRef.current?.click()}>
                <AttachIcon />
              </IconButton>
              <TextField
                fullWidth
                placeholder="Type a message..."
                value={newMessage}
                onChange={handleTyping}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
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

      {/* Conversations List - Now on the right */}
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
                  transition={{ delay: index * 0.05 }}
                >
                  <Box
                    sx={{
                      ...styles.conversationItem,
                      background: selectedConversation?.id === conv.id ? 'rgba(0, 242, 234, 0.1)' : 'transparent'
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
                      <Typography sx={styles.conversationPreview} noWrap>
                        {conv.lastMessage || 'Start a conversation'}
                      </Typography>
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
    </Box>
  );
};

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    background: 'var(--bg-primary, #0f0f13)',
    overflow: 'hidden'
  },
  conversationsList: {
    width: { xs: '100%', md: 320 },
    borderLeft: '1px solid rgba(255,255,255,0.08)',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-secondary, #1a1a22)',
    order: 2 // Ensure it appears on the right
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
    padding: '8px 12px'
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
    gap: '14px',
    padding: '14px',
    borderRadius: '18px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    marginBottom: '4px',
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
    color: 'rgba(255,255,255,0.4)'
  },
  conversationPreview: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.6)'
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
    padding: '16px 20px',
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
    background: 'var(--bg-secondary, #1a1a22)'
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
    gap: '16px'
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
  }
};

export default ChatSystem;
