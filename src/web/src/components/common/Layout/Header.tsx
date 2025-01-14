import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  Menu as MenuIcon,
  Settings,
  Logout,
  AccountCircle
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

import IconButton from '../Buttons/IconButton';
import { useAuth } from '../../../hooks/useAuth';

// Props interface for the Header component
interface HeaderProps {
  onToggleSidebar: () => void;
  portalType: 'admin' | 'client';
  className?: string;
}

// State interface for user menu handling
interface UserMenuState {
  anchorEl: HTMLElement | null;
  isOpen: boolean;
}

// Styled components with theme integration
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[3],
  zIndex: theme.zIndex.appBar,
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none'
  }
}));

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
  padding: theme.spacing(0, 2),
  minHeight: 64,
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  '@media (max-width: 600px)': {
    padding: theme.spacing(0, 1)
  }
}));

// Custom hook for menu state management
const useMenuHandlers = () => {
  const [menuState, setMenuState] = React.useState<UserMenuState>({
    anchorEl: null,
    isOpen: false
  });

  const handleMenuOpen = React.useCallback((event: React.MouseEvent<HTMLElement>) => {
    setMenuState({
      anchorEl: event.currentTarget,
      isOpen: true
    });
  }, []);

  const handleMenuClose = React.useCallback(() => {
    setMenuState({
      anchorEl: null,
      isOpen: false
    });
  }, []);

  return { menuState, handleMenuOpen, handleMenuClose };
};

// Main header component with memoization
const Header = React.memo<HeaderProps>(({ onToggleSidebar, portalType, className }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { isAuthenticated, user, logout } = useAuth();
  const { menuState, handleMenuOpen, handleMenuClose } = useMenuHandlers();

  // Handle secure logout with error handling
  const handleLogout = React.useCallback(async () => {
    try {
      await logout();
      handleMenuClose();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }, [logout, handleMenuClose]);

  return (
    <StyledAppBar position="fixed" className={className}>
      <StyledToolbar>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <IconButton
            color="primary"
            ariaLabel="Toggle sidebar"
            onClick={onToggleSidebar}
            testId="toggle-sidebar-button"
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            component="h1"
            sx={{
              ml: 2,
              display: { xs: 'none', sm: 'block' }
            }}
          >
            {portalType === 'admin' ? 'Admin Portal' : 'Product Search'}
          </Typography>
        </div>

        {isAuthenticated && user && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {!isMobile && (
              <Typography
                variant="body2"
                sx={{ mr: 2 }}
                aria-label="User name"
              >
                {user.fullName}
              </Typography>
            )}
            <IconButton
              color="primary"
              ariaLabel="User menu"
              onClick={handleMenuOpen}
              testId="user-menu-button"
            >
              {user.fullName ? (
                <Avatar
                  alt={user.fullName}
                  src=""
                  sx={{ width: 32, height: 32 }}
                >
                  {user.fullName.charAt(0)}
                </Avatar>
              ) : (
                <AccountCircle />
              )}
            </IconButton>

            <Menu
              id="user-menu"
              anchorEl={menuState.anchorEl}
              open={menuState.isOpen}
              onClose={handleMenuClose}
              keepMounted
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              PaperProps={{
                elevation: 3,
                sx: { mt: 1 }
              }}
            >
              <MenuItem
                onClick={handleMenuClose}
                aria-label="Settings"
              >
                <Settings sx={{ mr: 1 }} />
                Settings
              </MenuItem>
              <MenuItem
                onClick={handleLogout}
                aria-label="Logout"
              >
                <Logout sx={{ mr: 1 }} />
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