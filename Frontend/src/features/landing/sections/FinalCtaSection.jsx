import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fadeUp } from '../motion/variants';

export default function FinalCtaSection() {
  const navigate = useNavigate();

  return (
    <section className="ox-final-cta">
      <motion.div
        className="ox-final-box"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        <span className="ox-eyebrow mb-4">Start Your Study Session</span>
        <h2 className="ox-final-h2">
          Study smarter. <em>Remember more.</em>
        </h2>
        <p className="ox-hero-p mx-auto mb-8 text-base">
          Join ambitious students preparing with grounded conceptual tutoring, active recall, and scientific spaced repetition.
        </p>
        <button
          onClick={() => navigate('/register')}
          className="ox-btn-forest text-base py-3.5 px-8 shadow-md"
        >
          <span>Start Learning Free</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
      </motion.div>
    </section>
  );
}
