import React from 'react';

export const Card = ({
  children,
  className = '',
  onClick,
  hover = true,
  ...props
}) => {
  return (
    <div
      onClick={onClick}
      className={`glass-panel p-5 relative overflow-hidden transition-all duration-200 ${
        hover ? 'hover:-translate-y-0.5 hover:border-[#89A88D]/40' : ''
      } ${onClick ? 'cursor-pointer' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({ title, subtitle, icon: Icon, action, className = '' }) => (
  <div className={`flex items-start justify-between gap-3 mb-3 ${className}`}>
    <div className="flex items-center gap-2.5">
      {Icon && (
        <div className="p-2 rounded-xl bg-[#E8EFE9] dark:bg-[#89A88D]/15 border border-[#3F6048]/15 dark:border-[#89A88D]/30 text-[#3F6048] dark:text-[#89A88D]">
          <Icon className="w-4 h-4" />
        </div>
      )}
      <div>
        {title && <h3 className="font-bold text-[var(--text-main)] text-sm md:text-base leading-tight font-serif">{title}</h3>}
        {subtitle && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {action && <div>{action}</div>}
  </div>
);

export const CardContent = ({ children, className = '' }) => (
  <div className={`text-[var(--text-secondary)] text-sm ${className}`}>
    {children}
  </div>
);

export const CardFooter = ({ children, className = '' }) => (
  <div className={`pt-3 border-t border-[var(--border)] mt-4 flex items-center justify-between text-xs text-[var(--text-muted)] ${className}`}>
    {children}
  </div>
);

export default Card;
