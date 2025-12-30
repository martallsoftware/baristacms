import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { settingsService } from '../services/api';

export type ThemeColor = 'barista' | 'blue' | 'green' | 'purple' | 'red' | 'orange' | 'teal';

export const themeOptions: { value: ThemeColor; label: string; color: string }[] = [
  { value: 'barista', label: 'Barista Brown', color: '#b97738' },
  { value: 'blue', label: 'Blue', color: '#2563eb' },
  { value: 'green', label: 'Green', color: '#16a34a' },
  { value: 'purple', label: 'Purple', color: '#9333ea' },
  { value: 'red', label: 'Red', color: '#dc2626' },
  { value: 'orange', label: 'Orange', color: '#ea580c' },
  { value: 'teal', label: 'Teal', color: '#0d9488' },
];

interface ThemeContextType {
  theme: ThemeColor;
  setTheme: (theme: ThemeColor) => void;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeColor>('barista');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTheme();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const loadTheme = async () => {
    try {
      const settings = await settingsService.getAll();
      if (settings.theme_color?.value) {
        const savedTheme = settings.theme_color.value as ThemeColor;
        if (themeOptions.some(opt => opt.value === savedTheme)) {
          setThemeState(savedTheme);
        }
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    } finally {
      setLoading(false);
    }
  };

  const setTheme = (newTheme: ThemeColor) => {
    setThemeState(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}
