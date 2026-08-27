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
    sage: 'bg-[#E8EFE9] text-[#3F6048] border-[#3F6048]/20 dark:bg-[#89A88D]/15 dark:text-[#A8C5AC] dark:border-[#89A88D]/30 font-semibold',
    forest: 'bg-[#3F6048]/15 text-[#2D4534] dark:text-[#88A690] border-[#3F6048]/30 dark:border-[#62816A]/30 font-semibold',
    gold: 'bg-[#F4E9CC] text-[#7B5E20] border-[#E9D8AE] dark:bg-[#D6A84F]/15 dark:text-[#E8C278] dark:border-[#D6A84F]/30 font-semibold',
    amber: 'bg-[#F4E9CC] text-[#7B5E20] border-[#E9D8AE] dark:bg-[#D6A84F]/15 dark:text-[#E8C278] dark:border-[#D6A84F]/30 font-semibold',
    stone: 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border-[var(--border)] font-medium',
    neutral: 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border-[var(--border)] font-medium',
    slate: 'bg-[var(--bg-surface-elevated)] text-[var(--text-main)] border-[var(--border)] font-medium',
    rose: 'bg-[#F7E8E5] text-[#9E352B] border-[#C96B62]/30 dark:bg-[#C96B62]/15 dark:text-[#E58B82] font-semibold',
    info: 'bg-[#E8EEF4] text-[#3B5875] border-[#5E7C9A]/30 dark:bg-[#5E7C9A]/15 dark:text-[#8BAECF] font-semibold',
    // Aliases for backward compatibility
    cyan: 'bg-[#E8EFE9] text-[#3F6048] dark:text-[#A8C5AC] border-[#3F6048]/20 dark:border-[#89A88D]/30 font-semibold',
    purple: 'bg-[#3F6048]/15 text-[#2D4534] dark:text-[#88A690] border-[#3F6048]/30 dark:border-[#62816A]/30 font-semibold',
    emerald: 'bg-[#E8EFE9] text-[#3F6048] dark:text-[#A8C5AC] border-[#3F6048]/20 dark:border-[#89A88D]/30 font-semibold',
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
