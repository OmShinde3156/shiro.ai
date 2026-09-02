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
    <nav 
      aria-label="Mobile Navigation"
      className="md:hidden flex justify-around items-center h-[calc(3.85rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] px-2 w-full bg-[var(--sidebar-bg)] border-t border-[var(--border)] backdrop-blur-xl fixed bottom-0 left-0 right-0 z-50 shadow-lg select-none"
    >
      {navItems.map((item) => {
        const active = isActive(item.path);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center justify-center flex-1 py-1.5 px-1 rounded-xl touch-target transition-all duration-150 relative active:scale-95 ${
              active
                ? 'text-[#3F6048] dark:text-[#A8C5AC] font-bold'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <span className={`material-symbols-outlined text-[22px] transition-transform ${active ? 'fill scale-105' : ''}`}>
              {item.icon}
            </span>
            <span className="text-[10px] tracking-tight font-medium mt-0.5">{item.label}</span>
            {active && (
              <span className="absolute bottom-1 w-1.5 h-1.5 bg-[#3F6048] dark:bg-[#89A88D] rounded-full"></span>
            )}
          </button>
        );
      })}
    </nav>
  );
};

export default BottomNavBar;
