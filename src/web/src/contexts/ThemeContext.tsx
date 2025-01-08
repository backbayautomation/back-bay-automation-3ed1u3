import { createContext, useContext, useEffect, useCallback, useMemo, ReactNode } from 'react'; // v18.2.0
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles'; // v5.14.0
import { lightTheme, darkTheme } from '../config/theme';
import useLocalStorage from '../hooks/useLocalStorage';

// Theme context type definition with enhanced accessibility features
interface ThemeContextType {
  theme: typeof lightTheme | typeof darkTheme;
  isDarkMode: boolean;
  toggleTheme: () => void;
  systemPreference: 'light' | 'dark' | 'no-preference';
}

// Create context with strict type checking
const ThemeContext = createContext<ThemeContextType | null>(null);

// Storage key for theme preference
const THEME_STORAGE_KEY = 'theme_preference';

// Media query for system color scheme preference
const DARK_MODE_MEDIA_QUERY = '(prefers-color-scheme: dark)';

interface ThemeProviderProps {
  children: ReactNode;
}

/**
 * Enhanced theme provider component with accessibility features and system preference detection
 */
export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  // Initialize theme state with localStorage persistence
  const [isDarkMode, setIsDarkMode, , isLoading] = useLocalStorage<boolean>(
    THEME_STORAGE_KEY,
    false,
    {
      encrypt: false, // No need to encrypt theme preference
      expiresIn: 365 * 24 * 60 * 60 * 1000, // 1 year expiration
    }
  );

  // Track system color scheme preference
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark' | 'no-preference'>('no-preference');

  // Memoized theme toggle handler with smooth transition
  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => !prev);
    // Apply transition class for smooth theme switching
    document.documentElement.classList.add('theme-transition');
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 300);
  }, [setIsDarkMode]);

  // Set up system preference detection
  useEffect(() => {
    const mediaQuery = window.matchMedia(DARK_MODE_MEDIA_QUERY);

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
      // Only auto-switch theme if user hasn't explicitly set a preference
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        setIsDarkMode(e.matches);
      }
    };

    // Initial check
    handleChange(mediaQuery);

    // Listen for system preference changes
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        // Fallback cleanup
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [setIsDarkMode]);

  // Update document level attributes for accessibility
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    // Set color-scheme CSS property for native elements
    document.documentElement.style.setProperty('color-scheme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  // Memoized theme context value
  const themeContextValue = useMemo<ThemeContextType>(
    () => ({
      theme: isDarkMode ? darkTheme : lightTheme,
      isDarkMode,
      toggleTheme,
      systemPreference,
    }),
    [isDarkMode, toggleTheme, systemPreference]
  );

  // Show loading state or error fallback if theme fails to load
  if (isLoading) {
    return null; // Or a loading spinner if needed
  }

  return (
    <ThemeContext.Provider value={themeContextValue}>
      <MuiThemeProvider theme={themeContextValue.theme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

/**
 * Custom hook to access theme context with type safety
 * @throws {Error} When used outside of ThemeProvider
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
};

// Add theme transition styles to head
const style = document.createElement('style');
style.textContent = `
  .theme-transition,
  .theme-transition *,
  .theme-transition *:before,
  .theme-transition *:after {
    transition: all 300ms !important;
    transition-delay: 0 !important;
  }
`;
document.head.appendChild(style);