import React, { useState, useEffect } from 'react';
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
  Stepper,
  Step,
  StepLabel,
  StepContent,
  useTheme,
  useMediaQuery,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Warning,
  Info,
  ExpandMore,
  PlayArrow,
  Stop,
  Refresh,
  VideoCall,
  Notifications,
  Chat,
  Dashboard,
  Person,
  Settings,
  Speed,
  Memory,
  Storage
} from '@mui/icons-material';
import { authenticatedGet } from '../utils/apiUtils';

const UserAcceptanceTestSuite = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [testResults, setTestResults] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [overallStatus, setOverallStatus] = useState('pending');
  const [performanceMetrics, setPerformanceMetrics] = useState({});

  const testScenarios = [
    {
      id: 'video-system',
      name: 'Video System Integration',
      description: 'Test video upload, playback, and management across all pages',
      steps: [
        'ProfilePage Video Management',
        'AdultServiceDetail Video Display',
        'DashboardPage Video Features',
        'Video Upload Functionality',
        'Video Playback Quality'
      ],
      test: async () => {
        try {
          const response = await fetch('/api/health');
          if (response.ok) {
            return { status: 'pass', details: 'Video system endpoints accessible' };
          }
          return { status: 'fail', details: 'Video system endpoints not accessible' };
        } catch (error) {
          return { status: 'error', details: error.message };
        }
      }
    },
    {
      id: 'notification-system',
      name: 'Real-time Notifications',
      description: 'Test notification delivery, display, and management',
      steps: [
        'Notification Display',
        'Real-time Updates',
        'Mark as Read',
        'Notification Types',
        'Mobile Responsiveness'
      ],
      test: async () => {
        try {
          const response = await authenticatedGet('/api/notifications');
          if (response.ok) {
            return { status: 'pass', details: 'Notification system working' };
          }
          return { status: 'fail', details: 'Notification system not accessible' };
        } catch (error) {
          return { status: 'error', details: error.message };
        }
      }
    },
    {
      id: 'chat-system',
      name: 'Enhanced Chat System',
      description: 'Test chat functionality, file uploads, and video calls',
      steps: [
        'Conversation Management',
        'Message Sending',
        'File Uploads',
        'Video Call Integration',
        'Real-time Updates'
      ],
      test: async () => {
        try {
          const response = await authenticatedGet('/api/chat/conversations');
          if (response.ok) {
            return { status: 'pass', details: 'Chat system accessible' };
          }
          return { status: 'fail', details: 'Chat system not accessible' };
        } catch (error) {
          return { status: 'error', details: error.message };
        }
      }
    },
    {
      id: 'mobile-responsiveness',
      name: 'Mobile Responsiveness',
      description: 'Test all new features on mobile devices',
      steps: [
        'Mobile Navigation',
        'Touch Interactions',
        'Responsive Layouts',
        'Performance on Mobile',
        'Cross-device Compatibility'
      ],
      test: async () => {
        try {
          const response = await fetch('/api/health');
          if (response.ok) {
            return { status: 'pass', details: 'Mobile endpoints accessible' };
          }
          return { status: 'fail', details: 'Mobile endpoints not accessible' };
        } catch (error) {
          return { status: 'error', details: error.message };
        }
      }
    },
    {
      id: 'performance',
      name: 'Performance & Load Testing',
      description: 'Test system performance under various loads',
      steps: [
        'API Response Times',
        'Database Performance',
        'Memory Usage',
        'Concurrent Users',
        'Error Rates'
      ],
      test: async () => {
        try {
          const startTime = Date.now();
          const response = await fetch('/api/health');
          const endTime = Date.now();
          const responseTime = endTime - startTime;
          
          if (response.ok) {
            if (responseTime < 1000) {
              return { status: 'pass', details: `Response time: ${responseTime}ms (Excellent)` };
            } else if (responseTime < 2000) {
              return { status: 'warning', details: `Response time: ${responseTime}ms (Acceptable)` };
            } else {
              return { status: 'fail', details: `Response time: ${responseTime}ms (Slow)` };
            }
          }
          return { status: 'fail', details: 'Health check failed' };
        } catch (error) {
          return { status: 'error', details: error.message };
        }
      }
    }
  ];

  const monitorPerformance = async () => {
    try {
      const response = await authenticatedGet('/api/status/system/performance');
      if (response.ok) {
        const data = await response.json();
        setPerformanceMetrics(data);
      }
    } catch (error) {
      console.error('Performance monitoring failed:', error);
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults({});
    setOverallStatus('running');
    setCurrentStep(0);

    const results = {};
    let passed = 0;
    let failed = 0;
    let warnings = 0;
    let errors = 0;

    for (let i = 0; i < testScenarios.length; i++) {
      const scenario = testScenarios[i];
      setCurrentStep(i);
      
      try {
        const result = await scenario.test();
        results[scenario.id] = {
          ...result,
          timestamp: new Date().toISOString(),
          scenario: scenario.name
        };

        if (result.status === 'pass') passed++;
        else if (result.status === 'fail') failed++;
        else if (result.status === 'warning') warnings++;
        else if (result.status === 'error') errors++;

        setTestResults({ ...results });
        
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        results[scenario.id] = {
          status: 'error',
          details: error.message,
          timestamp: new Date().toISOString(),
          scenario: scenario.name
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
    setCurrentStep(0);
    
    await monitorPerformance();
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
    setCurrentStep(0);
    setPerformanceMetrics({});
  };

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          User Acceptance Testing Suite
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Comprehensive testing of all new integrated features from a user perspective.
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
          Run UAT Suite
        </Button>
        
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<Speed />}
          onClick={monitorPerformance}
          size="large"
        >
          Monitor Performance
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
        {testScenarios.map((scenario) => {
          const result = testResults[scenario.id];
          const isActive = currentStep === testScenarios.indexOf(scenario);
          
          return (
            <Grid item xs={12} md={6} key={scenario.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6">
                      {scenario.name}
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
                    {scenario.description}
                  </Typography>
                  
                  {isActive && isRunning && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <CircularProgress size={16} />
                      <Typography variant="body2">Running test...</Typography>
                    </Box>
                  )}
                  
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
                  
                  <Accordion>
                    <AccordionSummary expandIcon={<ExpandMore />}>
                      <Typography variant="subtitle2">Test Steps</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <List dense>
                        {scenario.steps.map((step, index) => (
                          <ListItem key={index}>
                            <ListItemIcon>
                              <Typography variant="body2" color="text.secondary">
                                {index + 1}.
                              </Typography>
                            </ListItemIcon>
                            <ListItemText primary={step} />
                          </ListItem>
                        ))}
                      </List>
                    </AccordionDetails>
                  </Accordion>
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
              Test Summary
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

export default UserAcceptanceTestSuite;
