// @mui/material/styles version: 5.14.0
import { createTheme, ThemeOptions, responsiveFontSizes } from '@mui/material/styles';
import variables from '../styles/variables.scss';

// =============================================================================
// Theme Configuration
// Implements WCAG 2.1 AA compliant theming with dark mode support
// =============================================================================

const baseThemeOptions: ThemeOptions = {
  typography: {
    fontFamily: variables.$font_family_primary,
    fontSize: parseInt(variables.$font_size_base),
    htmlFontSize: parseInt(variables.$font_size_base),
    fontWeightLight: 300,
    fontWeightRegular: variables.$font_weight_regular,
    fontWeightMedium: variables.$font_weight_medium,
    fontWeightBold: variables.$font_weight_bold,
    h1: {
      fontSize: variables.$font_size_xxl,
      fontWeight: variables.$font_weight_bold,
      lineHeight: variables.$line_height_heading,
      letterSpacing: variables.$letter_spacing_heading,
    },
    h2: {
      fontSize: variables.$font_size_xl,
      fontWeight: variables.$font_weight_bold,
      lineHeight: variables.$line_height_heading,
      letterSpacing: variables.$letter_spacing_heading,
    },
    h3: {
      fontSize: variables.$font_size_lg,
      fontWeight: variables.$font_weight_medium,
      lineHeight: variables.$line_height_heading,
      letterSpacing: variables.$letter_spacing_base,
    },
    body1: {
      fontSize: variables.$font_size_base,
      lineHeight: variables.$line_height_base,
      letterSpacing: variables.$letter_spacing_base,
    },
    body2: {
      fontSize: variables.$font_size_md,
      lineHeight: variables.$line_height_base,
      letterSpacing: variables.$letter_spacing_base,
    },
    button: {
      fontSize: variables.$font_size_md,
      fontWeight: variables.$font_weight_medium,
      lineHeight: variables.$line_height_base,
      letterSpacing: variables.$letter_spacing_base,
      textTransform: 'none',
    },
  },
  breakpoints: {
    values: {
      xs: parseInt(variables.$breakpoint_mobile),
      sm: parseInt(variables.$breakpoint_tablet),
      md: parseInt(variables.$breakpoint_desktop),
      lg: parseInt(variables.$breakpoint_large),
      xl: parseInt(variables.$breakpoint_xlarge),
    },
  },
  spacing: (factor: number) => `${parseInt(variables.$spacing_base) * factor}px`,
  shape: {
    borderRadius: parseInt(variables.$border_radius_md),
  },
  transitions: {
    duration: {
      shortest: parseInt(variables.$animation_duration_base),
      standard: parseInt(variables.$animation_duration_slow),
    },
    easing: {
      easeInOut: variables.$animation_timing_base,
      easeOut: variables.$animation_timing_entrance,
      easeIn: variables.$animation_timing_exit,
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
        main: variables.$primary,
        light: variables.$primary_light,
        dark: variables.$primary_dark,
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: variables.$secondary,
        contrastText: '#FFFFFF',
      },
      error: {
        main: variables.$error,
        contrastText: '#FFFFFF',
      },
      warning: {
        main: variables.$warning,
        contrastText: '#000000',
      },
      info: {
        main: variables.$info,
        contrastText: '#FFFFFF',
      },
      success: {
        main: variables.$success,
        contrastText: '#FFFFFF',
      },
      text: {
        primary: variables.$text_primary,
        secondary: variables.$text_secondary,
        disabled: variables.$text_disabled,
      },
      background: {
        default: variables.$background_color,
        paper: variables.$background_secondary,
      },
      action: {
        focusOpacity: 0.12,
        selectedOpacity: 0.08,
        hoverOpacity: 0.04,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: variables.$border_radius_md,
            padding: `${variables.$spacing_sm} ${variables.$spacing_md}`,
            '&:focus-visible': {
              outline: `2px solid ${variables.$focus_ring_color}`,
              outlineOffset: '2px',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: variables.$border_radius_md,
              '&:focus-within': {
                boxShadow: `0 0 0 3px ${variables.$focus_ring_color}`,
              },
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: variables.$border_radius_lg,
            boxShadow: variables.$shadow_md,
          },
        },
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
        main: variables.$primary_light,
        light: variables.$primary,
        dark: variables.$primary_dark,
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: variables.$secondary,
        contrastText: '#FFFFFF',
      },
      error: {
        main: variables.$error,
        contrastText: '#FFFFFF',
      },
      warning: {
        main: variables.$warning,
        contrastText: '#000000',
      },
      info: {
        main: variables.$info,
        contrastText: '#FFFFFF',
      },
      success: {
        main: variables.$success,
        contrastText: '#FFFFFF',
      },
      text: {
        primary: variables.$dark_text_primary,
        secondary: variables.$dark_text_secondary,
        disabled: variables.$text_disabled,
      },
      background: {
        default: variables.$dark_background_color,
        paper: variables.$dark_background_secondary,
      },
      action: {
        focusOpacity: 0.12,
        selectedOpacity: 0.16,
        hoverOpacity: 0.08,
      },
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: variables.$border_radius_md,
            padding: `${variables.$spacing_sm} ${variables.$spacing_md}`,
            '&:focus-visible': {
              outline: `2px solid ${variables.$focus_ring_color}`,
              outlineOffset: '2px',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: variables.$border_radius_md,
              '&:focus-within': {
                boxShadow: `0 0 0 3px ${variables.$focus_ring_color}`,
              },
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: variables.$border_radius_lg,
            boxShadow: variables.$shadow_md,
            backgroundColor: variables.$dark_background_secondary,
          },
        },
      },
    },
  });

  return responsiveFontSizes(darkTheme);
};

// Export theme instances
export const lightTheme = createLightTheme();
export const darkTheme = createDarkTheme();