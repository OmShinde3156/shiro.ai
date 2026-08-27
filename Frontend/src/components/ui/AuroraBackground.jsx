import React from 'react';
import KnowledgeMesh from './KnowledgeMesh';

export const AuroraBackground = ({ 
  children, 
  className = ''
}) => {
  return (
    <div className={`relative overflow-hidden w-full h-full ${className}`}>
      {/* 🌿 Shiro Knowledge Mesh Ambient Layer */}
      <KnowledgeMesh />

      {/* Foreground Content */}
      <div className="relative z-10 w-full h-full flex flex-col">
        {children}
      </div>
    </div>
  );
};

export default AuroraBackground;
