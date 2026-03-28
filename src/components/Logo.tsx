import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    {/* Outer dial marks */}
    <circle cx="50" cy="50" r="45" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" strokeDasharray="4 8" />
    
    {/* Orange Arc */}
    <path d="M 50 15 A 35 35 0 1 0 85 50" stroke="#F97316" strokeWidth="6" strokeLinecap="round" />
    <circle cx="85" cy="50" r="3" fill="#F97316" />
    
    {/* Purple Arc */}
    <path d="M 50 15 A 35 35 0 0 1 74.7 74.7" stroke="#8B5CF6" strokeWidth="6" strokeLinecap="round" />
    <circle cx="74.7" cy="74.7" r="4" fill="#8B5CF6" />

    {/* Teal Arc */}
    <path d="M 50 25 A 25 25 0 1 0 75 50" stroke="#14B8A6" strokeWidth="4" strokeLinecap="round" />
    <circle cx="75" cy="50" r="2.5" fill="#14B8A6" />
  </svg>
);
