import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function LandingFooter() {
  const navigate = useNavigate();

  return (
    <footer className="ox-footer">
      <div className="ox-footer-grid">
        <div>
          <a href="#hero" className="ox-brand mb-3 inline-flex">
            <span>Shiro</span>
            <span className="ox-brand-dot" />
          </a>
          <p className="text-xs text-[var(--ox-text-secondary)] max-w-xs leading-relaxed">
            The intelligent study workspace that turns your learning material into understanding and lasting retention.
          </p>
        </div>

        <div className="ox-footer-col">
          <h5>Study Suite</h5>
          <ul>
            <li><a href="#showcase">Document Chat</a></li>
            <li><a href="#showcase">Active Recall Quizzes</a></li>
            <li><a href="#showcase">FSRS Spaced Repetition</a></li>
            <li><a href="#showcase">Mastery Insights</a></li>
          </ul>
        </div>

        <div className="ox-footer-col">
          <h5>Platform</h5>
          <ul>
            <li><a href="#how-it-works">How It Works</a></li>
            <li><a href="#learning-loop">Learning Loop</a></li>
            <li><a href="#problem">The Problem</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
        </div>

        <div className="ox-footer-col">
          <h5>Account</h5>
          <ul>
            <li><a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Log in</a></li>
            <li><a href="/register" onClick={(e) => { e.preventDefault(); navigate('/register'); }}>Get Started Free</a></li>
          </ul>
        </div>
      </div>

      <div className="ox-footer-bottom">
        <span>© {new Date().getFullYear()} Shiro.ai · Built for deep academic mastery.</span>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--ox-forest)]" />
          <span className="font-mono text-xs">All Systems Operational</span>
        </div>
      </div>
    </footer>
  );
}
