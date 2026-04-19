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
import { CallProvider } from './contexts/CallContext';

// Layout Components
import MainLayout from './components/layout/MainLayout';

// Route utilities - Single source of truth for route-based layout decisions
import { getRouteLayoutConfig } from './utils/routeUtils';

// UI Components
import { AnimatedBackground, ToastProvider } from './components/ui';

// Location Change Detector - Prompts users to update their location
import LocationChangeDetector from './components/LocationChangeDetector';

// Real-time Location Provider - Uber-style GPS streaming for providers
import RealtimeLocationProvider from './components/RealtimeLocationProvider';

// Protected Route Component
import ProtectedRoute from './components/auth/ProtectedRoute';

// Error Boundary Component
import ErrorBoundary from './components/ErrorBoundary';

// Global Styles
import './styles/global.css';

// Error Reporter Service
import { reportError } from './services/errorReporter';

// Page Components — lazy-loaded to reduce initial bundle size
const HomePage = lazy(() => import('./pages/HomePageNew'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const SubscriptionPage = lazy(() => import('./pages/SubscriptionPage'));
const SubscriptionSuccessPage = lazy(() => import('./pages/SubscriptionSuccessPage'));
const SubscriptionErrorPage = lazy(() => import('./pages/SubscriptionErrorPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CreateServicePage = lazy(() => import('./pages/CreateServicePage'));
const AdultServiceCreate = lazy(() => import('./pages/AdultServiceCreate'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const VerificationPage = lazy(() => import('./pages/VerificationPage'));
// Transactions and wallet surfaces share MyMoneyPage
const TrustScorePage = lazy(() => import('./pages/TrustScorePage'));
const AdultServiceBrowse = lazy(() => import('./pages/AdultServiceBrowse'));
const AdultServiceDetail = lazy(() => import('./pages/AdultServiceDetail'));
const ProfileFeed = lazy(() => import('./pages/ProfileFeed'));
const ProviderClientDiscoveryPage = lazy(() => import('./pages/ProviderClientDiscoveryPage'));
const ProfileDetailPage = lazy(() => import('./pages/ProfileDetailPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const PrivacySettings = lazy(() => import('./pages/PrivacySettingsNew'));
const BookingsPage = lazy(() => import('./pages/BookingsPage'));
const BookingDetails = lazy(() => import('./pages/BookingDetails'));
// WalletPage removed - using MyMoneyPage instead for consistency
const MyMoneyPage = lazy(() => import('./pages/MyMoneyPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const AdminSocketTraceDashboard = lazy(() => import('./pages/AdminSocketTraceDashboard'));
const HelpSupportPage = lazy(() => import('./pages/HelpSupportPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const SugarProfilesPage = lazy(() => import('./pages/SugarProfilesPage'));
// Info Pages (named exports → individual lazy wrappers)
const AboutPage = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.AboutPage })));
const PrivacyPage = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.PrivacyPage })));
const TermsPage = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.TermsPage })));
const TrustSafetyPage = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.TrustSafetyPage })));
const HowItWorksPage = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.HowItWorksPage })));
const ContactPage = lazy(() => import('./pages/InfoPages').then(m => ({ default: m.ContactPage })));

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

