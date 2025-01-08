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

// Props interface with TypeScript strict typing
interface FooterProps {
  className?: string;
  testId?: string;
}

/**
 * Enterprise-grade footer component with accessibility features and responsive design
 * Implements WCAG 2.1 AA compliance and theme integration
 */
const Footer = React.memo<FooterProps>(({ className, testId = 'footer' }) => {
  // Theme and responsive hooks
  const { theme, isDarkMode } = useTheme();
  const isMobile = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT}px)`);

  // Dynamic styles based on theme and viewport
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
    borderTop: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.paper,
    zIndex: theme.zIndex.appBar - 1,
    transition: theme.transitions.create(['background-color', 'border-color'], {
      duration: theme.transitions.duration.standard,
    }),
    '&:focus-within': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: '-2px',
    },
  };

  const textStyles = {
    color: isDarkMode ? theme.palette.text.primary : theme.palette.text.secondary,
    textAlign: 'center' as const,
    userSelect: 'none' as const,
    transition: theme.transitions.create('color', {
      duration: theme.transitions.duration.standard,
    }),
  };

  return (
    <Box
      component="footer"
      sx={footerStyles}
      className={className}
      data-testid={testId}
      role="contentinfo"
      aria-label="Footer"
    >
      <Typography
        variant={isMobile ? 'caption' : 'body2'}
        sx={textStyles}
        component="p"
      >
        {COPYRIGHT_TEXT}
      </Typography>
    </Box>
  );
});

// Display name for debugging and dev tools
Footer.displayName = 'Footer';

export default Footer;