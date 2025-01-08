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

// Props interface with strict typing
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
  transition: theme.transitions.create(['padding-left', 'margin-left'], {
    duration: LAYOUT_TRANSITIONS.duration,
    easing: LAYOUT_TRANSITIONS.easing,
  }),
}));

const ContentContainer = styled(Container)(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  marginTop: 64, // Header height
  minHeight: `calc(100vh - 64px - 48px)`, // Viewport - Header - Footer
  transition: theme.transitions.create(['margin', 'width'], {
    duration: LAYOUT_TRANSITIONS.duration,
    easing: LAYOUT_TRANSITIONS.easing,
  }),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
  position: 'relative',
  zIndex: 1,
}));

// Error boundary for layout component
class LayoutErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Layout Error:', error, errorInfo);
    // TODO: Add error reporting service integration
  }

  render() {
    return this.props.children;
  }
}

// Main layout component with memoization for performance
const MainLayout = React.memo<MainLayoutProps>(({
  children,
  portalType,
  className,
  analyticsEnabled = false
}) => {
  // State and hooks
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isMobile = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT}px)`);

  // Set initial sidebar state based on viewport
  useEffect(() => {
    setIsSidebarOpen(!isMobile);
  }, [isMobile]);

  // Memoized sidebar toggle handler
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  // Track layout interactions if analytics enabled
  useEffect(() => {
    if (analyticsEnabled) {
      // TODO: Implement layout analytics tracking
      const trackLayoutInteraction = (action: string) => {
        console.info('Layout Interaction:', action);
      };

      trackLayoutInteraction('layout_mounted');
      return () => trackLayoutInteraction('layout_unmounted');
    }
  }, [analyticsEnabled]);

  // Dynamic styles based on sidebar state
  const getLayoutStyles = () => ({
    marginLeft: !isMobile && isSidebarOpen ? `${DRAWER_WIDTH}px` : 0,
    width: !isMobile && isSidebarOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
  });

  return (
    <LayoutErrorBoundary>
      <MainContainer className={className}>
        <Header
          onToggleSidebar={handleSidebarToggle}
          portalType={portalType}
        />
        
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          variant={isMobile ? 'temporary' : 'persistent'}
          items={[]} // Navigation items to be passed from parent
          persistent={!isMobile}
          allowedRoles={[]} // Roles to be passed from parent
        />

        <ContentContainer
          maxWidth={false}
          sx={getLayoutStyles()}
          component="main"
          role="main"
        >
          {children}
        </ContentContainer>

        <Footer />
      </MainContainer>
    </LayoutErrorBoundary>
  );
});

// Display name for debugging
MainLayout.displayName = 'MainLayout';

export default MainLayout;