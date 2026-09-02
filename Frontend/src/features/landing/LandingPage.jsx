import React, { useState, useEffect } from 'react';
import LandingNav from './components/LandingNav';
import LandingFooter from './components/LandingFooter';
import HeroSection from './sections/HeroSection';
import InteractiveSandbox from './sections/InteractiveSandbox';
import ProblemSection from './sections/ProblemSection';
import TransformationSection from './sections/TransformationSection';
import ShowcaseSection from './sections/ShowcaseSection';
import LearningLoopSection from './sections/LearningLoopSection';
import TestimonialsSection from './sections/TestimonialsSection';
import FaqSection from './sections/FaqSection';
import FinalCtaSection from './sections/FinalCtaSection';
import './landing.css';

const useLandingTheme = () => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('shiro-oxford-theme');
    if (saved) return saved;
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  });

  useEffect(() => {
    localStorage.setItem('shiro-oxford-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return { theme, toggleTheme };
};

export default function LandingPage() {
  const { theme, toggleTheme } = useLandingTheme();

  return (
    <div className={`oxford-landing ${theme === 'dark' ? 'theme-dark' : ''}`}>
      {/* Subtle Archival Paper Texture */}
      <div className="oxford-paper-texture" />

      {/* Floating Header with Reading Progress */}
      <LandingNav theme={theme} toggleTheme={toggleTheme} />

      {/* Editorial Narrative Flow */}
      <main>
        <HeroSection />
        <InteractiveSandbox />
        <ProblemSection />
        <TransformationSection />
        <ShowcaseSection />
        <LearningLoopSection />
        <TestimonialsSection />
        <FaqSection />
        <FinalCtaSection />
      </main>

      {/* Minimal Footer */}
      <LandingFooter />
    </div>
  );
}
