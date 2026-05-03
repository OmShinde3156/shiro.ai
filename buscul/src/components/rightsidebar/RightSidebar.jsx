import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { usePodcasts } from '../../context/PodcastContext';
import { useAuth } from '../../context/AuthContext';
import API_BASE_URL from '../../api/config.js';

const RightSidebar = () => {
  const { savedPodcasts } = usePodcasts();
  const { user } = useAuth();
  const [savedFlashcards, setSavedFlashcards] = useState([]);
  const [savedMindMaps, setSavedMindMaps] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const storedFlashcards = JSON.parse(localStorage.getItem('savedFlashcards')) || [];
    setSavedFlashcards(storedFlashcards);

    if (user?.id) {
      fetchUserMindMaps();
    }

    const handleStorageChange = (e) => {
      if (e.key === 'savedFlashcards') {
        const updatedFlashcards = JSON.parse(localStorage.getItem('savedFlashcards')) || [];
        setSavedFlashcards(updatedFlashcards);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [user]);

  const fetchUserMindMaps = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/mindmaps/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setSavedMindMaps(data.slice(0, 5));
      }
    } catch (error) {
      console.error('Error fetching mind maps:', error);
    }
  };

  return (
    <aside className="hidden lg:flex h-screen w-20 fixed right-0 top-0 z-50 bg-[var(--sidebar-bg)] opacity-60 backdrop-blur-2xl flex-col items-center py-10 gap-8 border-l border-[var(--border)] shadow-[-4px_0_24px_rgba(114,220,255,0.05)]">
      <div className="mb-4">
        <span className="text-[0.6875rem] font-bold text-[#dd8bfb] uppercase tracking-[0.05em] [writing-mode:vertical-lr] rotate-180">
          Learning Tools
        </span>
      </div>

      <div className="flex flex-col gap-8">
        <button onClick={() => navigate('/mindmap')} className="flex flex-col items-center justify-center gap-1 text-[var(--text-muted)] hover:text-[var(--primary)] hover:scale-110 transition-all duration-300" title="Mind Maps">
          <span className="material-symbols-outlined">account_tree</span>
          <span className="font-['Inter'] uppercase text-[10px] tracking-tighter">Mind</span>
        </button>

        <button onClick={() => navigate('/flashcards')} className="flex flex-col items-center justify-center gap-1 text-[var(--text-muted)] hover:text-[var(--primary)] hover:scale-110 transition-all duration-300" title="Flashcards">
          <span className="material-symbols-outlined">style</span>
          <span className="font-['Inter'] uppercase text-[10px] tracking-tighter">Cards</span>
        </button>

        <button onClick={() => navigate('/progress-report')} className="flex flex-col items-center justify-center gap-1 text-[var(--text-muted)] hover:text-[var(--primary)] hover:scale-110 transition-all duration-300" title="Progress Report">
          <span className="material-symbols-outlined">leaderboard</span>
          <span className="font-['Inter'] uppercase text-[10px] tracking-tighter">Stats</span>
        </button>

        <button onClick={() => navigate('/audio-summary')} className="flex flex-col items-center justify-center gap-1 text-[var(--text-muted)] hover:text-[var(--primary)] hover:scale-110 transition-all duration-300" title="Audio Summary">
          <span className="material-symbols-outlined">graphic_eq</span>
          <span className="font-['Inter'] uppercase text-[10px] tracking-tighter">Audio</span>
        </button>
      </div>
    </aside>
  );
};

export default RightSidebar;