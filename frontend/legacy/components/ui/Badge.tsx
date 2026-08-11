'use client';

import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'gray';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'gray',
  className = ''
}) => {
  const baseStyle = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider select-none';
  
  const variants = {
    primary: 'bg-rose-50 text-[var(--theme-primary-600)] border border-rose-100',
    secondary: 'bg-indigo-50 text-indigo-600 border border-indigo-100',
    success: 'bg-green-50 text-green-700 border border-green-100',
    warning: 'bg-amber-50 text-amber-700 border border-amber-100',
    danger: 'bg-red-50 text-red-700 border border-red-100',
    info: 'bg-rose-50 text-rose-700 border border-rose-100',
    gray: 'bg-gray-50 text-gray-600 border border-gray-150'
  };

  return (
    <span className={`${baseStyle} ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};
