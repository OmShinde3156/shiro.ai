import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { fadeUp, staggerContainer, cardReveal } from '../motion/variants';

export default function BentoFeaturesSection() {
  const [activeFSRSInterval, setActiveFSRSInterval] = useState('good');

  return (
    <section id="features" className="sh-section">
      <motion.div
        className="sh-section-header"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        <span className="sh-badge-chip">Core Capabilities</span>
        <h2 className="sh-section-title">
          Engineered for depth, accuracy, and lasting recall.
        </h2>
        <p className="sh-section-p">
          Shiro is not a generic chatbot wrapper. It is a purpose-built cognitive workspace designed for students mastering rigorous academic curricula.
        </p>
      </motion.div>

      <motion.div
        className="sh-bento-grid"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        {/* Bento 1: Document-Grounded AI Tutor (Col 8) */}
        <motion.div className="sh-bento-card col-8" variants={cardReveal}>
          <span className="sh-card-pill">Zero Hallucination Guarantee</span>
          <h3>Document-Grounded AI Tutor</h3>
          <p className="mb-4">
            Ask any question about your curriculum. Shiro retrieves exact textual proof, synthesizes step-by-step proofs, and provides interactive citations directly linked to page coordinates.
          </p>

          <div className="p-3.5 rounded-xl bg-[var(--sh-bg-card-elevated)] border border-[var(--sh-border-warm)] text-xs space-y-2">
            <div className="flex justify-between items-center text-[10px] font-mono text-[var(--sh-text-muted)]">
              <span>Tutor Response Proof</span>
              <span className="text-[#10B981] font-bold">✓ 100% Grounded</span>
            </div>
            <p className="text-[var(--sh-text-main)] leading-relaxed m-0">
              "In Distributed Systems, Paxos guarantees safety under asynchronous network assumptions, while Raft achieves equivalent state machine replication by electing a single distinguished leader."
            </p>
            <div className="p-2 rounded-lg bg-[var(--sh-bg-root)] text-[10px] text-[var(--sh-amber)] font-mono flex justify-between items-center">
              <span>[cit-1] §3.1 Invariant Comparison · Page 18</span>
              <span className="font-bold">Jump to Citation →</span>
            </div>
          </div>
        </motion.div>

        {/* Bento 2: High-Yield Exam Intelligence (Col 4) */}
        <motion.div className="sh-bento-card col-4" variants={cardReveal}>
          <span className="sh-card-pill">Predictive Scoring</span>
          <h3>High-Yield Exam Intelligence</h3>
          <p className="mb-4">
            Identifies the high-probability theoretical derivations and analytical questions most likely to appear on semester and technical evaluations.
          </p>
          <div className="p-3 rounded-xl bg-[var(--sh-bg-card-elevated)] border border-[var(--sh-border-coral)] text-xs space-y-1.5">
            <div className="flex justify-between items-center">
              <span className="px-2 py-0.5 rounded bg-[#FF5A36]/15 text-[#FF5A36] text-[9px] font-bold font-mono">10 MARKS</span>
              <span className="text-[9px] text-[var(--sh-text-muted)] font-mono">96% Yield</span>
            </div>
            <p className="text-[var(--sh-text-main)] font-semibold text-[11px] m-0">
              Derive the Bellman-Ford equation and explain negative cycle detection.
            </p>
          </div>
        </motion.div>

        {/* Bento 3: FSRS 4.5 Spaced Repetition (Col 4) */}
        <motion.div className="sh-bento-card col-4" variants={cardReveal}>
          <span className="sh-card-pill">Cognitive Science</span>
          <h3>FSRS 4.5 Spaced Repetition</h3>
          <p className="mb-4">
            Mathematically schedules review intervals to maintain 90%+ long-term retention with minimal daily review burden.
          </p>
          <div className="p-3 rounded-xl bg-[var(--sh-bg-card-elevated)] border border-[var(--sh-border)] text-center space-y-2">
            <div className="text-2xl font-bold font-mono text-[var(--sh-text-main)]">94.2% Stability</div>
            <div className="grid grid-cols-4 gap-1 text-[9px] font-mono">
              {['again', 'hard', 'good', 'easy'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setActiveFSRSInterval(lvl)}
                  className={`p-1.5 rounded border capitalize transition-all ${
                    activeFSRSInterval === lvl
                      ? 'bg-[var(--sh-coral)] text-white border-transparent'
                      : 'bg-[var(--sh-bg-root)] text-[var(--sh-text-muted)] border-[var(--sh-border)]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Bento 4: Concept Graph Explorer (Col 4) */}
        <motion.div className="sh-bento-card col-4" variants={cardReveal}>
          <span className="sh-card-pill">Structural Hierarchy</span>
          <h3>Concept Mind Maps</h3>
          <p className="mb-4">
            Visualizes non-linear relationships across your entire syllabus with automated PageRank centrality scoring.
          </p>
          <div className="p-3 rounded-xl bg-[var(--sh-bg-card-elevated)] border border-[var(--sh-border-warm)] text-center space-y-1">
            <div className="text-sm font-bold font-serif text-[var(--sh-text-main)]">Knowledge Constellation</div>
            <p className="text-[10px] text-[var(--sh-text-secondary)] m-0">28 Connected Concept Nodes Extracted</p>
          </div>
        </motion.div>

        {/* Bento 5: Collaborative Study Rooms (Col 4) */}
        <motion.div className="sh-bento-card col-4" variants={cardReveal}>
          <span className="sh-card-pill">Realtime Collaboration</span>
          <h3>Live Study Rooms</h3>
          <p className="mb-4">
            Study live with peers around shared documents, collaborative notes, and an integrated @shiro co-pilot.
          </p>
          <div className="p-3 rounded-xl bg-[var(--sh-bg-card-elevated)] border border-[var(--sh-border)] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
              <span className="font-bold text-[var(--sh-text-main)]">Study Room Active</span>
            </div>
            <span className="text-[10px] font-mono text-[var(--sh-text-muted)]">3 Peers Online</span>
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
