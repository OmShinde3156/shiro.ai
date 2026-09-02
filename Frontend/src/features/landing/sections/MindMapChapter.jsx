import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp } from '../motion/variants';

export default function MindMapChapter() {
  const navigate = useNavigate();

  return (
    <div className="landing-chapter-row reversed">
      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
      >
        <span className="landing-chapter-eyebrow">Chapter 04 · Concept Graphs</span>
        <h3 className="landing-chapter-heading">
          Visualize the structure of knowledge.
        </h3>
        <p className="landing-chapter-body">
          Understand how individual definitions, formulas, and theorems connect across your entire syllabus. Shiro constructs hierarchical concept trees with PageRank-weighted topic scoring.
        </p>
        <ul className="space-y-2 text-xs text-[var(--lp-text-secondary)] mb-6 list-disc list-inside">
          <li>Automated concept hierarchy extraction</li>
          <li>Radial graph layouts with controllable depth</li>
          <li>Instant drill-down into specific sub-topics</li>
        </ul>
        <button onClick={() => navigate('/register')} className="landing-btn-cta">
          <span>Explore Concept Maps</span>
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
        <div className="p-5 rounded-xl bg-[var(--lp-surface-elevated)] border border-[var(--lp-border-coral)] text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-[var(--lp-sunrise-grad)] text-white flex items-center justify-center mx-auto text-lg shadow-md">
            <span className="material-symbols-outlined text-base">hub</span>
          </div>
          <h4 className="font-bold text-xs text-[var(--lp-text-primary)] font-serif">
            Distributed Systems Knowledge Graph
          </h4>
          <p className="text-[11px] text-[var(--lp-text-secondary)]">
            Synthesized 28 sub-concepts, 4 algorithms, and 12 exam anchors.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
