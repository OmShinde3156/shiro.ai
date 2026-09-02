import React from 'react';
import { motion } from 'framer-motion';
import { fadeUp, staggerContainer, cardReveal } from '../motion/variants';

export default function TestimonialsSection() {
  const reviews = [
    {
      quote: "Shiro changed how I tackle 100-page academic papers. Being able to ask questions and get answers grounded directly in the text with verifiable citations is a superpower.",
      author: "Arjun M.",
      detail: "Computer Science · 3rd Year",
      initial: "A",
    },
    {
      quote: "The High-Yield Exam Question generator predicted the exact 10-mark concept on our semester final. The FSRS flashcard scheduling is seamless.",
      author: "Priya S.",
      detail: "Electrical Engineering",
      initial: "P",
    },
    {
      quote: "Instead of jumping across five separate apps for reading, notes, and flashcard drills, Shiro provides one calm, unified study workspace.",
      author: "Rohan V.",
      detail: "Medical Student",
      initial: "R",
    },
  ];

  return (
    <section className="ox-section">
      <motion.div
        className="ox-section-header"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        <span className="ox-eyebrow">Student Stories</span>
        <h2 className="ox-section-title">
          Built for ambitious students.
        </h2>
        <p className="ox-section-p">
          See how students across engineering, medicine, and research transform their study routines with Shiro.
        </p>
      </motion.div>

      <motion.div
        className="ox-reviews-grid"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        {reviews.map((r, idx) => (
          <motion.div key={idx} className="ox-review-card" variants={cardReveal}>
            <p className="ox-review-quote">“{r.quote}”</p>
            <div className="ox-review-author">
              <div className="ox-avatar">{r.initial}</div>
              <div>
                <h4 className="text-xs font-bold text-[var(--ox-text-main)] m-0">{r.author}</h4>
                <p className="text-[11px] text-[var(--ox-text-muted)] m-0">{r.detail}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
