import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeUp } from '../motion/variants';

const SAMPLES = {
  cs: {
    id: 'cs',
    subjectLabel: 'Computer Science',
    icon: 'terminal',
    title: 'Computer Systems',
    subtitle: 'Virtual Memory & Address Translation',
    docName: 'OS_Virtual_Memory_Lecture_06.pdf',
    page: 18,
    section: '§4.2 Address Translation',
    excerpt: 'Virtual memory decouples the programmer\'s logical address space from physical memory. The Translation Lookaside Buffer (TLB) caches recent virtual-to-physical address mappings to avoid multiple memory accesses per instruction.',
    tutorAnswer: 'Virtual memory provides each process with the illusion of a contiguous, private memory space. When a program references an address, the MMU uses the page table (accelerated by the TLB) to translate virtual pages into physical frames. If the page is not in RAM, a page fault occurs, loading it from disk.',
    keyIdeas: [
      'Virtual → Physical address translation via MMU',
      'TLB hardware cache eliminates dual RAM lookup penalty',
      'Page fault triggers operating system disk swap recovery'
    ],
    followUpQuestion: 'Why is a TLB lookup faster than a standard RAM page table access?',
    followUpAnswer: 'The TLB is constructed from high-speed associative SRAM directly inside the CPU/MMU hardware. It compares virtual address tags in parallel within 1 clock cycle (~1ns), whereas accessing page tables in DRAM RAM takes 50–100ns.',
    question: 'Why is an associative Translation Lookaside Buffer (TLB) essential for paging performance?',
    options: [
      { id: 'A', text: 'Without a TLB, every memory reference requires at least two physical RAM accesses (one for page table lookup, one for data).', correct: true },
      { id: 'B', text: 'To permanently store all process pages on high-speed solid state disk storage.', correct: false },
      { id: 'C', text: 'To allow user-space processes to directly overwrite kernel-space physical addresses.', correct: false },
    ],
    explanation: 'Correct. Paging doubles memory latency because the CPU must look up the multi-level page table before accessing the actual data. A high TLB hit rate (>99%) reduces this overhead to near zero.',
    examinerTakeaway: 'Key concept: Memory latency multiplier without associative caching.',
    flashcard: {
      q: 'What is the primary function of the Translation Lookaside Buffer (TLB)?',
      a: 'A high-speed hardware cache inside the MMU that stores recent virtual-to-physical page translations, preventing redundant DRAM table walks on every instruction.',
    },
  },
  bio: {
    id: 'bio',
    subjectLabel: 'Biology',
    icon: 'neurology',
    title: 'Neurobiology',
    subtitle: 'Action Potentials & Synaptic Kinetics',
    docName: 'Neurophysiology_Ch3_Action_Potentials.pdf',
    page: 24,
    section: '§3.1 The Hodgkin Cycle',
    excerpt: 'During the rising phase of an action potential, voltage-gated Na+ channels rapidly open in a regenerative positive-feedback loop (Hodgkin cycle), shifting membrane potential toward the sodium equilibrium potential (+60mV).',
    tutorAnswer: 'An action potential is an all-or-none electrical impulse. When depolarization reaches the threshold (-55mV), voltage-gated Na⁺ channels snap open, driving a rapid spike. At the peak, Na⁺ channels inactivate and voltage-gated K⁺ channels open, repolarizing the neuron back toward resting potential (-70mV).',
    keyIdeas: [
      'Depolarization past -55mV triggers explosive Na⁺ influx',
      'Inactivation gates (h-gates) enforce the refractory period',
      'Delayed K⁺ efflux drives repolarization & hyperpolarization'
    ],
    followUpQuestion: 'What triggers the transition from depolarization to repolarization?',
    followUpAnswer: 'Two simultaneous events: time-dependent closure of Na⁺ channel inactivation gates (h-gates) and delayed opening of voltage-gated K⁺ rectifier channels at peak membrane voltage (+30mV).',
    question: 'Why cannot a second action potential fire during the absolute refractory period?',
    options: [
      { id: 'A', text: 'The voltage-gated Na+ channel inactivation gates (h-gates) remain closed until membrane repolarization resets them.', correct: true },
      { id: 'B', text: 'Potassium ions are completely depleted from the extracellular matrix surrounding the axon.', correct: false },
      { id: 'C', text: 'The myelin sheath temporarily stops conducting electrical current along the axon.', correct: false },
    ],
    explanation: 'Correct. Sodium channels must transition from the inactivated state back to the closed/deactivated state before they can open again.',
    examinerTakeaway: 'Key concept: Molecular conformational states (Closed → Open → Inactivated).',
    flashcard: {
      q: 'What molecular mechanism defines the Absolute Refractory Period?',
      a: 'The physical closure of voltage-gated Na⁺ channel inactivation gates (h-gates), which cannot reopen until repolarization resets them to the resting closed state.',
    },
  },
  law: {
    id: 'law',
    subjectLabel: 'Law',
    icon: 'gavel',
    title: 'Constitutional Law',
    subtitle: 'Judicial Review & Equal Protection Scrutiny',
    docName: 'Constitutional_Law_Doctrine_Casebook.pdf',
    page: 42,
    section: '§2.4 Equal Protection Review',
    excerpt: 'Under the Strict Scrutiny framework, the burden shifts entirely to the government to prove that the challenged statute furthers a compelling state interest and is narrowly tailored using the least restrictive means possible.',
    tutorAnswer: 'Judicial Review enables courts to strike down legislative or executive acts that violate constitutional provisions. When fundamental rights or suspect classifications are burdened, courts apply Strict Scrutiny—the highest standard of judicial review—requiring a compelling government interest and narrow tailoring.',
    keyIdeas: [
      'Burden of proof shifts entirely to the state',
      'Requires a Compelling (not merely legitimate) State Interest',
      'Must utilize the Least Restrictive Means available'
    ],
    followUpQuestion: 'How does Strict Scrutiny differ from Rational Basis Review?',
    followUpAnswer: 'Under Rational Basis, the plaintiff bears the burden of proving the law lacks any conceivable legitimate purpose. Under Strict Scrutiny, the government bears the burden of proving compelling necessity and narrowest tailoring.',
    question: 'Under Strict Scrutiny analysis, what burden of proof must the state satisfy?',
    options: [
      { id: 'A', text: 'The statute must further a compelling governmental interest and be narrowly tailored using the least restrictive means.', correct: true },
      { id: 'B', text: 'The statute must simply have a conceivable rational relationship to any legitimate government objective.', correct: false },
      { id: 'C', text: 'The plaintiff must prove the legislature acted with subjective malicious intent.', correct: false },
    ],
    explanation: 'Correct. Strict scrutiny is "strict in theory and fatal in fact," requiring compelling necessity and precise tailoring.',
    examinerTakeaway: 'Key concept: Reversal of burden of proof and strict tailoring mandate.',
    flashcard: {
      q: 'What are the two mandatory prongs of the Strict Scrutiny test?',
      a: '1) The government must prove a Compelling State Interest, and 2) The law must be Narrowly Tailored using the least restrictive means.',
    },
  },
};

