import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, BookOpen, Save } from 'lucide-react';
import API_BASE_URL from '../../api/config.js';
import './FlashcardApp.css';

const FlashcardApp = () => {
  const [flashcards, setFlashcards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [apiParams, setApiParams] = useState({
    document_id: 1,
    num_cards: 10
  });

  const fetchFlashcards = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE_URL}/generate-flashcards`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiParams)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load flashcards: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.flashcards && Array.isArray(data.flashcards)) {
        setFlashcards(data.flashcards);
        setCurrentIndex(0);
        setIsFlipped(false);
      } else {
        throw new Error('Invalid response format');
      }
      
    } catch (err) {
      setError(`Failed to load flashcards. Please try again later.`);
      console.error('Error fetching flashcards:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlashcards();
  }, []);

  const handleFlip = () => setIsFlipped(!isFlipped);
  
  const nextCard = (e) => {
    e.stopPropagation();
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    }
  };

  const prevCard = (e) => {
    e.stopPropagation();
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setIsFlipped(false);
    }
  };

  const saveCard = (e) => {
    e.stopPropagation();
    const currentCard = flashcards[currentIndex];
    if (!currentCard) return;

    const saved = JSON.parse(localStorage.getItem('savedFlashcards')) || [];
    if (saved.some(card => card.id === currentCard.id)) return;

    localStorage.setItem('savedFlashcards', JSON.stringify([...saved, currentCard]));
    window.dispatchEvent(new Event('storage'));
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 1: return 'difficulty-easy';
      case 2: return 'difficulty-medium';
      case 3: return 'difficulty-hard';
      default: return 'difficulty-new';
    }
  };

  const getDifficultyLabel = (difficulty) => {
    switch (difficulty) {
      case 1: return 'Easy';
      case 2: return 'Medium';
      case 3: return 'Hard';
      default: return 'New';
    }
  };

  if (loading) {
    return (
      <div className="flashcard-app loading-screen bg-[var(--bg-main)]">
        <div className="loading-content border-[var(--border)]">
          <div className="spinner border-t-[var(--primary)]"></div>
          <p className="text-[var(--text-main)]">Analyzing material...</p>
        </div>
      </div>
    );
  }

  if (error || flashcards.length === 0) {
    return (
      <div className="flashcard-app error-screen bg-[var(--bg-main)]">
        <div className="error-content border-[var(--border)]">
          <BookOpen className="mb-4 opacity-20 text-[var(--text-main)]" size={48} />
          <p className="mb-6 text-[var(--text-main)]">{error || "No flashcards found."}</p>
          <button onClick={fetchFlashcards} className="generate-button">Retry Analysis</button>
        </div>
      </div>
    );
  }

  const currentCard = flashcards[currentIndex];

  return (
    <div className="flashcard-app">
      <div className="app-container">
        <header className="header">
          <h1 className="app-title">Flashcard Study</h1>
          <p className="card-counter">Knowledge Unit {currentIndex + 1} of {flashcards.length}</p>
          
          <div className="api-controls">
            <div className="control-group">
              <label className="control-label">Doc ID</label>
              <input
                type="number"
                value={apiParams.document_id}
                onChange={(e) => setApiParams({...apiParams, document_id: parseInt(e.target.value) || 1})}
                className="control-input"
              />
            </div>
            <div className="control-group">
              <label className="control-label">Count</label>
              <input
                type="number"
                value={apiParams.num_cards}
                onChange={(e) => setApiParams({...apiParams, num_cards: parseInt(e.target.value) || 10})}
                className="control-input"
              />
            </div>
            <button onClick={fetchFlashcards} className="generate-button">Regenerate</button>
          </div>
        </header>

        <div className="flashcard-container">
          <div className={`flashcard ${isFlipped ? 'is-flipped' : ''}`} onClick={handleFlip}>
            <div className="card-face card-front">
              <span className={`difficulty-badge ${getDifficultyColor(currentCard.difficulty)}`}>
                {getDifficultyLabel(currentCard.difficulty)}
              </span>
              <h3 className="card-title">Inquiry</h3>
              <p className="card-text">{currentCard.question}</p>
              <p className="card-hint">Tap to reveal insight</p>
            </div>

            <div className="card-face card-back">
              <h3 className="card-title">Insight</h3>
              <p className="card-text">{currentCard.answer}</p>
              <p className="card-hint">Tap to return to inquiry</p>
            </div>
          </div>
        </div>

        <div className="controls">
          <button 
            onClick={prevCard} 
            disabled={currentIndex === 0}
            className={`control-button ${currentIndex === 0 ? 'disabled' : ''}`}
          >
            <ChevronLeft size={20} /> Prev
          </button>
          
          <button onClick={saveCard} className="control-button save-button">
            <Save size={18} /> Cache Card
          </button>

          <button 
            onClick={nextCard} 
            disabled={currentIndex === flashcards.length - 1}
            className={`control-button next-button ${currentIndex === flashcards.length - 1 ? 'disabled' : ''}`}
          >
            Next <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlashcardApp;
