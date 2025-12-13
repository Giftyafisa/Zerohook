import { createTheme } from '@mui/material/styles';
import tokens from './tokens';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: tokens.colors.primary.main,
      dark: tokens.colors.primary.dark,
      light: tokens.colors.primary.light,
      contrastText: tokens.colors.background.primary,
    },
    secondary: {
      main: tokens.colors.secondary.main,
      dark: tokens.colors.secondary.dark,
      light: tokens.colors.secondary.light,
      contrastText: tokens.colors.text.primary,
    },
    background: {
      default: tokens.colors.background.primary,
      paper: tokens.colors.background.secondary,
    },
    text: {
      primary: tokens.colors.text.primary,
      secondary: tokens.colors.text.secondary,
      disabled: tokens.colors.text.disabled,
    },
    error: {
      main: tokens.colors.error,
    },
    success: {
      main: tokens.colors.success,
    },
    warning: {
      main: tokens.colors.warning,
    },
    info: {
      main: tokens.colors.info,
    },
    divider: tokens.colors.border.primary,
  },
  typography: {
    fontFamily: '"Outfit", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Inter", "Helvetica Neue", "Arial", sans-serif',
    fontSize: tokens.fontSize.base,
    h1: {
      fontSize: `${tokens.fontSize['3xl']}px`,
      fontWeight: tokens.fontWeight.extrabold,
      lineHeight: 1.2,
    },
    h2: {
      fontSize: `${tokens.fontSize['2xl']}px`,
      fontWeight: tokens.fontWeight.bold,
      lineHeight: 1.3,
    },
    h3: {
      fontSize: `${tokens.fontSize.xl}px`,
      fontWeight: tokens.fontWeight.bold,
      lineHeight: 1.4,
    },
    h4: {
      fontSize: `${tokens.fontSize.lg}px`,
      fontWeight: tokens.fontWeight.semibold,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: `${tokens.fontSize.base}px`,
      lineHeight: 1.7,
      fontWeight: tokens.fontWeight.normal,
    },
    body2: {
      fontSize: `${tokens.fontSize.sm}px`,
      lineHeight: 1.7,
      fontWeight: tokens.fontWeight.normal,
    },
    caption: {
      fontSize: `${tokens.fontSize.xs}px`,
      lineHeight: 1.5,
      fontWeight: tokens.fontWeight.medium,
    },
    button: {
      textTransform: 'none',
      fontWeight: tokens.fontWeight.semibold,
      fontSize: `${tokens.fontSize.base}px`,
    },
  },
  shape: {
    borderRadius: tokens.borderRadius.md,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#0f0f13',
          color: '#ffffff',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: `${tokens.borderRadius.md}px`,
          padding: `${tokens.spacing.md}px ${tokens.spacing.xl}px`,
          fontWeight: tokens.fontWeight.semibold,
          fontSize: `${tokens.fontSize.base}px`,
          minHeight: `${tokens.touchTarget.min}px`,
          transition: tokens.transition.base,
        },
        contained: {
          '&:hover': {
            transform: 'translateY(-2px)',
          },
        },
        outlined: {
          borderWidth: 2,
          '&:hover': {
            borderWidth: 2,
          },
        },
        text: {
          '&:hover': {
            backgroundColor: 'rgba(0, 242, 234, 0.1)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: `${tokens.borderRadius.lg}px`,
          background: tokens.colors.overlay.light,
          backdropFilter: tokens.backdropBlur.sm,
          border: `1px solid ${tokens.colors.border.primary}`,
          '&:hover': {
            transform: 'translateY(-4px)',
          },
          transition: tokens.transition.slow,
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: `${tokens.borderRadius.sm}px`,
            minHeight: `${tokens.touchTarget.min}px`,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          minWidth: `${tokens.touchTarget.min}px`,
          minHeight: `${tokens.touchTarget.min}px`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: `${tokens.borderRadius.sm}px`,
          fontWeight: tokens.fontWeight.semibold,
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
        },
      },
    },
  },
  shadows: [
    'none',
    '0px 2px 1px -1px rgba(0,0,0,0.2),0px 1px 1px 0px rgba(0,0,0,0.14),0px 1px 3px 0px rgba(0,0,0,0.12)',
    '0px 3px 1px -2px rgba(0,0,0,0.2),0px 2px 2px 0px rgba(0,0,0,0.14),0px 1px 5px 0px rgba(0,0,0,0.12)',
    '0px 3px 3px -2px rgba(0,0,0,0.2),0px 3px 4px 0px rgba(0,0,0,0.14),0px 1px 8px 0px rgba(0,0,0,0.12)',
    '0px 2px 4px -1px rgba(0,0,0,0.2),0px 4px 5px 0px rgba(0,0,0,0.14),0px 1px 10px 0px rgba(0,0,0,0.12)',
    '0px 3px 5px -1px rgba(0,0,0,0.2),0px 5px 8px 0px rgba(0,0,0,0.14),0px 1px 14px 0px rgba(0,0,0,0.12)',
    '0px 3px 5px -1px rgba(0,0,0,0.2),0px 6px 10px 0px rgba(0,0,0,0.14),0px 1px 18px 0px rgba(0,0,0,0.12)',
    '0px 4px 5px -2px rgba(0,0,0,0.2),0px 7px 10px 1px rgba(0,0,0,0.14),0px 2px 16px 1px rgba(0,0,0,0.12)',
    '0px 5px 5px -3px rgba(0,0,0,0.2),0px 8px 10px 1px rgba(0,0,0,0.14),0px 3px 14px 2px rgba(0,0,0,0.12)',
    '0px 5px 6px -3px rgba(0,0,0,0.2),0px 9px 12px 1px rgba(0,0,0,0.14),0px 3px 16px 2px rgba(0,0,0,0.12)',
    '0px 6px 6px -3px rgba(0,0,0,0.2),0px 10px 14px 1px rgba(0,0,0,0.14),0px 4px 18px 3px rgba(0,0,0,0.12)',
    '0px 6px 7px -4px rgba(0,0,0,0.2),0px 11px 15px 1px rgba(0,0,0,0.14),0px 4px 20px 3px rgba(0,0,0,0.12)',
    '0px 7px 8px -4px rgba(0,0,0,0.2),0px 12px 17px 2px rgba(0,0,0,0.14),0px 5px 22px 4px rgba(0,0,0,0.12)',
    '0px 7px 8px -4px rgba(0,0,0,0.2),0px 13px 19px 2px rgba(0,0,0,0.14),0px 5px 24px 4px rgba(0,0,0,0.12)',
    '0px 7px 9px -4px rgba(0,0,0,0.2),0px 14px 21px 2px rgba(0,0,0,0.14),0px 5px 26px 4px rgba(0,0,0,0.12)',
    '0px 8px 9px -5px rgba(0,0,0,0.2),0px 15px 22px 2px rgba(0,0,0,0.14),0px 6px 28px 5px rgba(0,0,0,0.12)',
    '0px 8px 10px -5px rgba(0,0,0,0.2),0px 16px 24px 2px rgba(0,0,0,0.14),0px 6px 30px 5px rgba(0,0,0,0.12)',
    '0px 8px 11px -5px rgba(0,0,0,0.2),0px 17px 26px 2px rgba(0,0,0,0.14),0px 6px 32px 5px rgba(0,0,0,0.12)',
    '0px 9px 11px -5px rgba(0,0,0,0.2),0px 18px 28px 2px rgba(0,0,0,0.14),0px 7px 34px 6px rgba(0,0,0,0.12)',
    '0px 9px 12px -6px rgba(0,0,0,0.2),0px 19px 29px 2px rgba(0,0,0,0.14),0px 7px 36px 6px rgba(0,0,0,0.12)',
    '0px 10px 13px -6px rgba(0,0,0,0.2),0px 20px 31px 3px rgba(0,0,0,0.14),0px 8px 38px 7px rgba(0,0,0,0.12)',
    '0px 10px 13px -6px rgba(0,0,0,0.2),0px 21px 33px 3px rgba(0,0,0,0.14),0px 8px 40px 7px rgba(0,0,0,0.12)',
    '0px 10px 14px -6px rgba(0,0,0,0.2),0px 22px 35px 3px rgba(0,0,0,0.14),0px 8px 42px 7px rgba(0,0,0,0.12)',
    '0px 11px 14px -7px rgba(0,0,0,0.2),0px 23px 36px 3px rgba(0,0,0,0.14),0px 9px 44px 8px rgba(0,0,0,0.12)',
    '0px 11px 15px -7px rgba(0,0,0,0.2),0px 24px 38px 3px rgba(0,0,0,0.14),0px 9px 46px 8px rgba(0,0,0,0.12)',
    '0px 12px 16px -8px rgba(0,0,0,0.2),0px 25px 40px 3px rgba(0,0,0,0.14),0px 10px 48px 9px rgba(0,0,0,0.12)',
    '0px 12px 17px -8px rgba(0,0,0,0.2),0px 26px 42px 3px rgba(0,0,0,0.14),0px 10px 50px 9px rgba(0,0,0,0.12)',
  ],
});

export default theme;