import React from 'react';

export const Skeleton = ({ className = '', ...props }) => {
  return (
    <div
      className={`skeleton rounded-lg ${className}`}
      {...props}
    />
  );
};

export const CardSkeleton = () => (
  <div className="glass-panel p-5 space-y-3">
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <div className="space-y-1.5 flex-1">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <Skeleton className="h-16 w-full" />
    <div className="flex gap-2">
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-6 w-20" />
    </div>
  </div>
);

export default Skeleton;
