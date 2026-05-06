import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const BottomNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { icon: 'home', label: 'Home', path: '/home' },
    { icon: 'description', label: 'Library', path: '/documents' },
    { icon: 'school', label: 'Study', path: '/study-room' },
    { icon: 'leaderboard', label: 'Stats', path: '/progress-report' },
    { icon: 'person', label: 'Profile', path: '/settings' },
  ];

  return (
    <nav className="md:hidden flex justify-around items-center h-20 px-4 w-full bg-slate-950/90 backdrop-blur-2xl fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)] border-t border-cyan-400/10">
      {navItems.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className={`flex flex-col items-center justify-center transition-all duration-300 relative ${
            isActive(item.path) ? 'text-cyan-400 scale-110' : 'text-slate-500'
          }`}
        >
          <span className={`material-symbols-outlined ${isActive(item.path) ? 'fill' : ''}`}>
            {item.icon}
          </span>
          {isActive(item.path) && (
            <span className="absolute -bottom-1 w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_8px_#72dcff]"></span>
          )}
        </button>
      ))}
    </nav>
  );
};

export default BottomNavBar;
