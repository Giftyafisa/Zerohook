import React, { useEffect } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate
} from 'react-router-dom';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, Box, useMediaQuery, useTheme } from '@mui/material';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import theme from './theme/theme';
import store from './store/store';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';

// Layout Components
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/FooterNew';
import MainLayout from './components/layout/MainLayout';

// UI Components
import { AnimatedBackground, ToastProvider } from './components/ui';

// Page Components
import HomePage from './pages/HomePageNew';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import SubscriptionPage from './pages/SubscriptionPage';
import SubscriptionSuccessPage from './pages/SubscriptionSuccessPage';
import SubscriptionErrorPage from './pages/SubscriptionErrorPage';
import DashboardPage from './pages/DashboardPage';
import CreateServicePage from './pages/CreateServicePage';
import AdultServiceCreate from './pages/AdultServiceCreate';
import ProfilePage from './pages/ProfilePage';
import VerificationPage from './pages/VerificationPage';
import TransactionsPage from './pages/TransactionsPage';
import TrustScorePage from './pages/TrustScorePage';
import AdultServiceBrowse from './pages/AdultServiceBrowse';
import AdultServiceDetail from './pages/AdultServiceDetail';
import ProfileBrowse from './pages/ProfileBrowse';
import ProfileDetailPage from './pages/ProfileDetailPage';
import MessagesPage from './pages/MessagesPage';
import PrivacySettings from './pages/PrivacySettings';
import BookingsPage from './pages/BookingsPage';
import WalletPage from './pages/WalletPage';
import HelpSupportPage from './pages/HelpSupportPage';

// Protected Route Component
import ProtectedRoute from './components/auth/ProtectedRoute';

// Error Boundary Component
import ErrorBoundary from './components/ErrorBoundary';

// Global Styles
import './styles/global.css';

// Global Call System
import CallSystem from './components/CallSystem';

function App() {
  // Global error handler for unhandled errors
  useEffect(() => {
    const handleGlobalError = (event) => {
      console.error('🚨 Global error caught:', event.error);
      // Log to external service in production
      if (process.env.NODE_ENV === 'production') {
        console.error('Production global error:', {
          message: event.error?.message,
          stack: event.error?.stack,
          timestamp: new Date().toISOString(),
          url: window.location.href
        });
      }
    };

    const handleUnhandledRejection = (event) => {
      console.error('🚨 Unhandled promise rejection:', event.reason);
      // Log to external service in production
      if (process.env.NODE_ENV === 'production') {
        console.error('Production unhandled rejection:', {
          reason: event.reason,
          timestamp: new Date().toISOString(),
          url: window.location.href
        });
      }
    };

    // Performance monitoring
    const handlePerformanceMetrics = () => {
      if ('performance' in window) {
        const navigation = performance.getEntriesByType('navigation')[0];
        if (navigation) {
          console.log('📊 Performance Metrics:', {
            pageLoadTime: navigation.loadEventEnd - navigation.loadEventStart,
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime,
            firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime
          });
        }
      }
    };

    // Monitor long tasks (development only, high threshold)
    if ('PerformanceObserver' in window && process.env.NODE_ENV === 'development') {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.duration > 500) { // Only log tasks longer than 500ms (very long tasks)
            console.warn('⚠️ Long task detected:', {
              duration: entry.duration,
              startTime: entry.startTime,
              name: entry.name
            });
          }
        });
      });
      observer.observe({ entryTypes: ['longtask'] });
    }

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('load', handlePerformanceMetrics);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('load', handlePerformanceMetrics);
    };
  }, []);

  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ToastProvider>
          <AuthProvider>
            <SocketProvider>
              <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AppContent />
              </Router>
            </SocketProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </Provider>
  );
}

