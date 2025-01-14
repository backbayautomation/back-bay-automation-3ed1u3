import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'; // v18.2.0
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  useMediaQuery,
  useTheme as useMuiTheme,
  Box,
  Divider,
  Tooltip
} from '@mui/material'; // v5.14.0
import {
  ExpandLess,
  ExpandMore,
  ChevronLeft,
  ChevronRight
} from '@mui/icons-material'; // v5.14.0
import { withErrorBoundary } from 'react-error-boundary'; // v4.0.0
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
  SUBMENU: 'Expand Submenu'
};

// Interfaces
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

// Custom hook for navigation event handling
const useNavigationHandlers = (config: {
  onNavigate?: (path: string) => void;
  onClose: () => void;
}) => {
  const handleNavigation = useCallback((path: string) => {
    config.onNavigate?.(path);
    config.onClose();
  }, [config]);

  const handleKeyboardNavigation = useCallback((
    event: React.KeyboardEvent,
    path: string
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleNavigation(path);
    }
  }, [handleNavigation]);

  return { handleNavigation, handleKeyboardNavigation };
};

// Main Sidebar component
const SidebarComponent: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  items,
  variant = 'temporary',
  persistent = false,
  allowedRoles = [],
  onNavigate,
  customStyles = {}
}) => {
  const { theme, isDarkMode } = useTheme();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT}px)`);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const sidebarRef = useRef<HTMLDivElement>(null);
  const { handleNavigation, handleKeyboardNavigation } = useNavigationHandlers({ onNavigate, onClose });

  // Filter items based on roles
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (!item.roles || item.roles.length === 0) return true;
      return item.roles.some(role => allowedRoles.includes(role));
    });
  }, [items, allowedRoles]);

  // Handle submenu expansion
  const handleExpand = useCallback((itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  // Handle touch interactions
  useEffect(() => {
    let touchStartX = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touchEndX = e.touches[0].clientX;
      const deltaX = touchEndX - touchStartX;

      if (Math.abs(deltaX) > 50) {
        if (deltaX > 0 && !isOpen) {
          onClose();
        } else if (deltaX < 0 && isOpen) {
          onClose();
        }
      }
    };

    const element = sidebarRef.current;
    if (element) {
      element.addEventListener('touchstart', handleTouchStart);
      element.addEventListener('touchmove', handleTouchMove);
    }

    return () => {
      if (element) {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
      }
    };
  }, [isOpen, onClose]);

  // Render navigation items recursively
  const renderNavItems = (navItems: NavigationItem[], level = 0) => {
    return navItems.map(item => {
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = expandedItems.has(item.id);

      return (
        <React.Fragment key={item.id}>
          <ListItem
            button
            disabled={item.disabled}
            onClick={() => hasChildren ? handleExpand(item.id) : handleNavigation(item.path)}
            onKeyDown={(e) => handleKeyboardNavigation(e, item.path)}
            sx={{
              pl: level * 2 + 2,
              minHeight: MIN_TOUCH_TARGET,
              '&.Mui-disabled': {
                opacity: 0.5,
                pointerEvents: 'none'
              }
            }}
            aria-expanded={hasChildren ? isExpanded : undefined}
          >
            <ListItemIcon sx={{ minWidth: MIN_TOUCH_TARGET }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{
                noWrap: true,
                variant: 'body2'
              }}
            />
            {hasChildren && (
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExpand(item.id);
                }}
                aria-label={`${ARIA_LABELS.SUBMENU} ${item.label}`}
              >
                {isExpanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            )}
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
  };

  return (
    <Drawer
      ref={sidebarRef}
      variant={isMobile ? 'temporary' : variant}
      open={isOpen}
      onClose={onClose}
      anchor="left"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          backgroundColor: theme.palette.background.paper,
          transition: muiTheme.transitions.create(['width', 'margin'], {
            easing: muiTheme.transitions.easing.sharp,
            duration: TRANSITION_DURATION
          }),
          ...customStyles
        }
      }}
      ModalProps={{
        keepMounted: true // Better mobile performance
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: theme.spacing(0, 1),
          minHeight: MIN_TOUCH_TARGET
        }}
      >
        <IconButton onClick={onClose} aria-label={ARIA_LABELS.TOGGLE}>
          {isDarkMode ? <ChevronLeft /> : <ChevronRight />}
        </IconButton>
      </Box>
      <Divider />
      <List
        component="nav"
        aria-label={ARIA_LABELS.SIDEBAR}
        sx={{
          padding: theme.spacing(1, 0),
          overflowX: 'hidden',
          overflowY: 'auto'
        }}
      >
        {renderNavItems(filteredItems)}
      </List>
    </Drawer>
  );
};

// Error boundary wrapper
const Sidebar = withErrorBoundary(SidebarComponent, {
  fallback: (
    <Box
      sx={{
        width: DRAWER_WIDTH,
        padding: 2,
        color: 'error.main'
      }}
    >
      Navigation Error. Please refresh the page.
    </Box>
  )
});

export default Sidebar;