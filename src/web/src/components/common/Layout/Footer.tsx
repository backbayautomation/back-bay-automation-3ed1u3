import React from 'react'; // v18.2.0
import { Box, Typography, useMediaQuery } from '@mui/material'; // v5.14.0
import { useTheme } from '../../../contexts/ThemeContext';

// Constants for footer configuration
const MOBILE_BREAKPOINT = 768;
const COPYRIGHT_TEXT = '© 2024 AI-Powered Product Catalog Search System. All rights reserved.';
const FOOTER_HEIGHT = {
  desktop: '48px',
  mobile: '64px'
};

/**
 * Props interface for Footer component
 */
interface FooterProps {
  /** Optional CSS class for external styling */
  className?: string;
  /** Optional test ID for testing purposes */
  testId?: string;
}

/**
 * Enterprise-grade footer component with responsive design and accessibility features
 */
const Footer = React.memo<FooterProps>(({ className, testId = 'footer' }) => {
  // Theme and responsive hooks
  const { theme, isDarkMode } = useTheme();
  const isMobile = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT}px)`);

  // Dynamic styles based on theme and device
  const footerStyles = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: isMobile ? FOOTER_HEIGHT.mobile : FOOTER_HEIGHT.desktop,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(isMobile ? 1.5 : 2),
    backgroundColor: theme.palette.background.paper,
    borderTop: `1px solid ${theme.palette.divider}`,
    zIndex: theme.zIndex.appBar - 1,
    transition: theme.transitions.create(['background-color', 'border-color'], {
      duration: theme.transitions.duration.short,
    }),
    '&:focus-visible': {
      outline: 'none',
      boxShadow: theme.shadows[2],
    },
  };

  // Typography variant based on device size
  const typographyVariant = isMobile ? 'caption' : 'body2';

  return (
    <Box
      component="footer"
      sx={footerStyles}
      className={className}
      data-testid={testId}
      role="contentinfo"
      aria-label="Footer"
      tabIndex={0}
    >
      <Typography
        variant={typographyVariant}
        color="text.secondary"
        align="center"
        sx={{
          userSelect: 'none',
          color: isDarkMode ? 'text.primary' : 'text.secondary',
          transition: theme.transitions.create('color'),
          '&::selection': {
            backgroundColor: theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
          },
        }}
      >
        {COPYRIGHT_TEXT}
      </Typography>
    </Box>
  );
});

// Display name for debugging
Footer.displayName = 'Footer';

export default Footer;