import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend
} from "recharts";
import { useAuth } from "../../context/AuthContext";
import API_BASE_URL from "../../api/config.js";
import "./progressreport.css";

const ProgressReport = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [progress, setProgress] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (user && user.id) {
      fetchAnalytics();
    }
  }, [user]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [progressRes, dashboardRes, activityRes] = await Promise.all([
        fetch(`${API_BASE_URL}/progress/${user.id}`),
        fetch(`${API_BASE_URL}/dashboard/${user.id}`),
        fetch(`${API_BASE_URL}/activity/${user.id}`)
      ]);

      const progressData = await progressRes.json();
      const dashboardData = await dashboardRes.json();
      const activityData = await activityRes.json();

      setProgress(progressData);
      setDashboard(dashboardData);
      setActivity(activityData);
    } catch (err) {
      console.error("Error fetching analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="progress-container loading">
        <div className="spinner"></div>
        <p>Analyzing your academic growth...</p>
      </div>
    );
  }

  // Format weekly activity for BarChart
  const weeklyData = progress?.weekly_activity ? 
    Object.entries(progress.weekly_activity).map(([day, count]) => ({ day: day.substring(0, 3), count })) : [];

  // Format heatmap for RadarChart (Subject Mastery)
  const heatmapData = progress?.knowledge_heatmap ?
    Object.entries(progress.knowledge_heatmap).map(([subject, score]) => ({
      subject,
      score: Math.round(score * 100),
      fullMark: 100
    })) : [];

  // Format recent scores for LineChart
  const recentScoresData = dashboard?.recent_quiz_scores ?
    dashboard.recent_quiz_scores.map((score, index) => ({ attempt: index + 1, score })) : [];

  return (
    <div className="progress-container advanced-dashboard">
      <header className="dashboard-header">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate("/")} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all text-[var(--text-muted)] hover:text-primary">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="text-3xl font-bold font-headline text-[var(--text-main)]">Learning Analytics</h1>
            <p className="text-[var(--text-muted)]">Real-time insights into your knowledge retention and study habits.</p>
          </div>
        </div>
        <div className="streak-badge glass-card">
          <span className="material-symbols-outlined text-orange-400">local_fire_department</span>
          <div className="streak-info">
            <span className="count">{progress?.study_streak || 0}</span>
            <span className="label">Day Streak</span>
          </div>
        </div>
      </header>

      {/* Stats Grid */}
      <section className="stats-grid mb-10">
        <div className="stat-card glass-card border-primary/20 bg-primary/5">
          <div className="icon-box bg-primary/20 text-primary">
            <span className="material-symbols-outlined">quiz</span>
          </div>
          <div className="stat-content">
            <span className="value">{progress?.quizzes_taken || 0}</span>
            <span className="label">Quizzes Taken</span>
          </div>
        </div>
        <div className="stat-card glass-card border-secondary/20 bg-secondary/5">
          <div className="icon-box bg-secondary/20 text-secondary">
            <span className="material-symbols-outlined">stars</span>
          </div>
          <div className="stat-content">
            <span className="value">{progress?.average_score || 0}%</span>
            <span className="label">Avg. Accuracy</span>
          </div>
        </div>
        <div className="stat-card glass-card border-tertiary/20 bg-tertiary/5">
          <div className="icon-box bg-tertiary/20 text-tertiary">
            <span className="material-symbols-outlined">style</span>
          </div>
          <div className="stat-content">
            <span className="value">{progress?.flashcards_studied || 0}</span>
            <span className="label">Cards Mastered</span>
          </div>
        </div>
        <div className="stat-card glass-card border-white/10 bg-white/5">
          <div className="icon-box bg-white/10 text-[var(--text-muted)]">
            <span className="material-symbols-outlined">schedule</span>
          </div>
          <div className="stat-content">
            <span className="value">{dashboard?.total_study_time || 0}m</span>
            <span className="label">Total Study Time</span>
          </div>
        </div>
      </section>

      <div className="dashboard-grid">
        {/* Main Charts Area */}
        <div className="main-charts space-y-8">
          
          <div className="chart-wrapper glass-card p-6 rounded-3xl border border-white/5">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">trending_up</span>
                Score Progression
              </h3>
              <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)]">Last 10 Attempts</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={recentScoresData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                  <XAxis dataKey="attempt" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '12px' }}
                    itemStyle={{ color: '#72dcff' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="score" 
                    stroke="#72dcff" 
                    strokeWidth={4} 
                    dot={{ r: 6, fill: '#72dcff', strokeWidth: 2, stroke: '#000' }}
                    activeDot={{ r: 8, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="chart-wrapper glass-card p-6 rounded-3xl border border-white/5">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)] mb-6">Subject Mastery</h3>
                <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="80%" data={heatmapData}>
                        <PolarGrid stroke="#ffffff10" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#ffffff60', fontSize: 10 }} />
                        <Radar name="Mastery" dataKey="score" stroke="#dd8bfb" fill="#dd8bfb" fillOpacity={0.4} />
                        <Tooltip />
                      </RadarChart>
                   </ResponsiveContainer>
                </div>
             </div>

             <div className="chart-wrapper glass-card p-6 rounded-3xl border border-white/5">
                <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)] mb-6">Weekly Consistency</h3>
                <div className="h-64">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyData}>
                        <XAxis dataKey="day" stroke="#ffffff40" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip cursor={{fill: '#ffffff05'}} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {weeklyData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === weeklyData.length - 1 ? '#72dcff' : '#ffffff20'} />
                          ))}
                        </Bar>
                      </BarChart>
                   </ResponsiveContainer>
                </div>
             </div>
          </div>
        </div>

        {/* Sidebar: Recommendations & Activity */}
        <aside className="dashboard-sidebar space-y-8">
           <div className="glass-card p-6 rounded-3xl border border-secondary/20 bg-secondary/5">
              <h3 className="text-sm font-bold uppercase tracking-widest text-secondary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">auto_awesome</span> AI Insights
              </h3>
              <div className="space-y-4">
                {dashboard?.recommendations?.map((rec, i) => (
                  <div key={i} className="flex gap-3 items-start p-3 bg-white/5 rounded-xl border border-white/5">
                    <span className="material-symbols-outlined text-secondary text-[18px]">tips_and_updates</span>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
           </div>

           <div className="glass-card p-6 rounded-3xl border border-white/5">
              <h3 className="text-sm font-bold uppercase tracking-widest text-[var(--text-muted)] mb-4">Recent Activity</h3>
              <div className="activity-timeline space-y-6">
                {activity.slice(0, 5).map((act, i) => (
                  <div key={i} className="activity-item flex gap-4 relative">
                    {i !== 4 && <div className="absolute left-[11px] top-6 w-[1px] h-10 bg-white/10"></div>}
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                      act.type === 'upload' ? 'bg-primary/20 text-primary' : 
                      act.type === 'quiz' ? 'bg-secondary/20 text-secondary' : 'bg-tertiary/20 text-tertiary'
                    }`}>
                      <span className="material-symbols-outlined text-[14px]">
                        {act.type === 'upload' ? 'description' : act.type === 'quiz' ? 'task_alt' : 'chat'}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[var(--text-main)]">{act.title}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-1">{new Date(act.timestamp).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-6 py-2 text-[10px] font-bold uppercase tracking-widest text-primary/60 hover:text-primary transition-all">View Full History</button>
           </div>
        </aside>
      </div>
    </div>
  );
};

export default ProgressReport;
