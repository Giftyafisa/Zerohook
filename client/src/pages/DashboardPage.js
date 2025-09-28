import React, { useState } from 'react';
import {
  Box,
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Tabs,
  Tab,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  // IconButton, // unused
  Divider,
  Badge,
  Paper,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Chat as ChatIcon,
  VideoCall as VideoCallIcon,
  People as PeopleIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Phone as PhoneIcon,
  Videocam as VideocamIcon,
  Message as MessageIcon,
  PersonAdd as PersonAddIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import UserConnectionHub from '../components/UserConnectionHub';

const DashboardPage = () => {
  const { user, isAuthenticated } = useAuth();
  const { isConnected } = useSocket();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);

  if (!isAuthenticated) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="warning">
          Please log in to access your dashboard.
        </Alert>
      </Container>
    );
  }

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Welcome back, {user?.profileData?.firstName || user?.username || 'User'}! 👋
        </Typography>
        <Typography variant="h6" color="text.secondary" gutterBottom>
          Manage your connections, communications, and profile
        </Typography>
        
        {/* Status Indicators */}
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Chip 
            icon={<CheckCircleIcon />} 
            label="Online" 
            color="success" 
            variant="outlined"
          />
          <Chip 
            icon={<PeopleIcon />} 
            label={`${user?.connectionCount || 0} Connections`} 
            color="primary" 
            variant="outlined"
          />
          <Chip 
            icon={<NotificationsIcon />} 
            label={`${user?.notificationCount || 0} Notifications`} 
            color="secondary" 
            variant="outlined"
          />
        </Box>
      </Box>

      {/* Main Dashboard Grid */}
      <Grid container spacing={3}>
        {/* Left Sidebar - Quick Actions */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 2, height: 'fit-content' }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<MessageIcon />}
                fullWidth
                onClick={() => setActiveTab(1)}
              >
                New Message
              </Button>
              <Button
                variant="outlined"
                startIcon={<VideocamIcon />}
                fullWidth
                onClick={() => setActiveTab(2)}
              >
                Start Video Call
              </Button>
              <Button
                variant="outlined"
                startIcon={<PhoneIcon />}
                fullWidth
                onClick={() => setActiveTab(2)}
              >
                Start Audio Call
              </Button>
              <Button
                variant="outlined"
                startIcon={<PersonAddIcon />}
                fullWidth
                onClick={() => setActiveTab(3)}
              >
                Find Connections
              </Button>
            </Box>
          </Paper>

          {/* Connection Status */}
          <Paper sx={{ p: 2, mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Connection Status
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Online Friends</Typography>
                <Chip label="12" size="small" color="success" />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Pending Requests</Typography>
                <Chip label="3" size="small" color="warning" />
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">Total Connections</Typography>
                <Chip label="45" size="small" color="primary" />
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Main Content Area */}
        <Grid item xs={12} md={9}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
              <Tabs value={activeTab} onChange={handleTabChange}>
                <Tab label="Overview" icon={<DashboardIcon />} />
                <Tab label="Communication Hub" icon={<ChatIcon />} />
                <Tab label="Video & Call Center" icon={<VideoCallIcon />} />
                <Tab label="Connection Hub" icon={<PeopleIcon />} />
                <Tab label="Notifications" icon={<NotificationsIcon />} />
              </Tabs>
            </Box>

            {/* Tab Content */}
            {activeTab === 0 && (
              <Box>
                <Typography variant="h5" gutterBottom>
                  Dashboard Overview
                </Typography>
                
                {/* Stats Grid */}
                <Grid container spacing={3} sx={{ mb: 4 }}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Active Connections
                        </Typography>
                        <Typography variant="h4">
                          {user?.connectionCount || 0}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Unread Messages
                        </Typography>
                        <Typography variant="h4">
                          {user?.unreadMessageCount || 0}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Pending Requests
                        </Typography>
                        <Typography variant="h4">
                          {user?.pendingRequestCount || 0}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Card>
                      <CardContent>
                        <Typography color="textSecondary" gutterBottom>
                          Trust Score
                        </Typography>
                        <Typography variant="h4">
                          {user?.reputationScore || 0}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>

                {/* Recent Activity */}
                <Typography variant="h6" gutterBottom>
                  Recent Activity
                </Typography>
                <List>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>J</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="New connection request from John"
                      secondary="2 hours ago"
                    />
                    <ListItemSecondaryAction>
                      <Button size="small" color="primary">Accept</Button>
                      <Button size="small" color="error" sx={{ ml: 1 }}>Decline</Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar>S</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="Sarah sent you a message"
                      secondary="4 hours ago"
                    />
                    <ListItemSecondaryAction>
                      <Button size="small" color="primary">Reply</Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </Box>
            )}

            {activeTab === 1 && (
              <Box>
                <Typography variant="h5" gutterBottom>
                  Communication Hub
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  Manage all your conversations and messages in one place.
                </Typography>
                
                <Grid container spacing={3}>
                  <Grid item xs={12} md={4}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Recent Conversations
                        </Typography>
                        <List>
                          <ListItem button>
                            <ListItemAvatar>
                              <Badge badgeContent={2} color="error">
                                <Avatar>M</Avatar>
                              </Badge>
                            </ListItemAvatar>
                            <ListItemText
                              primary="Maria Santos"
                              secondary="Hey! Are you available for a call?"
                            />
                          </ListItem>
                          <ListItem button>
                            <ListItemAvatar>
                              <Avatar>D</Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary="David Chen"
                              secondary="Thanks for the great service!"
                            />
                          </ListItem>
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={8}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Quick Actions
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                          <Button
                            variant="contained"
                            startIcon={<MessageIcon />}
                            onClick={() => {/* Open new message dialog */}}
                          >
                            New Message
                          </Button>
                          <Button
                            variant="outlined"
                            startIcon={<VideocamIcon />}
                            onClick={() => {/* Open video call dialog */}}
                          >
                            Video Call
                          </Button>
                          <Button
                            variant="outlined"
                            startIcon={<PhoneIcon />}
                            onClick={() => {/* Open audio call dialog */}}
                          >
                            Audio Call
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}

            {activeTab === 2 && (
              <Box>
                <Typography variant="h5" gutterBottom>
                  Video & Call Center
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  Start calls, manage ongoing calls, and view call history.
                </Typography>
                
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Start a Call
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <Button
                            variant="contained"
                            startIcon={<VideocamIcon />}
                            size="large"
                            fullWidth
                            onClick={() => {/* Open video call dialog */}}
                          >
                            Start Video Call
                          </Button>
                          <Button
                            variant="outlined"
                            startIcon={<PhoneIcon />}
                            size="large"
                            fullWidth
                            onClick={() => {/* Open audio call dialog */}}
                          >
                            Start Audio Call
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Call History
                        </Typography>
                        <List>
                          <ListItem>
                            <ListItemAvatar>
                              <Avatar>L</Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary="Lisa Johnson - Video Call"
                              secondary="Yesterday, 15:30 - 25 min"
                            />
                            <Chip label="Completed" color="success" size="small" />
                          </ListItem>
                          <ListItem>
                            <ListItemAvatar>
                              <Avatar>R</Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary="Robert Kim - Audio Call"
                              secondary="2 days ago, 10:15 - 18 min"
                            />
                            <Chip label="Completed" color="success" size="small" />
                          </ListItem>
                        </List>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </Box>
            )}

            {activeTab === 3 && (
              <Box>
                <Typography variant="h5" gutterBottom>
                  Connection Hub
                </Typography>
                <UserConnectionHub />
              </Box>
            )}

            {activeTab === 4 && (
              <Box>
                <Typography variant="h5" gutterBottom>
                  Notifications
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  Stay updated with your latest notifications and alerts.
                </Typography>
                
                <List>
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>N</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="New connection request"
                      secondary="John Doe wants to connect with you"
                    />
                    <ListItemSecondaryAction>
                      <Button size="small" color="primary">Accept</Button>
                      <Button size="small" color="error" sx={{ ml: 1 }}>Decline</Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                  <Divider />
                  <ListItem>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'success.main' }}>M</Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary="Message received"
                      secondary="New message from Sarah Wilson"
                    />
                    <ListItemSecondaryAction>
                      <Button size="small" color="primary">View</Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                </List>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default DashboardPage;
