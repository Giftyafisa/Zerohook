import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Alert,
  Card,
  CardContent,
  Grid,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  IconButton,
  Tabs,
  Tab,
  CircularProgress
} from '@mui/material';
import {
  Message,
  VideoCall,
  CheckCircle,
  Cancel,
  Delete
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import CallButton from './CallButton';

const UserConnectionHub = ({ targetUser, currentUser, onClose, open }) => {
  const { user: authUser } = useAuth();
  const [connectionType, setConnectionType] = useState('contact_request');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Connection management state
  const [connections, setConnections] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

  // Load user connections when component mounts
  useEffect(() => {
    if (authUser) {
      loadUserConnections();
    }
  }, [authUser]);

  const loadUserConnections = async () => {
    setLoadingConnections(true);
    try {
      const token = localStorage.getItem('token');
      
      // Load all connection data
      const [connectionsRes, pendingRes] = await Promise.all([
        fetch(`${API_BASE_URL}/connections/user-connections`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/connections/pending-requests`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (connectionsRes.ok) {
        const data = await connectionsRes.json();
        setConnections(data.connections || []);
      }

      if (pendingRes.ok) {
        const data = await pendingRes.json();
        setPendingRequests(data.requests || []);
        // For now, set sent requests to empty array since endpoint doesn't exist
        setSentRequests([]);
      }

    } catch (error) {
      console.error('Error loading connections:', error);
      setError('Failed to load connections');
    } finally {
      setLoadingConnections(false);
    }
  };

  const handleSendRequest = async () => {
    if (!targetUser || !user) return;
    
    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication required. Please log in.');
        return;
      }

      console.log('🔗 Sending connection request:', {
        fromUser: user.username,
        toUser: targetUser.username,
        connectionType,
        hasMessage: !!message
      });

      const response = await fetch(`${process.env.REACT_APP_API_URL || '/api'}/connections/contact-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          toUserId: targetUser.id,
          message: message.trim() || `Hi! I'm interested in connecting with you.`,
          connectionType
        })
      });

      if (response.ok) {
        await response.json();
        setSuccess('Connection request sent successfully!');
        setMessage('');
        
        // Close dialog after short delay
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        const errorData = await response.json();
        if (response.status === 409) {
          setError('You are already connected with this user.');
        } else if (response.status === 403) {
          setError('Cannot connect with this user.');
        } else {
          throw new Error(errorData.message || 'Failed to send request');
        }
      }
    } catch (error) {
      console.error('Connection request error:', error);
      setError(error.message || 'Failed to send connection request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/connections/accept-request/${requestId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setSuccess('Connection request accepted!');
        loadUserConnections();
      } else {
        setError('Failed to accept request');
      }
    } catch (error) {
      setError('Network error');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/connections/reject-request/${requestId}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setSuccess('Connection request rejected');
        loadUserConnections();
      } else {
        setError('Failed to reject request');
      }
    } catch (error) {
      setError('Network error');
    }
  };

  const handleDeleteConnection = async (connectionId) => {
    if (!window.confirm('Are you sure you want to remove this connection?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/connections/delete/${connectionId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setSuccess('Connection removed');
        loadUserConnections();
      } else {
        setError('Failed to remove connection');
      }
    } catch (error) {
      setError('Network error');
    }
  };

  // Handle different usage contexts
  if (!targetUser && !currentUser) {
    return null;
  }

  const user = targetUser || currentUser;
  
  // If this is a dialog context (ProfileBrowse), render the dialog
  if (open !== undefined && onClose) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>Connect with {user?.username || 'User'}</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Choose connection type:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Button
                variant={connectionType === 'contact_request' ? 'contained' : 'outlined'}
                onClick={() => setConnectionType('contact_request')}
                startIcon={<Message />}
              >
                Contact Request
              </Button>
              <Button
                variant={connectionType === 'service_inquiry' ? 'contained' : 'outlined'}
                onClick={() => setConnectionType('service_inquiry')}
                startIcon={<Message />}
              >
                Service Inquiry
              </Button>
              <Button
                variant={connectionType === 'video_call' ? 'contained' : 'outlined'}
                onClick={() => setConnectionType('video_call')}
                startIcon={<VideoCall />}
              >
                Video Call
              </Button>
            </Box>
          </Box>

          <TextField
            fullWidth
            multiline
            rows={4}
            label="Message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Introduce yourself or ask a question..."
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {success}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSendRequest}
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Sending...' : 'Send Request'}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
  
  // Dashboard context - render full connection management
  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        🔗 Connection Hub
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Welcome, {user?.username || 'User'}! Manage your connections and requests here.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label={`Connections (${connections.length})`} />
        <Tab label={`Pending (${pendingRequests.length})`} />
        <Tab label={`Sent (${sentRequests.length})`} />
      </Tabs>

      {loadingConnections ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Active Connections Tab */}
          {activeTab === 0 && (
            <Box>
              {connections.length === 0 ? (
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No connections yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Start connecting with other users to build your network
                    </Typography>
                  </CardContent>
                </Card>
              ) : (
                <Grid container spacing={2}>
                  {connections.map((connection) => (
                    <Grid item xs={12} md={6} key={connection.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box display="flex" alignItems="center" gap={2} mb={2}>
                            <Avatar src={connection.user?.profileData?.profilePicture}>
                              {connection.user?.username?.charAt(0)}
                            </Avatar>
                            <Box flex={1}>
                              <Typography variant="h6">
                                {connection.user?.profileData?.firstName} {connection.user?.profileData?.lastName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                @{connection.user?.username}
                              </Typography>
                            </Box>
                            <Chip label="Connected" color="success" size="small" />
                          </Box>
                          
                          <Box display="flex" gap={1} flexWrap="wrap">
                            <CallButton
                              targetUser={connection.user}
                              variant="icon"
                              size="small"
                              onCallStart={(callType, targetUser) => {
                                console.log(`📞 Starting ${callType} call with ${targetUser.username}`);
                              }}
                            />
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<Message />}
                            >
                              Message
                            </Button>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteConnection(connection.id)}
                            >
                              <Delete />
                            </IconButton>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          )}

          {/* Pending Requests Tab */}
          {activeTab === 1 && (
            <Box>
              {pendingRequests.length === 0 ? (
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No pending requests
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      You'll see connection requests from other users here
                    </Typography>
                  </CardContent>
                </Card>
              ) : (
                <List>
                  {pendingRequests.map((request) => (
                    <React.Fragment key={request.id}>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar src={request.fromUser?.profileData?.profilePicture}>
                            {request.fromUser?.username?.charAt(0)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={`${request.fromUser?.profileData?.firstName} ${request.fromUser?.profileData?.lastName}`}
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                @{request.fromUser?.username}
                              </Typography>
                              {request.message && (
                                <Typography variant="body2" sx={{ mt: 1 }}>
                                  "{request.message}"
                                </Typography>
                              )}
                            </Box>
                          }
                        />
                        <Box display="flex" gap={1}>
                          <Button
                            variant="contained"
                            color="success"
                            size="small"
                            startIcon={<CheckCircle />}
                            onClick={() => handleAcceptRequest(request.id)}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            startIcon={<Cancel />}
                            onClick={() => handleRejectRequest(request.id)}
                          >
                            Reject
                          </Button>
                        </Box>
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Box>
          )}

          {/* Sent Requests Tab */}
          {activeTab === 2 && (
            <Box>
              {sentRequests.length === 0 ? (
                <Card variant="outlined">
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                      No sent requests
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      You haven't sent any connection requests yet
                    </Typography>
                  </CardContent>
                </Card>
              ) : (
                <List>
                  {sentRequests.map((request) => (
                    <React.Fragment key={request.id}>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar src={request.toUser?.profileData?.profilePicture}>
                            {request.toUser?.username?.charAt(0)}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={`${request.toUser?.profileData?.firstName} ${request.toUser?.profileData?.lastName}`}
                          secondary={
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                @{request.toUser?.username}
                              </Typography>
                              <Chip 
                                label={request.status === 'pending' ? 'Pending' : request.status} 
                                color={request.status === 'pending' ? 'warning' : 'default'}
                                size="small"
                                sx={{ mt: 1 }}
                              />
                            </Box>
                          }
                        />
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default UserConnectionHub;

