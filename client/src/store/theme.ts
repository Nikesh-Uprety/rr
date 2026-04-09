import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'warm';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

function applyThemeToRoot(theme: Theme, disableTransitions = true) {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;
  if (disableTransitions) root.classList.add('theme-switching');

  root.classList.remove('light', 'dark', 'warm');
  root.classList.add(theme);
  root.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  localStorage.setItem('theme', theme);

  if (disableTransitions) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        root.classList.remove('theme-switching');
      });
    });
  }
}

export const useThemeStore = create<ThemeState>((set) => {
  const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'light';
    const savedTheme = localStorage.getItem('theme') as Theme;
    if (savedTheme && ['light', 'dark', 'warm'].includes(savedTheme)) {
      return savedTheme;
    }
    return 'light';
  };

  const initialTheme = getInitialTheme();
  
  if (typeof window !== 'undefined') {
    applyThemeToRoot(initialTheme, false);
  }

  return {
    theme: initialTheme,
    setTheme: (theme) => {
      applyThemeToRoot(theme, true);
      set({ theme });
    },
  };
});