export default function InteractiveSandbox() {
  const navigate = useNavigate();
  const [selectedSampleKey, setSelectedSampleKey] = useState('cs');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [analyzed, setAnalyzed] = useState(true);
  const [activeStage, setActiveStage] = useState('understand'); // 'understand' | 'practice' | 'remember'
  const [showCitationDrawer, setShowCitationDrawer] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  
  // Stage 2 Practice State
  const [selectedOption, setSelectedOption] = useState(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  
  // Stage 3 Memory State
  const [cardFlipped, setCardFlipped] = useState(false);
  const [stabilityScore, setStabilityScore] = useState(88);
  const [reviewInterval, setReviewInterval] = useState('Tomorrow');
  const [selectedRating, setSelectedRating] = useState(null);

  // Stage Completion Progress Flags
  const [hasFollowedUp, setHasFollowedUp] = useState(false);
  const [hasPracticed, setHasPracticed] = useState(false);
  const [hasRemembered, setHasRemembered] = useState(false);

  const sample = SAMPLES[selectedSampleKey];

  const handleSelectSample = (key) => {
    if (key === selectedSampleKey && analyzed) return;
    setSelectedSampleKey(key);
    setShowCitationDrawer(false);
    setShowFollowUp(false);
    setSelectedOption(null);
    setIsAnswerChecked(false);
    setCardFlipped(false);
    setStabilityScore(88);
    setReviewInterval('Tomorrow');
    setSelectedRating(null);
    setHasFollowedUp(false);
    setHasPracticed(false);
    setHasRemembered(false);
    runAnalysisSimulation();
  };

  const runAnalysisSimulation = () => {
    setIsAnalyzing(true);
    setAnalysisStep(1);
    const t1 = setTimeout(() => setAnalysisStep(2), 300);
    const t2 = setTimeout(() => setAnalysisStep(3), 650);
    const t3 = setTimeout(() => setAnalysisStep(4), 950);
    const t4 = setTimeout(() => {
      setIsAnalyzing(false);
      setAnalyzed(true);
      setActiveStage('understand');
    }, 1250);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  };

  const handleCheckAnswer = () => {
    if (!selectedOption) return;
    setIsAnswerChecked(true);
    setHasPracticed(true);
  };

  const handleRating = (ratingKey) => {
    setSelectedRating(ratingKey);
    setHasRemembered(true);
    if (ratingKey === 'again') {
      setStabilityScore(54);
      setReviewInterval('In 10 mins');
    } else if (ratingKey === 'hard') {
      setStabilityScore(78);
      setReviewInterval('In 1 day');
    } else if (ratingKey === 'good') {
      setStabilityScore(93);
      setReviewInterval('In 4 days');
    } else if (ratingKey === 'easy') {
      setStabilityScore(98);
      setReviewInterval('In 9 days');
    }
  };

  // Keyboard shortcut for card flip
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (activeStage === 'remember' && e.code === 'Space' && !e.target.matches('button, input, textarea')) {
        e.preventDefault();
        setCardFlipped(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeStage]);

  return (
    <section id="sandbox" className="ox-section pt-0">
      <motion.div
        className="ox-sandbox-card"
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-60px' }}
      >
        {/* Sandbox Header */}
        <div className="ox-sandbox-header">
          <div>
            <div className="ox-eyebrow mb-2">
              <span className="w-2 h-2 rounded-full bg-[var(--ox-forest)]" />
              <span>Interactive Product Demo</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--ox-text-main)] m-0">
              Try Shiro before you sign up.
            </h2>
            <p className="text-sm text-[var(--ox-text-secondary)] mt-1 mb-0">
              Experience the complete learning loop: <strong>Understand</strong> grounded concepts, <strong>Practice</strong> with active recall, and <strong>Remember</strong> with FSRS spaced repetition.
            </p>
          </div>

          {/* Subject Picker */}
          <div className="ox-sample-picker" role="tablist" aria-label="Select study discipline">
            {Object.entries(SAMPLES).map(([key, s]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selectedSampleKey === key}
                onClick={() => handleSelectSample(key)}
                className={`ox-sample-btn ${selectedSampleKey === key ? 'active' : ''}`}
              >
                <span className="material-symbols-outlined text-xs">
                  {s.icon}
                </span>
                <span>{s.subjectLabel}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Ingestion Simulation Overlay */}
        {isAnalyzing ? (
          <div className="p-12 text-center border border-[var(--ox-border)] rounded-2xl bg-[var(--ox-bg-card)] space-y-4">
            <div className="inline-flex p-3 rounded-2xl bg-[var(--ox-forest-soft)] text-[var(--ox-forest)] animate-pulse">
              <span className="material-symbols-outlined text-2xl">neurology</span>
            </div>
            <h3 className="text-lg font-bold text-[var(--ox-text-main)] font-serif m-0">
              Analyzing {sample.title}...
            </h3>
            <div className="max-w-xs mx-auto text-left space-y-2 text-xs font-mono text-[var(--ox-text-secondary)]">
              <div className={analysisStep >= 1 ? 'text-[var(--ox-forest)] font-semibold' : 'opacity-40'}>
                {analysisStep >= 1 ? '✓' : '○'} Reading source excerpt ({sample.docName})
              </div>
              <div className={analysisStep >= 2 ? 'text-[var(--ox-forest)] font-semibold' : 'opacity-40'}>
                {analysisStep >= 2 ? '✓' : '○'} Extracting core pedagogical concepts
              </div>
              <div className={analysisStep >= 3 ? 'text-[var(--ox-forest)] font-semibold' : 'opacity-40'}>
                {analysisStep >= 3 ? '✓' : '○'} Grounding verifiable page citations
              </div>
              <div className={analysisStep >= 4 ? 'text-[var(--ox-forest)] font-semibold' : 'opacity-40'}>
                {analysisStep >= 4 ? '✓' : '○'} Synthesizing active practice & FSRS card
              </div>
            </div>
          </div>
        ) : (
          <div className="ox-sandbox-stage-wrap">
            {/* 3-Stage Narrative Navigation Bar */}
            <div className="ox-sandbox-nav-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeStage === 'understand'}
                onClick={() => setActiveStage('understand')}
                className={`ox-sandbox-nav-btn ${activeStage === 'understand' ? 'active' : ''}`}
              >
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-[var(--ox-forest-soft)] text-[var(--ox-forest)] font-mono font-bold">
                  {hasFollowedUp ? '✓' : '1'}
                </span>
                <span>Understand</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeStage === 'practice'}
                onClick={() => setActiveStage('practice')}
                className={`ox-sandbox-nav-btn ${activeStage === 'practice' ? 'active' : ''}`}
              >
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-[var(--ox-forest-soft)] text-[var(--ox-forest)] font-mono font-bold">
                  {hasPracticed ? '✓' : '2'}
                </span>
                <span>Practice</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeStage === 'remember'}
                onClick={() => setActiveStage('remember')}
                className={`ox-sandbox-nav-btn ${activeStage === 'remember' ? 'active' : ''}`}
              >
                <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-[var(--ox-forest-soft)] text-[var(--ox-forest)] font-mono font-bold">
                  {hasRemembered ? '✓' : '3'}
                </span>
                <span>Remember</span>
              </button>
            </div>

            {/* Stage Body */}
            <div className="ox-sandbox-content">
              <AnimatePresence mode="wait">
                {/* ══════════════════════════════════════════════════════
                    STAGE 1: UNDERSTAND (Socratic Grounded Tutor)
                   ══════════════════════════════════════════════════════ */}
                {activeStage === 'understand' && (
                  <motion.div
                    key={`understand-${selectedSampleKey}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                  >
                    {/* Header Row */}
                    <div className="flex justify-between items-center pb-3 border-b border-[var(--ox-border)]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ox-forest)]">
                          Shiro Tutor · Socratic Mode
                        </span>
                      </div>
                      <span className="text-xs text-[var(--ox-text-muted)] font-mono">
                        Source-grounded answer
                      </span>
                    </div>

                    {/* Tutor Explanation */}
                    <p className="text-sm sm:text-base text-[var(--ox-text-main)] leading-relaxed m-0">
                      {sample.tutorAnswer}
                    </p>

                    {/* Structured Key Ideas Box */}
                    <div className="p-4 rounded-xl bg-[var(--ox-bg-subtle)] border border-[var(--ox-border)] space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-[var(--ox-text-secondary)] font-mono">
                        Key Ideas
                      </div>
                      <ul className="list-none p-0 m-0 space-y-1.5 text-xs sm:text-sm text-[var(--ox-text-main)]">
                        {sample.keyIdeas.map((idea, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-[var(--ox-forest)] font-bold">→</span>
                            <span>{idea}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Source Citation Pill & Drawer Trigger */}
                    <div className="space-y-3 pt-1">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setShowCitationDrawer(!showCitationDrawer)}
                          aria-expanded={showCitationDrawer}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--ox-bg-card)] hover:bg-[var(--ox-bg-subtle)] border border-[var(--ox-border)] text-xs text-[var(--ox-text-secondary)] hover:text-[var(--ox-text-main)] transition-colors cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm text-[var(--ox-forest)]">description</span>
                          <span className="font-mono font-medium">{sample.docName}</span>
                          <span className="text-[11px] text-[var(--ox-text-muted)]">Page {sample.page} · {sample.section}</span>
                          <span className="material-symbols-outlined text-xs text-[var(--ox-text-muted)]">
                            {showCitationDrawer ? 'expand_less' : 'expand_more'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setActiveStage('practice')}
                          className="ox-btn-forest text-xs py-1.5 px-4"
                        >
                          <span>Continue to Practice →</span>
                        </button>
                      </div>

                      {/* Animated Source Excerpt Drawer */}
                      {showCitationDrawer && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-3.5 rounded-xl bg-[var(--ox-bg-subtle)] border-l-4 border-l-[var(--ox-forest)] border border-[var(--ox-border)] text-xs text-[var(--ox-text-secondary)] space-y-1.5"
                        >
                          <div className="flex justify-between items-center font-mono font-semibold text-[var(--ox-forest)] text-[11px]">
                            <span>VERIFIED SOURCE EXCERPT · PAGE {sample.page}</span>
                            <span className="text-[var(--ox-text-muted)]">Zero-hallucination citation</span>
                          </div>
                          <p className="m-0 leading-relaxed italic">
                            "{sample.excerpt}"
                          </p>
                        </motion.div>
                      )}
                    </div>

                    {/* Mini "Ask Shiro" Follow-up */}
                    <div className="pt-2 border-t border-[var(--ox-border)]">
                      {!showFollowUp ? (
                        <button
                          type="button"
                          onClick={() => { setShowFollowUp(true); setHasFollowedUp(true); }}
                          className="w-full text-left p-3 rounded-xl bg-[var(--ox-bg-subtle)] hover:bg-[var(--ox-bg-card)] border border-[var(--ox-border)] hover:border-[var(--ox-forest)] transition-all flex items-center justify-between text-xs text-[var(--ox-text-main)] cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-[var(--ox-forest)]">chat_bubble_outline</span>
                            <span><strong>Ask follow-up:</strong> "{sample.followUpQuestion}"</span>
                          </div>
                          <span className="material-symbols-outlined text-xs text-[var(--ox-text-muted)] group-hover:translate-x-0.5 transition-transform">
                            arrow_forward
                          </span>
                        </button>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="p-4 rounded-xl bg-[var(--ox-bg-subtle)] border border-[var(--ox-forest)]/30 space-y-2"
                        >
                          <div className="flex items-center gap-2 text-xs font-bold text-[var(--ox-forest)] font-mono">
                            <span className="material-symbols-outlined text-sm">psychology</span>
                            <span>Q: {sample.followUpQuestion}</span>
                          </div>
                          <p className="text-xs sm:text-sm text-[var(--ox-text-main)] leading-relaxed m-0">
                            {sample.followUpAnswer}
                          </p>
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* ══════════════════════════════════════════════════════
                    STAGE 2: PRACTICE (Active Diagnostic Recall)
                   ══════════════════════════════════════════════════════ */}
                {activeStage === 'practice' && (
                  <motion.div
                    key={`practice-${selectedSampleKey}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                  >
                    <div className="flex justify-between items-center pb-3 border-b border-[var(--ox-border)]">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ox-forest)]">
                        Diagnostic Active Recall · 10-Mark Question
                      </span>
                      <span className="text-xs text-[var(--ox-text-muted)] font-mono">
                        Instant scoring rationale
                      </span>
                    </div>

                    <div className="text-sm sm:text-base font-semibold text-[var(--ox-text-main)] leading-snug">
                      {sample.question}
                    </div>

                    {/* Option Choices */}
                    <div className="space-y-2.5" role="radiogroup" aria-label="Question options">
                      {sample.options.map((opt) => {
                        const isSelected = selectedOption === opt.id;
                        let btnStyle = 'border-[var(--ox-border)] bg-[var(--ox-bg-subtle)] text-[var(--ox-text-main)]';
                        
                        if (isAnswerChecked) {
                          if (opt.correct) {
                            btnStyle = 'border-[var(--ox-forest)] bg-[var(--ox-forest-soft)] text-[var(--ox-forest)] font-semibold';
                          } else if (isSelected && !opt.correct) {
                            btnStyle = 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400';
                          }
                        } else if (isSelected) {
                          btnStyle = 'border-[var(--ox-forest)] bg-[var(--ox-bg-card)] shadow-xs';
                        }

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            disabled={isAnswerChecked}
                            onClick={() => setSelectedOption(opt.id)}
                            className={`w-full p-3.5 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${btnStyle}`}
                          >
                            <span className="w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 bg-[var(--ox-bg-card)] border border-[var(--ox-border)]">
                              {opt.id}
                            </span>
                            <span className="text-xs sm:text-sm leading-relaxed flex-1 pt-0.5">
                              {opt.text}
                            </span>
                            {isAnswerChecked && opt.correct && (
                              <span className="material-symbols-outlined text-sm text-[var(--ox-forest)] shrink-0">
                                check_circle
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Check Answer or Feedback State */}
                    {!isAnswerChecked ? (
                      <div className="flex justify-end pt-2">
                        <button
                          type="button"
                          disabled={!selectedOption}
                          onClick={handleCheckAnswer}
                          className={`ox-btn-forest text-xs py-2 px-6 ${!selectedOption ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <span>Check Answer</span>
                        </button>
                      </div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-xl bg-[var(--ox-forest-soft)] border border-[var(--ox-forest)]/30 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--ox-forest)] font-mono">
                            <span className="material-symbols-outlined text-base">verified</span>
                            <span>{selectedOption === 'A' ? '✓ Correct Understanding' : 'Explanation & Model Takeaway'}</span>
                          </div>
                          <span className="text-[11px] font-mono text-[var(--ox-text-muted)]">
                            Understanding: Strong
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-[var(--ox-text-main)] leading-relaxed m-0">
                          {sample.explanation}
                        </p>
                        <div className="pt-2 flex items-center justify-between">
                          <span className="text-[11px] text-[var(--ox-forest)] font-medium">
                            {sample.examinerTakeaway}
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveStage('remember')}
                            className="ox-btn-forest text-xs py-1.5 px-4"
                          >
                            <span>Continue to Remember (Step 3) →</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* ══════════════════════════════════════════════════════
                    STAGE 3: REMEMBER (FSRS 4.5 Spaced Memory Review)
                   ══════════════════════════════════════════════════════ */}
                {activeStage === 'remember' && (
                  <motion.div
                    key={`remember-${selectedSampleKey}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-5"
                  >
                    <div className="flex justify-between items-center pb-3 border-b border-[var(--ox-border)]">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--ox-forest)]">
                          FSRS 4.5 Memory Scheduler
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--ox-bg-subtle)] border border-[var(--ox-border)] font-mono text-[var(--ox-text-muted)]">
                          Interactive simulation
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-[var(--ox-text-secondary)]">Retention: <strong>{stabilityScore}%</strong></span>
                        <span className="text-[var(--ox-forest)] font-semibold">Next: {reviewInterval}</span>
                      </div>
                    </div>

                    {/* Accessible 3D Flippable Card */}
                    <button
                      type="button"
                      aria-label={`Flashcard: ${cardFlipped ? 'Answer side' : 'Question side'}. Press Space or click to flip.`}
                      onClick={() => setCardFlipped(!cardFlipped)}
                      className="w-full min-h-[160px] p-6 rounded-2xl bg-[var(--ox-bg-card)] hover:bg-[var(--ox-bg-subtle)] border border-[var(--ox-border)] shadow-sm flex flex-col justify-between text-left transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-center text-xs font-mono text-[var(--ox-text-muted)]">
                        <span className="uppercase tracking-wider font-semibold">
                          {cardFlipped ? 'Answer (Flipped)' : 'Question (Click to flip)'}
                        </span>
                        <span className="text-[11px] group-hover:text-[var(--ox-forest)] transition-colors">
                          Space / Click ↵
                        </span>
                      </div>

                      <div className="text-sm sm:text-base font-medium text-[var(--ox-text-main)] my-3 leading-relaxed">
                        {cardFlipped ? sample.flashcard.a : sample.flashcard.q}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-[var(--ox-text-muted)] font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--ox-forest)]" />
                        <span>FSRS card generated from Page {sample.page}</span>
                      </div>
                    </button>

                    {/* FSRS Rating Buttons */}
                    <div className="space-y-2">
                      <div className="text-xs text-[var(--ox-text-muted)] font-mono uppercase tracking-wider">
                        Rate recall difficulty (recalculates memory stability):
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { key: 'again', label: 'Again', desc: '<10 mins', style: 'hover:border-red-500/40 hover:bg-red-500/5' },
                          { key: 'hard', label: 'Hard', desc: '1 day', style: 'hover:border-[var(--ox-gold)]/40 hover:bg-[var(--ox-gold)]/5' },
                          { key: 'good', label: 'Good', desc: '4 days', style: 'hover:border-[var(--ox-forest)]/40 hover:bg-[var(--ox-forest-soft)]' },
                          { key: 'easy', label: 'Easy', desc: '9 days', style: 'hover:border-[var(--ox-forest)] hover:bg-[var(--ox-forest-soft)]' },
                        ].map((r) => (
                          <button
                            key={r.key}
                            type="button"
                            onClick={() => handleRating(r.key)}
                            className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer bg-[var(--ox-bg-subtle)] ${
                              selectedRating === r.key 
                                ? 'border-[var(--ox-forest)] bg-[var(--ox-forest-soft)] text-[var(--ox-forest)] font-bold shadow-xs' 
                                : `border-[var(--ox-border)] text-[var(--ox-text-main)] ${r.style}`
                            }`}
                          >
                            <div className="text-xs font-bold">{r.label}</div>
                            <div className="text-[10px] text-[var(--ox-text-muted)] font-mono">{r.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Post-Loop Shiro Advantage Box */}
                    <div className="p-4 rounded-xl bg-[var(--ox-bg-subtle)] border border-[var(--ox-border)] space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="text-xs font-bold text-[var(--ox-forest)] font-mono uppercase tracking-wider">
                          Shiro Learning Loop Completed
                        </div>
                        <div className="flex gap-1.5 text-[11px] text-[var(--ox-text-secondary)] font-mono">
                          <span>✓ Grounded</span>
                          <span>·</span>
                          <span>✓ Active Recall</span>
                          <span>·</span>
                          <span>✓ Spaced Review</span>
                        </div>
                      </div>

                      {/* Try other subjects */}
                      <div className="flex items-center justify-between pt-2 border-t border-[var(--ox-border)] flex-wrap gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--ox-text-muted)] font-mono">Try next:</span>
                          {Object.entries(SAMPLES).filter(([k]) => k !== selectedSampleKey).map(([k, s]) => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => handleSelectSample(k)}
                              className="px-2.5 py-1 rounded-lg bg-[var(--ox-bg-card)] hover:bg-[var(--ox-bg-subtle)] border border-[var(--ox-border)] text-xs text-[var(--ox-text-secondary)] hover:text-[var(--ox-text-main)] cursor-pointer"
                            >
                              {s.subjectLabel}
                            </button>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => navigate('/register')}
                          className="ox-btn-forest text-xs py-2 px-5"
                        >
                          <span>Start Learning Free →</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </motion.div>
    </section>
  );
}
