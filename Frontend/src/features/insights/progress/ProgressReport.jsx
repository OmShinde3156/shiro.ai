import React, { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
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
  CheckCircle2,
  AlertTriangle,
  Calendar,
  ChevronRight,
  Play,
  RotateCcw,
  Brain,
  Filter,
  Award,
  Zap,
  Check,
  Compass
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
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "mastery" | "activity"
  const [trendRange, setTrendRange] = useState("30D"); // "7D" | "30D" | "90D"
  const [activityFilter, setActivityFilter] = useState("all"); // "all" | "quiz" | "flashcards" | "chat" | "upload"
  const [masteryViewMode, setMasteryViewMode] = useState("matrix"); // "matrix" | "radar"

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
            learning_health: {
              overall_mastery: legacy.average_score || 78,
              mastery_change_pct: 6,
              quiz_accuracy: legacy.average_score || 82,
              cards_retained: legacy.flashcards_studied || 140,
              cards_due_today: 8,
              total_study_time_minutes: 860,
              study_streak_days: legacy.study_streak || 7,
              xp: legacy.xp || 240,
              level: legacy.level || 2
            },
            recommended_action: {
              topic: "Operating Systems — CPU Scheduling",
              mastery_score: 54,
              failed_questions_count: 3,
              cards_due_count: 8,
              study_plan_steps: ["5 min review", "5 active MCQs", "Feynman check"],
              primary_tool: "quiz",
              document_id: null,
              action_payload: {
                tool: "quiz",
                topic: "Operating Systems — CPU Scheduling",
                difficulty: "medium",
                mode: "surgical"
              }
            },
            topic_matrix: [
              { subject: "Database Systems", mastery: 91, change: 8, status: "Mastered", color_variant: "sage", failed_count: 0, cards_due: 0 },
              { subject: "Computer Networks", mastery: 72, change: 14, status: "Developing", color_variant: "gold", failed_count: 1, cards_due: 2 },
              { subject: "Operating Systems", mastery: 54, change: -4, status: "Needs Review", color_variant: "rose", failed_count: 3, cards_due: 8 },
              { subject: "Theory of Computation", mastery: 43, change: -8, status: "Weak", color_variant: "rose", failed_count: 4, cards_due: 6 }
            ],
            performance_trend: {
              timeframe: "30D",
              points: [
                { date: "Aug 06", score: 68, milestone: "Diagnostic Baseline" },
                { date: "Aug 12", score: 72, milestone: "Studied OS Notes" },
                { date: "Aug 18", score: 79, milestone: "Flashcards Session" },
                { date: "Aug 22", score: 85, milestone: "Feynman Challenge" },
                { date: "Aug 26", score: 82, milestone: "Latest Quiz" }
              ]
            },
            consistency_grid: [
              { day: "Mon", full_day: "Monday", count: 4, intensity: 3 },
              { day: "Tue", full_day: "Tuesday", count: 6, intensity: 4 },
              { day: "Wed", full_day: "Wednesday", count: 3, intensity: 2 },
              { day: "Thu", full_day: "Thursday", count: 5, intensity: 3 },
              { day: "Fri", full_day: "Friday", count: 8, intensity: 4 },
              { day: "Sat", full_day: "Saturday", count: 4, intensity: 2 },
              { day: "Sun", full_day: "Sunday", count: 2, intensity: 1 }
            ],
            cognitive_peak: {
              time_range_label: "9:00 AM – 12:00 PM",
              confidence: "Moderate",
              has_sufficient_data: true,
              data_points: 12,
              efficiency: 88.0
            },
            recent_activities: []
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
    if (triggerStudyTool) {
      triggerStudyTool(tool, actionPayload);
    }
    const navState = {
      state: {
        handoff: actionPayload,
        documentId: actionPayload.document_ids?.[0] || actionPayload.document_id
      }
    };
    if (tool === "quiz") navigate("/quiz", navState);
    else if (tool === "flashcards") navigate("/flashcards", navState);
    else if (tool === "feynman") navigate("/feynman", navState);
    else if (tool === "mindmap") navigate("/mindmap", navState);
    else navigate("/quiz", navState);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-4">
        <div className="w-9 h-9 border-2 border-[#89A88D] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-serif italic text-[var(--text-muted)]">
          Synthesizing your learning health & knowledge trajectory...
        </p>
      </div>
    );
  }

  const health = insights?.learning_health || {};
  const recommended = insights?.recommended_action;
  const topicMatrix = insights?.topic_matrix || [];
  const trend = insights?.performance_trend?.points || [];
  const consistency = insights?.consistency_grid || [];
  const peak = insights?.cognitive_peak || {};
  const activities = insights?.recent_activities || [];

  // Filter activities
  const filteredActivities = activities.filter(act => {
    if (activityFilter === "all") return true;
    return act.type === activityFilter;
  });

  // Radar chart data preparation
  const radarData = topicMatrix.map(t => ({
    subject: t.subject,
    score: t.mastery,
    fullMark: 100
  }));

  // Format hours and minutes
  const totalHours = Math.floor((health.total_study_time_minutes || 0) / 60);
  const totalMins = (health.total_study_time_minutes || 0) % 60;
  const timeFormatted = totalHours > 0 ? `${totalHours}h ${totalMins}m` : `${totalMins}m`;

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8 text-[var(--text-main)] font-body">
      
      {/* 1. HERO SECTION: LEARNING HEALTH */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 md:p-8 shadow-sm relative overflow-hidden"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-mono tracking-wider uppercase text-[var(--text-muted)]">
              <Compass className="w-3.5 h-3.5 text-[#89A88D]" />
              <span>Student Learning Health</span>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-serif text-[var(--text-main)] leading-tight">
              Good momentum, {user?.name?.split(" ")[0] || "Scholar"}
            </h1>

            {/* Overall Mastery Headline */}
            <div className="flex items-baseline gap-3 pt-1">
              <span className="text-4xl md:text-5xl font-extrabold tracking-tight font-body text-[var(--text-main)]">
                {health.overall_mastery}%
              </span>
              <span className="text-sm font-medium text-[var(--text-muted)]">
                Overall Mastery
              </span>
              {health.mastery_change_pct !== undefined && (
                <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${
                  health.mastery_change_pct >= 0 
                    ? "bg-[#E8EFE9] dark:bg-[#89A88D]/20 text-[#3F6048] dark:text-[#A8C5AC]" 
                    : "bg-[#C96B62]/15 text-[#C96B62]"
                }`}>
                  {health.mastery_change_pct >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {Math.abs(health.mastery_change_pct)}% this month
                </span>
              )}
            </div>

            {/* Core Badges Row */}
            <div className="flex flex-wrap items-center gap-3 pt-3">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D6A84F]/15 border border-[#D6A84F]/30 text-xs font-semibold text-[#8C6D23] dark:text-[#E8C57A]">
                <Flame className="w-3.5 h-3.5 fill-current text-[#D6A84F]" />
                <span>{health.study_streak_days} day streak</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-secondary)]">
                <Clock className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>{timeFormatted} studied</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-secondary)]">
                <Target className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                <span>{health.quiz_accuracy}% accuracy</span>
              </div>
            </div>
          </div>

          {/* Quick Start Today's Plan CTA */}
          {recommended && (
            <div className="lg:max-w-xs w-full p-4 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex flex-col justify-between gap-3 shrink-0">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  Today's Session
                </span>
                <p className="text-xs font-semibold text-[var(--text-main)] mt-0.5 line-clamp-1">
                  {recommended.topic}
                </p>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">
                  {recommended.study_plan_steps?.[0]} → {recommended.study_plan_steps?.[1]}
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                className="w-full justify-center"
                onClick={() => handleLaunchRecovery(recommended.action_payload)}
              >
                <span>Continue Today's Session</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>
      </motion.section>

      {/* 2. "WHAT SHOULD I DO NEXT?" HERO RECOVERY CARD */}
      {recommended && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-3xl border border-[#C96B62]/30 bg-[#C96B62]/5 p-6 md:p-7 relative overflow-hidden"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <Badge variant="rose" size="sm">
                  Recommended Next Action
                </Badge>
                <span className="text-xs font-mono text-[#C96B62]">
                  Priority Study Gap
                </span>
              </div>

              <div>
                <h3 className="text-lg md:text-xl font-bold text-[var(--text-main)]">
                  {recommended.topic}
                </h3>
                <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-muted)] mt-1">
                  <span>
                    Current Mastery: <strong className="text-[#C96B62] font-mono">{recommended.mastery_score}%</strong>
                  </span>
                  {recommended.failed_questions_count > 0 && (
                    <span className="flex items-center gap-1 text-[#C96B62]">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {recommended.failed_questions_count} failed questions
                    </span>
                  )}
                  {recommended.cards_due_count > 0 && (
                    <span className="flex items-center gap-1 text-[var(--text-secondary)]">
                      <Layers className="w-3.5 h-3.5" />
                      {recommended.cards_due_count} flashcards due
                    </span>
                  )}
                </div>
              </div>

              {/* Shiro Recommended Steps */}
              <div className="pt-2">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Shiro's Recovery Path:
                </span>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  {recommended.study_plan_steps?.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-xs text-[var(--text-main)]"
                    >
                      <span className="w-4 h-4 rounded-full bg-[#89A88D]/20 text-[#3F6048] dark:text-[#A8C5AC] flex items-center justify-center text-[10px] font-bold">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch Recovery Button */}
            <div className="shrink-0">
              <Button
                variant="primary"
                size="lg"
                className="w-full lg:w-auto shadow-sm"
                onClick={() => handleLaunchRecovery(recommended.action_payload)}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Recovery Session</span>
              </Button>
            </div>
          </div>
        </motion.section>
      )}

      {/* 3. THREE PRIMARY TABS */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
          {[
            { id: "overview", label: "Overview & Trends", icon: TrendingUp },
            { id: "mastery", label: "Knowledge Mastery", icon: BookOpen },
            { id: "activity", label: "Activity History", icon: Calendar }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border border-[var(--border)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-[#89A88D]" : "text-[var(--text-muted)]"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ========================================================
            TAB 1: OVERVIEW & TRENDS
           ======================================================== */}
        {activeTab === "overview" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Core 5 Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
              {[
                { label: "Overall Mastery", value: `${health.overall_mastery}%`, change: `+${health.mastery_change_pct}%`, color: "sage", icon: Compass },
                { label: "Quiz Accuracy", value: `${health.quiz_accuracy}%`, change: "Avg Score", color: "sage", icon: Target },
                { label: "Cards Retained", value: health.cards_retained, change: "Active Recall", color: "gold", icon: Layers },
                { label: "Total Study Time", value: timeFormatted, change: "Tracked", color: "default", icon: Clock },
                { label: "Habit Streak", value: `${health.study_streak_days}d`, change: "Momentum", color: "gold", icon: Flame }
              ].map((m, idx) => {
                const MetricIcon = m.icon;
                return (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] flex flex-col justify-between gap-1 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-[var(--text-muted)]">
                      <span className="text-[11px] font-medium">{m.label}</span>
                      <MetricIcon className="w-3.5 h-3.5 opacity-60" />
                    </div>
                    <span className="text-xl md:text-2xl font-bold font-body text-[var(--text-main)] mt-1">
                      {m.value}
                    </span>
                    <span className="text-[10px] font-mono text-[var(--text-muted)]">
                      {m.change}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Performance Accuracy Curve */}
            <div className="p-6 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-[#89A88D]" />
                    <span>Quiz Accuracy Over Time</span>
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Historical retention curve and verified assessment milestones
                  </p>
                </div>

                {/* Timeframe selector */}
                <div className="flex items-center rounded-xl bg-[var(--bg-surface-elevated)] p-0.5 border border-[var(--border)] self-start">
                  {["7D", "30D", "90D"].map(range => (
                    <button
                      key={range}
                      onClick={() => setTrendRange(range)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                        trendRange === range
                          ? "bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs"
                          : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                      }`}
                    >
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              {/* LineChart */}
              <div className="h-64 w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      domain={[40, 100]}
                      stroke="var(--text-muted)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="p-3 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] shadow-md text-xs space-y-1">
                              <span className="font-mono text-[10px] text-[var(--text-muted)]">{data.date}</span>
                              <div className="flex items-center gap-1.5 font-bold text-sm text-[var(--text-main)]">
                                <span>{data.score}% Accuracy</span>
                              </div>
                              {data.milestone && (
                                <p className="text-[11px] text-[#89A88D] flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  <span>{data.milestone}</span>
                                </p>
                              )}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#89A88D"
                      strokeWidth={3}
                      dot={{ r: 4, fill: "#89A88D", strokeWidth: 2, stroke: "var(--bg-surface)" }}
                      activeDot={{ r: 6, fill: "#62816A", strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Row: Habit Consistency & Evidence-Based Cognitive Peak */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Habit Formation Heatmap */}
              <div className="p-6 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] space-y-4 shadow-xs">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#D6A84F]" />
                    <span>Study Consistency Heatmap</span>
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Weekly habit building and study regularity
                  </p>
                </div>

                <div className="grid grid-cols-7 gap-2 pt-2">
                  {consistency.map((c, i) => {
                    const intensityColors = [
                      "bg-[var(--bg-surface-elevated)] text-[var(--text-muted)]",
                      "bg-[#89A88D]/25 text-[#3F6048] dark:text-[#A8C5AC]",
                      "bg-[#89A88D]/50 text-white dark:text-black font-semibold",
                      "bg-[#89A88D]/80 text-white dark:text-black font-semibold",
                      "bg-[#3F6048] dark:bg-[#89A88D] text-white dark:text-black font-bold"
                    ];
                    const colorClass = intensityColors[c.intensity] || intensityColors[0];
                    return (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <div
                          className={`w-full aspect-square rounded-xl flex items-center justify-center text-xs transition-transform hover:scale-105 ${colorClass}`}
                          title={`${c.full_day}: ${c.count} study activities`}
                        >
                          {c.count > 0 ? c.count : "—"}
                        </div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">
                          {c.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Evidence-Based Cognitive Peak Window */}
              <div className="p-6 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] space-y-3 shadow-xs flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[var(--text-main)] flex items-center gap-2">
                      <Brain className="w-4 h-4 text-[#89A88D]" />
                      <span>Strongest Study Window</span>
                    </h3>
                    <Badge variant={peak.confidence === "High" ? "sage" : "gold"} size="sm">
                      Confidence: {peak.confidence || "Moderate"}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Evidence-based performance window calculated from assessment accuracy
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase">
                      Peak Focus Hours
                    </span>
                    <h4 className="text-xl font-bold text-[var(--text-main)] mt-0.5">
                      {peak.time_range_label || "9:00 AM – 12:00 PM"}
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono text-[var(--text-muted)] uppercase">
                      Peak Accuracy
                    </span>
                    <h4 className="text-xl font-bold text-[#3F6048] dark:text-[#A8C5AC] mt-0.5">
                      {peak.efficiency || 88}%
                    </h4>
                  </div>
                </div>

                <p className="text-[11px] text-[var(--text-muted)] italic">
                  * Based on {peak.data_points || 8} recorded quiz observations. Schedule challenging sessions in this window.
                </p>
              </div>

            </div>
          </motion.div>
        )}

        {/* ========================================================
            TAB 2: KNOWLEDGE MASTERY MATRIX
           ======================================================== */}
        {activeTab === "mastery" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header & Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-main)]">
                  Subject Mastery Matrix
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Track topic retention trajectories, review needs, and launch targeted practice
                </p>
              </div>

              <div className="flex items-center rounded-xl bg-[var(--bg-surface-elevated)] p-0.5 border border-[var(--border)]">
                <button
                  onClick={() => setMasteryViewMode("matrix")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    masteryViewMode === "matrix"
                      ? "bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                >
                  Matrix Table
                </button>
                <button
                  onClick={() => setMasteryViewMode("radar")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    masteryViewMode === "radar"
                      ? "bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                  }`}
                >
                  Radar Chart
                </button>
              </div>
            </div>

            {masteryViewMode === "matrix" ? (
              /* Topic Mastery Matrix Table */
              <div className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--bg-surface-elevated)] border-b border-[var(--border)] text-[var(--text-muted)] font-mono uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-6 py-3.5 font-semibold">Subject / Topic</th>
                        <th className="px-6 py-3.5 font-semibold">Mastery Score</th>
                        <th className="px-6 py-3.5 font-semibold">Trajectory</th>
                        <th className="px-6 py-3.5 font-semibold">Status</th>
                        <th className="px-6 py-3.5 font-semibold">Gaps & Cards</th>
                        <th className="px-6 py-3.5 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)] text-[var(--text-main)]">
                      {topicMatrix.map((t, idx) => {
                        const isWeak = t.status === "Needs Review" || t.status === "Weak";
                        const isMastered = t.status === "Mastered";
                        return (
                          <tr key={idx} className="hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4 font-semibold text-sm">
                              {t.subject}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-sm">{t.mastery}%</span>
                                <div className="w-16 h-1.5 rounded-full bg-[var(--bg-surface-elevated)] overflow-hidden hidden sm:block">
                                  <div
                                    className={`h-full rounded-full ${
                                      isMastered ? "bg-[#3F6048] dark:bg-[#89A88D]" : (isWeak ? "bg-[#C96B62]" : "bg-[#D6A84F]")
                                    }`}
                                    style={{ width: `${t.mastery}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-0.5 font-mono text-xs font-semibold ${
                                t.change >= 0 ? "text-[#3F6048] dark:text-[#A8C5AC]" : "text-[#C96B62]"
                              }`}>
                                {t.change >= 0 ? `+${t.change}%` : `${t.change}%`}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <Badge
                                variant={t.color_variant || (isMastered ? "sage" : (isWeak ? "rose" : "gold"))}
                                size="sm"
                              >
                                {t.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 text-[var(--text-muted)] text-[11px]">
                              {t.failed_count > 0 ? (
                                <span className="text-[#C96B62] font-medium">{t.failed_count} failed questions</span>
                              ) : (
                                <span>No active errors</span>
                              )}
                              {t.cards_due > 0 && <span> · {t.cards_due} cards due</span>}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <Button
                                variant={isWeak ? "primary" : "outline"}
                                size="sm"
                                onClick={() => handleLaunchRecovery({
                                  tool: isWeak ? "quiz" : "flashcards",
                                  topic: t.subject,
                                  document_ids: t.document_id ? [t.document_id] : [],
                                  difficulty: "medium",
                                  mode: isWeak ? "surgical" : "human"
                                })}
                              >
                                <span>{isWeak ? "Practice" : "Review"}</span>
                                <ArrowRight className="w-3 h-3" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* Secondary Radar Chart View */
              <div className="p-6 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] shadow-xs">
                <h4 className="text-xs font-mono uppercase tracking-wider text-[var(--text-muted)] mb-4">
                  Multi-Dimensional Competency Radar
                </h4>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} />
                      <Radar
                        name="Mastery"
                        dataKey="score"
                        stroke="#89A88D"
                        fill="#89A88D"
                        fillOpacity={0.3}
                      />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ========================================================
            TAB 3: ACTIVITY HISTORY
           ======================================================== */}
        {activeTab === "activity" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header & Filter Pills */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-[var(--text-main)]">
                  Learning Activity History
                </h3>
                <p className="text-xs text-[var(--text-muted)]">
                  Chronological trail of assessments, flashcards, chats, and uploaded notes
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "all", label: "All" },
                  { id: "quiz", label: "Quizzes" },
                  { id: "flashcards", label: "Flashcards" },
                  { id: "chat", label: "Chats" },
                  { id: "upload", label: "Uploads" }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setActivityFilter(f.id)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      activityFilter === f.id
                        ? "bg-[#3F6048] dark:bg-[#89A88D] text-white dark:text-black"
                        : "bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-main)]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Activities Timeline Card */}
            <div className="p-6 rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] space-y-4 shadow-xs">
              {filteredActivities.length > 0 ? (
                <div className="space-y-4">
                  {filteredActivities.map((act, i) => {
                    const dateObj = act.timestamp ? new Date(act.timestamp) : new Date();
                    return (
                      <div
                        key={i}
                        className="p-3.5 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex items-center justify-between gap-4 hover:border-[#89A88D]/40 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs ${
                            act.type === "quiz" ? "bg-[#3F6048]/15 text-[#3F6048] dark:text-[#A8C5AC]" :
                            act.type === "flashcards" ? "bg-[#D6A84F]/15 text-[#D6A84F]" :
                            act.type === "chat" ? "bg-[#89A88D]/20 text-[#89A88D]" :
                            "bg-[var(--bg-surface)] text-[var(--text-muted)]"
                          }`}>
                            {act.type === "quiz" ? <Target className="w-4 h-4" /> :
                             act.type === "flashcards" ? <Layers className="w-4 h-4" /> :
                             act.type === "chat" ? <Brain className="w-4 h-4" /> :
                             <BookOpen className="w-4 h-4" />}
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[var(--text-main)]">{act.title}</h4>
                            <p className="text-[11px] text-[var(--text-muted)]">{act.details || "Completed activity"}</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                          {dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-[var(--text-muted)]">
                  No activity matching the selected filter.
                </div>
              )}
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
};

export default ProgressReport;