// Messages redirect — forwards location.state so recipient context isn't lost
const MessagesRedirect = () => {
  const location = useLocation();
  return <Navigate to={`/chat${location.search}`} state={location.state} replace />;
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
    let perfObserver;
    if ('PerformanceObserver' in window && process.env.NODE_ENV === 'development') {
      perfObserver = new PerformanceObserver((list) => {
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
      perfObserver.observe({ entryTypes: ['longtask'] });
    }

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('load', handlePerformanceMetrics);

    return () => {
      perfObserver?.disconnect();
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
              <CallProvider>
              {/* Real-time location streaming for providers (Uber-style) */}
              <RealtimeLocationProvider />
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
              </CallProvider>
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
    showAnimatedBackground, 
    mountCallSystem, 
    toastPosition,
    toastDuration 
  } = layoutConfig;
  
  return (
    <MainLayout showNavigation={true}>
      {/* Animated Background - Only on desktop, disabled on performance-sensitive routes and reduced-motion */}
      {showAnimatedBackground && isDesktop && <AnimatedBackground />}
      
      {/* Location Change Detector - Prompts users to update their profile location */}
      <LocationChangeDetector checkOnMount={true} thresholdKm={50} />
      
      {/* Main Content - Layout is fully handled by MainLayout (MobileShell or DesktopContainer) */}
      <Suspense fallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ width: 40, height: 40, margin: '0 auto', border: '3px solid rgba(255,255,255,0.2)', borderTopColor: '#e91e63', borderRadius: '50%', animation: 'spin 0.8s linear infinite', '@keyframes spin': { to: { transform: 'rotate(360deg)' } } }} />
          </Box>
        </Box>
      }>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<ErrorBoundary><HomePage /></ErrorBoundary>} />
        <Route path="/login" element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
        <Route path="/register" element={<ErrorBoundary><RegisterPage /></ErrorBoundary>} />
        <Route path="/subscription" element={<ErrorBoundary><SubscriptionPage /></ErrorBoundary>} />
        <Route path="/subscription/success" element={<ErrorBoundary><SubscriptionSuccessPage /></ErrorBoundary>} />
        <Route path="/subscription/error" element={<ErrorBoundary><SubscriptionErrorPage /></ErrorBoundary>} />
        
        {/* Browse Routes - Available to All */}
        <Route path="/adult-services" element={<ErrorBoundary><AdultServiceBrowse /></ErrorBoundary>} />
        <Route path="/adult-services/:id" element={<ErrorBoundary><AdultServiceDetail /></ErrorBoundary>} />
        <Route path="/profiles" element={<ErrorBoundary><ProfileFeed /></ErrorBoundary>} />
        <Route path="/clients-discovery" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><ProviderClientDiscoveryPage /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/profile/:profileId" element={<ErrorBoundary><ProfileDetailPage /></ErrorBoundary>} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><DashboardPage /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/profile" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><ProfilePage /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/verification" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><VerificationPage /></ErrorBoundary>
          </ProtectedRoute>
        } />
        
        {/* Subscription Required Routes */}
        <Route path="/create-service" element={
          <ProtectedRoute requireSubscription={true}>
            <ErrorBoundary><CreateServicePage /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/adult-services/create" element={
          <ProtectedRoute requireSubscription={true}>
            <ErrorBoundary><AdultServiceCreate /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/transactions" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><MyMoneyPage /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/trust-score" element={
          <ProtectedRoute requireSubscription={true}>
            <ErrorBoundary><TrustScorePage /></ErrorBoundary>
          </ProtectedRoute>
        } />
        
        {/* Chat/Messages Routes */}
        <Route path="/chat" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><MessagesPage /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/messages" element={<MessagesRedirect />} />
        
        {/* Notifications Route */}
        <Route path="/notifications" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><NotificationsPage /></ErrorBoundary>
          </ProtectedRoute>
        } />
        
        {/* Settings Routes - /settings is canonical, /privacy-settings redirects */}
        <Route path="/settings" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><PrivacySettings /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/privacy-settings" element={<Navigate to="/settings" replace />} />
        
        {/* Bookings Route */}
        <Route path="/bookings" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><BookingsPage /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/bookings/:id" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><BookingDetails /></ErrorBoundary>
          </ProtectedRoute>
        } />
        
        {/* Wallet / My Money Route - Unified payment page */}
        <Route path="/wallet" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><MyMoneyPage /></ErrorBoundary>
          </ProtectedRoute>
        } />
        
        {/* Admin Dashboard - Platform owner revenue, disputes, user management */}
        <Route path="/admin" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><AdminDashboard /></ErrorBoundary>
          </ProtectedRoute>
        } />

        {/* New Admin Panel - standalone, no backend access gate */}
        <Route path="/admin-panel" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><AdminPanel /></ErrorBoundary>
          </ProtectedRoute>
        } />

        <Route path="/admin/socket-trace" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><AdminSocketTraceDashboard /></ErrorBoundary>
          </ProtectedRoute>
        } />
        
        {/* Sugar Profiles Route - For eligible client/provider paid viewers */}
        <Route path="/sugar-profiles" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><SugarProfilesPage /></ErrorBoundary>
          </ProtectedRoute>
        } />
        <Route path="/sugar-access/callback" element={
          <ProtectedRoute requireSubscription={false}>
            <ErrorBoundary><SugarProfilesPage /></ErrorBoundary>
          </ProtectedRoute>
        } />
        
        {/* Help & Support Route - /help is canonical */}
        <Route path="/help" element={<ErrorBoundary><HelpSupportPage /></ErrorBoundary>} />
        <Route path="/support" element={<Navigate to="/help" replace />} />
        
        {/* Info Pages - Public routes */}
        <Route path="/about" element={<ErrorBoundary><AboutPage /></ErrorBoundary>} />
        <Route path="/privacy" element={<ErrorBoundary><PrivacyPage /></ErrorBoundary>} />
        <Route path="/terms" element={<ErrorBoundary><TermsPage /></ErrorBoundary>} />
        <Route path="/trust-safety" element={<ErrorBoundary><TrustSafetyPage /></ErrorBoundary>} />
        <Route path="/how-it-works" element={<ErrorBoundary><HowItWorksPage /></ErrorBoundary>} />
        <Route path="/contact" element={<ErrorBoundary><ContactPage /></ErrorBoundary>} />
        
        {/* Redirects for Legacy Routes */}
        <Route path="/services" element={<Navigate to="/adult-services" replace />} />
        <Route path="/services/:id" element={<ErrorBoundary><LegacyServiceRedirect /></ErrorBoundary>} />
        
        {/* Catch All - Redirect to Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      
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
        style={{ zIndex: 1600 }}
      />
    </MainLayout>
  );
}

export default App;