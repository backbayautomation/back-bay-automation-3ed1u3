import React from 'react'; // v18.2.0
import {
  AppBar,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery,
} from '@mui/material'; // v5.14.0
import {
  Menu as MenuIcon,
  Settings,
  Logout,
  AccountCircle,
} from '@mui/icons-material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0
import IconButton from '../Buttons/IconButton';
import { useAuth } from '../../../hooks/useAuth';

// Props interface with strict typing
interface HeaderProps {
  onToggleSidebar: () => void;
  portalType: 'admin' | 'client';
  className?: string;
}

// User menu state interface
interface UserMenuState {
  anchorEl: HTMLElement | null;
  isOpen: boolean;
}

// Styled components with theme integration and accessibility
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[3],
  zIndex: theme.zIndex.appBar,
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
}));

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  padding: theme.spacing(0, 2),
  minHeight: 64,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  '@media (max-width: 600px)': {
    padding: theme.spacing(0, 1),
  },
}));

// Custom hook for menu state management
const useMenuHandlers = () => {
  const [menuState, setMenuState] = React.useState<UserMenuState>({
    anchorEl: null,
    isOpen: false,
  });

  const handleOpenMenu = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMenuState({
      anchorEl: event.currentTarget,
      isOpen: true,
    });
  }, []);

  const handleCloseMenu = React.useCallback(() => {
    setMenuState({
      anchorEl: null,
      isOpen: false,
    });
  }, []);

  return {
    menuState,
    handleOpenMenu,
    handleCloseMenu,
  };
};

// Main header component with memoization for performance
const Header = React.memo<HeaderProps>(({ onToggleSidebar, portalType, className }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isAuthenticated, user, logout } = useAuth();
  const { menuState, handleOpenMenu, handleCloseMenu } = useMenuHandlers();

  // Secure logout handler with error handling
  const handleLogout = React.useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
      // TODO: Add error notification
    }
    handleCloseMenu();
  }, [logout, handleCloseMenu]);

  // Render nothing if not authenticated
  if (!isAuthenticated) return null;

  return (
    <StyledAppBar className={className} component="header" role="banner">
      <StyledToolbar>
        {/* Sidebar toggle with accessibility */}
        <IconButton
          color="primary"
          ariaLabel="Toggle sidebar navigation"
          onClick={onToggleSidebar}
          size="large"
          testId="sidebar-toggle"
        >
          <MenuIcon />
        </IconButton>

        {/* Portal title with responsive text */}
        <Typography
          variant="h6"
          component="h1"
          sx={{
            display: { xs: 'none', sm: 'block' },
            color: theme.palette.text.primary,
          }}
        >
          {portalType === 'admin' ? 'Admin Portal' : 'Product Search'}
        </Typography>

        {/* User menu with accessibility */}
        <div>
          <IconButton
            color="primary"
            ariaLabel="Open user menu"
            onClick={handleOpenMenu}
            size="large"
            testId="user-menu-button"
          >
            {user?.fullName ? (
              <Avatar
                alt={user.fullName}
                src={`/api/users/${user.id}/avatar`}
                sx={{ width: 40, height: 40 }}
              />
            ) : (
              <AccountCircle />
            )}
          </IconButton>

          <Menu
            id="user-menu"
            anchorEl={menuState.anchorEl}
            open={menuState.isOpen}
            onClose={handleCloseMenu}
            keepMounted
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{
              elevation: 3,
              sx: {
                mt: 1,
                '& .MuiMenuItem-root': {
                  px: 2,
                  py: 1,
                  minHeight: 48,
                },
              },
            }}
          >
            {/* User profile section */}
            {user && (
              <MenuItem onClick={handleCloseMenu} disabled>
                <Typography variant="body2" color="textSecondary">
                  {user.fullName}
                  <br />
                  <small>{user.email}</small>
                </Typography>
              </MenuItem>
            )}

            {/* Settings option - only for admin portal */}
            {portalType === 'admin' && (
              <MenuItem
                onClick={handleCloseMenu}
                role="menuitem"
                data-testid="settings-menu-item"
              >
                <Settings sx={{ mr: 2 }} />
                <Typography>Settings</Typography>
              </MenuItem>
            )}

            {/* Logout option */}
            <MenuItem
              onClick={handleLogout}
              role="menuitem"
              data-testid="logout-menu-item"
            >
              <Logout sx={{ mr: 2 }} />
              <Typography>Logout</Typography>
            </MenuItem>
          </Menu>
        </div>
      </StyledToolbar>
    </StyledAppBar>
  );
});

// Display name for debugging
Header.displayName = 'Header';

export default Header;