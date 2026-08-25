'use client';
import SmartImage from '@/components/shared/smart-image';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams } from '@/lib/router-compat';
import { profileHref } from '@/lib/profile-url';
import { Heart, MessageCircle, MapPin, ShieldCheck, Search, SlidersHorizontal, X, Check, Crown, ChevronDown, RefreshCw, Bookmark, Sparkles, Users } from 'lucide-react';
import type { Profile } from '../types/domain';
import { getProfiles, sendInterest } from '../services/dataService';
import { useAuth } from '../contexts/AuthContext';
import { usePresence } from '../../hooks/use-presence';

function cardName(p: Profile) { return p.name?.split(' ')[0] || 'Member'; }

/* ──────────── Skeleton ──────────── */
function SkeletonCard() {
  return (
    <div className="fsp-card animate-pulse">
      <div className="aspect-[3/4] bg-gradient-to-b from-[#f0eaee] to-[#e8dde5]" />
      <div className="p-4 space-y-2">
        <div className="h-3.5 w-3/5 rounded-full bg-[#f0eaee]" />
        <div className="h-3 w-2/5 rounded-full bg-[#f5eff3]" />
        <div className="flex gap-1.5 pt-1">
          <div className="h-5 w-12 rounded-full bg-[#f5eff3]" />
          <div className="h-5 w-16 rounded-full bg-[#f5eff3]" />
        </div>
        <div className="h-9 rounded-xl bg-[#f0eaee] mt-2" />
      </div>
    </div>
  );
}

