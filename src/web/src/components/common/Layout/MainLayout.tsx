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
    easing: theme.transitions.easing.sharp,
  }),
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
}));

const ContentContainer = styled(Container)(({ theme }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  marginTop: '64px', // Header height
  minHeight: `calc(100vh - 64px - ${theme.spacing(6)})`, // Account for header and footer
  transition: theme.transitions.create('margin', {
    duration: LAYOUT_TRANSITIONS.duration,
    easing: theme.transitions.easing.sharp,
  }),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
}));

// Error boundary for layout component
class LayoutErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    console.error('Layout Error:', error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            p: 3,
          }}
        >
          <h1>Something went wrong with the layout. Please refresh the page.</h1>
        </Box>
      );
    }
    return this.props.children;
  }
}

// Memoized MainLayout component
const MainLayout: React.FC<MainLayoutProps> = React.memo(({
  children,
  portalType,
  className,
  analyticsEnabled = false,
}) => {
  // State and responsive hooks
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const isMobile = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT}px)`);

  // Reset sidebar state on mobile/desktop switch
  useEffect(() => {
    setIsSidebarOpen(!isMobile);
  }, [isMobile]);

  // Memoized sidebar toggle handler
  const handleSidebarToggle = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  // Analytics tracking for layout interactions
  useEffect(() => {
    if (analyticsEnabled) {
      // Track layout mount
      const trackLayoutMount = async () => {
        try {
          await fetch('/api/analytics/layout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'layout_mount',
              portalType,
              viewport: isMobile ? 'mobile' : 'desktop',
            }),
          });
        } catch (error) {
          console.error('Analytics Error:', error);
        }
      };
      trackLayoutMount();
    }
  }, [analyticsEnabled, portalType, isMobile]);

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
          items={[]} // Navigation items should be passed from parent
          persistent={!isMobile}
        />

        <ContentContainer
          maxWidth={false}
          sx={{
            marginLeft: {
              sm: isSidebarOpen ? `${DRAWER_WIDTH}px` : 0,
            },
            width: {
              sm: isSidebarOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
            },
          }}
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