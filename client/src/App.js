import React, { useEffect, lazy, Suspense } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate,
  useLocation,
  useParams
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
import Footer from './components/layout/FooterNew';
import MainLayout from './components/layout/MainLayout';

// Route utilities - Single source of truth for route-based layout decisions
import { getRouteLayoutConfig } from './utils/routeUtils';

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
// TransactionsPage removed - route redirects to /wallet (MyMoneyPage)
import TrustScorePage from './pages/TrustScorePage';
import AdultServiceBrowse from './pages/AdultServiceBrowse';
import AdultServiceDetail from './pages/AdultServiceDetail';
import ProfileFeed from './pages/ProfileFeed';
import ProfileDetailPage from './pages/ProfileDetailPage';
import MessagesPage from './pages/MessagesPage';
import PrivacySettings from './pages/PrivacySettingsNew';
import BookingsPage from './pages/BookingsPage';
import BookingDetails from './pages/BookingDetails';
// WalletPage removed - using MyMoneyPage instead for consistency
import MyMoneyPage from './pages/MyMoneyPage';
import HelpSupportPage from './pages/HelpSupportPage';
import NotificationsPage from './pages/NotificationsPage';
import SugarProfilesPage from './pages/SugarProfilesPage';

// Protected Route Component
import ProtectedRoute from './components/auth/ProtectedRoute';

// Error Boundary Component
import ErrorBoundary from './components/ErrorBoundary';

// Global Styles
import './styles/global.css';

// Error Reporter Service
import { reportError, reportWarning } from './services/errorReporter';

// Global Call System - Lazy loaded to reduce bundle size on non-chat routes
const CallSystem = lazy(() => import('./components/CallSystem'));

// Legacy route redirect component to preserve route params, query string, AND hash
const LegacyServiceRedirect = () => {
  const { id } = useParams();
  const location = useLocation();
  // Preserve query parameters AND hash fragment when redirecting
  const targetUrl = `/adult-services/${id}${location.search}${location.hash}`;
  return <Navigate to={targetUrl} replace />;
};

function App() {
  // Global error handler for unhandled errors
  useEffect(() => {
    const handleGlobalError = (event) => {
      // Filter benign errors that don't need logging
      const benignErrors = ['ResizeObserver loop', 'Script error'];
      if (benignErrors.some(msg => event.error?.message?.includes(msg))) {
        return;
      }
      
      // Use centralized error reporter
      reportError(event.error || event.message, {
        type: 'global_error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const handleUnhandledRejection = (event) => {
      // Filter benign rejections that are expected during normal operation
      const reason = event.reason;
      const benignRejections = ['AbortError', 'cancelled', 'Request aborted'];
      
      // Check if this is a benign rejection we should ignore
      const isBenign = benignRejections.some(msg => 
        reason?.name === msg || 
        reason?.message?.includes(msg) ||
        String(reason).includes(msg)
      );
      
      if (isBenign) {
        // Silently ignore abort/cancel errors - these are expected
        return;
      }
      
      // Use centralized error reporter
      reportError(reason, {
        type: 'unhandled_rejection',
      });
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
              {/* 
                  React Router v7 future flags:
                  - v7_startTransition: Uses React.startTransition for state updates (smoother navigation)
                  - v7_relativeSplatPath: Changes how relative paths work in splat routes
                  Requires react-router-dom >= 6.4. If upgrading causes issues, these can be removed.
                  Docs: https://reactrouter.com/en/main/upgrading/future
                */}
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
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const location = useLocation();
  
  // Get all layout configuration from centralized utility (single source of truth)
  const layoutConfig = getRouteLayoutConfig(location.pathname, isDesktop, prefersReducedMotion);
  const { 
    showFooter, 
    showAnimatedBackground, 
    mountCallSystem, 
    isChatRoute: chatRoute,
    toastPosition,
    toastDuration 
  } = layoutConfig;
  
  return (
    <MainLayout showNavigation={true}>
      <Box className="App" sx={{ position: 'relative', minHeight: '100vh' }}>
        {/* Animated Background - Disabled on performance-sensitive routes, mobile, and reduced-motion */}
        {showAnimatedBackground && <AnimatedBackground />}
        
        {/* Navigation is handled by MainLayout (Sidebar on desktop, BottomNav on mobile) */}
        {/* Removed duplicate Navbar here - MainLayout is the single navigation authority */}
        
        {/* Main Content */}
        <main 
          className="main-content" 
          style={{ 
            position: 'relative', 
            zIndex: 1,
            // Padding handled by CSS media queries in global.css
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
                        <ProfileFeed />
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
                    <Route path="/transactions" element={<Navigate to="/wallet?tab=transactions" replace />} />
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
                    <Route path="/messages" element={<Navigate to="/chat" replace />} />
                    
                    {/* Notifications Route */}
                    <Route path="/notifications" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <NotificationsPage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    
                    {/* Settings Routes - /settings is canonical, /privacy-settings redirects */}
                    <Route path="/settings" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <PrivacySettings />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/privacy-settings" element={<Navigate to="/settings" replace />} />
                    
                    {/* Bookings Route */}
                    <Route path="/bookings" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <BookingsPage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/bookings/:id" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <BookingDetails />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    
                    {/* Wallet / My Money Route - Unified payment page */}
                    <Route path="/wallet" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <MyMoneyPage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    
                    {/* Sugar Profiles Route - For providers to view VVIP members */}
                    <Route path="/sugar-profiles" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <SugarProfilesPage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    <Route path="/sugar-access/callback" element={
                      <ProtectedRoute requireSubscription={false}>
                        <ErrorBoundary>
                          <SugarProfilesPage />
                        </ErrorBoundary>
                      </ProtectedRoute>
                    } />
                    
                    {/* Help & Support Route - /help is canonical */}
                    <Route path="/help" element={
                      <ErrorBoundary>
                        <HelpSupportPage />
                      </ErrorBoundary>
                    } />
                    <Route path="/support" element={<Navigate to="/help" replace />} />
                    
                    {/* Redirects for Legacy Routes */}
                    <Route path="/services" element={<Navigate to="/adult-services" replace />} />
                    <Route path="/services/:id" element={<LegacyServiceRedirect />} />
                    
                    {/* Catch All - Redirect to Home */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </main>
                
                {/* Footer - Hide on chat routes to give chat full height */}
                {showFooter && <Footer />}
                
                {/* Global Call System - Only mounted on call-eligible routes to reduce socket overhead */}
                {mountCallSystem && (
                  <Suspense fallback={null}>
                    <CallSystem />
                  </Suspense>
                )}
                
                {/* Toast Notifications - Position and duration adjust for mobile */}
                <ToastContainer
                  position={toastPosition}
                  autoClose={toastDuration}
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