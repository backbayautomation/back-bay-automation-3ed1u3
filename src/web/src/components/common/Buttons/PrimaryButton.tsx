// @mui/material version: 5.14.0
// react version: 18.2.0

import React from 'react';
import { Button, ButtonProps } from '@mui/material';
import { styled } from '@mui/material/styles';

// Button size constants for consistent spacing
const BUTTON_SIZES = {
  small: '8px 16px',
  medium: '12px 24px',
  large: '16px 32px',
} as const;

// Button variant mapping to Material-UI variants
const BUTTON_VARIANTS = {
  primary: 'contained',
  secondary: 'outlined',
  text: 'text',
} as const;

// Extended props interface for enhanced button customization
export interface PrimaryButtonProps extends ButtonProps {
  children: React.ReactNode;
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  fullWidth?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

// Styled button component with theme integration and enhanced features
const StyledButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'size',
})<PrimaryButtonProps>(({ theme, size = 'medium', variant = 'primary' }) => ({
  fontFamily: 'Roboto, sans-serif',
  padding: BUTTON_SIZES[size],
  borderRadius: '4px',
  textTransform: 'none',
  fontWeight: 500,
  letterSpacing: '0.02em',
  transition: theme.transitions.create(
    ['background-color', 'box-shadow', 'border-color', 'opacity'],
    { duration: theme.transitions.duration.short }
  ),

  // Primary variant styles
  ...(variant === 'primary' && {
    backgroundColor: '#0066CC',
    color: theme.palette.common.white,
    '&:hover': {
      backgroundColor: '#0052A3',
    },
    '&:active': {
      backgroundColor: '#004489',
    },
  }),

  // Focus state for keyboard navigation
  '&.Mui-focusVisible': {
    boxShadow: `0 0 0 3px ${theme.palette.primary.light}`,
    outline: 'none',
  },

  // Disabled state styling
  '&.Mui-disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },

  // Mobile touch feedback
  '@media (hover: none)': {
    '&:hover': {
      backgroundColor: variant === 'primary' ? '#0066CC' : 'transparent',
    },
  },

  // Size-specific touch targets for mobile
  '@media (max-width: 600px)': {
    minHeight: size === 'small' ? '32px' : size === 'medium' ? '40px' : '48px',
    minWidth: size === 'small' ? '64px' : size === 'medium' ? '88px' : '112px',
  },
}));

// Memoized primary button component with comprehensive accessibility
const PrimaryButton = React.memo<PrimaryButtonProps>(({
  children,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled = false,
  onClick,
  ...props
}) => {
  // Handle keyboard interaction
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
    }
  };

  return (
    <StyledButton
      variant={BUTTON_VARIANTS[variant]}
      size={size}
      fullWidth={fullWidth}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      disableElevation
      disableRipple={false}
      {...props}
    >
      {children}
    </StyledButton>
  );
});

// Display name for development tooling
PrimaryButton.displayName = 'PrimaryButton';

export default PrimaryButton;