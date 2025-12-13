/**
 * Design Tokens - Centralized design system values
 * Zerohook Platform
 */

// Spacing Scale (in px)
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20, // Increased from 24 for better mobile spacing
  '2xl': 24, // Adjusted from 32
  '3xl': 32, // Adjusted from 48
  '4xl': 48, // Adjusted from 64
  '5xl': 64, // Added for larger spacing needs
};

// Layout-specific spacing
export const layout = {
  bottomNavHeight: 64, // Fixed height for bottom navigation
  topNavHeight: 56, // Fixed height for top navigation (mobile)
  topNavHeightDesktop: 64, // Top navigation height on desktop
  sidebarWidth: 280, // Desktop sidebar width
  contentPadding: 16, // Default content padding
  contentPaddingDesktop: 24, // Desktop content padding
};

// Typography Scale (in px)
export const fontSize = {
  xs: 12, // Increased from 11 for better readability
  sm: 14, // Increased from 13
  base: 16, // Increased from 15
  lg: 18,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
};

// Font Weights
export const fontWeight = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
};

// Border Radius Scale (in px)
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

// Colors - Primary Palette
export const colors = {
  primary: {
    main: '#00f2ea',
    light: '#33f4ed',
    dark: '#00c2bb',
    darker: '#00a3a0',
  },
  secondary: {
    main: '#ff0055',
    light: '#ff3377',
    dark: '#cc0044',
    darker: '#990033',
  },
  background: {
    primary: '#0f0f13',
    secondary: '#1a1a1f',
    tertiary: '#252529',
  },
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.8)', // Increased from 0.7 for better contrast
    tertiary: 'rgba(255, 255, 255, 0.6)', // Increased from 0.5 for WCAG compliance
    disabled: 'rgba(255, 255, 255, 0.4)', // Increased from 0.3 for better visibility
  },
  border: {
    primary: 'rgba(255, 255, 255, 0.08)',
    secondary: 'rgba(255, 255, 255, 0.12)',
    accent: 'rgba(0, 242, 234, 0.3)',
  },
  overlay: {
    light: 'rgba(255, 255, 255, 0.05)',
    medium: 'rgba(255, 255, 255, 0.08)',
    dark: 'rgba(0, 0, 0, 0.5)',
  },
  success: '#00ff88',
  warning: '#ffd700',
  error: '#ff0055',
  info: '#00aaff',
};

// Opacity values
export const opacity = {
  disabled: 0.3,
  secondary: 0.5,
  medium: 0.7,
  high: 0.9,
};

// Z-Index Scale
export const zIndex = {
  base: 1,
  dropdown: 1000,
  sticky: 1100,
  modal: 1200,
  popover: 1300,
  tooltip: 1400,
};

// Touch Target Sizes (minimum for accessibility)
// WCAG 2.5.5 Level AAA compliance
export const touchTarget = {
  min: 44, // WCAG 2.5.5 minimum (changed from 48 to match audit)
  recommended: 48, // WCAG AA recommended
  comfortable: 56,
};

// Transitions
export const transition = {
  fast: '0.15s ease',
  base: '0.2s ease',
  slow: '0.3s ease',
  slower: '0.5s ease',
};

// Shadows
export const shadows = {
  sm: '0 2px 4px rgba(0, 0, 0, 0.1)',
  md: '0 4px 8px rgba(0, 0, 0, 0.15)',
  lg: '0 8px 16px rgba(0, 0, 0, 0.2)',
  xl: '0 12px 24px rgba(0, 0, 0, 0.25)',
  glow: {
    primary: '0 0 20px rgba(0, 242, 234, 0.4)',
    secondary: '0 0 20px rgba(255, 0, 85, 0.4)',
  },
};

// Backdrop Blur
export const backdropBlur = {
  sm: 'blur(10px)',
  md: 'blur(20px)',
  lg: 'blur(30px)',
};

// Gradients
export const gradients = {
  primary: 'linear-gradient(135deg, #00f2ea, #00c2bb)',
  secondary: 'linear-gradient(135deg, #ff0055, #cc0044)',
  accent: 'linear-gradient(135deg, #00f2ea, #ff0055)',
  overlay: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)',
};

export default {
  spacing,
  fontSize,
  fontWeight,
  borderRadius,
  colors,
  opacity,
  zIndex,
  touchTarget,
  transition,
  shadows,
  backdropBlur,
  gradients,
};