import { createContext, useContext, useEffect, useMemo, useCallback, ReactNode } from 'react'; // v18.2.0
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'; // v5.14.0
import { lightTheme, darkTheme } from '../config/theme';
import useLocalStorage from '../hooks/useLocalStorage';

/**
 * Interface defining the theme context value with enhanced accessibility features
 */
interface ThemeContextType {
  theme: typeof lightTheme | typeof darkTheme;
  isDarkMode: boolean;
  toggleTheme: () => void;
  systemPreference: 'light' | 'dark' | 'no-preference';
}

/**
 * Create theme context with type safety and null check
 */
const ThemeContext = createContext<ThemeContextType | null>(null);

/**
 * Props interface for ThemeProvider component
 */
interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Enhanced ThemeProvider component with accessibility features and system preference detection
 */
export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  // Initialize theme state with localStorage persistence
  const [isDarkMode, setIsDarkMode, , isLoading] = useLocalStorage<boolean>(
    'theme-mode',
    false,
    {
      syncTabs: true // Enable cross-tab synchronization
    }
  );

  // Track system color scheme preference
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark' | 'no-preference'>('no-preference');

  // Initialize system preference detection
  useEffect(() => {
    // Create media query for dark mode preference
    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const lightModeQuery = window.matchMedia('(prefers-color-scheme: light)');

    const handleSystemPreference = () => {
      if (darkModeQuery.matches) {
        setSystemPreference('dark');
      } else if (lightModeQuery.matches) {
        setSystemPreference('light');
      } else {
        setSystemPreference('no-preference');
      }
    };

    // Set initial preference
    handleSystemPreference();

    // Listen for system preference changes
    darkModeQuery.addEventListener('change', handleSystemPreference);
    lightModeQuery.addEventListener('change', handleSystemPreference);

    return () => {
      darkModeQuery.removeEventListener('change', handleSystemPreference);
      lightModeQuery.removeEventListener('change', handleSystemPreference);
    };
  }, []);

  // Sync theme with system preference if no stored preference
  useEffect(() => {
    if (isLoading) return;

    const storedPreference = localStorage.getItem('theme-mode');
    if (!storedPreference && systemPreference !== 'no-preference') {
      setIsDarkMode(systemPreference === 'dark');
    }
  }, [systemPreference, isLoading, setIsDarkMode]);

  // Memoized theme toggle handler with smooth transition
  const toggleTheme = useCallback(() => {
    // Add transition class for smooth theme switching
    document.documentElement.classList.add('theme-transition');
    setIsDarkMode(prev => !prev);
    
    // Remove transition class after animation completes
    const timeout = setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 300);

    return () => clearTimeout(timeout);
  }, [setIsDarkMode]);

  // Memoized theme object to prevent unnecessary re-renders
  const theme = useMemo(() => isDarkMode ? darkTheme : lightTheme, [isDarkMode]);

  // Memoized context value
  const contextValue = useMemo<ThemeContextType>(() => ({
    theme,
    isDarkMode,
    toggleTheme,
    systemPreference
  }), [theme, isDarkMode, toggleTheme, systemPreference]);

  // Apply theme-specific body classes for global styles
  useEffect(() => {
    document.body.classList.toggle('dark-mode', isDarkMode);
    document.body.classList.toggle('light-mode', !isDarkMode);
  }, [isDarkMode]);

  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={theme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

/**
 * Custom hook to access theme context with type safety
 * @throws {Error} If used outside of ThemeProvider
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};

export default ThemeProvider;