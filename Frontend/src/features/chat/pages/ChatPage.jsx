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
  Sparkle
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
    t
  } = useContext(Context);

  const { user } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("human"); // "human" (analogies/socratic) | "surgical" (exam/strict)
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [selectedCitation, setSelectedCitation] = useState(null);

  const chatBottomRef = useRef(null);

  useEffect(() => {
    if (user?.id) {
      fetchDocuments(user.id);
    }
  }, [user]);

  // Auto scroll to latest message in chat view
  useEffect(() => {
    if (showResults && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, showResults]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    const docIdsToSend = selectedDocIds.length > 0 ? selectedDocIds : documents.map(d => d.id);
    onSent(language, user?.id, docIdsToSend, mode, input);
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
    const navState = { state: { handoff: handoffPayload, documentId: handoffPayload?.document_ids?.[0] } };
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
    const docIdsToSend = selectedDocIds.length > 0 ? selectedDocIds : documents.map(d => d.id);
    onSent(language, user?.id, docIdsToSend, mode, prompt);
  };

  const userName = user?.name || "Scholar";

  // Dynamic time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t("goodMorning", "Good morning");
    if (hour < 18) return t("goodAfternoon", "Good afternoon");
    return t("goodEvening", "Good evening");
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
          <div className="w-full max-w-5xl mx-auto px-4 md:px-6 flex items-center justify-between pb-3 border-b border-[var(--border)] mb-2 shrink-0 pt-3">
            <div className="flex items-center gap-2">
              <Badge variant="sage" size="md">
                Shiro AI Tutor
              </Badge>
              <span className="text-xs text-[var(--text-secondary)]">
                {mode === 'human' ? t("humanTutor", "Human Tutor") : t("surgicalMode", "Surgical Exam Mode")}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowResults(false)}
            >
              Back to Overview
            </Button>
          </div>

          {/* Messages Stream Container (Scrollbar on Right Edge) */}
          <div className="flex-1 w-full overflow-y-auto custom-scroll">
            <div className="max-w-4xl mx-auto px-4 md:px-6 py-2 space-y-2">
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
          <div className="w-full max-w-4xl mx-auto px-4 md:px-6 pt-3 pb-4 shrink-0">
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
        /* VIEW B: HIGH-IMPACT STUDENT INTELLIGENCE DASHBOARD */
        <div className="flex-1 w-full overflow-y-auto custom-scroll">
          <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6 pb-20">
            {/* 1. Hero Header Banner */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-[#3F6048] dark:text-[#A8C5AC] mb-1 tracking-widest uppercase font-mono">
                <span className="w-2 h-2 rounded-full bg-[#3F6048] dark:bg-[#89A88D] animate-pulse" />
                <span>{t("activeCognition", "ACTIVE LEARNING")}</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-[var(--text-main)] tracking-tight font-serif">
                {getGreeting()}, {userName}.{" "}
                <span className="italic font-normal text-[var(--text-secondary)] block sm:inline">
                  {t("masteringPrompt", "What are we mastering today?")}
                </span>
              </h1>
            </div>

            <div className="flex items-center gap-2.5">
              <Tooltip text="Daily Study Consistency Streak">
                <Badge variant="gold" size="md" icon={Flame}>
                  {studyStats?.streak || 1} {t("dayStreak", "Day Streak")}
                </Badge>
              </Tooltip>

              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/documents')}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t("uploadMaterial", "Upload Material")}</span>
              </Button>
            </div>
          </motion.div>

          {/* 2. Centralized Search / Chat Composer */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="w-full space-y-3"
          >
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
              placeholder={t("composerPlaceholder", "Ask Shiro anything about your notes, or type / for commands...")}
            />

            {/* Quick Inspiration Action Command Chips */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
              <span className="text-[var(--text-muted)] font-medium flex items-center gap-1 font-mono text-[11px]">
                <Zap className="w-3 h-3 text-[#D6A84F]" />
                {t("quickActions", "Quick actions:")}
              </span>
              {[
                { label: t("summarizeFormulas", "Summarize key formulas"), icon: FileText },
                { label: t("explainIntuitively", "Explain concept intuitively"), icon: BrainCircuit },
                { label: t("generateMcqs", "Generate 5 practice MCQs"), icon: HelpCircle },
                { label: t("testWeakest", "Test my weakest topic"), icon: Target },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(item.label)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-surface)] hover:bg-[#E8EFE9] dark:hover:bg-[#89A88D]/15 border border-[var(--border)] hover:border-[#3F6048]/30 dark:hover:border-[#89A88D]/40 text-[var(--text-secondary)] hover:text-[#3F6048] dark:hover:text-[#A8C5AC] transition-all text-xs shadow-sm hover:scale-[1.01]"
                  >
                    <Icon className="w-3 h-3 text-[var(--text-muted)] group-hover:text-[#3F6048]" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>

          {/* 3. Primary Student Intelligence Bento Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Bento Card 1: What to Study Next */}
            <Card
              className="md:col-span-2 border-[var(--border)] bg-[var(--bg-surface)]"
              onClick={() => navigate('/study-plan')}
            >
              <CardHeader
                title={t("whatToStudyNext", "What to Study Next")}
                subtitle={t("whatToStudySubtitle", "Personalized recommendation based on your recent activity")}
                icon={Lightbulb}
                action={
                  <Badge variant="sage" size="sm">
                    {t("highPriority", "High Retention Priority")}
                  </Badge>
                }
              />
              <CardContent className="space-y-3">
                <p className="text-[var(--text-main)] text-sm leading-relaxed">
                  {t("whatToStudyBody", "Focus on Neural Network Optimization & Gradient Descent from your uploaded machine learning notes to reinforce concepts before your next scheduled review.")}
                </p>
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); navigate('/quiz'); }}
                  >
                    <span>{t("startQuiz", "Start 5-Min Quiz")}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); navigate('/feynman'); }}
                  >
                    <span>{t("feynmanChallenge", "Feynman Challenge")}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => { e.stopPropagation(); navigate('/mindmap'); }}
                  >
                    <span>{t("viewMindmap", "View Mind Map")}</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Bento Card 2: Spaced Repetition Due Queue */}
            <Card
              className="border-[var(--border)] bg-[var(--bg-surface)]"
              onClick={() => navigate('/flashcards')}
            >
              <CardHeader
                title={t("spacedRepetition", "Spaced Repetition")}
                subtitle={t("sm2Subtitle", "SM-2 Memory Recall Queue")}
                icon={Layers}
                action={
                  <Badge variant="gold" size="sm">
                    30 {t("dueToday", "Due Today")}
                  </Badge>
                }
              />
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>{t("targetRetention", "Target Retention")}</span>
                  <span className="font-semibold text-[#D6A84F]">85% Accuracy</span>
                </div>
                <div className="w-full bg-[var(--bg-surface-elevated)] h-2 rounded-full overflow-hidden border border-[var(--border)]">
                  <div className="bg-[#D6A84F] h-full w-[73%] rounded-full" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                >
                  {t("reviewCardsNow", "Review Cards Now")}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 4. Your Study Toolkit */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#3F6048] dark:text-[#89A88D]" />
                <h2 className="text-xs md:text-sm font-bold text-[var(--text-main)] uppercase tracking-wider font-serif">
                  {t("studySuite", "Your Study Toolkit")}
                </h2>
              </div>
              <span className="text-xs text-[var(--text-muted)]">{t("studySuiteDesc", "Everything you need to turn notes into active learning.")}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              {[
                { title: t("quizArenaTitle", "Quiz Arena"), desc: t("quizArenaDesc", "Active recall MCQs"), icon: HelpCircle, route: "/quiz", color: "text-[#3F6048] dark:text-[#89A88D]", bg: "bg-[#E8EFE9] dark:bg-[#89A88D]/10" },
                { title: t("flashcardsTitle", "Flashcards"), desc: t("flashcardsDesc", "SM-2 3D review"), icon: Layers, route: "/flashcards", color: "text-[#3F6048] dark:text-[#62816A]", bg: "bg-[#E8EFE9] dark:bg-[#62816A]/10" },
                { title: t("feynmanTitle", "Feynman Mode"), desc: t("feynmanDesc", "Socratic critique"), icon: BrainCircuit, route: "/feynman", color: "text-[#3F6048] dark:text-[#89A88D]", bg: "bg-[#E8EFE9] dark:bg-[#89A88D]/10" },
                { title: t("mindmapsTitle", "Mind Maps"), desc: t("mindmapsDesc", "Concept hierarchy"), icon: Network, route: "/mindmap", color: "text-[#D6A84F]", bg: "bg-[#F4E9CC] dark:bg-[#D6A84F]/10" },
                { title: t("audioCastTitle", "Audio Cast"), desc: t("audioCastDesc", "Listen on the go"), icon: Headphones, route: "/audio-summary", color: "text-[#3F6048] dark:text-[#62816A]", bg: "bg-[#E8EFE9] dark:bg-[#62816A]/10" },
                { title: t("studyRoomsTitle", "Study Rooms"), desc: t("studyRoomsDesc", "Dual-pane focus"), icon: Play, route: "/study-rooms", color: "text-[#3F6048] dark:text-[#89A88D]", bg: "bg-[#E8EFE9] dark:bg-[#89A88D]/10" },
              ].map((tool, idx) => {
                const IconComponent = tool.icon;
                return (
                  <Card
                    key={idx}
                    onClick={() => navigate(tool.route)}
                    className="p-3.5 flex flex-col justify-between h-32 hover:-translate-y-0.5 cursor-pointer border-[var(--border)] hover:border-[#3F6048]/30 dark:hover:border-[#89A88D]/40 transition-all bg-[var(--bg-surface)] hover:shadow-md"
                  >
                    <div className={`p-2 rounded-xl ${tool.bg} border border-[var(--border)] w-fit ${tool.color}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-[var(--text-main)]">{tool.title}</h4>
                      <p className="text-[11px] text-[var(--text-muted)]">{tool.desc}</p>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* 5. Recent Documents Shelf */}
          {documents.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#89A88D]" />
                  <h2 className="text-xs md:text-sm font-semibold text-[var(--text-main)] uppercase tracking-wider">
                    {t("recentDocs", "Recent Study Documents")}
                  </h2>
                </div>
                <Button variant="ghost" size="sm" onClick={() => navigate('/documents')}>
                  {t("viewAll", "View Library")} ({documents.length})
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {documents.slice(0, 3).map((doc) => (
                  <Card
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    className="p-3.5 flex items-center justify-between cursor-pointer border-[var(--border)] hover:border-[#89A88D]/40 bg-[var(--bg-surface)]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-[#89A88D]/10 border border-[#89A88D]/20 text-[#89A88D] shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-[var(--text-main)] truncate">{doc.filename}</h4>
                        <p className="text-[11px] text-[var(--text-muted)]">{doc.subject || 'General'}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                  </Card>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPage;
