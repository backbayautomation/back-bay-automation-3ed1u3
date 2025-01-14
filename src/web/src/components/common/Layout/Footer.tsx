import React from 'react'; // v18.2.0
import { Box, Typography, useMediaQuery } from '@mui/material'; // v5.14.0
import { useTheme } from '../../../contexts/ThemeContext';

/**
 * Props interface for Footer component with optional styling and testing attributes
 */
interface FooterProps {
  className?: string;
  testId?: string;
}

/**
 * Constants for footer configuration
 */
const MOBILE_BREAKPOINT = 768;
const COPYRIGHT_TEXT = '© 2024 AI-Powered Product Catalog Search System. All rights reserved.';
const FOOTER_HEIGHT = {
  desktop: '48px',
  mobile: '64px'
};

/**
 * Footer component providing consistent footer content with theme integration,
 * responsive design, and WCAG 2.1 AA compliance
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
    // Ensure sufficient contrast ratio for WCAG compliance
    color: isDarkMode ? theme.palette.text.primary : theme.palette.text.secondary,
    // Add z-index to ensure footer stays above content
    zIndex: theme.zIndex.appBar - 1,
    // Prevent text selection for better UX
    userSelect: 'none',
    // Enable GPU acceleration for smooth animations
    transform: 'translateZ(0)',
    // Add transition for smooth theme switching
    transition: theme.transitions.create(['background-color', 'color', 'border-color'], {
      duration: theme.transitions.duration.short,
    })
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
        component="p"
        sx={{
          textAlign: 'center',
          // Ensure text remains visible during webfont load
          fontDisplay: 'swap',
          // Improve readability
          letterSpacing: '0.01em',
          // Ensure proper line height for accessibility
          lineHeight: 1.5,
          // Add focus outline for keyboard navigation
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '2px',
          }
        }}
        tabIndex={0}
      >
        {COPYRIGHT_TEXT}
      </Typography>
    </Box>
  );
});

// Display name for debugging
Footer.displayName = 'Footer';

export default Footer;