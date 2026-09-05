import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Context } from '../../../context/Context';
import API_BASE_URL from '../../../api/config.js';
import { fetchWithAuth } from '../../../api/fetchWithAuth';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Layers, 
  RotateCw, 
  Sparkles, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  BookOpen, 
  BrainCircuit, 
  Flame,
  Award,
  ArrowRight
} from 'lucide-react';

import Card from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';

export const FlashcardApp = () => {
  const { user } = useAuth();
  const { documents, fetchDocuments, activeHandoffContext, fetchUserStats } = useContext(Context);
  const location = useLocation();
  const navigate = useNavigate();
  
  const handoff = location.state?.handoff || activeHandoffContext;
  const initialDocId = location.state?.documentId || handoff?.document_ids?.[0] || '';
  const [flashcards, setFlashcards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState('generate'); // 'generate' | 'review'
  const [sessionComplete, setSessionComplete] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState(initialDocId);
  const [numCards, setNumCards] = useState(10);
  const [scoreStats, setScoreStats] = useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const autoStartedRef = React.useRef(false);

  useEffect(() => {
    if (user?.id) fetchDocuments(user.id);
  }, [user]);

  useEffect(() => {
    if (documents?.length > 0 && !selectedDocId) {
      setSelectedDocId(location.state?.documentId || documents[0].id);
    }
  }, [documents, selectedDocId, location.state]);

  // Seamless Handoff Auto-Start
  useEffect(() => {
    if (location.state?.autoStart && selectedDocId && !autoStartedRef.current && !loading && flashcards.length === 0) {
      autoStartedRef.current = true;
      fetchGeneratedCards();
    }
  }, [selectedDocId, location.state]);

  const fetchGeneratedCards = async () => {
    if (!selectedDocId) {
      toast.error("Please select a document");
      return;
    }
    
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/generate-flashcards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          document_id: parseInt(selectedDocId),
          num_cards: numCards
        })
      });
      
      const data = await response.json();
      if (data.flashcards && data.flashcards.length > 0) {
        setFlashcards(data.flashcards);
        setCurrentIndex(0);
        setIsFlipped(false);
        setSessionComplete(false);
        setScoreStats({ again: 0, hard: 0, good: 0, easy: 0 });
      } else {
        toast.error("No flashcards could be generated from this document.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate cards");
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewCards = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/flashcards/review`);
      const data = await response.json();
      setFlashcards(data || []);
      setCurrentIndex(0);
      setIsFlipped(false);
      setSessionComplete(false);
      setScoreStats({ again: 0, hard: 0, good: 0, easy: 0 });
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch due review cards");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'review') {
      fetchReviewCards();
    } else if (selectedDocId) {
      fetchGeneratedCards();
    }
  }, [viewMode]);

  // SM-2 Review rating submission
  const handleRating = async (rating) => {
    setScoreStats(prev => ({
      ...prev,
      [rating === 1 ? 'again' : rating === 2 ? 'hard' : rating === 3 ? 'good' : 'easy']: 
        prev[rating === 1 ? 'again' : rating === 2 ? 'hard' : rating === 3 ? 'good' : 'easy'] + 1
    }));

    const currentCard = flashcards[currentIndex];
    if (currentCard?.id && user?.id) {
      try {
        await fetchWithAuth(`${API_BASE_URL}/flashcards/review`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            flashcard_id: currentCard.id,
            rating: rating,
            ease_rating: rating
          })
        });
        if (user?.id && fetchUserStats) {
          fetchUserStats(user.id);
        }
      } catch (e) {
        console.error("Failed to record review", e);
      }
    }

    if (currentIndex < flashcards.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(prev => prev + 1), 150);
    } else {
      setSessionComplete(true);
    }
  };

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (sessionComplete || flashcards.length === 0) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (isFlipped) {
        if (e.key === '1') handleRating(1);
        if (e.key === '2') handleRating(2);
        if (e.key === '3') handleRating(3);
        if (e.key === '4') handleRating(4);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, currentIndex, flashcards, sessionComplete]);

  const currentCard = flashcards[currentIndex];
  const progressPercent = flashcards.length > 0 ? ((currentIndex + 1) / flashcards.length) * 100 : 0;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#3F6048] dark:text-[#89A88D] mb-1 font-mono uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5" />
            <span>SPACED REPETITION (SM-2)</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-main)] tracking-tight font-serif">
            Flashcard Mastery
          </h1>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center rounded-xl bg-[var(--bg-surface-elevated)] p-1 border border-[var(--border)] self-start">
          <button
            onClick={() => setViewMode('generate')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'generate'
                ? 'bg-[#E8EFE9] dark:bg-[#89A88D]/20 text-[#3F6048] dark:text-[#A8C5AC] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
            }`}
          >
            Generate from Doc
          </button>
          <button
            onClick={() => setViewMode('review')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'review'
                ? 'bg-[#3F6048] text-white dark:bg-[#89A88D] dark:text-black shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
            }`}
          >
            Due Today
          </button>
        </div>
      </div>

      {/* Document Picker when in Generate Mode */}
      {viewMode === 'generate' && documents?.length > 0 && (
        <div className="flex items-center gap-3 glass-panel p-3 bg-[var(--bg-surface)] border-[var(--border)]">
          <BookOpen className="w-4 h-4 text-[#3F6048] dark:text-[#89A88D] shrink-0" />
          <select
            value={selectedDocId}
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="bg-transparent border-0 text-xs md:text-sm text-[var(--text-main)] focus:outline-none flex-1 font-medium cursor-pointer"
          >
            {documents.map(d => (
              <option key={d.id} value={d.id} className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                {d.filename}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" onClick={fetchGeneratedCards} disabled={loading}>
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        </div>
      )}

      {/* Chat Context Handoff Notification */}
      {handoff?.topic && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3.5 rounded-2xl bg-[#89A88D]/15 border border-[#89A88D]/30 flex items-center justify-between text-xs text-[var(--text-main)] shadow-sm"
        >
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-[#89A88D] shrink-0" />
            <span>
              <strong>Chat Context Bridge:</strong> Focused on <em>"{handoff.topic}"</em>
            </span>
          </div>
          <Badge variant="sage" size="sm">
            {handoff.mode || "human_tutor"}
          </Badge>
        </motion.div>
      )}

      {/* FLASHCARD INTERACTION VIEW */}
      {loading ? (
        <div className="py-20 text-center space-y-3 glass-panel bg-[var(--bg-surface)] border-[var(--border)]">
          <div className="w-8 h-8 border-2 border-[#3F6048] dark:border-[#89A88D] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-[var(--text-main)]">Synthesizing flashcards with SM-2 Spaced Repetition...</p>
        </div>
      ) : sessionComplete ? (
        /* Session Summary Card */
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-panel p-8 text-center space-y-6 bg-[var(--bg-surface)] border-[var(--border)]"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#D6A84F]/15 border border-[#D6A84F]/30 text-[#D6A84F] flex items-center justify-center mx-auto shadow-sm">
            <Award className="w-8 h-8" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-[var(--text-main)] font-serif">Session Completed!</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1">
              You reviewed {flashcards.length} flashcards today. Spaced intervals have been updated!
            </p>
          </div>

          <div className="grid grid-cols-4 gap-3 max-w-md mx-auto text-xs">
            <div className="p-3 rounded-xl bg-[#F7E8E5] dark:bg-[#C96B62]/15 border border-[#C96B62]/30 text-[#9E352B] dark:text-[#E58B82]">
              <span className="block text-[10px] uppercase font-semibold">Again</span>
              <span className="text-lg font-bold">{scoreStats.again}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#F4E9CC] dark:bg-[#D6A84F]/15 border border-[#E9D8AE] dark:border-[#D6A84F]/30 text-[#7B5E20] dark:text-[#E8C278]">
              <span className="block text-[10px] uppercase font-semibold">Hard</span>
              <span className="text-lg font-bold">{scoreStats.hard}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#E8EFE9] dark:bg-[#89A88D]/15 border border-[#3F6048]/20 dark:border-[#89A88D]/30 text-[#3F6048] dark:text-[#A8C5AC]">
              <span className="block text-[10px] uppercase font-semibold">Good</span>
              <span className="text-lg font-bold">{scoreStats.good}</span>
            </div>
            <div className="p-3 rounded-xl bg-[#3F6048]/15 dark:bg-[#62816A]/20 border border-[#3F6048]/30 dark:border-[#62816A]/30 text-[#2D4534] dark:text-[#88A690]">
              <span className="block text-[10px] uppercase font-semibold">Easy</span>
              <span className="text-lg font-bold">{scoreStats.easy}</span>
            </div>
          </div>

          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" size="md" onClick={() => { setCurrentIndex(0); setSessionComplete(false); }}>
              Review Again
            </Button>
            <Button variant="primary" size="md" onClick={() => navigate('/home')}>
              Back to Dashboard
            </Button>
          </div>
        </motion.div>
      ) : flashcards.length > 0 ? (
        <div className="space-y-4">
          {/* Progress Indicator */}
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <span className="font-medium">Card {currentIndex + 1} of {flashcards.length}</span>
            <div className="flex items-center gap-2">
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[10px] font-mono text-[var(--text-muted)]">Space</kbd>
              <span>to flip</span>
            </div>
          </div>
          <div className="w-full bg-[var(--bg-surface-elevated)] h-2 rounded-full overflow-hidden border border-[var(--border)]">
            <motion.div 
              className="bg-[#D6A84F] h-full rounded-full"
              style={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>

          {/* 3D Flip Card Container */}
          <div 
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full min-h-[260px] sm:min-h-[320px] rounded-3xl cursor-pointer select-none perspective-1000 active:scale-[0.99] transition-transform"
          >
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformStyle: 'preserve-3d' }}
              className="relative w-full min-h-[260px] sm:min-h-[320px] rounded-3xl p-5 sm:p-8 flex flex-col justify-between glass-panel border-[var(--border)] shadow-md hover:border-[#3F6048]/40 dark:hover:border-[#89A88D]/40 transition-colors bg-[var(--bg-surface)]"
            >
              {/* Card Front */}
              <div 
                style={{ backfaceVisibility: 'hidden' }}
                className={`absolute inset-0 p-5 sm:p-8 flex flex-col justify-between ${isFlipped ? 'pointer-events-none' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <Badge variant="sage" size="sm">Question / Prompt</Badge>
                  <span className="text-xs text-[var(--text-muted)] font-mono">Tap to reveal</span>
                </div>
                <div className="my-auto text-center py-2">
                  <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-[var(--text-main)] leading-relaxed font-serif">
                    {currentCard?.question || currentCard?.front || "What is this concept?"}
                  </h3>
                </div>
                <div className="text-center text-xs text-[var(--text-muted)]">
                  Click, tap, or press <kbd className="px-1.5 py-0.5 border border-[var(--border)] rounded bg-[var(--bg-canvas)] shadow-xs font-mono text-[10px]">Space</kbd> to see answer
                </div>
              </div>

              {/* Card Back */}
              <div 
                style={{ 
                  backfaceVisibility: 'hidden',
                  transform: 'rotateY(180deg)'
                }}
                className={`absolute inset-0 p-5 sm:p-8 flex flex-col justify-between bg-[var(--bg-surface-elevated)] rounded-3xl ${!isFlipped ? 'pointer-events-none' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <Badge variant="gold" size="sm">Answer & Explanation</Badge>
                  {currentCard?.category && <span className="text-xs text-[var(--text-muted)] font-mono">{currentCard.category}</span>}
                </div>
                <div className="my-auto text-center py-2 overflow-y-auto max-h-[160px] custom-scroll">
                  <p className="text-base sm:text-lg md:text-xl font-medium text-[var(--text-main)] leading-relaxed">
                    {currentCard?.answer || currentCard?.back || "Explanation text."}
                  </p>
                </div>
                <div className="text-center text-xs text-[var(--text-muted)]">
                  Rate your recall difficulty below
                </div>
              </div>
            </motion.div>
          </div>

          {/* SM-2 Rating Buttons (Shown when flipped) */}
          <AnimatePresence>
            {isFlipped && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-2"
              >
                <button
                  onClick={() => handleRating(1)}
                  className="p-2.5 sm:p-3 rounded-2xl border border-[var(--danger-subtle)] bg-[var(--bg-canvas)] text-[var(--danger)] hover:bg-[var(--danger-subtle)] hover:scale-[1.01] active:scale-95 transition-all text-center"
                >
                  <span className="font-bold text-xs sm:text-sm block">Again (1)</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Forgot / Blackout</span>
                </button>

                <button
                  onClick={() => handleRating(2)}
                  className="p-2.5 sm:p-3 rounded-2xl border border-[var(--warning-subtle)] bg-[var(--bg-canvas)] text-[var(--warning)] hover:bg-[var(--warning-subtle)] hover:scale-[1.01] active:scale-95 transition-all text-center"
                >
                  <span className="font-bold text-xs sm:text-sm block">Hard (2)</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Struggled</span>
                </button>

                <button
                  onClick={() => handleRating(3)}
                  className="p-2.5 sm:p-3 rounded-2xl border border-[var(--success-subtle)] bg-[var(--bg-canvas)] text-[var(--success)] hover:bg-[var(--success-subtle)] hover:scale-[1.01] active:scale-95 transition-all text-center"
                >
                  <span className="font-bold text-xs sm:text-sm block">Good (3)</span>
                  <span className="text-[10px] text-[var(--text-muted)]">Recalled cleanly</span>
                </button>

                <button
                  onClick={() => handleRating(4)}
                  className="p-2.5 sm:p-3 rounded-2xl border border-[var(--primary)] bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--bg-canvas)] font-semibold hover:scale-[1.01] active:scale-95 transition-all text-center shadow-sm"
                >
                  <span className="font-bold text-xs sm:text-sm block">Easy (4)</span>
                  <span className="text-[10px] opacity-90">Instant recall</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ) : (
        <div className="py-16 text-center space-y-3 glass-panel bg-[var(--bg-surface)] border-[var(--border)]">
          <Layers className="w-10 h-10 text-[#3F6048] dark:text-[#89A88D] mx-auto opacity-40" />
          <h3 className="text-sm font-bold text-[var(--text-main)] font-serif">No cards due for review</h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">
            You're all caught up on your spaced repetition queue! Switch to "Generate from Doc" to create new study decks.
          </p>
        </div>
      )}
    </div>
  );
};

export default FlashcardApp;
