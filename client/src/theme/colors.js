// Zerohook Brand Colors - Neon Cyan, Pink, Dark Theme
export const colors = {
  // Primary Brand Colors (Zerohook Theme)
  primary: {
    cyan: '#00f2ea',          // Neon Cyan - Primary brand color
    pink: '#ff0055',          // Neon Pink - Secondary accent
    darkCyan: '#00b8b0',      // Dark cyan for hovers
    lightCyan: '#7fffd4',     // Light cyan for highlights
    white: '#FFFFFF',         // Pure white
    black: '#0f0f13',         // Deep dark background
    charcoal: '#1a1a20',      // Dark charcoal for cards
    gray: '#a0a0b0'           // Medium gray for secondary text
  },
  
  // Semantic Colors
  success: '#00f2ea',         // Cyan for success states
  warning: '#FFC107',         // Amber for warnings
  error: '#ff0055',           // Pink for errors
  info: '#00f2ea',            // Cyan for information
  
  // Text Colors
  text: {
    primary: '#FFFFFF',       // White for main text on dark bg
    secondary: 'rgba(255, 255, 255, 0.70)',  // Improved contrast (was 0.5)
    muted: 'rgba(255, 255, 255, 0.50)',      // Muted text
    disabled: 'rgba(255, 255, 255, 0.30)',   // Disabled state
    inverse: '#0f0f13',       // Dark text for light backgrounds
    brand: '#00f2ea'          // Brand cyan for accent text
  },
  
  // Background Colors
  background: {
    primary: '#0f0f13',       // Deep dark background
    secondary: '#1a1a20',     // Dark charcoal for cards
    tertiary: '#14141a',      // Between primary and secondary
    dark: '#0a0a0d',          // Darker background
    accent: '#00f2ea',        // Cyan accent background
    glass: 'rgba(255, 255, 255, 0.06)',      // Glass effect (standardized)
    glassHover: 'rgba(255, 255, 255, 0.10)', // Glass hover state
    overlay: 'rgba(0, 0, 0, 0.70)'           // Semi-transparent overlay
  },
  
  // Border Colors
  border: {
    subtle: 'rgba(255, 255, 255, 0.08)',     // Very subtle borders
    light: 'rgba(255, 255, 255, 0.12)',      // Light borders (standardized)
    medium: 'rgba(255, 255, 255, 0.20)',     // Medium borders
    strong: 'rgba(255, 255, 255, 0.30)',     // Strong borders
    brand: '#00f2ea'          // Brand cyan borders
  },
  
  // Status Colors (Trust/Verification)
  trust: {
    elite: '#00f2ea',         // Cyan for elite trust
    high: '#00f2ea',          // Cyan for high trust
    medium: '#ff0055',        // Pink for medium trust
    low: '#ff6b6b',           // Light red for low trust
    new: '#a0a0b0'            // Gray for new users
  },
  
  // Service Category Colors
  categories: {
    dgy: '#00f2ea',           // Primary cyan
    romans: '#ff0055',        // Neon pink
    ridin: '#7fffd4',         // Light cyan
    bb_suk: '#00b8b0'         // Dark cyan
  }
};

// Standardized Spacing Scale (from plan.md)
export const spacing = {
  xs: 4,    // 4px
  sm: 8,    // 8px
  md: 12,   // 12px
  lg: 16,   // 16px
  xl: 24,   // 24px
  '2xl': 32, // 32px
  '3xl': 48  // 48px
};

// Typography Scale (from plan.md)
export const typography = {
  fontSize: {
    xs: '11px',   // labels, badges
    sm: '13px',   // secondary text
    base: '15px', // body text
    lg: '18px',   // headings
    xl: '24px',   // page titles
    '2xl': '32px' // hero text
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.7
  }
};

// Border Radius Scale (from plan.md)
export const borderRadius = {
  sm: '8px',   // chips, badges
  md: '12px',  // buttons, inputs
  lg: '16px',  // cards
  xl: '24px',  // modals
  full: '9999px' // circular
};

// Touch Target Sizes (WCAG 2.5.5 - Level AAA compliant)
export const touchTargets = {
  minimum: 44,     // WCAG AA minimum
  comfortable: 48, // Recommended for all interactive elements
  icon: 48,        // Icon-only buttons
  large: 56        // Primary CTAs and tabs
};

// Define gradient functions for Zerohook theme
const createGradients = (colors) => ({
  hero: `linear-gradient(135deg, ${colors.primary.cyan} 0%, ${colors.primary.pink} 50%, ${colors.primary.black} 100%)`,
  cyanToPink: `linear-gradient(135deg, ${colors.primary.cyan} 0%, ${colors.primary.pink} 100%)`,
  cyanToBlack: `linear-gradient(135deg, ${colors.primary.cyan} 0%, ${colors.primary.black} 100%)`,
  pinkToBlack: `linear-gradient(135deg, ${colors.primary.pink} 0%, ${colors.primary.black} 100%)`,
  neonGradient: `linear-gradient(135deg, ${colors.primary.cyan} 0%, ${colors.primary.pink} 100%)`,
  trustGradient: `linear-gradient(135deg, ${colors.primary.cyan} 0%, ${colors.primary.darkCyan} 100%)`
});

// Export gradients after colors are fully defined
export const gradients = createGradients(colors);

// Box shadows with brand colors (Zerohook neon glow)
export const shadows = {
  light: '0 2px 4px rgba(0, 0, 0, 0.3)',
  medium: '0 4px 8px rgba(0, 0, 0, 0.4)',
  heavy: '0 8px 16px rgba(0, 0, 0, 0.5)',
  brand: `0 4px 12px rgba(0, 242, 234, 0.3)`,
  glow: `0 0 20px rgba(0, 242, 234, 0.5)`,
  pinkGlow: `0 0 20px rgba(255, 0, 85, 0.5)`
};