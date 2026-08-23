import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('shiro-theme');
    return savedTheme === 'light' ? 'light' : 'dark'; // Default Dark
  });

  useEffect(() => {
    const root = window.document.body;
    // Remove all possible theme classes
    root.classList.remove('theme-dark', 'theme-light', 'theme-neon', 'theme-solar', 'theme-midnight', 'theme-nordic');
    // Add current theme class
    root.classList.add(`theme-${theme}`);
    localStorage.setItem('shiro-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
