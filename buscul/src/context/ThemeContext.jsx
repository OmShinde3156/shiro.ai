import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('shiro-theme');
    return savedTheme || 'neon'; // Default Gen Z Neon
  });

  useEffect(() => {
    const root = window.document.body;
    // Remove all possible theme classes
    root.classList.remove('theme-neon', 'theme-solar', 'theme-midnight', 'theme-nordic', 'theme-light');
    // Add current theme class
    root.classList.add(`theme-${theme}`);
    localStorage.setItem('shiro-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    // Legacy support for the sidebar button (cycles through themes)
    const themes = ['neon', 'light', 'midnight', 'nordic', 'solar'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
