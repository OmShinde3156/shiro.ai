import React, { useContext, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../../context/Context";
import { useAuth } from "../../context/AuthContext";
import API_BASE_URL from "../../api/config.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import toast from 'react-hot-toast';

const Main = () => {
  const { 
    onSent, 
    showResults, 
    loading, 
    setInput, 
    input,
    documents,
    messages,
    startFeynmanChallenge,
    isFeynmanMode,
    feynmanConcept
  } = useContext(Context);

  const [language, setLanguage] = useState("en");
  const [mode, setMode] = useState("human"); 
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [userStats, setUserStats] = useState({ avgScore: 0, streak: 0, tasksDone: 0, totalTasks: 0 });
  
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  
  const menuRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload-avatar/${user.id}`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.avatar_url) {
        updateUser({ avatar_url: data.avatar_url });
        toast.success("Profile picture updated!");
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
      toast.error("Failed to upload profile picture.");
    }
  };

  useEffect(() => {
    if (user?.id && showProfileMenu) {
      fetchUserQuickStats();
    }
  }, [user, showProfileMenu]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchUserQuickStats = async () => {
    try {
      const [progressRes, timetableRes] = await Promise.all([
        fetch(`${API_BASE_URL}/progress/${user.id}`),
        fetch(`${API_BASE_URL}/timetable/${user.id}`)
      ]);
      const progressData = await progressRes.json();
      const timetableData = await timetableRes.json();
      
      setUserStats({
        avgScore: progressData.average_score || 0,
        streak: progressData.study_streak || 0,
        tasksDone: timetableData.today_schedule?.filter(t => t.completed).length || 0,
        totalTasks: timetableData.today_schedule?.length || 0
      });
    } catch (err) {
      console.error("Error fetching quick stats:", err);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    await onSent(language, user?.id, documents.map(d => d.id), mode);
  };

  const handleCardClick = (topic) => {
    if (topic === "Take Quiz") navigate("/quiz");
    else if (topic === "Summarize this Topic") navigate("/summary");
    else if (topic === "Feynman Challenge") navigate("/feynman");
    else if (topic === "Generate Flashcards") navigate("/flashcards");
    else if (topic === "Create Mind Maps") navigate("/mindmap");
    else if (topic === "Audio Summary") navigate("/audio-summary");
    else if (topic === "PYQS Prediction") navigate("/pyqs");
    else { setInput(topic); onSent(language, user?.id, documents.map(d => d.id), mode); }
  };

  const renderGenerativeUI = (text) => {
    const uiRegex = /<shiro_ui>(.*?)<\/shiro_ui>/s;
    const match = text.match(uiRegex);
    if (!match) return null;
    try {
      const { type, props } = JSON.parse(match[1]);
      if (type === "ActionCard") {
        return (
          <div className="mt-4 p-6 glass-card rounded-2xl border-l-4 border-primary bg-primary/5 flex items-center justify-between group hover:bg-primary/10 transition-all cursor-pointer" onClick={() => handleCardClick(props.action)}>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-primary opacity-70 mb-1 block">Suggested Next Step</span>
              <h4 className="text-lg font-bold text-[var(--text-main)]">{props.title}</h4>
            </div>
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform"><span className="material-symbols-outlined">arrow_forward</span></div>
          </div>
        );
      }
    } catch (e) { return null; }
  };

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/bottts/svg?seed=${seed || "Guest"}&backgroundColor=0b0e14,72dcff,dd8bfb`;

  return (
    <main className="w-full min-h-screen pb-32">
      <header className="w-full sticky top-0 z-40 bg-[var(--sidebar-bg)] opacity-80 backdrop-blur-xl flex justify-between items-center px-8 py-4 border-b border-[var(--border)]">
        <span className="text-2xl font-black text-[var(--primary)] font-headline">Shiro.ai</span>
        <div className="flex items-center gap-6">
          <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-transparent border-none text-[var(--text-main)] opacity-70 hover:opacity-100 cursor-pointer text-sm font-semibold outline-none">
            <option value="en" className="bg-[var(--sidebar-bg)]">English</option>
            <option value="hi" className="bg-[var(--sidebar-bg)]">Hindi</option>
          </select>
          <div className="relative" ref={menuRef}>
            <div 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="w-10 h-10 rounded-full border border-primary/20 overflow-hidden cursor-pointer group relative shadow-[0_0_15px_rgba(114,220,255,0.2)] hover:border-primary/60 transition-all"
            >
               <img src={user?.avatar_url || getAvatarUrl(user?.name)} alt="User" className="w-full h-full object-cover" />
            </div>

            {/* Profile Dropdown Hub */}
            {showProfileMenu && (
              <div className="absolute top-12 right-0 w-80 glass-card rounded-3xl border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.5)] z-[60] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="p-6 border-b border-white/5 bg-primary/5">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="relative group/avatar">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary p-0.5">
                        <div className="w-full h-full rounded-full bg-[#0b0e14] overflow-hidden">
                          <img src={user?.avatar_url || getAvatarUrl(user?.name)} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                      </div>
                      <button 
                        onClick={() => fileInputRef.current.click()}
                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                      >
                        <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                      </button>
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-[var(--text-main)] truncate">{user?.name || "Learner"}</h4>
                      <p className="text-[10px] uppercase font-black text-primary tracking-widest">Level {user?.level || 1} Scholar</p>
                    </div>
                  </div>
                  
                  {/* XP Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                      <span>Experience</span>
                      <span className="text-secondary">{user?.xp || 0} XP</span>
                    </div>
                    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-1000" 
                        style={{ width: `${Math.min(100, ((user?.xp || 0) % 100) / 100 * 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                      <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase block mb-1">Accuracy</span>
                      <span className="text-sm font-black text-secondary">{userStats?.avgScore || 0}%</span>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                      <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase block mb-1">Streak</span>
                      <span className="text-sm font-black text-orange-400">{userStats?.streak || 0} Days</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-5">
                  <div>
                    <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                      <span>Daily Goal</span>
                      <span className="text-primary">{userStats?.tasksDone || 0}/{userStats?.totalTasks || 0}</span>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-1000" 
                        style={{ width: `${userStats?.totalTasks ? (userStats.tasksDone / userStats.totalTasks) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button 
                      onClick={() => { navigate("/progress-report"); setShowProfileMenu(false); }}
                      className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-[var(--text-main)] flex items-center justify-center gap-3 border border-white/5 transition-all group"
                    >
                      <span className="material-symbols-outlined text-sm text-primary group-hover:rotate-12 transition-transform">leaderboard</span>
                      Full Analytics
                    </button>
                    <button 
                      onClick={() => { navigate("/settings"); setShowProfileMenu(false); }}
                      className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-[var(--text-main)] flex items-center justify-center gap-3 border border-white/5 transition-all group"
                    >
                      <span className="material-symbols-outlined text-sm text-[var(--text-muted)] group-hover:rotate-45 transition-transform">settings</span>
                      Account Settings
                    </button>
                  </div>
                </div>
              </div>
            )}

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAvatarUpload} 
              className="hidden" 
              accept="image/*"
            />
          </div>

        </div>
      </header>

      <div className="p-8 max-w-6xl mx-auto">
        {!showResults ? (
          <>
            <section className="mb-12">
              <h2 className="text-[3.5rem] font-bold font-headline leading-tight tracking-tight text-[var(--text-main)]">
                Hey, {user?.name?.split(" ")[0] || "Learner"}. <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Let's Improve Your Score</span>
              </h2>
            </section>

            <section className="grid grid-cols-12 gap-6 auto-rows-[160px]">
              <div onClick={() => handleCardClick("Summarize this Topic")} className="cursor-pointer col-span-12 md:col-span-8 row-span-2 glass-card rounded-3xl p-8 bento-hover transition-all border border-white/10 flex flex-col justify-between group overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-40 transition-opacity"><span className="material-symbols-outlined text-[120px]">article</span></div>
                <div><div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary mb-4"><span className="material-symbols-outlined">auto_awesome</span></div><h3 className="text-2xl font-bold text-white">Summarize Topic</h3><p className="text-white/70 max-w-sm">Turn long chapters into short, easy notes.</p></div>
                <button className="bg-primary text-white font-bold px-6 py-3 rounded-xl w-fit shadow-lg shadow-primary/20">Create Summary</button>
              </div>

              <div onClick={() => handleCardClick("Take Quiz")} className="cursor-pointer col-span-12 md:col-span-4 row-span-2 bg-secondary/10 rounded-3xl p-8 bento-hover transition-all border border-secondary/20 flex flex-col justify-between">
                <div><div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary mb-4"><span className="material-symbols-outlined">quiz</span></div><h3 className="text-2xl font-bold text-white">Take a Quiz</h3><p className="text-white/70">Test what you know.</p></div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-secondary w-[85%] shadow-[0_0_10px_rgba(237,177,255,0.5)]"></div></div>
              </div>

              <div onClick={() => handleCardClick("Generate Flashcards")} className="cursor-pointer col-span-12 md:col-span-4 row-span-2 glass-card rounded-3xl p-8 bento-hover transition-all border border-white/10 flex flex-col justify-between">
                <div><div className="w-12 h-12 rounded-xl bg-tertiary/20 flex items-center justify-center text-tertiary mb-4"><span className="material-symbols-outlined">style</span></div><h3 className="text-2xl font-bold text-white">Flashcards</h3><p className="text-white/70">Quick memory cards.</p></div>
                <div className="flex -space-x-4"><div className="w-10 h-10 rounded-lg bg-tertiary/20 border border-tertiary/40 flex items-center justify-center text-tertiary text-xs font-bold">+ New</div></div>
              </div>

              <div onClick={() => navigate("/study-room")} className="cursor-pointer col-span-12 md:col-span-8 row-span-2 glass-card rounded-3xl p-8 bento-hover border border-secondary/30 bg-secondary/5 flex flex-col justify-between overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-20 group-hover:opacity-40"><span className="material-symbols-outlined text-[100px]">school</span></div>
                <div><div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary mb-4"><span className="material-symbols-outlined">auto_stories</span></div><h3 className="text-2xl font-bold text-white">Study Room</h3><p className="text-white/70">A quiet space to learn with Shiro AI.</p></div>
                <button className="bg-secondary text-white font-bold px-6 py-3 rounded-xl w-fit shadow-lg shadow-secondary/20">Enter Room</button>
              </div>

              <div onClick={() => handleCardClick("Feynman Challenge")} className="cursor-pointer col-span-12 md:col-span-4 row-span-2 glass-card rounded-3xl p-8 bento-hover border border-primary/20 bg-primary/5 flex flex-col justify-between overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20"><span className="material-symbols-outlined text-[100px]">psychology</span></div>
                <div><div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary mb-4"><span className="material-symbols-outlined">forum</span></div><h3 className="text-2xl font-bold text-[var(--text-main)]">Feynman</h3></div>
                <p className="text-[var(--text-muted)] text-sm">Teach it to master it.</p>
              </div>
            </section>
          </>
        ) : (
          <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-10">
             {messages.map((msg, index) => (
               <div key={index} className={`flex items-start gap-4 ${msg.isUser ? 'flex-row-reverse' : ''}`}>
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${msg.isUser ? 'bg-surface-container-high' : 'bg-primary/10'}`}>
                   <span className="material-symbols-outlined text-sm">{msg.isUser ? 'person' : 'auto_awesome'}</span>
                 </div>
                 <div className={`glass-card p-6 rounded-3xl max-w-[85%] ${msg.isUser ? 'rounded-tr-none' : 'rounded-tl-none border-l-4 border-primary'}`}>
                    {msg.thought && <details className="mb-4 group"><summary className="list-none cursor-pointer inline-flex items-center gap-2 p-2 bg-primary/10 rounded-xl text-[10px] font-bold text-primary uppercase"><span className="material-symbols-outlined text-sm">psychology</span>Thought</summary><div className="mt-2 p-4 bg-primary/5 rounded-2xl text-xs italic">{msg.thought}</div></details>}
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    {!msg.isUser && (
                      <div className="mt-4 flex items-center gap-2 border-t border-white/5 pt-4">
                        <button 
                          onClick={() => {
                            const speech = new SpeechSynthesisUtterance(msg.text.replace(/<[^>]*>?/gm, ''));
                            window.speechSynthesis.speak(speech);
                          }}
                          className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary/60 hover:text-primary transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">volume_up</span>
                          Listen to Answer
                        </button>
                        {renderGenerativeUI(msg.text)}
                      </div>
                    )}
                 </div>
               </div>
             ))}
             <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl z-50 px-6">
        <div className="flex flex-col gap-3">
          {/* Shiro v4.0: Ultra-Modern Mode Toggle */}
          <div className="flex justify-center mb-4 tour-mode-toggle">
            <div className="relative bg-black/40 backdrop-blur-2xl p-1 rounded-2xl border border-white/5 flex gap-1 shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden">
              {/* Sliding Active Indicator */}
              <div 
                className="absolute top-1 bottom-1 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] rounded-xl z-0 shadow-[0_0_20px_rgba(114,220,255,0.3)]"
                style={{
                  left: mode === "human" ? "4px" : "calc(50% + 2px)",
                  width: "calc(50% - 6px)",
                  background: mode === "human" 
                    ? "linear-gradient(135deg, var(--primary) 0%, #4ea8ff 100%)" 
                    : "linear-gradient(135deg, var(--secondary) 0%, #c084fc 100%)",
                  boxShadow: mode === "human" 
                    ? "0 4px 15px rgba(114, 220, 255, 0.4)" 
                    : "0 4px 15px rgba(221, 139, 251, 0.4)"
                }}
              />

              <button 
                onClick={() => setMode("human")}
                className={`relative z-10 flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${mode === "human" ? "text-white" : "text-white/40 hover:text-white/70"}`}
              >
                <span className="material-symbols-outlined text-sm">face</span>
                Human
              </button>

              <button 
                onClick={() => setMode("surgical")}
                className={`relative z-10 flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${mode === "surgical" ? "text-white" : "text-white/40 hover:text-white/70"}`}
              >
                <span className="material-symbols-outlined text-sm">biotech</span>
                Surgical
              </button>
            </div>
          </div>


          <div className="glass-card p-2 rounded-2xl border border-[var(--primary)]/20 shadow-[0_20px_50_rgba(0,0,0,0.5)] flex items-center gap-3 relative overflow-hidden tour-chat-input">
            <input 
              className="bg-transparent border-none focus:ring-0 flex-grow text-[var(--text-main)] py-3 px-4 outline-none" 
              placeholder={mode === "human" ? "Chat naturally..." : "Deep RAG analysis..."} 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
            />
            <button onClick={handleSend} className="w-12 h-12 rounded-xl bg-primary text-on-primary flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20"><span className="material-symbols-outlined">send</span></button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Main;
