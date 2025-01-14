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

// Styled button component with comprehensive theme integration
const StyledButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'size',
})<PrimaryButtonProps>(({ theme, size = 'medium', variant = 'primary' }) => ({
  fontFamily: 'Roboto, sans-serif',
  padding: BUTTON_SIZES[size],
  borderRadius: theme.shape.borderRadius,
  textTransform: 'none',
  fontWeight: 500,
  letterSpacing: '0.02em',
  minHeight: size === 'small' ? 32 : size === 'medium' ? 40 : 48,
  
  // Variant-specific styles
  ...(variant === 'primary' && {
    backgroundColor: '#0066CC',
    color: theme.palette.common.white,
    '&:hover': {
      backgroundColor: '#0052A3',
    },
  }),

  // Focus and keyboard navigation styles
  '&:focus-visible': {
    outline: 'none',
    boxShadow: `0 0 0 3px ${theme.palette.primary.light}`,
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
 * Primary button component providing consistent styling and comprehensive accessibility
 * features across the application.
 *
 * @component
 * @example
 * ```tsx
 * <PrimaryButton
 *   variant="primary"
 *   size="medium"
 *   onClick={handleClick}
 * >
 *   Click Me
 * </PrimaryButton>
 * ```
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
  // Handle keyboard interaction for accessibility
  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick?.(event as unknown as React.MouseEvent<HTMLButtonElement>);
    }
  }, [onClick]);

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
      disableElevation
      disableRipple={false}
      {...props}
    >
      {children}
    </StyledButton>
  );
});

PrimaryButton.displayName = 'PrimaryButton';

export default PrimaryButton;