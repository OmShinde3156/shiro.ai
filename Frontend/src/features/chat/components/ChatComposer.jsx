import React, { useState, useRef, useEffect, useContext } from 'react';
import { Context } from '../../../context/Context';
import { 
  Send, 
  Paperclip, 
  Mic, 
  MicOff, 
  Sparkles, 
  Brain, 
  Crosshair, 
  X, 
  FileText,
  ChevronDown,
  HelpCircle,
  Layers,
  Network,
  BookOpen,
  UploadCloud,
  Command,
  Square
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Badge from '../../../components/ui/Badge';
import Tooltip from '../../../components/ui/Tooltip';

export const ChatComposer = ({
  input,
  setInput,
  onSend,
  loading = false,
  documents = [],
  selectedDocIds = [],
  onToggleDoc,
  onUploadFile,
  mode = 'human',
  setMode,
  placeholder = 'Ask Shiro anything from your notes, request practice questions, or type / for commands...',
  onFocusExpand
}) => {
  const { t, stopGeneration } = useContext(Context);
  const textareaRef = useRef(null);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashIndex, setSlashIndex] = useState(0);

  const slashCommands = [
    { cmd: '/quiz', label: 'Generate Practice Quiz', desc: 'Active recall MCQs based on notes', icon: HelpCircle, prompt: 'Generate 5 high-yield multiple choice practice questions based on our study materials with explanations.' },
    { cmd: '/flashcards', label: 'Create Flashcards', desc: 'SM-2 spaced repetition cards', icon: Layers, prompt: 'Create 5 spaced repetition flashcards from our notes covering the most critical definitions and formulas.' },
    { cmd: '/feynman', label: 'Feynman Explanation', desc: 'Test deep intuitive understanding', icon: Sparkles, prompt: 'Let us do a Feynman challenge on the primary topic in our notes. Ask me to explain the core concept in simple terms and evaluate my gaps.' },
    { cmd: '/summarize', label: 'Summarize Key Formulas', desc: 'High-yield cheat sheet & principles', icon: BookOpen, prompt: 'Summarize the core formulas, key principles, and essential takeaways from our materials in a concise cheat sheet.' },
    { cmd: '/mindmap', label: 'Concept Mind Map', desc: 'Visual hierarchical breakdown', icon: Network, prompt: 'Break down the main topics and sub-concepts from our materials into a structured knowledge hierarchy.' },
  ];

  // Auto-resize textarea smoothly & refresh/collapse when prompt is sent
  useEffect(() => {
    if (textareaRef.current) {
      if (!input || !input.trim()) {
        textareaRef.current.style.height = '48px';
      } else {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(Math.max(textareaRef.current.scrollHeight, 48), 200)}px`;
      }
    }
  }, [input]);

  // Handle Slash Command Triggering
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    if (val.startsWith('/')) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleSelectSlashCommand = (item) => {
    setInput(item.prompt);
    setShowSlashMenu(false);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleComposerSend = () => {
    if (!loading && input.trim()) {
      onSend();
      if (textareaRef.current) {
        textareaRef.current.style.height = '48px';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (showSlashMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex((prev) => (prev + 1) % slashCommands.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex((prev) => (prev - 1 + slashCommands.length) % slashCommands.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        handleSelectSlashCommand(slashCommands[slashIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setShowSlashMenu(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleComposerSend();
    }
  };

  // Drag-and-Drop file handling
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0 && onUploadFile) {
      onUploadFile(files[0]);
    }
  };

  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const restartTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      isRecordingRef.current = false;
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  // Web Speech API Voice Recognition (Native Continuous)
  const toggleVoice = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecordingRef.current) {
      isRecordingRef.current = false;
      setIsRecording(false);
      if (restartTimeoutRef.current) clearTimeout(restartTimeoutRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsRecording(true);
        isRecordingRef.current = true;
      };

      recognition.onresult = (event) => {
        let newTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const phrase = event.results[i][0]?.transcript || '';
          if (phrase) {
            newTranscript += (newTranscript ? ' ' : '') + phrase.trim();
          }
        }
        if (newTranscript) {
          setInput(prev => (prev ? `${prev} ${newTranscript}` : newTranscript));
        }
      };

      recognition.onerror = (event) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        console.warn('Speech recognition warning:', event.error);
        if (event.error === 'not-allowed') {
          isRecordingRef.current = false;
          setIsRecording(false);
        }
      };

      recognition.onend = () => {
        if (isRecordingRef.current) {
          restartTimeoutRef.current = setTimeout(() => {
            if (isRecordingRef.current) {
              try { recognition.start(); } catch (e) {}
            }
          }, 200);
        } else {
          setIsRecording(false);
        }
      };

      recognitionRef.current = recognition;
      isRecordingRef.current = true;
      recognition.start();
    } catch (e) {
      console.error('Speech recognition error:', e);
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  };

  const selectedDocs = documents.filter(d => selectedDocIds.includes(d.id));

  return (
    <div 
      className="relative w-full max-w-4xl mx-auto"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Attached Documents Context Shelf */}
      {selectedDocs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5 px-2">
          <span className="text-[11px] text-[var(--text-muted)] font-medium">Context:</span>
          {selectedDocs.map(doc => (
            <span
              key={doc.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#89A88D]/15 border border-[#89A88D]/30 text-xs text-[#3F6048] dark:text-[#A8C5AC] shadow-xs font-medium"
            >
              <FileText className="w-3 h-3 text-[#3F6048] dark:text-[#89A88D]" />
              <span className="truncate max-w-[150px]">{doc.filename}</span>
              <button
                onClick={() => onToggleDoc && onToggleDoc(doc.id)}
                className="hover:text-[var(--text-main)] transition-colors p-0.5"
                title="Remove source"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Hero-Grade Main Composer Surface */}
      <div className={`relative p-3 sm:p-4 flex flex-col gap-2.5 sm:gap-3 rounded-2xl sm:rounded-[20px] bg-[var(--bg-surface)] border border-[var(--border)] shadow-[0_8px_30px_rgba(40,35,25,0.05)] dark:shadow-none transition-all duration-200 ${
        isDragging ? 'border-[#3F6048] bg-[#3F6048]/5 shadow-lg' : 'focus-within:border-[#6B8F71] focus-within:ring-2 focus-within:ring-[#6B8F71]/15'
      }`}>
        {/* Drag Over Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-20 rounded-2xl sm:rounded-[20px] bg-[var(--bg-surface)]/90 backdrop-blur-sm border-2 border-dashed border-[#3F6048] flex flex-col items-center justify-center gap-2 text-[#3F6048]">
            <UploadCloud className="w-8 h-8 animate-bounce" />
            <span className="text-sm font-semibold">Drop PDF or notes here to attach</span>
          </div>
        )}

        {/* Slash Command Autocomplete Popover */}
        <AnimatePresence>
          {showSlashMenu && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="absolute left-0 bottom-full mb-3 w-full max-w-md p-2 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl z-40 space-y-1"
            >
              <div className="flex items-center justify-between px-3 py-1.5 text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider border-b border-[var(--border)] mb-1">
                <span>Quick Study Commands</span>
                <kbd className="text-[10px] hidden sm:inline">↑↓ to navigate · ⏎ to select</kbd>
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1 custom-scroll touch-scroll">
                {slashCommands.map((item, idx) => {
                  const Icon = item.icon;
                  const isSelected = idx === slashIndex;
                  return (
                    <button
                      key={item.cmd}
                      onClick={() => handleSelectSlashCommand(item)}
                      onMouseEnter={() => setSlashIndex(idx)}
                      className={`w-full px-3 py-2 rounded-xl flex items-center gap-3 text-left transition-colors ${
                        isSelected
                          ? 'bg-[#E8EFE9] dark:bg-[#89A88D]/15 text-[#3F6048] dark:text-[#A8C5AC] border border-[#3F6048]/20 dark:border-[#89A88D]/30'
                          : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)]'
                      }`}
                    >
                      <div className="p-1.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[#3F6048] dark:text-[#89A88D] shrink-0">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[var(--text-main)] truncate">{item.label}</span>
                          <span className="font-mono text-[11px] text-[#3F6048] dark:text-[#89A88D] shrink-0">{item.cmd}</span>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] truncate">{item.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Text Input Area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (onFocusExpand) onFocusExpand();
          }}
          onClick={() => {
            if (onFocusExpand) onFocusExpand();
          }}
          placeholder={placeholder}
          rows={1}
          disabled={loading}
          className="w-full bg-transparent border-0 text-[var(--text-main)] placeholder-[var(--text-muted)] text-sm sm:text-base focus:ring-0 focus:outline-none resize-none max-h-48 custom-scroll leading-relaxed"
        />

        {/* Action Controls Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[var(--border)] text-xs">
          {/* Left Controls: Socratic Mode & Document Selector */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Mode Switcher Pill */}
            <div className="flex items-center rounded-xl bg-[var(--bg-surface-elevated)] p-0.5 border border-[var(--border)] shrink-0">
              <button
                type="button"
                onClick={() => setMode('human')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 ${
                  mode === 'human'
                    ? 'bg-[var(--primary-subtle)] text-[var(--primary-strong)] font-semibold shadow-xs border border-[var(--border)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] border border-transparent'
                }`}
                title="Socratic, intuitive explanations with analogies"
              >
                <Brain className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px] hidden sm:inline">{t("humanTutor", "Human Tutor")}</span>
                <span className="text-[11px] sm:hidden">Tutor</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('surgical')}
                className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 ${
                  mode === 'surgical'
                    ? 'bg-[var(--primary-strong)] text-[var(--bg-canvas)] font-semibold shadow-xs border border-[var(--primary-strong)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)] border border-transparent'
                }`}
                title="Surgical Mode: Concise, precise, and direct answers"
              >
                <Crosshair className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[11px] hidden sm:inline">{t("surgicalMode", "Surgical Mode")}</span>
                <span className="text-[11px] sm:hidden">Exam</span>
              </button>
            </div>

            {/* Document Context Trigger */}
            {documents.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDocPicker(!showDocPicker)}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-card-hover)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)] transition-all text-xs active:scale-95 shrink-0"
                >
                  <Paperclip className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                  <span className="hidden xs:inline">Attach Source</span>
                  <span className="xs:hidden">Source</span>
                  <ChevronDown className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                </button>

                {/* Doc Picker Dropdown */}
                <AnimatePresence>
                  {showDocPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="absolute left-0 bottom-full mb-2 w-64 max-w-[calc(100vw-2rem)] p-2 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-xl z-30 space-y-1"
                    >
                      <div className="text-[11px] font-semibold text-[var(--text-muted)] px-2 py-1 uppercase tracking-wider font-mono">
                        Select Knowledge Sources
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 custom-scroll touch-scroll">
                        {documents.map(doc => {
                          const isSelected = selectedDocIds.includes(doc.id);
                          return (
                            <button
                              key={doc.id}
                              type="button"
                              onClick={() => {
                                onToggleDoc(doc.id);
                              }}
                              className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left text-xs transition-colors ${
                                isSelected
                                  ? 'bg-[var(--primary-subtle)] text-[var(--primary-strong)] border border-[var(--border)] font-medium'
                                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-elevated)] hover:text-[var(--text-main)]'
                              }`}
                            >
                              <span className="truncate">{doc.filename}</span>
                              {isSelected && <span className="text-[var(--primary)] text-xs">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Right Controls: Voice & Send/Stop Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto">
            <Tooltip text={isRecording ? "Stop Recording" : "Voice Entry"}>
              <button
                type="button"
                onClick={toggleVoice}
                disabled={loading}
                aria-label="Voice input"
                className={`p-2 rounded-xl border transition-all active:scale-95 touch-target ${
                  isRecording
                    ? 'bg-[#C96B62]/20 border-[#C96B62] text-[#C96B62] animate-pulse'
                    : 'bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)] disabled:opacity-40'
                }`}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </Tooltip>

            {loading ? (
              <Tooltip text="Stop Generation">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={stopGeneration}
                  aria-label="Stop generating response"
                  className="p-2 sm:p-2.5 rounded-xl bg-[#C96B62] hover:bg-[#B35850] text-white font-semibold shadow-sm flex items-center justify-center transition-colors touch-target"
                  title="Stop generating"
                >
                  <Square className="w-4 h-4 fill-current" />
                </motion.button>
              </Tooltip>
            ) : (
              <Tooltip text="Send message" kbd="⏎">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleComposerSend}
                  disabled={!input.trim()}
                  aria-label="Send message"
                  className="p-2 sm:p-2.5 rounded-xl bg-[#3F6048] hover:bg-[#34523D] dark:bg-[#89A88D] dark:hover:bg-[#9BB89F] text-white dark:text-black font-semibold disabled:opacity-30 disabled:cursor-not-allowed transition-colors shadow-xs flex items-center justify-center touch-target"
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatComposer;
