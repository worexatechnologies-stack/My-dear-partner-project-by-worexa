import React from 'react';
import SmartImage from '@/components/shared/smart-image';
import { Link } from '@/lib/router-compat';
import { motion } from 'framer-motion';
import { Heart, Bookmark, X, MapPin, BadgeCheck, ShieldCheck } from 'lucide-react';

interface FeedMatchCardProps {
  profile: any;
  isShortlisted?: boolean;
  onInterest?: (id: string) => void;
  onPass?: (id: string) => void;
  onShortlist?: (id: string) => void;
  isLiking?: boolean;
  // Optional flag to render the action buttons row. Useful if we just want the profile visual in compare/messages.
  showActions?: boolean;
  className?: string;
}

export default function FeedMatchCard({ 
  profile, 
  onInterest, 
  onPass, 
  onShortlist, 
  isLiking = false,
  isShortlisted = false,
  showActions = true,
  className = "w-full max-w-[430px] mx-auto"
}: FeedMatchCardProps) {
  // A photo-shaped blank panel is visually jarring and makes the dashboard
  // feel broken. Use a compact profile summary until the member adds a photo.
  if (!profile.photo) {
    const name = profile.name || profile.full_name || 'Member';
    const initial = name.trim().charAt(0).toUpperCase() || 'M';
    return (
      <div className={`relative h-[min(66svh,560px)] min-h-[400px] w-full overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#321122] via-[#8e3d58] to-[#f19ab5] shadow-2xl shadow-rose-950/20 sm:h-[min(70svh,600px)] ${className}`}>
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-rose-200/35 blur-3xl" />
        <div className="absolute -bottom-20 -right-16 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/20" />
        {isLiking && <motion.div initial={{ opacity: 0, scale: 0.35 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.5 }} className="absolute inset-0 z-20 flex items-center justify-center bg-rose-950/20 backdrop-blur-[2px]"><div className="flex h-28 w-28 items-center justify-center rounded-full bg-rose-500 text-white shadow-2xl shadow-rose-950/50"><Heart className="h-14 w-14" fill="currentColor" /></div></motion.div>}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5"><span className="rounded-full border border-white/25 bg-black/15 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-white backdrop-blur">Today&apos;s match</span><span className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur">Private photo</span></div>
        <div className="absolute inset-0 flex items-center justify-center"><div className="flex h-28 w-28 items-center justify-center rounded-full border border-white/35 bg-white/15 text-5xl font-black text-white shadow-2xl backdrop-blur-md">{initial}</div></div>
        <div className="absolute bottom-0 left-0 right-16 p-6 text-white sm:p-8"><Link to={`/profile/${profile.id}`} className="text-3xl font-black tracking-tight hover:text-rose-200">{name}</Link><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm font-semibold text-white/85">{profile.age ? <span>{profile.age} yrs</span> : null}{profile.occupation && profile.occupation !== 'Not specified' ? <span>{profile.occupation}</span> : null}</div><div className="mt-2 flex items-center gap-1.5 text-sm text-white/75"><MapPin className="h-4 w-4" /><span>{profile.location && profile.location !== 'Not specified' ? profile.location : 'Location private'}</span></div></div>
        {showActions && <div className="absolute bottom-5 right-4 flex flex-col items-center gap-3">
          {onInterest && <button onClick={() => onInterest(profile.id)} className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-black/20 transition hover:scale-105 hover:bg-rose-600" aria-label="Send Interest"><Heart className="h-5 w-5" fill="currentColor" /></button>}
          {onShortlist && <button onClick={() => onShortlist(profile.id)} className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/30 backdrop-blur transition hover:scale-105 ${isShortlisted ? 'bg-indigo-500 text-white' : 'bg-white/20 text-white'}`} aria-label="Shortlist"><Bookmark className="h-5 w-5" fill={isShortlisted ? 'currentColor' : 'none'} /></button>}
          {onPass && <button onClick={() => onPass(profile.id)} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur transition hover:scale-105" aria-label="Pass"><X className="h-5 w-5" /></button>}
        </div>}
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className={`w-full overflow-hidden rounded-2xl border border-slate-100/60 bg-white shadow-xl sm:rounded-[2rem] ${className}`}
    >
      <div className="group relative h-[min(66svh,560px)] min-h-[400px] w-full sm:h-[min(70svh,600px)]">
        <SmartImage src={profile.photo} alt={profile.name || profile.full_name || 'Member'} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
        
        {/* Soft gradient overlay for text readability */}
        {profile.photo && <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />}
        {isLiking && <motion.div initial={{ opacity: 0, scale: 0.35 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.5 }} className="absolute inset-0 z-30 flex items-center justify-center bg-rose-950/20 backdrop-blur-[2px]"><div className="flex h-28 w-28 items-center justify-center rounded-full bg-rose-500 text-white shadow-2xl shadow-rose-950/50"><Heart className="h-14 w-14" fill="currentColor" /></div></motion.div>}

        {/* Top Badges */}
        <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2 pr-4">
          {profile.compatibility > 0 && (
            <div className="flex items-center gap-1 bg-white/20 backdrop-blur-md text-white text-xs font-black px-3 py-1.5 rounded-full border border-white/20 shadow-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-300" /> {profile.compatibility}% Match
            </div>
          )}
          {profile.is_verified && (
            <div className="flex items-center gap-1 bg-rose-500/80 backdrop-blur-md text-white text-xs font-black px-3 py-1.5 rounded-full shadow-lg">
              <BadgeCheck className="w-4 h-4" /> Verified
            </div>
          )}
        </div>

        {/* Bottom Info - Rendered cleanly over the gradient */}
        <div className={`absolute bottom-0 left-0 right-0 z-20 p-4 sm:p-6 ${profile.photo ? '' : 'border-t border-rose-100/80 bg-white/85 backdrop-blur-sm'}`}>
          <Link to={`/profile/${profile.id}`} className="block w-fit">
            <h2 className={`text-2xl font-black transition-colors sm:text-3xl ${profile.photo ? 'text-white drop-shadow-md hover:text-rose-200' : 'text-slate-800 hover:text-rose-600'}`}>
              {profile.name || profile.full_name || 'Member'}
            </h2>
          </Link>
          <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium ${profile.photo ? 'text-white drop-shadow-md' : 'text-slate-600'}`}>
            {profile.age ? <span>{profile.age} yrs</span> : null}
            {profile.height && profile.height !== 'Not specified' && <><span className="w-1.5 h-1.5 rounded-full bg-white/50" /><span>{profile.height}</span></>}
            {profile.occupation && profile.occupation !== 'Not specified' && <><span className="w-1.5 h-1.5 rounded-full bg-white/50" /><span className="truncate max-w-[200px]">{profile.occupation}</span></>}
          </div>
          <div className={`mt-2 flex items-center gap-1.5 text-sm ${profile.photo ? 'text-white/80 drop-shadow-md' : 'text-slate-500'}`}>
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="truncate">{profile.location && profile.location !== 'Not specified' ? profile.location : 'Location not specified'}</span>
          </div>
        </div>
      </div>
      
      {/* Action Buttons Row - Centered below the image */}
      {showActions && (
        <div className="flex items-center justify-center gap-4 bg-white p-4 sm:gap-8 sm:p-6">
          {onPass && (
            <button 
              onClick={() => onPass(profile.id)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-slate-100 text-slate-400 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-200 hover:text-slate-600 active:scale-95 sm:h-16 sm:w-16"
              aria-label="Pass"
            >
              <X className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={2.5} />
            </button>
          )}
          
          {onShortlist && (
            <button 
              onClick={() => onShortlist(profile.id)}
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 shadow-sm transition-all active:scale-95 sm:h-14 sm:w-14 ${
                isShortlisted 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-500' 
                  : 'bg-white border-slate-200 text-slate-400 hover:bg-indigo-50 hover:text-indigo-500 hover:border-indigo-200'
              }`}
              aria-label="Shortlist"
            >
              <Bookmark className="h-5 w-5 sm:h-6 sm:w-6" fill={isShortlisted ? 'currentColor' : 'none'} strokeWidth={2.5} />
            </button>
          )}

          {onInterest && (
            <button 
              onClick={() => onInterest(profile.id)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-lg shadow-rose-500/20 transition-all hover:bg-rose-600 hover:shadow-xl hover:shadow-rose-500/30 active:scale-95 sm:h-16 sm:w-16"
              aria-label="Send Interest"
            >
              <Heart className="h-6 w-6 sm:h-7 sm:w-7" fill="currentColor" />
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
