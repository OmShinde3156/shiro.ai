import { fetchWithAuth } from '../../api/fetchWithAuth';
import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Context } from '../../context/Context';
import API_BASE_URL from '../../api/config.js';
import MarkdownRenderer from '../chat/components/MarkdownRenderer';
import CitationDrawer from '../chat/components/CitationDrawer';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Tooltip from '../../components/ui/Tooltip';
import { 
  X, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  CloudRain, 
  Music, 
  Wind, 
  BookOpen, 
  Layers, 
  HelpCircle, 
  MessageSquare, 
  Edit3, 
  Send,
  Sparkles,
  ArrowRight,
  BrainCircuit
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const StudyRoom = () => {
  const { user } = useAuth();
  const { documents, fetchDocuments, onSent } = useContext(Context);
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedDocId, setSelectedDocId] = useState(location.state?.documentId || "");
  const [currentDocument, setCurrentDocument] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [activeTool, setActiveTool] = useState('flashcards'); // 'flashcards' | 'quiz' | 'chat' | 'notes'

  // Pomodoro State
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState('study'); // 'study' | 'break'

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
    { text: "Flow mode initiated. I'm monitoring your study session—ask me anything as you read.", isUser: false }
  ]);
  const [aiLoading, setAiLoading] = useState(false);
  const [selectedCitation, setSelectedCitation] = useState(null);

  // Notes State
  const [notes, setNotes] = useState("");

  // Magic Text Selection
  const [selection, setSelection] = useState({ text: "", x: 0, y: 0, visible: false });

  const handleTextSelection = () => {
    const selectedText = window.getSelection().toString().trim();
    if (selectedText && selectedText.length > 3) {
      const range = window.getSelection().getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelection({
        text: selectedText,
        x: rect.left + (rect.width / 2),
        y: rect.top - 45,
        visible: true
      });
    } else {
      setSelection(prev => ({ ...prev, visible: false }));
    }
  };

  const handleChatSendLocal = async (overrideInput = null) => {
    const messageText = overrideInput || chatInput;
    if (!messageText.trim()) return;

    const userMsg = { text: messageText, isUser: true };
    setChatMessages(prev => [...prev, userMsg]);
    if (!overrideInput) setChatInput("");
    setAiLoading(true);

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id || 1,
          message: messageText,
          document_ids: selectedDocId ? [parseInt(selectedDocId)] : [],
          language: "en",
          mode: "human"
        })
      });

      if (response.ok) {
        const data = await response.json();
        setChatMessages(prev => [...prev, {
          text: data.response,
          thought: data.internal_thought,
          sources: data.sources || data.citations || [],
          isUser: false
        }]);
      }
    } catch (err) {
      console.error(err);
      setChatMessages(prev => [...prev, { text: "Failed to fetch response.", isUser: false }]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleMagicAction = (action) => {
    setSelection(prev => ({ ...prev, visible: false }));
    if (action === 'explain') {
      setActiveTool('chat');
      handleChatSendLocal(`Explain this excerpt simply:\n"${selection.text}"`);
    } else if (action === 'quiz') {
      setActiveTool('chat');
      handleChatSendLocal(`Generate 2 quick practice questions based on:\n"${selection.text}"`);
    }
  };

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
        setTimerSeconds(s => s - 1);
      }, 1000);
    } else if (timerSeconds === 0) {
      setTimerRunning(false);
      if (pomodoroMode === 'study') {
        setPomodoroMode('break');
        setTimerSeconds(5 * 60);
      } else {
        setPomodoroMode('study');
        setTimerSeconds(25 * 60);
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
    audioRef.current.volume = 0.4;
    audioRef.current.play().catch(() => {});

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
        fetchWithAuth(`${API_BASE_URL}/generate-flashcards`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_id: parseInt(selectedDocId), num_cards: 5 })
        }),
        fetchWithAuth(`${API_BASE_URL}/generate-quiz`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_id: parseInt(selectedDocId), num_questions: 5 })
        })
      ]);

      if (fcRes.ok) {
        const fcData = await fcRes.json();
        setFlashcards(fcData.flashcards || []);
      }
      if (quizRes.ok) {
        const qData = await quizRes.json();
        setQuizQuestions(qData.questions || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Study Room Setup Screen
  if (!sessionActive) {
    return (
      <div className="h-screen flex items-center justify-center p-6 bg-[var(--bg-canvas)]">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full glass-panel p-8 text-center space-y-6 border-[#3F6048]/30 dark:border-[#89A88D]/30 shadow-2xl bg-[var(--bg-surface)]"
        >
          <div className="w-16 h-16 rounded-2xl bg-[#3F6048]/15 dark:bg-[#89A88D]/15 border border-[#3F6048]/30 dark:border-[#89A88D]/30 flex items-center justify-center text-[#3F6048] dark:text-[#89A88D] mx-auto shadow-sm">
            <BrainCircuit className="w-8 h-8" />
          </div>

          <div>
            <h1 className="text-2xl font-extrabold text-[var(--text-main)] tracking-tight font-serif">
              Deep Flow Study Room
            </h1>
            <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-1">
              Dual-pane focus workspace with active recall, ambient soundscapes, and source reading.
            </p>
          </div>

          {/* Document Picker */}
          <div className="text-left space-y-2">
            <label className="text-xs font-semibold text-[var(--text-main)] font-serif">
              Select Primary Study Material:
            </label>
            <select
              value={selectedDocId}
              onChange={(e) => setSelectedDocId(e.target.value)}
              className="w-full p-3 bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl text-xs md:text-sm text-[var(--text-main)] focus:outline-none focus:border-[#3F6048] dark:focus:border-[#89A88D] cursor-pointer"
            >
              {documents.map(d => (
                <option key={d.id} value={d.id} className="bg-[var(--bg-surface)] text-[var(--text-main)]">
                  {d.filename} ({d.subject || 'General'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" size="md" className="flex-1" onClick={() => navigate('/home')}>
              Cancel
            </Button>
            <Button variant="primary" size="md" className="flex-1" onClick={startSession} disabled={!selectedDocId}>
              <span>Enter Study Room</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[var(--bg-canvas)] select-none">
      {/* Citation Drawer */}
      <CitationDrawer
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />

      {/* Top Navigation & Pomodoro Toolbar */}
      <header className="h-16 border-b border-[var(--border)] bg-[var(--header-bg)] backdrop-blur-2xl flex items-center justify-between px-6 z-40 shrink-0">
        {/* Left: Document Info */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/home')}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface-elevated)] transition-colors"
            title="Exit Study Room"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="h-5 w-[1px] bg-[var(--border)]" />
          <div>
            <h3 className="text-xs md:text-sm font-bold text-[var(--text-main)] truncate max-w-[200px] md:max-w-xs font-serif">
              {currentDocument?.filename}
            </h3>
            <span className="text-[10px] text-[#3F6048] dark:text-[#89A88D] font-mono font-bold">
              {pomodoroMode === 'study' ? '● FOCUS SESSION' : '○ SHORT BREAK'}
            </span>
          </div>
        </div>

        {/* Center: Pomodoro Timer */}
        <div className={`flex items-center gap-3 px-4 py-1.5 rounded-2xl bg-[var(--bg-surface-elevated)] border transition-all ${
          timerRunning ? 'border-[#3F6048] dark:border-[#89A88D] shadow-sm' : 'border-[var(--border)]'
        }`}>
          <button
            onClick={() => setTimerRunning(!timerRunning)}
            className="text-[#3F6048] dark:text-[#89A88D] hover:scale-105 transition-transform p-1"
          >
            {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <span className={`text-xl font-bold font-mono tracking-tight ${
            timerRunning ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'
          }`}>
            {formatTime(timerSeconds)}
          </span>
          <button
            onClick={() => { setTimerRunning(false); setTimerSeconds(25 * 60); }}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors p-1"
            title="Reset Timer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Soundscape Equalizer & Score */}
        <div className="flex items-center gap-3">
          {/* Ambient Sound Selector */}
          <div className="flex items-center gap-1 bg-[var(--bg-surface-elevated)] p-1 rounded-xl border border-[var(--border)]">
            {[
              { type: 'none', icon: VolumeX, label: 'Mute' },
              { type: 'lofi', icon: Music, label: 'Lofi' },
              { type: 'rain', icon: CloudRain, label: 'Rain' },
              { type: 'white', icon: Wind, label: 'Binaural' },
            ].map((sound) => {
              const Icon = sound.icon;
              const isPlaying = soundType === sound.type;
              return (
                <Tooltip key={sound.type} text={sound.label}>
                  <button
                    onClick={() => setSoundType(sound.type)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                      isPlaying
                        ? 'bg-[#3F6048]/20 dark:bg-[#89A88D]/20 text-[#3F6048] dark:text-[#89A88D] border border-[#3F6048]/30 dark:border-[#89A88D]/30'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Dual-Pane Workspace */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Magic Selection Popover */}
        {selection.visible && (
          <div
            className="fixed z-50 flex gap-1 bg-[var(--bg-surface)] border border-[var(--border)] p-1 rounded-xl shadow-2xl animate-in fade-in zoom-in-95 duration-150"
            style={{ left: selection.x, top: selection.y, transform: 'translateX(-50%)' }}
          >
            <button
              onClick={() => handleMagicAction('explain')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#3F6048]/15 hover:bg-[#3F6048]/25 text-[#3F6048] dark:text-[#A8C5AC] text-[11px] font-semibold transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              <span>Explain</span>
            </button>
            <button
              onClick={() => handleMagicAction('quiz')}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#D6A84F]/15 hover:bg-[#D6A84F]/25 text-[#D6A84F] text-[11px] font-semibold transition-colors"
            >
              <HelpCircle className="w-3 h-3" />
              <span>Quiz Me</span>
            </button>
          </div>
        )}

        {/* LEFT PANE: Source Reading Viewer */}
        <section
          onMouseUp={handleTextSelection}
          className="flex-1 border-r border-[var(--border)] overflow-y-auto p-8 md:p-12 custom-scroll bg-[var(--bg-canvas)]"
        >
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-muted)] uppercase tracking-widest pb-2 border-b border-[var(--border)] font-mono">
              <BookOpen className="w-4 h-4 text-[#3F6048] dark:text-[#89A88D]" />
              <span>PRIMARY SOURCE MATERIAL</span>
            </div>

            <div className="prose max-w-none text-[var(--text-main)] text-sm leading-relaxed whitespace-pre-wrap font-serif select-text">
              {currentDocument?.text_content || "Loading textbook and notes excerpt..."}
            </div>
          </div>
        </section>

        {/* RIGHT PANE: Tabbed AI Study Tools */}
        <section className="w-full md:w-[460px] flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border)] shrink-0">
          {/* Tool Tab Switcher */}
          <div className="flex p-3 gap-1.5 border-b border-[var(--border)] bg-[var(--bg-surface-elevated)]">
            {[
              { key: 'flashcards', label: 'Flashcards', icon: Layers },
              { key: 'quiz', label: 'Quiz', icon: HelpCircle },
              { key: 'chat', label: 'Chat', icon: MessageSquare },
              { key: 'notes', label: 'Notes', icon: Edit3 },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTool === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTool(tab.key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-[#E8EFE9] dark:bg-[#89A88D]/20 text-[#3F6048] dark:text-[#A8C5AC] border border-[#3F6048]/20 dark:border-[#89A88D]/30 font-semibold shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Tool Content Container */}
          <div className="flex-1 overflow-y-auto p-4 custom-scroll">
            {/* FLASHCARDS TAB */}
            {activeTool === 'flashcards' && (
              <div className="space-y-4 h-full flex flex-col justify-between">
                {flashcards.length > 0 ? (
                  <>
                    <div
                      onClick={() => setIsFlipped(!isFlipped)}
                      className="flex-1 min-h-[260px] glass-panel p-6 flex flex-col justify-between cursor-pointer border-[var(--border)] hover:border-[#3F6048]/40 dark:hover:border-[#89A88D]/40 transition-colors bg-[var(--bg-surface)]"
                    >
                      <div className="flex justify-between items-center text-xs">
                        <Badge variant="sage" size="sm">
                          Card {currentCardIndex + 1} / {flashcards.length}
                        </Badge>
                        <span className="text-[var(--text-muted)] text-[11px]">Click to flip</span>
                      </div>
                      <div className="my-auto text-center">
                        <h4 className="text-base font-bold text-[var(--text-main)] leading-relaxed font-serif">
                          {isFlipped 
                            ? flashcards[currentCardIndex]?.answer || flashcards[currentCardIndex]?.back 
                            : flashcards[currentCardIndex]?.question || flashcards[currentCardIndex]?.front}
                        </h4>
                      </div>
                      <div className="text-center text-[10px] text-[var(--text-muted)]">
                        {isFlipped ? "Answer" : "Question"}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setIsFlipped(false);
                          setCurrentCardIndex(prev => (prev > 0 ? prev - 1 : flashcards.length - 1));
                        }}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setIsFlipped(false);
                          setCurrentCardIndex(prev => (prev < flashcards.length - 1 ? prev + 1 : 0));
                        }}
                      >
                        Next Card
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 text-[var(--text-muted)] text-xs">
                    Generating flashcards from this document...
                  </div>
                )}
              </div>
            )}

            {/* QUIZ TAB */}
            {activeTool === 'quiz' && (
              <div className="space-y-4">
                {quizQuestions.length > 0 ? (
                  <div className="space-y-3">
                    <Badge variant="sage" size="sm">
                      Question {currentQuizIndex + 1} of {quizQuestions.length}
                    </Badge>
                    <h4 className="text-sm font-bold text-[var(--text-main)] font-serif">
                      {quizQuestions[currentQuizIndex]?.question}
                    </h4>
                    <div className="space-y-2 pt-2">
                      {Object.entries(quizQuestions[currentQuizIndex]?.options || {}).map(([key, text]) => (
                        <button
                          key={key}
                          onClick={() => setSelectedAnswer(key)}
                          className={`w-full p-2.5 rounded-xl border text-left text-xs flex items-start gap-2 transition-all ${
                            selectedAnswer === key
                              ? 'bg-[#E8EFE9] dark:bg-[#89A88D]/20 border-[#3F6048] dark:border-[#89A88D] text-[var(--text-main)] font-semibold shadow-sm'
                              : 'bg-[var(--bg-surface-elevated)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)]'
                          }`}
                        >
                          <span className="font-mono font-bold uppercase">{key}.</span>
                          <span>{text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-[var(--text-muted)] text-xs">
                    Generating quiz questions...
                  </div>
                )}
              </div>
            )}

            {/* CHAT TAB */}
            {activeTool === 'chat' && (
              <div className="h-full flex flex-col justify-between">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scroll max-h-[calc(100vh-220px)]">
                  {chatMessages.map((msg, i) => (
                    <div
                      key={i}
                      className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                        msg.isUser
                          ? 'ml-auto bg-[#E8EFE9] dark:bg-[#89A88D]/15 text-[var(--text-main)] border border-[#3F6048]/20 dark:border-[#89A88D]/30 max-w-[85%]'
                          : 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border border-[var(--border)] max-w-[95%]'
                      }`}
                    >
                      <MarkdownRenderer
                        content={msg.text}
                        onCitationClick={(cit) => setSelectedCitation(cit)}
                      />
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex items-center gap-1.5 text-[#3F6048] dark:text-[#89A88D] text-xs py-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3F6048] dark:bg-[#89A88D] animate-ping" />
                      <span className="text-[var(--text-muted)] font-mono">Analyzing passage...</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[var(--border)] flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleChatSendLocal()}
                    placeholder="Ask about this passage..."
                    className="flex-1 bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#3F6048] dark:focus:border-[#89A88D]"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleChatSendLocal()}
                    disabled={aiLoading || !chatInput.trim()}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* NOTES TAB */}
            {activeTool === 'notes' && (
              <div className="h-full flex flex-col justify-between space-y-3">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Jot down active recall summaries, formulas, or key concepts..."
                  className="flex-1 w-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] rounded-xl p-3.5 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#3F6048] dark:focus:border-[#89A88D] resize-none custom-scroll leading-relaxed"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    handleChatSendLocal(`Evaluate my study notes for gaps or missing concepts:\n"${notes}"`);
                    setActiveTool('chat');
                  }}
                  disabled={!notes.trim()}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#3F6048] dark:text-[#89A88D]" />
                  <span>Evaluate Notes with AI</span>
                </Button>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default StudyRoom;
