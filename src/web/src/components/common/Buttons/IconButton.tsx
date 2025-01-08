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

// Custom hook for computing styles based on theme and props
const useIconButtonStyles = (props: Pick<IconButtonProps, 'size' | 'color' | 'disabled'>) => {
  const theme = useTheme();

  return React.useMemo(() => {
    // Size mapping ensuring minimum 44px touch target for mobile
    const sizeMap = {
      small: {
        padding: theme.spacing(1),
        minWidth: '44px',
        minHeight: '44px',
      },
      medium: {
        padding: theme.spacing(1.5),
        minWidth: '48px',
        minHeight: '48px',
      },
      large: {
        padding: theme.spacing(2),
        minWidth: '56px',
        minHeight: '56px',
      },
    };

    return {
      ...sizeMap[props.size || 'medium'],
      color: props.disabled ? theme.palette.action.disabled : theme.palette[props.color].main,
      '&:hover': {
        backgroundColor: props.disabled ? 'transparent' : theme.palette[props.color].light,
      },
    };
  }, [theme, props.size, props.color, props.disabled]);
};

// Styled component with enhanced accessibility and theme support
const StyledIconButton = styled(MuiIconButton, {
  shouldForwardProp: (prop) => !['testId'].includes(prop as string),
})<IconButtonProps>(({ theme, size, color, disabled }) => ({
  borderRadius: theme.shape.borderRadius,
  transition: theme.transitions.create(['background-color', 'box-shadow', 'border-color', 'color'], {
    duration: theme.transitions.duration.short,
  }),
  
  // Base styles
  ...useIconButtonStyles({ size, color, disabled }),
  
  // Focus visible styles for accessibility
  '&.Mui-focusVisible': {
    outline: `3px solid ${theme.palette[color].main}`,
    outlineOffset: '2px',
  },
  
  // Active state styles
  '&:active': {
    backgroundColor: disabled ? 'transparent' : theme.palette[color].dark,
  },
  
  // Ensure sufficient color contrast for accessibility
  '@media (prefers-contrast: more)': {
    outline: `2px solid ${theme.palette[color].dark}`,
  },
  
  // Disabled state styles
  '&.Mui-disabled': {
    opacity: theme.palette.action.disabledOpacity,
    cursor: 'not-allowed',
  },
}));

// Error boundary for the component
class IconButtonErrorBoundary extends React.Component<{ children: React.ReactNode }> {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('IconButton Error:', error, errorInfo);
  }

  render() {
    return this.props.children;
  }
}

// Main component implementation with memoization
const IconButton = React.memo<IconButtonProps>(({
  children,
  color = 'primary',
  size = 'medium',
  disabled = false,
  ariaLabel,
  testId,
  ...props
}) => {
  // Validate required props
  if (!ariaLabel) {
    console.error('IconButton: ariaLabel prop is required for accessibility');
  }

  return (
    <IconButtonErrorBoundary>
      <StyledIconButton
        color={color}
        size={size}
        disabled={disabled}
        aria-label={ariaLabel}
        data-testid={testId}
        {...props}
      >
        {children}
      </StyledIconButton>
    </IconButtonErrorBoundary>
  );
});

// Display name for debugging
IconButton.displayName = 'IconButton';

export default IconButton;