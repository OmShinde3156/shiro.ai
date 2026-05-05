import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import API_BASE_URL from '../../api/config.js';
import './StudyPlanPage.css';

const StudyPlanPage = () => {
  const { user } = useAuth();
  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  // Form states
  const [examDate, setExamDate] = useState('');
  const [hoursPerDay, setHoursPerDay] = useState(4);
  const [crashCourse, setCrashCourse] = useState(false);
  const [subjects, setSubjects] = useState([{ name: '', priority: 1, hours_needed: 10 }]);

  useEffect(() => {
    fetchTimetable();
  }, [user]);

  const fetchTimetable = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/timetable/${user.id}`);
      const data = await response.json();
      if (response.ok && !data.message) setTimetable(data);
      else setTimetable(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTimetable = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/create-timetable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          exam_date: new Date(examDate).toISOString(),
          study_hours_per_day: hoursPerDay,
          subjects: subjects.filter(s => s.name.trim()),
          crash_course: crashCourse
        }),
      });
      if (response.ok) await fetchTimetable();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateProgress = async (taskId, currentCompleted) => {
    try {
      const response = await fetch(`${API_BASE_URL}/update-timetable-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          timetable_id: timetable.timetable_id,
          task_id: taskId,
          completed: !currentCompleted
        }),
      });
      if (response.ok) {
        setTimetable(prev => ({
          ...prev,
          today_schedule: prev.today_schedule.map(task => 
            task.task_id === taskId ? { ...task, completed: !currentCompleted } : task
          )
        }));
      }
    } catch (err) {}
  };

  if (loading) return <div className="p-20 text-center animate-pulse text-primary">Syncing with AI Scheduler...</div>;

  return (
    <div className="study-plan-container px-6 md:px-12 py-10 max-w-5xl mx-auto">
      {!timetable ? (
        <div className="max-w-2xl mx-auto">
          <header className="mb-10 text-center relative">
             <button onClick={() => navigate("/")} className="absolute left-0 top-0 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-all text-[var(--text-muted)] hover:text-primary">
               <span className="material-symbols-outlined">arrow_back</span>
             </button>
             <h1 className="text-4xl font-black font-headline text-white mb-2">Master Plan</h1>
             <p className="text-[var(--text-muted)]">Configure your AI-powered cognitive pathway.</p>
          </header>
          
          <div className="glass-panel-study p-8 rounded-[2rem]">
            <form onSubmit={handleCreateTimetable} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-primary mb-2 block">Target Exam</label>
                  <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-primary/50" required />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold tracking-widest text-primary mb-2 block">Study Hours/Day</label>
                  <input type="number" value={hoursPerDay} onChange={e => setHoursPerDay(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-primary/50" required />
                </div>
              </div>

              <div className="subjects-list space-y-3">
                <label className="text-[10px] uppercase font-bold tracking-widest text-[var(--text-muted)] mb-2 block">Subjects to Master</label>
                {subjects.map((s, i) => (
                  <div key={i} className="flex gap-2">
                    <input 
                      placeholder="e.g. Quantum Physics" 
                      value={s.name} 
                      onChange={e => {
                        const newS = [...subjects];
                        newS[i].name = e.target.value;
                        setSubjects(newS);
                      }}
                      className="flex-grow bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white" 
                    />
                    {i === subjects.length - 1 && <button type="button" onClick={() => setSubjects([...subjects, {name: '', priority: 1}])} className="p-3 bg-primary/10 text-primary rounded-xl"><span className="material-symbols-outlined">add</span></button>}
                  </div>
                ))}
              </div>

              <button type="submit" className="w-full py-4 bg-gradient-to-r from-primary to-[#006d84] text-white font-bold rounded-2xl hover:shadow-[0_0_20px_rgba(114,220,255,0.3)] transition-all">
                {creating ? 'Architecting Your Plan...' : 'Generate Cognitive Path'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="space-y-12">
          {/* Header */}
          <header className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-extrabold font-headline text-white mb-2">Master Plan</h1>
              <p className="text-[var(--text-muted)]">Your optimized cognitive pathway for today.</p>
            </div>
            <button onClick={() => navigate("/")} className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white/40 hover:text-primary hover:border-primary/40 transition-all flex items-center gap-2">
               <span className="material-symbols-outlined text-sm">arrow_back</span>
               Back to Dashboard
            </button>
          </header>

          {/* Date Picker (Horizontal) */}
          <section className="relative">
            <div className="flex gap-4 overflow-x-auto no-scrollbar py-4 -mx-4 px-4">
              {[...Array(7)].map((_, i) => {
                const date = new Date();
                date.setDate(date.getDate() + (i - 1));
                const isActive = i === 1;
                return (
                  <button key={i} className={`flex-none flex flex-col items-center justify-center ${isActive ? 'w-20 h-24 -mt-2 bg-primary/10 text-primary border-primary/20 shadow-lg shadow-primary/5' : 'w-16 h-20 bg-white/5 text-[var(--text-muted)]'} rounded-2xl border border-white/5 transition-all`}>
                    <span className="text-[10px] uppercase font-bold mb-1">{date.toLocaleDateString('en-US', { weekday: 'short' })}</span>
                    <span className={`text-xl font-black ${isActive ? 'text-2xl' : ''}`}>{date.getDate()}</span>
                    {isActive && <div className="mt-1 w-1 h-1 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]"></div>}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Timeline Section */}
          <section className="relative">
            <div className="timeline-ghost-line"></div>
            <div className="space-y-8 relative z-10">
              {timetable.today_schedule.map((task, idx) => (
                <div key={task.task_id} className="timeline-item flex flex-col sm:flex-row gap-4 sm:gap-8 group">
                  <div className="sm:w-24 flex-none pt-2 sm:text-right flex items-center sm:block gap-3">
                    <div className={`timeline-dot ${idx === 0 && !task.completed ? 'active' : ''}`}></div>
                    <span className={`font-headline text-sm font-bold tracking-tight ${idx === 0 && !task.completed ? 'text-primary' : 'text-[var(--text-muted)]'}`}>
                      {0 + (idx * 2)}:00
                    </span>
                    <span className="text-[10px] uppercase font-bold opacity-40 sm:block sm:mt-1">AM</span>
                  </div>

                  <div 
                    onClick={() => handleUpdateProgress(task.task_id, task.completed)}
                    className={`flex-1 glass-panel-study rounded-3xl p-6 sm:p-8 cursor-pointer ${task.completed ? 'opacity-50 grayscale' : 'ring-1 ring-primary/20 shadow-xl'}`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex gap-2">
                        <span className="px-3 py-1 bg-primary/10 rounded-full text-[10px] font-bold uppercase tracking-widest text-primary border border-primary/20">
                          {idx % 2 === 0 ? 'Deep Work' : 'Quick Review'}
                        </span>
                        <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                          {task.estimated_hours * 60} Min
                        </span>
                      </div>
                      <span className={`material-symbols-outlined text-xl ${task.completed ? 'text-primary' : 'text-white/20'}`}>
                        {task.completed ? 'check_circle' : 'more_horiz'}
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2 group-hover:text-primary transition-colors">{task.description}</h3>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-6">Subject focus: <span className="text-white font-bold">{task.subject}</span>. Aim to synthesize core concepts and solve active problems.</p>
                    
                    {!task.completed && idx === 0 && (
                      <div className="mt-4 pt-4 border-t border-white/5">
                        <div className="flex justify-between text-[10px] font-bold text-primary uppercase mb-2">
                          <span>Focus Level</span>
                          <span>High</span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full bg-primary w-[65%] rounded-full shadow-[0_0_10px_var(--primary)] animate-pulse"></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="flex justify-center pt-10">
             <button onClick={() => setTimetable(null)} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-error/60 hover:text-error transition-all">
               <span className="material-symbols-outlined text-sm">restart_alt</span>
               Reset Current Path
             </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyPlanPage;
