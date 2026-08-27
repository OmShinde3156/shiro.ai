import { fetchWithAuth } from '../../api/fetchWithAuth';
import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Context } from '../../context/Context';
import API_BASE_URL from '../../api/config.js';
import runChat from '../../config/Gemini.js';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

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
          const response = await fetchWithAuth(`${API_BASE_URL}/documents/${id}`);
          if (response.ok) {
            const data = await response.json();
            setDocument(data);
            
            // Proactive AI Suggestion for Video Sources
            if (data.file_type === 'youtube' || data.video_id) {
              setChatMessages([
                { text: `I've analyzed the content of this YouTube video: **"${data.filename}"**. I've extracted the core concepts below, but for a deeper visual understanding, I highly recommend watching the original video as well.`, isUser: false },
                { text: "What would you like to focus on first? I can generate a quiz, create study cards, or explain specific parts.", isUser: false }
              ]);
            }
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

      const response = await fetchWithAuth(`${API_BASE_URL}/api/important-questions/generate`, {
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
      return;
    }

    setIsReading(true);
    try {
      const textToRead = document.text_content ? document.text_content.substring(0, 2000) : "No text available.";
      const response = await fetchWithAuth(`${API_BASE_URL}/speak`, {
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
    <div className="min-h-screen bg-[var(--bg-canvas)] flex items-center justify-center">
      <div className="w-12 h-12 border-3 border-[#3F6048]/20 border-t-[#3F6048] rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)] text-[var(--text-main)] font-body">
      <main className="max-w-[1600px] mx-auto p-4 md:p-8 flex flex-col lg:flex-row gap-8">
        
        {/* Left Section: Document & Actions */}
        <section className="flex-1 flex flex-col gap-6">
          
          {/* Header Card */}
          <div className="glass-card relative overflow-hidden p-6 border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
            <div className="relative z-10 flex flex-col md:flex-row justify-between gap-6">
              <div className="flex gap-4">
                <button onClick={() => navigate('/documents')} className="w-10 h-10 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex items-center justify-center hover:bg-[var(--bg-surface-hover)] transition-all shrink-0 text-[var(--text-secondary)]">
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-[#3F6048]/15 text-[#3F6048] dark:text-[#A8C5AC] px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border border-[#3F6048]/30 font-mono">
                      {document?.subject || 'General'}
                    </span>
                    <span className="text-[var(--text-muted)] text-xs uppercase font-bold tracking-widest font-mono">
                      Uploaded {document?.upload_date ? new Date(document.upload_date).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold font-serif text-[var(--text-main)] tracking-tight leading-tight">{document?.filename}</h2>
                </div>
              </div>
              <div className="flex gap-3 h-fit">
                <button onClick={handleReadAloud} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${isReading ? 'bg-[#3F6048] text-white' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border)]'}`}>
                  <span className="material-symbols-outlined text-lg">{isReading ? 'stop' : 'volume_up'}</span>
                  {isReading ? 'Stop' : 'Listen'}
                </button>
                <button onClick={() => navigate('/study-rooms', { state: { documentId: document?.id } })} className="bg-[#3F6048] hover:bg-[#34523D] dark:bg-[#89A88D] dark:text-black text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm hover:scale-105 transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">school</span>
                  Study Room
                </button>
              </div>
            </div>
          </div>

          {/* Visual Suggestion Card */}
          {(document?.video_id || document?.source_url) && (
            <div className="glass-card relative overflow-hidden p-6 border-[var(--border)] bg-[var(--bg-surface)] flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm">
               <div className="flex items-center gap-4 relative z-10">
                  <div className="w-12 h-12 rounded-2xl bg-[#D6A84F]/15 flex items-center justify-center text-[#D6A84F] border border-[#D6A84F]/30 shadow-sm">
                     <span className="material-symbols-outlined text-2xl">play_circle</span>
                  </div>
                  <div>
                     <h3 className="text-base font-bold text-[var(--text-main)] font-serif mb-0.5">Shiro's Visual Suggestion</h3>
                     <p className="text-[var(--text-secondary)] text-xs max-w-md">I've analyzed the core concepts, but watching the original video will give you the full visual context and deeper intuition.</p>
                  </div>
               </div>
               <a 
                href={document.source_url || `https://www.youtube.com/watch?v=${document.video_id}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="relative z-10 flex items-center gap-2 bg-[#3F6048] text-white dark:bg-[#89A88D] dark:text-black px-5 py-2.5 rounded-xl text-xs font-bold hover:scale-105 transition-all shadow-sm whitespace-nowrap"
               >
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                  Watch Original Video
               </a>
            </div>
          )}

          {/* Action Bento Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button onClick={() => navigate('/quiz', { state: { documentId: document?.id } })} className="group glass-card p-6 border-[var(--border)] bg-[var(--bg-surface)] hover:border-[#3F6048] transition-all text-left relative overflow-hidden h-36 flex flex-col justify-between shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#3F6048]/15 flex items-center justify-center text-[#3F6048] dark:text-[#89A88D] group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-xl">school</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text-main)] font-serif">Quick Quiz</h3>
                <p className="text-[var(--text-secondary)] text-xs mt-0.5">Test your memory.</p>
              </div>
            </button>

            <button onClick={() => navigate('/flashcards', { state: { documentId: document?.id } })} className="group glass-card p-6 border-[var(--border)] bg-[var(--bg-surface)] hover:border-[#3F6048] transition-all text-left relative overflow-hidden h-36 flex flex-col justify-between shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#3F6048]/15 flex items-center justify-center text-[#3F6048] dark:text-[#89A88D] group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-xl">style</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text-main)] font-serif">Study Cards</h3>
                <p className="text-[var(--text-secondary)] text-xs mt-0.5">Key terms & recall.</p>
              </div>
            </button>

            <button onClick={() => navigate('/mindmap', { state: { documentId: document?.id } })} className="group glass-card p-6 border-[var(--border)] bg-[var(--bg-surface)] hover:border-[#3F6048] transition-all text-left relative overflow-hidden h-36 flex flex-col justify-between shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#3F6048]/15 flex items-center justify-center text-[#3F6048] dark:text-[#89A88D] group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-xl">hub</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-[var(--text-main)] font-serif">Mind Map</h3>
                <p className="text-[var(--text-secondary)] text-xs mt-0.5">Visual knowledge web.</p>
              </div>
            </button>
          </div>

          {/* Document Content View */}
          <div className="glass-card p-8 border-[var(--border)] bg-[var(--bg-surface)] min-h-[300px] shadow-sm">
             <h3 className="text-lg font-bold text-[var(--text-main)] font-serif mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3F6048] dark:text-[#89A88D]">description</span>
                Raw Content
             </h3>
             <div className="max-w-none text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed text-sm">
                {document?.text_content || "*No content could be extracted from this document.*"}
             </div>
          </div>

          {/* Summary Section (if exists) */}
          {document?.summary && (
            <div className="glass-card p-8 border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <h3 className="text-lg font-bold text-[var(--text-main)] font-serif mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3F6048] dark:text-[#89A88D]">auto_awesome</span>
                AI Summary
              </h3>
              <div className="prose max-w-none text-[var(--text-main)]">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{document.summary.summary_text}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Latest Quiz Section (if exists) */}
          {document?.quiz && (
            <div className="glass-card p-8 border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-[var(--text-main)] font-serif flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#3F6048] dark:text-[#89A88D]">quiz</span>
                  Latest Quiz
                </h3>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] font-mono">
                  {document.quiz.questions?.length} Questions • {document.quiz.difficulty}
                </span>
              </div>
              <div className="space-y-3">
                {document.quiz.questions?.slice(0, 3).map((q, i) => (
                  <div key={i} className="p-4 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border)]">
                    <p className="text-sm text-[var(--text-main)] font-medium">{q.question}</p>
                  </div>
                ))}
                {document.quiz.questions?.length > 3 && (
                  <button onClick={() => navigate('/quiz', { state: { documentId: id } })} className="text-xs font-bold text-[#3F6048] dark:text-[#89A88D] hover:underline font-mono">
                    View all questions...
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Knowledge Graph / Mindmap Preview (if exists) */}
          {document?.mindmap && (
            <div className="glass-card p-8 border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-[var(--text-main)] font-serif flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#3F6048] dark:text-[#89A88D]">hub</span>
                  Knowledge Web
                </h3>
                <button 
                  onClick={() => navigate('/mindmap', { state: { documentId: id } })}
                  className="px-4 py-2 bg-[#3F6048]/15 text-[#3F6048] dark:text-[#A8C5AC] border border-[#3F6048]/30 rounded-lg text-xs font-bold hover:bg-[#3F6048]/25 transition-all"
                >
                  View Interactive Map
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {document.mindmap.nodes?.slice(0, 12).map((node, i) => (
                  <span key={i} className="px-3 py-1 bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-full text-[10px] text-[var(--text-secondary)]">
                    {node.label}
                  </span>
                ))}
                {document.mindmap.nodes?.length > 12 && <span className="text-[10px] text-[var(--text-muted)] self-center">+{document.mindmap.nodes.length - 12} more nodes</span>}
              </div>
            </div>
          )}

          {/* Important Questions Section */}
          <div className="glass-card p-8 border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-[var(--text-main)] font-serif flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#D6A84F]">bolt</span>
                  Important Questions
                </h3>
                <button 
                  onClick={handleGenerateImportant}
                  disabled={generatingImportant}
                  className="px-4 py-2 bg-[#3F6048] text-white dark:bg-[#89A88D] dark:text-black rounded-lg text-xs font-bold hover:scale-105 transition-all disabled:opacity-50"
                >
                  {generatingImportant ? 'Analyzing...' : 'Generate High-Yield Questions'}
                </button>
             </div>
             
             {importantQuestions ? (
               <div className="space-y-4">
                 {importantQuestions.map((q, i) => (
                   <div key={q.id} className="p-4 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border)]">
                     <p className="text-[var(--text-main)] font-medium mb-3">{i+1}. {q.question}</p>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {Object.entries(q.options).map(([key, val]) => (
                          <div key={key} className={`p-2 rounded-lg text-xs ${key === q.correct_answer ? 'bg-[#3F6048]/15 text-[#3F6048] dark:text-[#A8C5AC] border border-[#3F6048]/30 font-semibold' : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)]'}`}>
                            <span className="font-bold mr-2">{key}:</span> {val}
                          </div>
                        ))}
                     </div>
                     {q.explanation && <p className="mt-3 text-[10px] text-[var(--text-muted)] italic">Insight: {q.explanation}</p>}
                   </div>
                 ))}
               </div>
             ) : (
               <p className="text-[var(--text-muted)] text-sm text-center py-4">Click generate to see high-yield questions based on exam patterns.</p>
             )}
          </div>
        </section>

        {/* Right Section: AI Assistant */}
        <aside className="w-full lg:w-[400px] flex flex-col gap-4 sticky top-8 h-[calc(100vh-100px)]">
           <div className="glass-card flex flex-col h-full overflow-hidden border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="p-4 bg-[var(--bg-surface-elevated)] border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#3F6048]/15 flex items-center justify-center border border-[#3F6048]/30">
                    <span className="material-symbols-outlined text-[#3F6048] dark:text-[#89A88D] text-sm fill">auto_awesome</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[var(--text-main)] font-serif">Shiro Assistant</h3>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#3F6048] dark:bg-[#89A88D] animate-pulse"></div>
                      <span className="text-[var(--text-muted)] text-[10px] uppercase font-bold tracking-widest font-mono">Active Insight</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-hide">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 max-w-[90%] ${msg.isUser ? 'self-end flex-row-reverse' : 'self-start'}`}>
                    <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-1 ${msg.isUser ? 'bg-[#3F6048]/20 text-[#3F6048]' : 'bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[var(--text-secondary)]'}`}>
                      <span className="material-symbols-outlined text-[12px]">{msg.isUser ? 'person' : 'auto_awesome'}</span>
                    </div>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed ${msg.isUser ? 'bg-[#3F6048] text-white rounded-tr-none' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border border-[var(--border)] rounded-tl-none whitespace-pre-wrap'}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                {aiLoading && <div className="self-start flex gap-1 p-2"><span className="w-1 h-1 bg-[#3F6048] rounded-full animate-bounce"></span><span className="w-1 h-1 bg-[#3F6048] rounded-full animate-bounce delay-100"></span><span className="w-1 h-1 bg-[#3F6048] rounded-full animate-bounce delay-200"></span></div>}
              </div>

              <div className="p-4 bg-[var(--bg-surface-elevated)] border-t border-[var(--border)]">
                <div className="relative flex items-center bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] focus-within:border-[#3F6048] transition-all p-1">
                  <input 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                    className="w-full bg-transparent border-none text-[var(--text-main)] text-xs py-2 px-3 outline-none placeholder-[var(--text-muted)]" 
                    placeholder="Ask Shiro about this doc..." 
                  />
                  <button onClick={handleChatSend} className="p-2 text-[#3F6048] hover:bg-[#3F6048]/10 transition-colors rounded-lg">
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
