import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Collapse,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  ExpandMore,
  ExpandLess,
  Refresh,
  Cloud,
  Storage,
  VideoCall,
  Message
} from '@mui/icons-material';

const SystemStatus = () => {
  const [systemStatus, setSystemStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  const checkSystemHealth = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/health');
      if (response.ok) {
        const data = await response.json();
        setSystemStatus(data);
        setLastChecked(new Date());
      } else {
        setSystemStatus({ status: 'error', message: 'Failed to check system health' });
      }
    } catch (error) {
      setSystemStatus({ 
        status: 'error', 
        message: 'Network error while checking system health',
        error: error.message 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkSystemHealth();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'success';
      case 'unhealthy':
        return 'error';
      case 'warning':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle color="success" />;
      case 'unhealthy':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      default:
        return <Error color="error" />;
    }
  };

  const getComponentStatus = (component) => {
    if (!component) return { status: 'unknown', message: 'Component not available' };
    
    if (component.status === 'connected' || component.status === 'accessible') {
      return { status: 'healthy', message: 'Component is working properly' };
    } else if (component.status === 'disconnected' || component.status === 'inaccessible') {
      return { status: 'unhealthy', message: 'Component is not accessible' };
    } else {
      return { status: 'warning', message: 'Component status unclear' };
    }
  };

  if (!systemStatus) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" p={2}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" display="flex" alignItems="center" gap={1}>
            <Cloud />
            System Status
          </Typography>
          <Box display="flex" gap={1}>
            <Tooltip title="Refresh Status">
              <IconButton 
                onClick={checkSystemHealth} 
                disabled={loading}
                size="small"
              >
                <Refresh />
              </IconButton>
            </Tooltip>
            <IconButton 
              onClick={() => setExpanded(!expanded)}
              size="small"
            >
              {expanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
        </Box>

        {/* Overall Status */}
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          {getStatusIcon(systemStatus.status)}
          <Typography variant="h6">
            System is {systemStatus.status}
          </Typography>
          <Chip 
            label={systemStatus.status} 
            color={getStatusColor(systemStatus.status)}
            size="small"
          />
        </Box>

        {lastChecked && (
          <Typography variant="body2" color="text.secondary" mb={2}>
            Last checked: {lastChecked.toLocaleTimeString()}
          </Typography>
        )}

        {/* Error Display */}
        {systemStatus.message && systemStatus.status === 'error' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {systemStatus.message}
            {systemStatus.error && (
              <Typography variant="body2" sx={{ mt: 1 }}>
                Error: {systemStatus.error}
              </Typography>
            )}
          </Alert>
        )}

        {/* Detailed Status */}
        <Collapse in={expanded}>
          <Box mt={2}>
            <Typography variant="subtitle1" gutterBottom>
              Component Status
            </Typography>
            
            <List dense>
              {/* Database Status */}
              <ListItem>
                <ListItemIcon>
                  <Storage />
                </ListItemIcon>
                <ListItemText
                  primary="Database"
                  secondary={systemStatus.components?.database?.status || 'Unknown'}
                />
                <Chip 
                  label={getComponentStatus(systemStatus.components?.database).status}
                  color={getStatusColor(getComponentStatus(systemStatus.components?.database).status)}
                  size="small"
                />
              </ListItem>

              {/* File System Status */}
              <ListItem>
                <ListItemIcon>
                  <Storage />
                </ListItemIcon>
                <ListItemText
                  primary="File System"
                  secondary={systemStatus.components?.fileSystem?.status || 'Unknown'}
                />
                <Chip 
                  label={getComponentStatus(systemStatus.components?.fileSystem).status}
                  color={getStatusColor(getComponentStatus(systemStatus.components?.fileSystem).status)}
                  size="small"
                />
              </ListItem>

              {/* Redis Status */}
              <ListItem>
                <ListItemIcon>
                  <Storage />
                </ListItemIcon>
                <ListItemText
                  primary="Cache (Redis)"
                  secondary={systemStatus.components?.redis?.status || 'Unknown'}
                />
                <Chip 
                  label={getComponentStatus(systemStatus.components?.redis).status}
                  color={getStatusColor(getComponentStatus(systemStatus.components?.redis).status)}
                  size="small"
                />
              </ListItem>

              {/* Services Status */}
              {systemStatus.components?.services && (
                <ListItem>
                  <ListItemIcon>
                    <Message />
                  </ListItemIcon>
                  <ListItemText
                    primary="Core Services"
                    secondary={`${systemStatus.components.services.tables?.existing || 0}/${systemStatus.components.services.tables?.total || 0} tables ready`}
                  />
                  <Chip 
                    label={systemStatus.components.services.tables?.missing?.length === 0 ? 'Ready' : 'Incomplete'}
                    color={systemStatus.components.services.tables?.missing?.length === 0 ? 'success' : 'warning'}
                    size="small"
                  />
                </ListItem>
              )}
            </List>

            {/* Data Statistics */}
            {systemStatus.components?.services?.data && (
              <Box mt={2}>
                <Typography variant="subtitle1" gutterBottom>
                  Data Statistics
                </Typography>
                <Box display="flex" gap={2} flexWrap="wrap">
                  <Chip 
                    label={`${systemStatus.components.services.data.users || 0} Users`}
                    variant="outlined"
                    size="small"
                  />
                  <Chip 
                    label={`${systemStatus.components.services.data.services || 0} Services`}
                    variant="outlined"
                    size="small"
                  />
                  <Chip 
                    label={`${systemStatus.components.services.data.connections || 0} Connections`}
                    variant="outlined"
                    size="small"
                  />
                </Box>
              </Box>
            )}

            {/* Environment Info */}
            <Box mt={2}>
              <Typography variant="subtitle1" gutterBottom>
                Environment Information
              </Typography>
              <Box display="flex" gap={2} flexWrap="wrap">
                <Chip 
                  label={`Environment: ${systemStatus.environment || 'Unknown'}`}
                  variant="outlined"
                  size="small"
                />
                <Chip 
                  label={`Uptime: ${Math.floor((systemStatus.uptime || 0) / 60)}m`}
                  variant="outlined"
                  size="small"
                />
                <Chip 
                  label={`Timestamp: ${new Date(systemStatus.timestamp || Date.now()).toLocaleString()}`}
                  variant="outlined"
                  size="small"
                />
              </Box>
            </Box>
          </Box>
        </Collapse>

        {/* Action Buttons */}
        <Box display="flex" gap={1} mt={2}>
          <Button
            variant="outlined"
            size="small"
            onClick={checkSystemHealth}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <Refresh />}
          >
            {loading ? 'Checking...' : 'Check Status'}
          </Button>
          <Button
            variant="text"
            size="small"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show Less' : 'Show More'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

export default SystemStatus;
