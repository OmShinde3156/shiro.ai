import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine
} from "recharts";
import { motion } from "framer-motion";
import {
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Clock,
  Target,
  Layers,
  Sparkles,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  Play,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Brain,
  RotateCcw,
  Compass,
  CheckCircle2,
  Calendar
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { Context } from "../../../context/Context";
import API_BASE_URL from "../../../api/config.js";
import { fetchWithAuth } from "../../../api/fetchWithAuth";
import Badge from "../../../components/ui/Badge";
import Button from "../../../components/ui/Button";
import "./progressreport.css";

export const ProgressReport = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { triggerStudyTool } = useContext(Context);

  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWhy, setShowWhy] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState("month"); // "week" | "month" | "quarter" | "year"

  useEffect(() => {
    fetchStudentInsights();
  }, [user]);

  const fetchStudentInsights = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/student-insights`);
      if (response.ok) {
        const data = await response.json();
        setInsights(data);
      } else {
        // Fallback to legacy progress endpoint
        const legacyRes = await fetchWithAuth(`${API_BASE_URL}/progress`);
        if (legacyRes.ok) {
          const legacy = await legacyRes.json();
          setInsights({
            is_demo: true,
            headline_takeaway: "You're improving steadily (+6% this month). Your biggest opportunity is Operating Systems.",
            learning_health: {
              overall_mastery: legacy.average_score || 82,
              mastery_change_pct: 6,
              quiz_accuracy: legacy.average_score || 73,
              retention_rate: 85.0,
              is_retention_estimated: true,
              cards_retained: legacy.flashcards_studied || 142,
              cards_due_today: 8,
              total_study_time_minutes: 860,
              study_time_label: "Estimated Study Time",
              study_streak_days: legacy.study_streak || 7,
              xp: legacy.xp || 240,
              level: legacy.level || 2
            },
            recommended_action: {
              topic: "Operating Systems",
              subtopic: "CPU Scheduling",
              mastery_score: 54,
              failed_questions_count: 3,
              cards_due_count: 8,
              study_plan_steps: [
                "5 min concept review of Operating Systems",
                "5 active-recall questions on missed concepts",
                "Feynman gap check on error patterns"
              ],
              primary_tool: "quiz",
              why_recommendation: "Based on 3 recent quiz mistakes, 8 due flashcards, and 54% mastery in Operating Systems.",
              document_id: null,
              action_payload: {
                tool: "quiz",
                topic: "Operating Systems — CPU Scheduling",
                difficulty: "medium",
                mode: "surgical"
              }
            },
            topic_matrix: [
              { subject: "Operating Systems", subtopic: "CPU Scheduling", mastery: 54, change: -4, status: "Needs Review", color_variant: "rose", failed_count: 3, cards_due: 8 },
              { subject: "Theory of Computation", subtopic: "Core Automata", mastery: 60, change: -8, status: "Needs Review", color_variant: "rose", failed_count: 2, cards_due: 4 },
              { subject: "Computer Networks", subtopic: "Transport Layer", mastery: 72, change: 14, status: "Developing", color_variant: "gold", failed_count: 1, cards_due: 2 },
              { subject: "DBMS", subtopic: "Indexing & SQL", mastery: 91, change: 8, status: "Mastered", color_variant: "sage", failed_count: 0, cards_due: 0 }
            ],
            performance_trend: {
              timeframe: "30D",
              points: [
                { date: "Aug 04", score: 68, milestone: "Diagnostic Baseline" },
                { date: "Aug 07", score: 70 },
                { date: "Aug 11", score: 72, milestone: "Studied OS Notes" },
                { date: "Aug 14", score: 74 },
                { date: "Aug 18", score: 77, milestone: "Active Recall Drill" },
                { date: "Aug 21", score: 79, milestone: "Flashcards Session" },
                { date: "Aug 25", score: 81 },
                { date: "Aug 28", score: 85, milestone: "Feynman Challenge" },
                { date: "Aug 31", score: 84 },
                { date: "Sep 02", score: 86, milestone: "Peak Mastery (86%)" },
                { date: "Sep 03", score: 88, milestone: "Latest Attempt" }
              ],
              timeframes: {
                week: [
                  { date: "Thu 28", score: 74, milestone: "Diagnostic Check" },
                  { date: "Fri 29", score: 76 },
                  { date: "Sat 30", score: 75 },
                  { date: "Sun 31", score: 78 },
                  { date: "Mon 01", score: 80 },
                  { date: "Tue 02", score: 82 },
                  { date: "Wed 03", score: 84, milestone: "High Score (84%)" }
                ],
                month: [
                  { date: "Aug 04", score: 68, milestone: "Diagnostic Baseline" },
                  { date: "Aug 07", score: 70 },
                  { date: "Aug 11", score: 72, milestone: "Studied OS Notes" },
                  { date: "Aug 14", score: 74 },
                  { date: "Aug 18", score: 77, milestone: "Active Recall Drill" },
                  { date: "Aug 21", score: 79, milestone: "Flashcards Session" },
                  { date: "Aug 25", score: 81 },
                  { date: "Aug 28", score: 85, milestone: "Feynman Challenge" },
                  { date: "Aug 31", score: 84 },
                  { date: "Sep 02", score: 86, milestone: "Peak Mastery (86%)" },
                  { date: "Sep 03", score: 88, milestone: "Latest Attempt" }
                ],
                quarter: [
                  { date: "Jun 15", score: 62, milestone: "Diagnostic Baseline" },
                  { date: "Jun 22", score: 65 },
                  { date: "Jun 29", score: 68 },
                  { date: "Jul 06", score: 71 },
                  { date: "Jul 13", score: 73 },
                  { date: "Jul 20", score: 77 },
                  { date: "Jul 27", score: 80, milestone: "Midterm Milestone" },
                  { date: "Aug 03", score: 82 },
                  { date: "Aug 10", score: 85 },
                  { date: "Aug 17", score: 87 },
                  { date: "Aug 24", score: 92, milestone: "Quarter High (92%)" },
                  { date: "Sep 03", score: 88 }
                ],
                year: [
                  { date: "Oct '25", score: 55, milestone: "Course Start" },
                  { date: "Nov '25", score: 58 },
                  { date: "Dec '25", score: 62 },
                  { date: "Jan '26", score: 66 },
                  { date: "Feb '26", score: 70 },
                  { date: "Mar '26", score: 75 },
                  { date: "Apr '26", score: 79, milestone: "Semester 1 Exam" },
                  { date: "May '26", score: 82 },
                  { date: "Jun '26", score: 86 },
                  { date: "Jul '26", score: 89 },
                  { date: "Aug '26", score: 95, milestone: "Annual Peak (95%)" },
                  { date: "Sep '26", score: 91 }
                ]
              }
            },
            consistency_grid: [
              { day: "Mon", full_day: "Monday", count: 4, intensity: 2 },
              { day: "Tue", full_day: "Tuesday", count: 6, intensity: 3 },
              { day: "Wed", full_day: "Wednesday", count: 3, intensity: 2 },
              { day: "Thu", full_day: "Thursday", count: 5, intensity: 3 },
              { day: "Fri", full_day: "Friday", count: 8, intensity: 4 },
              { day: "Sat", full_day: "Saturday", count: 4, intensity: 2 },
              { day: "Sun", full_day: "Sunday", count: 2, intensity: 1 }
            ],
            cognitive_peak: {
              time_range_label: "9 AM – 12 PM",
              efficiency: 88,
              confidence: "Moderate",
              data_points: 8
            },
            recent_activities: [
              { type: "quiz", title: "Completed Quiz — DBMS", details: "Score: 84% · 5 questions", timestamp: new Date().toISOString() },
              { type: "flashcards", title: "Reviewed 18 Flashcards", details: "Mastery +4%", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
              { type: "chat", title: "Asked Shiro about Deadlocks", details: "4 Coffman Conditions", timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() }
            ]
          });
        }
      }
    } catch (err) {
      console.error("Failed to load student insights:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchRecovery = (actionPayload) => {
    if (!actionPayload) return;
    const tool = actionPayload.tool || "quiz";
    const topic = actionPayload.topic || "Operating Systems";
    const docId = actionPayload.document_ids?.[0] || actionPayload.document_id || null;

    if (triggerStudyTool) {
      try {
        triggerStudyTool(tool, { topic, documentId: docId });
      } catch (e) {
        console.warn("triggerStudyTool failed, falling back to direct navigation:", e);
      }
    }

    if (tool === "quiz") {
      navigate("/quiz", { state: { topic, documentId: docId, mode: "surgical", difficulty: "medium" } });
    } else if (tool === "flashcards") {
      navigate("/flashcards", { state: { topic, filter: "due", documentId: docId } });
    } else if (tool === "feynman") {
      navigate("/feynman", { state: { topic, documentId: docId } });
    } else {
      navigate("/quiz", { state: { topic } });
    }
  };

  const handleStudySubject = (subj) => {
    navigate("/quiz", { state: { topic: subj.subject, documentId: subj.document_id, mode: "practice" } });
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-3 border-[var(--border)] border-t-[#89A88D] rounded-full animate-spin" />
        <p className="text-sm font-mono text-[var(--text-muted)] animate-pulse">
          Computing learning health and recovery pathways...
        </p>
      </div>
    );
  }

  const health = insights?.learning_health || {};
  const recommended = insights?.recommended_action;
  const topicMatrix = insights?.topic_matrix || [];
  const trendPoints = insights?.performance_trend?.points || [];
  const consistencyGrid = insights?.consistency_grid || [];
  const cognitivePeak = insights?.cognitive_peak || {};
  const recentActivities = insights?.recent_activities || [];
  const isDemo = insights?.is_demo;

  // Format hours and minutes
  const totalHours = Math.floor((health.total_study_time_minutes || 0) / 60);
  const totalMins = (health.total_study_time_minutes || 0) % 60;
  const timeFormatted = totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`;

  // Performance chart telemetry
  const allTimeframes = insights?.performance_trend?.timeframes || {};
  const activePoints = allTimeframes[selectedTimeframe] || trendPoints;

  const baselineScore = activePoints[0]?.score || 68;
  const peakScore = activePoints.length > 0 ? Math.max(...activePoints.map(p => p.score)) : 85;
  const latestScore = activePoints[activePoints.length - 1]?.score || 82;
  const netGain = latestScore - baselineScore;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-8 text-[var(--text-main)] font-body">
      
      {/* 1. HEADER: LEARNING AT A GLANCE & DEMO BADGE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-[var(--text-main)] tracking-tight">
              Progress
            </h1>
            {isDemo && (
              <Badge variant="gold" size="sm" title="Sample student profile loaded until first study session">
                Demo Sample Mode
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
            Your learning at a glance · Decision Center
          </p>
        </div>

        <button
          onClick={fetchStudentInsights}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-xs font-semibold text-[var(--text-secondary)] transition-all shadow-2xs active:scale-95 cursor-pointer"
          title="Refresh Decision Center"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* 2. HERO: LEARNING HEALTH (4 Compact Stat Cards + Dynamic Sentence) */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 sm:p-7 shadow-xs space-y-6"
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-mono tracking-wider uppercase text-[var(--text-muted)] flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-[#89A88D]" />
            <span>Your Learning Health</span>
          </span>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {health.study_time_label || "Estimated Study Time"}: <strong>{timeFormatted}</strong>
          </span>
        </div>

        {/* 4 Compact Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Stat 1: Overall Mastery */}
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] flex flex-col justify-between gap-1 shadow-2xs">
            <span className="text-xs font-medium text-[var(--text-muted)]">Overall Mastery</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-body text-[var(--text-main)]">
                {health.overall_mastery}%
              </span>
              {health.mastery_change_pct !== undefined && (
                <span className={`inline-flex items-center text-xs font-semibold ${
                  health.mastery_change_pct >= 0 ? "text-[#3F6048] dark:text-[#A8C5AC]" : "text-[#C96B62]"
                }`}>
                  {health.mastery_change_pct >= 0 ? "+" : ""}{health.mastery_change_pct}%
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">this month</span>
          </div>

          {/* Stat 2: Quiz Accuracy */}
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] flex flex-col justify-between gap-1 shadow-2xs">
            <span className="text-xs font-medium text-[var(--text-muted)]">Quiz Accuracy</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-body text-[var(--text-main)]">
                {health.quiz_accuracy}%
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">Average recall score</span>
          </div>

          {/* Stat 3: Cards Retained */}
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] flex flex-col justify-between gap-1 shadow-2xs">
            <span className="text-xs font-medium text-[var(--text-muted)]">Cards Retained</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-body text-[var(--text-main)]">
                {health.cards_retained}
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">Active FSRS items</span>
          </div>

          {/* Stat 4: Study Streak */}
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] flex flex-col justify-between gap-1 shadow-2xs">
            <span className="text-xs font-medium text-[var(--text-muted)]">Study Streak</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl sm:text-3xl font-extrabold font-body text-[var(--text-main)] flex items-center gap-1.5">
                <Flame className="w-5 h-5 text-[#D6A84F] fill-current" />
                <span>{health.study_streak_days}d</span>
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {health.cards_due_today} cards due today
            </span>
          </div>

        </div>

        {/* Dynamic Prominent Takeaway Sentence */}
        <div className="p-4 rounded-2xl bg-[#89A88D]/10 border border-[#89A88D]/25 flex items-start sm:items-center gap-3">
          <Sparkles className="w-4 h-4 text-[#89A88D] shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-sm font-semibold text-[var(--text-main)] leading-relaxed">
            {insights?.headline_takeaway || "You're improving steadily. Your biggest opportunity is Operating Systems."}
          </p>
        </div>
      </motion.section>

      {/* 3. HERO SPLIT: WHAT TO STUDY NEXT (60%) + MEMORY & RETENTION (40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* WHAT TO STUDY NEXT (The dominant decision card - 7 cols) */}
        {recommended && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="lg:col-span-7 rounded-3xl border-2 border-[#C96B62]/40 bg-[#C96B62]/5 p-6 md:p-7 flex flex-col justify-between relative overflow-hidden shadow-sm"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="rose" size="sm">
                    What to Study Next
                  </Badge>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[#C96B62] font-semibold">
                    Priority Gap
                  </span>
                </div>
                <span className="text-xs font-mono text-[var(--text-muted)]">
                  1-Click Recovery
                </span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] leading-tight">
                  {recommended.topic}
                </h2>
                {recommended.subtopic && (
                  <p className="text-sm font-medium text-[var(--text-secondary)] mt-0.5">
                    {recommended.subtopic}
                  </p>
                )}

                {/* Context metrics */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--text-muted)] mt-2">
                  <span className="font-semibold text-[#C96B62]">
                    {recommended.mastery_score}% mastery
                  </span>
                  <span>·</span>
                  <span>{recommended.failed_questions_count} recent mistakes</span>
                  <span>·</span>
                  <span>{recommended.cards_due_count} cards due</span>
                </div>
              </div>

              {/* Your Recovery Session: 3 Adaptive Steps */}
              <div className="pt-1">
                <span className="text-xs font-semibold text-[var(--text-secondary)] block mb-2">
                  Your Recovery Session:
                </span>
                <div className="space-y-2">
                  {recommended.study_plan_steps?.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-xs text-[var(--text-main)] shadow-2xs"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#89A88D]/20 text-[#3F6048] dark:text-[#A8C5AC] flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-snug">{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch CTA + "Why this recommendation?" */}
            <div className="pt-6 space-y-3">
              <Button
                variant="primary"
                size="lg"
                className="w-full justify-center text-sm font-semibold shadow-sm"
                onClick={() => handleLaunchRecovery(recommended.action_payload)}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Recovery Session →</span>
              </Button>

              {/* Why this recommendation toggle */}
              <div>
                <button
                  onClick={() => setShowWhy(!showWhy)}
                  className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors mx-auto py-1 cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-[#C96B62]" />
                  <span className="underline decoration-dotted underline-offset-2">Why this recommendation?</span>
                  {showWhy ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>

                {showWhy && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="text-xs text-[var(--text-secondary)] bg-[var(--bg-surface-elevated)] p-3 rounded-xl border border-[var(--border)] mt-2 leading-relaxed"
                  >
                    {recommended.why_recommendation || `Based on ${recommended.failed_questions_count} recent quiz mistakes, ${recommended.cards_due_count} due flashcards, and ${recommended.mastery_score}% mastery in ${recommended.topic}.`}
                  </motion.div>
                )}
              </div>
            </div>
          </motion.section>
        )}

        {/* MEMORY & RETENTION (FSRS Gold Card - 5 cols) */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-5 rounded-3xl border border-[#D6A84F]/30 bg-[#D6A84F]/5 p-6 md:p-7 flex flex-col justify-between relative overflow-hidden shadow-xs"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="gold" size="sm">
                Memory & Retention
              </Badge>
              <span className="text-xs font-mono text-[#8C6D23] dark:text-[#E8C57A]">
                FSRS Protocol
              </span>
            </div>

            <div>
              <span className="text-4xl sm:text-5xl font-extrabold font-body text-[var(--text-main)]">
                {health.retention_rate || 85}%
              </span>
              <p className="text-xs font-medium text-[var(--text-muted)] mt-1">
                Target retention rate {health.is_retention_estimated ? "(estimate)" : "(verified)"}
              </p>
            </div>

            <div className="space-y-2 pt-2 text-xs text-[var(--text-secondary)]">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#D6A84F]" />
                  <span>Cards Retained:</span>
                </span>
                <strong className="font-mono text-[var(--text-main)]">{health.cards_retained} cards</strong>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#C96B62]" />
                  <span>Cards Due Today:</span>
                </span>
                <strong className="font-mono text-[#C96B62]">{health.cards_due_today} cards</strong>
              </div>
            </div>
          </div>

          <div className="pt-6">
            <Button
              variant="secondary"
              size="md"
              className="w-full justify-center text-xs font-semibold"
              onClick={() => navigate("/flashcards", { state: { filter: "due" } })}
            >
              <span>Review Due Cards ({health.cards_due_today})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </motion.section>

      </div>

      {/* 4. SUBJECT MASTERY (Clean Horizontal Bars with Status) */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 sm:p-7 shadow-xs space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#89A88D]" />
              <span>Subject Mastery</span>
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Horizontal progress matrix · Click any subject to launch targeted practice
            </p>
          </div>
          <span className="text-[11px] font-mono text-[var(--text-muted)] self-start sm:self-auto">
            {topicMatrix.length} subjects tracked
          </span>
        </div>

        {/* Horizontal Bars Stack */}
        <div className="space-y-3">
          {topicMatrix.map((item, idx) => (
            <div
              key={idx}
              onClick={() => handleStudySubject(item)}
              className="group p-3.5 sm:p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] hover:border-[#89A88D]/50 hover:shadow-xs transition-all cursor-pointer space-y-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-bold text-[var(--text-main)] group-hover:text-[#89A88D] transition-colors truncate">
                    {item.subject}
                  </span>
                  {item.subtopic && (
                    <span className="text-xs text-[var(--text-muted)] hidden md:inline truncate">
                      · {item.subtopic}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {item.change !== 0 && (
                    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
                      item.change > 0 ? "text-[#3F6048] dark:text-[#A8C5AC]" : "text-[#C96B62]"
                    }`}>
                      {item.change > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {Math.abs(item.change)}%
                    </span>
                  )}

                  <Badge
                    variant={item.color_variant || (item.mastery >= 80 ? "sage" : item.mastery >= 65 ? "gold" : "rose")}
                    size="sm"
                  >
                    {item.status}
                  </Badge>

                  <span className="text-sm font-mono font-bold text-[var(--text-main)] w-10 text-right">
                    {item.mastery}%
                  </span>
                </div>
              </div>

              {/* Horizontal Progress Bar */}
              <div className="w-full h-2 rounded-full bg-[var(--border)] overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    item.mastery >= 80 ? "bg-[#89A88D]" : item.mastery >= 65 ? "bg-[#D6A84F]" : "bg-[#C96B62]"
                  }`}
                  style={{ width: `${Math.max(6, item.mastery)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* 5. PERFORMANCE TREND (30 DAYS Area Curve with Benchmark & Milestones) */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 sm:p-7 shadow-xs space-y-5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#89A88D]" />
              <span>
                Performance · {
                  selectedTimeframe === "week" ? "Last 7 Days" :
                  selectedTimeframe === "month" ? "30 Days" :
                  selectedTimeframe === "quarter" ? "90 Days (Quarter)" : "12 Months (Year)"
                }
              </span>
            </h3>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Cognitive accuracy trajectory and milestone progression across assessments
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Timeframe Selector Buttons */}
            <div className="flex items-center rounded-xl bg-[var(--bg-surface-elevated)] p-1 border border-[var(--border)] shadow-2xs">
              {[
                { id: "week", label: "Week", badge: "7D" },
                { id: "month", label: "Month", badge: "30D" },
                { id: "quarter", label: "Quarter", badge: "90D" },
                { id: "year", label: "Year", badge: "1Y" }
              ].map(tf => (
                <button
                  key={tf.id}
                  onClick={() => setSelectedTimeframe(tf.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    selectedTimeframe === tf.id
                      ? "bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs border border-[var(--border)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                >
                  <span>{tf.label}</span>
                  <span className="text-[10px] opacity-60 ml-1 font-mono">{tf.badge}</span>
                </button>
              ))}
            </div>

            {/* Quick Metrics Summary Badges */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs shadow-2xs">
                <span className="text-[var(--text-muted)]">Net:</span>
                <span className={`font-mono font-bold ${netGain >= 0 ? "text-[#3F6048] dark:text-[#A8C5AC]" : "text-[#C96B62]"}`}>
                  {netGain >= 0 ? "+" : ""}{netGain}%
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs shadow-2xs">
                <span className="text-[var(--text-muted)]">Peak:</span>
                <span className="font-mono font-bold text-[#89A88D]">{peakScore}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Milestone Badges Strip */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs">
          <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider shrink-0 mr-1">
            Milestones:
          </span>
          {activePoints.filter(p => p.milestone).map((p, idx) => (
            <div
              key={idx}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[11px] font-medium text-[var(--text-secondary)] shrink-0 shadow-2xs"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#89A88D]" />
              <strong className="font-mono text-[var(--text-main)]">{p.score}%</strong>
              <span className="text-[var(--text-muted)]">·</span>
              <span>{p.milestone}</span>
              <span className="text-[10px] text-[var(--text-muted)] font-mono">({p.date})</span>
            </div>
          ))}
        </div>

        {/* High-Fidelity AreaChart with Gradient & Benchmark */}
        <div className="h-64 sm:h-72 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activePoints} margin={{ top: 15, right: 15, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="performanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#89A88D" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#89A88D" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.4} />

              <XAxis
                dataKey="date"
                stroke="var(--text-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={6}
                interval={selectedTimeframe === "year" || selectedTimeframe === "week" ? 0 : "preserveStartEnd"}
                minTickGap={10}
              />
              <YAxis
                domain={[40, 100]}
                stroke="var(--text-muted)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                ticks={[50, 65, 80, 100]}
                tickFormatter={(v) => `${v}%`}
                width={38}
              />

              {/* 80% Mastery Benchmark Line */}
              <ReferenceLine
                y={80}
                stroke="#89A88D"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{
                  value: "Mastery Target (80%)",
                  position: "insideTopRight",
                  fill: "#89A88D",
                  fontSize: 10,
                  opacity: 0.8
                }}
              />

              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="p-3.5 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] shadow-xl text-xs space-y-1.5 min-w-[170px]">
                        <div className="flex items-center justify-between border-b border-[var(--border)] pb-1.5">
                          <span className="font-bold text-[var(--text-main)]">{data.date}</span>
                          <span className="font-mono font-bold text-[#89A88D] text-sm">{data.score}%</span>
                        </div>
                        {data.milestone ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-[#3F6048] dark:text-[#A8C5AC] font-semibold pt-0.5">
                            <span className="text-xs">🚩</span>
                            <span>{data.milestone}</span>
                          </div>
                        ) : (
                          <p className="text-[11px] text-[var(--text-muted)]">Verified Assessment</p>
                        )}
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Area
                type="monotone"
                dataKey="score"
                stroke="#89A88D"
                strokeWidth={3}
                fill="url(#performanceGradient)"
                dot={(props) => {
                  const { cx, cy, payload } = props;
                  const isMilestone = Boolean(payload?.milestone);
                  return (
                    <circle
                      key={payload?.date || Math.random()}
                      cx={cx}
                      cy={cy}
                      r={isMilestone ? 5 : 3.5}
                      fill={isMilestone ? "#3F6048" : "#89A88D"}
                      stroke="var(--bg-surface)"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 7, fill: "#89A88D", stroke: "var(--bg-surface)", strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.section>

      {/* 6. LOWER SPLIT: STUDY CONSISTENCY (Heatmap) + BEST STUDY WINDOW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        
        {/* Study Activity Heatmap */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-xs flex flex-col justify-between space-y-4"
        >
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#89A88D]" />
                <span>Study Activity</span>
              </h3>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">
                This Week
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Daily habit consistency & session frequency
            </p>
          </div>

          {/* 7 Days Blocks */}
          <div className="grid grid-cols-7 gap-2 py-2">
            {consistencyGrid.map((day, idx) => {
              const bgColors = [
                "bg-[var(--border)]",
                "bg-[#89A88D]/25",
                "bg-[#89A88D]/50",
                "bg-[#89A88D]/75",
                "bg-[#89A88D]"
              ];
              return (
                <div key={idx} className="flex flex-col items-center gap-1.5">
                  <div
                    className={`w-full aspect-square rounded-xl ${bgColors[day.intensity || 0]} transition-all flex items-center justify-center`}
                    title={`${day.full_day}: ${day.count} study sessions`}
                  >
                    {day.count > 0 && (
                      <span className="text-[10px] font-mono font-bold text-white/90">
                        {day.count}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-[var(--text-muted)]">
                    {day.day}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-1 border-t border-[var(--border)]">
            <span>{consistencyGrid.reduce((acc, d) => acc + (d.count || 0), 0)} sessions completed</span>
            <div className="flex items-center gap-1 font-mono text-[10px]">
              <span>Less</span>
              <div className="w-2.5 h-2.5 rounded bg-[var(--border)]" />
              <div className="w-2.5 h-2.5 rounded bg-[#89A88D]/50" />
              <div className="w-2.5 h-2.5 rounded bg-[#89A88D]" />
              <span>More</span>
            </div>
          </div>
        </motion.section>

        {/* Best Study Window (Cognitive Peak) */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-xs flex flex-col justify-between space-y-4"
        >
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#D6A84F]" />
                <span>Your Best Study Window</span>
              </h3>
              <Badge variant="gold" size="sm">
                Efficiency
              </Badge>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Empirical peak learning hours derived from quiz performance
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[#D6A84F]/10 border border-[#D6A84F]/25 flex items-baseline justify-between">
            <div>
              <span className="text-2xl sm:text-3xl font-bold font-body text-[var(--text-main)]">
                {cognitivePeak.time_range_label || "9 AM – 12 PM"}
              </span>
              <p className="text-xs font-semibold text-[#8C6D23] dark:text-[#E8C57A] mt-1">
                {cognitivePeak.efficiency || 88}% average quiz efficiency
              </p>
            </div>
          </div>

          <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between pt-1 border-t border-[var(--border)]">
            <span>Confidence: <strong>{cognitivePeak.confidence || "Moderate"}</strong></span>
            <span>Based on {cognitivePeak.data_points || 8} assessments</span>
          </div>
        </motion.section>

      </div>

      {/* 7. FOOTER: RECENT ACTIVITY */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-xs space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm sm:text-base font-bold text-[var(--text-main)] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#89A88D]" />
            <span>Recent Activity</span>
          </h3>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            Latest study logs
          </span>
        </div>

        <div className="divide-y divide-[var(--border)]">
          {recentActivities.map((act, idx) => (
            <div
              key={idx}
              className="py-3 flex items-center justify-between gap-3 text-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-6 h-6 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex items-center justify-center shrink-0">
                  {act.type === "quiz" ? (
                    <Target className="w-3.5 h-3.5 text-[#89A88D]" />
                  ) : act.type === "flashcards" ? (
                    <Layers className="w-3.5 h-3.5 text-[#D6A84F]" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-[#C96B62]" />
                  )}
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-main)] truncate">
                    {act.title}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] truncate">
                    {act.details}
                  </p>
                </div>
              </div>

              <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                {act.timestamp ? new Date(act.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Today"}
              </span>
            </div>
          ))}
        </div>
      </motion.section>

    </div>
  );
};

export default ProgressReport;
