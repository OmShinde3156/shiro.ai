import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeUp } from '../motion/variants';

export default function ShowcaseSection() {
  const navigate = useNavigate();

  // Interactive states for the 4 showcases
  const [showCitation, setShowCitation] = useState(false);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [cardStability, setCardStability] = useState(91);
  const [cardInterval, setCardInterval] = useState('4 days');
  const [selectedQuizOption, setSelectedQuizOption] = useState(null);
  const [feynmanOpen, setFeynmanOpen] = useState(false);

  return (
    <section id="showcase" className="ox-section">
      <motion.div
        className="ox-section-header"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        <span className="ox-eyebrow">Interactive Product Suite</span>
        <h2 className="ox-section-title">
          Touch the instruments of mastery.
        </h2>
        <p className="ox-section-p">
          Four purpose-built cognitive tools engineered to take you from comprehension to permanent recall.
        </p>
      </motion.div>

      {/* Showcase 1: Grounded Document Chat */}
      <div className="ox-showcase-row">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          <span className="ox-showcase-tag">01 · Grounded Intelligence</span>
          <h3 className="ox-showcase-h3">Talk to your knowledge.</h3>
          <p className="ox-showcase-desc">
            Ask any question directly against your course materials. Shiro explains difficult theorems with relatable analogies and derives mathematical formulas with verified citations linking to exact source pages.
          </p>
          <button onClick={() => navigate('/register')} className="ox-btn-forest">
            <span>Try Document Chat</span>
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </button>
        </motion.div>

        <motion.div
          className="ox-showcase-frame"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          custom={0.15}
        >
          <div className="p-4 rounded-xl bg-[var(--ox-bg-subtle)] border border-[var(--ox-border)] space-y-3 text-xs">
            <div className="flex items-center justify-between text-[10px] font-mono text-[var(--ox-forest)] font-bold">
              <span>EXACT CITATION PROOF</span>
              <span>✓ Page 42 Grounding</span>
            </div>
            <p className="text-[var(--ox-text-main)] leading-relaxed m-0">
              "Under strict scrutiny review, the legislation must serve a compelling governmental interest and be narrowly tailored using the least restrictive means available."
            </p>
            <div className="p-2.5 rounded-lg bg-[var(--ox-bg-card)] border border-[var(--ox-border)] text-[10px] font-mono text-[var(--ox-forest)] flex justify-between items-center">
              <span>[cit-1] §1.2 Constitutional Standards · Page 42</span>
              <button
                onClick={() => setShowCitation(!showCitation)}
                className="font-bold text-[var(--ox-forest)] underline cursor-pointer bg-transparent border-none p-0"
              >
                {showCitation ? 'Hide Excerpt ✕' : 'View Excerpt →'}
              </button>
            </div>

            {showCitation && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-2.5 rounded-lg bg-[var(--ox-gold-soft)] border border-[var(--ox-gold)]/40 text-[11px] text-[var(--ox-text-main)] leading-relaxed"
              >
                <strong>Source Passage (p.42):</strong> "The Court has repeatedly held that suspect classifications based on race or national origin must survive strict scrutiny, placing the heavy burden on the state."
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Showcase 2: FSRS Spaced Repetition Flashcards */}
      <div className="ox-showcase-row reversed">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          <span className="ox-showcase-tag">02 · Memory Science</span>
          <h3 className="ox-showcase-h3">Remember what you learn.</h3>
          <p className="ox-showcase-desc">
            Powered by the modern <strong>FSRS 4.5 algorithm</strong>, Shiro calculates individual memory decay rates for every concept and schedules flashcard drills at the optimal moment before forgetting occurs.
          </p>
          <button onClick={() => navigate('/register')} className="ox-btn-forest">
            <span>Explore FSRS Flashcards</span>
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </button>
        </motion.div>

        <motion.div
          className="ox-showcase-frame text-center"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          custom={0.15}
        >
          <div className="p-5 rounded-xl bg-[var(--ox-bg-subtle)] border border-[var(--ox-border)] space-y-3">
            {/* Click-to-flip Card */}
            <div
              onClick={() => setCardFlipped(!cardFlipped)}
              className="p-4 rounded-xl bg-[var(--ox-bg-card)] border border-[var(--ox-border)] hover:border-[var(--ox-forest)] cursor-pointer text-left transition-all shadow-sm space-y-1.5"
            >
              <div className="flex justify-between items-center text-[10px] font-mono text-[var(--ox-forest)] font-bold">
                <span>{cardFlipped ? 'ANSWER (Click to flip)' : 'QUESTION (Click to flip)'}</span>
                <span className="material-symbols-outlined text-xs">flip</span>
              </div>
              <p className="text-xs font-semibold text-[var(--ox-text-main)] m-0">
                {cardFlipped
                  ? 'A memory-management scheme providing an ideal address space abstracted from physical RAM.'
                  : 'What is the primary architectural purpose of Virtual Memory?'}
              </p>
            </div>

            {/* Retention Forecast */}
            <div className="flex justify-between items-center text-xs px-1">
              <span className="text-[var(--ox-text-secondary)]">Calculated Stability:</span>
              <span className="font-mono font-bold text-[var(--ox-forest)]">{cardStability}% (Next: {cardInterval})</span>
            </div>

            {/* Interactive Rating Buttons */}
            <div className="grid grid-cols-4 gap-1.5 pt-1 text-[10px] font-mono">
              {[
                { id: 'again', label: 'Again', stat: 55, iv: '10m', c: '#D32F2F' },
                { id: 'hard', label: 'Hard', stat: 76, iv: '1d', c: '#F57C00' },
                { id: 'good', label: 'Good', stat: 92, iv: '4d', c: '#2E7D32' },
                { id: 'easy', label: 'Easy', stat: 98, iv: '9d', c: '#1976D2' },
              ].map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setCardStability(b.stat);
                    setCardInterval(b.iv);
                  }}
                  className="p-1.5 rounded-lg bg-[var(--ox-bg-card)] border border-[var(--ox-border)] hover:border-[var(--ox-forest)] font-semibold"
                >
                  <span style={{ color: b.c }}>{b.label}</span>
                  <span className="block text-[9px] text-[var(--ox-text-muted)]">{b.iv}</span>
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Showcase 3: Active Recall Quizzes */}
      <div className="ox-showcase-row">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          <span className="ox-showcase-tag">03 · Active Retrieval</span>
          <h3 className="ox-showcase-h3">Test whether you actually understand.</h3>
          <p className="ox-showcase-desc">
            Stop passive rereading. Shiro generates high-yield diagnostic questions with explicit mark allocations, key scoring points, and Feynman explanation challenges to expose conceptual blind spots.
          </p>
          <button onClick={() => navigate('/register')} className="ox-btn-forest">
            <span>Practice Smart Quizzes</span>
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </button>
        </motion.div>

        <motion.div
          className="ox-showcase-frame"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          custom={0.15}
        >
          <div className="p-4 rounded-xl bg-[var(--ox-bg-subtle)] border border-[var(--ox-border-forest)] space-y-2.5 text-xs">
            <div className="flex justify-between items-center text-[10px] font-mono">
              <span className="px-2 py-0.5 rounded bg-[var(--ox-forest-soft)] text-[var(--ox-forest)] font-bold">
                HIGH YIELD · 10 MARKS
              </span>
              <span className="text-[var(--ox-text-muted)]">Click an option below</span>
            </div>

            <p className="font-bold text-[var(--ox-text-main)] m-0">
              Why can the Bellman-Ford algorithm handle negative-weight edges while Dijkstra cannot?
            </p>

            <div className="space-y-1.5">
              {[
                { id: 'A', text: 'Bellman-Ford relaxes all |E| edges |V|-1 times, without making greedy irreversible assumptions.', correct: true },
                { id: 'B', text: 'Bellman-Ford uses a min-heap priority queue to re-evaluate visited nodes.', correct: false },
              ].map((opt) => (
                <div
                  key={opt.id}
                  onClick={() => setSelectedQuizOption(opt.id)}
                  className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                    selectedQuizOption === opt.id
                      ? opt.correct
                        ? 'bg-[#E8F5E9] border-[#2E7D32] text-[#1B5E20] font-semibold'
                        : 'bg-[#FFEBEE] border-[#C62828] text-[#B71C1C]'
                      : 'bg-[var(--ox-bg-card)] border-[var(--ox-border)] hover:border-[var(--ox-forest)] text-[var(--ox-text-main)]'
                  }`}
                >
                  <span className="font-mono font-bold mr-2">{opt.id}.</span>
                  {opt.text}
                </div>
              ))}
            </div>

            {selectedQuizOption && (
              <div className="p-2.5 rounded-lg bg-[var(--ox-bg-card)] border border-[var(--ox-border)] text-[11px] text-[var(--ox-text-secondary)]">
                <strong>Examiner Insight:</strong> Dijkstra greedily assumes shortest path to a finalized node cannot decrease; negative weights violate this sub-problem optimality.
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Showcase 4: Personalized Progress & Feynman */}
      <div className="ox-showcase-row reversed">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
        >
          <span className="ox-showcase-tag">04 · Study Strategy</span>
          <h3 className="ox-showcase-h3">Know what to study next.</h3>
          <p className="ox-showcase-desc">
            Shiro continuously tracks your topic mastery, exam readiness scores, and revision streaks, telling you exactly which chapter needs attention before exam day.
          </p>
          <button onClick={() => navigate('/register')} className="ox-btn-forest">
            <span>View Mastery Insights</span>
            <span className="material-symbols-outlined text-xs">arrow_forward</span>
          </button>
        </motion.div>

        <motion.div
          className="ox-showcase-frame text-center"
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          custom={0.15}
        >
          <div className="p-5 rounded-xl bg-[var(--ox-bg-subtle)] border border-[var(--ox-border)] space-y-3">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-[var(--ox-text-main)]">Distributed Systems</span>
              <span className="font-mono font-bold text-[var(--ox-forest)]">92% Ready</span>
            </div>
            <div className="w-full bg-[var(--ox-border)] h-2 rounded-full overflow-hidden">
              <div className="bg-[var(--ox-forest)] h-full w-[92%]" />
            </div>

            <div className="p-3 rounded-lg bg-[var(--ox-bg-card)] border border-[var(--ox-border)] text-left text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-[var(--ox-text-main)] font-mono text-[11px]">Recommended Feynman Drill</span>
                <button
                  onClick={() => setFeynmanOpen(!feynmanOpen)}
                  className="text-[10px] font-bold text-[var(--ox-forest)] bg-transparent border-none p-0 cursor-pointer hover:underline"
                >
                  {feynmanOpen ? 'Collapse' : 'Explain to Child →'}
                </button>
              </div>
              {feynmanOpen && (
                <p className="text-[11px] text-[var(--ox-text-secondary)] m-0 leading-relaxed pt-1">
                  "Explain Two-Phase Commit using the analogy of a group of friends deciding which movie to watch where everyone must say yes before booking tickets."
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
