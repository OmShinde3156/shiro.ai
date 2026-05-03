import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Context } from '../../context/Context';
import API_BASE_URL from '../../api/config.js';
import './StudyRoom.css';

const StudyRoom = () => {
  const { user } = useAuth();
  const { documents, fetchDocuments, onSent } = useContext(Context);
  const navigate = useNavigate();
  const location = useLocation();

  // State for Flashcards (Left Panel)
  const [flashcards, setFlashcards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);

  // State for Quiz (Right Panel)
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [score, setScore] = useState(0);

  // State for AI Tutor
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { text: "I notice you're diving into your materials. Need help explaining a specific concept?", isUser: false }
  ]);
  const [aiLoading, setAiLoading] = useState(false);

  const [selectedDocId, setSelectedDocId] = useState(location.state?.documentId || "");

  useEffect(() => {
    if (user?.id) fetchDocuments(user.id);
  }, [user]);

  useEffect(() => {
    if (documents?.length > 0 && !selectedDocId) {
      setSelectedDocId(documents[0].id);
    }
  }, [documents, selectedDocId]);

  const startSession = async () => {
    if (!selectedDocId) return;
    setFlashcardsLoading(true);
    setQuizLoading(true);

    try {
      // Fetch both flashcards and quiz in parallel
      const [fcRes, quizRes] = await Promise.all([
        fetch(`${API_BASE_URL}/generate-flashcards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_id: parseInt(selectedDocId), num_cards: 5 })
        }),
        fetch(`${API_BASE_URL}/generate-quiz`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_id: parseInt(selectedDocId), num_questions: 3, difficulty: "medium" })
        })
      ]);

      const fcData = await fcRes.json();
      const quizData = await quizRes.json();

      if (fcData.flashcards) setFlashcards(fcData.flashcards);
      if (quizData.questions) setQuizQuestions(quizData.questions);
    } catch (err) {
      console.error("Session start failed:", err);
    } finally {
      setFlashcardsLoading(false);
      setQuizLoading(false);
    }
  };

  const handleFlashcardRating = (rating) => {
    if (currentCardIndex < flashcards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  };

  const handleQuizSubmit = () => {
    const currentQ = quizQuestions[currentQuizIndex];
    if (selectedAnswer === currentQ.correct_answer) {
      setScore(prev => prev + 100);
    }
    if (currentQuizIndex < quizQuestions.length - 1) {
      setCurrentQuizIndex(prev => prev + 1);
      setSelectedAnswer(null);
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    const userMsg = { text: chatInput, isUser: true };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput("");
    setAiLoading(true);

    // Call onSent or a direct AI tutor endpoint
    try {
      // For now, use the context's onSent to get a response
      // This might need adjustment to stay in the "Study Room" context
      const responseText = await onSent("en", user?.id, [selectedDocId], "human", chatInput);
      setChatMessages(prev => [...prev, { text: responseText || "I'm analyzing that for you...", isUser: false }]);
    } catch (err) {
      console.error("AI Tutor error:", err);
    } finally {
      setAiLoading(false);
    }
  };

  if (!flashcards.length && !flashcardsLoading) {
    return (
      <div className="study-room-container flex items-center justify-center p-8">
        <div className="glass-panel p-10 rounded-3xl border border-white/5 max-w-lg w-full text-center">
          <h2 className="text-3xl font-bold mb-6 gradient-text">Enter Study Room</h2>
          <p className="text-white/60 mb-8">Select a document to begin an immersive, high-focus study session with AI-generated flashcards and quizzes.</p>
          <select 
            value={selectedDocId} 
            onChange={(e) => setSelectedDocId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white mb-6 outline-none focus:border-primary/50"
          >
            {documents?.map(doc => <option key={doc.id} value={doc.id}>{doc.filename}</option>)}
          </select>
          <button 
            onClick={startSession}
            disabled={!selectedDocId}
            className="w-full py-4 bg-gradient-to-br from-[#cc97ff] to-[#3adffa] text-white font-bold rounded-2xl hover:scale-105 transition-all shadow-[0_0_20px_rgba(204,151,255,0.3)]"
          >
            Launch Session
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="study-room-container font-body antialiased min-h-screen flex flex-col relative">
      <div className="ambient-light-leak top-[-10%] left-[-10%]"></div>
      <div className="ambient-light-leak bottom-[-20%] right-[30%] bg-[#3adffa]/5"></div>

      <header className="h-16 sticky top-0 z-40 bg-transparent flex justify-between items-center px-8 w-full backdrop-blur-md">
        <button onClick={() => navigate("/")} className="flex items-center gap-2 text-white/70 hover:text-[#3adffa] transition-colors group">
          <span className="material-symbols-outlined text-xl group-hover:-translate-x-1 transition-transform">arrow_back</span>
          <span className="font-label text-sm font-medium">Exit Study Session</span>
        </button>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/5">
            <span className="w-2 h-2 rounded-full bg-[#3adffa] animate-pulse shadow-[0_0_8px_rgba(58,223,250,0.6)]"></span>
            <span className="font-label text-xs font-medium text-[#3adffa]">Active Session</span>
          </div>
          <div className="h-4 w-px bg-white/10"></div>
          <span className="font-headline font-bold text-white tracking-tight">
            {documents.find(d => d.id === parseInt(selectedDocId))?.filename || "Study Session"}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button className="text-white/70 hover:text-[#3adffa] transition-colors"><span className="material-symbols-outlined">settings</span></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row p-6 gap-8 overflow-hidden">
        {/* LEFT PANEL: Flashcards */}
        <section className="flex-1 flex flex-col items-center justify-center relative bg-white/5 rounded-3xl border border-white/5 overflow-hidden p-8">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent"></div>
          
          <div className="w-full max-w-md flex flex-col gap-8 z-10">
            <div className="text-center space-y-2">
              <p className="font-headline text-sm font-bold text-[#3adffa] uppercase tracking-widest">Card {currentCardIndex + 1} of {flashcards.length}</p>
              <h2 className="font-headline text-2xl font-bold text-white tracking-tight">Recall Phase</h2>
            </div>

            <div className={`card-container h-80 w-full perspective-1000 ${isFlipped ? 'is-flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
              <div className="card-inner">
                <div className="card-front p-8 text-center bg-[#151926] border border-white/5 shadow-2xl">
                   <div className="absolute top-4 right-4 text-white/20"><span className="material-symbols-outlined">lightbulb</span></div>
                   <p className="text-lg text-white leading-relaxed">{flashcards[currentCardIndex]?.question}</p>
                   <p className="text-[10px] uppercase tracking-widest text-white/30 mt-8">Tap to reveal answer</p>
                </div>
                <div className="card-back p-8 text-center bg-[#cc97ff]/10 border border-[#cc97ff]/30 shadow-[0_0_30px_rgba(204,151,255,0.1)]">
                   <h3 className="text-xl font-bold text-[#cc97ff] mb-4">Deep Insight</h3>
                   <p className="text-sm text-white/80 leading-relaxed">{flashcards[currentCardIndex]?.answer}</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-4 w-full">
              <button onClick={() => handleFlashcardRating('again')} className="flex-1 py-3 px-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 transition-all text-xs font-bold uppercase tracking-wider">Again</button>
              <button onClick={() => handleFlashcardRating('good')} className="flex-1 py-3 px-4 rounded-xl border border-[#3adffa]/20 bg-[#3adffa]/5 text-[#3adffa] hover:bg-[#3adffa]/10 transition-all text-xs font-bold uppercase tracking-wider">Good</button>
              <button onClick={() => handleFlashcardRating('easy')} className="flex-1 py-3 px-4 rounded-xl border border-[#cc97ff]/20 bg-[#cc97ff]/5 text-[#cc97ff] hover:bg-[#cc97ff]/10 transition-all text-xs font-bold uppercase tracking-wider">Easy</button>
            </div>
          </div>
        </section>

        {/* RIGHT PANEL: MCQ Interface */}
        <section className="flex-1 flex flex-col relative bg-white/5 rounded-3xl border border-white/5 overflow-hidden p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[#3adffa] text-2xl">quiz</span>
              <h2 className="font-headline text-xl font-bold text-white tracking-tight">Knowledge Check</h2>
            </div>
            <div className="bg-white/5 px-3 py-1 rounded-full border border-white/5">
              <span className="text-xs text-white/60">Score: <span className="text-[#3adffa] font-bold">{score}</span></span>
            </div>
          </div>

          <div className="flex-1 flex flex-col max-w-lg mx-auto w-full mt-4">
            <div className="mb-10">
              <p className="text-lg text-white leading-relaxed font-medium">
                {quizQuestions[currentQuizIndex]?.question}
              </p>
            </div>

            <div className="space-y-4 flex-1">
              {quizQuestions[currentQuizIndex] && Object.entries(quizQuestions[currentQuizIndex].options).map(([key, value]) => (
                <button 
                  key={key}
                  onClick={() => setSelectedAnswer(key)}
                  className={`w-full text-left p-5 rounded-xl border transition-all flex items-start gap-4 group
                    ${selectedAnswer === key 
                      ? "bg-[#cc97ff]/10 border-[#cc97ff]/50 shadow-[0_0_20px_rgba(204,151,255,0.1)]" 
                      : "bg-white/5 border-white/5 hover:border-[#3adffa]/50 hover:bg-[#3adffa]/5"
                    }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border
                    ${selectedAnswer === key ? "bg-[#cc97ff] text-black border-transparent" : "bg-black/20 border-white/10 text-white/40"}
                  `}>
                    <span className="text-xs font-bold">{key}</span>
                  </div>
                  <span className={`text-sm pt-1 leading-relaxed ${selectedAnswer === key ? "text-white font-medium" : "text-white/70"}`}>{value}</span>
                </button>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <button 
                onClick={handleQuizSubmit}
                disabled={!selectedAnswer}
                className="py-3 px-8 rounded-xl bg-gradient-to-br from-[#cc97ff] to-[#cc97ff]/80 text-white font-bold text-sm hover:shadow-[0_0_20px_rgba(204,151,255,0.3)] transition-all flex items-center gap-2 disabled:opacity-50"
              >
                Submit Answer
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Floating AI Tutor Overlay */}
      <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-4">
        {chatOpen && (
          <div className="w-80 glass-panel rounded-2xl shadow-2xl border border-white/10 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center border border-[#cc97ff]/30">
                    <span className="material-symbols-outlined text-[#cc97ff] text-sm">smart_toy</span>
                  </div>
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#3adffa] border border-[#151926]"></span>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Shiro AI</h4>
                  <p className="text-[10px] text-[#3adffa] uppercase tracking-wider font-bold">Context Active</p>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-white/40 hover:text-white"><span className="material-symbols-outlined text-lg">close</span></button>
            </div>
            
            <div className="p-4 h-48 overflow-y-auto custom-scrollbar flex flex-col gap-3">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${msg.isUser ? 'self-end bg-[#cc97ff]/10 border border-[#cc97ff]/20 text-white' : 'self-start bg-white/5 border border-white/5 text-white/80'}`}>
                  {msg.text}
                </div>
              ))}
              {aiLoading && <div className="self-start flex gap-1 p-2"><span className="w-1 h-1 bg-[#3adffa] rounded-full animate-bounce"></span><span className="w-1 h-1 bg-[#3adffa] rounded-full animate-bounce delay-100"></span><span className="w-1 h-1 bg-[#3adffa] rounded-full animate-bounce delay-200"></span></div>}
            </div>

            <div className="p-3 border-t border-white/5 bg-black/20">
              <div className="relative flex items-center">
                <input 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSend()}
                  className="w-full bg-white/5 border border-white/10 rounded-full py-2 pl-4 pr-10 text-xs text-white focus:outline-none focus:border-[#cc97ff]/50" 
                  placeholder="Ask Shiro..." 
                />
                <button onClick={handleChatSend} className="absolute right-2 w-6 h-6 rounded-full bg-[#cc97ff]/20 flex items-center justify-center text-[#cc97ff] hover:bg-[#cc97ff]/40 transition-colors">
                  <span className="material-symbols-outlined text-[14px]">send</span>
                </button>
              </div>
            </div>
          </div>
        )}
        <button 
          onClick={() => setChatOpen(!chatOpen)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-[#cc97ff] to-[#3adffa] shadow-[0_0_20px_rgba(204,151,255,0.4)] flex items-center justify-center border border-white/10 hover:scale-105 transition-transform group relative"
        >
          <div className="absolute inset-0 rounded-full bg-[#cc97ff] animate-ping-slow opacity-20"></div>
          <span className="material-symbols-outlined text-white text-2xl group-hover:scale-110 transition-transform">{chatOpen ? 'forum' : 'mic'}</span>
        </button>
      </div>
    </div>
  );
};

export default StudyRoom;
