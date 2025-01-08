import React, { useCallback, useState } from 'react';
import { AppBar, Toolbar, Typography, Avatar, Menu, MenuItem, useTheme, useMediaQuery } from '@mui/material'; // v5.14.0
import { Menu as MenuIcon, Settings, Logout, AccountCircle } from '@mui/icons-material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0
import IconButton from '../Buttons/IconButton';
import { useAuth } from '../../../hooks/useAuth';

// Props interface with strict typing
interface HeaderProps {
  onToggleSidebar: () => void;
  portalType: 'admin' | 'client';
  className?: string;
}

// Interface for user menu state management
interface UserMenuState {
  anchorEl: HTMLElement | null;
  isOpen: boolean;
}

// Styled components with theme integration and accessibility support
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
  const [menuState, setMenuState] = useState<UserMenuState>({
    anchorEl: null,
    isOpen: false,
  });

  const handleOpenMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMenuState({
      anchorEl: event.currentTarget,
      isOpen: true,
    });
  }, []);

  const handleCloseMenu = useCallback(() => {
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

// Memoized Header component with accessibility and security features
const Header: React.FC<HeaderProps> = React.memo(({ onToggleSidebar, portalType, className }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isAuthenticated, user, logout } = useAuth();
  const { menuState, handleOpenMenu, handleCloseMenu } = useMenuHandlers();

  // Secure logout handler with error handling
  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
      // Error should be handled by error boundary
    } finally {
      handleCloseMenu();
    }
  }, [logout, handleCloseMenu]);

  return (
    <StyledAppBar className={className} component="header" role="banner">
      <StyledToolbar>
        {/* Navigation controls with accessibility */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            color="primary"
            ariaLabel="Toggle sidebar navigation"
            onClick={onToggleSidebar}
            size={isMobile ? 'small' : 'medium'}
            testId="toggle-sidebar-button"
          >
            <MenuIcon />
          </IconButton>
          
          <Typography
            variant="h6"
            component="h1"
            sx={{
              ml: 2,
              display: { xs: 'none', sm: 'block' },
              color: theme.palette.text.primary,
            }}
          >
            {portalType === 'admin' ? 'Admin Portal' : 'Product Search'}
          </Typography>
        </div>

        {/* User controls with security integration */}
        {isAuthenticated && user && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <IconButton
              color="primary"
              ariaLabel="Open user menu"
              onClick={handleOpenMenu}
              size={isMobile ? 'small' : 'medium'}
              testId="user-menu-button"
            >
              {user.fullName ? (
                <Avatar
                  alt={user.fullName}
                  src={`/api/users/${user.id}/avatar`}
                  sx={{ width: 32, height: 32 }}
                />
              ) : (
                <AccountCircle />
              )}
            </IconButton>

            {/* Accessible menu with keyboard navigation */}
            <Menu
              id="user-menu"
              anchorEl={menuState.anchorEl}
              open={menuState.isOpen}
              onClose={handleCloseMenu}
              keepMounted
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{
                elevation: 0,
                sx: {
                  overflow: 'visible',
                  filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                  mt: 1.5,
                },
              }}
            >
              <MenuItem
                onClick={handleCloseMenu}
                role="menuitem"
                tabIndex={0}
              >
                <Settings sx={{ mr: 2 }} />
                Settings
              </MenuItem>
              <MenuItem
                onClick={handleLogout}
                role="menuitem"
                tabIndex={0}
              >
                <Logout sx={{ mr: 2 }} />
                Logout
              </MenuItem>
            </Menu>
          </div>
        )}
      </StyledToolbar>
    </StyledAppBar>
  );
});

Header.displayName = 'Header';

export default Header;