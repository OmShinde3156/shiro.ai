import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

export default function LandingNav({ theme, toggleTheme }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const isAuthenticated = Boolean(user && token);

  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        setScrollProgress(window.scrollY / totalScroll);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const closeMobile = () => setMobileMenuOpen(false);

  return (
    <header className={`ox-header-wrap ${scrolled ? 'scrolled' : ''}`}>
      <div className="ox-header-inner">
        <a href="#hero" className="ox-brand">
          <span>Shiro</span>
          <span className="ox-brand-dot" />
        </a>

        {/* Desktop Navigation Links */}
        <ul className="ox-nav-menu">
          <li><a href="#sandbox">Live Demo</a></li>
          <li><a href="#problem">The Problem</a></li>
          <li><a href="#how-it-works">How It Works</a></li>
          <li><a href="#showcase">Product Suite</a></li>
          <li><a href="#learning-loop">Learning Loop</a></li>
          <li><a href="#faq">FAQ</a></li>
        </ul>

        {/* Right Actions */}
        <div className="ox-nav-actions">
          <button
            onClick={toggleTheme}
            className="ox-theme-toggle"
            aria-label="Toggle Dark/Light Mode"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          >
            <span className="material-symbols-outlined text-sm">
              {theme === 'dark' ? 'light_mode' : 'dark_mode'}
            </span>
          </button>
          {isAuthenticated ? (
            <button
              onClick={() => navigate('/home')}
              className="ox-btn-forest"
            >
              <span>Go to App</span>
              <span className="material-symbols-outlined text-xs">arrow_forward</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="ox-btn-login hidden sm:inline-block"
              >
                Log in
              </button>
              <button
                onClick={() => navigate('/register')}
                className="ox-btn-forest"
              >
                <span>Get Started Free</span>
                <span className="material-symbols-outlined text-xs">arrow_forward</span>
              </button>
            </>
          )}
          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="ox-hamburger-btn"
            aria-label="Open Mobile Menu"
          >
            <span className="material-symbols-outlined text-base">
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>
      </div>

      {/* Slim Reading Progress Indicator */}
      <div
        className="ox-nav-progress"
        style={{ transform: `scaleX(${scrollProgress})` }}
      />

      {/* Mobile Drawer & Overlay */}
      {mobileMenuOpen && (
        <>
          <div className="ox-mobile-overlay" onClick={closeMobile} />
          <div className="ox-mobile-drawer">
            <div>
              <div className="flex justify-between items-center mb-6">
                <a href="#hero" className="ox-brand" onClick={closeMobile}>
                  <span>Shiro</span>
                  <span className="ox-brand-dot" />
                </a>
                <button
                  onClick={closeMobile}
                  className="bg-transparent border-none text-[var(--ox-text-main)] cursor-pointer"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>

              <ul className="list-none p-0 m-0 space-y-4 text-base font-semibold">
                <li><a href="#sandbox" onClick={closeMobile} className="text-[var(--ox-text-secondary)] hover:text-[var(--ox-text-main)] block py-1">Live Demo</a></li>
                <li><a href="#problem" onClick={closeMobile} className="text-[var(--ox-text-secondary)] hover:text-[var(--ox-text-main)] block py-1">The Problem</a></li>
                <li><a href="#how-it-works" onClick={closeMobile} className="text-[var(--ox-text-secondary)] hover:text-[var(--ox-text-main)] block py-1">How It Works</a></li>
                <li><a href="#showcase" onClick={closeMobile} className="text-[var(--ox-text-secondary)] hover:text-[var(--ox-text-main)] block py-1">Product Suite</a></li>
                <li><a href="#learning-loop" onClick={closeMobile} className="text-[var(--ox-text-secondary)] hover:text-[var(--ox-text-main)] block py-1">Learning Loop</a></li>
                <li><a href="#faq" onClick={closeMobile} className="text-[var(--ox-text-secondary)] hover:text-[var(--ox-text-main)] block py-1">FAQ</a></li>
              </ul>
            </div>

            <div className="space-y-3 pt-6 border-t border-[var(--ox-border)]">
              {isAuthenticated ? (
                <button
                  onClick={() => { closeMobile(); navigate('/home'); }}
                  className="ox-btn-forest w-full justify-center"
                >
                  <span>Go to App</span>
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={() => { closeMobile(); navigate('/login'); }}
                    className="ox-btn-secondary w-full justify-center"
                  >
                    Log in
                  </button>
                  <button
                    onClick={() => { closeMobile(); navigate('/register'); }}
                    className="ox-btn-forest w-full justify-center"
                  >
                    <span>Get Started Free</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
