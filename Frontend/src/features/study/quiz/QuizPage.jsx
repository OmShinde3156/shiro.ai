import React, { useState, useEffect, useContext, useRef } from 'react';
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
  Clock,
  Activity,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldCheck,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

import Card, { CardHeader, CardContent } from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';

export const QuizPage = () => {
  const { user } = useAuth();
  const { documents, fetchDocuments, activeHandoffContext, fetchUserStats } = useContext(Context);
  const navigate = useNavigate();
  const location = useLocation();

  const handoff = location.state?.handoff || activeHandoffContext;
  const initialDocId = location.state?.documentId || handoff?.document_ids?.[0] || '';
  const initialTopic = location.state?.topic || handoff?.topic || '';

  // Mode Selection: 'adaptive' (IRT CAT) vs 'standard' (Fixed batch)
  const [assessmentMode, setAssessmentMode] = useState('adaptive');

  // Configuration State
  const [selectedDocId, setSelectedDocId] = useState(initialDocId);
  const [targetTopic, setTargetTopic] = useState(initialTopic);
  const [numQuestions, setNumQuestions] = useState(8);
  const [difficulty, setDifficulty] = useState(handoff?.difficulty || 'medium');
  const [isConfiguring, setIsConfiguring] = useState(true);
  const autoStartedRef = useRef(false);

  // Standard Quiz State
  const [quizData, setQuizData] = useState(null);
  const [quizId, setQuizId] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  // Adaptive CAT State (ADAPT-01)
  const [adaptiveSession, setAdaptiveSession] = useState(null);
  const [adaptiveCurrentQuestion, setAdaptiveCurrentQuestion] = useState(null);
  const [selectedStepOption, setSelectedStepOption] = useState('');
  const [stepSubmitting, setStepSubmitting] = useState(false);
  const [stepFeedback, setStepFeedback] = useState(null);
  const [pendingNextQuestion, setPendingNextQuestion] = useState(null);
  const [diagnosticReport, setDiagnosticReport] = useState(null);
  const [showTechnicalDiagnostics, setShowTechnicalDiagnostics] = useState(false);
  const stepStartTimeRef = useRef(Date.now());

  useEffect(() => {
    if (user?.id) fetchDocuments(user.id);
  }, [user]);

  // Set default document if none selected
  useEffect(() => {
    if (documents?.length > 0 && !selectedDocId) {
      setSelectedDocId(location.state?.documentId || documents[0].id);
    }
  }, [documents, selectedDocId, location.state]);

  // Seamless Handoff Auto-Start
  useEffect(() => {
    if (location.state?.autoStart && selectedDocId && !autoStartedRef.current && !loading && !quizData && !adaptiveSession) {
      autoStartedRef.current = true;
      if (location.state?.mode === 'standard') {
        setAssessmentMode('standard');
        handleGenerateStandardQuiz();
      } else {
        setAssessmentMode('adaptive');
        handleStartAdaptiveAssessment();
      }
    }
  }, [selectedDocId, location.state]);

  // =========================================================================
  // ADAPTIVE ASSESSMENT ACTIONS (ADAPT-01)
  // =========================================================================

  const handleStartAdaptiveAssessment = async () => {
    if (!selectedDocId && !targetTopic) {
      toast.error('Please select a study document or topic.');
      return;
    }

    setLoading(true);
    setAdaptiveSession(null);
    setAdaptiveCurrentQuestion(null);
    setStepFeedback(null);
    setPendingNextQuestion(null);
    setDiagnosticReport(null);
    setSelectedStepOption('');

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/quiz/adaptive/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: selectedDocId ? parseInt(selectedDocId, 10) : null,
          topic: targetTopic || null,
          num_questions: parseInt(numQuestions, 10),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to initialize adaptive assessment');
      }

      const data = await response.json();
      setAdaptiveSession(data);
      setAdaptiveCurrentQuestion(data.question);
      setIsConfiguring(false);
      stepStartTimeRef.current = Date.now();
      toast.success('Adaptive assessment initialized! Calibrated to your mastery level.');
    } catch (error) {
      console.error('Adaptive Start Error:', error);
      toast.error(error.message || 'Failed to start adaptive assessment.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAdaptiveStep = async () => {
    if (!selectedStepOption || !adaptiveCurrentQuestion || !adaptiveSession) {
      toast.error('Please select an option to submit your answer.');
      return;
    }

    setStepSubmitting(true);
    const durationMs = Date.now() - stepStartTimeRef.current;
    const clientStepId = `step_${adaptiveSession.session_id}_${adaptiveSession.current_step}_${Date.now()}`;

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/quiz/adaptive/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: adaptiveSession.session_id,
          question_id: adaptiveCurrentQuestion.id,
          client_step_id: clientStepId,
          selected_answer: selectedStepOption,
          response_time_ms: durationMs,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to evaluate response');
      }

      const data = await response.json();
      setStepFeedback(data.feedback);

      // Update session step
      setAdaptiveSession((prev) => ({
        ...prev,
        current_step: data.step_index,
        ability_level: data.feedback?.ability_band || prev.ability_level,
        is_completed: data.is_completed,
      }));

      if (data.is_completed) {
        setDiagnosticReport(data.diagnostic_report);
        if (user?.id && fetchUserStats) fetchUserStats(user.id);
        toast.success('Assessment complete! Comprehensive diagnostic generated.');
      } else {
        setPendingNextQuestion(data.next_question);
      }
    } catch (error) {
      console.error('Adaptive Step Error:', error);
      toast.error(error.message || 'Failed to submit response.');
    } finally {
      setStepSubmitting(false);
    }
  };

  const handleAdvanceToNextQuestion = () => {
    if (!pendingNextQuestion) return;
    setAdaptiveCurrentQuestion(pendingNextQuestion);
    setPendingNextQuestion(null);
    setStepFeedback(null);
    setSelectedStepOption('');
    stepStartTimeRef.current = Date.now();
  };

  // =========================================================================
  // STANDARD QUIZ ACTIONS (LEGACY BACKWARD COMPATIBILITY)
  // =========================================================================

  const handleGenerateStandardQuiz = async () => {
    if (!selectedDocId) {
      toast.error('Please select a study document first.');
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
          document_id: parseInt(selectedDocId, 10),
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

  const handleStandardOptionSelect = (questionIndex, optionKey) => {
    if (submitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionKey,
    }));
  };

  const submitStandardQuiz = async () => {
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
          document_id: parseInt(selectedDocId, 10),
          quiz_id: quizId,
          answers: formattedAnswers,
        }),
      });
      toast.success('Quiz submitted! Performance saved to learning analytics.');
      if (user?.id && fetchUserStats) fetchUserStats(user.id);
    } catch (e) {
      console.error('Error submitting quiz progress:', e);
    }
  };

  const handleResetToConfig = () => {
    setIsConfiguring(true);
    setQuizData(null);
    setSubmitted(false);
    setSelectedAnswers({});
    setAdaptiveSession(null);
    setAdaptiveCurrentQuestion(null);
    setStepFeedback(null);
    setPendingNextQuestion(null);
    setDiagnosticReport(null);
    setSelectedStepOption('');
  };

  const selectedDocument = documents?.find((d) => String(d.id) === String(selectedDocId));

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3F6048] dark:text-[#89A88D] mb-1 font-mono uppercase tracking-wider">
            <Target className="w-3.5 h-3.5" />
            <span>LEARNER EVALUATION & DIAGNOSTICS</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-main)] tracking-tight font-serif">
            Quiz Arena
          </h1>
        </div>

        {!isConfiguring && (quizData || adaptiveSession) && (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleResetToConfig}>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Configure New Assessment
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
              <strong>Target Focus:</strong> <em>"{handoff.topic}"</em>
            </span>
          </div>
          <Badge variant="sage" size="sm">
            {handoff.difficulty || difficulty}
          </Badge>
        </motion.div>
      )}

      {/* ===================================================================== */}
      {/* 1. QUIZ SETUP & CONFIGURATION SCREEN                                 */}
      {/* ===================================================================== */}
      {isConfiguring ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-6"
        >
          {/* Assessment Mode Selector Tab */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              onClick={() => setAssessmentMode('adaptive')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5 ${
                assessmentMode === 'adaptive'
                  ? 'bg-[#3F6048]/10 dark:bg-[#89A88D]/15 border-[#3F6048] dark:border-[#89A88D] shadow-xs ring-1 ring-[#3F6048]/20'
                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] hover:border-[#89A88D]/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#3F6048]/20 dark:bg-[#89A88D]/30 flex items-center justify-center text-[#3F6048] dark:text-[#89A88D]">
                    <Zap className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-[var(--text-main)] font-serif">
                    Adaptive Assessment
                  </span>
                </div>
                <span className="text-[10px] font-mono font-extrabold uppercase px-2 py-0.5 rounded bg-[#D6A84F]/20 text-[#D6A84F] border border-[#D6A84F]/30">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Shiro dynamically calibrates question difficulty after each answer to pinpoint your exact ability level and knowledge gaps.
              </p>
            </div>

            <div
              onClick={() => setAssessmentMode('standard')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5 ${
                assessmentMode === 'standard'
                  ? 'bg-[#3F6048]/10 dark:bg-[#89A88D]/15 border-[#3F6048] dark:border-[#89A88D] shadow-xs ring-1 ring-[#3F6048]/20'
                  : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] hover:border-[#89A88D]/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)]">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-bold text-[var(--text-main)] font-serif">
                    Standard Quiz
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">Fixed Length</span>
              </div>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                A traditional fixed-length question set with uniform difficulty covering the document sequentially.
              </p>
            </div>
          </div>

          <Card className="border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
            <CardHeader
              title={assessmentMode === 'adaptive' ? 'Adaptive Diagnostic Setup' : 'Standard Quiz Setup'}
              subtitle={
                assessmentMode === 'adaptive'
                  ? 'Configure candidate parameters for computer-adaptive testing'
                  : 'Customize your questions, difficulty, and study source'
              }
              icon={assessmentMode === 'adaptive' ? Target : SlidersHorizontal}
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
                    <Button variant="outline" size="sm" onClick={() => navigate('/documents')}>
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
                    <span>
                      {assessmentMode === 'adaptive' ? 'Maximum Assessment Questions' : 'Number of Questions'}
                    </span>
                  </label>
                  <span className="text-xs font-bold font-mono text-[#3F6048] dark:text-[#89A88D] bg-[#3F6048]/10 dark:bg-[#89A88D]/15 px-2 py-0.5 rounded-md">
                    {numQuestions} {assessmentMode === 'adaptive' ? 'Max Questions' : 'Questions'}
                  </span>
                </div>

                {assessmentMode === 'adaptive' && (
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Adaptive testing terminates dynamically once measurement error reaches statistical confidence (typically 4–8 questions).
                  </p>
                )}

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-2">
                  {[4, 6, 8, 12].map((count) => (
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
              </div>

              {/* Standard Mode Difficulty Selector */}
              {assessmentMode === 'standard' && (
                <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                  <label className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5 text-[#3F6048] dark:text-[#89A88D]" />
                    <span>Cognitive Difficulty Level</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
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
              )}

              {/* Submit Action */}
              <div className="pt-4 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Est. duration: ~{Math.ceil(numQuestions * 1.1)} minutes</span>
                </div>

                <Button
                  variant="primary"
                  size="lg"
                  onClick={assessmentMode === 'adaptive' ? handleStartAdaptiveAssessment : handleGenerateStandardQuiz}
                  disabled={loading || !selectedDocId}
                  className="w-full sm:w-auto"
                >
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  <span>
                    {assessmentMode === 'adaptive' ? 'Launch Adaptive Assessment' : 'Generate Standard Quiz'}
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : loading ? (
        /* Loading Screen */
        <div className="py-20 text-center space-y-4 glass-panel bg-[var(--bg-surface)] border-[var(--border)] rounded-2xl shadow-sm">
          <div className="w-10 h-10 border-3 border-[#3F6048] dark:border-[#89A88D] border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[var(--text-main)] font-serif">
              {assessmentMode === 'adaptive' ? 'Calibrating Item Bank...' : 'Generating Quiz Questions...'}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
              Synthesizing questions from <strong>{selectedDocument?.filename || 'selected document'}</strong> and filtering with QualityGate validation.
            </p>
          </div>
        </div>
      ) : assessmentMode === 'adaptive' && adaptiveSession ? (
        /* ===================================================================== */
        /* 2. ADAPTIVE ASSESSMENT IN-FLIGHT ARENA (ADAPT-01)                    */
        /* ===================================================================== */
        <div className="space-y-6">
          {/* Diagnostic HUD Bar */}
          <div className="glass-panel p-4 bg-[var(--bg-surface)] border-[var(--border)] rounded-2xl space-y-2.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[var(--text-main)] font-serif flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#3F6048] dark:text-[#89A88D]" />
                  {selectedDocument?.filename || adaptiveSession.topic}
                </span>
                <span className="text-[var(--text-muted)]">&middot;</span>
                <Badge variant="sage" size="sm">
                  {adaptiveCurrentQuestion?.difficulty_level || 'Standard'}
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-[var(--text-secondary)] text-[11px]">
                  Question {adaptiveSession.current_step + 1} of ~{adaptiveSession.target_questions}
                </span>
                <span className="text-[var(--text-muted)]">&middot;</span>
                <div className="flex items-center gap-1 text-[11px] font-mono">
                  <span className="text-[var(--text-muted)]">Current Level:</span>
                  <strong className="text-[var(--text-main)] uppercase tracking-wide">
                    {adaptiveSession.ability_level || 'Calibrating'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Stepping Indicator Progress */}
            <div className="w-full h-2 rounded-full bg-[var(--bg-surface-elevated)] overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#3F6048] to-[#89A88D]"
                initial={{ width: 0 }}
                animate={{
                  width: `${Math.min(100, ((adaptiveSession.current_step + 1) / adaptiveSession.target_questions) * 100)}%`
                }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>

          {/* Post-Assessment Completed Diagnostic Card */}
          {adaptiveSession.is_completed && diagnosticReport ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="p-6 md:p-8 rounded-2xl border border-[#3F6048]/40 dark:border-[#89A88D]/40 bg-[var(--bg-surface)] space-y-6 shadow-md"
            >
              {/* Top Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-[#D6A84F]/15 border border-[#D6A84F]/30 flex items-center justify-center text-[#D6A84F] shrink-0 shadow-sm">
                    <Award className="w-8 h-8" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#3F6048] dark:text-[#89A88D]">
                        ASSESSMENT COMPLETE
                      </span>
                      <Badge variant="sage" size="sm">
                        {diagnosticReport.stopping_reason === 'SE_CONVERGED' ? 'High Confidence' : 'Target Completed'}
                      </Badge>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold font-serif text-[var(--text-main)] mt-0.5">
                      Level: {diagnosticReport.final_ability_band}
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      {diagnosticReport.stopping_explanation}
                    </p>
                  </div>
                </div>

                <div className="text-right sm:text-right border-t sm:border-t-0 pt-3 sm:pt-0 border-[var(--border)]">
                  <div className="text-2xl font-mono font-extrabold text-[var(--text-main)]">
                    {diagnosticReport.accuracy_percentage}%
                  </div>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    {diagnosticReport.correct_items} / {diagnosticReport.total_items_answered} questions correct
                  </span>
                </div>
              </div>

              {/* Mastered vs Needs Practice Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#16A34A] dark:text-[#4ADE80]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Validated Strengths</span>
                  </div>
                  {diagnosticReport.mastered_concepts?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {diagnosticReport.mastered_concepts.map((c, idx) => (
                        <span key={idx} className="text-xs px-2.5 py-1 rounded-lg bg-[#16A34A]/10 text-[#16A34A] dark:text-[#4ADE80] font-medium border border-[#16A34A]/20">
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">Foundational concepts still developing.</p>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#D97706] dark:text-[#FBBF24]">
                    <Target className="w-4 h-4" />
                    <span>Focus Areas for Practice</span>
                  </div>
                  {diagnosticReport.needs_practice_concepts?.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {diagnosticReport.needs_practice_concepts.map((c, idx) => (
                        <span key={idx} className="text-xs px-2.5 py-1 rounded-lg bg-[#D97706]/10 text-[#D97706] dark:text-[#FBBF24] font-medium border border-[#D97706]/20">
                          {c}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)]">No major concept deficits detected!</p>
                  )}
                </div>
              </div>

              {/* Trajectory Sparkline Mini-Viz */}
              {diagnosticReport.ability_trajectory?.length > 1 && (
                <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[var(--text-main)] font-mono">Ability Calibration Trajectory (&theta;)</span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      {diagnosticReport.ability_trajectory.length} observation points
                    </span>
                  </div>
                  <div className="h-16 flex items-end gap-1.5 pt-2">
                    {diagnosticReport.ability_trajectory.map((val, idx) => {
                      const heightPercent = Math.max(15, Math.min(100, ((val + 2.5) / 5.0) * 100));
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                          <div
                            className="w-full rounded-t bg-[#3F6048] dark:bg-[#89A88D] transition-all hover:bg-[#D6A84F]"
                            style={{ height: `${heightPercent}%` }}
                          />
                          <span className="text-[9px] font-mono text-[var(--text-muted)]">Q{idx}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recovery Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)]">
                <Button variant="outline" size="sm" onClick={handleResetToConfig}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Take Another Assessment</span>
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => navigate('/flashcards', { state: { topic: adaptiveSession.topic } })}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Review in Flashcards</span>
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/insights')}
                  >
                    <span>View Learning Ledger</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : adaptiveCurrentQuestion ? (
            /* Active Question Card */
            <Card className="p-5 sm:p-6 space-y-4 bg-[var(--bg-surface)] border-[var(--border)] shadow-xs rounded-2xl">
              {/* Question Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-[#3F6048] dark:text-[#89A88D] px-2 py-0.5 rounded bg-[#3F6048]/10 dark:bg-[#89A88D]/15">
                      CONCEPT: {adaptiveCurrentQuestion.concept_name}
                    </span>
                    <span className="text-[11px] font-mono text-[var(--text-muted)]">
                      Tier: {adaptiveCurrentQuestion.difficulty_level}
                    </span>
                  </div>
                  <h3 className="font-semibold text-[var(--text-main)] text-sm md:text-base leading-relaxed font-serif pt-1">
                    {adaptiveCurrentQuestion.question}
                  </h3>
                </div>

                {stepFeedback && (
                  <Badge variant={stepFeedback.is_correct ? 'sage' : 'rose'} size="sm" className="shrink-0">
                    {stepFeedback.is_correct ? (
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
                {Object.entries(adaptiveCurrentQuestion.options || {}).map(([key, text]) => {
                  const isSelected = selectedStepOption === key;
                  const isSubmitted = !!stepFeedback;
                  const isOptionCorrect = key.toUpperCase() === (stepFeedback?.correct_answer || '').toUpperCase();

                  let btnStyle = 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[#89A88D]/40';

                  if (isSubmitted) {
                    if (isOptionCorrect) {
                      btnStyle = 'bg-[var(--primary-subtle)] border-[var(--primary)] text-[var(--text-main)] font-semibold shadow-xs';
                    } else if (isSelected && !isOptionCorrect) {
                      btnStyle = 'bg-[var(--danger)]/10 border-[var(--danger)]/40 text-[var(--danger)] font-semibold';
                    }
                  } else if (isSelected) {
                    btnStyle = 'bg-[var(--primary-subtle)] border-[var(--primary)] text-[var(--text-main)] font-semibold shadow-xs';
                  }

                  return (
                    <button
                      key={key}
                      onClick={() => !stepFeedback && setSelectedStepOption(key)}
                      disabled={isSubmitted || stepSubmitting}
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

              {/* Step Feedback Explanation Box */}
              {stepFeedback && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={`p-4 rounded-xl border space-y-3 mt-4 text-xs ${
                    stepFeedback.is_correct
                      ? 'bg-[var(--primary-subtle)] border-[var(--primary)]/30'
                      : 'bg-[var(--danger)]/5 border-[var(--danger)]/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">
                        {stepFeedback.is_correct ? 'Correct! Strong understanding demonstrated.' : 'Not quite.'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-mono">
                      {stepFeedback.ability_delta_direction === 'UP' ? (
                        <span className="flex items-center gap-1 text-[#16A34A] dark:text-[#4ADE80] font-bold">
                          <TrendingUp className="w-3.5 h-3.5" /> Ability Climbing
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                          <Activity className="w-3.5 h-3.5" /> Calibrated
                        </span>
                      )}
                    </div>
                  </div>

                  {stepFeedback.explanation && (
                    <div className="space-y-1">
                      <span className="font-bold text-[var(--text-main)] block">Why:</span>
                      <p className="text-[var(--text-secondary)] leading-relaxed">{stepFeedback.explanation}</p>
                    </div>
                  )}

                  {/* Technical Diagnostics Collapsible Drawer */}
                  <div className="pt-2 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => setShowTechnicalDiagnostics(!showTechnicalDiagnostics)}
                      className="text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1 transition-colors"
                    >
                      <Info className="w-3 h-3" />
                      <span>{showTechnicalDiagnostics ? 'Hide Statistical Diagnostics' : 'View Statistical Diagnostics'}</span>
                      {showTechnicalDiagnostics ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {showTechnicalDiagnostics && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-2 p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] font-mono text-[10px] grid grid-cols-2 sm:grid-cols-4 gap-2 text-[var(--text-secondary)]"
                      >
                        <div>
                          <span className="text-[var(--text-muted)] block">&theta; Before:</span>
                          <strong className="text-[var(--text-main)]">{Number(stepFeedback.theta_before).toFixed(3)}</strong>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)] block">&theta; After:</span>
                          <strong className="text-[var(--text-main)]">{Number(stepFeedback.theta_after).toFixed(3)}</strong>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)] block">Item b:</span>
                          <strong className="text-[var(--text-main)]">{Number(adaptiveCurrentQuestion.difficulty_b).toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)] block">SE(&theta;):</span>
                          <strong className="text-[var(--text-main)]">{Number(stepFeedback.standard_error).toFixed(3)}</strong>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Action Buttons */}
              <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={handleResetToConfig}>
                  Exit Assessment
                </Button>

                {!stepFeedback ? (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleSubmitAdaptiveStep}
                    disabled={!selectedStepOption || stepSubmitting}
                  >
                    {stepSubmitting ? 'Evaluating...' : 'Confirm Answer'}
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={handleAdvanceToNextQuestion}
                  >
                    <span>Next Challenge</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}
              </div>
            </Card>
          ) : null}
        </div>
      ) : quizData ? (
        /* ===================================================================== */
        /* 3. STANDARD FIXED-LENGTH QUIZ (LEGACY MODE)                          */
        /* ===================================================================== */
        <div className="space-y-6">
          <div className="glass-panel p-4 bg-[var(--bg-surface)] border-[var(--border)] rounded-2xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--text-main)] font-serif flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#3F6048] dark:text-[#89A88D]" />
                {selectedDocument?.filename || 'Study Document'}
              </span>
              <span className="font-mono text-[var(--text-secondary)]">
                Answered {Object.keys(selectedAnswers).length} of {quizData.length}
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--bg-surface-elevated)] overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#3F6048] to-[#89A88D] transition-all"
                style={{ width: `${(Object.keys(selectedAnswers).length / quizData.length) * 100}%` }}
              />
            </div>
          </div>

          {submitted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-panel p-6 border-[#3F6048]/30 dark:border-[#89A88D]/30 bg-[var(--bg-surface)] rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-[#D6A84F]/15 border border-[#D6A84F]/30 flex items-center justify-center text-[#D6A84F] shrink-0 shadow-sm">
                  <Award className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[var(--text-main)] font-serif">
                    Score: {score} / {quizData.length} ({((score / quizData.length) * 100).toFixed(0)}%)
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {score / quizData.length >= 0.8
                      ? '🌟 Mastery achieved! High retention verified on this material.'
                      : '💡 Review incorrect questions below, then reinforce weak concepts.'}
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
                        {isCorrect ? 'Correct' : 'Incorrect'}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {Object.entries(q.options || {}).map(([key, text]) => {
                      const isSelected = selectedKey === key;
                      const isOptionCorrect = key.toUpperCase() === (q.correct_answer || '').toUpperCase();

                      let btnStyle = 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[#89A88D]/40';

                      if (submitted) {
                        if (isOptionCorrect) {
                          btnStyle = 'bg-[var(--primary-subtle)] border-[var(--primary)] text-[var(--text-main)] font-semibold shadow-xs';
                        } else if (isSelected && !isOptionCorrect) {
                          btnStyle = 'bg-[var(--danger)]/10 border-[var(--danger)]/40 text-[var(--danger)] font-semibold';
                        }
                      } else if (isSelected) {
                        btnStyle = 'bg-[var(--primary-subtle)] border-[var(--primary)] text-[var(--text-main)] font-semibold shadow-xs';
                      }

                      return (
                        <button
                          key={key}
                          onClick={() => handleStandardOptionSelect(qIndex, key)}
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

                  {submitted && q.explanation && (
                    <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] text-xs text-[var(--text-secondary)] space-y-1">
                      <span className="font-bold text-[var(--text-main)] block">Explanation:</span>
                      <p>{q.explanation}</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {!submitted && (
            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" size="sm" onClick={handleResetToConfig}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={submitStandardQuiz}
                disabled={Object.keys(selectedAnswers).length === 0}
              >
                Submit Quiz
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default QuizPage;
