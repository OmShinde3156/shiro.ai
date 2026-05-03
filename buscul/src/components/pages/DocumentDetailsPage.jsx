import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Context } from '../../context/Context';
import API_BASE_URL from '../../api/config.js';
import runChat from '../../config/Gemini.js';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const DocumentDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReading, setIsReading] = useState(false);
  
  // AI Assistant State
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { text: "I've analyzed this document. What would you like to focus on?", isUser: false }
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [generatingImportant, setGeneratingImportant] = useState(false);
  const [importantQuestions, setImportantQuestions] = useState(null);

  useEffect(() => {
    const fetchDocument = async () => {
      if (user && user.id) {
        try {
          const response = await fetch(`${API_BASE_URL}/documents/${user.id}/${id}`);
          if (response.ok) {
            const data = await response.json();
            setDocument(data);
          } else {
            setError('Failed to fetch document details');
          }
        } catch (err) {
          setError('An error occurred while fetching the document');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchDocument();
  }, [id, user]);

  const handleGenerateImportant = async () => {
    setGeneratingImportant(true);
    try {
      const formData = new FormData();
      formData.append('document_id', id);
      formData.append('user_id', user.id);
      formData.append('num_questions', 10);

      const response = await fetch(`${API_BASE_URL}/api/important-questions/generate`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setImportantQuestions(data.questions);
      }
    } catch (err) {
      console.error("Failed to generate important questions:", err);
    } finally {
      setGeneratingImportant(false);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { text: chatInput, isUser: true };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setAiLoading(true);

    try {
      const data = await runChat(chatInput, "en", user?.id, [parseInt(id)], "human");
      setChatMessages(prev => [...prev, { text: data.response || "I couldn't generate a response.", isUser: false }]);
    } catch (err) {
      console.error("AI Assistant error:", err);
      setChatMessages(prev => [...prev, { text: "Error connecting to Shiro AI.", isUser: false }]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleReadAloud = async () => {
    if (isReading) {
      setIsReading(false);
      // Wait for audio to stop if we had a ref, but simple state toggle prevents new calls
      return;
    }

    setIsReading(true);
    try {
      const textToRead = document.text_content ? document.text_content.substring(0, 2000) : "No text available.";
      const response = await fetch(`${API_BASE_URL}/speak`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textToRead }),
      });

      if (response.ok) {
        const data = await response.json();
        const audio = new Audio(data.url);
        audio.play();
        audio.onended = () => setIsReading(false);
        audio.onerror = () => {
           console.error("Audio playback error");
           setIsReading(false);
        };
      } else {
        setIsReading(false);
      }
    } catch (err) {
      console.error(err);
      setIsReading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#111125] flex items-center justify-center">
      <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#111125] text-[#e2e0fc] font-body">
      <main className="max-w-[1600px] mx-auto p-4 md:p-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Section: Document & Actions */}
        <section className="flex-1 flex flex-col gap-6">
          
          {/* Header Card */}
          <div className="glass-card relative overflow-hidden p-6 border-white/5 bg-white/5">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row justify-between gap-6">
              <div className="flex gap-4">
                <button onClick={() => navigate('/documents')} className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all shrink-0">
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-primary/20 text-primary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-primary/20">
                      {document?.subject || 'General'}
                    </span>
                    <span className="text-[#cfc2d7] text-xs uppercase font-bold tracking-widest opacity-60">
                      Uploaded {document?.upload_date ? new Date(document.upload_date).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <h2 className="text-3xl font-headline font-extrabold text-white tracking-tight leading-tight">{document?.filename}</h2>
                </div>
              </div>
              <div className="flex gap-3 h-fit">
                <button onClick={handleReadAloud} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${isReading ? 'bg-secondary text-on-primary' : 'bg-white/5 text-white hover:bg-white/10 border border-white/10'}`}>
                  <span className="material-symbols-outlined text-lg">{isReading ? 'stop' : 'volume_up'}</span>
                  {isReading ? 'Stop' : 'Listen'}
                </button>
                <button onClick={() => navigate('/study-room', { state: { documentId: document?.id } })} className="bg-gradient-to-br from-primary to-[#006d84] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">school</span>
                  Study Room
                </button>
              </div>
            </div>
          </div>

          {/* Action Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onClick={() => navigate('/quiz', { state: { documentId: document?.id } })} className="group glass-card p-6 border-white/10 bg-primary/5 hover:border-primary transition-all text-left relative overflow-hidden h-40 flex flex-col justify-between">
              <div className="absolute -right-4 -bottom-4 opacity-20 group-hover:opacity-40 transition-opacity">
                <span className="material-symbols-outlined text-9xl">quiz</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl">school</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Quick Quiz</h3>
                <p className="text-white/70 text-xs mt-1">Test your memory.</p>
              </div>
            </button>

            <button onClick={() => navigate('/flashcards', { state: { documentId: document?.id } })} className="group glass-card p-6 border-white/10 bg-secondary/5 hover:border-secondary transition-all text-left relative overflow-hidden h-40 flex flex-col justify-between">
              <div className="absolute -right-4 -bottom-4 opacity-20 group-hover:opacity-40 transition-opacity">
                <span className="material-symbols-outlined text-9xl">style</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl">style</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Study Cards</h3>
                <p className="text-white/70 text-xs mt-1">Key terms & recall.</p>
              </div>
            </button>

            <button onClick={() => navigate('/mindmap', { state: { documentId: document?.id } })} className="group glass-card p-6 border-white/10 bg-emerald-500/5 hover:border-emerald-500 transition-all text-left relative overflow-hidden h-40 flex flex-col justify-between">
              <div className="absolute -right-4 -bottom-4 opacity-20 group-hover:opacity-40 transition-opacity">
                <span className="material-symbols-outlined text-9xl">hub</span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-2xl">hub</span>
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Mind Map</h3>
                <p className="text-white/70 text-xs mt-1">Visual knowledge web.</p>
              </div>
            </button>
          </div>

          {/* Document Content View */}
          <div className="glass-card p-8 border-white/5 bg-black/20 min-h-[300px]">
             <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">description</span>
                Raw Content
             </h3>
             <div className="prose prose-invert max-w-none text-white/80 whitespace-pre-wrap leading-relaxed">
                {document?.text_content || "*No content could be extracted from this document.*"}
             </div>
          </div>

          {/* Summary Section (if exists) */}
          {document?.summary && (
            <div className="glass-card p-8 border-white/5 bg-primary/5">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">auto_awesome</span>
                AI Summary
              </h3>
              <div className="prose prose-invert max-w-none text-white/90">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{document.summary.summary_text}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Latest Quiz Section (if exists) */}
          {document?.quiz && (
            <div className="glass-card p-8 border-white/5 bg-[#cc97ff]/5">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#cc97ff]">quiz</span>
                  Latest Quiz
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#cc97ff]/60">
                  {document.quiz.questions?.length} Questions • {document.quiz.difficulty}
                </span>
              </div>
              <div className="space-y-4">
                {document.quiz.questions?.slice(0, 3).map((q, i) => (
                  <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-sm text-white/80 font-medium">{q.question}</p>
                  </div>
                ))}
                {document.quiz.questions?.length > 3 && (
                  <button onClick={() => navigate('/quiz', { state: { documentId: id } })} className="text-xs font-bold text-[#cc97ff] hover:underline">
                    View all questions...
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Knowledge Graph / Mindmap Preview (if exists) */}
          {document?.mindmap && (
            <div className="glass-card p-8 border-white/5 bg-emerald-500/5">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400">hub</span>
                  Knowledge Web
                </h3>
                <button 
                  onClick={() => navigate('/mindmap', { state: { documentId: id } })}
                  className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold hover:bg-emerald-500/30 transition-all"
                >
                  View Interactive Map
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {document.mindmap.nodes?.slice(0, 12).map((node, i) => (
                  <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] text-white/60">
                    {node.label}
                  </span>
                ))}
                {document.mindmap.nodes?.length > 12 && <span className="text-[10px] text-white/30 self-center">+{document.mindmap.nodes.length - 12} more nodes</span>}
              </div>
            </div>
          )}

          {/* Important Questions Section */}
          <div className="glass-card p-8 border-white/5 bg-secondary/5">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">bolt</span>
                  Important Questions
                </h3>
                <button 
                  onClick={handleGenerateImportant}
                  disabled={generatingImportant}
                  className="px-4 py-2 bg-secondary text-on-secondary rounded-lg text-xs font-bold hover:scale-105 transition-all disabled:opacity-50"
                >
                  {generatingImportant ? 'Analyzing...' : 'Generate High-Yield Questions'}
                </button>
             </div>
             
             {importantQuestions ? (
               <div className="space-y-4">
                 {importantQuestions.map((q, i) => (
                   <div key={q.id} className="p-4 bg-white/5 rounded-xl border border-white/10">
                     <p className="text-white font-medium mb-3">{i+1}. {q.question}</p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Object.entries(q.options).map(([key, val]) => (
                          <div key={key} className={`p-2 rounded-lg text-xs ${key === q.correct_answer ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-black/20 text-white/60'}`}>
                            <span className="font-bold mr-2">{key}:</span> {val}
                          </div>
                        ))}
                     </div>
                     {q.explanation && <p className="mt-3 text-[10px] text-white/40 italic">Insight: {q.explanation}</p>}
                   </div>
                 ))}
               </div>
             ) : (
               <p className="text-white/40 text-sm text-center py-4">Click generate to see high-yield questions based on exam patterns.</p>
             )}
          </div>
        </section>

        {/* Right Section: AI Assistant */}
        <aside className="w-full lg:w-[400px] flex flex-col gap-4 sticky top-8 h-[calc(100vh-100px)]">
           <div className="glass-card flex flex-col h-full overflow-hidden border-white/5 bg-[#1e1e32]/50">
              <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                    <span className="material-symbols-outlined text-primary text-sm fill">auto_awesome</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">Shiro Assistant</h3>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                      <span className="text-[#cfc2d7] text-[10px] uppercase font-bold tracking-widest">Active Insight</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-hide">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 max-w-[90%] ${msg.isUser ? 'self-end flex-row-reverse' : 'self-start'}`}>
                    <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-1 ${msg.isUser ? 'bg-primary/20' : 'bg-white/5 border border-white/10'}`}>
                      <span className="material-symbols-outlined text-[12px]">{msg.isUser ? 'person' : 'auto_awesome'}</span>
                    </div>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed ${msg.isUser ? 'bg-primary text-on-primary rounded-tr-none' : 'bg-white/5 text-white border border-white/5 rounded-tl-none whitespace-pre-wrap'}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                {aiLoading && <div className="self-start flex gap-1 p-2"><span className="w-1 h-1 bg-primary rounded-full animate-bounce"></span><span className="w-1 h-1 bg-primary rounded-full animate-bounce delay-100"></span><span className="w-1 h-1 bg-primary rounded-full animate-bounce delay-200"></span></div>}
              </div>

              <div className="p-4 bg-white/5 border-t border-white/5">
                <div className="relative flex items-center bg-black/20 rounded-xl border border-white/10 focus-within:border-primary/50 transition-all p-1">
                  <input 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                    className="w-full bg-transparent border-none text-white text-xs py-2.5 px-3 outline-none" 
                    placeholder="Ask Shiro about this doc..." 
                  />
                  <button onClick={handleChatSend} className="p-2 text-primary hover:text-white transition-colors bg-primary/10 rounded-lg">
                    <span className="material-symbols-outlined text-sm fill">send</span>
                  </button>
                </div>
              </div>
           </div>
        </aside>
      </main>
    </div>
  );
};

export default DocumentDetailsPage;