// Separate component to access hooks within Router context
function AppContent() {
  const muiTheme = useTheme();
  const isDesktop = useMediaQuery(muiTheme.breakpoints.up('lg')); // >= 1200px
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md')); // < 900px
  const isTablet = !isDesktop && !isMobile;
  
  return (
    <MainLayout showNavigation={true}>
      <Box className="App" sx={{ position: 'relative', minHeight: '100vh' }}>
        {/* Animated Background */}
        <AnimatedBackground />
        
        {/* Top Navigation - Only for tablet/mobile when not using sidebar */}
        {!isDesktop && <Navbar />}
        
        {/* Main Content */}
        <main 
          className="main-content" 
          style={{ 
            position: 'relative', 
            zIndex: 1,
            paddingTop: isDesktop ? '0' : '80px', // No padding when using sidebar
          }}
        >
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={
              <ErrorBoundary>
                <HomePage />
              </ErrorBoundary>
            } />
            <Route path="/login" element={
              <ErrorBoundary>
                <LoginPage />
              </ErrorBoundary>
            } />
            <Route path="/register" element={
              <ErrorBoundary>
                <RegisterPage />
              </ErrorBoundary>
            } />
            <Route path="/subscription" element={
              <ErrorBoundary>
                <SubscriptionPage />
              </ErrorBoundary>
            } />
            <Route path="/subscription/success" element={
              <ErrorBoundary>
                <SubscriptionSuccessPage />
              </ErrorBoundary>
            } />
            <Route path="/subscription/error" element={
              <ErrorBoundary>
                <SubscriptionErrorPage />
              </ErrorBoundary>
            } />
                    
                    {/* Browse Routes - Available to All */}
                    <Route path="/adult-services" element={
                      <ErrorBoundary>
                        <AdultServiceBrowse />
                      </ErrorBoundary>
                    } />
                    <Route path="/adult-services/:id" element={
                      <ErrorBoundary>
                        <AdultServiceDetail />
                      </ErrorBoundary>
                    } />
                    <Route path="/profiles" element={
                      <ErrorBoundary>
                        <ProfileBrowse />
                      </ErrorBoundary>
                    } />
                    <Route path="/profile/:profileId" element={
                      <ErrorBoundary>
                        <ProfileDetailPage />
                      </ErrorBoundary>
                    } />
                    
                    {/* Protected Routes */}
                    <Route path="/dashboard" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <DashboardPage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/profile" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <ProfilePage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/verification" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <VerificationPage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    
                    {/* Subscription Required Routes */}
                    <Route path="/create-service" element={
                      <ProtectedRoute requireSubscription={true}>
                        <ErrorBoundary>
                          <CreateServicePage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/adult-services/create" element={
                      <ProtectedRoute requireSubscription={true}>
                        <ErrorBoundary>
                          <AdultServiceCreate />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/transactions" element={
                      <ProtectedRoute requireSubscription={true}>
                        <ErrorBoundary>
                          <TransactionsPage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/trust-score" element={
                      <ProtectedRoute requireSubscription={true}>
                        <ErrorBoundary>
                          <TrustScorePage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    
                    {/* Chat/Messages Routes */}
                    <Route path="/chat" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <MessagesPage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/messages" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <MessagesPage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    
                    {/* Settings Routes */}
                    <Route path="/settings" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <PrivacySettings />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/privacy-settings" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <PrivacySettings />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    
                    {/* Bookings Route */}
                    <Route path="/bookings" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <BookingsPage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    
                    {/* Wallet Route */}
                    <Route path="/wallet" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <WalletPage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    
                    {/* Help & Support Route */}
                    <Route path="/help" element={
                      <ErrorBoundary>
                        <HelpSupportPage />
                      </ErrorBoundary>
                    } />
                    <Route path="/support" element={
                      <ErrorBoundary>
                        <HelpSupportPage />
                      </ErrorBoundary>
                    } />
                    
                    {/* Redirects for Legacy Routes */}
                    <Route path="/services" element={<Navigate to="/adult-services" replace />} />
                    <Route path="/services/:id" element={<Navigate to="/adult-services" replace />} />
                    
                    {/* Catch All - Redirect to Home */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
                
                {/* Footer - Only show on desktop or when not using bottom nav */}
                {isDesktop && <Footer />}
                
                {/* Global Call System */}
                <CallSystem />
                
                {/* Toast Notifications */}
                <ToastContainer
                  position="bottom-right"
                  autoClose={5000}
                  hideProgressBar={false}
                  newestOnTop={false}
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover
                  theme="colored"
                />
              </Box>
            </MainLayout>
          );
        }

export default App;