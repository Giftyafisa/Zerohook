import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Chip,
  useTheme,
  useMediaQuery,
  Tabs,
  Tab
} from '@mui/material';
import {
  Send,
  AttachFile,
  Videocam,
  EmojiEmotions,
  MoreVert,
  Search
} from '@mui/icons-material';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import VideoSystem from './video/VideoSystem';

const ChatSystem = ({ currentUser }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showVideoCall, setShowVideoCall] = useState(false);
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load conversations
  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  // Load messages for selected conversation
  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
      
      // Join conversation room for real-time updates
      if (socket && isConnected) {
        socket.emit('join_conversation', selectedConversation.id);
        console.log(`🔗 Joined conversation room: ${selectedConversation.id}`);
      }
    }
    
    return () => {
      // Leave conversation room when conversation changes
      if (socket && isConnected && selectedConversation) {
        socket.emit('leave_conversation', selectedConversation.id);
        console.log(`🔗 Left conversation room: ${selectedConversation.id}`);
      }
    };
  }, [selectedConversation, socket, isConnected]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle typing indicators
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    // Send typing start indicator
    if (socket && isConnected && selectedConversation && !isTyping) {
      setIsTyping(true);
      socket.emit('typing_start', { conversationId: selectedConversation.id });
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Send typing stop indicator after 2 seconds of no typing
    typingTimeoutRef.current = setTimeout(() => {
      if (socket && isConnected && selectedConversation) {
        setIsTyping(false);
        socket.emit('typing_stop', { conversationId: selectedConversation.id });
      }
    }, 2000);
  };

  // Socket.io real-time messaging
  useEffect(() => {
    if (!socket || !isConnected) {
      console.log('🔌 Socket not ready:', { hasSocket: !!socket, isConnected });
      return;
    }

    // Join user's personal room
    socket.emit('join-room', `user_${user?.id}`);
    console.log('🔗 Joined user room:', `user_${user?.id}`);

    // Enhanced message handler
    const handleNewMessage = (messageData) => {
      console.log('💬 New message received:', messageData);
      
      // Add to messages if it's for current conversation
      if (selectedConversation && messageData.conversationId === selectedConversation.id) {
        setMessages(prev => [...prev, messageData]);
      }
      
      // Update conversation list
      setConversations(prev => 
        prev.map(conv => 
          conv.id === messageData.conversationId 
            ? { 
                ...conv, 
                lastMessage: messageData.content, 
                lastMessageTime: messageData.createdAt,
                unreadCount: conv.id === selectedConversation?.id ? 0 : (conv.unreadCount || 0) + 1
              }
            : conv
        )
      );
    };

    // Enhanced typing handler
    const handleUserTyping = (data) => {
      console.log('⌨️ User typing:', data);
      // Typing indicators can be implemented later if needed
    };

    // Add socket event listeners
    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleUserTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
    };
  }, [socket, isConnected, selectedConversation, user]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/chat/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data.conversations || []);
      } else {
        console.error('Failed to load conversations:', response.status);
        // Set empty conversations array to prevent errors
        setConversations([]);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
      // Set empty conversations array to prevent errors
      setConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/chat/messages/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
      } else {
        console.error('Failed to load messages:', response.status);
        // Set empty messages array to prevent errors
        setMessages([]);
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
      // Set empty messages array to prevent errors
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversationId: selectedConversation.id,
          content: newMessage,
          messageType: 'text'
        })
      });

      if (response.ok) {
        // Add message to local state immediately for better UX
        const newMessageObj = {
          id: Date.now(),
          content: newMessage,
          senderId: user.id,
          conversationId: selectedConversation.id,
          createdAt: new Date().toISOString(),
          messageType: 'text'
        };
        setMessages(prev => [...prev, newMessageObj]);
        setNewMessage('');
        // Message will be added via socket.io for real-time updates
      } else {
        console.error('Failed to send message:', response.status);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !selectedConversation) return;

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('conversationId', selectedConversation.id);

      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/chat/send-file`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        // File message will be added via socket.io
        console.log('File uploaded successfully');
      } else {
        console.error('Failed to upload file:', response.status);
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
    }
  };

  const startVideoCall = () => {
    if (selectedConversation) {
      setShowVideoCall(true);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const filteredConversations = conversations.filter(conv =>
    conv.participantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    conv.lastMessage?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const messageDate = new Date(timestamp);
    const diff = now - messageDate;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return messageDate.toLocaleDateString();
  };

  if (!user) return null;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Chats" />
        <Tab label="Video Calls" />
      </Tabs>

      {activeTab === 0 && (
        <Box sx={{ display: 'flex', height: 'calc(100% - 48px)' }}>
          {/* Conversations List */}
          <Box sx={{ width: isMobile ? '100%' : 300, borderRight: 1, borderColor: 'divider' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />
                }}
              />
            </Box>

            <List sx={{ overflow: 'auto', maxHeight: 'calc(100% - 80px)' }}>
              {filteredConversations.map((conversation) => (
                <ListItem
                  key={conversation.id}
                  button
                  selected={selectedConversation?.id === conversation.id}
                  onClick={() => setSelectedConversation(conversation)}
                  sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                  <ListItemAvatar>
                    <Avatar src={conversation.participantAvatar}>
                      {conversation.participantName?.[0]}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={conversation.participantName}
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.primary" noWrap>
                          {conversation.lastMessage || 'No messages yet'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {conversation.lastMessageTime ? formatTimestamp(conversation.lastMessageTime) : ''}
                        </Typography>
                      </Box>
                    }
                  />
                  {conversation.unreadCount > 0 && (
                    <Chip
                      label={conversation.unreadCount}
                      size="small"
                      color="primary"
                      sx={{ ml: 1 }}
                    />
                  )}
                </ListItem>
              ))}
            </List>
          </Box>

          {/* Chat Area */}
          {selectedConversation ? (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              {/* Chat Header */}
              <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Avatar src={selectedConversation.participantAvatar}>
                    {selectedConversation.participantName?.[0]}
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{selectedConversation.participantName}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedConversation.participantOnline ? 'Online' : 'Offline'}
                    </Typography>
                  </Box>
                </Box>
                <Box>
                  <IconButton onClick={startVideoCall} color="primary">
                    <Videocam />
                  </IconButton>
                  <IconButton>
                    <MoreVert />
                  </IconButton>
                </Box>
              </Box>

              {/* Messages */}
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                {messages.map((message, index) => (
                  <Box
                    key={message.id || index}
                    sx={{
                      display: 'flex',
                      justifyContent: message.senderId === user.id ? 'flex-end' : 'flex-start',
                      mb: 2
                    }}
                  >
                    <Box
                      sx={{
                        maxWidth: '70%',
                        backgroundColor: message.senderId === user.id ? 'primary.main' : 'grey.100',
                        color: message.senderId === user.id ? 'white' : 'text.primary',
                        borderRadius: 2,
                        p: 1.5,
                        position: 'relative'
                      }}
                    >
                      <Typography variant="body2">
                        {message.content}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', mt: 0.5 }}>
                        {formatTimestamp(message.createdAt)}
                      </Typography>
                    </Box>
                  </Box>
                ))}
                <div ref={messagesEndRef} />
              </Box>

              {/* Message Input */}
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                  <TextField
                    fullWidth
                    multiline
                    maxRows={4}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={handleTyping}
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    size="small"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                    accept="image/*,video/*,application/*"
                  />
                  <IconButton onClick={() => fileInputRef.current?.click()}>
                    <AttachFile />
                  </IconButton>
                  <IconButton>
                    <EmojiEmotions />
                  </IconButton>
                  <Button
                    variant="contained"
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    endIcon={<Send />}
                  >
                    Send
                  </Button>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Typography variant="h6" color="text.secondary">
                Select a conversation to start chatting
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {activeTab === 1 && (
        <Box sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Video Call Features
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Initiate and manage video calls with your connections.
          </Typography>
          <VideoSystem 
            mode="call" 
            onCallStart={() => console.log('Video call started')}
          />
        </Box>
      )}

      {/* Video Call Dialog */}
      {showVideoCall && selectedConversation && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Box sx={{ width: '90%', height: '90%' }}>
            <VideoSystem 
              mode="call" 
              onCallStart={() => console.log('Video call started')}
              onCallEnd={() => setShowVideoCall(false)}
              callerInfo={selectedConversation}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default ChatSystem;
