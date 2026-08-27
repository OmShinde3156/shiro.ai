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
  Sparkles
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
  const [selectedDocId, setSelectedDocId] = useState(initialDocId);
  const [quizData, setQuizData] = useState(null);
  const [quizId, setQuizId] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (user?.id) fetchDocuments(user.id);
  }, [user]);

  useEffect(() => {
    if (documents?.length > 0 && !selectedDocId) {
      setSelectedDocId(location.state?.documentId || documents[0].id);
    }
  }, [documents, selectedDocId, location.state]);

  const fetchQuiz = async () => {
    if (!selectedDocId) {
      toast.error('Please select a document first.');
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
          num_questions: 5,
          difficulty: 'medium',
        }),
      });

      if (!response.ok) throw new Error('Failed to generate quiz');

      const data = await response.json();
      setQuizData(data.questions);
      setQuizId(data.quiz_id);
    } catch (error) {
      console.error(error);
      toast.error('Failed to generate quiz');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDocId) {
      fetchQuiz();
    }
  }, [selectedDocId]);

  const handleOptionSelect = (questionIndex, optionKey) => {
    if (submitted) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionKey,
    }));
  };

  const submitQuiz = async () => {
    if (!quizData) return;
    let calculatedScore = 0;
    const formattedAnswers = {};

    quizData.forEach((q, idx) => {
      formattedAnswers[q.id] = selectedAnswers[idx] || '';
      if (selectedAnswers[idx] === q.correct_answer) {
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
          user_id: user.id,
          document_id: parseInt(selectedDocId),
          quiz_id: quizId,
          answers: formattedAnswers,
        }),
      });
      toast.success('Quiz submitted! Progress saved.');
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3F6048] dark:text-[#89A88D] mb-1 font-mono uppercase tracking-wider">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>ACTIVE RECALL TESTING</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-main)] tracking-tight font-serif">
            Quiz Arena
          </h1>
        </div>

        {/* Document Selector */}
        {documents?.length > 0 && (
          <div className="flex items-center gap-2 glass-panel p-2 bg-[var(--bg-surface)] border-[var(--border)]">
            <BookOpen className="w-4 h-4 text-[#3F6048] dark:text-[#89A88D] shrink-0" />
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="bg-transparent border-0 text-xs md:text-sm text-[var(--text-main)] focus:outline-none font-medium cursor-pointer"
            >
              {documents.map(d => (
                <option key={d.id} value={d.id} className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                  {d.filename}
                </option>
              ))}
            </select>
            <Button variant="ghost" size="sm" onClick={fetchQuiz} disabled={loading}>
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
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
              <strong>Chat Context Bridge:</strong> Focused on <em>"{handoff.topic}"</em>
            </span>
          </div>
          <Badge variant="sage" size="sm">
            {handoff.difficulty || "medium"}
          </Badge>
        </motion.div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="py-20 text-center space-y-3 glass-panel bg-[var(--bg-surface)] border-[var(--border)]">
          <div className="w-8 h-8 border-2 border-[#3F6048] dark:border-[#89A88D] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-[var(--text-main)]">
            Synthesizing grounded quiz questions with QualityGate validation...
          </p>
        </div>
      ) : quizData ? (
        <div className="space-y-6">
          {/* Result Score Banner when Submitted */}
          {submitted && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-6 border-[#3F6048]/30 dark:border-[#89A88D]/30 bg-[var(--bg-surface)] flex items-center justify-between shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#D6A84F]/15 border border-[#D6A84F]/30 flex items-center justify-center text-[#D6A84F] shadow-sm">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-main)] font-serif">
                    Score: {score} / {quizData.length} ({(score / quizData.length * 100).toFixed(0)}%)
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {score / quizData.length >= 0.8
                      ? "Mastery achieved! Great job."
                      : "Review your weak concepts using Flashcards or Feynman mode."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => navigate('/flashcards')}>
                  <Layers className="w-3.5 h-3.5" />
                  Flashcards
                </Button>
                <Button variant="primary" size="sm" onClick={fetchQuiz}>
                  <RotateCw className="w-3.5 h-3.5" />
                  New Quiz
                </Button>
              </div>
            </motion.div>
          )}

          {/* Question List */}
          <div className="space-y-5">
            {quizData.map((q, qIndex) => {
              const selectedKey = selectedAnswers[qIndex];
              const isCorrect = selectedKey === q.correct_answer;

              return (
                <Card key={q.id || qIndex} className="p-6 space-y-4 bg-[var(--bg-surface)] border-[var(--border)]">
                  {/* Question Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-lg bg-[#89A88D]/15 border border-[#89A88D]/30 text-xs font-mono font-bold text-[#89A88D] flex items-center justify-center shrink-0">
                        {qIndex + 1}
                      </span>
                      <h3 className="font-semibold text-[var(--text-main)] text-sm md:text-base leading-relaxed font-serif">
                        {q.question}
                      </h3>
                    </div>

                    {submitted && (
                      <Badge variant={isCorrect ? 'sage' : 'rose'} size="sm">
                        {isCorrect ? 'Correct' : 'Incorrect'}
                      </Badge>
                    )}
                  </div>

                  {/* Options Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {Object.entries(q.options || {}).map(([key, text]) => {
                      const isSelected = selectedKey === key;
                      const isOptionCorrect = key === q.correct_answer;

                      let btnStyle = 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[#89A88D]/40';

                      if (submitted) {
                        if (isOptionCorrect) {
                          btnStyle = 'bg-[#89A88D]/20 border-[#89A88D] text-[var(--text-main)] font-semibold';
                        } else if (isSelected && !isOptionCorrect) {
                          btnStyle = 'bg-[#C96B62]/15 border-[#C96B62]/40 text-[#C96B62]';
                        }
                      } else if (isSelected) {
                        btnStyle = 'bg-[#89A88D]/15 border-[#89A88D] text-[var(--text-main)] font-semibold shadow-sm';
                      }

                      return (
                        <button
                          key={key}
                          onClick={() => handleOptionSelect(qIndex, key)}
                          disabled={submitted}
                          className={`p-3 rounded-xl border text-left text-xs md:text-sm flex items-start gap-2.5 transition-all ${btnStyle}`}
                        >
                          <span className="font-mono font-bold text-xs uppercase px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] shrink-0">
                            {key}
                          </span>
                          <span className="leading-snug">{text}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation reveal upon submission */}
                  {submitted && q.explanation && (
                    <div className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-1">
                      <span className="font-semibold text-[#89A88D]">Explanation:</span>
                      <p className="text-[var(--text-main)]">{q.explanation}</p>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Submit Button Bar */}
          {!submitted && (
            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="lg"
                onClick={submitQuiz}
                disabled={Object.keys(selectedAnswers).length === 0}
              >
                Submit Answers ({Object.keys(selectedAnswers).length} / {quizData.length})
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="py-16 text-center space-y-3 glass-panel bg-[var(--bg-surface)] border-[var(--border)]">
          <HelpCircle className="w-10 h-10 text-[#3F6048] dark:text-[#89A88D] mx-auto opacity-40" />
          <h3 className="text-sm font-bold text-[var(--text-main)] font-serif">No quiz questions generated</h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
            Select a document to create an interactive MCQ quiz.
          </p>
        </div>
      )}
    </div>
  );
};

export default QuizPage;
