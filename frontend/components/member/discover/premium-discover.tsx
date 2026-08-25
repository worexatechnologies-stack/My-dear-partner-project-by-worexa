'use client';

import { profileHref } from '@/lib/profile-url';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye, Heart, MapPin, MoreHorizontal,
  ShieldCheck, SlidersHorizontal, Star, X, Flag, Ban, EyeOff,
  ChevronRight, Crown, ArrowRight, RotateCcw, CheckCircle2,
  Briefcase, GraduationCap, Check,
} from 'lucide-react';

import SmartImage from '@/components/shared/smart-image';
import { useToast } from '@/components/ui';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { fetchApi } from '@/legacy/services/apiClient';
import { getProfiles, getInterests, getShortlists, sendInterest, toggleShortlist } from '@/legacy/services/dataService';
import type { Profile } from '@/legacy/types/domain';

/* ─────────────────────────────── Types ─────────────────────────────── */

type FeedTab = 'all' | 'recent' | 'new';

interface Filters {
  ageMin: number; ageMax: number;
  religion: string; motherTongue: string;
  education: string; occupation: string;
  maritalStatus: string;
  showVerifiedOnly: boolean; recentOnly: boolean;
}

const DEFAULT_FILTERS: Filters = {
  ageMin: 21, ageMax: 45, religion: '', motherTongue: '',
  education: '', occupation: '', maritalStatus: '',
  showVerifiedOnly: false, recentOnly: false,
};

const DISMISS_STORAGE_KEY = 'mdp-discover-dismissed';

function loadDismissedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []);
  } catch {
    return new Set();
  }
}

function saveDismissedIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* quota / private mode */ }
}

/* ─────────────────────────────── Helpers ─────────────────────────────── */

const useful = (v?: string) => (v && v !== 'Not specified' && v !== '' ? v : null);
const initials = (n?: string) =>
  (n || 'M').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
const visiblePhoto = (p: Profile) =>
  p.photoVisibility !== 'visible' ? '' : (p.photoFull || p.photo || '');
function extractPhoto(u: unknown): string {
  if (!u || typeof u !== 'object') return '';
  const o = u as Record<string, unknown>;
  for (const k of ['photo', 'image_url', 'thumbnail_url']) if (typeof o[k] === 'string' && (o[k] as string).trim()) return o[k] as string;
  const pp = o.primary_photo;
  if (typeof pp === 'string' && pp.trim()) return pp;
  if (pp && typeof pp === 'object') { const p = pp as Record<string, string>; return p.url || p.image_url || ''; }
  if (Array.isArray(o.photos) && o.photos.length) { const p = o.photos.find((x: unknown) => (x as Record<string, unknown>)?.is_primary) ?? o.photos[0]; return typeof p === 'string' ? p : ((p as Record<string, string>)?.url || (p as Record<string, string>)?.image_url || ''); }
  // Visitor rows nest the member under `profile`; interest rows under `sender`.
  for (const key of ['profile', 'sender', 'member', 'user', 'actor', 'viewer']) {
    if (o[key] && typeof o[key] === 'object') {
      const nested = extractPhoto(o[key]);
      if (nested) return nested;
    }
  }
  return '';
}
function matchesFilters(p: Profile, f: Filters, tab: FeedTab) {
  const a = p.age || 0;
  // The default 21–45 age range is a gentle suggested floor, not a hard gate —
  // a brand-new profile aged 18–20 (or above 45) must still appear in
  // Discover unless the member explicitly customized the age filter.
  const isDefaultAge = f.ageMin === DEFAULT_FILTERS.ageMin && f.ageMax === DEFAULT_FILTERS.ageMax;
  if (!isDefaultAge && a > 0 && (a < f.ageMin || a > f.ageMax)) return false;
  if (f.religion && p.religion && p.religion !== 'Not specified' && p.religion !== f.religion) return false;
  if (f.motherTongue && p.motherTongue && p.motherTongue !== 'Not specified' && p.motherTongue !== f.motherTongue) return false;
  if (f.education && p.education && p.education !== 'Not specified' && p.education !== f.education) return false;
  if (f.occupation && p.occupation && p.occupation !== 'Not specified' && p.occupation !== f.occupation) return false;
  if (f.maritalStatus && p.maritalStatus && p.maritalStatus !== 'Not specified' && p.maritalStatus !== f.maritalStatus) return false;
  if (f.showVerifiedOnly && !p.verified) return false;
  if (f.recentOnly && !p.verified) return false;
  if (tab === 'recent') return p.verified;
  return true;
}

/* ─────────────────────────────── CSS ─────────────────────────────── */

