import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Context } from '../../../context/Context';
import API_BASE_URL from '../../../api/config.js';
import { fetchWithAuth } from '../../../api/fetchWithAuth';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  HelpCircle, 
  RotateCw, 
  CheckCircle2, 
  XCircle, 
  Award, 
  BookOpen, 
  Layers, 
  Flame, 
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  Brain,
  Zap,
  ChevronRight,
  RefreshCw,
  Clock
} from 'lucide-react';

import Card, { CardHeader, CardContent } from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';

export const QuizPage = () => {
  const { user } = useAuth();
  const { documents, fetchDocuments, activeHandoffContext } = useContext(Context);
  const navigate = useNavigate();
  const location = useLocation();

  const handoff = location.state?.handoff || activeHandoffContext;
  const initialDocId = location.state?.documentId || handoff?.document_ids?.[0] || '';

  // Configuration State
  const [selectedDocId, setSelectedDocId] = useState(initialDocId);
  const [numQuestions, setNumQuestions] = useState(5);
  const [difficulty, setDifficulty] = useState(handoff?.difficulty || 'medium');
  const [isConfiguring, setIsConfiguring] = useState(true);

  // Active Quiz State
  const [quizData, setQuizData] = useState(null);
  const [quizId, setQuizId] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (user?.id) fetchDocuments(user.id);
  }, [user]);

  // Set default document if none selected
  useEffect(() => {
    if (documents?.length > 0 && !selectedDocId) {
      setSelectedDocId(location.state?.documentId || documents[0].id);
    }
  }, [documents, selectedDocId, location.state]);

  // Explicit Generator - Only fires when user clicks "Generate Quiz"
  const handleGenerateQuiz = async () => {
    if (!selectedDocId) {
      toast.error('Please select a study document first.');
      return;
    }

    if (numQuestions < 1 || numQuestions > 30) {
      toast.error('Please choose between 1 and 30 questions.');
      return;
    }

    setLoading(true);
    setQuizData(null);
    setSubmitted(false);
    setSelectedAnswers({});

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/generate-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: parseInt(selectedDocId),
          num_questions: parseInt(numQuestions, 10),
          difficulty: difficulty,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to generate quiz');
      }

      const data = await response.json();
      if (!data.questions || data.questions.length === 0) {
        throw new Error('No valid questions could be synthesized from this document.');
      }

      setQuizData(data.questions);
      setQuizId(data.quiz_id);
      setIsConfiguring(false);
      toast.success(`Generated ${data.questions.length} active recall questions!`);
    } catch (error) {
      console.error('Quiz Generation Error:', error);
      toast.error(error.message || 'Failed to generate quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (questionIndex, optionKey) => {
    if (submitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionKey,
    }));
  };

  const submitQuiz = async () => {
    if (!quizData || quizData.length === 0) return;
    
    let calculatedScore = 0;
    const formattedAnswers = {};

    quizData.forEach((q, idx) => {
      const ans = selectedAnswers[idx] || '';
      formattedAnswers[q.id] = ans;
      if (ans.toUpperCase() === (q.correct_answer || '').toUpperCase()) {
        calculatedScore++;
      }
    });

    setScore(calculatedScore);
    setSubmitted(true);

    try {
      await fetchWithAuth(`${API_BASE_URL}/submit-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          document_id: parseInt(selectedDocId),
          quiz_id: quizId,
          answers: formattedAnswers,
        }),
      });
      toast.success('Quiz submitted! Performance saved to learning analytics.');
    } catch (e) {
      console.error('Error submitting quiz progress:', e);
    }
  };

  const handleResetToConfig = () => {
    setIsConfiguring(true);
    setQuizData(null);
    setSubmitted(false);
    setSelectedAnswers({});
  };

  const selectedDocument = documents?.find(d => String(d.id) === String(selectedDocId));
  const answeredCount = Object.keys(selectedAnswers).length;
  const totalCount = quizData?.length || 0;
  const progressPercent = totalCount > 0 ? (answeredCount / totalCount) * 100 : 0;

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3F6048] dark:text-[#89A88D] mb-1 font-mono uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>ACTIVE RECALL ASSESSMENT</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-main)] tracking-tight font-serif">
            Quiz Arena
          </h1>
        </div>

        {!isConfiguring && quizData && (
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleResetToConfig}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Configure New Quiz
            </Button>
          </div>
        )}
      </div>

      {/* Chat Context Handoff Notification */}
      {handoff?.topic && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-2xl bg-[#3F6048]/15 dark:bg-[#89A88D]/15 border border-[#3F6048]/30 dark:border-[#89A88D]/30 flex items-center justify-between text-xs text-[var(--text-main)] shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#3F6048] dark:text-[#89A88D] shrink-0" />
            <span>
              <strong>Chat Study Bridge:</strong> Focused on <em>"{handoff.topic}"</em>
            </span>
          </div>
          <Badge variant="sage" size="sm">
            {handoff.difficulty || difficulty}
          </Badge>
        </motion.div>
      )}

      {/* 1. QUIZ SETUP & CONFIGURATION SCREEN */}
      {isConfiguring ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-6"
        >
          <Card className="border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
            <CardHeader
              title="Quiz Generation Setup"
              subtitle="Customize your questions, difficulty, and study source before generating"
              icon={SlidersHorizontal}
            />
            <CardContent className="space-y-6 pt-4">
              {/* Document Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#3F6048] dark:text-[#89A88D]" />
                  <span>Select Study Source Document</span>
                </label>
                {documents?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {documents.map((doc) => {
                      const isSelected = String(selectedDocId) === String(doc.id);
                      return (
                        <div
                          key={doc.id}
                          onClick={() => setSelectedDocId(doc.id)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#3F6048]/10 dark:bg-[#89A88D]/20 border-[#3F6048] dark:border-[#89A88D] shadow-xs'
                              : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] hover:border-[#89A88D]/40'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <p className="text-xs sm:text-sm font-semibold text-[var(--text-main)] truncate font-serif">
                              {doc.filename}
                            </p>
                            <p className="text-[11px] text-[var(--text-secondary)]">
                              {doc.subject || 'General Study Material'}
                            </p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-[#3F6048] dark:text-[#89A88D] shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-surface-elevated)] text-center space-y-2">
                    <p className="text-xs text-[var(--text-secondary)]">
                      No documents found in your library.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate('/documents')}
                    >
                      Upload a Document
                    </Button>
                  </div>
                )}
              </div>

              {/* Number of Questions Selector */}
              <div className="space-y-2.5 pt-2 border-t border-[var(--border)]">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-[#D6A84F]" />
                    <span>Number of Questions</span>
                  </label>
                  <span className="text-xs font-bold font-mono text-[#3F6048] dark:text-[#89A88D] bg-[#3F6048]/10 dark:bg-[#89A88D]/15 px-2 py-0.5 rounded-md">
                    {numQuestions} Questions
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-5 gap-2">
                  {[3, 5, 10, 15, 20].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setNumQuestions(count)}
                      className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                        numQuestions === count
                          ? 'bg-[#3F6048] text-white dark:bg-[#89A88D] dark:text-[#111210] border-[#3F6048] dark:border-[#89A88D] shadow-xs'
                          : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[#89A88D]/40'
                      }`}
                    >
                      {count} Qs
                    </button>
                  ))}
                </div>

                {/* Range Slider for Custom Count */}
                <div className="flex items-center gap-3 pt-1">
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">1</span>
                  <input
                    type="range"
                    min="1"
                    max="25"
                    step="1"
                    value={numQuestions}
                    onChange={(e) => setNumQuestions(parseInt(e.target.value, 10))}
                    className="flex-1 accent-[#3F6048] dark:accent-[#89A88D] cursor-pointer"
                  />
                  <span className="text-[11px] text-[var(--text-muted)] font-mono">25</span>
                </div>
              </div>

              {/* Difficulty Selector */}
              <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                <label className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Brain className="w-3.5 h-3.5 text-[#3F6048] dark:text-[#89A88D]" />
                  <span>Cognitive Difficulty Level</span>
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: 'easy', label: 'Easy (Recall)', desc: 'Core facts & direct terminology' },
                    { id: 'medium', label: 'Medium (Applied)', desc: 'Conceptual reasoning & application' },
                    { id: 'hard', label: 'Hard (Deep Synthesis)', desc: 'Complex problem solving & edge cases' },
                  ].map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setDifficulty(level.id)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        difficulty === level.id
                          ? 'bg-[#3F6048]/10 dark:bg-[#89A88D]/20 border-[#3F6048] dark:border-[#89A88D] shadow-xs'
                          : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] hover:border-[#89A88D]/40 text-[var(--text-secondary)]'
                      }`}
                    >
                      <p className="text-xs font-bold text-[var(--text-main)] font-serif">
                        {level.label}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5 leading-tight">
                        {level.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit & Generate Action */}
              <div className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Est. completion time: ~{Math.ceil(numQuestions * 1.2)} minutes</span>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleGenerateQuiz}
                  disabled={loading || !selectedDocId}
                  className="w-full sm:w-auto font-bold px-6 py-3 shadow-md hover:scale-[1.02] active:scale-[0.98] transition-transform"
                >
                  {loading ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" />
                      <span>Synthesizing Quiz ({numQuestions} Qs)...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Quiz ({numQuestions} Questions)</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : loading ? (
        /* Loading Animation Screen */
        <div className="py-20 text-center space-y-4 glass-panel bg-[var(--bg-surface)] border-[var(--border)] rounded-2xl shadow-sm">
          <div className="w-10 h-10 border-3 border-[#3F6048] dark:border-[#89A88D] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[var(--text-main)] font-serif">
              Generating Grounded Quiz Questions...
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
              Extracting knowledge from <strong>{selectedDocument?.filename || 'selected document'}</strong> and filtering through QualityGate validation.
            </p>
          </div>
        </div>
      ) : quizData ? (
        /* 2. ACTIVE QUIZ ARENA */
        <div className="space-y-6">
          {/* Progress Tracker Bar */}
          <div className="glass-panel p-4 bg-[var(--bg-surface)] border-[var(--border)] rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--text-main)] font-serif flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#3F6048] dark:text-[#89A88D]" />
                {selectedDocument?.filename || 'Study Document'}
              </span>
              <span className="font-mono text-[var(--text-secondary)]">
                Answered {answeredCount} of {totalCount} ({progressPercent.toFixed(0)}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--bg-surface-elevated)] overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#3F6048] to-[#89A88D]"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>

          {/* Result Score Banner when Submitted */}
          {submitted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="glass-panel p-6 border-[#3F6048]/30 dark:border-[#89A88D]/30 bg-[var(--bg-surface)] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#D6A84F]/15 border border-[#D6A84F]/30 flex items-center justify-center text-[#D6A84F] shadow-sm shrink-0">
                  <Award className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[var(--text-main)] font-serif">
                    Score: {score} / {totalCount} ({((score / totalCount) * 100).toFixed(0)}%)
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {score / totalCount >= 0.8
                      ? '🌟 Mastery achieved! High retention verified on this material.'
                      : '💡 Review incorrect questions below, then reinforce weak concepts with Flashcards.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <Button variant="outline" size="sm" onClick={() => navigate('/flashcards')}>
                  <Layers className="w-3.5 h-3.5" />
                  Flashcards
                </Button>
                <Button variant="primary" size="sm" onClick={handleResetToConfig}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  New Quiz
                </Button>
              </div>
            </motion.div>
          )}

          {/* Question List */}
          <div className="space-y-5">
            {quizData.map((q, qIndex) => {
              const selectedKey = selectedAnswers[qIndex];
              const isCorrect = (selectedKey || '').toUpperCase() === (q.correct_answer || '').toUpperCase();

              return (
                <Card key={q.id || qIndex} className="p-5 sm:p-6 space-y-4 bg-[var(--bg-surface)] border-[var(--border)] shadow-xs rounded-2xl">
                  {/* Question Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="w-7 h-7 rounded-xl bg-[#3F6048]/15 dark:bg-[#89A88D]/15 border border-[#3F6048]/30 dark:border-[#89A88D]/30 text-xs font-mono font-bold text-[#3F6048] dark:text-[#89A88D] flex items-center justify-center shrink-0">
                        {qIndex + 1}
                      </span>
                      <h3 className="font-semibold text-[var(--text-main)] text-sm md:text-base leading-relaxed font-serif pt-0.5">
                        {q.question}
                      </h3>
                    </div>

                    {submitted && (
                      <Badge variant={isCorrect ? 'sage' : 'rose'} size="sm" className="shrink-0">
                        {isCorrect ? (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Correct
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <XCircle className="w-3 h-3" /> Incorrect
                          </span>
                        )}
                      </Badge>
                    )}
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {Object.entries(q.options || {}).map(([key, text]) => {
                      const isSelected = selectedKey === key;
                      const isOptionCorrect = key.toUpperCase() === (q.correct_answer || '').toUpperCase();

                      let btnStyle = 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[#89A88D]/40';

                      if (submitted) {
                        if (isOptionCorrect) {
                          btnStyle = 'bg-[#3F6048]/20 dark:bg-[#89A88D]/20 border-[#3F6048] dark:border-[#89A88D] text-[var(--text-main)] font-semibold shadow-xs';
                        } else if (isSelected && !isOptionCorrect) {
                          btnStyle = 'bg-[#C96B62]/15 border-[#C96B62]/50 text-[#C96B62]';
                        }
                      } else if (isSelected) {
                        btnStyle = 'bg-[#3F6048]/10 dark:bg-[#89A88D]/15 border-[#3F6048] dark:border-[#89A88D] text-[var(--text-main)] font-semibold shadow-xs';
                      }

                      return (
                        <button
                          key={key}
                          onClick={() => handleOptionSelect(qIndex, key)}
                          disabled={submitted}
                          className={`p-3.5 rounded-xl border text-left text-xs md:text-sm flex items-start gap-2.5 transition-all ${btnStyle}`}
                        >
                          <span className="font-mono font-bold text-xs uppercase px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] shrink-0">
                            {key}
                          </span>
                          <span className="leading-snug pt-0.5">{text}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation reveal upon submission */}
                  {submitted && q.explanation && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-1"
                    >
                      <span className="font-bold text-[#3F6048] dark:text-[#89A88D] uppercase tracking-wider font-mono text-[10px] block">
                        Rationale & Explanation:
                      </span>
                      <p className="text-[var(--text-main)] leading-relaxed">{q.explanation}</p>
                    </motion.div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Submit Button Bar */}
          {!submitted && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetToConfig}
              >
                Cancel & Reconfigure
              </Button>

              <Button
                variant="primary"
                size="lg"
                onClick={submitQuiz}
                disabled={answeredCount === 0}
                className="font-bold px-6 shadow-md"
              >
                Submit Answers ({answeredCount} / {totalCount})
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default QuizPage;
