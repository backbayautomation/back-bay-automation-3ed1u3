import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Collapse,
  IconButton,
  useMediaQuery,
  useTheme as useMuiTheme,
  styled,
} from '@mui/material'; // v5.14.0
import {
  ExpandLess,
  ExpandMore,
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material'; // v5.14.0
import { ErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { useTheme } from '../../../contexts/ThemeContext';

// Constants for configuration
const DRAWER_WIDTH = 240;
const MOBILE_BREAKPOINT = 768;
const TRANSITION_DURATION = 225;
const MIN_TOUCH_TARGET = 44;

// ARIA labels for accessibility
const ARIA_LABELS = {
  SIDEBAR: 'Main Navigation',
  TOGGLE: 'Toggle Navigation',
  SUBMENU: 'Expand Submenu',
};

// Props interface for the Sidebar component
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items: NavigationItem[];
  variant?: 'permanent' | 'persistent' | 'temporary';
  persistent?: boolean;
  allowedRoles?: string[];
  onNavigate?: (path: string) => void;
  customStyles?: React.CSSProperties;
}

// Interface for navigation items
interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  roles?: string[];
  disabled?: boolean;
  children?: NavigationItem[];
  metadata?: Record<string, unknown>;
}

// Styled components for enhanced theming
const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: DRAWER_WIDTH,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: DRAWER_WIDTH,
    boxSizing: 'border-box',
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: TRANSITION_DURATION,
    }),
  },
  [theme.breakpoints.down('md')]: {
    width: '100%',
    '& .MuiDrawer-paper': {
      width: '100%',
    },
  },
}));

const StyledListItemButton = styled(ListItemButton)(({ theme }) => ({
  minHeight: MIN_TOUCH_TARGET,
  padding: theme.spacing(1, 2),
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '-2px',
  },
}));

// Error Fallback component
const SidebarErrorFallback = ({ error }: { error: Error }) => (
  <div role="alert" style={{ padding: '1rem' }}>
    <h3>Navigation Error</h3>
    <pre>{error.message}</pre>
  </div>
);

// Custom hook for navigation handlers
const useNavigationHandlers = (
  onNavigate?: (path: string) => void,
  onClose?: () => void
) => {
  return useCallback(
    (path: string) => {
      onNavigate?.(path);
      onClose?.();
    },
    [onNavigate, onClose]
  );
};

// Main Sidebar component
const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  items,
  variant = 'temporary',
  persistent = false,
  allowedRoles = [],
  onNavigate,
  customStyles,
}) => {
  const muiTheme = useMuiTheme();
  const { isDarkMode } = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const handleNavigation = useNavigationHandlers(onNavigate, onClose);

  // Filter items based on roles
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!item.roles || item.roles.length === 0) return true;
      return item.roles.some((role) => allowedRoles.includes(role));
    });
  }, [items, allowedRoles]);

  // Handle item expansion
  const handleExpand = useCallback((itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, path: string) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleNavigation(path);
      }
    },
    [handleNavigation]
  );

  // Render navigation items recursively
  const renderNavItems = useCallback(
    (navItems: NavigationItem[], level = 0) => {
      return navItems.map((item) => {
        const hasChildren = item.children && item.children.length > 0;
        const isExpanded = expandedItems.has(item.id);

        return (
          <React.Fragment key={item.id}>
            <ListItem
              disablePadding
              sx={{ pl: level * 2 }}
              aria-disabled={item.disabled}
            >
              <StyledListItemButton
                onClick={() =>
                  hasChildren ? handleExpand(item.id) : handleNavigation(item.path)
                }
                onKeyDown={(e) => handleKeyDown(e, item.path)}
                disabled={item.disabled}
                aria-expanded={hasChildren ? isExpanded : undefined}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{
                    variant: 'body2',
                    color: item.disabled ? 'text.disabled' : 'text.primary',
                  }}
                />
                {hasChildren && (isExpanded ? <ExpandLess /> : <ExpandMore />)}
              </StyledListItemButton>
            </ListItem>
            {hasChildren && (
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  {renderNavItems(item.children, level + 1)}
                </List>
              </Collapse>
            )}
          </React.Fragment>
        );
      });
    },
    [expandedItems, handleExpand, handleNavigation, handleKeyDown]
  );

  // Effect for mobile handling
  useEffect(() => {
    if (!isMobile && !persistent) {
      setExpandedItems(new Set());
    }
  }, [isMobile, persistent]);

  return (
    <ErrorBoundary FallbackComponent={SidebarErrorFallback}>
      <StyledDrawer
        variant={variant}
        open={isOpen}
        onClose={onClose}
        anchor="left"
        sx={customStyles}
        PaperProps={{
          elevation: 2,
          'aria-label': ARIA_LABELS.SIDEBAR,
        }}
      >
        {isMobile && (
          <IconButton
            onClick={onClose}
            aria-label={ARIA_LABELS.TOGGLE}
            sx={{ m: 1, alignSelf: 'flex-end' }}
          >
            {isDarkMode ? <ChevronLeft /> : <ChevronRight />}
          </IconButton>
        )}
        <List component="nav" aria-label={ARIA_LABELS.SIDEBAR}>
          {renderNavItems(filteredItems)}
        </List>
      </StyledDrawer>
    </ErrorBoundary>
  );
};

export default Sidebar;