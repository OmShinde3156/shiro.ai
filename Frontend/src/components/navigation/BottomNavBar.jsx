import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const BottomNavBar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { icon: 'home', label: 'Home', path: '/home' },
    { icon: 'description', label: 'Library', path: '/documents' },
    { icon: 'school', label: 'Study', path: '/study-rooms' },
    { icon: 'leaderboard', label: 'Stats', path: '/progress-report' },
    { icon: 'person', label: 'Profile', path: '/settings' },
  ];

  return (
    <nav className="md:hidden flex justify-around items-center h-16 px-4 w-full bg-[var(--sidebar-bg)] border-t border-[var(--border)] backdrop-blur-xl fixed bottom-0 left-0 right-0 z-50 shadow-lg">
      {navItems.map((item) => {
        const active = isActive(item.path);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`flex flex-col items-center justify-center transition-all duration-200 relative p-2 rounded-xl ${
              active
                ? 'text-[#3F6048] dark:text-[#A8C5AC] font-bold scale-105'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <span className={`material-symbols-outlined text-xl ${active ? 'fill' : ''}`}>
              {item.icon}
            </span>
            <span className="text-[10px] mt-0.5">{item.label}</span>
            {active && (
              <span className="absolute -bottom-0.5 w-1.5 h-1.5 bg-[#3F6048] dark:bg-[#89A88D] rounded-full"></span>
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNavBar;
