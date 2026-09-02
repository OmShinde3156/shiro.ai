import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeUp, accordionTransition } from '../motion/variants';

export default function FaqSection() {
  const [openIdx, setOpenIdx] = useState(null);

  const faqs = [
    {
      q: 'What study materials can I upload to Shiro?',
      a: 'Shiro supports PDFs, lecture slide decks, markdown files, text notes, and YouTube video lecture links. All uploaded content is indexed for semantic search, interactive tutoring, and automated study set generation.',
    },
    {
      q: 'How does Shiro prevent AI hallucinations?',
      a: 'Shiro uses strict document-grounded retrieval. Every answer is substantiated with direct excerpts from your uploaded materials and accompanied by clickable citations linking to the exact source page coordinates.',
    },
    {
      q: 'How does the FSRS algorithm improve exam preparation?',
      a: 'FSRS (Free Spaced Repetition Scheduler) is a modern cognitive scheduling model that calculates memory stability and decay rates. It schedules card reviews right before forgetting occurs, ensuring 90%+ long-term retention with minimal daily review time.',
    },
    {
      q: 'Can I study collaboratively with classmates?',
      a: 'Yes. Shiro features real-time Collaborative Study Rooms where peers can read shared documents, co-author persistent notes, and summon the Shiro Co-pilot during live study sessions.',
    },
    {
      q: 'Is Shiro free to start using?',
      a: 'Yes. You can create a free account and immediately access the AI Tutor, Smart Quizzes, FSRS Flashcard drills, and Mind Map visualization tools.',
    },
  ];

  return (
    <section id="faq" className="ox-section">
      <motion.div
        className="ox-section-header"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        <span className="ox-eyebrow">Frequently Asked Questions</span>
        <h2 className="ox-section-title">
          Clear answers to common questions.
        </h2>
      </motion.div>

      <div className="ox-faq-wrap">
        {faqs.map((f, idx) => (
          <div key={idx} className="ox-faq-card">
            <button
              className="ox-faq-btn"
              onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
              aria-expanded={openIdx === idx}
            >
              <span>{f.q}</span>
              <span
                className="material-symbols-outlined text-sm text-[var(--ox-forest)] transition-transform duration-200"
                style={{ transform: openIdx === idx ? 'rotate(45deg)' : 'none' }}
              >
                add
              </span>
            </button>
            <AnimatePresence>
              {openIdx === idx && (
                <motion.div
                  variants={accordionTransition}
                  initial="hidden"
                  animate="visible"
                  exit="hidden"
                  className="ox-faq-answer"
                >
                  {f.a}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}
