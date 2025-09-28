import React from 'react';
import { Box, Typography, Button, Alert, Container } from '@mui/material';
import { Error, Refresh, Home } from '@mui/icons-material';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { 
      hasError: true, 
      error,
      errorId: Date.now()
    };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console for debugging
    console.error('🚨 ErrorBoundary caught an error:', error, errorInfo);
    
    // Update state with error info
    this.setState({
      errorInfo,
      errorId: Date.now()
    });

    // In production, you could log this to an error reporting service
    if (process.env.NODE_ENV === 'production') {
      // Log to external service (e.g., Sentry, LogRocket)
      console.error('Production error:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        errorId: this.state.errorId,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent
      });
    }
  }

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      errorId: null 
    });
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <Container maxWidth="md" sx={{ py: 8 }}>
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            textAlign="center"
            minHeight="60vh"
          >
            <Error sx={{ fontSize: 80, color: 'error.main', mb: 3 }} />
            
            <Typography variant="h4" color="error" gutterBottom>
              Something went wrong
            </Typography>
            
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4, maxWidth: 600 }}>
              We encountered an unexpected error. This has been logged and our team will investigate.
              {this.state.errorId && (
                <Box component="span" display="block" mt={1}>
                  Error ID: {this.state.errorId}
                </Box>
              )}
            </Typography>

            <Alert severity="error" sx={{ mb: 4, maxWidth: 600, textAlign: 'left' }}>
              <Typography variant="body2" component="div">
                <strong>Error Details:</strong>
                <Box component="pre" sx={{ mt: 1, fontSize: '0.8rem', overflow: 'auto' }}>
                  {this.state.error?.message || 'Unknown error occurred'}
                </Box>
                {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                  <Box component="pre" sx={{ mt: 1, fontSize: '0.7rem', overflow: 'auto' }}>
                    {this.state.errorInfo.componentStack}
                  </Box>
                )}
              </Typography>
            </Alert>

            <Box display="flex" gap={2} flexWrap="wrap" justifyContent="center">
              <Button
                variant="contained"
                startIcon={<Refresh />}
                onClick={this.handleRetry}
                size="large"
              >
                Try Again
              </Button>
              
              <Button
                variant="outlined"
                startIcon={<Home />}
                onClick={this.handleGoHome}
                size="large"
              >
                Go Home
              </Button>
              
              <Button
                variant="outlined"
                onClick={this.handleReload}
                size="large"
              >
                Reload Page
              </Button>
            </Box>

            {process.env.NODE_ENV === 'development' && (
              <Box mt={4} p={2} border={1} borderColor="divider" borderRadius={1} maxWidth="800px">
                <Typography variant="h6" gutterBottom>
                  Development Debug Info
                </Typography>
                <Typography variant="body2" component="pre" sx={{ fontSize: '0.7rem', overflow: 'auto' }}>
                  {JSON.stringify({
                    error: this.state.error?.message,
                    stack: this.state.error?.stack,
                    componentStack: this.state.errorInfo?.componentStack,
                    errorId: this.state.errorId,
                    timestamp: new Date().toISOString(),
                    url: window.location.href
                  }, null, 2)}
                </Typography>
              </Box>
            )}
          </Box>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
