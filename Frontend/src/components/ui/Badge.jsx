import React from 'react';

export const Badge = ({
  children,
  variant = 'sage', // 'sage' | 'forest' | 'gold' | 'stone' | 'rose' | 'neutral'
  size = 'sm', // 'sm' | 'md'
  icon: Icon,
  className = '',
  onClick,
  ...props
}) => {
  const variantStyles = {
    // Brand & Academic
    primary: 'bg-[#EBF3EC] text-[#2D5A3C] border-[#C2DEC8] dark:bg-[#89A88D]/20 dark:text-[#A8C5AC] dark:border-[#89A88D]/35 font-semibold',
    indigo: 'bg-[#E8EDF5] text-[#0F172A] border-[#CBD5E1] dark:bg-[#818CF8]/15 dark:text-[#A5B4FC] dark:border-[#818CF8]/30 font-semibold',

    // Status: Mastered (Green)
    mastered: 'bg-[#EAF5EC] text-[#14532D] border-[#86EFAC] dark:bg-[#4ADE80]/15 dark:text-[#86EFAC] dark:border-[#4ADE80]/30 font-semibold',
    success: 'bg-[#EAF5EC] text-[#14532D] border-[#86EFAC] dark:bg-[#4ADE80]/15 dark:text-[#86EFAC] dark:border-[#4ADE80]/30 font-semibold',
    sage: 'bg-[#EBF3EC] text-[#2D5A3C] border-[#C2DEC8] dark:bg-[#89A88D]/20 dark:text-[#A8C5AC] dark:border-[#89A88D]/35 font-semibold',
    forest: 'bg-[#EAF5EC] text-[#14532D] border-[#86EFAC] dark:bg-[#4ADE80]/15 dark:text-[#86EFAC] dark:border-[#4ADE80]/30 font-semibold',
    emerald: 'bg-[#EAF5EC] text-[#14532D] border-[#86EFAC] dark:bg-[#4ADE80]/15 dark:text-[#86EFAC] dark:border-[#4ADE80]/30 font-semibold',

    // Status: Developing (Amber)
    developing: 'bg-[#FEF6E6] text-[#78350F] border-[#FDE68A] dark:bg-[#FBBF24]/15 dark:text-[#FDE68A] dark:border-[#FBBF24]/30 font-semibold',
    warning: 'bg-[#FEF6E6] text-[#78350F] border-[#FDE68A] dark:bg-[#FBBF24]/15 dark:text-[#FDE68A] dark:border-[#FBBF24]/30 font-semibold',
    gold: 'bg-[#FEF6E6] text-[#78350F] border-[#FDE68A] dark:bg-[#FBBF24]/15 dark:text-[#FDE68A] dark:border-[#FBBF24]/30 font-semibold',
    amber: 'bg-[#FEF6E6] text-[#78350F] border-[#FDE68A] dark:bg-[#FBBF24]/15 dark:text-[#FDE68A] dark:border-[#FBBF24]/30 font-semibold',

    // Status: Needs Review (Orange)
    review: 'bg-[#FFF1EB] text-[#7C2D12] border-[#FED7AA] dark:bg-[#FB923C]/15 dark:text-[#FED7AA] dark:border-[#FB923C]/30 font-semibold',
    orange: 'bg-[#FFF1EB] text-[#7C2D12] border-[#FED7AA] dark:bg-[#FB923C]/15 dark:text-[#FED7AA] dark:border-[#FB923C]/30 font-semibold',

    // Status: Weak / Danger (Red)
    weak: 'bg-[#FDF0ED] text-[#7F1D1D] border-[#FECACA] dark:bg-[#F87171]/15 dark:text-[#FCA5A5] dark:border-[#F87171]/30 font-semibold',
    danger: 'bg-[#FDF0ED] text-[#7F1D1D] border-[#FECACA] dark:bg-[#F87171]/15 dark:text-[#FCA5A5] dark:border-[#F87171]/30 font-semibold',
    rose: 'bg-[#FDF0ED] text-[#7F1D1D] border-[#FECACA] dark:bg-[#F87171]/15 dark:text-[#FCA5A5] dark:border-[#F87171]/30 font-semibold',

    // AI & Shiro (Calming Celadon & Editorial Sage)
    ai: 'bg-[#EBF3EC] text-[#2D5A3C] border-[#C2DEC8] dark:bg-[#A8C5AC]/20 dark:text-[#A8C5AC] dark:border-[#A8C5AC]/35 font-semibold',
    purple: 'bg-[#F5F3FF] text-[#4C1D95] border-[#DDD6FE] dark:bg-[#A78BFA]/15 dark:text-[#C4B5FD] dark:border-[#A78BFA]/30 font-semibold',

    // XP & Achievements (Gold)
    xp: 'bg-[#FEF9C3] text-[#713F12] border-[#FDE047] dark:bg-[#FACC15]/15 dark:text-[#FDE047] dark:border-[#FACC15]/30 font-semibold',

    // Neutral & Info
    info: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD] dark:bg-[#38BDF8]/15 dark:text-[#7DD3FC] dark:border-[#38BDF8]/30 font-semibold',
    cyan: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD] dark:bg-[#38BDF8]/15 dark:text-[#7DD3FC] dark:border-[#38BDF8]/30 font-semibold',
    stone: 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border-[var(--border)] font-medium',
    neutral: 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border-[var(--border)] font-medium',
    slate: 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border-[var(--border)] font-medium',
  };

  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center font-medium border rounded-full ${variantStyles[variant] || variantStyles.sage} ${sizeStyles[size]} ${
        onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
      } ${className}`}
      {...props}
    >
      {Icon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      {children}
    </span>
  );
};

export default Badge;
