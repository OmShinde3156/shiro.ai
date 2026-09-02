import React from 'react';
import { motion } from 'framer-motion';
import { fadeUp, staggerContainer, cardReveal } from '../motion/variants';

export default function LearningLoopSection() {
  const loop = [
    { step: '01', name: 'Read', desc: 'Ingest and ground course materials' },
    { step: '02', name: 'Ask', desc: 'Clarify ambiguities with the Tutor' },
    { step: '03', name: 'Understand', desc: 'Synthesize core proofs and analogies' },
    { step: '04', name: 'Quiz', desc: 'Test retrieval with active exam diagnostic' },
    { step: '05', name: 'Recall', desc: 'Reinforce memory with FSRS flashcards' },
    { step: '06', name: 'Review', desc: 'Track readiness and strengthen weak points' },
  ];

  return (
    <section id="learning-loop" className="ox-section">
      <motion.div
        className="ox-section-header"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        <span className="ox-eyebrow">The Mastery Cycle</span>
        <h2 className="ox-section-title">
          The evidence-based learning loop.
        </h2>
        <p className="ox-section-p">
          A continuous cognitive framework engineered to turn passive reading into permanent retention.
        </p>
      </motion.div>

      <motion.div
        className="ox-loop-cycle"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        {loop.map((item) => (
          <motion.div key={item.step} className="ox-loop-item" variants={cardReveal}>
            <div className="badge">{item.step}</div>
            <h4>{item.name}</h4>
            <p>{item.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
