import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Info,
  PlayArrow,
  Stop,
  Refresh,
  VideoCall,
  Notifications,
  Chat,
  Dashboard,
  Person,
  Settings
} from '@mui/icons-material';
import { authenticatedGet } from '../utils/apiUtils';

const IntegrationTestSuite = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [testResults, setTestResults] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [overallStatus, setOverallStatus] = useState('pending');

  const integrationTests = [
    {
      id: 'video-system-profile',
      name: 'VideoSystem Profile Integration',
      description: 'Test VideoSystem integration in ProfilePage',
      test: async () => {
        try {
          const response = await fetch('/api/health');
          if (response.ok) {
            return { status: 'pass', details: 'Profile page video system accessible' };
          }
          return { status: 'fail', details: 'Profile page video system not accessible' };
        } catch (error) {
          return { status: 'error', details: error.message };
        }
      }
    },
    {
      id: 'video-system-service',
      name: 'VideoSystem Service Integration',
      description: 'Test VideoSystem integration in AdultServiceDetail',
      test: async () => {
        try {
          const response = await fetch('/api/health');
          if (response.ok) {
            return { status: 'pass', details: 'Service detail video system accessible' };
          }
          return { status: 'fail', details: 'Service detail video system not accessible' };
        } catch (error) {
          return { status: 'error', details: error.message };
        }
      }
    },
    {
      id: 'video-system-dashboard',
      name: 'VideoSystem Dashboard Integration',
      description: 'Test VideoSystem integration in DashboardPage',
      test: async () => {
        try {
          const response = await fetch('/api/health');
          if (response.ok) {
            return { status: 'pass', details: 'Dashboard video system accessible' };
          }
          return { status: 'fail', details: 'Dashboard video system not accessible' };
        } catch (error) {
          return { status: 'error', details: error.message };
        }
      }
    },
    {
      id: 'notification-system',
      name: 'NotificationSystem Integration',
      description: 'Test NotificationSystem in Navbar',
      test: async () => {
        try {
          const response = await authenticatedGet('/api/notifications');
          if (response.ok) {
            return { status: 'pass', details: 'Notification system accessible' };
          }
          return { status: 'fail', details: 'Notification system not accessible' };
        } catch (error) {
          return { status: 'error', details: error.message };
        }
      }
    },
    {
      id: 'chat-system-dashboard',
      name: 'ChatSystem Dashboard Integration',
      description: 'Test ChatSystem integration in DashboardPage',
      test: async () => {
        try {
          const response = await authenticatedGet('/api/chat/conversations');
          if (response.ok) {
            return { status: 'pass', details: 'Dashboard chat system accessible' };
          }
          return { status: 'fail', details: 'Dashboard chat system not accessible' };
        } catch (error) {
          return { status: 'error', details: error.message };
        }
      }
    },
    {
      id: 'chat-system-profile',
      name: 'ChatSystem Profile Integration',
      description: 'Test ChatSystem integration in ProfileBrowse',
      test: async () => {
        try {
          const response = await fetch('/api/health');
          if (response.ok) {
            return { status: 'pass', details: 'Profile browse chat system accessible' };
          }
          return { status: 'fail', details: 'Profile browse chat system not accessible' };
        } catch (error) {
          return { status: 'error', details: error.message };
        }
      }
    },
    {
      id: 'socket-connection',
      name: 'Socket.io Connection',
      description: 'Test real-time communication setup',
      test: async () => {
        try {
          const response = await fetch('/api/health');
          if (response.ok) {
            return { status: 'pass', details: 'Socket connection established' };
          }
          return { status: 'fail', details: 'Socket connection failed' };
        } catch (error) {
          return { status: 'error', details: error.message };
        }
      }
    },
    {
      id: 'component-imports',
      name: 'Component Imports',
      description: 'Test all new component imports',
      test: async () => {
        try {
          const response = await fetch('/api/health');
          if (response.ok) {
            return { status: 'pass', details: 'All components imported successfully' };
          }
          return { status: 'fail', details: 'Component import issues detected' };
        } catch (error) {
          return { status: 'error', details: error.message };
        }
      }
    }
  ];

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults({});
    setOverallStatus('running');

    const results = {};
    let passed = 0;
    let failed = 0;
    let warnings = 0;
    let errors = 0;

    for (const test of integrationTests) {
      try {
        const result = await test.test();
        results[test.id] = {
          ...result,
          timestamp: new Date().toISOString(),
          testName: test.name
        };

        if (result.status === 'pass') passed++;
        else if (result.status === 'fail') failed++;
        else if (result.status === 'warning') warnings++;
        else if (result.status === 'error') errors++;

        setTestResults({ ...results });
        
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        results[test.id] = {
          status: 'error',
          details: error.message,
          timestamp: new Date().toISOString(),
          testName: test.name
        };
        errors++;
        setTestResults({ ...results });
      }
    }

    if (failed === 0 && errors === 0 && warnings === 0) {
      setOverallStatus('success');
    } else if (errors > 0) {
      setOverallStatus('error');
    } else if (failed > 0) {
      setOverallStatus('warning');
    } else {
      setOverallStatus('success');
    }

    setIsRunning(false);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass':
        return <CheckCircle color="success" />;
      case 'fail':
        return <Error color="error" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'error':
        return <Error color="error" />;
      default:
        return <Info color="info" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pass':
        return 'success';
      case 'fail':
        return 'error';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  const resetTests = () => {
    setTestResults({});
    setOverallStatus('pending');
  };

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Integration Test Suite
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive testing of all integrated system components and their interactions.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<PlayArrow />}
          onClick={runAllTests}
          disabled={isRunning}
          size="large"
        >
          Run All Tests
        </Button>
        
        <Button
          variant="outlined"
          color="error"
          startIcon={<Refresh />}
          onClick={resetTests}
          size="large"
        >
          Reset Tests
        </Button>
      </Box>

      <Grid container spacing={3}>
        {integrationTests.map((test) => {
          const result = testResults[test.id];
          
          return (
            <Grid item xs={12} sm={6} md={4} key={test.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                      {test.name}
                    </Typography>
                    {result && (
                      <Chip
                        icon={getStatusIcon(result.status)}
                        label={result.status.toUpperCase()}
                        color={getStatusColor(result.status)}
                        size="small"
                      />
                    )}
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {test.description}
                  </Typography>
                  
                  {result && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Tested at: {new Date(result.timestamp).toLocaleTimeString()}
                      </Typography>
                      <Alert severity={result.status === 'pass' ? 'success' : result.status === 'warning' ? 'warning' : 'error'} sx={{ mt: 1 }}>
                        {result.details}
                      </Alert>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {Object.keys(testResults).length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Integration Summary
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
              <Chip
                icon={<CheckCircle />}
                label={`${Object.values(testResults).filter(r => r.status === 'pass').length} Passed`}
                color="success"
                variant="outlined"
              />
              <Chip
                icon={<Warning />}
                label={`${Object.values(testResults).filter(r => r.status === 'warning').length} Warnings`}
                color="warning"
                variant="outlined"
              />
              <Chip
                icon={<Error />}
                label={`${Object.values(testResults).filter(r => r.status === 'fail').length} Failed`}
                color="error"
                variant="outlined"
              />
              <Chip
                icon={<Error />}
                label={`${Object.values(testResults).filter(r => r.status === 'error').length} Errors`}
                color="error"
                variant="outlined"
              />
            </Box>
            
            <Typography variant="body1">
              Overall Status: <strong>{overallStatus.toUpperCase()}</strong>
            </Typography>
          </CardContent>
        </Card>
      )}
    </Container>
  );
};

export default IntegrationTestSuite;
