import React from 'react';
import { motion } from 'framer-motion';
import { fadeUp } from '../motion/variants';

export default function ProblemSection() {
  return (
    <section id="problem" className="ox-section">
      <motion.div
        className="ox-problem-box"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        <div>
          <span className="ox-eyebrow mb-3">The Learning Dilemma</span>
          <h2 className="ox-problem-statement">
            Reading isn't <span>learning.</span>
          </h2>
          <p className="ox-hero-p mt-4 text-base">
            You highlight. You reread. You forget. Textbooks, lecture slide decks, and dense handouts are passive formats that demand enormous energy before genuine comprehension even begins.
          </p>
        </div>

        <div className="ox-problem-points">
          <div className="ox-problem-point">
            <div className="ox-point-dot">1</div>
            <div>
              <h4>Fragmented Knowledge Silos</h4>
              <p>Key syllabus proofs and definitions are separated across 90-page lecture decks, course notes, and browser bookmarks with no unified semantic lookup.</p>
            </div>
          </div>

          <div className="ox-problem-point">
            <div className="ox-point-dot">2</div>
            <div>
              <h4>The Illusion of Competence</h4>
              <p>Rereading highlighted paragraphs creates a false sense of mastery that falls apart when faced with complex analytical exam problems.</p>
            </div>
          </div>

          <div className="ox-problem-point">
            <div className="ox-point-dot">3</div>
            <div>
              <h4>The Steep Forgetting Curve</h4>
              <p>Without evidence-based spaced retrieval intervals, the human brain forgets over 70% of newly reviewed technical material within 48 hours.</p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
