'use client';

import React from 'react';

interface TabItem {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
  variant?: 'pills' | 'underline';
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeKey,
  onChange,
  className = '',
  variant = 'underline'
}) => {
  return (
    <div className={`flex flex-wrap items-center gap-1.5 border-b border-gray-150 pb-px ${className}`}>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeKey === item.key;
        
        if (variant === 'pills') {
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={`
                px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer
                ${isActive 
                  ? 'bg-[var(--theme-primary-600)] text-white shadow-sm shadow-[var(--theme-primary-600)]/15' 
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100/60'
                }
              `}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {item.label}
            </button>
          );
        }

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`
              relative px-4 py-3 text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1.5 border-b-2 cursor-pointer
              ${isActive 
                ? 'border-[var(--theme-primary-500)] text-[var(--theme-primary-700)]' 
                : 'border-transparent text-gray-400'
              }
            `}
          >
            {Icon && <Icon className="w-4 h-4 shrink-0" />}
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
