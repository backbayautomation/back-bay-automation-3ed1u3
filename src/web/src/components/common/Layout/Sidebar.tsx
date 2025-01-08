import React, { useCallback, useEffect, useMemo, useState } from 'react'; // v18.2.0
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
  Box,
  Divider
} from '@mui/material'; // v5.14.0
import { 
  ExpandLess, 
  ExpandMore, 
  ChevronLeft 
} from '@mui/icons-material'; // v5.14.0
import { withErrorBoundary } from 'react-error-boundary'; // v4.0.0
import { useTheme } from '../../../contexts/ThemeContext';

// Constants for component configuration
const DRAWER_WIDTH = 240;
const MOBILE_BREAKPOINT = 768;
const TRANSITION_DURATION = 225;
const MIN_TOUCH_TARGET = 44;

const ARIA_LABELS = {
  SIDEBAR: 'Main Navigation',
  TOGGLE: 'Toggle Navigation',
  SUBMENU: 'Expand Submenu'
};

// Interface definitions
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
  customStyles
}) => {
  const { theme, isDarkMode } = useTheme();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(`(max-width:${MOBILE_BREAKPOINT}px)`);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { handleNavigation, handleKeyboardNavigation } = useNavigationHandlers({ onNavigate, onClose });

  // Filter navigation items based on roles
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (!item.roles || item.roles.length === 0) return true;
      return item.roles.some(role => allowedRoles.includes(role));
    });
  }, [items, allowedRoles]);

  // Handle submenu expansion
  const handleExpand = useCallback((itemId: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  // Reset expanded items on mobile when closing
  useEffect(() => {
    if (!isOpen && isMobile) {
      setExpandedItems(new Set());
    }
  }, [isOpen, isMobile]);

  // Render navigation items recursively
  const renderNavItems = (navItems: NavigationItem[], level = 0) => {
    return navItems.map(item => {
      const hasChildren = item.children && item.children.length > 0;
      const isExpanded = expandedItems.has(item.id);

      return (
        <React.Fragment key={item.id}>
          <ListItem
            disablePadding
            sx={{
              pl: level * 2,
              minHeight: MIN_TOUCH_TARGET
            }}
          >
            <ListItemButton
              onClick={() => hasChildren ? handleExpand(item.id) : handleNavigation(item.path)}
              onKeyDown={(e) => handleKeyboardNavigation(e, item.path)}
              disabled={item.disabled}
              aria-expanded={hasChildren ? isExpanded : undefined}
              sx={{
                minHeight: MIN_TOUCH_TARGET,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover
                }
              }}
            >
              {item.icon && (
                <ListItemIcon sx={{ minWidth: MIN_TOUCH_TARGET }}>
                  {item.icon}
                </ListItemIcon>
              )}
              <ListItemText primary={item.label} />
              {hasChildren && (
                <IconButton
                  aria-label={ARIA_LABELS.SUBMENU}
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleExpand(item.id);
                  }}
                >
                  {isExpanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              )}
            </ListItemButton>
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

  const drawerContent = (
    <Box
      role="navigation"
      aria-label={ARIA_LABELS.SIDEBAR}
      sx={{
        width: isMobile ? '100%' : DRAWER_WIDTH,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: theme.palette.background.paper,
        ...customStyles
      }}
    >
      {!persistent && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 1 }}>
            <IconButton
              onClick={onClose}
              aria-label={ARIA_LABELS.TOGGLE}
              sx={{ minHeight: MIN_TOUCH_TARGET, minWidth: MIN_TOUCH_TARGET }}
            >
              <ChevronLeft />
            </IconButton>
          </Box>
          <Divider />
        </>
      )}
      <List
        component="nav"
        sx={{
          width: '100%',
          p: theme.spacing(2),
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        {renderNavItems(filteredItems)}
      </List>
    </Box>
  );

  return (
    <Drawer
      variant={variant}
      open={isOpen}
      onClose={onClose}
      anchor="left"
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          transition: muiTheme.transitions.create(['width', 'margin'], {
            easing: muiTheme.transitions.easing.sharp,
            duration: TRANSITION_DURATION
          })
        }
      }}
    >
      {drawerContent}
    </Drawer>
  );
};

// Error boundary wrapper
const Sidebar = withErrorBoundary(SidebarComponent, {
  fallback: <div>Error loading navigation sidebar</div>,
  onError: (error) => {
    console.error('Sidebar Error:', error);
  }
});

export default Sidebar;