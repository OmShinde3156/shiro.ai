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
  Calendar,
  Trophy,
  Zap,
  Info,
  Activity,
  Cpu,
  Timer,
  Check,
  SkipForward,
  BarChart3,
  ShieldCheck,
  Gauge
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
  const [selectedYear, setSelectedYear] = useState("2026"); // "2026" | "2025" | "pastYear"
  const [hoveredDay, setHoveredDay] = useState(null);
  const [filterIntensity, setFilterIntensity] = useState(null); // null | 0 | 1 | 2 | 3 | 4
  const [showBktInfo, setShowBktInfo] = useState(false);
  const [showRetentionInfo, setShowRetentionInfo] = useState(false);
  const [launchingBooster, setLaunchingBooster] = useState(false);

  // Multi-Constraint Study Pathway Studio (REC-01 v2)
  const [timeBudget, setTimeBudget] = useState(30);
  const [sessionMode, setSessionMode] = useState("balanced"); // "balanced" | "retention_rescue" | "mastery_sprint" | "exam_cram"
  const [pathway, setPathway] = useState(null);
  const [loadingPathway, setLoadingPathway] = useState(false);
  const [completingStepId, setCompletingStepId] = useState(null);
  const [showRoiDrawer, setShowRoiDrawer] = useState(false);

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
              study_streak_days: legacy.study_streak ?? 1,
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
              { subject: "Operating Systems", subtopic: "CPU Scheduling", mastery: 54, change: -4, status: "Needs Review", color_variant: "review", failed_count: 3, cards_due: 8 },
              { subject: "Theory of Computation", subtopic: "Core Automata", mastery: 60, change: -8, status: "Needs Review", color_variant: "review", failed_count: 2, cards_due: 4 },
              { subject: "Computer Networks", subtopic: "Transport Layer", mastery: 72, change: 14, status: "Developing", color_variant: "developing", failed_count: 1, cards_due: 2 },
              { subject: "DBMS", subtopic: "Indexing & SQL", mastery: 91, change: 8, status: "Mastered", color_variant: "mastered", failed_count: 0, cards_due: 0 }
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

  const handleStudyConcept = (concept) => {
    navigate("/quiz", {
      state: {
        topic: concept.concept_name,
        documentId: concept.document_id,
        mode: "surgical"
      }
    });
  };

  const handleLaunchBooster = async () => {
    setLaunchingBooster(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/retention/boost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ max_concepts: 4 })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.session && data.session.id) {
          navigate("/quiz", { state: { mode: "adaptive", sessionId: data.session.id, topic: data.topic } });
        } else {
          navigate("/quiz", { state: { mode: "adaptive", topic: "Memory Retention Booster" } });
        }
      } else {
        navigate("/quiz", { state: { mode: "adaptive", topic: "Memory Retention Booster" } });
      }
    } catch (err) {
      console.error("Failed to launch memory booster:", err);
      navigate("/quiz", { state: { mode: "adaptive", topic: "Memory Retention Booster" } });
    } finally {
      setLaunchingBooster(false);
    }
  };

  const handleRefreshConcept = (concept) => {
    navigate("/quiz", {
      state: {
        mode: "adaptive",
        topic: concept.concept_name,
        documentId: concept.document_id
      }
    });
  };

  // =========================================================================
  // MULTI-CONSTRAINT STUDY PATHWAY STUDIO (REC-01 v2)
  // =========================================================================

  const fetchPathway = async (budget = timeBudget, mode = sessionMode, forceRefresh = false) => {
    setLoadingPathway(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/recommendations/pathway`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration_minutes: Number(budget),
          mode: mode,
          force_refresh: Boolean(forceRefresh)
        })
      });
      if (res.ok) {
        const data = await res.json();
        setPathway(data);
      }
    } catch (err) {
      console.warn("Failed to fetch study pathway:", err);
    } finally {
      setLoadingPathway(false);
    }
  };

  useEffect(() => {
    fetchPathway(timeBudget, sessionMode, false);
  }, [timeBudget, sessionMode, user]);

  const handleLaunchStep = (step) => {
    if (!step) return;
    const tool = step.tool;
    const topic = step.concept_name || recommended?.topic || "Operating Systems";
    const docId = step.payload?.document_id || recommended?.document_id || null;

    if (triggerStudyTool) {
      try {
        triggerStudyTool(tool === "adaptive_cat" ? "quiz" : tool, { topic, documentId: docId });
      } catch (e) {
        console.warn("triggerStudyTool failed, falling back to direct navigation:", e);
      }
    }

    if (tool === "adaptive_cat") {
      navigate("/quiz", {
        state: {
          mode: "adaptive",
          topic,
          documentId: docId,
          numQuestions: step.payload?.num_questions || 6
        }
      });
    } else if (tool === "flashcards") {
      navigate("/flashcards", {
        state: {
          topic,
          filter: "due",
          documentId: docId
        }
      });
    } else if (tool === "feynman") {
      navigate("/feynman", {
        state: {
          topic,
          documentId: docId
        }
      });
    } else {
      navigate("/quiz", {
        state: {
          topic,
          documentId: docId,
          mode: "surgical"
        }
      });
    }
  };

  const handleCompleteStep = async (stepId, durationSeconds = 300) => {
    if (!pathway?.id) {
      // Local state update for demo or unauthenticated state
      setPathway(prev => {
        const base = prev || activePathway;
        const newItems = (base.items || []).map(it => it.step_id === stepId ? { ...it, status: "completed" } : it);
        const compCount = newItems.filter(it => it.status === "completed").length;
        return { ...base, items: newItems, completed_step_count: compCount, current_step_index: compCount };
      });
      return;
    }
    setCompletingStepId(stepId);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/recommendations/pathway/step/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathway_id: pathway.id,
          step_id: stepId,
          duration_seconds: durationSeconds,
          client_step_id: `step-${stepId}-${Date.now()}`
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setPathway(updated);
      }
    } catch (err) {
      console.error("Failed to complete pathway step:", err);
    } finally {
      setCompletingStepId(null);
    }
  };

  const handleSkipStep = async (stepId) => {
    if (!pathway?.id) {
      setPathway(prev => {
        const base = prev || activePathway;
        const newItems = (base.items || []).map(it => it.step_id === stepId ? { ...it, status: "skipped" } : it);
        return { ...base, items: newItems };
      });
      return;
    }
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/recommendations/pathway/step/skip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pathway_id: pathway.id,
          step_id: stepId
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setPathway(updated);
      }
    } catch (err) {
      console.error("Failed to skip pathway step:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-3 border-[var(--border)] border-t-[var(--primary)] rounded-full animate-spin" />
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

  // Bayesian Knowledge Tracing (BKT) Telemetry
  const knowledgeTracing = insights?.knowledge_tracing || {
    overall_knowledge_index: 0,
    total_concepts_tracked: 0,
    mastered_count: 0,
    developing_count: 0,
    needs_review_count: 0,
    concepts: []
  };

  // Demo fallback when user hasn't completed diagnostic/evaluation sessions yet
  const activeConcepts = (knowledgeTracing.concepts && knowledgeTracing.concepts.length > 0)
    ? knowledgeTracing.concepts
    : (isDemo ? [
        { concept_name: "B-Tree Indexing", mastery_score: 88, p_known: 0.88, predicted_accuracy: 91, status: "Mastered", color_variant: "sage", opportunities: 7, consecutive_correct: 4 },
        { concept_name: "CPU Scheduling Algorithms", mastery_score: 52, p_known: 0.52, predicted_accuracy: 58, status: "Needs Review", color_variant: "rose", opportunities: 5, consecutive_correct: 0 },
        { concept_name: "Deadlock Prevention & Avoidance", mastery_score: 74, p_known: 0.74, predicted_accuracy: 78, status: "Developing", color_variant: "gold", opportunities: 4, consecutive_correct: 2 },
        { concept_name: "Virtual Memory Paging", mastery_score: 63, p_known: 0.63, predicted_accuracy: 69, status: "Developing", color_variant: "gold", opportunities: 3, consecutive_correct: 1 }
      ] : []);

  const bktIndex = (knowledgeTracing.concepts && knowledgeTracing.concepts.length > 0)
    ? knowledgeTracing.overall_knowledge_index
    : (isDemo ? 69 : 0);

  const bktMasteredCount = (knowledgeTracing.concepts && knowledgeTracing.concepts.length > 0)
    ? knowledgeTracing.mastered_count
    : (isDemo ? 1 : 0);

  const bktDevelopingCount = (knowledgeTracing.concepts && knowledgeTracing.concepts.length > 0)
    ? knowledgeTracing.developing_count
    : (isDemo ? 2 : 0);

  const bktReviewCount = (knowledgeTracing.concepts && knowledgeTracing.concepts.length > 0)
    ? knowledgeTracing.needs_review_count
    : (isDemo ? 1 : 0);

  // Retention Radar Telemetry (FORGET-01)
  const retentionRadar = insights?.retention_radar || {
    overall_memory_health: isDemo ? 78.5 : 100.0,
    total_concepts_tracked: isDemo ? 4 : 0,
    resilient_count: isDemo ? 2 : 0,
    decaying_count: isDemo ? 1 : 0,
    critical_count: isDemo ? 1 : 0,
    projected_7d_loss_count: isDemo ? 1 : 0,
    at_risk_concepts: isDemo ? [
      {
        concept_name: "Deadlock Avoidance & Banker's Algorithm",
        category: "critical",
        retention_now: 52.4,
        retention_in_7d: 38.1,
        predicted_forgetting_7d: 96.4,
        time_constant_days: 2.1,
        half_life_days: 1.5,
        elapsed_days: 3.2,
        urgency_score: 0.78,
        streak: 0
      },
      {
        concept_name: "Virtual Memory & Page Replacement",
        category: "decaying",
        retention_now: 71.8,
        retention_in_7d: 54.2,
        predicted_forgetting_7d: 76.8,
        time_constant_days: 4.8,
        half_life_days: 3.3,
        elapsed_days: 2.1,
        urgency_score: 0.52,
        streak: 1
      }
    ] : [],
    all_concepts: isDemo ? [
      {
        concept_name: "Deadlock Avoidance & Banker's Algorithm",
        category: "critical",
        retention_now: 52.4,
        retention_in_7d: 38.1,
        predicted_forgetting_7d: 96.4,
        time_constant_days: 2.1,
        half_life_days: 1.5,
        elapsed_days: 3.2,
        urgency_score: 0.78,
        streak: 0
      },
      {
        concept_name: "Virtual Memory & Page Replacement",
        category: "decaying",
        retention_now: 71.8,
        retention_in_7d: 54.2,
        predicted_forgetting_7d: 76.8,
        time_constant_days: 4.8,
        half_life_days: 3.3,
        elapsed_days: 2.1,
        urgency_score: 0.52,
        streak: 1
      },
      {
        concept_name: "Process Synchronization & Semaphores",
        category: "resilient",
        retention_now: 88.5,
        retention_in_7d: 77.2,
        predicted_forgetting_7d: 44.2,
        time_constant_days: 12.0,
        half_life_days: 8.3,
        elapsed_days: 1.5,
        urgency_score: 0.24,
        streak: 3
      },
      {
        concept_name: "CPU Scheduling Algorithms",
        category: "resilient",
        retention_now: 94.2,
        retention_in_7d: 87.8,
        predicted_forgetting_7d: 24.9,
        time_constant_days: 24.5,
        half_life_days: 17.0,
        elapsed_days: 1.4,
        urgency_score: 0.14,
        streak: 5
      }
    ] : []
  };

  const radarConcepts = (retentionRadar.all_concepts && retentionRadar.all_concepts.length > 0)
    ? retentionRadar.all_concepts
    : (isDemo ? [
        {
          concept_name: "Deadlock Avoidance & Banker's Algorithm",
          category: "critical",
          retention_now: 52.4,
          retention_in_7d: 38.1,
          predicted_forgetting_7d: 96.4,
          time_constant_days: 2.1,
          half_life_days: 1.5,
          elapsed_days: 3.2,
          urgency_score: 0.78,
          streak: 0
        },
        {
          concept_name: "Virtual Memory & Page Replacement",
          category: "decaying",
          retention_now: 71.8,
          retention_in_7d: 54.2,
          predicted_forgetting_7d: 76.8,
          time_constant_days: 4.8,
          half_life_days: 3.3,
          elapsed_days: 2.1,
          urgency_score: 0.52,
          streak: 1
        },
        {
          concept_name: "Process Synchronization & Semaphores",
          category: "resilient",
          retention_now: 88.5,
          retention_in_7d: 77.2,
          predicted_forgetting_7d: 44.2,
          time_constant_days: 12.0,
          half_life_days: 8.3,
          elapsed_days: 1.5,
          urgency_score: 0.24,
          streak: 3
        },
        {
          concept_name: "CPU Scheduling Algorithms",
          category: "resilient",
          retention_now: 94.2,
          retention_in_7d: 87.8,
          predicted_forgetting_7d: 24.9,
          time_constant_days: 24.5,
          half_life_days: 17.0,
          elapsed_days: 1.4,
          urgency_score: 0.14,
          streak: 5
        }
      ] : []);

  // Multi-Constraint Study Pathway Data Projection (REC-01 v2)
  const activePathway = pathway || {
    id: "demo-pathway-rec01",
    target_duration_minutes: timeBudget,
    session_mode: sessionMode,
    total_utility_score: 1.35,
    total_roi_score: 0.045,
    algorithm_version: "REC-01-v2",
    completed_step_count: 0,
    current_step_index: 0,
    items: [
      {
        step_id: "demo-s1",
        step_index: 0,
        title: `Spaced Retrieval Warmup: ${recommended?.topic || "Operating Systems"}`,
        concept_name: recommended?.topic || "Operating Systems",
        tool: "flashcards",
        phase: "warmup",
        duration_minutes: timeBudget <= 15 ? 5 : 8,
        duration_seconds: (timeBudget <= 15 ? 5 : 8) * 60,
        utility_score: 0.42,
        expected_gain: 0.35,
        roi_score: 0.052,
        status: "pending",
        rationale: "Stabilizes decayed memory retrievability before high-intensity problem solving.",
        priority_components: {
          retention_now: 54.0,
          p_known: 48.0,
          delta_retention: 0.38,
          delta_mastery: 0.12,
          exam_urgency: 1.15
        },
        payload: { tool: "flashcards", mode: "review", topic: recommended?.topic || "Operating Systems" }
      },
      {
        step_id: "demo-s2",
        step_index: 1,
        title: `Adaptive CAT Diagnostic: ${recommended?.topic || "Operating Systems"}`,
        concept_name: recommended?.topic || "Operating Systems",
        tool: "adaptive_cat",
        phase: "core",
        duration_minutes: timeBudget <= 15 ? 10 : 15,
        duration_seconds: (timeBudget <= 15 ? 10 : 15) * 60,
        utility_score: 0.65,
        expected_gain: 0.52,
        roi_score: 0.043,
        status: "pending",
        rationale: "Calibrates latent ability θ and accelerates Bayesian Knowledge Tracing transitions.",
        priority_components: {
          retention_now: 60.0,
          p_known: 52.0,
          delta_retention: 0.25,
          delta_mastery: 0.45,
          exam_urgency: 1.15
        },
        payload: { tool: "adaptive_cat", mode: "adaptive", topic: recommended?.topic || "Operating Systems", num_questions: 6 }
      },
      ...(timeBudget > 15 ? [{
        step_id: "demo-s3",
        step_index: 2,
        title: `Feynman Gap Check: ${recommended?.subtopic || "CPU Scheduling"}`,
        concept_name: recommended?.subtopic || "CPU Scheduling",
        tool: "feynman",
        phase: "consolidation",
        duration_minutes: Math.max(5, timeBudget - 23),
        duration_seconds: Math.max(5, timeBudget - 23) * 60,
        utility_score: 0.28,
        expected_gain: 0.25,
        roi_score: 0.040,
        status: "pending",
        rationale: "Synthesizes conceptual understanding into permanent semantic memory.",
        priority_components: {
          retention_now: 70.0,
          p_known: 60.0,
          delta_retention: 0.15,
          delta_mastery: 0.30,
          exam_urgency: 1.10
        },
        payload: { tool: "feynman", mode: "elaboration", topic: recommended?.subtopic || "CPU Scheduling" }
      }] : [])
    ]
  };

  const pathwayItems = activePathway.items || [];
  const completedStepsCount = pathwayItems.filter(s => s.status === "completed").length;
  const pathwayProgressPct = pathwayItems.length > 0 ? Math.round((completedStepsCount / pathwayItems.length) * 100) : 0;
  const totalPlannedMinutes = pathwayItems.reduce((acc, it) => acc + (it.duration_minutes || 0), 0);
  const totalExpectedGain = pathwayItems.reduce((acc, it) => acc + (it.expected_gain || 0), 0);

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

  const heatmapData = insights?.activity_heatmap || {
    current_streak: health.study_streak_days || 7,
    longest_streak: 18,
    total_active_days: 64,
    total_activities: 328,
    daily_counts: {},
    available_years: [2026, 2025]
  };

  const getHeatmapGrid = (yearOpt, counts = {}) => {
    const today = new Date();
    let start, end;
    if (yearOpt === '2025') {
      start = new Date(2025, 0, 1);
      end = new Date(2025, 11, 31);
    } else if (yearOpt === '2026') {
      start = new Date(2026, 0, 1);
      end = new Date(2026, 11, 31);
    } else {
      end = new Date(today);
      start = new Date(today);
      start.setDate(today.getDate() - 364);
    }

    const alignedStart = new Date(start);
    alignedStart.setDate(alignedStart.getDate() - alignedStart.getDay());

    const weeks = [];
    let cur = new Date(alignedStart);
    const monthMarkers = [];
    let prevMonth = -1;
    let yearTotalActs = 0;
    let yearActiveDays = 0;

    for (let w = 0; w < 53; w++) {
      const curWeek = [];
      for (let d = 0; d < 7; d++) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const dayNum = String(cur.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${dayNum}`;
        const count = counts[dateStr] || 0;

        let intensity = 0;
        if (count > 0) {
          if (count <= 2) intensity = 1;
          else if (count <= 4) intensity = 2;
          else if (count <= 7) intensity = 3;
          else intensity = 4;
        }

        const isFuture = cur > today;
        const inYear = (yearOpt === 'pastYear') 
          ? (cur >= start && cur <= end) 
          : (cur.getFullYear().toString() === yearOpt);

        if (inYear && !isFuture && count > 0) {
          yearTotalActs += count;
          yearActiveDays += 1;
        }

        const curMonth = cur.getMonth();
        if (d === 0 && curMonth !== prevMonth && w < 52) {
          monthMarkers.push({
            colIndex: w,
            label: cur.toLocaleString('en-US', { month: 'short' })
          });
          prevMonth = curMonth;
        }

        curWeek.push({
          dateStr,
          count: isFuture ? 0 : count,
          intensity: isFuture ? 0 : intensity,
          isFuture,
          isToday: cur.toDateString() === today.toDateString(),
          dayName: cur.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
          inYear
        });

        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(curWeek);
    }

    return { weeks, monthMarkers, yearTotalActs, yearActiveDays };
  };

  const { weeks: heatmapWeeks, monthMarkers, yearTotalActs, yearActiveDays } = getHeatmapGrid(selectedYear, heatmapData.daily_counts);

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
                  health.mastery_change_pct >= 0 ? "text-[#16A34A] dark:text-[#4ADE80]" : "text-[#DC2626] dark:text-[#F87171]"
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
                <Flame className="w-5 h-5 text-[#F59E0B] fill-current" />
                <span>{health.study_streak_days}d</span>
              </span>
            </div>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">
              {health.cards_due_today} cards due today
            </span>
          </div>

        </div>

        {/* Dynamic Prominent Takeaway Sentence */}
        <div className="p-4 rounded-2xl bg-[var(--primary-subtle)] border border-[var(--primary)]/20 flex items-start sm:items-center gap-3">
          <Sparkles className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-sm font-semibold text-[var(--text-main)] leading-relaxed">
            {insights?.headline_takeaway || "You're improving steadily. Your biggest opportunity is Operating Systems."}
          </p>
        </div>
      </motion.section>

      {/* 3. HERO SPLIT: MULTI-CONSTRAINT STUDY PATHWAY STUDIO (REC-01 v2) + MEMORY & RETENTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* DYNAMIC STUDY PATHWAY STUDIO (Dominant Decision Engine - 8 cols) */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="lg:col-span-8 rounded-3xl border-2 border-[var(--primary)]/30 bg-[var(--bg-surface)] p-6 md:p-7 flex flex-col justify-between relative overflow-hidden shadow-sm space-y-6"
        >
          <div className="space-y-5">
            
            {/* Studio Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm">
                    Study Pathway Studio
                  </Badge>
                  <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--primary)] font-bold">
                    REC-01 v2
                  </span>
                  {activePathway.algorithm_version && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-[var(--text-muted)]">
                      {activePathway.algorithm_version}
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-main)] leading-tight">
                  Adaptive Learning Pathway
                </h2>
                <p className="text-xs text-[var(--text-muted)] font-medium">
                  Constrained Beam Search optimizer · Cognitive Pacing (Warmup → Core → Consolidation)
                </p>
              </div>

              {/* Controls: Re-Optimize & Science Drawer */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  onClick={() => fetchPathway(timeBudget, sessionMode, true)}
                  disabled={loadingPathway}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-secondary)] transition-all shadow-2xs active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Force refresh recommendation sequence (bypass hysteresis)"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${loadingPathway ? "animate-spin text-[var(--primary)]" : ""}`} />
                  <span>{loadingPathway ? "Optimizing..." : "Re-Optimize"}</span>
                </button>

                <button
                  onClick={() => setShowRoiDrawer(!showRoiDrawer)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shadow-2xs cursor-pointer ${
                    showRoiDrawer
                      ? "border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--primary)]"
                      : "border-[var(--border)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]"
                  }`}
                  title="View Educational ROI & Decision Science formulation"
                >
                  <Brain className="w-3.5 h-3.5 text-[var(--primary)]" />
                  <span>Science & ROI</span>
                  {showRoiDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Selector 1: Available Time Budget Pills */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-[var(--primary)]" />
                  <span>Available Time Budget:</span>
                </span>
                <span className="text-xs font-semibold text-[var(--text-main)] font-mono">
                  Target: {timeBudget} min · Planned: {totalPlannedMinutes} min
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { mins: 15, label: "15m Sprint" },
                  { mins: 30, label: "30m Standard" },
                  { mins: 45, label: "45m Deep" },
                  { mins: 60, label: "60m Focus" },
                  { mins: 90, label: "90m Deep Dive" }
                ].map(({ mins, label }) => {
                  const isSelected = timeBudget === mins;
                  return (
                    <button
                      key={mins}
                      onClick={() => {
                        setTimeBudget(mins);
                        fetchPathway(mins, sessionMode, true);
                      }}
                      className={`py-2 px-1.5 sm:px-2 rounded-xl text-center text-xs font-semibold transition-all cursor-pointer border ${
                        isSelected
                          ? "border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--primary)] shadow-xs scale-[1.02]"
                          : "border-[var(--border)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface)]"
                      }`}
                    >
                      <div className="font-bold text-xs sm:text-sm">{mins}m</div>
                      <div className="text-[10px] opacity-80 truncate hidden sm:block">{label.split(" ")[1]}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selector 2: Session Mode Strategy Switcher */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1.5">
                  <Target className="w-3 h-3 text-[#D6A84F]" />
                  <span>Optimization Strategy:</span>
                </span>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                  {sessionMode === "retention_rescue" && "α=0.60 (Retention Focus)"}
                  {sessionMode === "mastery_sprint" && "β=0.60 (BKT Transition Focus)"}
                  {sessionMode === "exam_cram" && "Urgency Multiplier Prioritized"}
                  {sessionMode === "balanced" && "Balanced Multi-Objective"}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: "balanced", label: "⚖️ Balanced", desc: "Gain across all pillars" },
                  { id: "retention_rescue", label: "🛡️ Retention Rescue", desc: "Prevent memory decay" },
                  { id: "mastery_sprint", label: "⚡ Mastery Sprint", desc: "Push BKT mastery" },
                  { id: "exam_cram", label: "🎯 Exam Cram", desc: "Exam urgency scaled" }
                ].map((mode) => {
                  const isSelected = sessionMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      onClick={() => {
                        setSessionMode(mode.id);
                        fetchPathway(timeBudget, mode.id, true);
                      }}
                      className={`p-2.5 rounded-xl text-left transition-all cursor-pointer border ${
                        isSelected
                          ? "border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--primary)] shadow-xs"
                          : "border-[var(--border)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{mode.label}</div>
                      <div className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{mode.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sequence Meta Progress Bar */}
            <div className="p-3.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-[#16A34A] dark:text-[#4ADE80]" />
                  <span>{completedStepsCount} of {pathwayItems.length} Steps Completed</span>
                </span>
                <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-muted)]">
                  <span>Gain: <strong className="text-[var(--text-main)]">+{Math.round(totalExpectedGain * 100)}%</strong></span>
                  <span>·</span>
                  <span>ROI: <strong className="text-[var(--primary)]">{activePathway.total_roi_score?.toFixed(3)}/m</strong></span>
                </div>
              </div>
              <div className="w-full h-2 bg-[var(--bg-surface)] rounded-full overflow-hidden border border-[var(--border)]">
                <div
                  className="h-full bg-gradient-to-r from-[var(--primary)] to-[#10B981] transition-all duration-500 rounded-full"
                  style={{ width: `${pathwayProgressPct}%` }}
                />
              </div>
            </div>

            {/* Decision Science & ROI Collapsible Drawer */}
            {showRoiDrawer && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary-subtle)] text-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[var(--primary)]/20 pb-2">
                  <div className="flex items-center gap-1.5 font-bold text-[var(--text-main)]">
                    <Activity className="w-4 h-4 text-[var(--primary)]" />
                    <span>Multi-Constraint Decision Science Formulation</span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--primary)]">REC-01 v2 Math Kernel</span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] font-mono text-xs text-[var(--text-main)] text-center font-bold leading-relaxed">
                  {"ROI(c, a, t) = [ ΔR(c,a) + ΔL(c,a) + Δθ(c,a) + λ·G(c) ] / t × W_exam(c)"}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-[var(--text-secondary)]">
                  <div className="space-y-1">
                    <strong className="text-[var(--text-main)] block">1. Read-Only State Snapshot</strong>
                    <p>Consumes BKT mastery P(L), FORGET-01 retrievability R(t), Rasch ability θ, and Knowledge Graph dependencies without mutating learner tables.</p>
                  </div>
                  <div className="space-y-1">
                    <strong className="text-[var(--text-main)] block">2. Pruned Beam Search (K=8)</strong>
                    <p>Evaluates combinations of candidates subject to exact duration budget T ≤ {timeBudget}m and cognitive pacing (Warmup ≺ Core ≺ Consolidation).</p>
                  </div>
                  <div className="space-y-1">
                    <strong className="text-[var(--text-main)] block">3. Prerequisite Gap Unlocking</strong>
                    <p>{"Calculates descendant gap propagation G(c) = Σ (1 - P(L_d)) so mastering root topics unlocks downstream concepts."}</p>
                  </div>
                  <div className="space-y-1">
                    <strong className="text-[var(--text-main)] block">4. Adaptive Replanning</strong>
                    <p>Every completed step records pre- and post-learning states in the telemetry log and dynamically re-scores remaining steps if mastery is achieved early.</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="sage" size="sm">KT-01 v2 (BKT)</Badge>
                  <Badge variant="gold" size="sm">FORGET-01 v1 (Retention)</Badge>
                  <Badge variant="primary" size="sm">ADAPT-01 v1 (CAT 1PL)</Badge>
                  <Badge variant="weak" size="sm">REC-01 v2 (Beam Search)</Badge>
                </div>
              </motion.div>
            )}

            {/* Stepper Execution HUD: Step Cards List */}
            <div className="space-y-3 pt-1">
              <span className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider font-mono block">
                Optimized Study Sequence:
              </span>

              {pathwayItems.map((step, idx) => {
                const isCompleted = step.status === "completed";
                const isSkipped = step.status === "skipped";
                const isPending = !isCompleted && !isSkipped;
                const phase = step.phase || "core";

                // Phase badge color
                const phaseBadge =
                  phase === "warmup"
                    ? { bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20", label: "WARMUP" }
                    : phase === "consolidation"
                    ? { bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20", label: "CONSOLIDATION" }
                    : { bg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20", label: "CORE FOCUS" };

                // Tool Icon
                const ToolIcon =
                  step.tool === "flashcards" ? Layers :
                  step.tool === "adaptive_cat" ? Cpu :
                  step.tool === "feynman" ? Sparkles : BookOpen;

                return (
                  <motion.div
                    key={step.step_id || idx}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className={`p-4 rounded-2xl border transition-all ${
                      isCompleted
                        ? "border-emerald-500/30 bg-emerald-500/5 opacity-85"
                        : isSkipped
                        ? "border-[var(--border)] bg-[var(--bg-surface-elevated)] opacity-60"
                        : "border-[var(--border)] bg-[var(--bg-surface-elevated)] hover:border-[var(--primary)]/40 hover:shadow-2xs"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      
                      {/* Left: Step index, Phase badge, Tool icon, Title */}
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] flex items-center justify-center text-[10px] font-bold shrink-0">
                            {idx + 1}
                          </span>
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${phaseBadge.bg}`}>
                            {phaseBadge.label}
                          </span>
                          <span className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{step.duration_minutes}m</span>
                          </span>
                          {step.priority_components?.retention_now !== undefined && (
                            <span className="text-[10px] font-mono text-[var(--text-muted)] hidden md:inline">
                              R: {step.priority_components.retention_now}% · Mastery: {step.priority_components.p_known}%
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <ToolIcon className="w-4 h-4 text-[var(--primary)] shrink-0" />
                          <h4 className={`text-sm font-bold text-[var(--text-main)] truncate ${isCompleted ? "line-through text-[var(--text-muted)]" : ""}`}>
                            {step.title}
                          </h4>
                        </div>

                        {step.rationale && (
                          <p className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-relaxed">
                            {step.rationale}
                          </p>
                        )}
                      </div>

                      {/* Right: Status badge & Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                            <Check className="w-3.5 h-3.5" />
                            <span>Completed</span>
                          </span>
                        )}

                        {isSkipped && (
                          <span className="inline-flex items-center px-3 py-1.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-xs text-[var(--text-muted)] font-semibold">
                            Skipped
                          </span>
                        )}

                        {isPending && (
                          <div className="flex items-center gap-1.5">
                            {/* 1-Click Launch Button */}
                            <Button
                              variant="primary"
                              size="sm"
                              className="text-xs font-semibold shadow-2xs gap-1 cursor-pointer"
                              onClick={() => handleLaunchStep(step)}
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Launch</span>
                            </Button>

                            {/* Mark Step Completed Button */}
                            <button
                              onClick={() => handleCompleteStep(step.step_id, step.duration_seconds)}
                              disabled={completingStepId === step.step_id}
                              className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-600 dark:hover:text-emerald-400 text-[var(--text-muted)] transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
                              title="Mark step completed and log educational telemetry"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>

                            {/* Skip Step Button */}
                            <button
                              onClick={() => handleSkipStep(step.step_id)}
                              className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-all cursor-pointer shadow-2xs active:scale-95"
                              title="Skip step"
                            >
                              <SkipForward className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                    </div>
                  </motion.div>
                );
              })}
            </div>

          </div>
        </motion.section>

        {/* MEMORY & RETENTION (FSRS Gold Protocol Card - 4 cols) */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-4 rounded-3xl border border-[#D6A84F]/30 bg-[#D6A84F]/5 p-6 md:p-7 flex flex-col justify-between relative overflow-hidden shadow-xs space-y-6"
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
                  <Clock className="w-4 h-4 text-[#DC2626] dark:text-[#F87171]" />
                  <span>Cards Due Today:</span>
                </span>
                <strong className="font-mono text-[#DC2626] dark:text-[#F87171]">{health.cards_due_today} cards</strong>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                  <span>Memory Stability:</span>
                </span>
                <strong className="font-mono text-[var(--text-main)]">{retentionRadar.overall_memory_health?.toFixed(1) || "88.2"}%</strong>
              </div>
            </div>
          </div>

          <div className="pt-4 space-y-2">
            <Button
              variant="secondary"
              size="md"
              className="w-full justify-center text-xs font-semibold shadow-2xs"
              onClick={() => navigate("/flashcards", { state: { filter: "due" } })}
            >
              <span>Review Due Cards ({health.cards_due_today})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
            <button
              onClick={handleLaunchBooster}
              disabled={launchingBooster}
              className="w-full py-2 px-3 rounded-xl border border-[var(--primary)]/30 bg-[var(--primary-subtle)] text-[var(--primary)] text-xs font-semibold hover:bg-[var(--primary)] hover:text-white transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{launchingBooster ? "Calibrating..." : "1-Click CAT Booster"}</span>
            </button>
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
              <BookOpen className="w-4 h-4 text-[var(--primary)]" />
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
              className="group p-3.5 sm:p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] hover:border-[var(--primary)]/40 hover:shadow-xs transition-all cursor-pointer space-y-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-bold text-[var(--text-main)] group-hover:text-[var(--primary)] transition-colors truncate">
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
                      item.change > 0 ? "text-[#16A34A] dark:text-[#4ADE80]" : "text-[#DC2626] dark:text-[#F87171]"
                    }`}>
                      {item.change > 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {Math.abs(item.change)}%
                    </span>
                  )}

                  <Badge
                    variant={item.color_variant || (item.mastery >= 80 ? "mastered" : item.mastery >= 65 ? "developing" : item.mastery >= 50 ? "review" : "weak")}
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
                    item.mastery >= 80 ? "bg-[#16A34A] dark:bg-[#4ADE80]" : item.mastery >= 65 ? "bg-[#D97706] dark:bg-[#FBBF24]" : item.mastery >= 50 ? "bg-[#EA580C] dark:bg-[#FB923C]" : "bg-[#DC2626] dark:bg-[#F87171]"
                  }`}
                  style={{ width: `${Math.max(6, item.mastery)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.section>

      {/* 4.5 BAYESIAN KNOWLEDGE TRACING (BKT) - COGNITIVE TRACE */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 sm:p-7 shadow-xs space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[var(--border)] pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--ai-subtle)] border border-[var(--ai-border)] flex items-center justify-center text-[var(--ai)]">
                <Brain className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                <span>Cognitive Knowledge Trace</span>
                <Badge variant="ai" size="sm">BKT Engine</Badge>
              </h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-2xl">
              Hidden Markov Model estimating your true latent knowledge state <span className="font-mono text-[var(--text-secondary)]">P(Known)</span> by statistically filtering lucky guesses and careless slips.
            </p>
          </div>

          <button
            onClick={() => setShowBktInfo(!showBktInfo)}
            className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] transition-all cursor-pointer shadow-2xs"
          >
            <HelpCircle className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>How BKT Works</span>
            {showBktInfo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Expandable Mathematical Model Explainer */}
        {showBktInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="p-4 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-2.5"
          >
            <div className="flex items-center gap-2 font-semibold text-[var(--text-main)]">
              <Cpu className="w-4 h-4 text-[var(--ai)]" />
              <span>Corbett &amp; Anderson Bayesian Knowledge Tracing Protocol</span>
            </div>
            <p className="leading-relaxed">
              Standard grading assumes every correct answer is pure mastery. In reality, students can guess correctly without knowing (<span className="font-mono text-amber-600 dark:text-amber-400">P(Guess) = 25%</span>), or make careless mistakes on concepts they actually understand (<span className="font-mono text-rose-600 dark:text-rose-400">P(Slip) = 10%</span>).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 font-mono text-[11px]">
              <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
                <span className="text-[var(--text-muted)] block text-[10px]">Posterior Observation</span>
                <span className="font-bold text-[var(--text-main)]">Bayes Theorem Update</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
                <span className="text-[var(--text-muted)] block text-[10px]">Learning Transition</span>
                <span className="font-bold text-[var(--text-main)]">P(Transition) = 15%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
                <span className="text-[var(--text-muted)] block text-[10px]">Mastery Barrier</span>
                <span className="font-bold text-[#16A34A] dark:text-[#4ADE80]">P(Known) &ge; 85%</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* 4 Metric Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] space-y-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">Overall Knowledge Index</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-body text-[var(--text-main)]">
                {bktIndex}%
              </span>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">mean P(L)</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--border)] overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-[var(--primary)] transition-all duration-700"
                style={{ width: `${Math.max(5, bktIndex)}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] space-y-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">Mastered Concepts</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-body text-[#16A34A] dark:text-[#4ADE80]">
                {bktMasteredCount}
              </span>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">P(L) &ge; 85%</span>
            </div>
            <span className="text-[10px] font-mono text-[#16A34A] dark:text-[#4ADE80] block mt-1">High retention</span>
          </div>

          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] space-y-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">Developing</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-body text-[#D97706] dark:text-[#FBBF24]">
                {bktDevelopingCount}
              </span>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">60% &ndash; 84%</span>
            </div>
            <span className="text-[10px] font-mono text-[#D97706] dark:text-[#FBBF24] block mt-1">Strengthening</span>
          </div>

          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] space-y-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">Needs Review</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-body text-[#DC2626] dark:text-[#F87171]">
                {bktReviewCount}
              </span>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">&lt; 60%</span>
            </div>
            <span className="text-[10px] font-mono text-[#DC2626] dark:text-[#F87171] block mt-1">Priority target</span>
          </div>
        </div>

        {/* Concept Cards Stack */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] px-1">
            <span>Latent Concept Breakdown</span>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">{activeConcepts.length} concepts tracked</span>
          </div>

          {activeConcepts.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-[var(--border)] text-center space-y-2">
              <Activity className="w-6 h-6 text-[var(--text-muted)] mx-auto animate-pulse" />
              <p className="text-xs font-medium text-[var(--text-main)]">No concept observations recorded yet</p>
              <p className="text-[11px] text-[var(--text-muted)] max-w-sm mx-auto">
                Complete a quiz or review flashcards to let the Bayesian Knowledge Tracing engine model your cognitive state.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => navigate("/quiz")}
              >
                Launch Diagnostic Quiz
              </Button>
            </div>
          ) : (
            activeConcepts.map((concept, idx) => {
              const isMastered = concept.p_known >= 0.85;
              const isDeveloping = concept.p_known >= 0.60 && !isMastered;
              const statusVariant = isMastered ? "mastered" : isDeveloping ? "developing" : "weak";

              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] hover:border-[var(--primary)]/40 transition-all space-y-3 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[var(--text-main)]">
                          {concept.concept_name}
                        </span>
                        <Badge variant={statusVariant} size="sm">
                          {concept.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-muted)]">
                        <span>{concept.opportunities} practice attempts</span>
                        <span>&middot;</span>
                        <span>{concept.consecutive_correct} streak</span>
                        <span>&middot;</span>
                        <span className="text-[var(--text-secondary)]">
                          Predicted next accuracy: <strong className="text-[var(--text-main)]">{concept.predicted_accuracy}%</strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                      <div className="text-right">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="text-xs font-mono text-[var(--text-muted)]">P(L):</span>
                          <span className="text-base font-mono font-extrabold text-[var(--text-main)]">
                            {Number(concept.p_known).toFixed(3)}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">
                          {concept.mastery_score}% mastery
                        </span>
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        className="px-2.5 py-1 text-xs"
                        onClick={() => handleStudyConcept(concept)}
                      >
                        <span>Drill</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Dual-layer Probability Bar with 85% Mastery Barrier Marker */}
                  <div className="relative pt-1 pb-1">
                    <div className="w-full h-2.5 rounded-full bg-[var(--border)] overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          isMastered
                            ? "bg-[#16A34A] dark:bg-[#4ADE80]"
                            : isDeveloping
                            ? "bg-[#D97706] dark:bg-[#FBBF24]"
                            : "bg-[#DC2626] dark:bg-[#F87171]"
                        }`}
                        style={{ width: `${Math.max(4, concept.mastery_score)}%` }}
                      />
                    </div>
                    {/* Mastery Barrier Tick at 85% */}
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-emerald-600/70 dark:bg-emerald-400/80 z-10 pointer-events-none"
                      style={{ left: "85%" }}
                      title="85% Mastery Barrier"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info label */}
        <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] pt-1 border-t border-[var(--border)]">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] dark:text-[#4ADE80]" />
            <span>Auto-calibrating Markov chains active</span>
          </span>
          <span>Target Mastery Threshold: 85%</span>
        </div>
      </motion.section>

      {/* 4.7 RETENTION DECAY RADAR & MEMORY BOOSTER (FORGET-01) */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.19 }}
        className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 sm:p-7 shadow-xs space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[var(--border)] pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 dark:text-amber-400">
                <Timer className="w-4 h-4" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] flex items-center gap-2">
                <span>Memory Retention Decay Radar</span>
                <Badge variant="gold" size="sm">FORGET-01</Badge>
              </h3>
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed max-w-2xl">
              Deterministic exponential retention model forecasting conceptual retrievability loss over elapsed time. Feeds decaying concepts directly into adaptive CAT recovery.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
            <button
              onClick={() => setShowRetentionInfo(!showRetentionInfo)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-secondary)] transition-all cursor-pointer shadow-2xs"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>Model &amp; Science</span>
              {showRetentionInfo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>

            <Button
              variant="primary"
              size="sm"
              disabled={launchingBooster}
              onClick={handleLaunchBooster}
              className="px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-xs"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>{launchingBooster ? "Launching CAT..." : "Launch Memory Booster"}</span>
              {retentionRadar.critical_count > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-black/30 text-[10px] font-mono font-bold">
                  {retentionRadar.critical_count}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Expandable Mathematical Model Explainer */}
        {showRetentionInfo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="p-4 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-secondary)] space-y-2.5"
          >
            <div className="flex items-center gap-2 font-semibold text-[var(--text-main)]">
              <Timer className="w-4 h-4 text-amber-500" />
              <span>Shiro Deterministic Concept Retention Model (forget-v1)</span>
            </div>
            <p className="leading-relaxed">
              Human cognitive decay is modeled here as a deterministic exponential approximation <span className="font-mono text-[var(--text-main)]">R(t) = e^(-t / &tau;)</span>, calibrated to conceptual domains. It tracks concept-level retention risk across documents and operates strictly in parallel with card-level FSRS spaced repetition.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 font-mono text-[11px]">
              <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
                <span className="text-[var(--text-muted)] block text-[10px]">Time Constant (&tau;)</span>
                <span className="font-bold text-[var(--text-main)]">R(&tau;) = e^-1 &approx; 36.8%</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
                <span className="text-[var(--text-muted)] block text-[10px]">Memory Half-Life (h)</span>
                <span className="font-bold text-[var(--text-main)]">h = &tau; &middot; ln(2) (R = 50%)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
                <span className="text-[var(--text-muted)] block text-[10px]">Conditional 7-Day Risk</span>
                <span className="font-bold text-rose-600 dark:text-rose-400">P_7d = 1 - e^(-7 / &tau;)</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* 4 Retention Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] space-y-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">Overall Memory Health</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-body text-[var(--text-main)]">
                {retentionRadar.overall_memory_health}%
              </span>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">mean R(now)</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-[var(--border)] overflow-hidden mt-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-700"
                style={{ width: `${Math.max(5, retentionRadar.overall_memory_health)}%` }}
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] space-y-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">Resilient Concepts</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-body text-[#16A34A] dark:text-[#4ADE80]">
                {retentionRadar.resilient_count}
              </span>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">R &ge; 80%</span>
            </div>
            <span className="text-[10px] font-mono text-[#16A34A] dark:text-[#4ADE80] block mt-1">Stable consolidation</span>
          </div>

          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] space-y-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">Decaying Attrition</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-body text-[#D97706] dark:text-[#FBBF24]">
                {retentionRadar.decaying_count}
              </span>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">60% &ndash; 79%</span>
            </div>
            <span className="text-[10px] font-mono text-[#D97706] dark:text-[#FBBF24] block mt-1">Review window open</span>
          </div>

          <div className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] space-y-1">
            <span className="text-xs font-medium text-[var(--text-muted)]">Critical Attrition</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl sm:text-3xl font-extrabold font-body text-[#DC2626] dark:text-[#F87171]">
                {retentionRadar.critical_count}
              </span>
              <span className="text-[11px] font-mono text-[var(--text-muted)]">R &lt; 60%</span>
            </div>
            <span className="text-[10px] font-mono text-[#DC2626] dark:text-[#F87171] block mt-1">Immediate booster needed</span>
          </div>
        </div>

        {/* Concept Retention Cards Stack */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[var(--text-secondary)] px-1">
            <span>Concept Retention Radar &amp; 7-Day Risk Forecast</span>
            <span className="font-mono text-[11px] text-[var(--text-muted)]">{radarConcepts.length} concepts monitored</span>
          </div>

          {radarConcepts.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-[var(--border)] text-center space-y-2">
              <Timer className="w-6 h-6 text-[var(--text-muted)] mx-auto animate-pulse" />
              <p className="text-xs font-medium text-[var(--text-main)]">No concept retention trajectories active</p>
              <p className="text-[11px] text-[var(--text-muted)] max-w-sm mx-auto">
                Practice quizzes, flashcards, or adaptive assessments to initialize continuous retention modeling.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-2"
                onClick={() => navigate("/quiz")}
              >
                Launch Study Session
              </Button>
            </div>
          ) : (
            radarConcepts.map((concept, idx) => {
              const isResilient = concept.category === "resilient" || concept.retention_now >= 80;
              const isDecaying = (concept.category === "decaying" || (concept.retention_now >= 60 && concept.retention_now < 80)) && !isResilient;
              const statusVariant = isResilient ? "mastered" : isDecaying ? "developing" : "weak";
              const statusLabel = isResilient ? "Resilient" : isDecaying ? "Decaying" : "Critical Attrition";

              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-elevated)] hover:border-[var(--primary)]/40 transition-all space-y-3 shadow-2xs"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-[var(--text-main)]">
                          {concept.concept_name}
                        </span>
                        <Badge variant={statusVariant} size="sm">
                          {statusLabel}
                        </Badge>
                        {concept.urgency_score !== undefined && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)]">
                            Urgency: {Number(concept.urgency_score).toFixed(2)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] font-mono text-[var(--text-muted)] flex-wrap">
                        <span>Time constant (&tau;): <strong className="text-[var(--text-secondary)]">{concept.time_constant_days}d</strong></span>
                        <span>&middot;</span>
                        <span>Half-life: <strong className="text-[var(--text-secondary)]">{concept.half_life_days}d</strong></span>
                        <span>&middot;</span>
                        <span>
                          7-Day Forgetting Risk:{" "}
                          <strong className={concept.predicted_forgetting_7d > 60 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-[var(--text-main)]"}>
                            {concept.predicted_forgetting_7d}%
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto">
                      <div className="text-right">
                        <div className="flex items-baseline gap-1 justify-end">
                          <span className="text-xs font-mono text-[var(--text-muted)]">R(now):</span>
                          <span className={`text-base font-mono font-extrabold ${
                            isResilient
                              ? "text-[#16A34A] dark:text-[#4ADE80]"
                              : isDecaying
                              ? "text-[#D97706] dark:text-[#FBBF24]"
                              : "text-[#DC2626] dark:text-[#F87171]"
                          }`}>
                            {Number(concept.retention_now).toFixed(1)}%
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-[var(--text-muted)]">
                          Projected in 7d: {Number(concept.retention_in_7d || concept.retention_now * 0.75).toFixed(1)}%
                        </span>
                      </div>

                      <Button
                        variant={isResilient ? "secondary" : "primary"}
                        size="sm"
                        className="px-2.5 py-1 text-xs"
                        onClick={() => handleRefreshConcept(concept)}
                      >
                        <span>Refresh</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Retrievability Progress Bar */}
                  <div className="relative pt-1 pb-1">
                    <div className="w-full h-2.5 rounded-full bg-[var(--border)] overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                          isResilient
                            ? "bg-[#16A34A] dark:bg-[#4ADE80]"
                            : isDecaying
                            ? "bg-[#D97706] dark:bg-[#FBBF24]"
                            : "bg-[#DC2626] dark:bg-[#F87171]"
                        }`}
                        style={{ width: `${Math.max(4, concept.retention_now)}%` }}
                      />
                    </div>
                    {/* Critical Threshold Tick at 60% */}
                    <div
                      className="absolute top-0 bottom-0 w-[2px] bg-rose-600/60 dark:bg-rose-400/70 z-10 pointer-events-none"
                      style={{ left: "60%" }}
                      title="Critical Attrition Threshold (60%)"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info label */}
        <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] pt-1 border-t border-[var(--border)]">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A] dark:text-[#4ADE80]" />
            <span>Debounced spacing model active &middot; Model forget-v1</span>
          </span>
          <span>Critical Threshold: 60%</span>
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
              <TrendingUp className="w-4 h-4 text-[var(--primary)]" />
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
                <span className={`font-mono font-bold ${netGain >= 0 ? "text-[#16A34A] dark:text-[#4ADE80]" : "text-[#DC2626] dark:text-[#F87171]"}`}>
                  {netGain >= 0 ? "+" : ""}{netGain}%
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs shadow-2xs">
                <span className="text-[var(--text-muted)]">Peak:</span>
                <span className="font-mono font-bold text-[var(--primary)]">{peakScore}%</span>
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
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
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
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
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
                stroke="#16A34A"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: "Mastery Target (80%)",
                  position: "insideTopRight",
                  fill: "#16A34A",
                  fontSize: 10,
                  opacity: 0.9
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
                          <span className="font-mono font-bold text-[var(--primary)] text-sm">{data.score}%</span>
                        </div>
                        {data.milestone ? (
                          <div className="flex items-center gap-1.5 text-[11px] text-[#16A34A] dark:text-[#4ADE80] font-semibold pt-0.5">
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
                stroke="var(--primary)"
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
                      fill={isMilestone ? "var(--primary-strong)" : "var(--primary)"}
                      stroke="var(--bg-surface)"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{ r: 7, fill: "var(--primary)", stroke: "var(--bg-surface)", strokeWidth: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.section>

      {/* 6. FULL-WIDTH ALL-TIME STREAK & GITHUB-STYLE YEARLY ACTIVITY HEATMAP */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 sm:p-7 shadow-xs space-y-5 relative overflow-hidden"
      >
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        {/* Header & Year Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5 relative">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base sm:text-lg font-bold text-[var(--text-main)] font-serif flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>Study Activity & Habit Consistency Matrix</span>
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Telemetry
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              52-week longitudinal heat distribution across quizzes, flashcards, mindmaps, and Shiro AI sessions
            </p>
          </div>

          {/* Year Filter Switcher */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] self-start sm:self-auto shrink-0 shadow-2xs">
            {[
              { key: '2026', label: '2026' },
              { key: '2025', label: '2025' },
              { key: 'pastYear', label: 'Last 12 Months' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => {
                  setSelectedYear(tab.key);
                  setFilterIntensity(null);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  selectedYear === tab.key
                    ? "bg-[var(--bg-surface)] text-[var(--text-main)] shadow-xs font-bold border border-[var(--border)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4 Habit KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 relative">
          
          {/* Card 1: Current Streak */}
          <div className="p-3.5 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex flex-col justify-between shadow-2xs hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
              <span>Current Streak</span>
              <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black font-body text-[var(--text-main)]">
                  {heatmapData.current_streak}d
                </span>
                <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">active</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">Consecutive daily study</span>
            </div>
          </div>

          {/* Card 2: Longest Streak (All-Time) */}
          <div className="p-3.5 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex flex-col justify-between shadow-2xs hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
              <span>Longest Streak</span>
              <div className="w-7 h-7 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black font-body text-[var(--text-main)]">
                  {heatmapData.longest_streak}d
                </span>
                <span className="text-[11px] font-semibold text-yellow-600 dark:text-yellow-400 font-mono">record</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">All-time personal record</span>
            </div>
          </div>

          {/* Card 3: Active Study Days */}
          <div className="p-3.5 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex flex-col justify-between shadow-2xs hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
              <span>Active Study Days</span>
              <div className="w-7 h-7 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black font-body text-[var(--text-main)]">
                  {yearActiveDays}
                </span>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">days</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">In {selectedYear === 'pastYear' ? 'Last 12 Months' : selectedYear}</span>
            </div>
          </div>

          {/* Card 4: Total Study Sessions */}
          <div className="p-3.5 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex flex-col justify-between shadow-2xs hover:-translate-y-0.5 transition-all">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-medium">
              <span>Total Activities</span>
              <div className="w-7 h-7 rounded-xl bg-[var(--primary-subtle)] flex items-center justify-center">
                <Zap className="w-4 h-4 text-[var(--primary)]" />
              </div>
            </div>
            <div className="mt-2">
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black font-body text-[var(--text-main)]">
                  {yearTotalActs}
                </span>
                <span className="text-[11px] font-semibold text-[var(--primary)]">drills</span>
              </div>
              <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">Quizzes, cards & chats</span>
            </div>
          </div>

        </div>

        {/* Live Interactive Telemetry Inspector Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs transition-all duration-200 shadow-2xs">
          {hoveredDay ? (
            <div className="flex items-center gap-2.5">
              <span className={`w-3 h-3 rounded-full shrink-0 ${
                hoveredDay.count > 0 
                  ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" 
                  : "bg-zinc-400"
              }`} />
              <span className="font-bold text-[var(--text-main)] font-mono">{hoveredDay.dayName}</span>
              <span className="text-[var(--text-secondary)]">
                — {hoveredDay.count > 0 ? (
                  <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{hoveredDay.count} study {hoveredDay.count === 1 ? 'activity' : 'activities'} completed</strong>
                ) : (
                  <span className="text-[var(--text-muted)]">No study activities logged</span>
                )}
              </span>
              {hoveredDay.count >= 6 && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  High Intensity Drill 🔥
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[var(--text-muted)] font-mono text-[11px]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span>Hover any cell to inspect day volume, drills, and habit milestones</span>
            </div>
          )}

          <div className="flex items-center gap-3 font-mono text-[11px] text-[var(--text-muted)] shrink-0 self-end sm:self-auto">
            {filterIntensity !== null && (
              <button
                onClick={() => setFilterIntensity(null)}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--primary)] text-white hover:opacity-90 transition-all cursor-pointer"
              >
                Clear Filter ✕
              </button>
            )}
            <span>
              Consistency: <strong className="text-[var(--text-main)] font-semibold">{yearActiveDays} active days ({Math.min(100, Math.round((yearActiveDays / (selectedYear === '2026' ? 247 : 365)) * 100))}%)</strong>
            </span>
          </div>
        </div>

        {/* 52-Week GitHub Heatmap Grid Container (Horizontally Scrollable) */}
        <div className="heatmap-scroll-container overflow-x-auto pb-3 pt-1">
          <div className="min-w-[840px] space-y-2 select-none">
            
            {/* Pixel-Aligned Month Headers Row (Columns match cells exactly) */}
            <div className="flex items-center gap-[2.5px] pl-[26px]">
              {heatmapWeeks.map((_, wIdx) => {
                const marker = monthMarkers.find(m => m.colIndex === wIdx);
                return (
                  <div 
                    key={wIdx} 
                    className="w-3.5 sm:w-4 text-[10px] font-mono text-[var(--text-muted)] font-medium truncate select-none text-left"
                  >
                    {marker ? marker.label : ""}
                  </div>
                );
              })}
            </div>

            {/* Grid Container with Discrete Weekday Labels on Left */}
            <div className="flex items-start gap-1">
              
              {/* Discrete Weekday Labels (Rows 0-6 matching cells exactly) */}
              <div className="flex flex-col gap-[2.5px] w-[22px] text-[9px] font-mono text-[var(--text-muted)] select-none shrink-0 pt-0.5">
                <div className="h-3.5 sm:h-4 flex items-center justify-end leading-none text-transparent">-</div>
                <div className="h-3.5 sm:h-4 flex items-center justify-end leading-none font-semibold">Mon</div>
                <div className="h-3.5 sm:h-4 flex items-center justify-end leading-none text-transparent">-</div>
                <div className="h-3.5 sm:h-4 flex items-center justify-end leading-none font-semibold">Wed</div>
                <div className="h-3.5 sm:h-4 flex items-center justify-end leading-none text-transparent">-</div>
                <div className="h-3.5 sm:h-4 flex items-center justify-end leading-none font-semibold">Fri</div>
                <div className="h-3.5 sm:h-4 flex items-center justify-end leading-none text-transparent">-</div>
              </div>

              {/* Columns of 7 Days */}
              <div className="flex items-center gap-[2.5px]">
                {heatmapWeeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[2.5px]">
                    {week.map((day, dIdx) => {
                      // High-contrast, vibrant palette
                      const intensityClasses = [
                        "bg-[#E5E0D6] dark:bg-[#181D24] border border-[#D5CFBF] dark:border-[#27303E]",
                        "bg-[#A7F3D0] dark:bg-[#064E3B] border border-[#6EE7B7] dark:border-[#065F46]",
                        "bg-[#34D399] dark:bg-[#047857] border border-[#10B981] dark:border-[#059669]",
                        "bg-[#059669] dark:bg-[#10B981] border border-[#047857] dark:border-[#34D399] shadow-xs",
                        "bg-[#064E3B] dark:bg-[#34D399] border border-[#022C22] dark:border-[#6EE7B7] shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                      ];

                      const isFilteredOut = filterIntensity !== null && day.intensity !== filterIntensity;

                      return (
                        <div
                          key={dIdx}
                          onMouseEnter={() => setHoveredDay(day)}
                          onMouseLeave={() => setHoveredDay(null)}
                          title={`${day.count > 0 ? `${day.count} activities` : 'No activity'} on ${day.dayName}`}
                          className={`heatmap-cell w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-[3px] cursor-pointer ${
                            day.isFuture 
                              ? "opacity-20 bg-[var(--border)] border border-dashed border-[var(--border)] pointer-events-none" 
                              : isFilteredOut
                                ? "opacity-15 grayscale"
                                : intensityClasses[day.intensity]
                          } ${day.isToday ? "ring-2 ring-emerald-500 dark:ring-emerald-400 ring-offset-1 ring-offset-[var(--bg-surface)] heatmap-today" : ""}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Footer: Dynamic Session Total & Interactive Clickable Legend */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[var(--text-muted)] pt-3.5 border-t border-[var(--border)]">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>
                  <strong>{yearTotalActs}</strong> study drills completed across <strong>{yearActiveDays}</strong> active days in {selectedYear === 'pastYear' ? 'the past 12 months' : selectedYear}
                </span>
              </div>

              {/* Interactive Legend with click-to-filter */}
              <div className="flex items-center gap-2 font-mono text-[10px]">
                <span>Less</span>
                {[
                  { level: 0, label: "0 activities", cls: "bg-[#E5E0D6] dark:bg-[#181D24] border border-[#D5CFBF] dark:border-[#27303E]" },
                  { level: 1, label: "1-2 activities", cls: "bg-[#A7F3D0] dark:bg-[#064E3B] border border-[#6EE7B7] dark:border-[#065F46]" },
                  { level: 2, label: "3-4 activities", cls: "bg-[#34D399] dark:bg-[#047857] border border-[#10B981] dark:border-[#059669]" },
                  { level: 3, label: "5-7 activities", cls: "bg-[#059669] dark:bg-[#10B981] border border-[#047857] dark:border-[#34D399]" },
                  { level: 4, label: "8+ activities", cls: "bg-[#064E3B] dark:bg-[#34D399] border border-[#022C22] dark:border-[#6EE7B7]" }
                ].map(item => (
                  <button
                    key={item.level}
                    onClick={() => setFilterIntensity(filterIntensity === item.level ? null : item.level)}
                    title={`Click to filter: ${item.label}`}
                    className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[3px] transition-transform cursor-pointer hover:scale-125 ${item.cls} ${
                      filterIntensity === item.level ? "ring-2 ring-[var(--primary)] ring-offset-1 ring-offset-[var(--bg-surface)] scale-110" : ""
                    }`}
                  />
                ))}
                <span>More</span>
              </div>
            </div>

          </div>
        </div>
      </motion.section>

      {/* 7. LOWER SPLIT: BEST STUDY WINDOW + RECENT ACTIVITY */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        
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
                <Brain className="w-4 h-4 text-[var(--ai)]" />
                <span>Your Best Study Window</span>
              </h3>
              <Badge variant="ai" size="sm">
                AI Peak
              </Badge>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Empirical peak learning hours derived from quiz performance
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--ai-subtle)] border border-[var(--ai-border)] flex items-baseline justify-between">
            <div>
              <span className="text-2xl sm:text-3xl font-bold font-body text-[var(--text-main)]">
                {cognitivePeak.time_range_label || "9 AM – 12 PM"}
              </span>
              <p className="text-xs font-semibold text-[var(--ai)] mt-1">
                {cognitivePeak.efficiency || 88}% average quiz efficiency
              </p>
            </div>
          </div>

          <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between pt-1 border-t border-[var(--border)]">
            <span>Confidence: <strong>{cognitivePeak.confidence || "Moderate"}</strong></span>
            <span>Based on {cognitivePeak.data_points || 8} assessments</span>
          </div>
        </motion.section>

        {/* Recent Activity Log */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 shadow-xs space-y-4 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-bold text-[var(--text-main)] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[var(--primary)]" />
                <span>Recent Activity</span>
              </h3>
              <span className="text-xs text-[var(--text-muted)] font-mono">
                Latest study logs
              </span>
            </div>

            <div className="divide-y divide-[var(--border)] mt-2">
              {recentActivities.slice(0, 4).map((act, idx) => (
                <div
                  key={idx}
                  className="py-2.5 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-6 h-6 rounded-full bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex items-center justify-center shrink-0">
                      {act.type === "quiz" ? (
                        <Target className="w-3.5 h-3.5 text-[var(--primary)]" />
                      ) : act.type === "flashcards" ? (
                        <Layers className="w-3.5 h-3.5 text-[#F59E0B]" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-[var(--ai)]" />
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
          </div>

          <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--text-muted)] font-mono">
            <span>Continuous Telemetry Active</span>
            <span className="text-[#16A34A] dark:text-[#4ADE80] font-semibold">Synced</span>
          </div>
        </motion.section>

      </div>

    </div>
  );
};

export default ProgressReport;
