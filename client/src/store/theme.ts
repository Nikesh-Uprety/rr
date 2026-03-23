import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'warm';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => {
  const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'light';
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme && ['light', 'dark', 'warm'].includes(savedTheme)) {
      return savedTheme;
    }
    const hour = new Date().getHours();
    return hour >= 6 && hour < 18 ? 'light' : 'dark';
  };

  const initialTheme = getInitialTheme();
  
  if (typeof window !== 'undefined') {
    document.documentElement.classList.remove('light', 'dark', 'warm');
    document.documentElement.classList.add(initialTheme);
  }

  return {
    theme: initialTheme,
    setTheme: (theme) => {
      if (typeof window !== 'undefined') {
        document.documentElement.classList.remove('light', 'dark', 'warm');
        document.documentElement.classList.add(theme);
        localStorage.setItem('theme', theme);
      }
      set({ theme });
    },
  };
});
