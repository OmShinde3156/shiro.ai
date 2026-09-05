import React, { useContext, useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Context } from "../../context/Context";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import API_BASE_URL from "../../api/config.js";
import { fetchWithAuth } from "../../api/fetchWithAuth";
import toast from 'react-hot-toast';
import { 
  Search, 
  Flame, 
  Globe, 
  User as UserIcon, 
  LogOut, 
  Sparkles, 
  Award, 
  BarChart3,
  Command,
  Sun,
  Moon,
  TrendingUp,
  BookOpen,
  Headphones
} from "lucide-react";
import Badge from "../ui/Badge";

export const Header = () => {
  const { language, setLanguage, studyStats, fetchUserStats, t } = useContext(Context);
  const { theme, toggleTheme } = useTheme();
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const menuRef = useRef(null);

  const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/bottts/svg?seed=${seed || "Guest"}&backgroundColor=0b0e14,72dcff,dd8bfb`;

  useEffect(() => {
    if (user?.id) {
      fetchUserStats(user.id);
    }
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

  const getRouteTitle = () => {
    const path = location.pathname;
    if (path === "/home") return t("commandCenter", "Command Center");
    if (path === "/progress-report") return t("progressReport", "Decision Center");
    if (path === "/documents") return t("library", "Document Library");
    if (path.startsWith("/documents/")) return t("library", "Document Workstation");
    if (path === "/study-rooms" || path.startsWith("/room/")) return t("studyRoom", "Study Rooms");
    if (path === "/flashcards") return t("flashcards", "Spaced Repetition");
    if (path === "/quiz") return t("quiz", "Quiz Arena");
    if (path === "/feynman") return t("feynman", "Feynman Challenge");
    if (path === "/mindmap") return t("mindmap", "Knowledge Map");
    if (path === "/audio-summary") return t("audioSummary", "Audio Lab");
    if (path === "/answer-planner") return t("examBlueprint", "Answer Planner");
    if (path === "/study-plan") return t("studyPlan", "Study Timetable");
    if (path === "/pyqs") return t("pyqs", "Exam PYQs");
    if (path === "/summary") return t("summary", "Document Summary");
    if (path === "/settings") return t("settings", "Settings");
    return t("learningHub", "Learning Hub");
  };

  const popularLanguages = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'hi', label: 'हिंदी (Hindi)' },
    { code: 'zh', label: '中文 (Chinese)' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' },
    { code: 'ja', label: '日本語' },
    { code: 'pt', label: 'Português' },
    { code: 'ar', label: 'العربية' },
    { code: 'ru', label: 'Русский' },
    { code: 'ko', label: '한국어' },
    { code: 'it', label: 'Italiano' },
    { code: 'bn', label: 'বাংলা' },
    { code: 'id', label: 'Bahasa Indonesia' },
  ];

  return (
    <header className="w-full bg-[var(--header-bg)] backdrop-blur-md flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-[var(--border)] sticky top-0 z-40 select-none">
      {/* Left: View Breadcrumb with Clickable Home Navigation */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
        <button
          onClick={() => navigate('/home')}
          className="text-[10px] sm:text-[11px] font-bold text-[var(--text-muted)] hover:text-[#89A88D] uppercase tracking-widest font-mono shrink-0 transition-colors cursor-pointer"
          title="Return to Command Center"
        >
          Shiro
        </button>
        <span className="text-[var(--border)] text-xs sm:text-sm shrink-0">/</span>
        <span className="text-sm sm:text-base font-bold text-[var(--text-main)] font-serif truncate">
          {getRouteTitle()}
        </span>
      </div>

      {/* Center: Command Palette Trigger (Universal Shortcut) */}
      <button
        onClick={() => {
          const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
          document.dispatchEvent(event);
        }}
        className="hidden md:flex items-center justify-between w-64 lg:w-96 px-3.5 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border)] hover:border-[#89A88D]/50 text-[var(--text-secondary)] hover:text-[var(--text-main)] text-xs transition-all shadow-xs group mx-3 cursor-pointer"
      >
        <div className="flex items-center gap-2.5 truncate">
          <Search className="w-3.5 h-3.5 text-[#3F6048] dark:text-[#89A88D] group-hover:scale-105 transition-transform shrink-0" />
          <span className="truncate">{t("searchPlaceholder", "Search notes, tools, or type a command...")}</span>
        </div>
        <kbd className="px-1.5 py-0.5 rounded bg-[var(--bg-surface-elevated)] border border-[var(--border)] font-mono text-[10px] text-[var(--text-muted)] shrink-0">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      {/* Right: Quick Controls & Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Subtle AI Gateway Live Badge */}
        <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[10px] font-mono text-[var(--text-muted)] shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] dark:bg-[#4ADE80] animate-pulse" />
          <span>AI Gateway Live</span>
        </div>


        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? "Switch to Warm Ivory Light" : "Switch to Deep Dark"}
          aria-label="Toggle theme"
          className="p-1.5 sm:p-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors active:scale-95 touch-target"
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5 text-[#F59E0B]" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-[#1E293B]" />
          )}
        </button>

        {/* Language Selector */}
        <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors">
          <Globe className="w-3.5 h-3.5 text-[#89A88D] hidden xs:block" />
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)} 
            aria-label="Language selector"
            className="bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-lg px-1.5 sm:px-2 py-1 text-[11px] sm:text-xs font-medium outline-none cursor-pointer text-[var(--text-main)] max-w-[85px] sm:max-w-none"
          >
            {popularLanguages.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Profile Avatar & Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-label="User profile menu"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl border border-[var(--border)] overflow-hidden cursor-pointer shadow-sm hover:border-[#89A88D] transition-all p-0.5 bg-[var(--bg-surface-elevated)] flex items-center justify-center active:scale-95"
          >
            <img 
              src={user?.avatar_url || getAvatarUrl(user?.name)} 
              alt="User" 
              className="w-full h-full object-cover rounded-[10px]" 
            />
          </button>

          {/* Profile Dropdown Sheet */}
          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] p-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl z-50 space-y-3">
              {/* User Identity Header */}
              <div className="flex items-center gap-3 p-2 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border)]">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#89A88D]/20 border border-[#89A88D]/30 flex items-center justify-center text-[#89A88D] font-bold text-sm">
                  {user?.name ? user.name[0].toUpperCase() : "U"}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[var(--text-main)] truncate">{user?.name || "Student Scholar"}</p>
                  <p className="text-[11px] text-[var(--text-muted)] truncate">{user?.email || "guest@shiro.ai"}</p>
                </div>
              </div>

              {/* Study Stats Matrix */}
              <div className="grid grid-cols-2 gap-2 p-2 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border)] text-center">
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block">XP Points</span>
                  <span className="text-xs font-bold text-[#89A88D]">{studyStats?.xp || 140} XP</span>
                </div>
                <div>
                  <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block">Avg Retention</span>
                  <span className="text-xs font-bold text-[#D6A84F]">{studyStats?.avgScore || 75}%</span>
                </div>
              </div>

              {/* Navigation Links */}
              <div className="space-y-1 pt-1 border-t border-[var(--border)] text-xs">
                <button
                  onClick={() => { setShowProfileMenu(false); navigate("/progress-report"); }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-[var(--bg-surface-elevated)] flex items-center gap-2.5 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                >
                  <TrendingUp className="w-4 h-4 text-[#89A88D]" />
                  <span>Decision Center</span>
                </button>
                <button
                  onClick={() => { setShowProfileMenu(false); navigate("/documents"); }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-[var(--bg-surface-elevated)] flex items-center gap-2.5 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-[#89A88D]" />
                  <span>Document Library</span>
                </button>
                <button
                  onClick={() => { setShowProfileMenu(false); navigate("/audio-summary"); }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-[var(--bg-surface-elevated)] flex items-center gap-2.5 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                >
                  <Headphones className="w-4 h-4 text-[#62816A]" />
                  <span>Audio Lab</span>
                </button>
                <button
                  onClick={() => { setShowProfileMenu(false); navigate("/settings"); }}
                  className="w-full px-3 py-2 rounded-xl hover:bg-[var(--bg-surface-elevated)] flex items-center gap-2.5 text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                >
                  <UserIcon className="w-4 h-4 text-[var(--text-muted)]" />
                  <span>Account Settings</span>
                </button>
              </div>

              {/* Logout Button */}
              {user && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <button
                    onClick={() => { setShowProfileMenu(false); logout(); }}
                    className="w-full px-3 py-2 rounded-xl bg-[#C96B62]/10 hover:bg-[#C96B62]/20 text-[#C96B62] flex items-center justify-center gap-2 text-xs font-semibold transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
