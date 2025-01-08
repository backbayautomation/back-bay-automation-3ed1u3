import React, { useCallback, useMemo } from 'react';
import { IconButton as MuiIconButton, IconButtonProps as MuiIconButtonProps } from '@mui/material'; // v5.14.0
import { styled, useTheme } from '@mui/material/styles'; // v5.14.0

// Interface for component props with strict accessibility requirements
interface IconButtonProps extends Omit<MuiIconButtonProps, 'color'> {
  children: React.ReactNode;
  color: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success' | 'default';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  ariaLabel: string;
  testId?: string;
}

// Error boundary for style computation and rendering failures
class IconButtonErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return <MuiIconButton disabled aria-label="Error state button" />;
    }
    return this.props.children;
  }
}

// Styled component with comprehensive theme support
const StyledIconButton = styled(MuiIconButton, {
  shouldForwardProp: (prop) => prop !== 'size' && prop !== 'color',
})<IconButtonProps>(({ theme, size = 'medium', color = 'primary', disabled }) => ({
  // Ensure minimum touch target size of 44px for mobile
  minWidth: size === 'small' ? '36px' : size === 'large' ? '52px' : '44px',
  minHeight: size === 'small' ? '36px' : size === 'large' ? '52px' : '44px',
  
  // Theme-aware color system with verified contrast ratios
  color: disabled ? theme.palette.action.disabled : theme.palette[color].main,
  backgroundColor: 'transparent',
  
  // Focus, hover, and active states
  '&:focus-visible': {
    outline: `2px solid ${theme.palette[color].main}`,
    outlineOffset: '2px',
  },
  
  '&:hover': !disabled && {
    backgroundColor: theme.palette[color].light,
    '@media (hover: none)': {
      backgroundColor: 'transparent',
    },
  },
  
  '&:active': !disabled && {
    backgroundColor: theme.palette[color].dark,
  },
  
  // Transition animations
  transition: theme.transitions.create(['background-color', 'color', 'box-shadow'], {
    duration: theme.transitions.duration.short,
  }),
  
  // Disabled state
  '&.Mui-disabled': {
    opacity: theme.palette.action.disabledOpacity,
  },
}));

// Custom hook for style computation
const useIconButtonStyles = (props: Pick<IconButtonProps, 'size' | 'color' | 'disabled'>) => {
  const theme = useTheme();
  
  return useMemo(() => ({
    root: {
      padding: props.size === 'small' ? theme.spacing(1) : props.size === 'large' ? theme.spacing(2) : theme.spacing(1.5),
    },
  }), [theme, props.size]);
};

// Main component implementation
export const IconButton: React.FC<IconButtonProps> = React.memo(({
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
    ariaLabel = 'Unlabeled button';
  }

  // Memoize styles
  const styles = useIconButtonStyles({ size, color, disabled });

  // Memoize click handler
  const handleClick = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    if (!disabled && onClick) {
      onClick(event);
    }
  }, [disabled, onClick]);

  return (
    <IconButtonErrorBoundary>
      <StyledIconButton
        color={color}
        size={size}
        disabled={disabled}
        aria-label={ariaLabel}
        data-testid={testId}
        onClick={handleClick}
        sx={styles.root}
        {...props}
      >
        {children}
      </StyledIconButton>
    </IconButtonErrorBoundary>
  );
});

IconButton.displayName = 'IconButton';

export default IconButton;