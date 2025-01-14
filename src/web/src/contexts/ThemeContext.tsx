import { createContext, useContext, ReactNode, useEffect, useCallback, useMemo } from 'react'; // v18.2.0
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'; // v5.14.0
import { lightTheme, darkTheme } from '../config/theme';
import { useLocalStorage } from '../hooks/useLocalStorage';

/**
 * Theme context interface with enhanced accessibility features
 */
interface ThemeContextType {
  theme: typeof lightTheme;
  isDarkMode: boolean;
  toggleTheme: () => void;
  systemPreference: 'light' | 'dark' | 'no-preference';
}

/**
 * Theme provider props interface
 */
interface ThemeProviderProps {
  children: ReactNode;
}

// Create theme context with type safety
const ThemeContext = createContext<ThemeContextType | null>(null);

/**
 * Enhanced theme provider component with accessibility features and system preference detection
 */
export const ThemeProvider = ({ children }: ThemeProviderProps): JSX.Element => {
  // Initialize theme state with localStorage persistence
  const [isDarkMode, setIsDarkMode, , isLoading] = useLocalStorage<boolean>(
    'theme-mode',
    false,
    { encrypt: false }
  );

  // Track system color scheme preference
  const [systemPreference, setSystemPreference] = useLocalStorage<'light' | 'dark' | 'no-preference'>(
    'system-preference',
    'no-preference',
    { encrypt: false }
  );

  /**
   * Handle system preference changes with media query
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      const newPreference = e.matches ? 'dark' : 'light';
      setSystemPreference(newPreference);
      
      // Auto-switch theme if no explicit user preference
      if (!localStorage.getItem('theme-mode')) {
        setIsDarkMode(e.matches);
      }
    };

    // Initial check
    handleChange(mediaQuery);

    // Listen for changes
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [setSystemPreference, setIsDarkMode]);

  /**
   * Memoized theme toggle handler with smooth transition
   */
  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => !prev);
    
    // Apply transition class for smooth theme switching
    document.documentElement.classList.add('theme-transition');
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 300);
  }, [setIsDarkMode]);

  /**
   * Memoized context value to prevent unnecessary re-renders
   */
  const contextValue = useMemo<ThemeContextType>(
    () => ({
      theme: isDarkMode ? darkTheme : lightTheme,
      isDarkMode,
      toggleTheme,
      systemPreference
    }),
    [isDarkMode, toggleTheme, systemPreference]
  );

  /**
   * Apply high contrast mode for better accessibility when needed
   */
  useEffect(() => {
    const isHighContrast = window.matchMedia('(forced-colors: active)').matches;
    if (isHighContrast) {
      document.documentElement.setAttribute('data-high-contrast', 'true');
    }
  }, []);

  // Show loading state or fallback UI while theme is initializing
  if (isLoading) {
    return <div aria-busy="true" role="status">Loading theme preferences...</div>;
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={contextValue.theme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

/**
 * Custom hook for accessing theme context with type safety
 * @throws {Error} When used outside of ThemeProvider
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};

// Default export for convenient imports
export default ThemeProvider;