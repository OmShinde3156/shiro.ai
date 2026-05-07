import React, { useContext, useState, useRef, useEffect } from "react";
import { Context } from "../../context/Context";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import API_BASE_URL from "../../api/config.js";
import AddSourceDialog from "../navigation/AddSourceDialog";

const Sidebar = () => {
  const { 
    onSent, 
    prevPrompts = [], 
    setRecentPrompt, 
    setInput, 
    documents, 
    fetchDocuments, 
    setMessages, 
    setShowResults 
  } = useContext(Context);
  
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);

  const loadPrompt = async (prompt) => {
    setRecentPrompt(prompt);
    await onSent(prompt);
  };

  const getNavClass = (path) => {
    const active = location.pathname === path;
    return `group relative flex items-center h-12 rounded-xl transition-all duration-300 mb-1 cursor-pointer
      ${active 
        ? "bg-[#72dcff]/10 text-[#72dcff] font-semibold" 
        : "text-[var(--text-muted)] hover:bg-white/5 hover:text-white"}`;
  };

  const handleHomeClick = () => {
    setShowResults(false);
    setInput("");
    navigate("/home");
  };

  return (
    <aside className="h-screen w-20 hover:w-64 fixed left-0 top-0 z-50 bg-[var(--sidebar-bg)] flex flex-col p-3 border-r border-[var(--border)] shadow-[4px_0_24px_rgba(114,220,255,0.08)] transition-all duration-300 group overflow-hidden">
      {/* Logo Section */}
      <div className="mb-10 cursor-pointer flex items-center px-1" onClick={handleHomeClick}>
        <div className="min-w-[48px] h-12 rounded-xl overflow-hidden bg-[var(--surface-container)] flex items-center justify-center shadow-lg shadow-[#72dcff]/10 flex-shrink-0">
          <img src="/logo.jpg" alt="Shiro.ai Logo" className="w-full h-full object-cover" />
        </div>
        <div className="ml-4 opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap overflow-hidden">
          <h1 className="text-xl font-bold text-[#72dcff] tracking-tight font-headline">Shiro.ai</h1>
          <p className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] mt-1">The Neon Curator</p>
        </div>
      </div>

      <nav className="flex-grow space-y-2 overflow-y-auto overflow-x-hidden pr-2 scrollbar-none group-hover:scrollbar-thin scrollbar-thumb-surface-variant">
        <div onClick={handleHomeClick} className={getNavClass("/home")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">home</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Home</span>
        </div>

        <div onClick={() => navigate("/documents")} className={getNavClass("/documents")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">folder_open</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Library</span>
        </div>

        <div onClick={() => navigate("/study-room")} className={getNavClass("/study-room")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">school</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Study Room</span>
        </div>

        <div onClick={() => navigate("/flashcards")} className={getNavClass("/flashcards")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">style</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Flashcards</span>
        </div>

        <div onClick={() => navigate("/quiz")} className={getNavClass("/quiz")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">quiz</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Quiz</span>
        </div>

        <div onClick={() => navigate("/mindmap")} className={getNavClass("/mindmap")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">hub</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Mind Map</span>
        </div>

        <div onClick={() => navigate("/progress-report")} className={getNavClass("/progress-report")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">analytics</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Stats</span>
        </div>

        <div onClick={() => navigate("/feynman")} className={getNavClass("/feynman")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">record_voice_over</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Feynman Mode</span>
        </div>

        <div onClick={() => navigate("/audio-summary")} className={getNavClass("/audio-summary")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">headphones</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Podcasts</span>
        </div>

        <div onClick={() => navigate("/study-plan")} className={getNavClass("/study-plan")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">calendar_today</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">Study Plan</span>
        </div>

        <div onClick={() => navigate("/pyqs")} className={getNavClass("/pyqs")}>
          <div className="min-w-[48px] flex justify-center items-center">
            <span className="material-symbols-outlined">trending_up</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">PYQS</span>
        </div>

        {/* Recent Prompts Section */}
        <div className="mt-8 pt-6 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-500">
          <p className="px-4 text-[10px] uppercase font-black tracking-widest text-[var(--text-muted)] mb-4">Recent Research</p>
          <div className="space-y-1">
            {prevPrompts.slice(0, 3).map((item, index) => (
              <div 
                key={index}
                onClick={() => loadPrompt(item)}
                className="flex items-center gap-3 px-4 py-2 hover:bg-white/5 rounded-lg cursor-pointer transition-all group/item"
              >
                <span className="material-symbols-outlined text-sm opacity-30 group-hover/item:text-[#72dcff]">history</span>
                <p className="text-xs text-[var(--text-muted)] group-hover/item:text-white truncate">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* Upload & Theme Section */}
      <div className="mt-auto space-y-4 pt-4">
        {/* Upload Trigger */}
        <div 
          onClick={() => setIsAddSourceOpen(true)}
          className="flex items-center gap-4 px-1 py-3 cursor-pointer group/upload"
        >
          <div className="min-w-[48px] h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[var(--text-muted)] group-hover/upload:bg-[#72dcff]/20 group-hover/upload:text-[#72dcff] group-hover/upload:border-[#72dcff]/30 transition-all">
            <span className="material-symbols-outlined">add</span>
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap overflow-hidden">
             <p className="text-sm font-bold text-white">Add Sources</p>
             <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest">FILES, YT, WEB</p>
          </div>
        </div>

        <AddSourceDialog 
          isOpen={isAddSourceOpen} 
          onClose={() => setIsAddSourceOpen(false)} 
          userId={user?.id}
          onUploadSuccess={() => fetchDocuments(user?.id)}
        />

        <div onClick={toggleTheme} className="flex items-center gap-4 px-1 py-3 cursor-pointer group/theme">
          <div className="min-w-[48px] h-12 rounded-xl bg-white/5 flex items-center justify-center text-[var(--text-muted)] group-hover/theme:text-white transition-all">
            <span className="material-symbols-outlined">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
          </div>
          <span className="font-['Inter'] font-medium text-sm tracking-wide opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap capitalize">{theme} Mode</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
