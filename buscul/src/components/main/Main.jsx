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
    feynmanConcept,
    language,
    setLanguage
  } = useContext(Context);

  const [mode, setMode] = useState("human"); 
  
  const navigate = useNavigate();
  const { user } = useAuth();
  


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

  const messagesEndRef = useRef(null);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };

  return (
    <main className="w-full min-h-screen pb-32">


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
