import React, { createContext, useState, useContext, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('shiro-theme');
    return savedTheme === 'light' ? 'light' : 'dark';
  });

  const [accent, setAccent] = useState(() => {
    return localStorage.getItem('shiro_accent_color') || 'sage';
  });

  const [density, setDensity] = useState(() => {
    return localStorage.getItem('shiro_ui_density') || 'comfortable';
  });

  const [fontSize, setFontSize] = useState(() => {
    return parseInt(localStorage.getItem('shiro_font_scale') || '100', 10);
  });

  const [animations, setAnimations] = useState(() => {
    return localStorage.getItem('shiro_animations') !== 'reduced';
  });

  // Apply Theme Mode
  useEffect(() => {
    const body = window.document.body;
    const docEl = window.document.documentElement;
    body.classList.remove('theme-dark', 'theme-light', 'theme-neon', 'theme-solar', 'theme-midnight', 'theme-nordic');
    body.classList.add(`theme-${theme}`);
    docEl.setAttribute('data-theme', theme);
    localStorage.setItem('shiro-theme', theme);
  }, [theme]);

  // Apply Accent Color
  useEffect(() => {
    window.document.body.setAttribute('data-accent', accent);
    localStorage.setItem('shiro_accent_color', accent);
  }, [accent]);

  // Apply UI Density
  useEffect(() => {
    window.document.body.setAttribute('data-density', density);
    localStorage.setItem('shiro_ui_density', density);
  }, [density]);

  // Apply Font Scale
  useEffect(() => {
    window.document.documentElement.style.fontSize = `${fontSize}%`;
    localStorage.setItem('shiro_font_scale', fontSize.toString());
  }, [fontSize]);

  // Apply Reduced Motion / Fluid Animations
  useEffect(() => {
    window.document.body.setAttribute('data-reduced-motion', (!animations).toString());
    localStorage.setItem('shiro_animations', animations ? 'full' : 'reduced');
  }, [animations]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const updateAppearance = (newSettings) => {
    if (newSettings.theme !== undefined) setTheme(newSettings.theme);
    if (newSettings.accent !== undefined) setAccent(newSettings.accent);
    if (newSettings.density !== undefined) setDensity(newSettings.density);
    if (newSettings.fontSize !== undefined) setFontSize(newSettings.fontSize);
    if (newSettings.animations !== undefined) setAnimations(newSettings.animations);
  };

  return (
    <ThemeContext.Provider value={{ 
      theme, 
      setTheme, 
      toggleTheme,
      accent,
      setAccent,
      density,
      setDensity,
      fontSize,
      setFontSize,
      animations,
      setAnimations,
      updateAppearance
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
