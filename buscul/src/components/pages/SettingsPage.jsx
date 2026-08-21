import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import './ProgressReport.css'; 
import API_BASE_URL from '../../api/config.js';

const SettingsPage = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (user && user.id) {
        try {
          const response = await fetch(`${API_BASE_URL}/activity/${user.id}`);
          if (response.ok) {
            const data = await response.json();
            setActivities(data);
          }
        } catch (error) {
          console.error("Error fetching activity:", error);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchHistory();
  }, [user]);

  const getActivityIcon = (type) => {
    switch(type) {
      case 'upload': return 'description';
      case 'quiz': return 'task_alt';
      case 'chat': return 'forum';
      case 'summary': return 'summarize';
      default: return 'history';
    }
  };

  const themeOptions = [
    { id: 'dark', name: 'Dark Mode', color: '#72dcff', bg: '#0b0f1a' },
    { id: 'light', name: 'Light Mode', color: '#0ea5e9', bg: '#ffffff' }
  ];

  return (
    <div className="p-8 min-h-screen max-w-4xl mx-auto">
      <div className="max-w-4xl mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-black tracking-tight text-[var(--text-main)] font-headline mb-2">Settings</h1>
          <p className="text-[var(--text-main)]/60">Manage your Shiro.ai account and view recent activity</p>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Profile Section */}
          <div className="md:col-span-1 space-y-6">
            <div className="glass-card p-6 rounded-3xl border border-[var(--primary)]/10">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[var(--primary)] to-[var(--secondary)] p-1 mb-4">
                  <div className="w-full h-full rounded-full bg-[var(--bg-main)] flex items-center justify-center overflow-hidden">
                     <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${user?.email}`} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-[var(--text-main)]">{user?.name}</h3>
                <p className="text-sm text-[var(--text-main)]/40 mb-6">{user?.email}</p>
                
                <button 
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-error/30 text-error hover:bg-error/5 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                  Logout
                </button>
              </div>
            </div>

            <div className="glass-card p-6 rounded-3xl border border-[var(--primary)]/10">
              <h4 className="text-sm font-bold uppercase tracking-widest text-[var(--text-main)]/40 mb-6">Theme Hub</h4>
              <div className="grid grid-cols-2 gap-3">
                {themeOptions.map((opt) => (
                  <div 
                    key={opt.id}
                    onClick={() => setTheme(opt.id)}
                    className={`cursor-pointer group relative p-3 rounded-2xl border transition-all ${theme === opt.id ? 'border-[var(--primary)] bg-[var(--primary)]/10 scale-105' : 'border-white/5 bg-white/5 hover:border-white/20'}`}
                  >
                    <div className="w-full h-12 rounded-lg mb-2 flex items-center justify-center overflow-hidden border border-white/5" style={{ backgroundColor: opt.bg }}>
                       <div className="w-4 h-4 rounded-full" style={{ backgroundColor: opt.color }}></div>
                    </div>
                    <p className={`text-[10px] text-center font-bold uppercase tracking-tight ${theme === opt.id ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'}`}>
                      {opt.name}
                    </p>
                    {theme === opt.id && (
                      <div className="absolute top-1 right-1">
                        <span className="material-symbols-outlined text-[var(--primary)] text-sm">check_circle</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Activity Section */}
          <div className="md:col-span-2">
            <div className="glass-card p-8 rounded-3xl border border-[var(--primary)]/10 min-h-[500px]">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[var(--primary)]">history</span>
                  Activity History
                </h2>
                {activities.length > 0 && (
                   <span className="px-3 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[10px] font-bold uppercase tracking-wider">
                     {activities.length} Events
                   </span>
                )}
              </div>
              
              {loading ? (
                <div className="flex flex-col gap-4">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-20 w-full bg-[var(--border)]/5 animate-pulse rounded-2xl"></div>
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center opacity-40">
                  <span className="material-symbols-outlined text-5xl mb-2">history_toggle_off</span>
                  <p>No recent activity found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activities.map((item, index) => (
                    <div key={index} className="group flex items-center gap-4 p-4 rounded-2xl bg-[var(--border)]/5 border border-transparent hover:border-[var(--primary)]/20 transition-all">
                      <div className="w-12 h-12 rounded-xl bg-[var(--bg-main)] flex items-center justify-center text-[var(--primary)] group-hover:scale-110 transition-transform border border-white/5">
                        <span className="material-symbols-outlined">{getActivityIcon(item.type)}</span>
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="text-sm font-bold text-[var(--text-main)] truncate">{item.title}</p>
                        <p className="text-xs text-[var(--text-main)]/40 truncate">{item.details}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] font-bold text-[var(--text-main)]/30 uppercase">
                          {new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </p>
                        <p className="text-[10px] text-[var(--text-main)]/20">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default SettingsPage;
