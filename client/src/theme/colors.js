// Hkup Brand Colors - Red, White, Black Theme
export const colors = {
  // Primary Brand Colors
  primary: {
    red: '#DC143C',           // Crimson Red - Primary brand color
    darkRed: '#B22222',       // Dark red for hovers and accents
    lightRed: '#FFB6C1',      // Light pink-red for backgrounds
    white: '#FFFFFF',         // Pure white
    black: '#000000',         // Pure black
    charcoal: '#1A1A1A',      // Near black for text
    gray: '#F8F8F8'           // Very light gray for backgrounds
  },
  
  // Semantic Colors
  success: '#28A745',         // Green for success states
  warning: '#FFC107',         // Amber for warnings
  error: '#DC3545',           // Red for errors (aligned with brand)
  info: '#17A2B8',            // Blue for information
  
  // Text Colors
  text: {
    primary: '#1A1A1A',       // Dark charcoal for main text
    secondary: '#666666',     // Medium gray for secondary text
    muted: '#999999',         // Light gray for muted text
    inverse: '#FFFFFF',       // White text for dark backgrounds
    brand: '#DC143C'          // Brand red for accent text
  },
  
  // Background Colors
  background: {
    primary: '#FFFFFF',       // White background
    secondary: '#F8F8F8',     // Light gray background
    dark: '#1A1A1A',          // Dark background for contrast
    accent: '#DC143C',        // Red accent background
    overlay: 'rgba(0, 0, 0, 0.5)' // Semi-transparent overlay
  },
  
  // Border Colors
  border: {
    light: '#E5E5E5',         // Light gray borders
    medium: '#CCCCCC',        // Medium gray borders
    dark: '#666666',          // Dark gray borders
    brand: '#DC143C'          // Brand red borders
  },
  
  // Status Colors (Trust/Verification)
  trust: {
    elite: '#FFD700',         // Gold for elite trust
    high: '#32CD32',          // Green for high trust
    medium: '#FFA500',        // Orange for medium trust
    low: '#FF4500',           // Red-orange for low trust
    new: '#808080'            // Gray for new users
  },
  
  // Service Category Colors
  categories: {
    dgy: '#DC143C',           // Primary red
    romans: '#8B0000',        // Dark red
    ridin: '#FF1493',         // Deep pink
    bb_suk: '#B22222'         // Fire brick red
  }
};

// Define gradient functions to avoid circular dependency
const createGradients = (colors) => ({
  hero: `linear-gradient(135deg, ${colors.primary.red} 0%, ${colors.primary.darkRed} 50%, ${colors.primary.black} 100%)`,
  redToBlack: `linear-gradient(135deg, ${colors.primary.red} 0%, ${colors.primary.black} 100%)`,
  redToWhite: `linear-gradient(135deg, ${colors.primary.red} 0%, ${colors.primary.white} 100%)`,
  blackToRed: `linear-gradient(135deg, ${colors.primary.black} 0%, ${colors.primary.red} 100%)`,
  redGradient: `linear-gradient(135deg, ${colors.primary.lightRed} 0%, ${colors.primary.darkRed} 100%)`,
  trustGradient: `linear-gradient(135deg, ${colors.trust.high} 0%, ${colors.trust.elite} 100%)`
});

// Export gradients after colors are fully defined
export const gradients = createGradients(colors);

// Box shadows with brand colors
export const shadows = {
  light: '0 2px 4px rgba(0, 0, 0, 0.1)',
  medium: '0 4px 8px rgba(0, 0, 0, 0.15)',
  heavy: '0 8px 16px rgba(0, 0, 0, 0.2)',
  brand: `0 4px 12px rgba(220, 20, 60, 0.3)`,
  glow: `0 0 20px rgba(220, 20, 60, 0.5)`
};