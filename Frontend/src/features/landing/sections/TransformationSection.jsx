import React from 'react';
import { motion } from 'framer-motion';
import { fadeUp, staggerContainer, cardReveal } from '../motion/variants';

export default function TransformationSection() {
  const steps = [
    {
      num: '01',
      title: 'Bring your material',
      desc: 'Upload lecture slides, textbook PDFs, syllabus notes, or video transcripts. Shiro indexes every sentence for grounded retrieval.',
    },
    {
      num: '02',
      title: 'Learn actively',
      desc: 'Ask complex questions, generate step-by-step derivations, test active recall with diagnostic quizzes, and explain concepts using Feynman drills.',
    },
    {
      num: '03',
      title: 'Build retention',
      desc: 'Shiro tracks your conceptual weaknesses, calculates memory decay, and schedules FSRS flashcard reviews right as forgetting begins.',
    },
  ];

  return (
    <section id="how-it-works" className="ox-section">
      <motion.div
        className="ox-section-header"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        <span className="ox-eyebrow">The 3-Step Process</span>
        <h2 className="ox-section-title">
          How Shiro transforms your study workflow.
        </h2>
        <p className="ox-section-p">
          A calm, focused system designed to take you from raw course files to permanent conceptual mastery.
        </p>
      </motion.div>

      <motion.div
        className="ox-steps-grid"
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        {steps.map((s) => (
          <motion.div key={s.num} className="ox-step-card" variants={cardReveal}>
            <div className="ox-step-num">{s.num}</div>
            <h3>{s.title}</h3>
            <p>{s.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