const CSS = `
/* Root */
.d-root { height:100%; min-height:0; display:flex; flex-direction:column; background:radial-gradient(46rem 26rem at 110% -10%, rgba(182,74,104,0.06), transparent 60%), radial-gradient(36rem 24rem at -10% 110%, rgba(217,179,108,0.05), transparent 60%), #faf6f3; overflow:hidden; }

/* Body */
.d-body { box-sizing:border-box; flex:1; width:100%; min-height:0; display:flex; gap:0.75rem; overflow:hidden; padding:0.5rem 0.75rem; }
@media(min-width:768px){ .d-body{padding:0.75rem 1.25rem;} }
@media(max-width:639px){ .d-body{padding:0.375rem 0.625rem 0.375rem;} }
@media(min-width:1280px){
  .d-body{max-width:94rem; margin-inline:auto; gap:0.875rem; padding:0.875rem 1rem 0.75rem;}
  .d-main > .d-heading,
  .d-main > .d-toolbar,
  .d-main > .d-hint { width:100%; max-width:67.5rem; margin-inline:auto; }
  .d-card-area { width:100%; max-width:67.5rem; margin-inline:auto; }
}

/* Main column */
.d-main { flex:1; min-width:0; min-height:0; display:flex; flex-direction:column; gap:0.5rem; }

/* ── Heading ── */
.d-heading { flex-shrink:0; }
.d-title-row { display:flex; align-items:center; gap:0.5rem; }
.d-title { font-family:var(--font-heading); font-size:1.75rem; font-weight:800; color:#2c2928; margin:0; line-height:1; }
.d-subtitle { font-size:0.8125rem; color:#9a8990; margin:0.25rem 0 0; }
@media(max-width:639px){ .d-heading{display:none;} }

/* ── Toolbar ── */
.d-toolbar { flex-shrink:0; display:flex; align-items:center; justify-content:space-between; gap:0.625rem; }
.d-tabs { display:flex; align-items:center; gap:0.375rem; overflow-x:auto; scrollbar-width:none; }
.d-tabs::-webkit-scrollbar{display:none;}

.d-tab {
  display:inline-flex; align-items:center; gap:0.3rem;
  padding:0.45rem 1rem; border-radius:9999px;
  border:1.5px solid #ece0e4; background:rgba(255,255,255,0.85); color:#776a6f;
  font-size:0.6875rem; font-weight:700; letter-spacing:0.01em; white-space:nowrap; cursor:pointer;
  transition:all 0.18s ease; flex-shrink:0;
  -webkit-tap-highlight-color:transparent;
}
.d-tab:not(.active):hover { background:#fdf5f7; border-color:#e3ccd4; color:#8e3d58; }
.d-tab.active {
  background:linear-gradient(135deg,#e11d48 0%,#b64a68 100%); border-color:transparent; color:white;
  box-shadow:0 6px 16px rgba(225,29,72,0.30), inset 0 1px 0 rgba(255,255,255,0.22);
}

.d-filter-btn {
  display:inline-flex; align-items:center; gap:0.375rem;
  padding:0.45rem 1rem; border-radius:9999px;
  border:1.5px solid rgba(182,74,104,0.28); background:rgba(255,255,255,0.9); color:#8e3d58;
  font-size:0.6875rem; font-weight:700; letter-spacing:0.01em; cursor:pointer; flex-shrink:0;
  box-shadow:0 2px 8px rgba(67,22,39,0.05);
  transition:all 0.18s ease;
}
.d-filter-btn:hover { background:#fdf3f6; border-color:rgba(182,74,104,0.5); transform:translateY(-1px); box-shadow:0 6px 14px rgba(142,61,88,0.14); }
.d-filter-btn:active { transform:translateY(0) scale(0.97); }
.d-filter-btn.active {
  background:linear-gradient(135deg,#e11d48 0%,#b64a68 100%); border-color:transparent; color:white;
  box-shadow:0 8px 18px rgba(225,29,72,0.32), inset 0 1px 0 rgba(255,255,255,0.22);
}
.d-filter-btn.active:hover { filter:brightness(1.06); background:linear-gradient(135deg,#e11d48 0%,#b64a68 100%); }

/* ── Card area ── */
.d-card-area {
  flex:1; min-height:0; position:relative;
  display:flex; align-items:stretch; justify-content:center;
  touch-action:none; user-select:none; -webkit-user-select:none;
  -webkit-tap-highlight-color:transparent;
  padding:0.25rem 0.5rem 0.5rem;
}
@media(max-width:639px){ .d-card-area{ min-height:0; } }
@media(min-width:640px){ .d-card-area{ min-height:80vh; } }

/* Center card wrapper */
.d-center {
  position:relative; z-index:10; flex-shrink:0;
  width:100%; max-width:92vw; height:100%; min-height:0;
  transition:transform .34s cubic-bezier(.22,1,.36,1);
  will-change:transform; touch-action:none; user-select:none;
}
@media(min-width:480px){ .d-center{max-width:400px;} }
@media(min-width:768px){ .d-center{max-width:440px;} }
@media(min-width:1024px){ .d-center{max-width:480px;} }
@media(min-width:1440px){ .d-center{max-width:520px;} }

/* Peek cards */
.d-peek {
  position:absolute; top:3%; bottom:3%;
  width:min(280px,43%); border-radius:1.75rem;
  overflow:hidden; z-index:5; pointer-events:none;
  display:none;
  box-shadow:0 12px 36px rgba(0,0,0,0.18);
}
@media(min-width:960px){ .d-peek{display:block;} }
.d-peek-left  { left:0;  transform:rotate(-6deg) translateX(8%); transform-origin:right center; }
.d-peek-right { right:0; transform:rotate(6deg)  translateX(-8%); transform-origin:left center; }
.d-peek-inner { position:relative; width:100%; height:100%; background:#1a0e13; }
.d-peek-img   { width:100%; height:100%; object-fit:cover; object-position:center center; display:block; }
.d-peek-init  { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:2.5rem; font-weight:800; color:#a5697c; background:linear-gradient(135deg,#fdf3f6,#f8e9ee); }
.d-peek-overlay { position:absolute; inset:0; background:linear-gradient(to bottom, rgba(15,7,12,0.1) 0%, rgba(15,7,12,0.6) 60%, rgba(15,7,12,0.92) 100%); }
.d-peek-meta  { position:absolute; bottom:0; left:0; right:0; padding:1.25rem 1rem; }
.d-peek-name  { font-family:var(--font-heading); font-size:1.05rem; font-weight:800; color:white; margin:0 0 0.2rem; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.d-peek-row   { display:flex; align-items:center; gap:0.3rem; font-size:0.6875rem; color:rgba(255,255,255,0.85); margin:0.15rem 0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

/* ── Profile Card ── */
.pc {
  width:100%; height:100%; min-height:0;
  position:relative; border-radius:2rem; overflow:hidden;
  border:1px solid rgba(255,255,255,0.5);
  box-shadow:0 24px 60px rgba(43,16,29,0.28), 0 6px 20px rgba(43,16,29,0.12), inset 0 1px 0 rgba(255,255,255,0.18);
  animation:d-card-enter .36s cubic-bezier(.22,1,.36,1) both;
  background:#1a0e13;
  display:flex; flex-direction:column; justify-content:flex-end;
}
@keyframes d-card-enter        { from { opacity:0; transform:translateY(10px) scale(.985); }                                   to { opacity:1; transform:translateY(0) scale(1); } }
@keyframes d-card-enter-right  { from { opacity:0; transform:translateX(110px) rotate(8deg) scale(.94); }                   to { opacity:1; transform:translateX(0) rotate(0deg) scale(1); } }
@keyframes d-card-enter-left   { from { opacity:0; transform:translateX(-110px) rotate(-8deg) scale(.94); }                  to { opacity:1; transform:translateX(0) rotate(0deg) scale(1); } }
.pc.enter-right { animation:d-card-enter-right .42s cubic-bezier(.22,1,.36,1) both !important; }
.pc.enter-left  { animation:d-card-enter-left  .42s cubic-bezier(.22,1,.36,1) both !important; }

/* Photo — fills entire card */
.pc-photo { position:absolute; inset:0; width:100%; height:100%; z-index:1; overflow:hidden; }
.pc-img   { width:100%; height:100%; object-fit:cover; object-position:center center; display:block; pointer-events:none; -webkit-user-drag:none; user-select:none; }
.pc-init  { width:100%; height:100%; display:flex; align-items:center; justify-content:center; font-size:4rem; font-weight:800; color:rgba(255,255,255,0.7); }

/* Bottom gradient overlay */
.pc-gradient {
  position:absolute; inset:0; z-index:2;
  background:linear-gradient(
    to bottom,
    transparent 0%,
    transparent 35%,
    rgba(15,7,12,0.22) 50%,
    rgba(15,7,12,0.75) 68%,
    rgba(15,7,12,0.96) 90%,
    rgba(15,7,12,0.98) 100%
  );
  pointer-events:none;
}

/* Top badges row */
.pc-top { position:absolute; top:0.875rem; left:0.875rem; right:0.875rem; display:flex; align-items:center; justify-content:space-between; z-index:10; }
.pc-active-badge {
  display:inline-flex; align-items:center; gap:0.35rem;
  background:rgba(255,255,255,0.94); padding:0.32rem 0.8rem; border-radius:9999px;
  font-size:0.625rem; font-weight:700; color:#1a1015;
  box-shadow:0 2px 10px rgba(0,0,0,0.18);
  backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px);
}
.pc-dot { width:0.45rem; height:0.45rem; border-radius:50%; background:#22c55e; flex-shrink:0; box-shadow:0 0 0 2px rgba(34,197,94,0.35); }
.pc-verified-badge {
  display:flex; align-items:center; justify-content:center;
  width:2.125rem; height:2.125rem; border-radius:50%;
  background:linear-gradient(135deg,#e11d48,#be123c); color:white; flex-shrink:0;
  box-shadow:0 3px 10px rgba(225,29,72,0.4);
}
/* Premium badge — crown chip in the top-right cluster */
.pc-premium-badge {
  display:flex; align-items:center; justify-content:center;
  width:2.125rem; height:2.125rem; border-radius:50%;
  background:linear-gradient(135deg,#f6c65b,#d99a2b); color:#5b3a05; flex-shrink:0;
  box-shadow:0 3px 12px rgba(217,154,43,0.5);
  border:1px solid rgba(255,255,255,0.55);
}
/* Premium glow around the whole card */
.pc-premium-ring {
  box-shadow:0 0 0 2px rgba(246,198,91,0.7), 0 0 26px 2px rgba(246,198,91,0.45), 0 18px 45px -14px rgba(0,0,0,0.5);
}
/* Premium pill beside the name */
.pc-name-premium {
  display:inline-flex; align-items:center; gap:0.2rem; margin-left:0.3rem;
  padding:0.14rem 0.45rem; border-radius:9999px;
  background:linear-gradient(135deg,#f6c65b,#d99a2b); color:#4a2f04;
  font-size:0.55rem; font-weight:800; letter-spacing:0.02em; text-transform:uppercase;
  box-shadow:0 2px 6px rgba(160,110,20,0.4), inset 0 1px 0 rgba(255,255,255,0.5);
  flex-shrink:0;
}

/* More button */
.pc-more-btn {
  position:absolute; right:0.875rem; top:3.4rem; z-index:10;
  width:2rem; height:2rem; border-radius:50%;
  border:none; background:rgba(0,0,0,0.35);
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; color:white;
  backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);
  transition:background 0.15s ease;
}
.pc-more-btn:hover { background:rgba(0,0,0,0.55); }

/* Swipe overlay */
.pc-swipe { position:absolute; display:inline-flex; align-items:center; gap:0.375rem; padding:0.4rem 0.875rem; border-radius:9999px; font-size:0.75rem; font-weight:800; color:white; pointer-events:none; z-index:20; box-shadow:0 4px 14px rgba(0,0,0,0.18); top:50%; left:50%; transform:translate(-50%,-50%); background:#e11d48; }

/* Info overlay — bottom of card */
.pc-info {
  position:relative; z-index:10;
  padding:0.75rem 1.15rem 1.15rem;
  display:flex; flex-direction:column; gap:0.25rem;
}
.pc-name-row { display:flex; align-items:center; gap:0.4rem; }
.pc-name-link { text-decoration:none; color:inherit; display:inline-flex; align-items:center; gap:0.15rem; cursor:pointer; }
.pc-name-chevron { flex-shrink:0; opacity:0; transform:translateX(-3px); transition:opacity 0.18s ease, transform 0.18s ease; color:rgba(255,255,255,0.75); }
.pc-name-link:hover .pc-name-chevron { opacity:0.85; transform:translateX(0); }
.pc-name-link:hover .pc-name { text-decoration:underline; text-underline-offset:3px; text-decoration-color:rgba(255,255,255,0.55); }
.pc-name { font-family:var(--font-heading); font-size:1.45rem; font-weight:800; color:white; margin:0; line-height:1.15; letter-spacing:-0.01em; }
.pc-name-verified {
  display:inline-flex; align-items:center; justify-content:center;
  width:1.25rem; height:1.25rem; border-radius:50%;
  background:#e11d48; color:white; flex-shrink:0;
}
.pc-detail { display:flex; align-items:center; gap:0.4rem; font-size:0.75rem; font-weight:500; color:rgba(255,255,255,0.92); margin:0; }
.pc-detail-icon { flex-shrink:0; opacity:0.85; }

.pc-tags { display:flex; flex-wrap:wrap; gap:0.35rem; margin-top:0.35rem; margin-bottom:0.45rem; max-height:2.2rem; overflow:hidden; }
.pc-tag {
  padding:0.25rem 0.65rem; border-radius:9999px;
  background:rgba(255,255,255,0.18); border:1px solid rgba(255,255,255,0.22);
  font-size:0.625rem; font-weight:600; color:white; white-space:nowrap; flex-shrink:0;
  backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px);
}

/* Action buttons inside card at bottom */
.pc-actions {
  display:flex; align-items:center; justify-content:center; gap:1.35rem;
  padding-top:0.35rem;
}
.pc-pass {
  display:flex; align-items:center; justify-content:center;
  width:3.35rem; height:3.35rem; border-radius:50%;
  border:1.5px solid rgba(255,255,255,0.65); background:rgba(255,255,255,0.92); cursor:pointer; color:#5c4e54;
  box-shadow:0 8px 22px rgba(43,16,29,0.20), inset 0 1px 0 rgba(255,255,255,0.9);
  backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
  transition:transform 0.16s ease, box-shadow 0.16s ease, color 0.16s ease; flex-shrink:0;
  -webkit-tap-highlight-color:transparent;
}
.pc-pass:hover { transform:scale(1.08); color:#dc2626; box-shadow:0 12px 28px rgba(43,16,29,0.26); }
.pc-pass:active { transform:scale(0.94); }

.pc-star {
  display:flex; align-items:center; justify-content:center;
  width:3.35rem; height:3.35rem; border-radius:50%;
  border:1.5px solid rgba(255,255,255,0.65); background:rgba(255,255,255,0.92); cursor:pointer; color:#8e3d58;
  box-shadow:0 8px 22px rgba(43,16,29,0.20), inset 0 1px 0 rgba(255,255,255,0.9);
  backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
  transition:transform 0.16s ease, box-shadow 0.16s ease, color 0.16s ease; flex-shrink:0;
  -webkit-tap-highlight-color:transparent;
}
.pc-star:hover { transform:scale(1.08); color:#b64a68; box-shadow:0 12px 28px rgba(43,16,29,0.26); }
.pc-star:active { transform:scale(0.94); }
.pc-star.on    { background:linear-gradient(135deg,#fdf3f6,#f8e6ec); border-color:rgba(182,74,104,0.4); color:#b64a68; }

.pc-heart {
  display:flex; align-items:center; justify-content:center;
  width:4.35rem; height:4.35rem; border-radius:50%;
  border:none; background:linear-gradient(135deg,#e11d48 0%,#b64a68 55%,#8e3d58 100%);
  cursor:pointer; color:white;
  box-shadow:0 12px 30px rgba(225,29,72,0.45), 0 0 0 6px rgba(225,29,72,0.10), inset 0 2px 0 rgba(255,255,255,0.25);
  transition:transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease; flex-shrink:0;
  -webkit-tap-highlight-color:transparent;
}
.pc-heart:hover  { transform:scale(1.08); filter:brightness(1.06); box-shadow:0 16px 38px rgba(225,29,72,0.55), 0 0 0 8px rgba(225,29,72,0.12), inset 0 2px 0 rgba(255,255,255,0.25); }
.pc-heart:active { transform:scale(0.95); }
.pc-heart.sent   { background:linear-gradient(135deg,#702d45,#4a1d30); box-shadow:0 10px 24px rgba(74,29,48,0.4), inset 0 2px 0 rgba(255,255,255,0.12); }

/* Action-buttons entrance — plays each time a new card slides in */
.pc-actions { animation:d-actions-in .55s cubic-bezier(.22,1,.36,1) both .12s; }
@keyframes d-actions-in { from{ opacity:0; transform:translateY(18px); } to{ opacity:1; transform:translateY(0); } }

/* ── Swipe hint — an animated "swipe" affordance below the deck ── */
.d-hint {
  flex-shrink:0; display:flex; align-items:center; justify-content:center; gap:0.6rem;
  font-size:0.8rem; font-weight:800; color:#8e3d58; letter-spacing:0.02em;
  margin:0.125rem 0 0; padding:0.5rem 1.35rem; border-radius:9999px; align-self:center;
  position:relative;
  background:linear-gradient(135deg,#ffffff,#fff3f6);
  border:1.5px solid rgba(182,74,104,0.32);
  box-shadow:0 10px 26px rgba(142,61,88,0.20), inset 0 1px 0 rgba(255,255,255,0.95);
  backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
  animation:d-hint-float 2.6s cubic-bezier(.22,1,.36,1) infinite;
}
.d-hint::after {
  content:''; position:absolute; inset:-7px; border-radius:9999px; z-index:-1;
  background:radial-gradient(closest-side, rgba(225,29,72,0.22), transparent);
  filter:blur(7px); animation:d-hint-glow 2.6s ease-in-out infinite;
}
.d-hint-arrow {
  display:inline-flex; align-items:center; justify-content:center;
  width:1.8rem; height:1.8rem; border-radius:50%; line-height:0;
  background:linear-gradient(135deg,#e11d48 0%,#b64a68 100%); color:#fff;
  font-size:1rem; font-weight:900;
  box-shadow:0 5px 14px rgba(225,29,72,0.45), inset 0 1px 0 rgba(255,255,255,0.35);
}
.d-hint-left  { animation:d-hint-swipe-l 1.9s cubic-bezier(.22,1,.36,1) infinite; }
.d-hint-right { animation:d-hint-swipe-r 1.9s cubic-bezier(.22,1,.36,1) infinite; }
.d-hint-text  { animation:d-hint-text-breath 1.9s ease-in-out infinite; }
.d-hint.leaving {
  opacity:0; max-height:0; padding:0; margin:0; border:0; overflow:hidden;
  transform:translateY(-10px) scale(.92); pointer-events:none; transition:all .5s ease;
}
@keyframes d-hint-float       { 0%,100%{ transform:translateY(0); } 50%{ transform:translateY(-3px); } }
@keyframes d-hint-glow        { 0%,100%{ opacity:.55; transform:scale(.92); } 50%{ opacity:1; transform:scale(1.18); } }
@keyframes d-hint-swipe-l     { 0%,100%{ transform:translateX(0) rotate(0); opacity:1; } 28%{ transform:translateX(-9px) rotate(-10deg); } 60%{ transform:translateX(5px) rotate(0); opacity:.35; } }
@keyframes d-hint-swipe-r     { 0%,100%{ transform:translateX(0) rotate(0); opacity:.35; } 32%{ transform:translateX(-4px) rotate(0); } 66%{ transform:translateX(9px) rotate(10deg); opacity:1; } }
@keyframes d-hint-text-breath { 0%,100%{ opacity:1; } 48%,54%{ opacity:.5; } }

/* ── Right panel ── */
.d-right { display:none; width:15rem; flex-shrink:0; overflow-y:auto; padding-top:0.25rem; scrollbar-width:thin; scrollbar-color:#d9c9c3 transparent; }
@media(min-width:1440px){ .d-right{display:block;} }
@media(min-width:1600px){ .d-right{width:16rem;} }

/* Right panel cards */
.rp { border-radius:1.25rem; background:rgba(255,255,255,0.92); border:1px solid rgba(67,22,39,0.07); padding:0.875rem; box-shadow:0 4px 16px rgba(67,22,39,0.06), inset 0 1px 0 rgba(255,255,255,0.9); margin-bottom:0.625rem; }
.rp-lbl { font-size:0.5rem; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#c0a8b0; margin:0 0 0.5rem; }
.rp-row  { display:flex; align-items:center; justify-content:space-between; }
.rp-num  { font-family:var(--font-heading); font-size:1.125rem; font-weight:800; color:#3c3136; }
.rp-week { font-size:0.5625rem; color:#9a8990; margin:0 0 0.375rem; }

/* Circular progress */
.rp-circ-wrap { display:flex; align-items:flex-start; gap:0.625rem; margin-bottom:0.5rem; }
.rp-circ-text { flex:1; min-width:0; }
.rp-circ-msg  { font-size:0.6875rem; font-weight:700; color:#3c3136; margin:0 0 0.125rem; }
.rp-circ-sub  { font-size:0.5625rem; color:#8a7a80; line-height:1.4; margin:0; }
.rp-complete-btn {
  display:flex; align-items:center; justify-content:center;
  width:100%; height:2.5rem; border-radius:9999px; border:none;
  background:linear-gradient(135deg,#e11d48,#b64a68); color:white;
  font-size:0.6875rem; font-weight:700; letter-spacing:0.01em; cursor:pointer; text-decoration:none;
  box-shadow:0 8px 18px rgba(225,29,72,0.28), inset 0 1px 0 rgba(255,255,255,0.22);
  transition:filter 0.15s ease, transform 0.15s ease; margin-top:0.5rem;
}
.rp-complete-btn:hover { filter:brightness(1.06); transform:translateY(-1px); }
.rp-complete-btn:active { transform:translateY(0) scale(0.98); }

/* Avatars row */
.rp-avatars { display:flex; align-items:center; margin:0.375rem 0; }
.rp-avatar { width:2.125rem; height:2.125rem; border-radius:50%; border:2px solid white; overflow:hidden; background:#f8eef1; margin-left:-0.5rem; flex-shrink:0; }
.rp-avatar:first-child { margin-left:0; }
.rp-avatar img { width:100%; height:100%; object-fit:cover; }
.rp-avatar-more { display:flex; align-items:center; justify-content:center; font-size:0.625rem; font-weight:800; color:#e11d48; background:#fdf3f6; }
.rp-badge { display:inline-flex; align-items:center; justify-content:center; min-width:1.25rem; height:1.25rem; padding:0 0.3rem; border-radius:9999px; background:#8e3d58; color:white; font-size:0.5rem; font-weight:700; }
.rp-link  { display:inline-flex; align-items:center; gap:0.2rem; font-size:0.5625rem; font-weight:800; color:#b64a68; text-decoration:none; margin-top:0.25rem; }
.rp-link:hover { color:#8e3d58; }

.rp-title-bold { font-family:var(--font-heading); font-size:0.95rem; font-weight:800; color:#1a1015; margin:0; display:flex; align-items:center; gap:0.4rem; }
.rp-num-bold { font-family:var(--font-heading); font-size:1.15rem; font-weight:800; color:#1a1015; }
.rp-sub-text { font-size:0.7rem; font-weight:500; color:#776a6f; margin:0.35rem 0 0.85rem 0; }
.rp-view-btn {
  display:flex; align-items:center; justify-content:center;
  width:100%; padding:0.65rem; border-radius:9999px;
  background:linear-gradient(135deg,#fdf3f6,#f9e4eb); color:#b61e46;
  font-size:0.75rem; font-weight:800; text-decoration:none;
  margin-top:1rem; border:1px solid rgba(182,74,104,0.18);
  transition:all 0.18s ease;
}
.rp-view-btn:hover { border-color:rgba(182,74,104,0.4); transform:translateY(-1px); box-shadow:0 6px 14px rgba(142,61,88,0.14); }

/* Premium card */
.rp-prem { position:relative; overflow:hidden; border-radius:1.25rem; border:1px solid rgba(217,179,108,0.32); background:radial-gradient(12rem 8rem at 100% 0%, rgba(217,179,108,0.16), transparent 60%), linear-gradient(135deg,#fffaf3 0%,#fdf1f5 100%); padding:0.875rem; margin-bottom:0.625rem; box-shadow:0 4px 16px rgba(67,22,39,0.06), inset 0 1px 0 rgba(255,255,255,0.9); }
.rp-prem-title { font-family:var(--font-heading); font-size:0.875rem; font-weight:800; color:#3c3136; margin:0.375rem 0 0.125rem; }
.rp-prem-sub   { font-size:0.5625rem; color:#8a7a80; margin:0; }
.rp-prem-link  { display:inline-flex; align-items:center; gap:0.2rem; font-size:0.625rem; font-weight:800; color:#b64a68; text-decoration:none; margin-top:0.375rem; }
.rp-upgrade-btn {
  display:flex; align-items:center; justify-content:center; gap:0.25rem;
  width:100%; margin-top:0.625rem; padding:0.55rem; border-radius:9999px;
  border:none; background:linear-gradient(135deg,#b64a68,#8e3d58); color:white;
  font-size:0.625rem; font-weight:700; letter-spacing:0.02em; cursor:pointer; text-decoration:none;
  transition:filter 0.15s, transform 0.15s; box-shadow:0 6px 16px rgba(142,61,88,0.32), inset 0 1px 0 rgba(255,255,255,0.2);
}
.rp-upgrade-btn:hover { filter:brightness(1.06); transform:translateY(-1px); }
.rp-upgrade-btn:active { transform:translateY(0) scale(0.98); }

/* Safety */
.rp-safety-row { display:flex; align-items:center; gap:0.375rem; margin-top:0.3rem; }

/* ── Filter dialog ── */
.d-fd-back { position:fixed; inset:0; z-index:80; display:flex; align-items:flex-end; justify-content:center; background:rgba(32,17,26,0.5); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }
@media(min-width:768px){ .d-fd-back{align-items:center;} }
.d-fd-sheet { width:100%; background:white; border-radius:1.75rem 1.75rem 0 0; max-height:90vh; overflow-y:auto; padding-bottom:max(1.5rem,env(safe-area-inset-bottom)); box-shadow:0 -12px 48px rgba(43,16,29,0.28); }
@media(min-width:768px){ .d-fd-sheet{border-radius:1.75rem; max-width:28rem; max-height:88vh; box-shadow:0 32px 72px rgba(43,16,29,0.32); border:1px solid rgba(255,255,255,0.6); } }
.d-fd-handle { display:flex; justify-content:center; padding:0.75rem 0 0.25rem; }
.d-fd-handle span { width:2.5rem; height:4px; border-radius:9999px; background:#e4d8d3; display:block; }
@media(min-width:768px){ .d-fd-handle{display:none;} }
.d-fd-inner  { padding:1rem 1.25rem; }
.d-fd-head   { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.125rem; }
.d-fd-title  { font-family:var(--font-heading); font-size:1rem; font-weight:800; color:#2c2928; margin:0; display:flex; align-items:center; gap:0.5rem; }
.d-fd-close  { width:2rem; height:2rem; border-radius:50%; border:none; background:transparent; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#8a7a80; transition:background 0.15s ease; }
.d-fd-close:hover { background:#f8eef1; color:#8e3d58; }
.d-fd-lbl    { display:block; font-size:0.5rem; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#9a8a90; margin:0.875rem 0 0.375rem; }
.d-fd-field  { width:100%; border-radius:0.85rem; border:1.5px solid #eadfd9; background:#faf6f3; padding:0.625rem 0.85rem; font-size:0.8125rem; color:#4c4145; outline:none; transition:border-color 0.18s, box-shadow 0.18s, background 0.18s; box-sizing:border-box; }
.d-fd-field:focus { border-color:#b64a68; background:white; box-shadow:0 0 0 3px rgba(182,74,104,0.12); }
.d-fd-grid   { display:grid; grid-template-columns:1fr 1fr; gap:0.625rem; }
.d-fd-foot   { display:flex; gap:0.625rem; margin-top:1.125rem; padding-top:0.75rem; border-top:1px solid #f0e7ea; }
.d-fd-reset  { display:inline-flex; align-items:center; gap:0.375rem; height:2.75rem; padding:0 1.1rem; border-radius:9999px; border:1.5px solid #eadfd9; background:white; font-size:0.75rem; font-weight:700; color:#6f5f66; cursor:pointer; flex-shrink:0; transition:border-color 0.18s, color 0.18s; }
.d-fd-reset:hover { border-color:rgba(182,74,104,0.45); color:#8e3d58; }
.d-fd-apply  { flex:1; height:2.75rem; border-radius:9999px; border:none; background:linear-gradient(135deg,#e11d48 0%,#b64a68 55%,#8e3d58 100%); color:white; font-size:0.75rem; font-weight:700; letter-spacing:0.02em; cursor:pointer; box-shadow:0 8px 20px rgba(225,29,72,0.28), inset 0 1px 0 rgba(255,255,255,0.22); transition:filter 0.15s, transform 0.15s; }
.d-fd-apply:hover { filter:brightness(1.06); transform:translateY(-1px); }
.d-fd-apply:active { transform:translateY(0) scale(0.98); }
.d-toggle-row { display:flex; align-items:center; justify-content:space-between; border-radius:0.85rem; border:1.5px solid #efe3e6; padding:0.625rem 0.75rem; cursor:pointer; background:#faf6f3; width:100%; margin-top:0.375rem; transition:border-color 0.18s; }
.d-toggle-row:hover { border-color:rgba(182,74,104,0.3); }
.d-toggle-lbl { font-size:0.75rem; font-weight:600; color:#5c4e54; }
.d-toggle-track { position:relative; width:2.25rem; height:1.25rem; border-radius:9999px; transition:background 0.18s; flex-shrink:0; }
.d-toggle-thumb { position:absolute; top:0.125rem; height:1rem; width:1rem; border-radius:50%; background:white; box-shadow:0 1px 3px rgba(0,0,0,0.18); transition:transform 0.18s; }

/* ── More menu ── */
.d-more-menu { position:absolute; right:0.75rem; top:3rem; z-index:30; width:13rem; border-radius:1.25rem; background:rgba(255,255,255,0.97); border:1px solid rgba(67,22,39,0.08); box-shadow:0 20px 48px rgba(43,16,29,0.20), inset 0 1px 0 rgba(255,255,255,0.9); overflow:hidden; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); }
.d-more-item { display:flex; align-items:center; gap:0.625rem; width:100%; padding:0.625rem 1rem; font-size:0.75rem; font-weight:600; color:#5c4e54; background:none; border:none; cursor:pointer; transition:background 0.15s, color 0.15s; text-align:left; }
.d-more-item:hover { background:#fdf3f6; color:#8e3d58; }
.d-more-item svg { color:#a5697c; flex-shrink:0; }
.d-more-item:hover svg { color:#8e3d58; }

/* ── Skeleton ── */
.d-skel { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:20; }
.d-skel-card { width:100%; max-width:360px; height:100%; border-radius:1.5rem; border:1px solid #f0e7ea; background:white; overflow:hidden; }
.d-skel-photo { height:60%; background:linear-gradient(90deg,#f6ecef 25%,#fdf3f6 50%,#f6ecef 75%); background-size:200% 100%; animation:shimmer 1.6s infinite; }
.d-skel-body  { padding:0.875rem; }
.d-skel-line  { border-radius:9999px; background:linear-gradient(90deg,#f6ecef 25%,#fdf3f6 50%,#f6ecef 75%); background-size:200% 100%; animation:shimmer 1.6s infinite; margin-bottom:0.5rem; }
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* ── State screens ── */
.d-state { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.75rem; padding:1.5rem; text-align:center; }
.d-state-icon  { width:4.5rem; height:4.5rem; border-radius:1.5rem; background:linear-gradient(135deg,#fdf3f6,#f8e6ec); border:1px solid rgba(182,74,104,0.18); box-shadow:0 10px 24px rgba(142,61,88,0.14); display:flex; align-items:center; justify-content:center; }
.d-state-title { font-family:var(--font-heading); font-size:1rem; font-weight:800; color:#3c3136; margin:0; }
.d-state-sub   { font-size:0.75rem; color:#8a7a80; max-width:22rem; line-height:1.55; margin:0; }
.d-state-btn   { padding:0.6rem 1.5rem; border-radius:9999px; border:none; background:linear-gradient(135deg,#b64a68,#8e3d58); color:white; font-size:0.75rem; font-weight:700; letter-spacing:0.01em; cursor:pointer; box-shadow:0 8px 18px rgba(142,61,88,0.28), inset 0 1px 0 rgba(255,255,255,0.18); transition:filter 0.15s, transform 0.15s; }
.d-state-btn:hover { filter:brightness(1.06); transform:translateY(-1px); }
.d-state-actions { display:flex; align-items:center; justify-content:center; gap:0.625rem; flex-wrap:wrap; margin-top:0.25rem; }
.d-state-btn-ghost { background:#fff; color:#8e3d58; border:1.5px solid rgba(182,74,104,0.3); box-shadow:none; }
.d-state-btn-ghost:hover { background:#fdf3f6; filter:none; transform:translateY(-1px); }
.d-state-spin { width:2.75rem; height:2.75rem; border-radius:50%; border:3px solid #f3dbe3; border-top-color:#e11d48; animation:d-spin .8s linear infinite; }
@keyframes d-spin { to { transform:rotate(360deg); } }

/* ── Mobile immersive swipe deck (Tinder-style) ── */
@media(max-width:639px){
  .d-hint    { font-size:0.6875rem; padding:0.35rem 0.9rem; margin-top:0.125rem; }
  /* Deck fills the remaining space so the photo stretches edge-to-edge even
     after the swipe hint collapses (no empty bottom gap). */
  .d-card-area { min-height:0; max-height:none; }
  .d-center  { width:100%; max-width:none; }
  /* Full-bleed photo, gently biased toward the face for nicer crops */
  .pc-photo  { width:100%; height:100%; }
  .pc-img    { object-position:center 20%; }
  /* Redesigned floating glass info panel */
  .pc-info {
    margin:0 0.5rem max(0.625rem, env(safe-area-inset-bottom)) 0.5rem;
    padding:0.875rem 1rem 0.75rem;
    border-radius:1.375rem;
    background:transparent;
  }
  /* Softer gradient behind the glass sheet */
  .pc-gradient { background:linear-gradient(to bottom, transparent 0%, transparent 45%, rgba(15,7,12,0.30) 60%, rgba(15,7,12,0.62) 80%, rgba(15,7,12,0.88) 100%); }
  /* Bigger, friendlier touch targets */
  .pc-pass, .pc-star { width:3.5rem; height:3.5rem; }
  .pc-heart { width:4.5rem; height:4.5rem; }
  .pc-name   { font-size:1.375rem; }
}
@media(max-width:479px){
  .d-title { font-size:1.35rem; }
}
`;

