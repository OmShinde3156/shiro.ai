import React, { useContext, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../../context/Context";
import { useAuth } from "../../context/AuthContext";
import API_BASE_URL from "../../api/config.js";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import toast from 'react-hot-toast';
import MarkdownRenderer from "../chat/MarkdownRenderer";
import { 
  Sparkles, 
  Clock, 
  AlertTriangle, 
  Lightbulb,
  ChevronRight
} from "lucide-react";

const Main = () => {
  const { 
    onSent, 
    showResults, 
    setShowResults,
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
  
  // Swarm State
  const [insights, setInsights] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [showInsights, setShowInsights] = useState(true);
  const [selectedCitation, setSelectedCitation] = useState(null);

  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  
  const menuRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchInsights = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(`${API_BASE_URL}/insights/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      }
    } catch (err) {
      console.error("Failed to fetch insights", err);
    }
  };

  const runScan = async () => {
    if (!user?.id) return;
    setIsScanning(true);
    toast.promise(
      fetch(`${API_BASE_URL}/insights/analyze/${user.id}`, { method: 'POST' }),
      {
        loading: 'Shiro Swarm initiating library analysis...',
        success: 'Scan triggered! Check back in a few seconds.',
        error: 'Failed to initiate swarm.'
      }
    );
    // Poll for results in 5 seconds
    setTimeout(fetchInsights, 8000);
    setTimeout(() => setIsScanning(false), 2000);
  };

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
    if (user?.id) {
      fetchInsights();
      if (showProfileMenu) fetchUserQuickStats();
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

  const getAdaptiveCards = () => {
    const baseCards = [
      { id: 'quiz', title: "Take Quiz", desc: "Test what you know.", icon: "quiz", color: "secondary", priority: 1, span: "col-span-12 md:col-span-4" },
      { id: 'summary', title: "Summarize this Topic", desc: "Turn long chapters into easy notes.", icon: "auto_awesome", color: "primary", priority: 2, span: "col-span-12 md:col-span-8" },
      { id: 'flashcards', title: "Generate Flashcards", desc: "Quick memory cards.", icon: "style", color: "tertiary", priority: 3, span: "col-span-12 md:col-span-4" },
      { id: 'studyroom', title: "Study Room", desc: "A quiet space to learn with Shiro AI.", icon: "auto_stories", color: "secondary", priority: 4, span: "col-span-12 md:col-span-8", isStudy: true },
      { id: 'feynman', title: "Feynman Challenge", desc: "Teach it to master it.", icon: "psychology", color: "primary", priority: 5, span: "col-span-12 md:col-span-4" }
    ];

    let adaptive = [...baseCards];

    if (userStats.streak === 0) {
      adaptive = adaptive.map(c => {
        if (c.id === 'quiz') return { ...c, priority: 0, span: "col-span-12 md:col-span-6", desc: "Start a streak today!" };
        if (c.id === 'studyroom') return { ...c, priority: 1, span: "col-span-12 md:col-span-6" };
        return c;
      });
    }

    if (documents.length === 0) {
      adaptive = adaptive.map(c => {
        if (c.id === 'summary') return { ...c, priority: 0, span: "col-span-12", title: "Upload your first PDF", desc: "Let's start your digital library." };
        return c;
      });
    }

    return adaptive.sort((a, b) => a.priority - b.priority);
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

            {/* Shiro Intelligence Hub - Autonomous Swarm discoveries */}
            <div className="mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
               <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
                        <Sparkles size={16} className="animate-pulse" />
                     </div>
                     <h2 className="text-xl font-black tracking-tight text-white">Shiro Intelligence Hub</h2>
                     <button 
                       onClick={() => setShowInsights(!showInsights)}
                       className="ml-2 p-1 hover:bg-white/5 rounded-lg transition-all text-white/20 hover:text-white/60"
                     >
                       <span className="material-symbols-outlined text-sm">{showInsights ? 'expand_less' : 'expand_more'}</span>
                     </button>
                  </div>
                  {showInsights && (
                    <button 
                      onClick={runScan}
                      disabled={isScanning}
                      className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-primary hover:border-primary/40 transition-all flex items-center gap-2"
                    >
                       {isScanning ? 'Scanning...' : (
                          <>
                            <Clock size={12} />
                            Run Library Scan
                          </>
                       )}
                    </button>
                  )}
               </div>

               {showInsights && (
                 <>
                   {insights.length === 0 ? (
                      <div className="p-8 bg-white/5 border border-white/5 rounded-3xl text-center">
                         <p className="text-white/30 text-sm">No proactive insights discovered yet. Run a library scan to find connections!</p>
                      </div>
                   ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {insights.slice(0, 4).map(insight => (
                            <div key={insight.id} className={`p-6 rounded-3xl border transition-all hover:scale-[1.01] cursor-default ${insight.type === 'contradiction' ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/30' : 'bg-primary/5 border-primary/10 hover:border-primary/30'}`}>
                               <div className="flex items-start justify-between mb-4">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${insight.type === 'contradiction' ? 'text-red-400' : 'text-primary'}`}>
                                     {insight.type === 'contradiction' ? <AlertTriangle size={18} /> : <Lightbulb size={18} />}
                                  </div>
                                  <span className="text-[9px] font-black uppercase tracking-widest opacity-30">{new Date(insight.created_at).toLocaleDateString()}</span>
                               </div>
                               <h3 className="text-sm font-bold text-white mb-2">{insight.title}</h3>
                               <p className="text-xs text-white/50 leading-relaxed line-clamp-2">{insight.content}</p>
                            </div>
                         ))}
                      </div>
                   )}
                 </>
               )}
            </div>

            <section className="grid grid-cols-12 gap-6 auto-rows-[160px]">
              {getAdaptiveCards().map((card) => (
                <div 
                  key={card.id}
                  onClick={() => card.isStudy ? navigate("/study-room") : handleCardClick(card.title)} 
                  className={`cursor-pointer ${card.span} row-span-2 glass-card rounded-3xl p-8 bento-hover transition-all border border-white/10 flex flex-col justify-between group overflow-hidden relative ${card.id === 'studyroom' ? 'bg-secondary/5 border-secondary/30' : ''}`}
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                    <span className="material-symbols-outlined text-[100px]">{card.icon}</span>
                  </div>
                  <div>
                    <div className={`w-12 h-12 rounded-xl bg-${card.color}/20 flex items-center justify-center text-${card.color} mb-4`}>
                      <span className="material-symbols-outlined">{card.icon}</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white">{card.title}</h3>
                    <p className="text-white/70 max-w-sm">{card.desc}</p>
                  </div>
                  <button className={`bg-${card.color} text-white font-bold px-6 py-3 rounded-xl w-fit shadow-lg shadow-${card.color}/20`}>
                    {card.id === 'studyroom' ? 'Enter Room' : 'Start Now'}
                  </button>
                </div>
              ))}
            </section>
          </>
        ) : (
          <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-10">
             {/* Back Button for Chat */}
             <button 
               onClick={() => { setShowResults(false); setInput(""); navigate("/"); }}
               className="w-fit flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-[var(--text-muted)] hover:text-primary transition-all mb-4 group"
             >
               <span className="material-symbols-outlined text-sm group-hover:-translate-x-1 transition-transform">arrow_back</span>
               Back to Dashboard
             </button>

             {messages.map((msg, index) => (
               <div key={index} className={`flex items-start gap-4 ${msg.isUser ? 'flex-row-reverse' : ''}`}>
                 <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${msg.isUser ? 'bg-surface-container-high' : 'bg-primary/10'}`}>
                   <span className="material-symbols-outlined text-sm">{msg.isUser ? 'person' : 'auto_awesome'}</span>
                 </div>
                 <div className={`glass-card p-6 rounded-3xl max-w-[85%] ${msg.isUser ? 'rounded-tr-none' : 'rounded-tl-none border-l-4 border-primary'}`}>
                    {msg.thought && <details className="mb-4 group"><summary className="list-none cursor-pointer inline-flex items-center gap-2 p-2 bg-primary/10 rounded-xl text-[10px] font-bold text-primary uppercase"><span className="material-symbols-outlined text-sm">psychology</span>Thought</summary><div className="mt-2 p-4 bg-primary/5 rounded-2xl text-xs italic">{msg.thought}</div></details>}
                    <MarkdownRenderer 
                      content={msg.text} 
                      citations={msg.citations || []} 
                      onCitationClick={(cit) => setSelectedCitation(cit)} 
                    />
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

      {/* Source Citation Preview Modal */}
      {selectedCitation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedCitation(null)}>
           <div className="w-full max-w-2xl bg-[#151926] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-primary/5">
                 <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest">{selectedCitation.filename}</h3>
                    <p className="text-[10px] text-primary font-bold">VERIFIABLE SOURCE CITATION</p>
                 </div>
                 <button onClick={() => setSelectedCitation(null)} className="p-2 hover:bg-white/5 rounded-full text-white/40 hover:text-white transition-all">
                    <span className="material-symbols-outlined">close</span>
                 </button>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto scrollbar-hide">
                 <div className="prose prose-invert max-w-none text-white/70 leading-relaxed text-sm italic">
                    "{selectedCitation.content}"
                 </div>
              </div>
              <div className="p-6 bg-black/20 flex justify-end">
                 <button 
                   onClick={() => { navigate(`/documents/${selectedCitation.document_id}`); setSelectedCitation(null); }}
                   className="px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-primary hover:border-primary/40 transition-all flex items-center gap-2"
                 >
                    View Full Document
                    <ChevronRight size={14} />
                 </button>
              </div>
           </div>
        </div>
      )}
    </main>
  );
};

export default Main;
