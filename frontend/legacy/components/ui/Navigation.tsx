'use client';

import SmartImage from '@/components/shared/smart-image';

import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

// Breadcrumbs component
interface BreadcrumbItem {
  label: string;
  path?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ items }) => {
  return (
    <nav className="flex text-xs font-bold text-gray-400 uppercase tracking-wider select-none" aria-label="Breadcrumb">
      <ol className="inline-flex items-center space-x-1 md:space-x-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={index} className="inline-flex items-center">
              {index > 0 && <span className="mx-1 md:mx-2 text-gray-300">/</span>}
              {isLast || !item.path ? (
                <span className="text-gray-500 font-extrabold">{item.label}</span>
              ) : (
                <span className="text-gray-400 font-semibold">{item.label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

// Avatar component
interface AvatarProps {
  userId?: string | null;
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  userId,
  src,
  name,
  size = 'md',
  className = ''
}) => {
  const initials = name
    ? name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()
    : 'U';

  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base'
  };

  return (
    <div className={`relative shrink-0 select-none ${className}`}>
      {userId || src ? (
        <SmartImage
          userId={userId}
          src={userId ? undefined : src}
          alt={name}
          className={`${sizes[size]} rounded-full object-cover shadow-inner`}
        />
      ) : (
        <div className={`
          ${sizes[size]} rounded-full bg-gradient-to-br from-[var(--theme-primary-600)] to-[var(--theme-primary-800)] text-white font-bold flex items-center justify-center shadow-inner
        `}>
          {initials}
        </div>
      )}
    </div>
  );
};

// SearchInput component with 300ms debounce
interface SearchInputProps {
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  placeholder = 'Search...',
  value,
  onChange,
  className = ''
}) => {
  const [localVal, setLocalVal] = useState(value);

  // Sync state with parent value
  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  // Debounced trigger
  useEffect(() => {
    const handler = setTimeout(() => {
      onChange(localVal);
    }, 300);
    return () => clearTimeout(handler);
  }, [localVal, onChange]);

  return (
    <div className={`relative ${className}`}>
      <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
      <input
        type="text"
        placeholder={placeholder}
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        className="w-full bg-white border border-gray-200 focus:border-[var(--theme-primary-500)] text-sm px-4 py-2.5 pl-10 rounded-full outline-none focus:ring-4 focus:ring-[var(--theme-primary-500)]/10 transition-all duration-200"
      />
      {localVal && (
        <button
          type="button"
          onClick={() => setLocalVal('')}
          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 font-bold text-xs cursor-pointer"
        >
          âœ•
        </button>
      )}
    </div>
  );
};