/* ──────────── Profile Card ──────────── */
function ProfileCard({ profile, online, busy, onInterest, onMessage }: {
  profile: Profile; online: boolean; busy: boolean;
  onInterest: () => void; onMessage: () => void;
}) {
  const m = profile.compatibility ?? 0;
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="fsp-card group flex flex-col"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <SmartImage src={profile.photo} alt={profile.name} aspectRatio="4:5"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1a0812]/70 via-transparent to-transparent" />
        {m > 0 && (
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 backdrop-blur-md">
            <Heart className="h-2.5 w-2.5 fill-[#f9a8c4] text-[#f9a8c4]" />
            <span className="text-[10px] font-bold text-white">{m}%</span>
          </div>
        )}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1">
          {profile.verified && (
            <div className="flex items-center gap-1 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 backdrop-blur-md">
              <Check className="h-2.5 w-2.5 text-[#6ee7b7]" strokeWidth={3} />
              <span className="text-[10px] font-bold text-white">Verified</span>
            </div>
          )}
          {profile.premium && (
            <div className="flex items-center gap-1 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 backdrop-blur-md">
              <Crown className="h-2.5 w-2.5 text-[#fcd34d]" />
              <span className="text-[10px] font-bold text-white">Premium</span>
            </div>
          )}
        </div>
        {online && <span className="absolute bottom-[5.5rem] right-3 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />}
        {profile.photoVisibility === 'pending_approval' && (
          <div className="absolute inset-x-3 top-1/2 -translate-y-1/2 rounded-xl bg-black/60 py-2 text-center text-[10px] font-semibold text-white/80 backdrop-blur-sm">Pending approval</div>
        )}
        <div className="absolute bottom-0 inset-x-0 px-4 pb-4">
          <p className="text-[15px] font-extrabold text-white leading-snug drop-shadow-md truncate">
            {profile.name}{profile.age ? `, ${profile.age}` : ''}
          </p>
          {profile.location && (
            <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-white/70 truncate">
              <MapPin className="h-2.5 w-2.5 shrink-0" />{profile.location}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4 gap-2.5">
        {profile.occupation && (
          <p className="truncate text-[12.5px] font-semibold text-[#3d2030]">{profile.occupation}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {profile.religion && (
            <span className="rounded-full border border-[#eedde8] bg-[#fdf7f9] px-2.5 py-0.5 text-[10px] font-semibold text-[#8e4a62]">{profile.religion}</span>
          )}
          {profile.maritalStatus && (
            <span className="rounded-full border border-[#eedde8] bg-[#fdf7f9] px-2.5 py-0.5 text-[10px] font-semibold text-[#8e4a62]">{profile.maritalStatus}</span>
          )}
        </div>
        <div className="mt-auto flex items-center gap-2 pt-1">
          <Link to={profileHref(profile)} className="flex-1 rounded-xl bg-gradient-to-r from-[#8e3d58] to-[#b0496d] py-2.5 text-center text-[12.5px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(142,61,88,0.5)] transition-all hover:shadow-[0_6px_20px_-4px_rgba(142,61,88,0.65)] hover:brightness-105 active:scale-[0.97]">
            View profile
          </Link>
          <button type="button" onClick={onInterest} disabled={busy} title="Send Interest"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#eedde8] bg-[#fdf7f9] text-[#b64a68] transition-all hover:bg-[#b64a68] hover:text-white hover:border-[#b64a68] hover:shadow-[0_4px_12px_-4px_rgba(182,74,104,0.4)] active:scale-[0.97] disabled:opacity-50">
            <Heart className="h-3.5 w-3.5" fill={busy ? 'currentColor' : 'none'} />
          </button>
          <button type="button" onClick={onMessage} title="Message"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#eedde8] bg-[#fdf7f9] text-[#b64a68] transition-all hover:bg-[#b64a68] hover:text-white hover:border-[#b64a68] hover:shadow-[0_4px_12px_-4px_rgba(182,74,104,0.4)] active:scale-[0.97]">
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.article>
  );
}

const iCls = 'w-full rounded-xl border border-[#e8d8e0] bg-white/70 px-3.5 py-2.5 text-[13px] font-medium text-[#3d2030] outline-none transition-all placeholder:text-[#c4a0b2] focus:border-[#b64a68] focus:bg-white focus:ring-2 focus:ring-[#b64a68]/12 backdrop-blur-sm';
const lCls = 'mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-[#b08898]';

export default function SearchPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [msgProfile, setMsgProfile] = useState<Profile | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 12;
  const ids = useMemo(() => profiles.map((p) => p.id), [profiles]);
  const { isOnline } = usePresence(ids);
  const [keyword, setKeyword] = useState('');
  const [gender, setGender] = useState('');
  const [religion, setReligion] = useState('');
  const [location, setLocation] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [marital, setMarital] = useState('');
  const [tongue, setTongue] = useState('');
  const [edu, setEdu] = useState('');
  const [caste, setCaste] = useState('');

  const fp = useCallback((o: Record<string, string> = {}) => {
    const v = { search: keyword, gender, religion, location, min_age: ageMin, max_age: ageMax, marital_status: marital, mother_tongue: tongue, education: edu, caste, ...o };
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x.trim() !== ''));
  }, [keyword, gender, religion, location, ageMin, ageMax, marital, tongue, edu, caste]);

  const afc = useMemo(() => [keyword, gender, religion, location, ageMin || ageMax, marital, tongue, edu, caste].filter(Boolean).length, [keyword, gender, religion, location, ageMin, ageMax, marital, tongue, edu, caste]);

  useEffect(() => { if (msgProfile) document.body.style.overflow = 'hidden'; else document.body.style.overflow = ''; return () => { document.body.style.overflow = ''; }; }, [msgProfile]);

  const load = useCallback(async (filterP: Record<string, string>, pg = 1, append = false) => {
    if (pg === 1) setLoading(true); else setLoadingMore(true);
    setError('');
    try {
      const data = await getProfiles({ ...filterP, page: String(pg), page_size: String(PAGE_SIZE) });
      const r = data.results || [];
      setProfiles((prev) => append ? [...prev, ...r] : r);
      setTotal((data as any).count || r.length);
      setHasMore(Boolean((data as any).next));
      setPage(pg);
    } catch (e: any) { setError(e?.message || 'Could not load profiles.'); }
    finally { setLoading(false); setLoadingMore(false); }
  }, []);

  useEffect(() => {
    const p: Record<string, string> = {};
    searchParams.forEach((v, k) => {
      const a = ({ q: 'search', work_location: 'location', age_min: 'min_age', age_max: 'max_age', highest_education: 'education' } as Record<string, string>)[k] || k;
      p[a] = v;
      if (k === 'q') setKeyword(v);
      else if (k === 'gender') setGender(v);
      else if (k === 'religion') setReligion(v);
      else if (k === 'location' || k === 'work_location') setLocation(v);
      else if (k === 'min_age' || k === 'age_min') setAgeMin(v);
      else if (k === 'max_age' || k === 'age_max') setAgeMax(v);
      else if (k === 'marital_status') setMarital(v);
      else if (k === 'mother_tongue') setTongue(v);
      else if (k === 'education' || k === 'highest_education') setEdu(v);
      else if (k === 'caste') setCaste(v);
    });
    load(p);
  }, [searchParams, load]);

  const interest = async (id: string) => {
    setBusyId(id);
    try { await sendInterest(id); alert('Interest sent!'); }
    catch (e: any) {
      const isM = e?.code === 'MEMBERSHIP_REQUIRED' || (typeof e?.message === 'string' && e.message.toLowerCase().includes('membership plan')) || (e?.status === 403 && !e?.message?.toLowerCase?.()?.includes?.('csrf'));
      alert(isM ? 'Upgrade your membership to send interests.' : (e instanceof Error ? e.message : 'Could not send interest.'));
    } finally { setBusyId(''); }
  };

  const reset = () => { setKeyword(''); setGender(''); setReligion(''); setLocation(''); setAgeMin(''); setAgeMax(''); setMarital(''); setTongue(''); setEdu(''); setCaste(''); load({}, 1, false); };
  const apply = (e?: React.FormEvent) => { e?.preventDefault(); setPage(1); load(fp(), 1, false); };

  const chips = [gender, marital, religion, location, ageMin && (ageMin + '-' + (ageMax || 'any') + ' yrs'), tongue, edu, caste].filter(Boolean) as string[];

  const FF = (extra?: () => void) => (
    <form onSubmit={(e) => { apply(e); extra?.(); }} className="space-y-3.5">
      <div>
        <label className={lCls}>Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#c4a0b2] pointer-events-none" />
          <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Name, city, profession..." className={iCls + ' pl-9'} />
        </div>
      </div>
      <div>
        <label className={lCls}>Marital Status</label>
        <select value={marital} onChange={(e) => setMarital(e.target.value)} className={iCls}>
          <option value="">Any status</option>
          <option value="Single">Single</option>
          <option value="Never Married">Never Married</option>
          <option value="Divorced">Divorced</option>
          <option value="Widowed">Widowed</option>
          <option value="Awaiting Divorced">Awaiting Divorced</option>
        </select>
      </div>
      <div>
        <label className={lCls}>Religion</label>
        <input type="text" value={religion} onChange={(e) => setReligion(e.target.value)} placeholder="e.g. Hindu, Muslim, Christian" className={iCls} />
      </div>
      <button type="button" onClick={() => setMoreFilters((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-[#e8d8e0] bg-white/60 px-3.5 py-2.5 text-[12.5px] font-semibold text-[#5a3040] hover:bg-white/90 transition-all">
        <span>More filters{afc > 3 ? ` (${afc - 3} extra)` : ''}</span>
        <ChevronDown className={'h-4 w-4 text-[#b64a68] transition-transform duration-200' + (moreFilters ? ' rotate-180' : '')} />
      </button>
      <AnimatePresence initial={false}>
        {moreFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
            <div className="space-y-3.5 pt-0.5">
              <div><label className={lCls}>Gender</label><select value={gender} onChange={(e) => setGender(e.target.value)} className={iCls}><option value="">Opposite Gender</option><option value="male">Male</option><option value="female">Female</option><option value="all">All</option></select></div>
              <div><label className={lCls}>Age Range</label><div className="grid grid-cols-2 gap-2"><input type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} placeholder="Min" min="18" className={iCls} /><input type="number" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} placeholder="Max" className={iCls} /></div></div>
              <div><label className={lCls}>Location</label><input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Mumbai, Bangalore" className={iCls} /></div>
              <div><label className={lCls}>Mother Tongue</label><input type="text" value={tongue} onChange={(e) => setTongue(e.target.value)} placeholder="e.g. Hindi, Tamil" className={iCls} /></div>
              <div><label className={lCls}>Caste</label><input type="text" value={caste} onChange={(e) => setCaste(e.target.value)} placeholder="e.g. Nair, Brahmin" className={iCls} /></div>
              <div><label className={lCls}>Education</label><input type="text" value={edu} onChange={(e) => setEdu(e.target.value)} placeholder="e.g. B.Tech, MBA" className={iCls} /></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button type="submit" className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#8e3d58] to-[#b0496d] py-3 text-[13px] font-bold text-white shadow-[0_4px_18px_-4px_rgba(142,61,88,0.55)] hover:shadow-[0_6px_22px_-4px_rgba(142,61,88,0.7)] hover:brightness-105 active:scale-[0.98] transition-all">
        <Search className="h-4 w-4" />Apply filters
      </button>
    </form>
  );

  const css = `
    .fsp-wrap{display:flex;height:100%;background:linear-gradient(135deg,#fdf8fa 0%,#f9f0f5 100%);overflow:hidden}
    .fsp-sidebar{display:none;width:260px;flex-shrink:0;overflow-y:auto;background:rgba(255,255,255,0.7);border-right:1px solid rgba(220,195,208,0.6);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);scrollbar-width:thin;scrollbar-color:#e8d5df transparent}
    @media(min-width:1024px){.fsp-sidebar{display:flex;flex-direction:column}}
    @media(min-width:1280px){.fsp-sidebar{width:280px}}
    .fsp-main{flex:1;min-width:0;overflow-y:auto;display:flex;flex-direction:column;scrollbar-width:thin;scrollbar-color:#e8d5df transparent}
    .fsp-header{position:sticky;top:0;z-index:20;background:rgba(253,248,250,0.88);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid rgba(220,195,208,0.5);padding:1rem 1.25rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}
    .fsp-card{background:#fff;border:1px solid rgba(220,195,208,0.7);border-radius:1.125rem;overflow:hidden;box-shadow:0 2px 8px -2px rgba(100,30,60,0.07);transition:transform 0.25s ease,box-shadow 0.25s ease}
    .fsp-card:hover{transform:translateY(-4px);box-shadow:0 16px 36px -8px rgba(100,30,60,0.2)}
    .fsp-grid{display:grid;grid-template-columns:1fr;gap:1rem;padding:1.25rem}
    @media(min-width:480px){.fsp-grid{grid-template-columns:repeat(2,1fr)}}
    @media(min-width:768px){.fsp-grid{grid-template-columns:repeat(2,1fr)}}
    @media(min-width:1280px){.fsp-grid{grid-template-columns:repeat(3,1fr)}}
    @media(min-width:1600px){.fsp-grid{grid-template-columns:repeat(4,1fr)}}
    .fsp-sidebar-inner{padding:1.25rem;display:flex;flex-direction:column;gap:1rem;flex:1}
    .fsp-sidebar-head{display:flex;align-items:center;justify-content:space-between;padding-bottom:1rem;border-bottom:1px solid rgba(220,195,208,0.5)}
  `;

  return (
    <>
      <style>{css}</style>
      <div className="fsp-wrap">

        {/* ── Sidebar ── */}
        <aside className="fsp-sidebar">
          <div className="fsp-sidebar-inner">
            <div className="fsp-sidebar-head">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#8e3d58] to-[#b0496d] shadow-sm">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-white" />
                </div>
                <span className="text-[13.5px] font-extrabold text-[#2c1020]">Filters</span>
                {afc > 0 && <span className="rounded-full bg-[#b64a68] px-2 py-0.5 text-[10px] font-extrabold text-white">{afc}</span>}
              </div>
              {afc > 0 && (
                <button type="button" onClick={reset} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-[#b64a68] hover:bg-[#fdf0f5] transition-colors">
                  <RefreshCw className="h-3 w-3" />Reset
                </button>
              )}
            </div>
            {FF()}
          </div>
        </aside>

        {/* ── Main ── */}
        <div className="fsp-main">

          {/* Sticky header */}
          <div className="fsp-header">
            <div>
              <p className="text-[9.5px] font-black uppercase tracking-[0.2em] text-[#b64a68]">Find Matches</p>
              <h1 className="text-[17px] font-extrabold text-[#2c1020] leading-tight">Discover your meaningful match</h1>
            </div>
            <div className="flex items-center gap-2">
              {!loading && total > 0 && (
                <span className="rounded-full border border-[#e8d8e0] bg-white px-3 py-1 text-[11.5px] font-bold shadow-sm">
                  <span className="text-[#b64a68]">{profiles.length}</span>
                  <span className="text-[#9b7385]"> / {total}</span>
                </span>
              )}
              <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Filters"
                className="lg:hidden flex items-center gap-1.5 rounded-xl border border-[#e8d8e0] bg-white px-3 py-2 text-[12.5px] font-bold text-[#3d2030] shadow-sm hover:bg-[#fdf7f9] transition-colors">
                <SlidersHorizontal className="h-4 w-4 text-[#b64a68]" />
                Filters
                {afc > 0 && <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[#b64a68] px-1 text-[9px] font-extrabold text-white">{afc}</span>}
              </button>
            </div>
          </div>

          {/* Mobile chips */}
          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
              {chips.map((c) => (
                <span key={c} className="rounded-full border border-[#f0d8e5] bg-[#fff5f9] px-3 py-0.5 text-[11px] font-semibold text-[#8e3d58]">{c}</span>
              ))}
              <button type="button" onClick={reset} className="text-[11px] font-bold text-[#b64a68] hover:underline">Clear all</button>
            </div>
          )}

          {/* Grid */}
          {loading ? (
            <div className="fsp-grid">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : error ? (
            <div className="m-6 flex flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50 p-10 text-center">
              <p className="text-sm font-bold text-red-700">{error}</p>
              <button type="button" onClick={() => load(fp())} className="mt-4 rounded-full border border-red-200 px-5 py-2 text-xs font-bold text-red-700 hover:bg-red-100">Try again</button>
            </div>
          ) : profiles.length === 0 ? (
            <div className="m-6 flex flex-col items-center justify-center rounded-2xl border border-[#f0e7ec] bg-white px-8 py-20 text-center shadow-sm">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#fff0f6] to-[#fde8f0] shadow-inner text-[#c47a9a]">
                <Users className="h-7 w-7" strokeWidth={1.5} />
              </div>
              <h2 className="mt-5 text-[17px] font-extrabold text-[#2c1020]">No matches found</h2>
              <p className="mt-2 max-w-xs text-[13px] leading-6 text-[#9b7385]">Try broadening your preferences to discover more members.</p>
              <button type="button" onClick={reset} className="mt-6 rounded-xl bg-gradient-to-r from-[#8e3d58] to-[#b0496d] px-6 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_16px_-4px_rgba(142,61,88,0.5)] hover:brightness-105">
                Reset filters
              </button>
            </div>
          ) : (
            <>
              <div className="fsp-grid">
                {profiles.map((profile) => (
                  <ProfileCard key={profile.id} profile={profile} online={isOnline(profile.id)}
                    busy={busyId === profile.id} onInterest={() => interest(profile.id)} onMessage={() => setMsgProfile(profile)} />
                ))}
                {loadingMore && Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={'m' + i} />)}
              </div>
              {hasMore && !loadingMore && (
                <div className="flex justify-center pb-8 pt-2">
                  <button type="button" onClick={() => load(fp(), page + 1, true)}
                    className="flex items-center gap-2 rounded-xl border border-[#e8d8e0] bg-white px-8 py-3 text-[13px] font-bold text-[#3d2030] shadow-sm hover:bg-[#fdf7f9] hover:border-[#b64a68] hover:shadow-md transition-all">
                    <ChevronDown className="h-4 w-4 text-[#b64a68]" />
                    Load more — {total - profiles.length} remaining
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Mobile filter drawer ── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-[#1c0816]/50 backdrop-blur-sm lg:hidden" />
            <motion.div initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 32, stiffness: 320 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[85vw] max-w-[320px] flex-col overflow-hidden bg-white shadow-2xl lg:hidden">
              <div className="flex items-center justify-between border-b border-[#f0e7ec] px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#8e3d58] to-[#b0496d]">
                    <SlidersHorizontal className="h-3.5 w-3.5 text-white" />
                  </div>
                  <span className="text-[14px] font-extrabold text-[#2c1020]">Filter Matches</span>
                  {afc > 0 && <span className="rounded-full bg-[#b64a68] px-2 py-0.5 text-[10px] font-extrabold text-white">{afc}</span>}
                </div>
                <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f5eff3] text-[#9b7385] hover:bg-[#eedde8] transition-colors">
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 pb-10">{FF(() => setDrawerOpen(false))}</div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Message modal ── */}
      <AnimatePresence>
        {msgProfile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4 bg-[#1c0816]/50 backdrop-blur-sm"
            role="dialog" aria-modal="true" aria-labelledby="fsp-msg-h">
            <motion.div
              initial={{ opacity: 0, y: 48 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 48 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl overflow-hidden">
              <div className="relative h-56 sm:h-48 overflow-hidden bg-[#f5eff3]">
                <SmartImage src={msgProfile.photo} alt={msgProfile.name} aspectRatio="4:5"
                  className="h-full w-full object-cover object-top" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#1a0812]/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 inset-x-0 px-5 pb-4">
                  <p className="text-[17px] font-extrabold text-white leading-snug drop-shadow">
                    {msgProfile.name}{msgProfile.age ? `, ${msgProfile.age}` : ''}
                  </p>
                  {msgProfile.location && (
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-white/70">
                      <MapPin className="h-2.5 w-2.5 shrink-0" />{msgProfile.location}
                    </p>
                  )}
                </div>
                <button type="button" onClick={() => setMsgProfile(null)} aria-label="Close"
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm hover:bg-black/55 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#fff0f6] border border-[#f3c6d4]">
                    <ShieldCheck className="h-4 w-4 text-[#b64a68]" />
                  </div>
                  <div>
                    <p className="text-[9.5px] font-black uppercase tracking-[0.15em] text-[#b64a68]">Safe messaging</p>
                    <h2 id="fsp-msg-h" className="text-[13.5px] font-extrabold text-[#2c1020] leading-tight">Keep it respectful & private</h2>
                  </div>
                </div>
                <div className="mb-4 rounded-xl border border-[#f3c6d4] bg-[#fff7fa] p-3.5 space-y-1.5 text-[11.5px] font-medium text-[#604452]">
                  <p className="flex gap-2"><Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" strokeWidth={2.5} />Be kind and communicate with respect.</p>
                  <p className="flex gap-2"><Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600" strokeWidth={2.5} />Protect your personal contact and financial details.</p>
                </div>
                <p className="mb-4 text-[10.5px] leading-relaxed text-[#9b7385]">My Dear Partner is not responsible for information shared outside the platform.</p>
                <div className="flex gap-2.5">
                  <button type="button" onClick={() => setMsgProfile(null)}
                    className="flex-1 rounded-xl border border-[#e8d8e0] py-2.5 text-[12.5px] font-bold text-[#7a6070] hover:bg-[#fdf7f9] transition-colors">Cancel</button>
                  <Link to={'/messages?user=' + msgProfile.id} state={{ profile: msgProfile }}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#8e3d58] to-[#b0496d] py-2.5 text-[12.5px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(142,61,88,0.55)] hover:brightness-105 transition-all">
                    <MessageCircle className="h-3.5 w-3.5" />Continue to chat
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

