import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp } from '../motion/variants';

export default function TutorChapter() {
  const navigate = useNavigate();

  return (
    <div className="landing-chapter-row">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
      >
        <span className="landing-chapter-eyebrow">Chapter 01 · Pedagogical Tutor</span>
        <h3 className="landing-chapter-heading">
          Ask your material anything.
        </h3>
        <p className="landing-chapter-body">
          Shiro explains complex concepts in clear pedagogical terms, breaking down difficult theorems into relatable analogies and mathematical derivations grounded by exact page citations.
        </p>
        <ul className="space-y-2 text-xs text-[var(--lp-text-secondary)] mb-6 list-disc list-inside">
          <li>Document-grounded answers with zero hallucinations</li>
          <li>Instant text selection tool for surgical explanations</li>
          <li>Library-wide awareness across all your uploaded semesters</li>
        </ul>
        <button onClick={() => navigate('/register')} className="landing-btn-cta">
          <span>Try AI Tutor</span>
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
        <div className="p-4 rounded-xl bg-[var(--lp-surface-elevated)] border border-[var(--lp-border-warm)] space-y-3 text-xs">
          <div className="font-bold text-[var(--lp-accent-coral)] font-mono flex items-center gap-1.5">
            <span className="material-symbols-outlined text-xs">auto_awesome</span>
            <span>TUTOR INSIGHT PREVIEW</span>
          </div>
          <p className="text-[var(--lp-text-primary)] leading-relaxed">
            "Gradient Descent is like a hiker navigating down a foggy mountain. The learning rate is step size: too large and you overshoot the valley; too small and you take forever to reach the bottom."
          </p>
          <div className="p-2 rounded-lg bg-[var(--lp-bg-main)] text-[10px] text-[var(--lp-accent-apricot)] flex justify-between items-center font-mono">
            <span>[cit-1] §4.2 Optimization Principles · Page 32</span>
            <span className="font-bold cursor-pointer hover:underline">View Excerpt →</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
