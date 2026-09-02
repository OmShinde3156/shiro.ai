import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp } from '../motion/variants';

export default function RecallChapter() {
  const navigate = useNavigate();

  return (
    <div className="landing-chapter-row reversed">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
      >
        <span className="landing-chapter-eyebrow">Chapter 02 · Active Recall</span>
        <h3 className="landing-chapter-heading">
          Don’t reread. Retrieve.
        </h3>
        <p className="landing-chapter-body">
          Cognitive research demonstrates that active testing is significantly more effective than passive reading. Shiro synthesizes high-yield exam questions and analytical problems based on your specific curriculum.
        </p>
        <ul className="space-y-2 text-xs text-[var(--lp-text-secondary)] mb-6 list-disc list-inside">
          <li>High-yield exam questions with marking points</li>
          <li>Adaptive difficulty scaling with diagnostic feedback</li>
          <li>Model answers with common examiner pitfalls highlighted</li>
        </ul>
        <button onClick={() => navigate('/register')} className="landing-btn-cta">
          <span>Explore Smart Quizzes</span>
          <span className="material-symbols-outlined text-xs">arrow_forward</span>
        </button>
      </motion.div>

      <motion.div
        className="landing-chapter-visual"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        custom={0.15}
      >
        <div className="p-4 rounded-xl bg-[var(--lp-surface-elevated)] border border-[var(--lp-border-coral)] space-y-3 text-xs">
          <div className="flex justify-between items-center">
            <span className="px-2 py-0.5 rounded bg-[#FF6B4A]/15 text-[#FF6B4A] font-bold text-[10px] font-mono">
              HIGH YIELD · 10 MARKS
            </span>
            <span className="text-[10px] text-[var(--lp-text-muted)]">Exam Diagnostic</span>
          </div>
          <p className="font-semibold text-[var(--lp-text-primary)]">
            Q. Contrast Batch Gradient Descent with Stochastic Gradient Descent in terms of convergence speed and computational overhead.
          </p>
          <div className="p-2.5 rounded-lg bg-[var(--lp-bg-main)] text-[11px] text-[var(--lp-text-secondary)]">
            <strong>Key Points to Score:</strong> Batch computes gradient over full dataset (smooth but expensive); SGD computes on single samples (rapid updates, noisy trajectory).
          </div>
        </div>
      </motion.div>
    </div>
  );
}
