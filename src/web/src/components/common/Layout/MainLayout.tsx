import React, { useState, useCallback, useEffect } from 'react';
import { Box, Container, useMediaQuery } from '@mui/material';
import { styled } from '@mui/material/styles';

import Header from './Header';
import Footer from './Footer';
import Sidebar from './Sidebar';

// Constants for layout configuration
const DRAWER_WIDTH = 240;
const MOBILE_BREAKPOINT = 768;
const LAYOUT_TRANSITIONS = {
  duration: 225,
  easing: 'theme.transitions.easing.sharp'
};

// Props interface for MainLayout
interface MainLayoutProps {
  children: React.ReactNode;
  portalType: 'admin' | 'client';
  className?: string;
  analyticsEnabled?: boolean;
}

// Styled components with theme integration
const MainContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
  transition: theme.transitions.create(['padding-left', 'padding-right'], {
    duration: LAYOUT_TRANSITIONS.duration,
    easing: LAYOUT_TRANSITIONS.easing,
  }),
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none'
  }
}));

const ContentContainer = styled(Container)(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  marginTop: 64, // Header height
  minHeight: `calc(100vh - 64px - 48px)`, // Viewport - Header - Footer
  transition: theme.transitions.create(['margin', 'padding'], {
    duration: LAYOUT_TRANSITIONS.duration,
    easing: LAYOUT_TRANSITIONS.easing,
  }),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
    marginLeft: 0
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none'
  }
}));

// Main layout component with memoization
const MainLayout = React.memo<MainLayoutProps>(({
  children,
  portalType,
  className,
  analyticsEnabled = false
}) => {
  // State and hooks
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isMobile = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT}px)`);

  // Close sidebar on mobile by default
  useEffect(() => {
    setIsSidebarOpen(!isMobile);
  }, [isMobile]);

  // Handle sidebar toggle with analytics
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
    if (analyticsEnabled) {
      // Track sidebar interaction
      try {
        window.gtag?.('event', 'sidebar_toggle', {
          portal_type: portalType,
          is_mobile: isMobile,
          action: isSidebarOpen ? 'close' : 'open'
        });
      } catch (error) {
        console.error('Analytics error:', error);
      }
    }
  }, [isSidebarOpen, portalType, isMobile, analyticsEnabled]);

  // Error boundary for layout components
  const handleLayoutError = useCallback((error: Error) => {
    console.error('Layout error:', error);
    // Attempt recovery by resetting sidebar state
    setIsSidebarOpen(false);
  }, []);

  return (
    <MainContainer 
      className={className}
      role="main"
      aria-label={`${portalType === 'admin' ? 'Admin' : 'Client'} Portal Layout`}
    >
      <Header
        portalType={portalType}
        onToggleSidebar={handleSidebarToggle}
      />
      
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={handleSidebarToggle}
        variant={isMobile ? 'temporary' : 'persistent'}
        items={[]} // Navigation items to be passed from parent
        persistent={!isMobile}
        allowedRoles={[]} // Roles to be passed from parent
        onNavigate={(path) => {
          if (isMobile) {
            setIsSidebarOpen(false);
          }
          if (analyticsEnabled) {
            try {
              window.gtag?.('event', 'navigation', {
                portal_type: portalType,
                path
              });
            } catch (error) {
              console.error('Analytics error:', error);
            }
          }
        }}
      />

      <ContentContainer
        maxWidth={false}
        sx={{
          marginLeft: {
            sm: isSidebarOpen ? `${DRAWER_WIDTH}px` : 0
          }
        }}
      >
        {children}
      </ContentContainer>

      <Footer />
    </MainContainer>
  );
});

// Display name for debugging
MainLayout.displayName = 'MainLayout';

export default MainLayout;