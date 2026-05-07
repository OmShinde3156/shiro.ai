import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Context } from '../../context/Context';
import API_BASE_URL from '../../api/config.js';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import MarkdownRenderer from '../chat/MarkdownRenderer';
import './StudyRoom.css';

const StudyRoom = () => {
  const { user } = useAuth();
  const { documents, fetchDocuments, onSent } = useContext(Context);
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedDocId, setSelectedDocId] = useState(location.state?.documentId || "");
  const [currentDocument, setCurrentDocument] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [activeTool, setActiveTool] = useState('flashcards'); // 'flashcards', 'quiz', 'chat', 'notes'

  // Pomodoro State
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState('study'); // 'study', 'break'

  // Ambient Sound State
  const [soundType, setSoundType] = useState('none');
  const audioRef = useRef(null);

  // Flashcards & Quiz State
  const [flashcards, setFlashcards] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [score, setScore] = useState(0);

  // AI Chat State
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    { text: "Flow mode initiated. I'm monitoring your progress—ask me anything as you study.", isUser: false }
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState(null);

  // Notes State
  const [notes, setNotes] = useState("");
  const [notesReviewing, setNotesReviewing] = useState(false);

  // Agentic Nudges State
  const [lastActionTime, setLastActionTime] = useState(Date.now());
  const [hasNudged, setHasNudged] = useState(false);

  // Magic Cursor Logic
  const [selection, setSelection] = useState({ text: "", x: 0, y: 0, visible: false });
  
  const handleTextSelection = () => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText && selectedText.length > 3) {
      const range = window.getSelection().getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelection({
        text: selectedText,
        x: rect.left + (rect.width / 2),
        y: rect.top - 50,
        visible: true
      });
    } else {
      setSelection(prev => ({ ...prev, visible: false }));
    }
  };

  const handleChatSend = async (overrideInput = null) => {
    const messageText = overrideInput || chatInput;
    if (!messageText.trim()) return;
    
    const userMsg = { text: messageText, isUser: true };
    setChatMessages(prev => [...prev, userMsg]);
    if (!overrideInput) setChatInput("");
    setAiLoading(true);

    try {
      // Logic from Context.jsx onSent adapted for StudyRoom specific state
      const response = await onSent("en", user?.id, [parseInt(selectedDocId)], "human", messageText);
      // Wait, onSent updates global messages. In StudyRoom we have local chatMessages.
      // I should probably sync them or just use global messages.
      // For now, I'll update local state from the returned response.
      // But onSent returns a string. I need the full data for citations.
      
      // I'll update the local chatMessages after a small delay to let Context finish.
      // Actually, let's just push a dummy AI message and it will be replaced by global state if needed?
      // No, StudyRoom has its own message stream for "Clean Flow".
      
      // I'll fetch the last message from the context after onSent completes
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  // Re-sync local chatMessages with global Context messages if needed,
  // or better: just use onSent and then update local state.
  // Actually, I'll modify handleChatSend to use runChat directly to keep it local and structured.
  
  const handleChatSendLocal = async (overrideInput = null) => {
    const messageText = overrideInput || chatInput;
    if (!messageText.trim()) return;
    
    setChatMessages(prev => [...prev, { text: messageText, isUser: true }]);
    if (!overrideInput) setChatInput("");
    setAiLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id,
          message: messageText,
          document_ids: [parseInt(selectedDocId)],
          language: "en",
          mode: "human"
        }),
      });
      const data = await response.json();
      setChatMessages(prev => [...prev, { 
        text: data.response, 
        isUser: false, 
        citations: data.citations || [] 
      }]);
    } catch (err) {
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleMagicAction = (actionType) => {
    setActiveTool('chat');
    setSelection(prev => ({ ...prev, visible: false }));
    
    let prompt = "";
    if (actionType === 'explain') {
      prompt = `Explain this passage from the text in simple terms: "${selection.text}"`;
    } else if (actionType === 'quiz') {
      prompt = `Generate a challenging multiple-choice question based specifically on this line: "${selection.text}"`;
    }

    handleChatSendLocal(prompt);
  };

  const recordAction = () => {
    setLastActionTime(Date.now());
    setHasNudged(false);
  };

  // Agentic Watchdog
  useEffect(() => {
    if (!sessionActive || !timerRunning) return;

    const watchdog = setInterval(() => {
      const idleTime = (Date.now() - lastActionTime) / 1000;
      
      if (idleTime > 180 && !hasNudged) {
        setHasNudged(true);
        setChatMessages(prev => [...prev, { 
          text: "I noticed you've been focused on this passage for a while. Need me to break it down further or should we try a Quick Quiz to test retention?", 
          isUser: false,
          isNudge: true 
        }]);
      }
    }, 30000);

    return () => clearInterval(watchdog);
  }, [sessionActive, timerRunning, lastActionTime, hasNudged]);

  const handleReviewNotes = async () => {
    if (!notes.trim() || notes.length < 20) return;
    recordAction();
    setNotesReviewing(true);
    setActiveTool('chat');
    
    const prompt = `I have written these notes based on the document: "${notes}". Please review them for accuracy, identify any logic gaps, and tell me if I missed any key concepts from the source material.`;
    
    await handleChatSendLocal(prompt);
    setNotesReviewing(false);
  };

  useEffect(() => {
    const handleMouseUp = () => {
      handleTextSelection();
      recordAction();
    };
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

  useEffect(() => {
    if (user?.id) fetchDocuments(user.id);
  }, [user]);

  useEffect(() => {
    if (documents?.length > 0 && !selectedDocId) {
      setSelectedDocId(documents[0].id);
    }
    if (selectedDocId) {
      const doc = documents.find(d => d.id === parseInt(selectedDocId));
      setCurrentDocument(doc);
    }
  }, [documents, selectedDocId]);

  // Pomodoro Logic
  useEffect(() => {
    let interval = null;
    if (timerRunning && timerSeconds > 0) {
      interval = setInterval(() => {
        setTimerSeconds(seconds => seconds - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setTimerRunning(false);
      if (pomodoroMode === 'study') {
        setPomodoroMode('break');
        setTimerSeconds(5 * 60);
        alert("Study Session Over! Take a 5-minute break.");
      } else {
        setPomodoroMode('study');
        setTimerSeconds(25 * 60);
        alert("Break Over! Back to focus mode.");
      }
    }
    return () => clearInterval(interval);
  }, [timerRunning, timerSeconds, pomodoroMode]);

  // Soundscape Logic
  useEffect(() => {
    if (soundType === 'none') {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      return;
    }

    const soundUrls = {
      lofi: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      rain: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      white: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3"
    };

    if (audioRef.current) audioRef.current.pause();
    audioRef.current = new Audio(soundUrls[soundType]);
    audioRef.current.loop = true;
    audioRef.current.play();

    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, [soundType]);

  const startSession = async () => {
    if (!selectedDocId) return;
    setSessionActive(true);
    setTimerRunning(true);

    try {
      const [fcRes, quizRes] = await Promise.all([
        fetch(`${API_BASE_URL}/generate-flashcards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_id: parseInt(selectedDocId), num_cards: 5 })
        }),
        fetch(`${API_BASE_URL}/generate-quiz`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_id: parseInt(selectedDocId), num_questions: 5 })
        })
      ]);
      const fcData = await fcRes.json();
      const quizData = await quizRes.json();
      if (fcData.flashcards) setFlashcards(fcData.flashcards);
      if (quizData.questions) setQuizQuestions(quizData.questions);
    } catch (err) {
      console.error("Session failed to load", err);
    }
  };

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!sessionActive) {
    return (
      <div className="study-room-container min-h-screen flex items-center justify-center p-8">
        <div className="glass-panel p-12 rounded-[3rem] border border-white/5 max-w-xl w-full text-center shadow-2xl">
          <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center text-primary mx-auto mb-8 shadow-[0_0_30px_rgba(114,220,255,0.2)]">
            <span className="material-symbols-outlined text-4xl">self_improvement</span>
          </div>
          <h2 className="text-4xl font-black mb-4 tracking-tighter text-white">Deep Focus Hub</h2>
          <p className="text-white/50 text-sm mb-10 leading-relaxed">Prepare for a zero-distraction session. We'll set a 25-minute flow timer and sync your materials.</p>
          
          <div className="space-y-6 text-left mb-10">
            <div className="form-group">
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30 mb-3 block">Focus Material</label>
              <select 
                value={selectedDocId} 
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-primary/50 transition-all"
              >
                {documents?.map(doc => <option key={doc.id} value={doc.id} className="bg-[#151926]">{doc.filename}</option>)}
              </select>
            </div>
          </div>

          <button 
            onClick={startSession}
            disabled={!selectedDocId}
            className="w-full py-5 bg-gradient-to-br from-primary to-secondary text-white font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_15px_30px_rgba(114,220,255,0.25)]"
          >
            Initiate Flow State
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="study-room-container h-screen flex flex-col overflow-hidden select-none">
      <header className="h-20 border-b border-white/5 bg-black/40 backdrop-blur-3xl flex items-center justify-between px-8 z-50">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate("/home")} className="text-white/40 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
          <div className="h-8 w-[1px] bg-white/10"></div>
          <div>
            <h3 className="text-sm font-bold text-white leading-none">{currentDocument?.filename}</h3>
            <p className="text-[10px] text-white/40 mt-1 uppercase tracking-widest font-bold">Deep Work Session</p>
          </div>
        </div>

        <div className={`flex items-center gap-4 bg-white/5 px-6 py-2 rounded-2xl border border-white/10 transition-all ${timerRunning ? 'border-primary/50 shadow-[0_0_20px_rgba(114,220,255,0.1)]' : ''}`}>
          <button onClick={() => setTimerRunning(!timerRunning)} className="text-primary hover:scale-110 transition-transform">
            <span className="material-symbols-outlined text-2xl fill">{timerRunning ? 'pause_circle' : 'play_circle'}</span>
          </button>
          <div className="text-center min-w-[80px]">
            <span className={`text-2xl font-black tabular-nums tracking-tighter ${timerRunning ? 'text-white' : 'text-white/40'}`}>
              {formatTime(timerSeconds)}
            </span>
          </div>
          <button onClick={() => {setTimerRunning(false); setTimerSeconds(25*60);}} className="text-white/20 hover:text-white transition-colors">
            <span className="material-symbols-outlined text-lg">replay</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5">
            {['none', 'lofi', 'rain', 'white'].map(type => (
              <button 
                key={type}
                onClick={() => setSoundType(type)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${soundType === type ? 'bg-primary/20 text-primary' : 'text-white/30 hover:text-white'}`}
                title={type.toUpperCase()}
              >
                <span className="material-symbols-outlined text-sm">
                  {type === 'none' ? 'volume_off' : type === 'lofi' ? 'music_note' : type === 'rain' ? 'water_drop' : 'noise_aware'}
                </span>
              </button>
            ))}
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary p-0.5">
             <div className="w-full h-full bg-[#0b0e14] rounded-[10px] flex items-center justify-center font-bold text-[10px] text-white">
                {Math.floor(score/100)}
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {selection.visible && (
          <div 
            className="fixed z-[100] flex gap-1 bg-black/80 backdrop-blur-xl border border-white/20 p-1.5 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200"
            style={{ left: selection.x, top: selection.y, transform: 'translateX(-50%)' }}
          >
            <button 
              onClick={() => handleMagicAction('explain')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-primary/20 text-primary transition-all group"
            >
              <span className="material-symbols-outlined text-sm">psychology</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Explain</span>
            </button>
            <div className="w-[1px] h-4 bg-white/10 self-center"></div>
            <button 
              onClick={() => handleMagicAction('quiz')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-secondary/20 text-secondary transition-all"
            >
              <span className="material-symbols-outlined text-sm">quiz</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Quiz Me</span>
            </button>
          </div>
        )}

        <section className="flex-1 border-r border-white/5 overflow-y-auto p-12 bg-black/20 scrollbar-hide">
          <div className="max-w-2xl mx-auto">
             <div className="flex items-center gap-3 mb-12 opacity-40">
                <span className="material-symbols-outlined text-sm">menu_book</span>
                <span className="text-[10px] font-bold uppercase tracking-widest">Primary Source Material</span>
             </div>
             <div className="prose prose-invert max-w-none text-white/70 leading-[1.8] text-lg font-light">
                {currentDocument?.text_content || "Loading focus content..."}
             </div>
          </div>
        </section>

        <section className="w-[500px] flex flex-col bg-black/40">
           <div className="flex p-4 gap-2">
              {['flashcards', 'quiz', 'chat', 'notes'].map(tool => (
                <button 
                  key={tool}
                  onClick={() => setActiveTool(tool)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${activeTool === tool ? 'bg-primary/10 border-primary/40 text-primary shadow-[0_0_15px_rgba(114,220,255,0.1)]' : 'bg-white/5 border-transparent text-white/40 hover:bg-white/10'}`}
                >
                  {tool}
                </button>
              ))}
           </div>

           <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
              {activeTool === 'flashcards' && (
                <div className="h-full flex flex-col justify-center animate-in fade-in slide-in-from-right-4">
                  <div className={`card-container h-80 w-full perspective-1000 ${isFlipped ? 'is-flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
                    <div className="card-inner">
                      <div className="card-front p-8 bg-[#1a1f2e] border border-white/5 rounded-[2rem] flex flex-col justify-center shadow-2xl">
                         <p className="text-lg text-white font-medium">{flashcards[currentCardIndex]?.question}</p>
                         <span className="text-[9px] uppercase tracking-widest text-white/20 mt-8 font-bold">Tap to reveal insight</span>
                      </div>
                      <div className="card-back p-8 bg-gradient-to-br from-[#1a1f2e] to-[#251b3a] border border-primary/20 rounded-[2rem] flex flex-col justify-center shadow-2xl">
                         <p className="text-sm text-white/80 leading-relaxed">{flashcards[currentCardIndex]?.answer}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-8">
                    {[1, 3, 5].map(rating => (
                      <button 
                        key={rating}
                        onClick={(e) => { e.stopPropagation(); setCurrentCardIndex(prev => (prev + 1) % flashcards.length); setIsFlipped(false); }}
                        className="flex-1 py-4 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase text-white/60 hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-all"
                      >
                        {rating === 1 ? 'Again' : rating === 3 ? 'Good' : 'Easy'}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {activeTool === 'quiz' && (
                <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4">
                  <div className="mb-8">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">Question {currentQuizIndex + 1}/{quizQuestions.length}</p>
                    <h4 className="text-lg text-white font-bold leading-snug">{quizQuestions[currentQuizIndex]?.question}</h4>
                  </div>
                  <div className="space-y-3 flex-1">
                    {quizQuestions[currentQuizIndex] && Object.entries(quizQuestions[currentQuizIndex].options).map(([key, val]) => (
                      <button 
                        key={key}
                        onClick={() => setSelectedAnswer(key)}
                        className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${selectedAnswer === key ? 'bg-primary/10 border-primary/50' : 'bg-white/5 border-white/5 hover:border-white/20'}`}
                      >
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${selectedAnswer === key ? 'bg-primary text-black' : 'bg-black/40 text-white/40'}`}>{key}</span>
                        <span className="text-xs text-white/80">{val}</span>
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={() => { if(selectedAnswer === quizQuestions[currentQuizIndex].correct_answer) setScore(s => s + 100); setCurrentQuizIndex(prev => (prev + 1) % quizQuestions.length); setSelectedAnswer(null); }}
                    disabled={!selectedAnswer}
                    className="mt-8 py-4 bg-primary text-black font-black rounded-xl text-xs uppercase tracking-widest disabled:opacity-30"
                  >
                    Confirm Answer
                  </button>
                </div>
              )}

              {activeTool === 'chat' && (
                <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4">
                   <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
                      {chatMessages.map((msg, i) => (
                        <div key={i} className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed ${msg.isUser ? 'ml-auto bg-primary/10 text-white border border-primary/20' : 'bg-white/5 text-white/70 border border-white/5'}`}>
                          <MarkdownRenderer 
                            content={msg.text} 
                            citations={msg.citations || []} 
                            onCitationClick={(cit) => setSelectedCitation(cit)} 
                          />
                        </div>
                      ))}
                      {aiLoading && <div className="p-2 flex gap-1"><span className="w-1 h-1 bg-primary rounded-full animate-bounce"></span><span className="w-1 h-1 bg-primary rounded-full animate-bounce delay-100"></span><span className="w-1 h-1 bg-primary rounded-full animate-bounce delay-200"></span></div>}
                   </div>
                   <div className="mt-4 relative">
                      <input 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleChatSendLocal()}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-4 pr-12 text-xs text-white focus:border-primary/50 outline-none" 
                        placeholder="Ask Shiro about this passage..." 
                      />
                      <button onClick={() => handleChatSendLocal()} className="absolute right-2 top-2 w-8 h-8 rounded-lg bg-primary text-black flex items-center justify-center hover:scale-105 transition-transform">
                        <span className="material-symbols-outlined text-sm">send</span>
                      </button>
                   </div>
                </div>
              )}

              {activeTool === 'notes' && (
                <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-4">
                  <div className="flex-1 flex flex-col">
                    <textarea 
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Synthesize the material in your own words here..."
                      className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-6 text-sm text-white/80 leading-relaxed outline-none focus:border-primary/30 transition-all resize-none scrollbar-hide"
                    />
                    <div className="mt-6 p-6 bg-primary/5 rounded-2xl border border-primary/10">
                      <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">Active Recall Check</h5>
                      <p className="text-xs text-white/40 mb-4">Shiro will analyze your notes against the source material to find contradictions or missed concepts.</p>
                      <button 
                        onClick={handleReviewNotes}
                        disabled={notes.length < 20 || notesReviewing}
                        className="w-full py-4 bg-primary text-black font-black rounded-xl text-[10px] uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                      >
                        {notesReviewing ? 'Analyzing...' : (
                          <>
                            <span className="material-symbols-outlined text-sm">analytics</span>
                            Review with Shiro
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
           </div>
        </section>
      </main>

      {/* Source Citation Preview Modal */}
      {selectedCitation && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedCitation(null)}>
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
           </div>
        </div>
      )}
    </div>
  );
};

export default StudyRoom;
