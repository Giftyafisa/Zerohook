/**
 * Route Utilities - Centralized route detection and layout configuration
 * Single source of truth for route-based layout decisions
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
 * These routes have complex UIs or time-sensitive interactions
 */
export const PERFORMANCE_SENSITIVE_ROUTES = ['/chat', '/messages', '/inbox', '/booking'];

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
 * Get layout configuration for a given route
 * Centralizes all route-based layout decisions
 * 
 * @param {string} pathname - Current route pathname
 * @param {boolean} isDesktop - Whether user is on desktop breakpoint
 * @returns {Object} Layout configuration object
 */
export const getRouteLayoutConfig = (pathname, isDesktop) => {
  const chatRoute = isChatRoute(pathname);
  const performanceSensitive = isPerformanceSensitiveRoute(pathname);
  const callEligible = isCallEligibleRoute(pathname);
  
  return {
    // Hide footer on chat routes to give full height
    showFooter: isDesktop && !chatRoute,
    // Disable/simplify animated background on performance routes or mobile
    showAnimatedBackground: !performanceSensitive,
    // Only mount CallSystem on eligible routes
    mountCallSystem: callEligible,
    // Chat routes need full-height layout
    fullHeightLayout: chatRoute,
    // Toast position based on device
    toastPosition: isDesktop ? 'bottom-right' : 'top-center',
  };
};

export default {
  CHAT_ROUTE_PREFIXES,
  CALL_ELIGIBLE_ROUTES,
  PERFORMANCE_SENSITIVE_ROUTES,
  isChatRoute,
  isCallEligibleRoute,
  isPerformanceSensitiveRoute,
  getRouteLayoutConfig,
};
