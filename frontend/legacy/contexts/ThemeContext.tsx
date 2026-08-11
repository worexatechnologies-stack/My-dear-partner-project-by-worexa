'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'mixed' | 'boy' | 'girl';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('mixed');

  useEffect(() => {
    const saved = localStorage.getItem('app-theme') as Theme | null;
    if (saved && ['mixed', 'boy', 'girl'].includes(saved)) setTheme(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
