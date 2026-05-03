import React, { useState, useEffect, useContext } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, BookOpen, Save, CheckCircle2, BrainCircuit } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Context } from '../../context/Context';
import API_BASE_URL from '../../api/config.js';
import './FlashcardApp.css';

const FlashcardApp = () => {
  const { user } = useAuth();
  const { documents, fetchDocuments } = useContext(Context);
  const location = useLocation();
  const navigate = useNavigate();
  
  const [flashcards, setFlashcards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('generate'); // 'generate' or 'review'
  const [sessionComplete, setSessionComplete] = useState(false);
  
  const [selectedDocId, setSelectedDocId] = useState(location.state?.documentId || "");
  const [numCards, setNumCards] = useState(10);

  useEffect(() => {
    if (user?.id) fetchDocuments(user.id);
  }, [user]);

  // Default select first document if none selected
  useEffect(() => {
    if (documents?.length > 0 && !selectedDocId) {
      const docId = location.state?.documentId || documents[0].id;
      setSelectedDocId(docId);
    }
  }, [documents, selectedDocId, location.state]);

  useEffect(() => {
    if (viewMode === 'review') {
      fetchReviewCards();
    } else {
      // Clear generated cards if switching back to generate mode so user can pick
      setFlashcards([]);
      setCurrentIndex(0);
      setSessionComplete(false);
    }
  }, [viewMode]);

  const fetchGeneratedCards = async () => {
    if (!selectedDocId) {
      setError("Please select a document first.");
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/generate-flashcards`, {
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
      } else {
        setError("Failed to generate flashcards from this document.");
      }
    } catch (err) {
      setError(`Failed to load flashcards: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewCards = async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE_URL}/flashcards/review/${user.id}`);
      const data = await response.json();
      setFlashcards(data || []);
      setCurrentIndex(0);
      setIsFlipped(false);
      setSessionComplete(false);
    } catch (err) {
      setError("Failed to fetch review cards.");
    } finally {
      setLoading(false);
    }
  };

  const handleEaseRating = async (rating) => {
    const currentCard = flashcards[currentIndex];
    if (!user || !currentCard) return;

    try {
      // Record study progress in backend (Spaced Repetition logic)
      await fetch(`${API_BASE_URL}/study-flashcard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          flashcard_id: currentCard.id || currentCard.flashcard_id,
          ease_rating: rating
        })
      });

      // Move to next card or complete session
      if (currentIndex < flashcards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
      } else {
        setSessionComplete(true);
      }
    } catch (err) {
      console.error("Failed to update card progress:", err);
    }
  };

  const saveToLocal = (e) => {
    e.stopPropagation();
    const currentCard = flashcards[currentIndex];
    const saved = JSON.parse(localStorage.getItem('savedFlashcards')) || [];
    if (!saved.some(card => card.id === currentCard.id)) {
      localStorage.setItem('savedFlashcards', JSON.stringify([...saved, currentCard]));
      window.dispatchEvent(new Event('storage'));
    }
  };

  if (loading) {
    return (
      <div className="flashcard-app loading-screen bg-[var(--bg-main)]">
        <div className="loading-content">
          <div className="spinner"></div>
          <p className="text-[var(--text-main)] mt-4 font-bold tracking-widest uppercase text-xs">Calibrating Memory Units...</p>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    return (
      <div className="flashcard-app session-complete bg-[var(--bg-main)]">
        <div className="glass-card p-12 rounded-3xl border border-primary/20 text-center max-w-md">
          <div className="w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center text-primary mx-auto mb-6">
            <CheckCircle2 size={48} />
          </div>
          <h2 className="text-2xl font-bold mb-2">Session Complete!</h2>
          <p className="text-[var(--text-muted)] mb-8">You've strengthened your neural connections for {flashcards.length} concepts.</p>
          <div className="flex flex-col gap-3">
            <button onClick={() => setViewMode('review')} className="py-3 bg-primary text-on-primary font-bold rounded-xl hover:scale-105 transition-all">Review More Due Cards</button>
            <button onClick={() => setViewMode('generate')} className="py-3 bg-white/5 text-[var(--text-main)] font-bold rounded-xl hover:bg-white/10 transition-all">Generate New Set</button>
          </div>
        </div>
      </div>
    );
  }

  // Configuration Screen for 'generate' mode before cards are fetched
  if (viewMode === 'generate' && flashcards.length === 0) {
    return (
      <div className="flashcard-app p-8 max-w-4xl mx-auto min-h-screen">
        <header className="header flex justify-between items-center mb-10">
          <div>
            <h1 className="app-title text-3xl font-bold font-headline text-[var(--text-main)]">Active Recall</h1>
            <p className="text-[var(--text-muted)] text-sm">Generate custom spaced repetition flashcards from your library.</p>
          </div>
          <div className="mode-toggle glass-card p-1 rounded-2xl flex border border-white/5">
            <button 
              onClick={() => setViewMode('generate')} 
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'generate' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
            >
              Learn New
            </button>
            <button 
              onClick={() => setViewMode('review')} 
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'review' ? 'bg-secondary text-on-primary shadow-lg shadow-secondary/20' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
            >
              Review Due
            </button>
          </div>
        </header>

        <div className="glass-card p-8 rounded-3xl border border-white/5 max-w-xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-tertiary/20 flex items-center justify-center text-tertiary">
              <span className="material-symbols-outlined">style</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--text-main)]">Setup Flashcards</h2>
              <p className="text-sm text-[var(--text-muted)]">Select material to extract core concepts.</p>
            </div>
          </div>
          
          <div className="space-y-6">
            <div className="form-group">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2 block">Source Material</label>
              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full bg-surface-container border border-white/10 rounded-xl p-3 text-[var(--text-main)] outline-none focus:border-tertiary/50"
              >
                <option value="">-- Select Document --</option>
                {documents?.map(doc => (
                  <option key={doc.id} value={doc.id}>{doc.filename}</option>
                ))}
              </select>
            </div>
            
            <div className="form-group">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2 block">Number of Cards</label>
              <input
                type="number"
                min="5" max="50"
                value={numCards}
                onChange={(e) => setNumCards(parseInt(e.target.value) || 10)}
                className="w-full bg-surface-container border border-white/10 rounded-xl p-3 text-[var(--text-main)] outline-none focus:border-tertiary/50"
              />
            </div>

            {error && <p className="text-error text-sm">{error}</p>}

            <button
              onClick={fetchGeneratedCards}
              disabled={!selectedDocId || loading}
              className="w-full py-4 bg-tertiary text-[var(--bg-main)] font-bold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 mt-4"
            >
              Extract Knowledge Cards
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error screen for review mode
  if (error || (viewMode === 'review' && flashcards.length === 0)) {
    return (
      <div className="flashcard-app error-screen bg-[var(--bg-main)]">
        <div className="error-content glass-card p-10 border border-white/5 rounded-3xl text-center">
          <BrainCircuit className="mb-4 opacity-20 text-[var(--text-main)] mx-auto" size={64} />
          <h2 className="text-xl font-bold mb-2">{viewMode === 'review' ? 'Inbox Zero!' : 'Oops!'}</h2>
          <p className="mb-8 text-[var(--text-muted)] text-sm">{viewMode === 'review' ? "No cards are currently due for review. Great job!" : error}</p>
          <button onClick={() => setViewMode('generate')} className="generate-button py-3 px-8 bg-primary text-on-primary font-bold rounded-xl">Generate Flashcards</button>
        </div>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];

  return (
    <div className="flashcard-app">
      <div className="app-container max-w-4xl mx-auto pt-8">
        <header className="header flex justify-between items-center mb-10">
          <div>
            <h1 className="app-title text-3xl font-bold font-headline text-[var(--text-main)]">Active Recall</h1>
            <p className="card-counter text-[var(--text-muted)] text-sm">Concept {currentIndex + 1} of {flashcards.length}</p>
          </div>
          
          <div className="mode-toggle glass-card p-1 rounded-2xl flex border border-white/5">
            <button 
              onClick={() => setViewMode('generate')} 
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'generate' ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
            >
              Learn New
            </button>
            <button 
              onClick={() => setViewMode('review')} 
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${viewMode === 'review' ? 'bg-secondary text-on-primary shadow-lg shadow-secondary/20' : 'text-[var(--text-muted)] hover:bg-white/5'}`}
            >
              Review Due
            </button>
          </div>
        </header>

        <div className="flashcard-container mb-12">
          <div className={`flashcard ${isFlipped ? 'is-flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
            <div className="card-face card-front glass-card border-primary/10">
              <span className="type-badge">Question</span>
              <p className="card-text">{currentCard?.question}</p>
              <p className="card-hint">Tap to reveal insight</p>
            </div>

            <div className="card-face card-back glass-card border-secondary/10">
              <span className="type-badge secondary">Insight</span>
              <p className="card-text">{currentCard?.answer}</p>
              <p className="card-hint">How easy was this to recall?</p>
            </div>
          </div>
        </div>

        {/* Navigation Controls - Skip/Revisit */}
        <div className="navigation-controls flex justify-between items-center w-full max-w-md mx-auto mt-4 px-4">
          <button 
            onClick={(e) => { e.stopPropagation(); if(currentIndex > 0) setCurrentIndex(currentIndex - 1); setIsFlipped(false); }}
            disabled={currentIndex === 0}
            className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all disabled:opacity-20 text-[var(--text-main)]"
            title="Previous Card"
          >
            <ChevronLeft size={24} />
          </button>

          <button onClick={saveToLocal} className="control-button flex items-center gap-2 px-6 py-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all text-xs font-bold text-[var(--text-main)]">
            <Save size={16} /> Cache for Later
          </button>

          <button 
            onClick={(e) => { e.stopPropagation(); if(currentIndex < flashcards.length - 1) setCurrentIndex(currentIndex + 1); else setSessionComplete(true); setIsFlipped(false); }}
            className="p-3 bg-white/5 rounded-full hover:bg-white/10 transition-all text-[var(--text-main)]"
            title="Next Card (Skip)"
          >
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Rating Controls - Only show when flipped */}
        <div className={`ease-controls flex gap-3 mt-8 transition-all duration-500 ${isFlipped ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <button onClick={(e) => { e.stopPropagation(); handleEaseRating(1); }} className="ease-btn again">
            <span className="label">Again</span>
            <span className="time">&lt;1m</span>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleEaseRating(2); }} className="ease-btn hard">
            <span className="label">Hard</span>
            <span className="time">1d</span>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleEaseRating(3); }} className="ease-btn fair">
            <span className="label">Fair</span>
            <span className="time">3d</span>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleEaseRating(4); }} className="ease-btn good">
            <span className="label">Good</span>
            <span className="time">5d</span>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleEaseRating(5); }} className="ease-btn easy">
            <span className="label">Easy</span>
            <span className="time">7d</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlashcardApp;
