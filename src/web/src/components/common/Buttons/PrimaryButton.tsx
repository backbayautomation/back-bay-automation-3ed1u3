import React from 'react'; // v18.2.0
import { Button, ButtonProps } from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0

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
  /**
   * Button content supporting text, icons, or custom elements
   */
  children: React.ReactNode;
  /**
   * Button style variant determining visual appearance and emphasis
   * @default 'primary'
   */
  variant?: keyof typeof BUTTON_VARIANTS;
  /**
   * Button size affecting padding and touch target area
   * @default 'medium'
   */
  size?: keyof typeof BUTTON_SIZES;
  /**
   * Flag for full width button spanning container width
   * @default false
   */
  fullWidth?: boolean;
  /**
   * Flag for disabled state with appropriate visual and functional restrictions
   * @default false
   */
  disabled?: boolean;
  /**
   * Click event handler with type-safe event object
   */
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
  minHeight: size === 'small' ? '32px' : size === 'medium' ? '40px' : '48px',
  
  // Primary variant specific styles
  ...(variant === 'primary' && {
    backgroundColor: '#0066CC',
    color: '#FFFFFF',
    '&:hover': {
      backgroundColor: '#0052A3',
    },
    '&:active': {
      backgroundColor: '#004080',
    },
  }),

  // Focus and keyboard navigation styles
  '&:focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 3px ${theme.palette.primary.main}40`,
  },

  // Disabled state styles
  '&:disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },

  // Touch device optimizations
  '@media (hover: none)': {
    '&:hover': {
      backgroundColor: variant === 'primary' ? '#0066CC' : 'transparent',
    },
  },

  // Transition for smooth state changes
  transition: theme.transitions.create(
    ['background-color', 'box-shadow', 'border-color', 'opacity'],
    {
      duration: theme.transitions.duration.short,
    }
  ),
}));

/**
 * Primary button component providing consistent styling and behavior
 * across the application with enhanced accessibility features.
 */
const PrimaryButton = React.memo<PrimaryButtonProps>(({
  children,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  disabled = false,
  onClick,
  ...props
}) => {
  // Convert variant to Material-UI variant
  const muiVariant = BUTTON_VARIANTS[variant];

  // Handle keyboard interaction
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
    }
  };

  return (
    <StyledButton
      variant={muiVariant}
      size={size}
      fullWidth={fullWidth}
      disabled={disabled}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-disabled={disabled}
      role="button"
      tabIndex={disabled ? -1 : 0}
      {...props}
    >
      {children}
    </StyledButton>
  );
});

// Display name for debugging
PrimaryButton.displayName = 'PrimaryButton';

export default PrimaryButton;