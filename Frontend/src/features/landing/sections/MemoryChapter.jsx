import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp } from '../motion/variants';

export default function MemoryChapter() {
  const navigate = useNavigate();

  return (
    <div className="landing-chapter-row">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
      >
        <span className="landing-chapter-eyebrow">Chapter 03 · Spaced Repetition</span>
        <h3 className="landing-chapter-heading">
          Turn short-term reading into permanent memory.
        </h3>
        <p className="landing-chapter-body">
          Powered by the proven <strong>FSRS (Free Spaced Repetition Scheduler)</strong> algorithm, Shiro forecasts the exact rate of memory decay for every concept and schedules reviews just as forgetting begins.
        </p>
        <ul className="space-y-2 text-xs text-[var(--lp-text-secondary)] mb-6 list-disc list-inside">
          <li>Automatic flashcard generation from lecture summaries & notes</li>
          <li>FSRS memory stability and difficulty ratings (Again / Hard / Good / Easy)</li>
          <li>Offline-capable focused study drills</li>
        </ul>
        <button onClick={() => navigate('/register')} className="landing-btn-cta">
          <span>Start Flashcard Drills</span>
          <span className="material-symbols-outlined text-xs">arrow_forward</span>
        </button>
      </motion.div>

      <motion.div
        className="landing-chapter-visual text-center"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        custom={0.15}
      >
        <div className="p-5 rounded-xl bg-[var(--lp-surface-elevated)] border border-[var(--lp-border-warm)] space-y-3">
          <div className="text-[10px] font-mono uppercase text-[#FFB86B] font-bold tracking-wider">
            FSRS Retention Engine
          </div>
          <div className="text-3xl font-bold font-serif text-[var(--lp-text-primary)]">
            94.2%
          </div>
          <p className="text-xs text-[var(--lp-text-secondary)]">
            Projected retention probability at 30 days based on scheduled spaced intervals.
          </p>
          <div className="flex justify-center gap-1.5 pt-2 text-[10px] font-mono">
            <span className="px-2.5 py-1 rounded-full bg-[var(--lp-bg-main)] border border-[var(--lp-border)] text-[#FF5F56]">Again (10m)</span>
            <span className="px-2.5 py-1 rounded-full bg-[var(--lp-bg-main)] border border-[var(--lp-border)] text-[#FFBD2E]">Hard (1d)</span>
            <span className="px-2.5 py-1 rounded-full bg-[var(--lp-bg-main)] border border-[var(--lp-border)] text-[#27C93F]">Good (4d)</span>
            <span className="px-2.5 py-1 rounded-full bg-[var(--lp-bg-main)] border border-[var(--lp-border)] text-[#3157D5]">Easy (9d)</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
