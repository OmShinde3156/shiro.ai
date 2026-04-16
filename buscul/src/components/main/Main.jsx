import React, { useContext, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../../context/Context";
import { useAuth } from "../../context/AuthContext";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const Main = () => {
  const { 
    onSent, 
    recentPrompt, 
    showResults, 
    loading, 
    resultData, 
    setInput, 
    input,
    documents,
    messages
  } = useContext(Context);

  const [language, setLanguage] = useState("en");
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleCardClick = (topic) => {
    if (topic === "Take Quiz") navigate("/quiz");
    else if (topic === "Summarize this Topic") navigate("/summary");
    else if (topic === "PYQS Prediction") navigate("/pyqs");
    else if (topic === "Generate Flashcards") navigate("/flashcards");
    else if (topic === "Create Mind Maps") navigate("/mindmap");
    else if (topic === "Audio Summary") navigate("/audio-summary");
    else if (topic === "User Progress") navigate("/progress-report");
    else if (topic === "Study Plan") navigate("/study-plan");
    else {
      setInput(topic);
      onSent(language, user?.id, documents.map(d => d.id));
    }
  };

  return (
    <main className="ml-64 mr-20 min-h-screen pb-32">
      {/* TopNavBar */}
      <header className="w-full sticky top-0 z-40 bg-[var(--sidebar-bg)] opacity-80 backdrop-blur-xl flex justify-between items-center px-8 py-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-4">
          <span className="text-2xl font-black tracking-tight text-[var(--primary)] font-headline">Shiro.ai</span>
        </div>
        <div className="flex items-center gap-6">
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value)}
            className="bg-transparent border-none text-[var(--text-main)] opacity-70 hover:opacity-100 focus:ring-0 cursor-pointer text-sm font-semibold outline-none"
          >
            <option value="en" className="bg-[var(--sidebar-bg)]">EN</option>
            <option value="hi" className="bg-[var(--sidebar-bg)]">HI</option>
            <option value="mr" className="bg-[var(--sidebar-bg)]">MR</option>
          </select>
          <div className="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden border border-[var(--primary)]/20 flex items-center justify-center">
             <span className="material-symbols-outlined text-[var(--primary)]">person</span>
          </div>
        </div>
      </header>

      <div className="p-8 max-w-6xl mx-auto">
        {!showResults ? (
          <>
            {/* Greeting Section */}
            <section className="mb-12">
              <h2 className="text-[3.5rem] font-bold font-headline leading-tight tracking-tight text-[var(--text-main)]">
                Hey, {user?.name ? user.name.split(" ")[0] : "Learner"}. <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">Let's Improve Your Score</span>
              </h2>
              <p className="text-[var(--text-muted)] text-lg mt-4 max-w-2xl font-body">
                Analyze your study material, generate insights, and master topics with the precision of AI-driven curation.
              </p>
            </section>

            {/* Bento Grid Main Functions */}
            <section className="grid grid-cols-12 gap-6 auto-rows-[160px]">
              
              {/* Summarize Tile */}
              <div onClick={() => handleCardClick("Summarize this Topic")} className="cursor-pointer col-span-12 md:col-span-8 row-span-2 glass-card rounded-3xl p-8 bento-hover transition-all duration-300 flex flex-col justify-between group relative overflow-hidden border border-[var(--border)]">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <span className="material-symbols-outlined text-[120px]">article</span>
                </div>
                <div>
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary mb-4">
                    <span className="material-symbols-outlined">auto_awesome</span>
                  </div>
                  <h3 className="text-2xl font-bold font-headline mb-2 text-[var(--text-main)]">Summarize this Topic</h3>
                  <p className="text-[var(--text-muted)] max-w-sm">Turn complex chapters into bite-sized, high-retention summaries in seconds.</p>
                </div>
                <div className="flex gap-4">
                  <button className="bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold px-6 py-3 rounded-xl hover:scale-105 active:scale-95 transition-all">Start Summarizing</button>
                </div>
              </div>

              {/* Take Quiz Tile */}
              <div onClick={() => handleCardClick("Take Quiz")} className="cursor-pointer col-span-12 md:col-span-4 row-span-2 bg-surface-container-high rounded-3xl p-8 bento-hover transition-all duration-300 flex flex-col justify-between border border-primary/5">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary mb-4">
                    <span className="material-symbols-outlined">quiz</span>
                  </div>
                  <h3 className="text-2xl font-bold font-headline mb-2 text-[var(--text-main)]">Take Quiz</h3>
                  <p className="text-[var(--text-muted)]">Adaptive testing based on your current knowledge gaps.</p>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs uppercase tracking-widest text-[var(--secondary)]">Next Level</span>
                    <span className="text-xs font-bold text-[var(--text-main)]">85%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-secondary w-[85%] rounded-full shadow-[0_0_10px_rgba(221,139,251,0.5)]"></div>
                  </div>
                </div>
              </div>

              {/* Flashcards */}
              <div onClick={() => handleCardClick("Generate Flashcards")} className="cursor-pointer col-span-12 md:col-span-4 row-span-2 glass-card rounded-3xl p-8 bento-hover transition-all duration-300 flex flex-col justify-between border border-white/5">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-tertiary/20 flex items-center justify-center text-tertiary mb-4">
                    <span className="material-symbols-outlined">style</span>
                  </div>
                  <h3 className="text-2xl font-bold font-headline mb-2 text-[var(--text-main)]">Generate Flashcards</h3>
                  <p className="text-[var(--text-muted)]">Spaced repetition cards for long-term memorization.</p>
                </div>
                <div className="flex -space-x-4">
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-card)] border border-outline-variant flex items-center justify-center text-xs">1</div>
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-card)] border border-outline-variant flex items-center justify-center text-xs">2</div>
                  <div className="w-10 h-10 rounded-lg bg-[var(--bg-card)] border border-outline-variant flex items-center justify-center text-xs">3</div>
                  <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-xs">+</div>
                </div>
              </div>

              {/* Mind Maps */}
              <div onClick={() => handleCardClick("Create Mind Maps")} className="cursor-pointer col-span-12 md:col-span-4 row-span-2 bg-[var(--bg-card)] rounded-3xl p-8 bento-hover transition-all duration-300 border border-outline-variant/10 flex flex-col">
                <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary-container mb-4">
                  <span className="material-symbols-outlined">account_tree</span>
                </div>
                <h3 className="text-2xl font-bold font-headline mb-2 text-[var(--text-main)]">Create Mind Maps</h3>
                <p className="text-[var(--text-muted)] flex-grow">Visualize connections between complex concepts.</p>
                <div className="mt-6 flex items-end justify-center h-24">
                  <div className="relative w-full h-full">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-32 h-32 border border-primary/20 rounded-full animate-pulse"></div>
                      <div className="w-16 h-16 border border-secondary/20 rounded-full absolute"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PYQS Prediction */}
              <div onClick={() => handleCardClick("PYQS Prediction")} className="cursor-pointer col-span-12 md:col-span-4 row-span-2 glass-card rounded-3xl p-8 bento-hover transition-all duration-300 border border-tertiary/10 flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tertiary/10 text-tertiary text-[10px] font-bold uppercase tracking-widest mb-4">
                    <span className="material-symbols-outlined text-sm">bolt</span> Predicted
                  </div>
                  <h3 className="text-2xl font-bold font-headline mb-2 text-[var(--text-main)]">PYQS Prediction</h3>
                  <p className="text-[var(--text-muted)]">Intelligent prediction of important previous year questions.</p>
                </div>
                <div className="space-y-2">
                  <div className="p-3 bg-[var(--bg-card)]/50 rounded-xl flex items-center gap-3">
                    <span className="material-symbols-outlined text-tertiary">star</span>
                    <span className="text-sm font-medium">92% Match Probablity</span>
                  </div>
                </div>
              </div>

            </section>
          </>
        ) : (
          <div className="max-w-4xl mx-auto mt-4 flex flex-col gap-8 pb-10">
             {messages.map((msg, index) => (
               <div key={index}>
                 {msg.isUser ? (
                   <div className="flex items-start gap-4 flex-row-reverse">
                     <div className="w-10 h-10 rounded-full bg-surface-container-high border border-[var(--primary)]/20 flex items-center justify-center flex-shrink-0">
                       <span className="material-symbols-outlined text-[var(--text-main)]">person</span>
                     </div>
                     <div className="bg-surface-container-high rounded-2xl rounded-tr-none p-4 max-w-[80%] border border-white/5">
                       <p className="text-[var(--text-main)]">{msg.text}</p>
                     </div>
                   </div>
                 ) : (
                   <div className="flex items-start gap-4">
                     <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 border border-[var(--primary)]/20 mt-2">
                       <span className="material-symbols-outlined">auto_awesome</span>
                     </div>
                     <div className="glass-card rounded-3xl rounded-tl-none p-6 shadow-[0_24px_48px_rgba(114,220,255,0.05)] border border-[var(--border)] relative overflow-hidden flex-grow max-w-[85%]">
                       <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-[var(--primary)] to-[var(--secondary)]"></div>
                       {msg.isLoading ? (
                         <div className="flex gap-2 items-center h-6 py-2">
                           <div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-bounce" style={{animationDelay: "0ms"}}></div>
                           <div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-bounce" style={{animationDelay: "150ms"}}></div>
                           <div className="w-2 h-2 rounded-full bg-[var(--primary)] animate-bounce" style={{animationDelay: "300ms"}}></div>
                           <span className="ml-2 text-[var(--text-muted)] text-sm">Curating response...</span>
                         </div>
                       ) : (
                         <div className="prose prose-invert prose-p:text-[var(--text-main)]/90 prose-headings:text-[var(--text-main)] prose-a:text-[var(--primary)] max-w-none text-sm md:text-base leading-relaxed">
                           <ReactMarkdown remarkPlugins={[remarkGfm]}>
                             {msg.text}
                           </ReactMarkdown>
                         </div>
                       )}
                     </div>
                   </div>
                 )}
               </div>
             ))}
             <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Bottom Search/Chat Bar */}
      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl z-50 px-6">
        <div className="glass-card p-2 rounded-2xl border border-[var(--primary)]/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center gap-3">
          <input 
            className="bg-transparent border-none focus:ring-0 flex-grow text-[var(--text-main)] placeholder:text-[var(--text-muted)]/50 py-3 font-body outline-none" 
            placeholder="Ask Shiro anything about your topics..." 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
                e.preventDefault();
                onSent(language, user?.id, documents.map(d => d.id));
              }
            }}
          />
          <button 
            onClick={() => {
               if(input.trim()) onSent(language, user?.id, documents.map(d => d.id));
            }}
            className="bg-gradient-to-br from-primary to-primary-container text-on-primary w-12 h-12 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 flex-shrink-0"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </div>
    </main>
  );
};

export default Main;