/* ─────────────────────────── CircularProgress ─────────────────────────── */

function CircularProgress({ value }: { value: number }) {
  const r = 26, circ = 2 * Math.PI * r;
  const offset = circ - Math.min(1, value / 100) * circ;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" style={{ flexShrink: 0 }}>
      <circle cx="34" cy="34" r={r} fill="none" stroke="#f2e9e5" strokeWidth="5" />
      <circle cx="34" cy="34" r={r} fill="none" stroke="url(#pgrd)" strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform="rotate(-90 34 34)" />
      <defs>
        <linearGradient id="pgrd" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#e11d48" />
          <stop offset="100%" stopColor="#b64a68" />
        </linearGradient>
      </defs>
      <text x="34" y="38" textAnchor="middle" fontSize="11" fontWeight="800" fill="#3c3136">{value}%</text>
    </svg>
  );
}

/* ─────────────────────────────── PeekCard ─────────────────────────────── */

function PeekCard({ profile, side }: { profile: Profile; side: 'left' | 'right' }) {
  const photo = visiblePhoto(profile);
  const location = useful(profile.location);
  const job = useful(profile.occupation);
  return (
    <div className={`d-peek d-peek-${side}`}>
      <div className="d-peek-inner">
        {photo
          ? <SmartImage src={photo} alt={profile.name || ''} sizes="28vw" aspectRatio="none" shape="none" className="d-peek-img w-full h-full" />
          : <div className="d-peek-init">{initials(profile.name)}</div>
        }
        <div className="d-peek-overlay" />
        <div className="d-peek-meta">
          <p className="d-peek-name">{profile.name}{profile.age ? `, ${profile.age}` : ''}</p>
          {location && <p className="d-peek-row"><MapPin size={10} strokeWidth={2.2} style={{ flexShrink: 0 }} /> {location}</p>}
          {job && <p className="d-peek-row"><Briefcase size={10} strokeWidth={2.2} style={{ flexShrink: 0 }} /> {job}</p>}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── ProfileCard ─────────────────────────────── */

function ProfileCard({
  profile, interested, shortlisted,
  onInterest, onShortlist, onPass, onMore,
  dragOffset, enterFrom,
}: {
  profile: Profile; interested: boolean; shortlisted: boolean;
  onInterest(id: string): void; onShortlist(id: string): void;
  onPass(id: string): void; onMore(id: string): void;
  dragOffset?: { x: number; y: number; dragging: boolean };
  enterFrom?: 'left' | 'right' | '';
}) {
  const photo = visiblePhoto(profile);
  const location = useful(profile.location);
  const job = useful(profile.occupation);
  const education = useful(profile.education);
  const marital = useful(profile.maritalStatus);
  const religion = useful(profile.religion);
  const motherTongue = useful(profile.motherTongue);
  const anyProfile = profile as unknown as Record<string, unknown>;
  const height = useful(anyProfile.height as string);
  const diet = useful(anyProfile.diet_preference as string)
    || useful(anyProfile.dietary_preference as string);
  const hobby = (() => {
    const h = anyProfile.hobbies;
    if (Array.isArray(h) && h.length) return String(h[0]);
    if (typeof h === 'string' && h.trim()) return h.split(',')[0]?.trim();
    return null;
  })();

  // Tag pills: up to 4 items
  const allTags = [height, diet, religion, motherTongue, hobby].filter((t): t is string => !!t);
  const shown = allTags.slice(0, 4);
  const extra = allTags.length - shown.length;

  const swipeU = dragOffset && dragOffset.y < -75 && Math.abs(dragOffset.y) > Math.abs(dragOffset.x);

  const enterClass = enterFrom === 'right' ? 'enter-right' : enterFrom === 'left' ? 'enter-left' : '';
  return (
    <article className={`pc ${enterClass} ${profile.premium ? 'pc-premium-ring' : ''}`.trim()}>
      {/* Full-bleed photo */}
      <div className="pc-photo">
        {photo
          ? <SmartImage src={photo} alt={profile.name || 'Member'} priority sizes="(max-width:767px) 100vw,45vw" aspectRatio="none" shape="none" className="pc-img w-full h-full" />
          : <div className="pc-init">{initials(profile.name)}</div>
        }
      </div>

      {/* Dark gradient overlay */}
      <div className="pc-gradient" />

      {/* Swipe feedback */}
      {swipeU && <div className="pc-swipe"><Eye size={12} /> View Profile</div>}

      {/* Top badges */}
      <div className="pc-top">
        <span className="pc-active-badge">
          <span className="pc-dot" />
          Online
        </span>
        <div className="flex items-center gap-1.5">
          {profile.premium && (
            <span className="pc-premium-badge">
              <Crown size={13} fill="currentColor" strokeWidth={1.4} />
            </span>
          )}
          {profile.verified && (
            <span className="pc-verified-badge"><ShieldCheck size={16} strokeWidth={2.5} /></span>
          )}
        </div>
      </div>

      {/* More button */}
      <button type="button" className="pc-more-btn" onClick={() => onMore(profile.id)} aria-label="More options">
        <MoreHorizontal size={16} />
      </button>

      {/* Info overlay at bottom */}
      <div className="pc-info">
        <div className="pc-name-row">
          <Link href={profileHref(profile)} className="pc-name-link" aria-label={`View ${profile.name || 'profile'}'s profile`}>
            <h2 className="pc-name">{profile.name}{profile.age ? `, ${profile.age}` : ''}</h2>
            <ChevronRight size={16} className="pc-name-chevron" />
          </Link>
          {profile.verified && (
            <span className="pc-name-verified" style={{ marginLeft: '0.375rem' }}><Check size={11} strokeWidth={3.5} /></span>
          )}
          {profile.premium && (
            <span className="pc-name-premium"><Crown size={11} fill="currentColor" strokeWidth={1.4} /> Premium</span>
          )}
        </div>

        {location && (
          <p className="pc-detail"><MapPin size={13} strokeWidth={2.2} className="pc-detail-icon text-rose-400" /> {location}</p>
        )}
        {job && (
          <p className="pc-detail"><Briefcase size={13} strokeWidth={2.2} className="pc-detail-icon" /> {job}</p>
        )}
        {(education || marital) && (
          <p className="pc-detail"><GraduationCap size={13} strokeWidth={2.2} className="pc-detail-icon" /> {education}{education && marital ? ' • ' : ''}{marital}</p>
        )}

        {shown.length > 0 && (
          <div className="pc-tags">
            {shown.map(t => <span key={t} className="pc-tag">{t}</span>)}
            {extra > 0 && <span className="pc-tag">+{extra}</span>}
          </div>
        )}

        {/* Action buttons inside card */}
        <div className="pc-actions">
          <button type="button" className="pc-pass" onClick={() => onPass(profile.id)} aria-label="Pass">
            <X size={22} strokeWidth={2.5} />
          </button>
          <button type="button" className={`pc-heart ${interested ? 'sent' : ''}`} onClick={() => onInterest(profile.id)} aria-label="Send Interest">
            <Heart size={28} fill="white" strokeWidth={0} />
          </button>
          <button type="button" className={`pc-star ${shortlisted ? 'on' : ''}`} onClick={() => onShortlist(profile.id)} aria-label="Shortlist">
            <Star size={22} fill={shortlisted ? '#e11d48' : 'none'} strokeWidth={shortlisted ? 0 : 2.2} />
          </button>
        </div>
      </div>
    </article>
  );
}

/* ─────────────────────────────── MoreMenu ─────────────────────────────── */

function MoreMenu({ id, onClose, onBlock, onReport, onHide }: {
  id: string; onClose(): void;
  onBlock(id: string): void; onReport(id: string): void; onHide(id: string): void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const off = (e: MouseEvent | TouchEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', off);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerdown', off); window.removeEventListener('keydown', key); };
  }, [onClose]);
  return (
    <div ref={ref} className="d-more-menu">
      {([
        { icon: EyeOff, label: 'Hide profile', action: () => onHide(id) },
        { icon: Ban, label: 'Block profile', action: () => onBlock(id) },
        { icon: Flag, label: 'Report profile', action: () => onReport(id) },
      ] as const).map(({ icon: Icon, label, action }) => (
        <button key={label} type="button" className="d-more-item" onClick={() => { onClose(); action(); }}>
          <Icon size={14} /> {label}
        </button>
      ))}
    </div>
  );
}

