/**
 * Route Utilities - Centralized route detection and layout configuration
 * Single source of truth for route-based layout decisions
 * 
 * This module is the SINGLE SOURCE OF TRUTH for:
 * - Which routes use chat/communication layout
 * - Which routes can initiate/receive calls
 * - Which routes need performance optimization
 * - Which routes require full-height layout
 * 
 * When adding new routes, update the appropriate constant arrays.
 * 
 * @module utils/routeUtils
 */

/**
 * Route prefixes that use chat/communication layout (full-height, no footer)
 * Extend this array when adding new chat-related routes
 */
export const CHAT_ROUTE_PREFIXES = ['/chat', '/messages', '/inbox'];

/**
 * Route prefixes where calls can be initiated/received
 * CallSystem should only mount on these routes to avoid socket overhead
 */
export const CALL_ELIGIBLE_ROUTES = ['/chat', '/messages', '/inbox', '/profile/', '/dashboard'];

/**
 * Performance-sensitive routes where AnimatedBackground should be simplified/disabled
 * These routes have complex UIs, heavy lists, or time-sensitive interactions
 * Updated to include: profile listings, services, wallet, bookings
 */
export const PERFORMANCE_SENSITIVE_ROUTES = [
  '/chat', '/messages', '/inbox', // Communication routes
  '/booking', '/bookings',          // Booking routes  
  '/profiles', '/profile/',         // Profile listings and detail
  '/adult-services',                // Service listings
  '/wallet', '/transactions',       // Financial pages
  '/dashboard'                      // Dashboard with multiple widgets
];

/**
 * Routes requiring full-height layout (100vh, flex-based)
 * These should work independently of footer visibility
 */
export const FULL_HEIGHT_ROUTES = ['/chat', '/messages', '/inbox', '/booking'];

/**
 * Check if pathname matches a chat/messaging route
 * Used for layout decisions (hide footer, full-height container)
 * 
 * @param {string} pathname - Current route pathname
 * @returns {boolean} True if route is a chat route
 */
export const isChatRoute = (pathname) => {
  return CHAT_ROUTE_PREFIXES.some(prefix => pathname.startsWith(prefix));
};

/**
 * Check if CallSystem should be active on this route
 * Prevents unnecessary socket connections on routes where calls can't occur
 * 
 * @param {string} pathname - Current route pathname
 * @returns {boolean} True if calls are eligible on this route
 */
export const isCallEligibleRoute = (pathname) => {
  return CALL_ELIGIBLE_ROUTES.some(prefix => pathname.startsWith(prefix));
};

/**
 * Check if route is performance-sensitive (disable heavy animations)
 * 
 * @param {string} pathname - Current route pathname
 * @returns {boolean} True if route needs optimized rendering
 */
export const isPerformanceSensitiveRoute = (pathname) => {
  return PERFORMANCE_SENSITIVE_ROUTES.some(prefix => pathname.startsWith(prefix));
};

/**
 * Check if route requires full-height flex layout (independent of footer)
 * These routes use minHeight: 100vh and flex for layout, not relying on footer absence
 * 
 * @param {string} pathname - Current route pathname
 * @returns {boolean} True if route needs full-height layout
 */
export const isFullHeightRoute = (pathname) => {
  return FULL_HEIGHT_ROUTES.some(prefix => pathname.startsWith(prefix));
};

/**
 * Get layout configuration for a given route
 * Centralizes all route-based layout decisions
 * 
 * @param {string} pathname - Current route pathname
 * @param {boolean} isDesktop - Whether user is on desktop breakpoint
 * @returns {Object} Layout configuration object
 */
export const getRouteLayoutConfig = (pathname, isDesktop, prefersReducedMotion = false) => {
  const chatRoute = isChatRoute(pathname);
  const performanceSensitive = isPerformanceSensitiveRoute(pathname);
  const callEligible = isCallEligibleRoute(pathname);
  const fullHeight = isFullHeightRoute(pathname);
  
  return {
    // Hide footer on chat routes to give full height
    showFooter: isDesktop && !chatRoute,
    // Disable animated background on: performance routes, mobile, or reduced motion preference
    showAnimatedBackground: isDesktop && !performanceSensitive && !prefersReducedMotion,
    // Only mount CallSystem on eligible routes
    mountCallSystem: callEligible,
    // Full-height flex layout (independent of footer)
    fullHeightLayout: fullHeight,
    // Chat route flag for specific chat layout adjustments
    isChatRoute: chatRoute,
    // Toast position: bottom-right on desktop, bottom-center on mobile (avoids header)
    // Bottom-center allows for safe-area padding on notched devices
    toastPosition: isDesktop ? 'bottom-right' : 'bottom-center',
    // Shorter toast duration on mobile for less obstruction
    toastDuration: isDesktop ? 5000 : 3000,
  };
};

export default {
  CHAT_ROUTE_PREFIXES,
  CALL_ELIGIBLE_ROUTES,
  PERFORMANCE_SENSITIVE_ROUTES,
  FULL_HEIGHT_ROUTES,
  isChatRoute,
  isCallEligibleRoute,
  isPerformanceSensitiveRoute,
  isFullHeightRoute,
  getRouteLayoutConfig,
};
