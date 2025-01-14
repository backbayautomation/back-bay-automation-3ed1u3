import { createTheme, ThemeOptions, responsiveFontSizes } from '@mui/material/styles'; // @mui/material/styles@5.14.0

// Import SCSS variables
import {
  color as colorVars,
  typography as typographyVars,
  spacing as spacingVars
} from '../styles/variables.scss';

// Theme palette configuration with WCAG 2.1 AA compliant colors
const THEME_PALETTE = {
  primary: {
    main: '#0066CC',
    light: '#3384D7',
    dark: '#004C99',
    contrastText: '#FFFFFF'
  },
  secondary: {
    main: '#4CAF50',
    light: '#6FBF73',
    dark: '#388E3C',
    contrastText: '#FFFFFF'
  },
  error: {
    main: '#DC3545',
    light: '#E35D6A',
    dark: '#C82333',
    contrastText: '#FFFFFF'
  },
  warning: {
    main: '#FFC107',
    light: '#FFCD38',
    dark: '#E0A800',
    contrastText: '#000000'
  },
  info: {
    main: '#17A2B8',
    light: '#31B0C6',
    dark: '#138496',
    contrastText: '#FFFFFF'
  },
  success: {
    main: '#28A745',
    light: '#48B461',
    dark: '#1E7E34',
    contrastText: '#FFFFFF'
  }
};

// Typography configuration with responsive scaling
const TYPOGRAPHY_CONFIG = {
  fontFamily: 'Roboto, sans-serif',
  fontSize: 16,
  htmlFontSize: 16,
  fontWeightLight: 300,
  fontWeightRegular: 400,
  fontWeightMedium: 500,
  fontWeightBold: 700,
  h1: {
    fontSize: '2.5rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.01562em'
  },
  h2: {
    fontSize: '2rem',
    fontWeight: 700,
    lineHeight: 1.2,
    letterSpacing: '-0.00833em'
  },
  h3: {
    fontSize: '1.75rem',
    fontWeight: 500,
    lineHeight: 1.2,
    letterSpacing: '0em'
  },
  body1: {
    fontSize: '1rem',
    lineHeight: 1.5,
    letterSpacing: '0.00938em'
  },
  body2: {
    fontSize: '0.875rem',
    lineHeight: 1.43,
    letterSpacing: '0.01071em'
  },
  button: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.75,
    letterSpacing: '0.02857em',
    textTransform: 'uppercase'
  }
};

// Breakpoint configuration
const BREAKPOINTS = {
  values: {
    xs: 0,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200
  }
};

// Base theme options shared between light and dark modes
const baseThemeOptions: ThemeOptions = {
  typography: TYPOGRAPHY_CONFIG,
  breakpoints: BREAKPOINTS,
  spacing: (factor: number) => `${8 * factor}px`,
  shape: {
    borderRadius: 4
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 44, // WCAG 2.1 AA touch target size
          minWidth: 44,
          padding: '8px 16px'
        }
      }
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiInputBase-root': {
            minHeight: 44 // WCAG 2.1 AA touch target size
          }
        }
      }
    },
    MuiLink: {
      styleOverrides: {
        root: {
          textDecoration: 'underline', // WCAG 2.1 AA visible focus indicator
          '&:focus': {
            outline: '2px solid currentColor',
            outlineOffset: 2
          }
        }
      }
    }
  }
};

// Create light theme
export const createLightTheme = () => {
  const lightThemeOptions: ThemeOptions = {
    ...baseThemeOptions,
    palette: {
      mode: 'light',
      ...THEME_PALETTE,
      background: {
        default: '#FFFFFF',
        paper: '#F8F9FA'
      },
      text: {
        primary: '#212529',
        secondary: '#6C757D'
      }
    }
  };

  return responsiveFontSizes(createTheme(lightThemeOptions));
};

// Create dark theme with enhanced contrast
export const createDarkTheme = () => {
  const darkThemeOptions: ThemeOptions = {
    ...baseThemeOptions,
    palette: {
      mode: 'dark',
      ...THEME_PALETTE,
      background: {
        default: '#121212',
        paper: '#1E1E1E'
      },
      text: {
        primary: '#E0E0E0',
        secondary: '#A0A0A0'
      }
    },
    components: {
      ...baseThemeOptions.components,
      MuiButton: {
        styleOverrides: {
          root: {
            ...baseThemeOptions.components?.MuiButton?.styleOverrides?.root,
            '&:focus': {
              outline: '2px solid #FFFFFF',
              outlineOffset: 2
            }
          }
        }
      }
    }
  };

  return responsiveFontSizes(createTheme(darkThemeOptions));
};

// Create and export themes
export const lightTheme = createLightTheme();
export const darkTheme = createDarkTheme();

// Type exports for theme configuration
export type Theme = typeof lightTheme;
export type ThemePalette = typeof THEME_PALETTE;