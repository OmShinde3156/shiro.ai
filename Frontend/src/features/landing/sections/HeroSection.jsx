import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp } from '../motion/variants';

export default function HeroSection() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('tutor');

  return (
    <section id="hero" className="ox-hero">
      <div className="ox-hero-grid">
        {/* Left Column: Editorial Headline & Actions */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <div className="ox-eyebrow">
            <span className="w-2 h-2 rounded-full bg-[var(--ox-forest)]" />
            <span>Your Personal Learning System</span>
          </div>

          <h1 className="ox-hero-h1">
            Turn your study material into <em>active learning.</em>
          </h1>

          <p className="ox-hero-p">
            Shiro turns your notes, textbooks, and lecture slides into grounded pedagogical conversations, active recall quizzes, FSRS flashcards, and personalized study sessions.
          </p>

          <div className="ox-hero-ctas">
            <button
              onClick={() => navigate('/register')}
              className="ox-btn-forest text-base py-3 px-8 shadow-md"
            >
              <span>Get Started Free</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
            <a
              href="#how-it-works"
              className="ox-btn-secondary text-base py-3 px-6"
            >
              <span>See how it works</span>
            </a>
          </div>

          <div className="pt-2">
            <span className="text-xs font-mono text-[var(--ox-text-muted)] uppercase tracking-wider block mb-1">
              Engineered for Focused Mastery
            </span>
            <span className="text-xs font-semibold text-[var(--ox-text-secondary)]">
              GATE · Computer Science · Medicine · Engineering · Law · Research
            </span>
          </div>
        </motion.div>

        {/* Right Column: Real Shiro Workspace Preview */}
        <motion.div
          className="ox-preview-frame"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0.2}
        >
          <div className="ox-frame-header">
            <div className="ox-frame-title">
              <span className="material-symbols-outlined text-xs text-[var(--ox-forest)]">description</span>
              <span>Distributed_Systems_Lectures.pdf</span>
            </div>
            <div className="flex gap-1 bg-[var(--ox-bg-root)] p-1 rounded-lg border border-[var(--ox-border)]">
              {[
                { id: 'tutor', label: 'Tutor', icon: 'chat' },
                { id: 'quiz', label: 'Quiz', icon: 'quiz' },
                { id: 'fsrs', label: 'Flashcards', icon: 'style' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`text-xs px-2.5 py-1 rounded-md font-semibold flex items-center gap-1 transition-all ${
                    activeTab === t.id
                      ? 'bg-[var(--ox-bg-card)] text-[var(--ox-text-main)] shadow-sm'
                      : 'text-[var(--ox-text-muted)] hover:text-[var(--ox-text-main)]'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="ox-frame-body space-y-4">
            {activeTab === 'tutor' && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-[var(--ox-bg-elevated)] border border-[var(--ox-border)] text-[var(--ox-text-secondary)]">
                  <span className="font-bold text-[var(--ox-text-main)] block mb-1">Student:</span>
                  "Explain how Raft avoids split-vote deadlocks during leader election."
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--ox-bg-card)] border border-[var(--ox-border-forest)] text-[var(--ox-text-main)] space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono text-[var(--ox-forest)] font-bold">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--ox-forest)]" />
                      Shiro Pedagogical Tutor
                    </span>
                    <span>Verified Proof</span>
                  </div>
                  <p className="leading-relaxed m-0 text-xs">
                    Raft enforces <strong>randomized election timeouts</strong> (typically 150–300ms) for each follower. This ensures that one candidate times out first, requests votes, and establishes leadership before competing candidates split the quorum.
                  </p>
                  <div className="p-2 rounded-lg bg-[var(--ox-bg-subtle)] text-[10px] font-mono text-[var(--ox-forest)] flex items-center justify-between">
                    <span>[cit-1] §5.2 Leader Election · Page 14</span>
                    <span className="font-bold cursor-pointer hover:underline">View Page 14 →</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'quiz' && (
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center text-[10px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-[var(--ox-forest-soft)] text-[var(--ox-forest)] font-bold">
                    ACTIVE RECALL · 10 MARKS
                  </span>
                  <span className="text-[var(--ox-text-muted)]">Exam Diagnostic</span>
                </div>
                <p className="font-bold text-[var(--ox-text-main)] m-0">
                  Why does Raft require a majority quorum rather than a simple plurality?
                </p>
                <div className="p-3 rounded-xl bg-[var(--ox-bg-subtle)] border border-[var(--ox-border)] text-[var(--ox-text-secondary)]">
                  <strong>Marking Point:</strong> Any two majorities must overlap in at least one server, guaranteeing that at least one voter contains the most recent log entry.
                </div>
              </div>
            )}

            {activeTab === 'fsrs' && (
              <div className="text-center py-2 space-y-2">
                <span className="text-[10px] font-mono uppercase text-[var(--ox-forest)] font-bold tracking-wider">
                  FSRS 4.5 Spaced Repetition
                </span>
                <div className="text-2xl font-bold font-serif text-[var(--ox-text-main)]">
                  94% Retention Forecast
                </div>
                <p className="text-xs text-[var(--ox-text-secondary)] max-w-xs mx-auto">
                  Memory stability calculated. Next active recall review scheduled in <strong>4 days</strong>.
                </p>
              </div>
            )}

            <div className="pt-3 border-t border-[var(--ox-border)] flex items-center justify-between text-xs text-[var(--ox-text-muted)]">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                Document Synced & Grounded
              </span>
              <span className="font-mono text-[10px] font-bold text-[var(--ox-gold)]">★ Mastery Score 88%</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
