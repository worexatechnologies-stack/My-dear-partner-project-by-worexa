'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, User, MapPin, Briefcase } from 'lucide-react';

export function MemberHeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsFocused(true);
      }
      if (e.key === 'Escape' && isFocused) {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFocused]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsFocused(false);
    inputRef.current?.blur();

    if (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(trimmed)) {
      router.push(`/profile/${trimmed}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  };

  const handleSuggestionClick = (searchQuery: string) => {
    setQuery(searchQuery);
    setIsFocused(false);
    router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
  };

  return (
    <div ref={containerRef} className="relative hidden md:block max-w-[340px] lg:max-w-[380px] w-full mx-auto">
      <form onSubmit={handleSubmit} className="relative w-full">
        <div
          className={`flex items-center w-full h-9 px-3 rounded-full transition-all duration-150 ${
            isFocused
              ? 'bg-white border border-[#e11d48] shadow-[0_2px_12px_rgba(225,29,72,0.12)]'
              : 'bg-[#f4f5f6] hover:bg-[#eaecee] border border-transparent'
          }`}
        >
          <Search
            className={`w-3.5 h-3.5 shrink-0 transition-colors ${isFocused ? 'text-[#e11d48]' : 'text-[#8e8e8e]'}`}
            strokeWidth={2.2}
          />

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            placeholder="Search profiles, ID, caste, city..."
            style={{
              border: 'none',
              outline: 'none',
              boxShadow: 'none',
              background: 'transparent',
              padding: '0 8px',
              margin: 0,
              width: '100%',
              fontSize: '13px',
              color: '#262626',
            }}
            className="w-full bg-transparent border-0 outline-none ring-0 focus:outline-none focus:ring-0 focus:border-0 font-normal placeholder:text-[#8e8e8e]"
          />

          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="hidden lg:inline-block text-[10px] font-medium text-[#8e8e8e] select-none pointer-events-none shrink-0 pr-1">
              Ctrl+K
            </span>
          )}
        </div>
      </form>

      {/* Clean Suggestions Dropdown */}
      {isFocused && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200/80 shadow-[0_10px_30px_rgba(0,0,0,0.08)] p-2.5 z-50 animate-in fade-in-50 duration-100">
          <div className="px-2.5 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
            Suggested Searches
          </div>

          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => handleSuggestionClick('Verified Profiles')}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-slate-700 hover:bg-rose-50/70 hover:text-rose-700 transition-colors text-left font-medium"
            >
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Verified Profiles with Photo</span>
            </button>

            <button
              type="button"
              onClick={() => handleSuggestionClick('Nearby Matches')}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-slate-700 hover:bg-rose-50/70 hover:text-rose-700 transition-colors text-left font-medium"
            >
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>Nearby Matches in My City</span>
            </button>

            <button
              type="button"
              onClick={() => handleSuggestionClick('Professionals')}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs text-slate-700 hover:bg-rose-50/70 hover:text-rose-700 transition-colors text-left font-medium"
            >
              <Briefcase className="w-3.5 h-3.5 text-slate-400" />
              <span>IT &amp; Working Professionals</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
