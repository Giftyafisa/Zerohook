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
    secondary: '#a0a0b0',     // Medium gray for secondary text
    muted: '#666666',         // Muted gray
    inverse: '#0f0f13',       // Dark text for light backgrounds
    brand: '#00f2ea'          // Brand cyan for accent text
  },
  
  // Background Colors
  background: {
    primary: '#0f0f13',       // Deep dark background
    secondary: '#1a1a20',     // Dark charcoal for cards
    dark: '#0a0a0d',          // Darker background
    accent: '#00f2ea',        // Cyan accent background
    glass: 'rgba(255, 255, 255, 0.05)', // Glass effect
    overlay: 'rgba(0, 0, 0, 0.7)' // Semi-transparent overlay
  },
  
  // Border Colors
  border: {
    light: 'rgba(255, 255, 255, 0.1)',   // Glass border
    medium: 'rgba(255, 255, 255, 0.15)', // Glass highlight
    dark: 'rgba(255, 255, 255, 0.2)',    // Visible border
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