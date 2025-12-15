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
      // User-friendly fallback UI with clear CTAs
      // Production: Clean, reassuring message without technical details
      // Development: Additional debug information
      const isProduction = process.env.NODE_ENV === 'production';
      
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
              Oops! Something went wrong
            </Typography>
            
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2, maxWidth: 600 }}>
              We're sorry for the inconvenience. The page didn't load correctly, but don't worry — your data is safe.
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, maxWidth: 600 }}>
              Please try one of the options below, or come back in a few minutes if the problem persists.
              {this.state.errorId && !isProduction && (
                <Box component="span" display="block" mt={1} sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  Reference: {this.state.errorId}
                </Box>
              )}
            </Typography>

            {/* Only show technical details in development */}
            {!isProduction && (
              <Alert severity="error" sx={{ mb: 4, maxWidth: 600, textAlign: 'left' }}>
                <Typography variant="body2" component="div">
                  <strong>Error Details (Dev Only):</strong>
                  <Box component="pre" sx={{ mt: 1, fontSize: '0.8rem', overflow: 'auto' }}>
                    {this.state.error?.message || 'Unknown error occurred'}
                  </Box>
                  {this.state.errorInfo && (
                    <Box component="pre" sx={{ mt: 1, fontSize: '0.7rem', overflow: 'auto', maxHeight: 200 }}>
                      {this.state.errorInfo.componentStack}
                    </Box>
                  )}
                </Typography>
              </Alert>
            )}

            <Box display="flex" gap={2} flexWrap="wrap" justifyContent="center">
              <Button
                variant="contained"
                color="primary"
                startIcon={<Refresh />}
                onClick={this.handleRetry}
                size="large"
                sx={{ minWidth: 140 }}
              >
                Try Again
              </Button>
              
              <Button
                variant="contained"
                color="secondary"
                startIcon={<Home />}
                onClick={this.handleGoHome}
                size="large"
                sx={{ minWidth: 140 }}
              >
                Go to Home
              </Button>
              
              <Button
                variant="outlined"
                onClick={this.handleReload}
                size="large"
                sx={{ minWidth: 140 }}
              >
                Refresh Page
              </Button>
            </Box>
            
            <Typography variant="caption" color="text.disabled" sx={{ mt: 4 }}>
              If this keeps happening, please contact support.
            </Typography>

            {/* Full debug panel only in development */}
            {!isProduction && (
              <Box mt={4} p={2} border={1} borderColor="divider" borderRadius={1} maxWidth="800px" width="100%">
                <Typography variant="h6" gutterBottom>
                  🔧 Development Debug Info
                </Typography>
                <Typography variant="body2" component="pre" sx={{ fontSize: '0.7rem', overflow: 'auto', textAlign: 'left' }}>
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
