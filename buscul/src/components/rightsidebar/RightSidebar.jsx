import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Context } from '../../context/Context';
import API_BASE_URL from '../../api/config.js';

const RightSidebar = () => {
  const { user } = useAuth();
  const { documents } = useContext(Context);
  const navigate = useNavigate();
  const location = useLocation();
  
  const [activeNudge, setActiveNudge] = useState(null);
  const [sessionStats, setSessionStats] = useState({
    sessionXp: 0,
    activeTime: "00:00"
  });

  // Dynamic Contextual Intelligence (Nudges)
  useEffect(() => {
    const path = location.pathname;
    
    if (path === '/home') {
      setActiveNudge({
        icon: 'rocket_launch',
        title: 'Launch Study',
        desc: 'Ready to dive in? Open the Study Room to start a focused session.',
        action: () => navigate('/study-room')
      });
    } else if (path.includes('/documents')) {
      setActiveNudge({
        icon: 'psychology',
        title: 'Concept Link',
        desc: 'Extracting triplets from this document. Try a Feynman Challenge next.',
        action: () => navigate('/feynman')
      });
    } else if (path === '/quiz') {
      setActiveNudge({
        icon: 'trending_up',
        title: 'Mastery Boost',
        desc: 'Finish this quiz to gain +50 XP and unlock new insights.',
        action: null
      });
    } else if (path === '/flashcards') {
      setActiveNudge({
        icon: 'style',
        title: 'Active Recall',
        desc: 'Spaced repetition is active. Master these cards to build long-term memory.',
        action: null
      });
    } else if (path === '/study-plan') {
      setActiveNudge({
        icon: 'calendar_today',
        title: 'Cognitive Path',
        desc: 'I have optimized your schedule based on your recent accuracy scores.',
        action: null
      });
    } else if (path === '/progress-report') {
      setActiveNudge({
        icon: 'analytics',
        title: 'Data Insight',
        desc: 'Your mastery radar shows a gap in core concepts. Try more quizzes today.',
        action: () => navigate('/quiz')
      });
    } else if (path === '/feynman') {
      setActiveNudge({
        icon: 'record_voice_over',
        title: 'Socratic mode',
        desc: 'Explain it like I am five. I will detect jargon and logic gaps in real-time.',
        action: null
      });
    } else {
      setActiveNudge({
        icon: 'auto_awesome',
        title: 'Shiro Intelligence',
        desc: 'I am monitoring your progress. Stay focused, Learner.',
        action: null
      });
    }
  }, [location.pathname]);

  return (
    <aside className="hidden lg:flex h-screen w-20 hover:w-64 fixed right-0 top-0 z-50 bg-[var(--sidebar-bg)] border-l border-[var(--border)] shadow-[-4px_0_24px_rgba(0,0,0,0.3)] transition-all duration-300 group overflow-hidden flex-col">
      {/* Dynamic Intelligence Header */}
      <div className="py-8 px-4 flex flex-col items-center">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-2 shadow-[0_0_15px_rgba(114,220,255,0.1)]">
          <span className="material-symbols-outlined animate-pulse">monitoring</span>
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-center whitespace-nowrap">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Context Hub</p>
          <p className="text-[9px] text-[var(--text-muted)]">Live Intelligence</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-6 px-3">
        {/* Real-time Stats Card */}
        <div className="p-1 rounded-2xl bg-white/5 border border-white/5 group-hover:p-4 transition-all overflow-hidden min-h-[48px]">
          <div className="flex items-center gap-4">
             <div className="min-w-[40px] h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-lg">bolt</span>
             </div>
             <div className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Session XP</p>
                <p className="text-sm font-black text-white">+{user?.xp % 100 || 0} pts</p>
             </div>
          </div>
        </div>

        {/* Active Document Context */}
        <div className="p-1 rounded-2xl bg-white/5 border border-white/5 group-hover:p-4 transition-all overflow-hidden min-h-[48px]">
          <div className="flex items-center gap-4">
             <div className="min-w-[40px] h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <span className="material-symbols-outlined text-lg">description</span>
             </div>
             <div className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Active Library</p>
                <p className="text-sm font-black text-white">{documents?.length || 0} Assets</p>
             </div>
          </div>
        </div>

        {/* Shiro's Nudge - The "Improvement" */}
        {activeNudge && (
          <div 
            onClick={activeNudge.action}
            className={`mt-10 p-1 rounded-3xl border transition-all cursor-pointer group-hover:p-6 overflow-hidden
              ${activeNudge.action ? 'border-primary/30 bg-primary/5 hover:bg-primary/10' : 'border-white/5 bg-white/5 opacity-40'}`}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <div className={`min-w-[40px] h-10 rounded-xl flex items-center justify-center ${activeNudge.action ? 'bg-primary/20 text-primary' : 'bg-white/10 text-white'}`}>
                  <span className="material-symbols-outlined text-lg">{activeNudge.icon}</span>
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  <p className="text-xs font-black text-white tracking-tight">{activeNudge.title}</p>
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed mb-4">{activeNudge.desc}</p>
                {activeNudge.action && (
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary">
                    Initiate Action <span className="material-symbols-outlined text-xs">arrow_forward</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="mt-auto py-8 px-4 flex flex-col items-center border-t border-white/5 bg-black/20">
         <span className="text-[9px] font-bold text-white/20 uppercase tracking-[0.3em] [writing-mode:vertical-lr] rotate-180 group-hover:rotate-0 group-hover:[writing-mode:horizontal-tb] transition-all">
           Shiro v4.9
         </span>
      </div>
    </aside>
  );
};

export default RightSidebar;