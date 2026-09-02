import React, { useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Context } from "../../context/Context";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { 
  Home, 
  BookOpen, 
  School, 
  Layers, 
  HelpCircle, 
  Network, 
  Sparkles, 
  Headphones, 
  FileText, 
  Calendar, 
  Settings, 
  LogOut, 
  Sun, 
  Moon,
  BarChart3
} from "lucide-react";

export const Sidebar = () => {
  const { setInput, setShowResults, messages, t } = useContext(Context);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleHomeClick = () => {
    setShowResults(false);
    navigate("/home");
  };

  const handleChatClick = () => {
    setShowResults(true);
    navigate("/home");
  };

  const navSections = [
    {
      title: null,
      items: [
        { label: t("home", "Dashboard"), icon: Home, path: "/home", action: handleHomeClick },
        { 
          label: t("aiChat", "AI Tutor Chat"), 
          icon: Sparkles, 
          path: "/home", 
          action: handleChatClick,
          badge: messages && messages.length > 0 ? `${messages.filter(m => m.isUser).length}` : null
        }
      ]
    },
    {
      title: "Learn",
      items: [
        { label: t("library", "Library"), icon: BookOpen, path: "/documents" },
        { label: t("quiz", "Quiz Arena"), icon: HelpCircle, path: "/quiz" },
        { label: t("flashcards", "Flashcards"), icon: Layers, path: "/flashcards" },
        { label: t("feynman", "Feynman Mode"), icon: Sparkles, path: "/feynman" },
        { label: t("mindmap", "Mind Maps"), icon: Network, path: "/mindmap" },
        { label: t("audioSummary", "Audio Cast"), icon: Headphones, path: "/audio-summary" }
      ]
    },
    {
      title: "Workspace",
      items: [
        { label: t("studyRoom", "Study Room"), icon: School, path: "/study-rooms" }
      ]
    },
    {
      title: "Insights",
      items: [
        { label: t("examBlueprint", "Exam Blueprint"), icon: FileText, path: "/answer-planner" },
        { label: t("studyPlan", "Study Plan"), icon: Calendar, path: "/study-plan" },
        { label: t("progress", "Analytics"), icon: BarChart3, path: "/progress-report" }
      ]
    }
  ];

  return (
    <aside className="h-screen w-20 hover:w-60 fixed left-0 top-0 z-50 bg-[var(--sidebar-bg)] flex flex-col p-3 border-r border-[var(--border)] shadow-sm transition-all duration-300 group overflow-hidden select-none">
      {/* Brand Header */}
      <div 
        onClick={handleHomeClick}
        className="mb-5 cursor-pointer flex items-center gap-3 px-2 py-1"
      >
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-surface)] p-0.5 border border-[var(--border)] shrink-0 flex items-center justify-center overflow-hidden shadow-sm">
          <img 
            src="/logo.jpg" 
            alt="Shiro Logo" 
            className="w-full h-full object-cover rounded-[10px]"
          />
        </div>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap overflow-hidden">
          <h1 className="text-base font-bold text-[var(--text-main)] tracking-tight flex items-center gap-1 font-serif">
            Shiro<span className="text-[#3F6048] dark:text-[#89A88D] font-sans text-xs">.ai</span>
          </h1>
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-widest font-mono">
            {t("learningOS", "Learning OS")}
          </p>
        </div>
      </div>

      {/* Structured Navigation Groups */}
      <nav className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden custom-scroll pr-1">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {section.title && (
              <div className="px-3 pt-2 pb-1 text-[10px] uppercase font-mono tracking-widest text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                {section.title}
              </div>
            )}
            {section.items.map((item, iIdx) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <button
                  key={iIdx}
                  onClick={() => {
                    if (item.action) item.action();
                    else navigate(item.path);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? "bg-[#E4ECE5] dark:bg-[#89A88D]/15 text-[#3F6048] dark:text-[#A8C5AC] border border-[#3F6048]/20 dark:border-[#89A88D]/30 font-semibold shadow-sm"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"
                  }`}
                  title={item.label}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[#3F6048] dark:text-[#A8C5AC]" : "text-[var(--text-muted)]"}`} />
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Section */}
      <div className="pt-3 border-t border-[var(--border)] space-y-1">
        {/* Theme Mode Toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? "Switch to Warm Ivory Light" : "Switch to Deep Dark"}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-colors text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 shrink-0 text-[#D6A84F]" />
          ) : (
            <Moon className="w-4 h-4 shrink-0 text-[#3F6048]" />
          )}
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            {theme === 'dark' ? "Warm Light Mode" : "Dark Mode"}
          </span>
        </button>

        {/* Settings */}
        <button
          onClick={() => navigate("/settings")}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-colors ${
            location.pathname === "/settings"
              ? "bg-[var(--bg-surface-elevated)] text-[var(--text-main)] font-semibold"
              : "text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)]"
          }`}
        >
          <Settings className="w-4 h-4 shrink-0 text-[var(--text-muted)]" />
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
            {t("settings", "Settings")}
          </span>
        </button>

        {/* User / Logout */}
        {user ? (
          <div className="flex items-center justify-between p-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] mt-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#3F6048]/15 dark:bg-[#89A88D]/20 border border-[#3F6048]/20 dark:border-[#89A88D]/30 flex items-center justify-center text-[#3F6048] dark:text-[#89A88D] font-bold text-xs shrink-0">
                {user.name ? user.name[0].toUpperCase() : "U"}
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 min-w-0">
                <p className="text-xs font-semibold text-[var(--text-main)] truncate">{user.name || "User"}</p>
                <p className="text-[10px] text-[var(--text-muted)] truncate">{user.email || "guest@shiro.ai"}</p>
              </div>
            </div>
            <button
              onClick={logout}
              title="Log out"
              className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-[#C96B62] transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#3F6048]/15 text-[#3F6048] dark:bg-[#89A88D]/15 dark:text-[#89A88D] text-xs font-semibold hover:bg-[#3F6048]/25 transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-[#3F6048] dark:bg-[#89A88D]" />
            <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
              Log In
            </span>
          </button>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
