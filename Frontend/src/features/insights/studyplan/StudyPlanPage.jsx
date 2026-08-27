import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Context } from '../../../context/Context';
import API_BASE_URL from '../../../api/config.js';
import { fetchWithAuth } from '../../../api/fetchWithAuth';
import toast from 'react-hot-toast';
import { 
  Calendar, 
  Target, 
  Flame, 
  Clock, 
  BookOpen, 
  HelpCircle, 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  ArrowRight, 
  Zap, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  TrendingUp, 
  BrainCircuit, 
  Compass, 
  BarChart2, 
  RefreshCw, 
  Award 
} from 'lucide-react';
import Card, { CardHeader, CardContent } from '../../../components/ui/Card';
import Button from '../../../components/ui/Button';
import Badge from '../../../components/ui/Badge';
import Tooltip from '../../../components/ui/Tooltip';

export const StudyPlanPage = () => {
  const { user } = useAuth();
  const { documents, t } = useContext(Context);
  const navigate = useNavigate();

  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeView, setActiveView] = useState('roadmap'); // 'roadmap' | 'blueprint' | 'create'
  const [selectedDayOffset, setSelectedDayOffset] = useState(0);

  // Form parameters
  const [examDate, setExamDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // default 2 weeks ahead
    return d.toISOString().split('T')[0];
  });
  const [hoursPerDay, setHoursPerDay] = useState(3);
  const [crashCourse, setCrashCourse] = useState(false);
  const [subjects, setSubjects] = useState([
    { name: 'Core Foundations & Principles', priority: 1, hours_needed: 8, yieldTier: 'High Yield' },
    { name: 'Problem Solving & Optimization', priority: 2, hours_needed: 6, yieldTier: 'Medium Yield' },
    { name: 'Formulas & Definitions Review', priority: 3, hours_needed: 4, yieldTier: 'High Yield' }
  ]);

  const fetchTimetable = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/timetable`);
      if (response.ok) {
        const data = await response.json();
        if (data && !data.message) {
          setTimetable(data);
        } else {
          setTimetable(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch timetable:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, [user]);

  // Populate subjects automatically from uploaded document names if available
  const handleAutoPopulateFromDocs = () => {
    if (!documents || documents.length === 0) {
      toast.error('No uploaded documents found. Add subjects manually.');
      return;
    }
    const docSubjects = documents.slice(0, 4).map((d, i) => ({
      name: d.filename.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
      priority: i + 1,
      hours_needed: 6,
      yieldTier: i % 2 === 0 ? 'High Yield' : 'Medium Yield'
    }));
    setSubjects(docSubjects);
    toast.success(`Populated ${docSubjects.length} subject units from your library!`);
  };

  const handleCreateTimetable = async (e) => {
    if (e) e.preventDefault();
    if (!examDate) {
      toast.error('Please specify target exam date');
      return;
    }
    const validSubjects = subjects.filter(s => s.name.trim());
    if (validSubjects.length === 0) {
      toast.error('Please provide at least one subject');
      return;
    }

    setCreating(true);
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/create-timetable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id || 1,
          exam_date: new Date(examDate).toISOString(),
          study_hours_per_day: Number(hoursPerDay),
          subjects: validSubjects,
          crash_course: crashCourse
        }),
      });

      if (response.ok) {
        toast.success('✨ AI Study Plan & Blueprint generated!');
        await fetchTimetable();
        setActiveView('roadmap');
      } else {
        const errData = await response.json();
        toast.error(errData.detail || 'Failed to generate timetable');
      }
    } catch (err) {
      toast.error('Error generating timetable');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateProgress = async (taskId, currentCompleted) => {
    if (!timetable) return;
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/update-timetable-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id || 1,
          timetable_id: timetable.timetable_id,
          task_id: taskId,
          completed: !currentCompleted,
          hours_studied: !currentCompleted ? 1.5 : 0.0
        }),
      });

      if (response.ok) {
        setTimetable(prev => {
          if (!prev || !prev.today_schedule) return prev;
          return {
            ...prev,
            today_schedule: prev.today_schedule.map(task => 
              task.task_id === taskId ? { ...task, completed: !currentCompleted } : task
            )
          };
        });
        if (!currentCompleted) {
          toast.success('🎯 Session completed! Streak & XP updated.', { icon: '🔥' });
        }
      }
    } catch (err) {
      console.error('Failed to update progress', err);
    }
  };

  const handleLaunchStudyTool = (tool, subject) => {
    if (tool === 'quiz') navigate('/quiz');
    else if (tool === 'flashcards') navigate('/flashcards');
    else if (tool === 'feynman') navigate('/feynman');
    else navigate('/home');
  };

  // Readiness calculation
  const completedCount = timetable?.today_schedule?.filter(t => t.completed)?.length || 0;
  const totalCount = timetable?.today_schedule?.length || 1;
  const todayProgressPercent = Math.round((completedCount / totalCount) * 100);
  const readinessScore = Math.min(88, 55 + (completedCount * 12));

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[var(--bg-canvas)]">
      {/* 1. Header Navigation Bar */}
      <div className="w-full px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-surface)] flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#89A88D] mb-1">
            <Target className="w-3.5 h-3.5" />
            <span>ADAPTIVE EXAM INTELLIGENCE</span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-main)] font-serif">
            Exam Blueprint & Study Roadmap
          </h1>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl bg-[var(--bg-surface-elevated)] p-1 border border-[var(--border)]">
            <button
              onClick={() => setActiveView('roadmap')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeView === 'roadmap'
                  ? 'bg-[#89A88D] text-black font-semibold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Daily Roadmap</span>
            </button>
            <button
              onClick={() => setActiveView('blueprint')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeView === 'blueprint'
                  ? 'bg-[#89A88D] text-black font-semibold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Exam Blueprint</span>
            </button>
            <button
              onClick={() => setActiveView('create')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeView === 'create'
                  ? 'bg-[#89A88D] text-black font-semibold shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-main)]'
              }`}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Configure Plan</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Body Container (Scrollbar on Right Edge) */}
      <div className="flex-1 w-full overflow-y-auto custom-scroll">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6 pb-20">

          {/* VIEW A: DAILY ADAPTIVE STUDY ROADMAP */}
          {activeView === 'roadmap' && (
            <>
              {/* High-Impact Exam Intelligence Summary Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Metric 1: Days to Exam */}
                <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center gap-3.5 shadow-sm">
                  <div className="p-3 rounded-xl bg-[#89A88D]/15 text-[#89A88D] border border-[#89A88D]/30 shrink-0">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wider block">Target Countdown</span>
                    <h3 className="text-xl font-bold text-[var(--text-main)] font-mono">
                      {timetable?.days_remaining ?? 14} <span className="text-xs font-sans text-[var(--text-secondary)]">Days Left</span>
                    </h3>
                  </div>
                </div>

                {/* Metric 2: Readiness Score */}
                <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center gap-3.5 shadow-sm">
                  <div className="p-3 rounded-xl bg-[#D6A84F]/15 text-[#D6A84F] border border-[#D6A84F]/30 shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wider block">Estimated Readiness</span>
                    <h3 className="text-xl font-bold text-[#D6A84F] font-mono">
                      {readinessScore}% <span className="text-xs font-sans text-[var(--text-secondary)]">Mastered</span>
                    </h3>
                  </div>
                </div>

                {/* Metric 3: Cognitive Peak Window */}
                <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center gap-3.5 shadow-sm">
                  <div className="p-3 rounded-xl bg-[#89A88D]/15 text-[#89A88D] border border-[#89A88D]/30 shrink-0">
                    <BrainCircuit className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)] font-medium uppercase tracking-wider block">Peak Focus Window</span>
                    <h3 className="text-base font-bold text-[var(--text-main)]">
                      09:00 - 12:00 <span className="text-[10px] text-[#89A88D]">AM</span>
                    </h3>
                  </div>
                </div>

                {/* Metric 4: Daily Session Progress */}
                <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] flex items-center gap-3.5 shadow-sm">
                  <div className="p-3 rounded-xl bg-[#62816A]/15 text-[#62816A] border border-[#62816A]/30 shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="w-full min-w-0">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-[var(--text-muted)] font-medium uppercase tracking-wider">Today's Goals</span>
                      <span className="font-bold text-[var(--text-main)]">{todayProgressPercent}%</span>
                    </div>
                    <div className="w-full bg-[var(--bg-surface-elevated)] h-2 rounded-full overflow-hidden border border-[var(--border)]">
                      <div 
                        className="bg-[#89A88D] h-full rounded-full transition-all duration-500" 
                        style={{ width: `${todayProgressPercent}%` }} 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Day Switcher Carousel */}
              <div className="flex items-center gap-2 overflow-x-auto custom-scroll pb-2">
                {[...Array(7)].map((_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() + i);
                  const isSelected = selectedDayOffset === i;
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedDayOffset(i)}
                      className={`flex-none px-4 py-2.5 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'bg-[#89A88D] text-black border-[#89A88D] font-bold shadow-md'
                          : 'bg-[var(--bg-surface)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-main)] hover:border-[#89A88D]/40'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-mono tracking-wider block opacity-80">
                        {i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' })}
                      </span>
                      <span className="text-base font-bold">
                        {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Interactive Daily Task Feed */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[var(--text-main)] font-serif flex items-center gap-2">
                    <span>Scheduled Cognitive Sessions</span>
                    <Badge variant="sage" size="sm">
                      {timetable?.today_schedule?.length || 2} Focus Blocks
                    </Badge>
                  </h2>
                </div>

                {(!timetable?.today_schedule || timetable.today_schedule.length === 0) ? (
                  <div className="p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] text-center space-y-3">
                    <Compass className="w-8 h-8 text-[#89A88D] mx-auto" />
                    <h3 className="text-base font-semibold text-[var(--text-main)] font-serif">No Study Plan Active</h3>
                    <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto">
                      Generate an intelligent roadmap tailored to your target exam and uploaded notes.
                    </p>
                    <Button variant="primary" size="sm" onClick={() => setActiveView('create')}>
                      Configure Study Plan
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {timetable.today_schedule.map((task, idx) => {
                      const isCompleted = task.completed;
                      const isDeepWork = task.type === 'deep_work' || idx % 2 === 0;

                      return (
                        <div
                          key={task.task_id || idx}
                          className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                            isCompleted
                              ? 'bg-[var(--bg-surface)]/60 border-[var(--border)] opacity-60'
                              : 'bg-[var(--bg-surface)] border-[var(--border)] hover:border-[#89A88D]/40 shadow-sm'
                          }`}
                        >
                          {/* Task Checkbox & Metadata */}
                          <div className="flex items-start gap-3.5">
                            <button
                              onClick={() => handleUpdateProgress(task.task_id, isCompleted)}
                              className="mt-0.5 text-[#89A88D] hover:scale-110 transition-transform p-0.5"
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="w-5 h-5 fill-[#89A88D] text-black" />
                              ) : (
                                <Circle className="w-5 h-5 text-[var(--text-muted)] hover:text-[#89A88D]" />
                              )}
                            </button>

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                  isDeepWork 
                                    ? 'bg-[#89A88D]/15 text-[#89A88D] border border-[#89A88D]/30' 
                                    : 'bg-[#D6A84F]/15 text-[#D6A84F] border border-[#D6A84F]/30'
                                }`}>
                                  {isDeepWork ? '🔥 Deep Work Block' : '⚡ Spaced Recall'}
                                </span>
                                <span className="text-[11px] font-mono text-[var(--text-muted)]">
                                  {task.scheduled_time || `${9 + idx * 2}:00 AM`} · {task.estimated_hours || 1.5} Hours
                                </span>
                              </div>
                              <h3 className={`text-base font-bold text-[var(--text-main)] font-serif ${isCompleted ? 'line-through text-[var(--text-muted)]' : ''}`}>
                                {task.description}
                              </h3>
                              <p className="text-xs text-[var(--text-secondary)]">
                                Focus Subject: <strong className="text-[var(--text-main)]">{task.subject}</strong>
                              </p>
                            </div>
                          </div>

                          {/* Connected 1-Click Launchers */}
                          <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleLaunchStudyTool('quiz', task.subject)}
                            >
                              <HelpCircle className="w-3.5 h-3.5" />
                              <span>Practice Quiz</span>
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleLaunchStudyTool('flashcards', task.subject)}
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>Flashcards</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="border border-[var(--border)]"
                              onClick={() => handleLaunchStudyTool('feynman', task.subject)}
                            >
                              <Sparkles className="w-3.5 h-3.5 text-[#D6A84F]" />
                              <span>Feynman</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* VIEW B: EXAM BLUEPRINT & HIGH-YIELD WEIGHTAGE */}
          {activeView === 'blueprint' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                  <div>
                    <h2 className="text-lg font-bold text-[var(--text-main)] font-serif">
                      Curriculum Weightage & Yield Matrix
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Prioritize high-impact exam concepts over low-yield topics.
                    </p>
                  </div>
                  <Badge variant="gold" size="md" icon={Zap}>
                    High-Yield Prioritized
                  </Badge>
                </div>

                <div className="space-y-3">
                  {subjects.map((subj, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            subj.yieldTier === 'High Yield'
                              ? 'bg-[#89A88D]/20 text-[#89A88D] border border-[#89A88D]/30'
                              : 'bg-[#D6A84F]/20 text-[#D6A84F] border border-[#D6A84F]/30'
                          }`}>
                            {subj.yieldTier || 'High Yield'}
                          </span>
                          <span className="text-xs text-[var(--text-muted)] font-mono">Priority #{subj.priority}</span>
                        </div>
                        <h4 className="text-sm font-bold text-[var(--text-main)] font-serif">{subj.name}</h4>
                      </div>

                      <div className="flex items-center gap-6 text-xs">
                        <div>
                          <span className="text-[10px] text-[var(--text-muted)] uppercase block">Allocated Time</span>
                          <span className="font-bold text-[var(--text-main)] font-mono">{subj.hours_needed} Hours</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-[var(--text-muted)] uppercase block">Mastery Status</span>
                          <span className="font-bold text-[#89A88D]">75% Ready</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleLaunchStudyTool('quiz', subj.name)}
                        >
                          <span>Test Subject</span>
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* VIEW C: CONFIGURE / ARCHITECT STUDY PLAN */}
          {activeView === 'create' && (
            <div className="max-w-3xl mx-auto space-y-6">
              <Card className="border-[var(--border)]">
                <CardHeader
                  title="Configure Adaptive Exam Roadmap"
                  subtitle="Specify your exam countdown, daily study capacity, and subject topics"
                  icon={Calendar}
                />
                <CardContent className="space-y-5 pt-2">
                  <form onSubmit={handleCreateTimetable} className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Target Exam Date */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-main)]">Target Exam Date</label>
                        <input
                          type="date"
                          value={examDate}
                          onChange={(e) => setExamDate(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-sm text-[var(--text-main)] outline-none focus:border-[#89A88D]"
                          required
                        />
                      </div>

                      {/* Daily Study Capacity */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-[var(--text-main)]">Daily Study Hours</label>
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={hoursPerDay}
                          onChange={(e) => setHoursPerDay(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-sm text-[var(--text-main)] outline-none focus:border-[#89A88D]"
                          required
                        />
                      </div>
                    </div>

                    {/* Subjects Management */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-[var(--text-main)]">
                          Curriculum Units & Subjects
                        </label>
                        <button
                          type="button"
                          onClick={handleAutoPopulateFromDocs}
                          className="text-xs font-semibold text-[#89A88D] hover:underline flex items-center gap-1"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Import from Document Library</span>
                        </button>
                      </div>

                      <div className="space-y-2">
                        {subjects.map((subj, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={subj.name}
                              placeholder="e.g. Organic Chemistry Reactions"
                              onChange={(e) => {
                                const copy = [...subjects];
                                copy[idx].name = e.target.value;
                                setSubjects(copy);
                              }}
                              className="flex-1 px-3.5 py-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-main)] outline-none focus:border-[#89A88D]"
                            />
                            <select
                              value={subj.yieldTier}
                              onChange={(e) => {
                                const copy = [...subjects];
                                copy[idx].yieldTier = e.target.value;
                                setSubjects(copy);
                              }}
                              className="px-2.5 py-2 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)] text-xs text-[var(--text-main)] outline-none"
                            >
                              <option value="High Yield">High Yield</option>
                              <option value="Medium Yield">Medium Yield</option>
                              <option value="Foundational">Foundational</option>
                            </select>
                            {subjects.length > 1 && (
                              <button
                                type="button"
                                onClick={() => setSubjects(subjects.filter((_, i) => i !== idx))}
                                className="p-2 rounded-xl hover:bg-[#C96B62]/10 text-[var(--text-muted)] hover:text-[#C96B62] transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setSubjects([...subjects, { name: '', priority: subjects.length + 1, hours_needed: 4, yieldTier: 'Medium Yield' }])}
                        className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-main)] flex items-center gap-1.5 pt-1"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#89A88D]" />
                        <span>Add Subject Unit</span>
                      </button>
                    </div>

                    {/* Crash Course Toggle */}
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--bg-surface-elevated)] border border-[var(--border)]">
                      <div>
                        <span className="text-xs font-semibold text-[var(--text-main)] block">
                          Surgical Crash Course Mode
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          Compress schedule into high-intensity active recall blocks for immediate upcoming exams.
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={crashCourse}
                        onChange={(e) => setCrashCourse(e.target.checked)}
                        className="w-4 h-4 rounded text-[#89A88D] focus:ring-0 cursor-pointer"
                      />
                    </div>

                    {/* Submit Button */}
                    <Button
                      variant="primary"
                      size="md"
                      className="w-full"
                      disabled={creating}
                    >
                      {creating ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          <span>Generating AI Schedule & Blueprint...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          <span>Generate Adaptive Blueprint</span>
                        </div>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default StudyPlanPage;
