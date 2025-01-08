// @mui/material/styles version: 5.14.0
import { createTheme, ThemeOptions, responsiveFontSizes } from '@mui/material/styles';
import variables from '../styles/variables.scss';

// Type definitions for enhanced theme configuration
declare module '@mui/material/styles' {
  interface Theme {
    status: {
      danger: string;
    }
  }
  interface ThemeOptions {
    status?: {
      danger?: string;
    }
  }
}

// Base theme configuration shared between light and dark modes
const baseThemeOptions: ThemeOptions = {
  typography: {
    fontFamily: variables.fontFamilyPrimary,
    fontSize: parseInt(variables.fontSizeBase),
    htmlFontSize: 16,
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.01562em',
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.00833em',
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
      lineHeight: 1.2,
      letterSpacing: '0em',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
      letterSpacing: '0.00938em',
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.43,
      letterSpacing: '0.01071em',
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      lineHeight: 1.75,
      letterSpacing: '0.02857em',
      textTransform: 'uppercase',
    },
  },
  breakpoints: {
    values: {
      xs: 0,
      sm: 576,
      md: 768,
      lg: 992,
      xl: 1200,
    },
  },
  spacing: (factor: number) => `${8 * factor}px`,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '4px',
          padding: '8px 16px',
          minWidth: '64px',
          transition: 'background-color 250ms cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '4px',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        },
      },
    },
  },
};

// Light theme configuration
export const createLightTheme = () => {
  const lightTheme = createTheme({
    ...baseThemeOptions,
    palette: {
      mode: 'light',
      primary: {
        main: variables.colorPrimary,
        light: '#3384D7',
        dark: '#004C99',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: variables.colorSecondary,
        light: '#6FBF73',
        dark: '#388E3C',
        contrastText: '#FFFFFF',
      },
      error: {
        main: '#DC3545',
        light: '#E35D6A',
        dark: '#C82333',
        contrastText: '#FFFFFF',
      },
      warning: {
        main: '#FFC107',
        light: '#FFCD38',
        dark: '#E0A800',
        contrastText: '#000000',
      },
      info: {
        main: '#17A2B8',
        light: '#31B0C6',
        dark: '#138496',
        contrastText: '#FFFFFF',
      },
      success: {
        main: '#28A745',
        light: '#48B461',
        dark: '#1E7E34',
        contrastText: '#FFFFFF',
      },
      text: {
        primary: variables.textPrimary,
        secondary: '#6C757D',
        disabled: '#A0A0A0',
      },
      background: {
        default: variables.backgroundPrimary,
        paper: '#F8F9FA',
      },
    },
  });

  return responsiveFontSizes(lightTheme);
};

// Dark theme configuration
export const createDarkTheme = () => {
  const darkTheme = createTheme({
    ...baseThemeOptions,
    palette: {
      mode: 'dark',
      primary: {
        main: variables.colorPrimary,
        light: '#3384D7',
        dark: '#004C99',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: variables.colorSecondary,
        light: '#6FBF73',
        dark: '#388E3C',
        contrastText: '#FFFFFF',
      },
      error: {
        main: '#DC3545',
        light: '#E35D6A',
        dark: '#C82333',
        contrastText: '#FFFFFF',
      },
      warning: {
        main: '#FFC107',
        light: '#FFCD38',
        dark: '#E0A800',
        contrastText: '#000000',
      },
      info: {
        main: '#17A2B8',
        light: '#31B0C6',
        dark: '#138496',
        contrastText: '#FFFFFF',
      },
      success: {
        main: '#28A745',
        light: '#48B461',
        dark: '#1E7E34',
        contrastText: '#FFFFFF',
      },
      text: {
        primary: '#E0E0E0',
        secondary: '#A0A0A0',
        disabled: '#666666',
      },
      background: {
        default: variables.darkBackgroundPrimary,
        paper: '#1E1E1E',
      },
    },
    components: {
      ...baseThemeOptions.components,
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: '#1E1E1E',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          },
        },
      },
    },
  });

  return responsiveFontSizes(darkTheme);
};

// Export pre-configured themes
export const lightTheme = createLightTheme();
export const darkTheme = createDarkTheme();