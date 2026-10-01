import React, { useContext, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../../../context/Context";
import { useAuth } from "../../../context/AuthContext";
import API_BASE_URL from "../../../api/config.js";
import { fetchWithAuth } from "../../../api/fetchWithAuth";
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from "framer-motion";
import { 
  Sparkles, 
  Clock, 
  AlertTriangle, 
  Lightbulb, 
  ChevronRight, 
  HelpCircle, 
  Layers, 
  BrainCircuit, 
  Network, 
  Headphones, 
  FileText, 
  ArrowRight,
  Flame,
  BookOpen,
  CheckCircle2,
  Plus,
  Compass,
  Zap,
  Target,
  Play,
  RotateCcw,
  Sparkle,
  Radio,
  Volume2,
  Folder,
  BarChart2
} from "lucide-react";

import Card, { CardHeader, CardContent } from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import Tooltip from "../../../components/ui/Tooltip";
import ChatMessage from "../components/ChatMessage";
import ChatComposer from "../components/ChatComposer";
import CitationDrawer from "../components/CitationDrawer";

const ChatPage = () => {
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
    fetchDocuments,
    studyStats,
    language,
    triggerStudyTool,
    clearChat,
    t
  } = useContext(Context);

  const { user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("human"); // "human" (analogies/socratic) | "surgical" (exam/strict)
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [selectedCitation, setSelectedCitation] = useState(null);
  const [insights, setInsights] = useState(null);
  const [podcasts, setPodcasts] = useState([]);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [activeTab, setActiveTab] = useState("focus"); // "focus" | "tools" | "library" | "media"
  const [viewMode, setViewMode] = useState("tabs"); // "tabs" | "all"
  const [showStepProtocol, setShowStepProtocol] = useState(false);

  const chatBottomRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      fetchDocuments(user.id);
      loadStudentInsights();
      loadPodcasts();
    }
  }, [user]);

  const loadStudentInsights = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/student-insights`);
      if (res.ok) {
        const data = await res.json();
        setInsights(data);
      }
    } catch (e) {
      console.warn("Could not load student insights for dashboard:", e);
    } finally {
      setLoadingInsights(false);
    }
  };

  const loadPodcasts = async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/podcasts`);
      if (res.ok) {
        const data = await res.json();
        setPodcasts(data);
      }
    } catch (e) {
      console.warn("Could not load podcasts for dashboard:", e);
    }
  };

  // Auto scroll to latest message in chat view (see where we left off)
  useEffect(() => {
    if (showResults && chatBottomRef.current) {
      const timer = setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [messages, loading, showResults]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const textToSend = input.trim();
    setInput(""); // Clear textarea and reset input immediately!
    const docIdsToSend = selectedDocIds.length > 0 ? selectedDocIds : [];
    const scope = selectedDocIds.length > 0 ? "LIBRARY" : "GLOBAL";
    onSent(language, user?.id, docIdsToSend, mode, textToSend, scope);
  };

  const handleToggleDoc = (docId) => {
    setSelectedDocIds(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  // Connected Learning Workflow: Route chat response into Study Tools with structured handoff
  const handleChatAction = (tool, handoffPayload) => {
    if (triggerStudyTool) {
      triggerStudyTool(tool, handoffPayload);
    }
    const navState = { 
      state: { 
        handoff: handoffPayload, 
        documentId: handoffPayload?.document_ids?.[0],
        autoStart: true 
      } 
    };
    if (tool === 'quiz') {
      navigate('/quiz', navState);
    } else if (tool === 'flashcards') {
      navigate('/flashcards', navState);
    } else if (tool === 'feynman') {
      navigate('/feynman', navState);
    } else if (tool === 'mindmap') {
      navigate('/mindmap', navState);
    } else if (tool === 'answer-planner' || tool === 'planner') {
      navigate('/answer-planner', navState);
    }
  };

  const handleUploadFile = async (file) => {
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('files', file);
      formData.append('file', file);
      formData.append('user_id', user?.id || 1);
      formData.append('subject', 'General');

      const response = await fetchWithAuth(`${API_BASE_URL}/upload-document`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const results = await response.json();
        toast.success(`"${file.name}" attached to study context!`);
        if (user?.id) fetchDocuments(user.id);
        const newId = Array.isArray(results) ? results[0]?.id : results?.id;
        if (newId) {
          setSelectedDocIds(prev => [...prev, newId]);
        }
      } else {
        toast.error('Failed to upload file');
      }
    } catch (err) {
      console.error("Failed to upload file from composer", err);
      toast.error('Network error during file upload');
    }
  };

  const handleSuggestionClick = (prompt) => {
    setInput(prompt);
    const docIdsToSend = selectedDocIds.length > 0 ? selectedDocIds : [];
    const scope = selectedDocIds.length > 0 ? "LIBRARY" : "GLOBAL";
    onSent(language, user?.id, docIdsToSend, mode, prompt, scope);
  };

  const userName = user?.name || "Scholar";

  // Dynamic time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("goodMorning", "Good morning");
    if (hour < 18) return t("goodAfternoon", "Good afternoon");
    return t("goodEvening", "Good evening");
  };

  // Live telemetry fallbacks
  const recAction = insights?.recommended_action || {
    topic: "Operating Systems",
    subtopic: "CPU Scheduling",
    mastery_score: 54,
    failed_questions_count: 3,
    cards_due_count: 8,
    study_plan_steps: [
      "Review core CPU scheduling algorithms (Round Robin vs SJF)",
      "Targeted 5-question diagnostic quiz on turnaround time calculation",
      "Consolidate trade-offs with Feynman simple explanation challenge"
    ],
    primary_tool: "quiz",
    why_recommendation: "Based on 3 recent quiz mistakes and 8 due flashcards threatening memory retention.",
    action_payload: {
      tool: "quiz",
      topic: "Operating Systems — CPU Scheduling",
      difficulty: "medium",
      mode: "surgical"
    }
  };

  const health = insights?.learning_health || {
    overall_mastery: 82,
    mastery_change_pct: 6,
    quiz_accuracy: 74,
    cards_retained: 142,
    cards_due_today: 8,
    study_streak_days: studyStats?.streak || 1,
    total_study_time_minutes: 860
  };

  const latestPodcast = podcasts.length > 0 ? podcasts[0] : null;
  const latestEpisode = latestPodcast && Array.isArray(latestPodcast.episodes) && latestPodcast.episodes.length > 0
    ? latestPodcast.episodes[0]
    : (latestPodcast?.episodes && typeof latestPodcast.episodes === 'object' ? Object.values(latestPodcast.episodes)[0] : null);

  const handleLaunchRecovery = (rec) => {
    if (!rec) return;
    const tool = rec.primary_tool || "quiz";
    const payload = rec.action_payload || {
      tool,
      topic: `${rec.topic} — ${rec.subtopic}`,
      difficulty: "medium",
      mode: "surgical"
    };
    handleChatAction(tool, payload);
  };

  return (
    <div className="relative flex flex-col h-full w-full overflow-hidden">
      {/* Citation Slide-over Drawer */}
      <CitationDrawer
        citation={selectedCitation}
        onClose={() => setSelectedCitation(null)}
      />

      {/* VIEW A: CHAT-FIRST CONVERSATION STREAM */}
      {showResults ? (
        <div className="flex flex-col h-full w-full overflow-hidden">
          {/* Top Chat Subheader */}
          <div className="w-full max-w-5xl mx-auto px-3.5 sm:px-6 flex items-center justify-between pb-2.5 sm:pb-3 border-b border-[var(--border)] mb-2 shrink-0 pt-2.5 sm:pt-3">
            <div className="flex items-center gap-2">
              <Badge variant="sage" size="md">
                Shiro AI Tutor
              </Badge>
              <span className="text-xs text-[var(--text-secondary)] hidden xs:inline">
                {mode === 'human' ? t("humanTutor", "Human Tutor") : t("surgicalMode", "Surgical Exam Mode")}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm("Start a new conversation?")) {
                      clearChat();
                    }
                  }}
                  title="Clear conversation"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  <span>New Chat</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResults(false)}
              >
                Back to Overview
              </Button>
            </div>
          </div>

          {/* Messages Stream Container (Scrollbar on Right Edge) */}
          <div className="flex-1 w-full overflow-y-auto custom-scroll touch-scroll">
            <div className="max-w-4xl mx-auto px-3.5 sm:px-6 py-2 space-y-2">
              {messages.map((msg, index) => (
                <ChatMessage
                  key={index}
                  message={msg}
                  isLatest={index === messages.length - 1}
                  onCitationClick={(citation) => setSelectedCitation(citation)}
                  onRegenerate={() => {
                    if (messages.length >= 2) {
                      const lastUserMsg = [...messages].reverse().find(m => m.isUser);
                      if (lastUserMsg) {
                        onSent(language, user?.id, selectedDocIds, mode, lastUserMsg.text);
                      }
                    }
                  }}
                  onActionClick={handleChatAction}
                />
              ))}
              <div ref={chatBottomRef} />
            </div>
          </div>

          {/* Floating Bottom Composer */}
          <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 pt-2 sm:pt-3 pb-3 sm:pb-4 shrink-0">
            <ChatComposer
              input={input}
              setInput={setInput}
              onSend={handleSend}
              loading={loading}
              documents={documents}
              selectedDocIds={selectedDocIds}
              onToggleDoc={handleToggleDoc}
              onUploadFile={handleUploadFile}
              mode={mode}
              setMode={setMode}
            />
          </div>
        </div>
      ) : (
        /* VIEW B: CLEAN & FOCUSED STUDY DASHBOARD */
        <div className="flex-1 w-full overflow-y-auto custom-scroll touch-scroll">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 pb-20">
            
            {/* 1. EDITORIAL HEADER */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1"
            >
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-main)] tracking-tight font-serif">
                  {getGreeting()}, {userName}.
                </h1>
                <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
                  {t("masteringPrompt", "What would you like to master today?")}
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <button
                  onClick={() => navigate('/progress-report')}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border)] hover:border-[var(--primary)]/40 text-xs transition-all shadow-2xs cursor-pointer group"
                  title="View complete mastery matrix and insights"
                >
                  <span className="w-2 h-2 rounded-full bg-[#16A34A] dark:bg-[#4ADE80] animate-pulse" />
                  <span className="font-semibold text-[var(--text-main)]">
                    {health.overall_mastery}% Mastery
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-main)] group-hover:translate-x-0.5 transition-transform" />
                </button>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/documents')}
                  className="group/upload"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t("uploadMaterial", "Upload Notes")}</span>
                </Button>
              </div>
            </motion.div>

            {/* 2. SPOTLIGHT AI ASK CENTER (HERO ELEMENT) */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="w-full space-y-2.5"
            >
              <div className="tour-chat-input">
                <ChatComposer
                  input={input}
                  setInput={setInput}
                  onSend={handleSend}
                  loading={loading}
                  documents={documents}
                  selectedDocIds={selectedDocIds}
                  onToggleDoc={handleToggleDoc}
                  onUploadFile={handleUploadFile}
                  mode={mode}
                  setMode={setMode}
                  onFocusExpand={() => {
                    if (messages.length > 0) {
                      setShowResults(true);
                    }
                  }}
                  placeholder={t("composerPlaceholder", "Ask Shiro anything about your notes, or type / for commands...")}
                />
              </div>

              {/* Dynamic Suggestions & Active Chat Pill */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                <div className="flex flex-wrap items-center gap-1.5 bento-hover">
                  <span className="text-[var(--text-muted)] font-medium flex items-center gap-1 font-mono text-[11px] mr-1">
                    <Sparkles className="w-3 h-3 text-[#D6A84F]" />
                    <span>Suggestions:</span>
                  </span>
                  {[
                    {
                      label: `Sprint: ${recAction.topic}`,
                      icon: Target,
                      action: () => handleLaunchRecovery(recAction)
                    },
                    {
                      label: `Clear ${health.cards_due_today} Due Cards`,
                      icon: Layers,
                      action: () => navigate('/flashcards', { state: { filter: "due" } })
                    },
                    {
                      label: `Explain ${recAction.topic} Simply`,
                      icon: BrainCircuit,
                      action: () => handleSuggestionClick(`Explain ${recAction.topic} intuitively using the Feynman technique.`)
                    },
                    {
                      label: "5-Min Diagnostic Quiz",
                      icon: HelpCircle,
                      action: () => navigate('/quiz')
                    }
                  ].map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={item.action}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border)] hover:border-[var(--primary)] text-[var(--text-secondary)] hover:text-[var(--primary)] transition-all text-xs shadow-2xs cursor-pointer"
                      >
                        <Icon className="w-3 h-3 text-[var(--text-muted)]" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                {messages.length > 0 && (
                  <button
                    onClick={() => setShowResults(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--primary-subtle)] hover:bg-[var(--primary)]/20 border border-[var(--primary)]/30 text-[var(--primary-strong)] text-xs font-medium transition-all cursor-pointer ml-auto"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Resume Chat ({messages.filter(m => m.isUser).length} turns)</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </motion.div>

            {/* 3. SEGMENTED ACTIVITY HUB BAR */}
            <div className="flex items-center justify-between border-b border-[var(--border)] pt-2 pb-2 gap-2 flex-wrap">
              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto custom-scroll py-0.5">
                {[
                  { id: "focus", label: "Today's Focus", icon: Target, count: null },
                  { id: "tools", label: "Study Toolkit", icon: Compass, count: "6" },
                  { id: "library", label: "Recent Notes", icon: BookOpen, count: documents.length > 0 ? `${documents.length}` : null },
                  { id: "media", label: "Audio & Memory", icon: Radio, count: health.cards_due_today > 0 ? `${health.cards_due_today}` : null },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        if (viewMode === 'all') setViewMode('tabs');
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                        isActive && viewMode === 'tabs'
                          ? "bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border border-[var(--border)] shadow-2xs"
                          : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-surface)]"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive && viewMode === 'tabs' ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}`} />
                      <span>{tab.label}</span>
                      {tab.count && (
                        <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                          isActive && viewMode === 'tabs'
                            ? "bg-[var(--primary-subtle)] text-[var(--primary)]" 
                            : "bg-[var(--bg-surface)] text-[var(--text-muted)]"
                        }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                <button
                  onClick={() => setViewMode(prev => prev === 'tabs' ? 'all' : 'tabs')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                  title="Toggle between single tab focus and full dashboard scroll"
                >
                  <Layers className="w-3 h-3" />
                  <span>{viewMode === 'tabs' ? 'View All' : 'Tabbed View'}</span>
                </button>
              </div>
            </div>

            {/* 4. ACTIVITY CONTENT */}
            <AnimatePresence mode="wait">
              {(viewMode === 'all' || activeTab === 'focus') && (
                <motion.div
                  key="focus-section"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch"
                >
                  {/* Dominant Hero Card: High Recovery Priority (7 cols) */}
                  <div className="lg:col-span-7 p-5 sm:p-6 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xs flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#C96B62] uppercase tracking-wider font-mono">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>High Recovery Priority</span>
                        </div>
                        <Badge variant={recAction.mastery_score >= 65 ? "gold" : "rose"} size="sm">
                          {recAction.mastery_score}% Mastery
                        </Badge>
                      </div>

                      <div>
                        <h3 className="text-lg sm:text-xl font-bold text-[var(--text-main)] font-serif tracking-tight">
                          {recAction.topic} {recAction.subtopic ? `· ${recAction.subtopic}` : ""}
                        </h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                          {recAction.why_recommendation}
                        </p>
                      </div>

                      {/* Telemetry Chips */}
                      <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                        <span className="px-2.5 py-0.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border)] font-mono text-[11px] text-[var(--text-secondary)]">
                          {recAction.failed_questions_count} recent mistakes
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border)] font-mono text-[11px] text-[var(--text-secondary)]">
                          {recAction.cards_due_count} flashcards due
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-[var(--bg-surface-elevated)] border border-[var(--border)] font-mono text-[11px] text-[var(--text-secondary)]">
                          Target: {recAction.primary_tool?.toUpperCase()}
                        </span>
                      </div>

                      {/* Expandable 3 Step Adaptive Sequence */}
                      <div className="pt-2 border-t border-[var(--border)]">
                        <button
                          onClick={() => setShowStepProtocol(prev => !prev)}
                          className="flex items-center justify-between w-full text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                        >
                          <span>3-Step Adaptive Protocol</span>
                          <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${showStepProtocol ? 'rotate-90' : ''}`} />
                        </button>
                        {showStepProtocol && (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs pt-2 mt-1">
                            {recAction.study_plan_steps.map((step, idx) => (
                              <div key={idx} className="p-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] space-y-1">
                                <span className="text-[10px] font-mono font-bold text-[#89A88D]">0{idx + 1}</span>
                                <p className="text-[11px] text-[var(--text-main)] leading-snug line-clamp-2">{step}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between gap-3 border-t border-[var(--border)]">
                      <Button
                        variant="primary"
                        size="sm"
                        className="w-full sm:w-auto justify-center font-semibold text-xs"
                        onClick={() => handleLaunchRecovery(recAction)}
                      >
                        <span>Start Recovery Session</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-[var(--text-secondary)]"
                        onClick={() => navigate('/progress-report')}
                      >
                        <span>Decision Center →</span>
                      </Button>
                    </div>
                  </div>

                  {/* Right Card: Today's Mission & Retention Snapshot (5 cols) */}
                  <div className="lg:col-span-5 p-5 sm:p-6 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xs flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-xl bg-[var(--primary-subtle)] text-[var(--primary)] flex items-center justify-center shrink-0">
                            <Target className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-[var(--text-main)] font-serif">Today's Study Mission</h4>
                            <span className="text-[10px] font-mono text-[var(--text-muted)]">2 of 3 Completed</span>
                          </div>
                        </div>
                        <Badge variant="sage" size="sm">
                          Active
                        </Badge>
                      </div>

                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {insights?.headline_takeaway || "Consistency drives long-term memory stability. Complete your remaining memory review."}
                      </p>

                      {/* Progress Items */}
                      <div className="space-y-2 pt-1">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-[#16A34A] dark:text-[#4ADE80]" />
                            <span className="text-[var(--text-secondary)]">Study Time</span>
                          </div>
                          <span className="font-mono font-semibold text-[var(--text-main)]">
                            {Math.min(25, Math.round(health.total_study_time_minutes / 20) || 18)} / 25m
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border-2 border-[#F59E0B] flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                            </div>
                            <span className="text-[var(--text-secondary)]">Memory Due</span>
                          </div>
                          <span className="font-mono font-semibold text-[var(--text-main)]">
                            {health.cards_due_today} cards
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-[var(--primary)]" />
                            <span className="text-[var(--text-secondary)]">Daily Quiz</span>
                          </div>
                          <span className="font-semibold text-[var(--primary)] text-xs">Verified</span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-center text-xs font-semibold"
                        onClick={() => navigate('/flashcards', { state: { filter: "due" } })}
                      >
                        <span>Review Flashcards ({health.cards_due_today})</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {(viewMode === 'all' || activeTab === 'tools') && (
                <motion.div
                  key="tools-section"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 pt-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-[#3F6048] dark:text-[#89A88D]" />
                      <h2 className="text-sm sm:text-base font-bold text-[var(--text-main)] uppercase tracking-wider font-serif">
                        {t("studySuite", "Your Study Toolkit")}
                      </h2>
                    </div>
                    <span className="text-xs text-[var(--text-muted)] hidden sm:inline">
                      {t("studySuiteDesc", "Connected tools to turn static reading into active recall.")}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {[
                      { title: "Quiz Arena", desc: "Active recall MCQs", icon: HelpCircle, route: "/quiz", color: "text-[#3F6048] dark:text-[#89A88D]", bg: "bg-[#E8EFE9] dark:bg-[#89A88D]/10" },
                      { title: "Flashcards", desc: "FSRS spaced memory", icon: Layers, route: "/flashcards", badge: health.cards_due_today > 0 ? `${health.cards_due_today}` : null, color: "text-[#D6A84F]", bg: "bg-[#F4E9CC] dark:bg-[#D6A84F]/10" },
                      { title: "Feynman Mode", desc: "Socratic critique", icon: BrainCircuit, route: "/feynman", color: "text-[#3F6048] dark:text-[#89A88D]", bg: "bg-[#E8EFE9] dark:bg-[#89A88D]/10" },
                      { title: "Mind Maps", desc: "Concept hierarchy", icon: Network, route: "/mindmap", color: "text-[#D6A84F]", bg: "bg-[#F4E9CC] dark:bg-[#D6A84F]/10" },
                      { title: "Audio Lab", desc: "Episodic casts", icon: Headphones, route: "/audio-summary", color: "text-[#3F6048] dark:text-[#62816A]", bg: "bg-[#E8EFE9] dark:bg-[#62816A]/10" },
                      { title: "Study Rooms", desc: "Focus & peers", icon: Play, route: "/study-rooms", color: "text-[#3F6048] dark:text-[#89A88D]", bg: "bg-[#E8EFE9] dark:bg-[#89A88D]/10" },
                    ].map((tool, idx) => {
                      const IconComponent = tool.icon;
                      return (
                        <div
                          key={idx}
                          onClick={() => navigate(tool.route)}
                          className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] hover:border-[#89A88D]/50 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between h-32 group"
                        >
                          <div className="flex items-center justify-between">
                            <div className={`p-2 rounded-xl ${tool.bg} border border-[var(--border)] ${tool.color}`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            {tool.badge && (
                              <span className="px-1.5 py-0.5 rounded-md bg-[#D6A84F]/20 text-[#D6A84F] text-[10px] font-mono font-bold">
                                {tool.badge}
                              </span>
                            )}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-main)] group-hover:text-[#89A88D] transition-colors">
                              {tool.title}
                            </h4>
                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{tool.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {(viewMode === 'all' || activeTab === 'library') && (
                <motion.div
                  key="library-section"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3 pt-1"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#89A88D]" />
                      <h2 className="text-sm sm:text-base font-bold text-[var(--text-main)] uppercase tracking-wider font-serif">
                        {t("recentDocs", "Recent Study Documents")}
                      </h2>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate('/documents')} className="text-xs">
                      {t("viewAll", "View Library")} ({documents.length})
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>

                  {documents.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {documents.slice(0, 6).map((doc) => (
                        <div
                          key={doc.id}
                          onClick={() => navigate(`/documents/${doc.id}`)}
                          className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] hover:border-[#89A88D]/40 transition-all cursor-pointer shadow-xs flex items-center justify-between gap-3 group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2.5 rounded-xl bg-[#89A88D]/10 border border-[#89A88D]/20 text-[#89A88D] shrink-0">
                              <BookOpen className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-[var(--text-main)] truncate group-hover:text-[#89A88D] transition-colors">
                                {doc.filename}
                              </h4>
                              <p className="text-[11px] text-[var(--text-muted)] font-mono">{doc.subject || 'General'}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 rounded-3xl border border-dashed border-[var(--border)] bg-[var(--bg-surface)] text-center space-y-3">
                      <div className="w-10 h-10 rounded-2xl bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] flex items-center justify-center mx-auto">
                        <Folder className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--text-main)]">No notes uploaded yet</h4>
                        <p className="text-xs text-[var(--text-muted)] mt-1">Upload lecture notes, slides, or PDFs to start contextual AI tutoring.</p>
                      </div>
                      <Button variant="primary" size="sm" onClick={() => navigate('/documents')}>
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Upload First Note
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}

              {(viewMode === 'all' || activeTab === 'media') && (
                <motion.div
                  key="media-section"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1"
                >
                  {/* Audio Lab "Continue Listening" Widget */}
                  <div
                    onClick={() => navigate('/audio-summary')}
                    className="p-5 sm:p-6 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[#89A88D]/40 transition-all cursor-pointer shadow-xs space-y-4 group flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#89A88D] uppercase tracking-wider font-mono">
                          <Radio className="w-3.5 h-3.5 animate-pulse" />
                          <span>Shiro Audio Lab</span>
                        </div>
                        {latestPodcast?.subject && (
                          <span className="px-2 py-0.5 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[10px] font-mono text-[var(--text-secondary)]">
                            {latestPodcast.subject}
                          </span>
                        )}
                      </div>

                      {latestPodcast ? (
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-[#3F6048] to-[#89A88D] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                            <Volume2 className="w-6 h-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-bold text-[var(--text-main)] truncate font-serif">
                              {latestPodcast.name || latestPodcast.title}
                            </h4>
                            <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5">
                              {latestEpisode?.title || `${latestPodcast.total_episodes || 1} Episode Series`}
                            </p>
                          </div>
                          <Button variant="primary" size="sm" className="shrink-0 rounded-xl">
                            <Play className="w-3.5 h-3.5 fill-current" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 py-2">
                          <div className="w-10 h-10 rounded-2xl bg-[#89A88D]/15 text-[#89A88D] flex items-center justify-center shrink-0">
                            <Headphones className="w-5 h-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold text-[var(--text-main)]">Shiro Audio Lab</h4>
                            <p className="text-[11px] text-[var(--text-muted)]">Synthesize episodic dual-host audio from your notes</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
                        </div>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-center text-xs font-semibold"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/audio-summary');
                      }}
                    >
                      <span>Open Audio Lab</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>

                  {/* Spaced Repetition (FSRS) Card */}
                  <div
                    onClick={() => navigate('/flashcards', { state: { filter: "due" } })}
                    className="p-5 sm:p-6 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[#D6A84F]/40 transition-all cursor-pointer shadow-xs space-y-4 flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-[#D6A84F] uppercase tracking-wider font-mono">
                          <Layers className="w-3.5 h-3.5" />
                          <span>Memory & Retention</span>
                        </div>
                        <Badge variant="gold" size="sm">
                          {health.cards_due_today} Due Today
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[var(--text-secondary)]">Active Retention Target</span>
                          <span className="font-mono font-bold text-[#D6A84F]">
                            {health.retention_rate || 85}%
                          </span>
                        </div>
                        <div className="w-full bg-[var(--bg-surface-elevated)] h-2 rounded-full overflow-hidden border border-[var(--border)]">
                          <div
                            className="bg-[#D6A84F] h-full rounded-full transition-all duration-700"
                            style={{ width: `${Math.min(100, health.retention_rate || 85)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono pt-0.5">
                          <span>{health.cards_retained} cards active</span>
                          <span>FSRS Spaced Repetition</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full justify-center text-xs font-semibold"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/flashcards', { state: { filter: "due" } });
                      }}
                    >
                      <span>Review Due Cards ({health.cards_due_today})</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