/* ─────────────────────────────── Toggle ─────────────────────────────── */

function Toggle({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <button type="button" className="d-toggle-row" onClick={() => onChange(!checked)}>
      <span className="d-toggle-lbl">{label}</span>
      <span className="d-toggle-track" style={{ background: checked ? '#8e3d58' : '#e4d8d3' }}>
        <span className="d-toggle-thumb" style={{ transform: checked ? 'translateX(1rem)' : 'translateX(0.125rem)' }} />
      </span>
    </button>
  );
}

/* ─────────────────────────────── FilterDialog ─────────────────────────────── */

function FilterDialog({ open, onClose, filters, onApply, onReset }: {
  open: boolean; onClose(): void; filters: Filters;
  onApply(f: Filters): void; onReset(): void;
}) {
  const [draft, setDraft] = useState<Filters>(filters);
  useEffect(() => setDraft(filters), [filters, open]);
  if (!open) return null;

  const fields = [
    { key: 'religion', label: 'Religion', opts: ['', 'Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist'] },
    { key: 'motherTongue', label: 'Mother Tongue', opts: ['', 'Hindi', 'Telugu', 'Tamil', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Punjabi', 'Gujarati'] },
    { key: 'education', label: 'Education', opts: ['', 'B.Tech', 'M.Tech', 'MBA', 'MBBS', 'B.Sc', 'M.Sc', 'B.Com', 'PhD', 'B.A', 'M.A'] },
    { key: 'occupation', label: 'Profession', opts: ['', 'Software Engineer', 'Doctor', 'Teacher', 'Banker', 'Architect', 'Business Owner', 'Lawyer', 'Chartered Accountant'] },
    { key: 'maritalStatus', label: 'Marital Status', opts: ['', 'Never Married', 'Divorced', 'Widowed', 'Separated'] },
  ] as { key: keyof Filters; label: string; opts: string[] }[];

  return (
    <div className="d-fd-back" onClick={onClose}>
      <div className="d-fd-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal aria-label="Filter members">
        <div className="d-fd-handle"><span /></div>
        <div className="d-fd-inner">
          <div className="d-fd-head">
            <h2 className="d-fd-title"><SlidersHorizontal size={16} color="#8e3d58" /> Refine Matches</h2>
            <button type="button" className="d-fd-close" onClick={onClose} aria-label="Close"><X size={17} /></button>
          </div>

          <label className="d-fd-lbl">Age Range</label>
          <div className="d-fd-grid">
            <input type="number" className="d-fd-field" placeholder="Min age" value={draft.ageMin} min={18} max={99} aria-label="Min age" onChange={e => setDraft({ ...draft, ageMin: Number(e.target.value) || 18 })} />
            <input type="number" className="d-fd-field" placeholder="Max age" value={draft.ageMax} min={18} max={99} aria-label="Max age" onChange={e => setDraft({ ...draft, ageMax: Number(e.target.value) || 99 })} />
          </div>

          {fields.map(({ key, label, opts }) => (
            <div key={key}>
              <label className="d-fd-lbl">{label}</label>
              <select className="d-fd-field" aria-label={label} value={String(draft[key] ?? '')} onChange={e => setDraft({ ...draft, [key]: e.target.value })}>
                {opts.map(o => <option key={o || '__any'} value={o}>{o || 'Any'}</option>)}
              </select>
            </div>
          ))}

          <div style={{ marginTop: '0.5rem' }}>
            <Toggle checked={draft.showVerifiedOnly} onChange={v => setDraft({ ...draft, showVerifiedOnly: v })} label="Verified profiles only" />
            <Toggle checked={draft.recentOnly} onChange={v => setDraft({ ...draft, recentOnly: v })} label="Recently active members" />
          </div>

          <div className="d-fd-foot">
            <button type="button" className="d-fd-reset" onClick={() => { onReset(); onClose(); }}><RotateCcw size={13} /> Reset</button>
            <button type="button" className="d-fd-apply" onClick={() => { onApply(draft); onClose(); }}>Apply Filters</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── RightPanel ─────────────────────────────── */

function RightPanel({ completion, visitors, matches, isPremium, planName }: {
  completion: number; isPremium: boolean; planName: string;
  visitors: { count: number; photos: string[] };
  matches: { count: number; photos: string[] };
}) {
  const completionMsg = completion >= 90 ? 'Almost done!' : completion >= 70 ? 'Almost there!' : 'Looking good!';

  return (
    <div>
      {/* Completion */}
      <div className="rp">
        <p className="rp-lbl">Profile Completion</p>
        <div className="rp-circ-wrap">
          <CircularProgress value={completion} />
          <div className="rp-circ-text">
            <p className="rp-circ-msg">{completionMsg}</p>
            <p className="rp-circ-sub">Complete your profile to get more matches.</p>
          </div>
        </div>
        <Link href="/profile/edit" className="rp-complete-btn">Complete Profile</Link>
      </div>

      {/* Visitors */}
      <div className="rp">
        <div className="rp-row">
          <h3 className="rp-title-bold">Profile Visitors</h3>
          <span className="rp-num-bold">{visitors.count}</span>
        </div>
        <p className="rp-sub-text">See who recently viewed your profile.</p>

        {visitors.count > 0 && (
          <div className="rp-avatars">
            {visitors.photos.slice(0, 4).map((src, i) => (
              <div key={i} className="rp-avatar"><SmartImage src={src} alt="Visitor" className="w-full h-full object-cover" /></div>
            ))}
            {visitors.count > 4 && <div className="rp-avatar rp-avatar-more">+{visitors.count - 4}</div>}
          </div>
        )}
        <Link href="/visitors" className="rp-view-btn">View All Visitors</Link>
      </div>

      {/* New Matches */}
      <div className="rp">
        <div className="rp-row">
          <h3 className="rp-title-bold"><Heart size={16} color="#e11d48" fill="#e11d48" /> Matches</h3>
          <span className="rp-num-bold">{matches.count}</span>
        </div>
        <p className="rp-sub-text">New members waiting to connect.</p>

        {matches.count > 0 && (
          <div className="rp-avatars">
            {matches.photos.slice(0, 4).map((src, i) => (
              <div key={i} className="rp-avatar"><SmartImage src={src} alt="Match" className="w-full h-full object-cover" /></div>
            ))}
            {matches.count > 4 && <div className="rp-avatar rp-avatar-more">+{matches.count - 4}</div>}
          </div>
        )}
        <Link href="/interests/received" className="rp-view-btn">View All Matches</Link>
      </div>

      {/* Membership */}
      <div className="rp-prem">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Crown size={14} color={isPremium ? '#c08b2a' : '#b99aa7'} />
          <p className="rp-lbl" style={{ margin: 0 }}>{isPremium ? "You're Premium" : "Go Premium"}</p>
        </div>
        <p className="rp-prem-title">{planName}</p>
        {isPremium
          ? <>
            <p className="rp-prem-sub">Valid till Aug 2026</p>
            <Link href="/membership" className="rp-prem-link">View Benefits <ChevronRight size={10} /></Link>
          </>
          : <>
            <p className="rp-prem-sub">Unlock unlimited messages, profile views and more.</p>
            <Link href="/membership" className="rp-upgrade-btn">Upgrade Now <ArrowRight size={11} /></Link>
          </>
        }
      </div>

      {/* Safety */}
      <div className="rp" style={{ background: '#fffafb', border: '1px solid #f0e6e8' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <ShieldCheck size={14} color="#0f9d6b" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#4e4347', margin: '0 0 0.375rem' }}>Safety &amp; Verification</p>
            {['Profile Verified', 'Photo Verified', 'ID Verified'].map(item => (
              <div key={item} className="rp-safety-row">
                <CheckCircle2 size={11} color="#0f9d6b" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '0.625rem', color: '#6f5f66' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Skeleton ─────────────────────────────── */

function Skeleton() {
  return (
    <div className="d-skel">
      <div className="d-skel-card">
        <div className="d-skel-photo" />
        <div className="d-skel-body">
          <div className="d-skel-line" style={{ height: 20, width: '55%' }} />
          <div className="d-skel-line" style={{ height: 14, width: '70%' }} />
          <div className="d-skel-line" style={{ height: 14, width: '60%' }} />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Constants ─────────────────────────────── */

/* ─────────────────────────────── Main ─────────────────────────────── */

export function PremiumDiscover() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [focusVersion, setFocusVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [idx, setIdx] = useState(0);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [tab, setTab] = useState<FeedTab>('all');
  const [filterOpen, setFilter] = useState(false);
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0, dragging: false });
  const [fling, setFling] = useState<'left' | 'right' | ''>('');
  const flingRef = useRef<'left' | 'right' | ''>('');
  const [hintGone, setHintGone] = useState(false);
  const [enterFrom, setEnterFrom] = useState<'left' | 'right' | ''>('');
  const [, bump] = useState(0);
  const interested = useRef(new Set<string>());
  const shortlisted = useRef(new Set<string>());
  const hidden = useRef(loadDismissedIds());
  const ptrRef = useRef<{ x: number; y: number } | null>(null);
  const [visitors, setVisitors] = useState<{ count: number; photos: string[] }>({ count: 0, photos: [] });
  const [matches, setMatches] = useState<{ count: number; photos: string[] }>({ count: 0, photos: [] });

  const dismissProfile = useCallback((id: string) => {
    hidden.current.add(id);
    saveDismissedIds(hidden.current);
    bump(n => n + 1);
  }, []);

  /* ── Load profiles ── */
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        setLoading(true); setError('');
        const d = await getProfiles({ page_size: '12', ordering: '-created_at' });
        if (!live) return;
        setProfiles(d.results); setPage(1); setHasMore(d.next !== null);
      } catch (e: unknown) { if (live) setError(e instanceof Error ? e.message : 'Could not load profiles.'); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [focusVersion]);

  /* Refresh the deck when the tab regains focus — newly created profiles
     then appear even if the dashboard was left open in another tab. */
  useEffect(() => {
    const refresh = () => setFocusVersion((n) => n + 1);
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  /* ── Companion data ── */
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [vd, incoming, outgoing, shortlists] = await Promise.all([
          fetchApi<unknown>('/profile-visitors/').catch(() => null),
          fetchApi<unknown>('/interests/?type=incoming').catch(() => null),
          getInterests('outgoing').catch(() => []),
          getShortlists().catch(() => ({ count: 0, results: [] })),
        ]);
        if (!live) return;

        const vs = Array.isArray((vd as { results?: unknown[] })?.results) ? (vd as { results: unknown[] }).results : (Array.isArray(vd) ? vd : []);
        setVisitors({ count: vs.length, photos: vs.map((v) => extractPhoto(v)).filter(Boolean) });

        const rs = Array.isArray((incoming as { results?: unknown[] })?.results) ? (incoming as { results: unknown[] }).results : (Array.isArray(incoming) ? incoming : []);
        setMatches({ count: rs.length, photos: rs.map((r) => extractPhoto(r)).filter(Boolean) });

        for (const interest of outgoing ?? []) {
          const receiverId = interest?.receiver?.id || interest?.receiver?.user_id || interest?.receiver_id;
          if (receiverId) {
            interested.current.add(String(receiverId));
            hidden.current.add(String(receiverId));
          }
        }
        for (const profile of shortlists.results ?? []) {
          if (profile.id) shortlisted.current.add(profile.id);
        }
        saveDismissedIds(hidden.current);
        bump(n => n + 1);
      } catch { /* best-effort */ }
    })();
    return () => { live = false; };
  }, []);

  /* ── Deck ── */
  const deck = useMemo(() =>
    profiles.filter(p => !hidden.current.has(p.id)).filter(p => matchesFilters(p, filters, tab)),
    [profiles, filters, tab, bump]
  );

  useEffect(() => {
    if (idx >= deck.length && deck.length > 0) setIdx(deck.length - 1);
    else if (deck.length === 0) setIdx(0);
  }, [deck.length, idx]);

  const appendMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const np = page + 1;
      const d = await getProfiles({ page: String(np), page_size: '12', ordering: '-created_at' });
      setPage(np); setProfiles(cur => [...cur, ...d.results]); setHasMore(d.next !== null);
    } catch (e: unknown) { showToast(e instanceof Error ? e.message : 'Could not load more.', 'error'); }
    finally { setLoading(false); }
  }, [page, loading, hasMore, showToast]);

  const next = useCallback(() => {
    if (idx < deck.length - 1) setIdx(i => i + 1);
    else if (hasMore) void appendMore();
  }, [idx, deck.length, hasMore, appendMore]);

  /* Auto-refill the deck when the loaded page is empty but more pages exist on
     the server (e.g. every card on the current page was already swiped / liked /
     shortlisted / hidden / filtered out). Without this the user would get stuck
     on "all caught up" while fresh, eligible profiles remain on later pages. */
  useEffect(() => {
    if (loading || !hasMore || deck.length > 0) return;
    void appendMore();
    // Re-runs whenever profiles change: if the appended page is also fully
    // filtered out, it keeps fetching the next page until a card appears or
    // hasMore runs out.
  }, [deck.length, hasMore, loading, appendMore]);

  /* ── Actions ── */
  const handleInterest = useCallback(async (id: string) => {
    if (busyId) return; setBusyId(id);
    try {
      await sendInterest(id);
      interested.current.add(id);
      dismissProfile(id);
      showToast('Interest sent! 💕', 'success');
      next();
    } catch (e: unknown) {
      if (/already/i.test(String(e))) {
        interested.current.add(id);
        dismissProfile(id);
        showToast('Interest already sent.', 'success');
        next();
      } else {
        showToast('Could not send interest.', 'error');
      }
    }
    finally { setBusyId(null); }
  }, [busyId, next, showToast, dismissProfile]);

  const handleShortlist = useCallback(async (id: string) => {
    try {
      const r = await toggleShortlist(id);
      if (r.shortlisted) shortlisted.current.add(id); else shortlisted.current.delete(id);
      bump(n => n + 1);
      showToast(r.action === 'added' ? 'Added to shortlist ⭐' : 'Removed from shortlist', 'success');
    } catch { showToast('Shortlist could not be updated.', 'error'); }
  }, [showToast]);

  const handlePass = useCallback((id: string) => {
    dismissProfile(id);
    next();
  }, [next, dismissProfile]);

  /* Buttons = actions: fling the card fully off-screen, then commit the action */
  const ringSwipe = useCallback((id: string, dir: 'left' | 'right') => {
    if (flingRef.current) return;
    flingRef.current = dir;
    setFling(dir);
    // Let the fly-off play, then run the action (which advances). The idx-effect
    // clears fling on advance so the incoming card plays its enter animation.
    window.setTimeout(() => {
      if (dir === 'right') void handleInterest(id);
      else handlePass(id);
    }, 360);
  }, [handleInterest, handlePass]);

  /* Swipe = navigation only — advance without sending interest/pass */
  const ringNext = useCallback((dir: 'left' | 'right') => {
    if (flingRef.current) return;
    if (!hintGone) setHintGone(true);
    flingRef.current = dir;
    setFling(dir);
    // Set enter direction BEFORE next() so new card mounts with correct animation
    setEnterFrom(dir);
    // Let the current card fly off-screen fully, THEN advance. Advancing in the
    // same tick as a fling-reset would unmount the card before the fly-off
    // transition renders, which is exactly why the swipe animation was missing.
    window.setTimeout(() => {
      next();
    }, 360);
  }, [next, hintGone]);

  /* When the active card advances, clear the fling state so the incoming card
     never inherits the fly-off offset (it plays its own enter animation). */
  useEffect(() => { setFling(''); flingRef.current = ''; }, [idx]);

  const handleHide = useCallback((id: string) => {
    dismissProfile(id);
    showToast('Profile hidden.', 'success');
    next();
  }, [next, showToast, dismissProfile]);

  const handleBlock = useCallback(async (id: string) => {
    dismissProfile(id);
    try { await fetchApi('/blocks/', { method: 'POST', body: JSON.stringify({ profile_id: id }) }); } catch { /**/ }
    showToast('Profile blocked.', 'success');
    next();
  }, [next, showToast, dismissProfile]);

  const handleReport = useCallback(async (id: string) => {
    dismissProfile(id);
    try { await fetchApi('/profile-reports/', { method: 'POST', body: JSON.stringify({ profile_id: id, reason: 'Reported from Discover' }) }); } catch { /**/ }
    showToast('Report submitted.', 'success');
    next();
  }, [next, showToast, dismissProfile]);

  /* ── Keyboard ── */
  useEffect(() => {
    const p = deck[idx]; if (!p) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') ringNext('right');
      else if (e.key === 'ArrowLeft') ringNext('left');
      else if (e.key === 'ArrowUp') window.location.assign(profileHref(p));
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [deck, idx, ringNext]);

  /* ── Pointer ── */
  const onPD = (e: React.PointerEvent) => {
    // Skip capture if user clicked on an interactive element (buttons, links, etc.)
    // This ensures action buttons (X, ♥, ★) still fire their click events
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, [role="button"]')) return;
    // Capture pointer so drag tracks even when cursor leaves the card area fast
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    ptrRef.current = { x: e.clientX, y: e.clientY };
    setOffset(o => ({ ...o, dragging: true }));
  };
  const onPM = (e: React.PointerEvent) => {
    const s = ptrRef.current;
    if (!s) return;
    setOffset({ x: e.clientX - s.x, y: e.clientY - s.y, dragging: true });
  };
  const onPU = (e: React.PointerEvent) => {
    const s = ptrRef.current; ptrRef.current = null;
    if (!s) { setOffset({ x: 0, y: 0, dragging: false }); return; }
    const p = deck[idx];
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // Require at least 8px movement to count as a drag (prevents accidental swipe on click)
    if (dist < 8) { setOffset({ x: 0, y: 0, dragging: false }); return; }
    const flung = Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy);
    if (flung && p) {
      setOffset({ x: 0, y: 0, dragging: false });
      ringNext(dx > 0 ? 'right' : 'left');
      return;
    }
    if (dy < -80 && p) window.location.assign(profileHref(p));
    setOffset({ x: 0, y: 0, dragging: false });
  };
  // Double tap (desktop double-click / mobile double-tap) opens the profile.
  // Guarded so double-tapping on a button/link doesn't double-navigate.
  const onDoubleTap = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, [role="button"]')) return;
    const p = deck[idx];
    if (p) window.location.assign(profileHref(p));
  };

  /* ── Derived ── */
  const active = deck[idx];
  const completion = typeof user?.completion_percentage === 'number' ? user.completion_percentage : 60;
  const planName = (user as unknown as Record<string, Record<string, string>>)?.active_membership?.plan_name || 'Free Plan';
  const isPremium = Boolean((user as unknown as Record<string, unknown>)?.is_premium);

  /* Center card transform: drag follow, fling fly-off, or snap-back */
  const centerStyle =
    offset.dragging
      ? { transform: `translate(${offset.x}px,${offset.y}px) rotate(${offset.x * 0.026}deg)`, transition: 'none' }
      : fling === 'right'
        ? { transform: 'translate(760px,-36px) rotate(21deg)', transition: 'transform .34s cubic-bezier(.22,1,.36,1)' }
        : fling === 'left'
          ? { transform: 'translate(-760px,-36px) rotate(-21deg)', transition: 'transform .34s cubic-bezier(.22,1,.36,1)' }
          : undefined;

  /* ── Render ── */
  return (
    <>
      <style>{CSS}</style>
      <div className="d-root discover-root">
        <div className="d-body">

          {/* Main */}
          <div className="d-main">

            {/* Card area */}
            <div className="d-card-area" onPointerDown={onPD} onPointerMove={onPM} onPointerUp={onPU} onPointerCancel={onPU} onDoubleClick={onDoubleTap}>

              {deck[idx - 1] && <PeekCard profile={deck[idx - 1]} side="left" />}

              <div className="d-center"
                style={{ ...centerStyle, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
              >
                {active && (
                  <>
                    <ProfileCard
                      key={active.id}
                      profile={active}
                      interested={interested.current.has(active.id)}
                      shortlisted={shortlisted.current.has(active.id)}
                      onInterest={(id) => ringSwipe(id, 'right')}
                      onShortlist={handleShortlist}
                      onPass={(id) => ringSwipe(id, 'left')}
                      onMore={setMoreFor}
                      dragOffset={offset}
                      enterFrom={enterFrom}
                    />
                    {moreFor === active.id && (
                      <MoreMenu id={active.id} onClose={() => setMoreFor(null)}
                        onBlock={handleBlock} onReport={handleReport} onHide={handleHide} />
                    )}
                  </>
                )}
                {loading && profiles.length === 0 && <Skeleton />}
                {/* Deck is empty while more pages are already loading — e.g. every card on
                    the current page was swiped earlier and the auto-refill is fetching. */}
                {loading && deck.length === 0 && profiles.length > 0 && (
                  <div className="d-state">
                    <span className="d-state-spin" />
                    <h3 className="d-state-title">Finding fresh matches…</h3>
                    <p className="d-state-sub">Scanning the latest profiles for you.</p>
                  </div>
                )}
                {!loading && error && profiles.length === 0 && (
                  <div className="d-state">
                    <div className="d-state-icon"><X size={22} color="#b64a68" /></div>
                    <h3 className="d-state-title">Something went wrong</h3>
                    <p className="d-state-sub">{error}</p>
                    <button type="button" className="d-state-btn" onClick={() => { setProfiles([]); setPage(1); setHasMore(true); }}>Try Again</button>
                  </div>
                )}
                {!loading && !error && deck.length === 0 && (
                  <div className="d-state">
                    <div className="d-state-icon"><Heart size={22} color="#b64a68" /></div>
                    <h3 className="d-state-title">You're all caught up 💕</h3>
                    <p className="d-state-sub">No more eligible profiles right now. New members join every day — check back soon.</p>
                    <div className="d-state-actions">
                      <button type="button" className="d-state-btn" onClick={() => { setProfiles([]); setPage(1); setHasMore(true); setError(''); }}>
                        {hasMore ? 'Load More' : '↻ Refresh'}
                      </button>
                      <Link href="/search" className="d-state-btn d-state-btn-ghost" style={{ textDecoration: 'none' }}>Find Matches</Link>
                    </div>
                  </div>
                )}
              </div>

              {deck[idx + 1] && <PeekCard profile={deck[idx + 1]} side="right" />}
            </div>

            {/* Hint */}
            {active && (
              <div className={`d-hint${hintGone ? ' leaving' : ''}`}>
                <span className="d-hint-arrow d-hint-left">←</span>
                <span className="d-hint-text">Swipe • Double tap for profile</span>
                <span className="d-hint-arrow d-hint-right">→</span>
              </div>
            )}

            {/* End card stack (no marketing sections) */}
          </div>

          {/* Right panel */}
          <div className="d-right">
            <RightPanel
              completion={completion}
              visitors={visitors}
              matches={matches}
              isPremium={isPremium}
              planName={planName}
            />
          </div>
        </div>

        <FilterDialog
          open={filterOpen} onClose={() => setFilter(false)}
          filters={filters} onApply={f => { setFilters(f); setIdx(0); }} onReset={() => { setFilters(DEFAULT_FILTERS); setTab('all'); setIdx(0); }}
        />
      </div>
    </>
  );
}
