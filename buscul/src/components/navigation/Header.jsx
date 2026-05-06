import React, { useContext, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Context } from "../../context/Context";
import { useAuth } from "../../context/AuthContext";
import API_BASE_URL from "../../api/config.js";
import toast from 'react-hot-toast';

const Header = () => {
  const { language, setLanguage } = useContext(Context);
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [userStats, setUserStats] = useState({ avgScore: 0, streak: 0, tasksDone: 0, totalTasks: 0 });
  const menuRef = useRef(null);
  const fileInputRef = useRef(null);

  const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/bottts/svg?seed=${seed || "Guest"}&backgroundColor=0b0e14,72dcff,dd8bfb`;

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    try {
      const response = await fetch(`${API_BASE_URL}/upload-avatar/${user.id}`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.avatar_url) {
        updateUser({ avatar_url: data.avatar_url });
        toast.success("Profile picture updated!");
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
      toast.error("Failed to upload profile picture.");
    }
  };

  const fetchUserQuickStats = async () => {
    try {
      const [progressRes, timetableRes] = await Promise.all([
        fetch(`${API_BASE_URL}/progress/${user.id}`),
        fetch(`${API_BASE_URL}/timetable/${user.id}`)
      ]);
      const progressData = await progressRes.json();
      const timetableData = await timetableRes.json();
      
      const stats = {
        avgScore: progressData.average_score || 0,
        streak: progressData.study_streak || 0,
        tasksDone: timetableData.today_schedule?.filter(t => t.completed).length || 0,
        totalTasks: timetableData.today_schedule?.length || 0
      };
      setUserStats(stats);
      updateUser(stats); // Update global user object
    } catch (err) {
      console.error("Error fetching quick stats:", err);
    }
  };

  useEffect(() => {
    if (user?.id && showProfileMenu) {
      fetchUserQuickStats();
    }
  }, [user, showProfileMenu]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="w-full sticky top-0 z-40 bg-[var(--sidebar-bg)] opacity-80 backdrop-blur-xl flex justify-between items-center px-8 py-4 border-b border-[var(--border)]">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/home")}>
        <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10">
          <img src="/logo.jpg" alt="Logo" className="w-full h-full object-cover" />
        </div>
        <span className="text-2xl font-black text-[var(--primary)] font-headline">Shiro.ai</span>
      </div>
      <div className="flex items-center gap-6">
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="bg-transparent border-none text-[var(--text-main)] opacity-70 hover:opacity-100 cursor-pointer text-sm font-semibold outline-none">
          <option value="en" className="bg-[var(--sidebar-bg)]">English</option>
          <option value="hi" className="bg-[var(--sidebar-bg)]">Hindi</option>
        </select>
        <div className="relative" ref={menuRef}>
          <div 
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-10 h-10 rounded-full border border-primary/20 overflow-hidden cursor-pointer group relative shadow-[0_0_15px_rgba(114,220,255,0.2)] hover:border-primary/60 transition-all"
          >
             <img src={user?.avatar_url || getAvatarUrl(user?.name)} alt="User" className="w-full h-full object-cover" />
          </div>

          {showProfileMenu && (
            <div className="absolute top-12 right-0 w-80 glass-card rounded-3xl border border-white/10 shadow-[0_32px_64px_rgba(0,0,0,0.5)] z-[60] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="p-6 border-b border-white/5 bg-primary/5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative group/avatar">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-secondary p-0.5">
                      <div className="w-full h-full rounded-full bg-[#0b0e14] overflow-hidden">
                        <img src={user?.avatar_url || getAvatarUrl(user?.name)} alt="Avatar" className="w-full h-full object-cover" />
                      </div>
                    </div>
                    <button 
                      onClick={() => fileInputRef.current.click()}
                      className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                    >
                      <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                    </button>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-[var(--text-main)] truncate">{user?.name || "Learner"}</h4>
                    <p className="text-[10px] uppercase font-black text-primary tracking-widest">Level {user?.level || 1} Scholar</p>
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">
                    <span>Experience</span>
                    <span className="text-secondary">{user?.xp || 0} XP</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-1000" 
                      style={{ width: `${Math.min(100, ((user?.xp || 0) % 100) / 100 * 100)}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                    <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase block mb-1">Accuracy</span>
                    <span className="text-sm font-black text-secondary">{userStats?.avgScore || 0}%</span>
                  </div>
                  <div className="bg-white/5 rounded-2xl p-3 border border-white/5">
                    <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase block mb-1">Streak</span>
                    <span className="text-sm font-black text-orange-400">{userStats?.streak || 0} Days</span>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                    <span>Daily Goal</span>
                    <span className="text-primary">{userStats?.tasksDone || 0}/{userStats?.totalTasks || 0}</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-1000" 
                      style={{ width: `${userStats?.totalTasks ? (userStats.tasksDone / userStats.totalTasks) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => { navigate("/progress-report"); setShowProfileMenu(false); }}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-[var(--text-main)] flex items-center justify-center gap-3 border border-white/5 transition-all group"
                  >
                    <span className="material-symbols-outlined text-sm text-primary group-hover:rotate-12 transition-transform">leaderboard</span>
                    Full Analytics
                  </button>
                  <button 
                    onClick={() => { navigate("/settings"); setShowProfileMenu(false); }}
                    className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-[var(--text-main)] flex items-center justify-center gap-3 border border-white/5 transition-all group"
                  >
                    <span className="material-symbols-outlined text-sm text-[var(--text-muted)] group-hover:rotate-45 transition-transform">settings</span>
                    Account Settings
                  </button>
                  <button 
                    onClick={() => { 
                      logout(); 
                      setShowProfileMenu(false); 
                      navigate("/"); 
                    }}
                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 rounded-xl text-xs font-bold text-red-400 flex items-center justify-center gap-3 border border-red-500/10 transition-all group"
                  >
                    <span className="material-symbols-outlined text-sm text-red-400 group-hover:translate-x-1 transition-transform">logout</span>
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleAvatarUpload} 
            className="hidden" 
            accept="image/*"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
