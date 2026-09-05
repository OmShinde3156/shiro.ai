import { fetchWithAuth } from '../../api/fetchWithAuth';
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Context } from '../../context/Context';
import API_BASE_URL from '../../api/config.js';
import { streamChat } from '../../api/chatStream.js';
import toast from 'react-hot-toast';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const DocumentDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [document, setDocument] = useState(null);
  const [docProfile, setDocProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isReading, setIsReading] = useState(false);
  
  // AI Assistant State
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { text: "I've analyzed this document. Ask me anything, or click a quick prompt below to begin.", isUser: false }
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState("");
  const [generatingImportant, setGeneratingImportant] = useState(false);
  const [importantQuestions, setImportantQuestions] = useState(null);

  // Magic Text Selection State
  const [selection, setSelection] = useState({ text: "", x: 0, y: 0, visible: false });
  const rawContentRef = useRef(null);

  useEffect(() => {
    const fetchDocumentAndProfile = async () => {
      if (user && user.id) {
        try {
          const [docRes, profRes] = await Promise.all([
            fetchWithAuth(`${API_BASE_URL}/documents/${id}`),
            fetchWithAuth(`${API_BASE_URL}/documents/${id}/profile`)
          ]);

          if (docRes.ok) {
            const data = await docRes.json();
            setDocument(data);
            
            // Proactive suggestion for Video Sources
            if (data.file_type === 'youtube' || data.video_id) {
              setChatMessages([
                { text: `I've analyzed the content of this YouTube video: **"${data.filename}"**. I've extracted the core concepts below, but for a deeper visual understanding, I highly recommend watching the original video as well.`, isUser: false },
                { text: "What would you like to focus on first? I can calculate your study time, generate a quiz, create study cards, or explain specific parts.", isUser: false }
              ]);
            }
          } else {
            setError('Failed to fetch document details');
          }

          if (profRes.ok) {
            const pData = await profRes.json();
            setDocProfile(pData);
          }
        } catch (err) {
          setError('An error occurred while fetching the document');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchDocumentAndProfile();
  }, [id, user]);

  const handleTextSelection = () => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText && selectedText.length > 5) {
      const range = window.getSelection().getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelection({
        text: selectedText,
        x: Math.max(10, rect.left + (rect.width / 2) - 100),
        y: Math.max(10, rect.top - 48),
        visible: true
      });
    } else {
      setSelection(prev => ({ ...prev, visible: false }));
    }
  };

  const handleMagicAction = (action) => {
    const textToProcess = selection.text;
    setSelection(prev => ({ ...prev, visible: false }));
    if (!textToProcess) return;

    if (action === 'explain') {
      handleChatSend(`Explain this excerpt simply:\n"${textToProcess}"`, textToProcess);
    } else if (action === 'quiz') {
      handleChatSend(`Generate 2 quick practice questions based on:\n"${textToProcess}"`, textToProcess);
    } else if (action === 'copy') {
      navigator.clipboard.writeText(textToProcess);
      toast.success("Snippet copied to clipboard!");
    }
  };

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

  const handleChatSend = async (overridePrompt = null, selectedSnippet = null) => {
    const promptText = overridePrompt || chatInput;
    if (!promptText.trim()) return;

    const userMsg = { text: promptText, isUser: true };
    setChatMessages(prev => [...prev, userMsg, { text: "", isUser: false, isLoading: true }]);
    if (!overridePrompt) setChatInput("");
    setAiLoading(true);
    setAiStatus("Connecting with document context...");

    try {
      await streamChat({
        prompt: promptText,
        language: "en",
        userId: user?.id || 1,
        documentIds: [parseInt(id)],
        activeDocumentId: parseInt(id),
        contextScope: "DOCUMENT",
        selectedText: selectedSnippet,
        mode: "human",
        onStatus: (statusPayload) => {
          setAiStatus(statusPayload.step);
        },
        onToken: (tokenDelta) => {
          setChatMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && !last.isUser) {
              last.text = (last.text || "") + tokenDelta;
              last.isLoading = false;
            }
            return next;
          });
        },
        onError: (err) => {
          setChatMessages(prev => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last && !last.isUser && !last.text) {
              last.text = `Error: ${err.message || "Failed to generate response."}`;
              last.isLoading = false;
            }
            return next;
          });
        },
        onDone: () => {
          setAiLoading(false);
          setAiStatus("");
        }
      });
    } catch (err) {
      console.error("AI Assistant error:", err);
      setChatMessages(prev => [...prev, { text: "Error connecting to Shiro AI.", isUser: false }]);
      setAiLoading(false);
      setAiStatus("");
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
      {/* Floating Magic Selection Pill Toolbar */}
      {selection.visible && (
        <div
          style={{ position: 'fixed', top: `${selection.y}px`, left: `${selection.x}px`, zIndex: 9999 }}
          className="flex items-center gap-1 bg-[var(--bg-surface-elevated)] border border-[#3F6048]/40 shadow-xl rounded-full px-2 py-1 backdrop-blur-md animate-fade-in"
        >
          <button
            onClick={() => handleMagicAction('explain')}
            className="flex items-center gap-1 text-[11px] font-bold text-[#3F6048] dark:text-[#A8C5AC] hover:bg-[#3F6048]/15 px-2 py-1 rounded-full transition-all"
          >
            <span className="material-symbols-outlined text-xs">auto_awesome</span>
            Explain
          </button>
          <button
            onClick={() => handleMagicAction('quiz')}
            className="flex items-center gap-1 text-[11px] font-bold text-[#D6A84F] hover:bg-[#D6A84F]/15 px-2 py-1 rounded-full transition-all"
          >
            <span className="material-symbols-outlined text-xs">quiz</span>
            Quiz
          </button>
          <button
            onClick={() => handleMagicAction('copy')}
            className="flex items-center gap-1 text-[11px] font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] px-2 py-1 rounded-full transition-all"
          >
            <span className="material-symbols-outlined text-xs">content_copy</span>
            Copy
          </button>
        </div>
      )}

      <main className="max-w-[1600px] mx-auto p-3.5 sm:p-6 md:p-8 flex flex-col lg:flex-row gap-6 md:gap-8">
        
        {/* Left Section: Document & Actions */}
        <section className="flex-1 flex flex-col gap-6 min-w-0">
          
          {/* Header Card */}
          <div className="glass-card relative overflow-hidden p-4 sm:p-6 border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
            <div className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-6">
              <div className="flex items-start gap-3 sm:gap-4 min-w-0">
                <button onClick={() => navigate('/documents')} aria-label="Go back to library" className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex items-center justify-center hover:bg-[var(--bg-surface-hover)] transition-all shrink-0 text-[var(--text-secondary)] active:scale-95">
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                </button>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1.5">
                    <span className="bg-[#3F6048]/15 text-[#3F6048] dark:text-[#A8C5AC] px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-[#3F6048]/30 font-mono">
                      {document?.subject || 'General'}
                    </span>
                    <span className="text-[var(--text-muted)] text-[11px] sm:text-xs uppercase font-bold tracking-widest font-mono">
                      Uploaded {document?.upload_date ? new Date(document.upload_date).toLocaleDateString() : ''}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl md:text-3xl font-bold font-serif text-[var(--text-main)] tracking-tight leading-tight truncate">{document?.filename}</h2>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0">
                <button 
                  onClick={() => handleChatSend("Please extract a comprehensive, structured Formula & Core Concept Cheatsheet from this document with mathematical LaTeX equations, definitions, and key exam takeaways.")}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--bg-surface-elevated)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border)] hover:border-[#89A88D]/50 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                  title="Generate LaTeX Formula & Concept Cheatsheet"
                >
                  <span className="material-symbols-outlined text-base text-[#D6A84F]">functions</span>
                  Formula Sheet
                </button>
                <button 
                  onClick={() => navigate('/answer-planner', { state: { documentId: document?.id, subject: document?.subject } })}
                  className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--bg-surface-elevated)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border)] hover:border-[#89A88D]/50 transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                  title="Plan University Exam Answers"
                >
                  <span className="material-symbols-outlined text-base text-[#89A88D]">assignment</span>
                  Exam Blueprint
                </button>
                <button onClick={handleReadAloud} className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${isReading ? 'bg-[#3F6048] text-white' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border)]'}`}>
                  <span className="material-symbols-outlined text-base">{isReading ? 'stop' : 'volume_up'}</span>
                  {isReading ? 'Stop' : 'Listen'}
                </button>
                <button onClick={() => navigate('/study-rooms', { state: { documentId: document?.id } })} className="flex-1 sm:flex-none bg-[#3F6048] hover:bg-[#34523D] dark:bg-[#89A88D] dark:text-black text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-base">school</span>
                  Study Room
                </button>
              </div>
            </div>
          </div>

          {/* Document Learning Profile Banner (Instant Cognitive Profiling) */}
          {docProfile && (
            <div className="glass-card p-4 sm:p-5 border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold text-[#3F6048] dark:text-[#A8C5AC] mb-3 font-mono uppercase tracking-wider">
                <span className="material-symbols-outlined text-base">timer</span>
                Study Effort & Knowledge Profile
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] font-mono">Word Count</span>
                  <p className="text-base sm:text-lg font-bold text-[var(--text-main)] mt-0.5">~{docProfile.word_count}</p>
                </div>
                <div className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] font-mono">Quick Read</span>
                  <p className="text-base sm:text-lg font-bold text-[var(--text-main)] mt-0.5">{docProfile.reading_time_mins} mins</p>
                </div>
                <div className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] font-mono">Deep Mastery</span>
                  <p className="text-base sm:text-lg font-bold text-[#3F6048] dark:text-[#A8C5AC] mt-0.5">{docProfile.deep_study_time_mins} mins</p>
                </div>
                <div className="p-3 bg-[var(--bg-surface-elevated)] rounded-xl border border-[var(--border)]">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] font-mono">Difficulty</span>
                  <p className="text-base sm:text-lg font-bold text-[#D6A84F] mt-0.5">{docProfile.difficulty}</p>
                </div>
              </div>
              {docProfile.key_topics?.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[var(--text-muted)] font-mono mr-1">Focus Topics:</span>
                  {docProfile.key_topics.map((t, idx) => (
                    <span key={idx} className="px-2.5 py-0.5 rounded-full bg-[#3F6048]/10 text-[#3F6048] dark:text-[#A8C5AC] border border-[#3F6048]/20 text-[11px] font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Visual Suggestion Card */}
          {(document?.video_id || document?.source_url) && (
            <div className="glass-card relative overflow-hidden p-4 sm:p-6 border-[var(--border)] bg-[var(--bg-surface)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-6 shadow-sm">
               <div className="flex items-center gap-3 sm:gap-4 relative z-10">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-[#D6A84F]/15 flex items-center justify-center text-[#D6A84F] border border-[#D6A84F]/30 shadow-sm shrink-0">
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
                className="relative z-10 flex items-center justify-center gap-2 bg-[#3F6048] text-white dark:bg-[#89A88D] dark:text-black px-4 sm:px-5 py-2.5 rounded-xl text-xs font-bold hover:scale-[1.02] active:scale-95 transition-all shadow-sm whitespace-nowrap w-full sm:w-auto"
               >
                  <span className="material-symbols-outlined text-base">open_in_new</span>
                  Watch Original Video
               </a>
            </div>
          )}

          {/* Action Bento Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
            <button onClick={() => navigate('/quiz', { state: { documentId: document?.id } })} className="group glass-card p-5 sm:p-6 border-[var(--border)] bg-[var(--bg-surface)] hover:border-[#3F6048] transition-all text-left relative overflow-hidden h-32 sm:h-36 flex flex-col justify-between shadow-sm active:scale-[0.98]">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#3F6048]/15 flex items-center justify-center text-[#3F6048] dark:text-[#89A88D] group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-xl">school</span>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] font-serif">Quick Quiz</h3>
                <p className="text-[var(--text-secondary)] text-xs mt-0.5">Test your memory.</p>
              </div>
            </button>

            <button onClick={() => navigate('/flashcards', { state: { documentId: document?.id } })} className="group glass-card p-5 sm:p-6 border-[var(--border)] bg-[var(--bg-surface)] hover:border-[#3F6048] transition-all text-left relative overflow-hidden h-32 sm:h-36 flex flex-col justify-between shadow-sm active:scale-[0.98]">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#3F6048]/15 flex items-center justify-center text-[#3F6048] dark:text-[#89A88D] group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-xl">style</span>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] font-serif">Study Cards</h3>
                <p className="text-[var(--text-secondary)] text-xs mt-0.5">Key terms & recall.</p>
              </div>
            </button>

            <button onClick={() => navigate('/mindmap', { state: { documentId: document?.id } })} className="group glass-card p-5 sm:p-6 border-[var(--border)] bg-[var(--bg-surface)] hover:border-[#3F6048] transition-all text-left relative overflow-hidden h-32 sm:h-36 flex flex-col justify-between shadow-sm active:scale-[0.98]">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#3F6048]/15 flex items-center justify-center text-[#3F6048] dark:text-[#89A88D] group-hover:scale-110 transition-transform">
                <span className="material-symbols-outlined text-xl">hub</span>
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] font-serif">Mind Map</h3>
                <p className="text-[var(--text-secondary)] text-xs mt-0.5">Visual knowledge web.</p>
              </div>
            </button>
          </div>

          {/* Document Content View (With Magic Highlight Listening) */}
          <div className="glass-card p-5 sm:p-8 border-[var(--border)] bg-[var(--bg-surface)] min-h-[300px] shadow-sm relative">
             <div className="flex items-center justify-between mb-4">
               <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] font-serif flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#3F6048] dark:text-[#89A88D]">description</span>
                  Raw Content & Excerpts
               </h3>
               <span className="text-[11px] text-[var(--text-muted)] font-mono">
                 💡 Tip: Highlight any text to explain or quiz
               </span>
             </div>
             <div 
               ref={rawContentRef}
               onMouseUp={handleTextSelection}
               onTouchEnd={handleTextSelection}
               className="max-w-none text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed text-sm overflow-x-auto selection:bg-[#3F6048]/25 selection:text-[var(--text-main)]"
             >
                {document?.text_content || "*No content could be extracted from this document.*"}
             </div>
          </div>

          {/* Summary Section (if exists) */}
          {document?.summary && (
            <div className="glass-card p-5 sm:p-8 border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] font-serif mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#3F6048] dark:text-[#89A88D]">auto_awesome</span>
                AI Summary
              </h3>
              <div className="prose max-w-none text-[var(--text-main)] overflow-x-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{document.summary.summary_text}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Latest Quiz Section (if exists) */}
          {document?.quiz && (
            <div className="glass-card p-5 sm:p-8 border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] font-serif flex items-center gap-2">
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
            <div className="glass-card p-5 sm:p-8 border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] font-serif flex items-center gap-2">
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
          <div className="glass-card p-5 sm:p-8 border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
             <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] font-serif flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#D6A84F]">bolt</span>
                    High-Yield Exam Questions
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Curated semester & competitive exam questions with marking points and model summaries.
                  </p>
                </div>
                <button 
                  onClick={handleGenerateImportant}
                  disabled={generatingImportant}
                  className="px-4 py-2 bg-[#3F6048] text-white dark:bg-[#89A88D] dark:text-black rounded-lg text-xs font-bold hover:scale-105 transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">psychology</span>
                  {generatingImportant ? 'Analyzing Exam Patterns...' : 'Generate High-Yield Questions'}
                </button>
             </div>
             
             {importantQuestions ? (
               <div className="space-y-4">
                 {importantQuestions.map((q, i) => (
                   <div key={q.id || i} className="p-4 sm:p-5 bg-[var(--bg-surface-elevated)] rounded-2xl border border-[var(--border)] space-y-3">
                     <div className="flex flex-wrap items-center justify-between gap-2">
                       <div className="flex flex-wrap items-center gap-2">
                         <span className="px-2.5 py-0.5 rounded-full bg-[#D6A84F]/15 text-[#D6A84F] border border-[#D6A84F]/30 text-[10px] font-bold uppercase font-mono">
                           {q.importance || 'High Yield'}
                         </span>
                         <span className="px-2 py-0.5 rounded-full bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border)] text-[10px] font-mono">
                           {q.category || 'Core Concept'}
                         </span>
                         <span className="px-2 py-0.5 rounded-full bg-[#3F6048]/15 text-[#3F6048] dark:text-[#A8C5AC] border border-[#3F6048]/30 text-[10px] font-mono">
                           {q.estimated_marks || '5-10 Marks'}
                         </span>
                       </div>
                       <button
                         onClick={() => handleChatSend(`Please provide a step-by-step complete model answer with diagrams/formulas for this exam question:\n"${q.question}"`)}
                         className="text-[11px] font-bold text-[#3F6048] dark:text-[#A8C5AC] hover:underline flex items-center gap-1"
                       >
                         <span className="material-symbols-outlined text-xs">auto_awesome</span>
                         Explain Answer
                       </button>
                     </div>

                     <p className="text-[var(--text-main)] font-semibold text-sm sm:text-base leading-snug">
                       <span className="text-[#3F6048] dark:text-[#89A88D] font-mono mr-1.5 font-bold">Q{i+1}.</span>
                       {q.question}
                     </p>

                     {q.key_points && Array.isArray(q.key_points) && q.key_points.length > 0 && (
                       <div className="p-3 bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]">
                         <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] font-mono tracking-wider block mb-1.5">
                           Key Points Required for Full Marks:
                         </span>
                         <ul className="space-y-1 text-xs text-[var(--text-secondary)] list-disc list-inside">
                           {q.key_points.map((pt, pIdx) => (
                             <li key={pIdx} className="leading-relaxed">{pt}</li>
                           ))}
                         </ul>
                       </div>
                     )}

                     {q.model_answer_summary && (
                       <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                         <strong className="text-[var(--text-main)]">Model Answer Summary: </strong>
                         {q.model_answer_summary}
                       </p>
                     )}

                     {q.exam_insight && (
                       <div className="flex items-start gap-1.5 text-[11px] text-[#D6A84F] bg-[#D6A84F]/10 p-2.5 rounded-lg border border-[#D6A84F]/20">
                         <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">tips_and_updates</span>
                         <span><strong>Examiner Insight: </strong>{q.exam_insight}</span>
                       </div>
                     )}
                   </div>
                 ))}
               </div>
             ) : (
               <div className="text-center py-8 text-[var(--text-muted)] text-sm space-y-1">
                 <span className="material-symbols-outlined text-3xl text-[var(--text-muted)] mb-1">query_stats</span>
                 <p>Click "Generate High-Yield Questions" to extract predictive exam questions & key answering strategies.</p>
               </div>
             )}
          </div>
        </section>

        {/* Right Section: AI Assistant (Scoped to Active Document) */}
        <aside className="w-full lg:w-[420px] flex flex-col gap-4 lg:sticky lg:top-8 h-[580px] lg:h-[calc(100vh-100px)] shrink-0">
           <div className="glass-card flex flex-col h-full overflow-hidden border-[var(--border)] bg-[var(--bg-surface)] shadow-sm">
              <div className="p-4 bg-[var(--bg-surface-elevated)] border-b border-[var(--border)] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#3F6048]/15 flex items-center justify-center border border-[#3F6048]/30">
                    <span className="material-symbols-outlined text-[#3F6048] dark:text-[#89A88D] text-sm fill">auto_awesome</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[var(--text-main)] font-serif">Document Copilot</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#3F6048] dark:bg-[#89A88D] animate-pulse"></div>
                      <span className="text-[var(--text-muted)] text-[10px] font-bold uppercase tracking-widest font-mono truncate max-w-[200px]">
                        {document?.filename || "Active Document"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Document Profiling Pills */}
              <div className="p-2.5 bg-[var(--bg-surface)] border-b border-[var(--border)] flex flex-wrap gap-1.5">
                <button
                  onClick={() => handleChatSend("Please extract all formulas, mathematical theorems, and core equations from this document formatted in clean KaTeX with explanation of variables.")}
                  className="px-2.5 py-1 rounded-full bg-[var(--bg-surface-elevated)] hover:bg-[#D6A84F]/15 text-[10.5px] font-medium text-[var(--text-secondary)] hover:text-[#D6A84F] border border-[var(--border)] transition-all flex items-center gap-1"
                >
                  <span>📐</span> Formulas
                </button>
                <button
                  onClick={() => handleChatSend("Generate a high-scoring 10-mark university model answer based on the most important topic in this document, complete with introduction, structured points, and conclusion.")}
                  className="px-2.5 py-1 rounded-full bg-[var(--bg-surface-elevated)] hover:bg-[#3F6048]/15 text-[10.5px] font-medium text-[var(--text-secondary)] hover:text-[#3F6048] dark:hover:text-[#A8C5AC] border border-[var(--border)] transition-all flex items-center gap-1"
                >
                  <span>📝</span> 10-Mark Answer
                </button>
                <button
                  onClick={() => handleChatSend("How much time will it take to study this document and what are the main sections?")}
                  className="px-2.5 py-1 rounded-full bg-[var(--bg-surface-elevated)] hover:bg-[#3F6048]/15 text-[10.5px] font-medium text-[var(--text-secondary)] hover:text-[#3F6048] dark:hover:text-[#A8C5AC] border border-[var(--border)] transition-all flex items-center gap-1"
                >
                  <span>⏱️</span> Study Time
                </button>
                <button
                  onClick={() => handleChatSend("What are the most important recurring exam topics in this document?")}
                  className="px-2.5 py-1 rounded-full bg-[var(--bg-surface-elevated)] hover:bg-[#3F6048]/15 text-[10.5px] font-medium text-[var(--text-secondary)] hover:text-[#3F6048] dark:hover:text-[#A8C5AC] border border-[var(--border)] transition-all flex items-center gap-1"
                >
                  <span>🎯</span> Key Topics
                </button>
                <button
                  onClick={() => handleChatSend("Explain the core premise of this document in simple words with intuitive examples (Feynman technique).")}
                  className="px-2.5 py-1 rounded-full bg-[var(--bg-surface-elevated)] hover:bg-[#3F6048]/15 text-[10.5px] font-medium text-[var(--text-secondary)] hover:text-[#3F6048] dark:hover:text-[#A8C5AC] border border-[var(--border)] transition-all flex items-center gap-1"
                >
                  <span>💡</span> Explain Simply
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scroll touch-scroll">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex gap-3 max-w-[92%] ${msg.isUser ? 'self-end flex-row-reverse' : 'self-start'}`}>
                    <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-1 ${msg.isUser ? 'bg-[#3F6048]/20 text-[#3F6048]' : 'bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[var(--text-secondary)]'}`}>
                      <span className="material-symbols-outlined text-[12px]">{msg.isUser ? 'person' : 'auto_awesome'}</span>
                    </div>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed ${msg.isUser ? 'bg-[#3F6048] text-white rounded-tr-none' : 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border border-[var(--border)] rounded-tl-none whitespace-pre-wrap'}`}>
                      {msg.isLoading && !msg.text ? (
                        <div className="flex items-center gap-2 text-[var(--text-muted)] text-[11px] py-1">
                          <span className="w-1.5 h-1.5 bg-[#3F6048] rounded-full animate-ping"></span>
                          <span>{aiStatus || "Analyzing document..."}</span>
                        </div>
                      ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{msg.text}</ReactMarkdown>
                      )}
                    </div>
                  </div>
                ))}
                {aiLoading && (
                  <div className="self-start flex items-center gap-1 p-2 text-[11px] text-[var(--text-muted)] font-mono">
                    <span className="w-1 h-1 bg-[#3F6048] rounded-full animate-bounce"></span>
                    <span className="w-1 h-1 bg-[#3F6048] rounded-full animate-bounce delay-100"></span>
                    <span className="w-1 h-1 bg-[#3F6048] rounded-full animate-bounce delay-200"></span>
                    <span className="ml-1 text-[10px]">{aiStatus}</span>
                  </div>
                )}
              </div>

              <div className="p-3 sm:p-4 bg-[var(--bg-surface-elevated)] border-t border-[var(--border)]">
                <div className="relative flex items-center bg-[var(--bg-surface)] rounded-xl border border-[var(--border)] focus-within:border-[#3F6048] transition-all p-1">
                  <input 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                    className="w-full bg-transparent border-none text-[var(--text-main)] text-xs py-2 px-3 outline-none placeholder-[var(--text-muted)]" 
                    placeholder="Ask anything about this document..." 
                  />
                  <button onClick={() => handleChatSend()} aria-label="Send query" className="p-2 text-[#3F6048] hover:bg-[#3F6048]/10 transition-colors rounded-lg active:scale-95">
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

