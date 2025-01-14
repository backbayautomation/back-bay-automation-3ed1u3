import React from 'react';
import { IconButton as MuiIconButton, IconButtonProps as MuiIconButtonProps } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';

// Interface for component props extending MUI IconButton props
interface IconButtonProps extends Omit<MuiIconButtonProps, 'color'> {
  children: React.ReactNode;
  color: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'default';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  ariaLabel: string;
  testId?: string;
}

// Size configurations ensuring minimum 44px touch target for mobile
const sizeMap = {
  small: {
    width: '40px',
    height: '40px',
    padding: '8px',
  },
  medium: {
    width: '48px',
    height: '48px',
    padding: '12px',
  },
  large: {
    width: '56px',
    height: '56px',
    padding: '16px',
  },
};

// Styled component with comprehensive theme support
const StyledIconButton = styled(MuiIconButton, {
  shouldForwardProp: (prop) => prop !== 'color',
})<IconButtonProps>(({ theme, size = 'medium', color = 'primary', disabled }) => ({
  ...sizeMap[size],
  minWidth: '44px', // WCAG touch target requirement
  minHeight: '44px',
  borderRadius: '50%',
  transition: theme.transitions.create(['background-color', 'box-shadow', 'transform'], {
    duration: theme.transitions.duration.short,
  }),
  color: disabled
    ? theme.palette.action.disabled
    : color === 'default'
    ? theme.palette.text.primary
    : theme.palette[color].main,
  backgroundColor: 'transparent',

  '&:hover': {
    backgroundColor: disabled
      ? 'transparent'
      : theme.palette[color === 'default' ? 'action' : color].hover,
    transform: disabled ? 'none' : 'scale(1.05)',
  },

  '&:active': {
    transform: disabled ? 'none' : 'scale(0.95)',
  },

  '&.Mui-focusVisible': {
    outline: `2px solid ${theme.palette[color === 'default' ? 'primary' : color].main}`,
    outlineOffset: '2px',
  },

  '@media (max-width: 600px)': {
    ...sizeMap[size === 'small' ? 'medium' : size], // Ensure larger touch targets on mobile
  },
}));

// Custom hook for style computation memoization
const useIconButtonStyles = React.useMemo(
  () => (props: Pick<IconButtonProps, 'size' | 'color' | 'disabled'>) => {
    const theme = useTheme();
    return {
      root: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
      },
    };
  },
  []
);

// Error boundary component for IconButton
class IconButtonErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return null; // Graceful degradation
    }
    return this.props.children;
  }
}

// Main IconButton component with memoization
const IconButton = React.memo<IconButtonProps>(({
  children,
  color = 'primary',
  size = 'medium',
  disabled = false,
  ariaLabel,
  testId,
  onClick,
  ...props
}) => {
  // Validate required props
  if (!ariaLabel) {
    console.error('IconButton: ariaLabel prop is required for accessibility');
  }

  // Memoize event handler
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!disabled && onClick) {
        onClick(event);
      }
    },
    [disabled, onClick]
  );

  // Apply styles
  const styles = useIconButtonStyles({ size, color, disabled });

  return (
    <IconButtonErrorBoundary>
      <StyledIconButton
        {...props}
        color={color}
        size={size}
        disabled={disabled}
        onClick={handleClick}
        aria-label={ariaLabel}
        data-testid={testId}
        sx={styles.root}
      >
        {children}
      </StyledIconButton>
    </IconButtonErrorBoundary>
  );
});

// Display name for debugging
IconButton.displayName = 'IconButton';

export default IconButton;