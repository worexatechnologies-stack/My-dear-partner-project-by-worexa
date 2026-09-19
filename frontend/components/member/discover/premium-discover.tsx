'use client';

import { profileHref } from '@/lib/profile-url';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye, Heart, MapPin, MoreHorizontal, Bookmark,
  ShieldCheck, SlidersHorizontal, Star, X, Flag, Ban, EyeOff,
  ChevronRight, Crown, ArrowRight, RotateCcw, CheckCircle2,
  Briefcase, GraduationCap, Check, Send, MessageCircle, TrendingUp,
} from 'lucide-react';

import SmartImage from '@/components/shared/smart-image';
import { useToast } from '@/components/ui';
import { useAuth } from '@/legacy/contexts/AuthContext';
import { fetchApi } from '@/legacy/services/apiClient';
import { getProfiles, getInterests, getShortlists, sendInterest, toggleShortlist } from '@/legacy/services/dataService';
import type { Profile } from '@/legacy/types/domain';
import {
  savePassedProfile,
  removePassedProfile,
  fetchPassedProfilesFromBackend,
  getLocalPassedProfiles,
  cleanPassedAgainstLikes,
} from '@/lib/discover-actions';
import { interestFeedback } from '@/components/member/interest-feedback';

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
const PASSED_IDS_KEY = 'mdp_discover_dismissed_v2';

function loadDismissedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  const set = new Set<string>();
  try {
    for (const key of [DISMISS_STORAGE_KEY, PASSED_IDS_KEY]) {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          for (const id of parsed) {
            if (id) set.add(String(id));
          }
        }
      }
    }
  } catch {
    /* ignore */
  }
  return set;
}

function saveDismissedIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    const list = JSON.stringify([...ids]);
    localStorage.setItem(DISMISS_STORAGE_KEY, list);
    localStorage.setItem(PASSED_IDS_KEY, list);
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

interface SidebarMemberItem {
  photo: string;
  href: string;
  name: string;
}

function extractMember(u: unknown, fallbackHref: string = '/profile'): SidebarMemberItem | null {
  if (!u || typeof u !== 'object') return null;
  const o = u as Record<string, any>;
  const photo = extractPhoto(o);
  if (!photo) return null;

  const target = o.profile || o.sender || o.member || o.user || o.viewer || o;
  let href = profileHref(target);
  if (href === '/profile' && target !== o) {
    href = profileHref(o);
  }
  if (href === '/profile') {
    const fallbackId = o.profile_id || o.viewer_id || o.sender_id || o.user_id || target?.user_id || target?.id;
    if (fallbackId) href = `/profile/${fallbackId}`;
  }
  if (href === '/profile') {
    href = fallbackHref;
  }
  const name = String(target?.full_name || target?.first_name || target?.name || o?.name || 'Member');

  return { photo, href, name };
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
.d-root { height:100%; min-height:0; display:flex; flex-direction:column; background:radial-gradient(46rem 26rem at 110% -10%, rgba(155,63,95,0.06), transparent 60%), radial-gradient(36rem 24rem at -10% 110%, rgba(217,179,108,0.05), transparent 60%), #faf6f3; overflow:hidden; }

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
.d-title { font-family:var(--font-heading); font-size:1.75rem; font-weight:800; color:#29242A; margin:0; line-height:1; }
.d-subtitle { font-size:0.8125rem; color:#887780; margin:0.25rem 0 0; }
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
.d-tab:not(.active):hover { background:#FCF5F7; border-color:#E9DDE1; color:#9B3F5F; }
.d-tab.active {
  background:linear-gradient(135deg,#9B3F5F 0%,#7F2948 100%); border-color:transparent; color:white;
  box-shadow:0 6px 16px rgba(155,63,95,0.30), inset 0 1px 0 rgba(255,255,255,0.22);
}

.d-filter-btn {
  display:inline-flex; align-items:center; gap:0.375rem;
  padding:0.45rem 1rem; border-radius:9999px;
  border:1.5px solid rgba(155,63,95,0.28); background:rgba(255,255,255,0.9); color:#9B3F5F;
  font-size:0.6875rem; font-weight:700; letter-spacing:0.01em; cursor:pointer; flex-shrink:0;
  box-shadow:0 2px 8px rgba(67,22,39,0.05);
  transition:all 0.18s ease;
}
.d-filter-btn:hover { background:#FCF5F7; border-color:rgba(155,63,95,0.5); transform:translateY(-1px); box-shadow:0 6px 14px rgba(155,63,95,0.14); }
.d-filter-btn:active { transform:translateY(0) scale(0.97); }
.d-filter-btn.active {
  background:linear-gradient(135deg,#9B3F5F 0%,#7F2948 100%); border-color:transparent; color:white;
  box-shadow:0 8px 18px rgba(155,63,95,0.32), inset 0 1px 0 rgba(255,255,255,0.22);
}
.d-filter-btn.active:hover { filter:brightness(1.06); background:linear-gradient(135deg,#9B3F5F 0%,#7F2948 100%); }

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

/* Peek cards disabled — clean single card mode */
.d-peek { display: none !important; }


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
@keyframes d-card-enter        { from { opacity:0; transform:scale(.985); }                                   to { opacity:1; transform:scale(1); } }
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
  background:linear-gradient(135deg,#9B3F5F,#7F2948); color:white; flex-shrink:0;
  box-shadow:0 3px 10px rgba(155,63,95,0.4);
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

/* Swipe Stamps & Shades */
.pc-shade {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 12;
  transition: opacity 0.08s ease-out;
}
.pc-shade-like {
  background: radial-gradient(circle at 25% 30%, rgba(34,197,94,0.45) 0%, rgba(16,185,129,0.22) 50%, rgba(5,150,105,0.08) 100%);
  box-shadow: inset 0 0 45px rgba(34,197,94,0.35);
}
.pc-shade-pass {
  background: radial-gradient(circle at 75% 30%, rgba(239,68,68,0.45) 0%, rgba(220,38,38,0.22) 50%, rgba(185,28,28,0.08) 100%);
  box-shadow: inset 0 0 45px rgba(239,68,68,0.35);
}
.pc-stamp {
  position:absolute; top:2.25rem; z-index:25;
  display:inline-flex; align-items:center; gap:0.5rem;
  padding:0.55rem 1.35rem; border-radius:1rem;
  font-family:var(--font-heading); font-size:1.45rem; font-weight:900;
  letter-spacing:0.08em; text-transform:uppercase;
  pointer-events:none; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
  transition:opacity 0.08s ease-out, transform 0.08s ease-out;
}
.pc-stamp-like {
  left:1.75rem; color:#15803d; border:3.5px solid #22c55e;
  background:rgba(240,253,244,0.92);
  box-shadow:0 10px 32px rgba(34,197,94,0.4), inset 0 1px 0 rgba(255,255,255,0.9);
  transform:rotate(-14deg);
}
.pc-stamp-pass {
  right:1.75rem; color:#b91c1c; border:3.5px solid #ef4444;
  background:rgba(254,242,242,0.92);
  box-shadow:0 10px 32px rgba(239,68,68,0.4), inset 0 1px 0 rgba(255,255,255,0.9);
  transform:rotate(14deg);
}

/* Swipe overlay */
.pc-swipe { position:absolute; display:inline-flex; align-items:center; gap:0.375rem; padding:0.4rem 0.875rem; border-radius:9999px; font-size:0.75rem; font-weight:800; color:white; pointer-events:none; z-index:20; box-shadow:0 4px 14px rgba(0,0,0,0.18); top:50%; left:50%; transform:translate(-50%,-50%); background:#9B3F5F; }

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
  background:#9B3F5F; color:white; flex-shrink:0;
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
  border:1.5px solid rgba(255,255,255,0.65); background:rgba(255,255,255,0.92); cursor:pointer; color:#7F2948;
  box-shadow:0 8px 22px rgba(43,16,29,0.20), inset 0 1px 0 rgba(255,255,255,0.9);
  backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px);
  transition:transform 0.16s ease, box-shadow 0.16s ease, color 0.16s ease; flex-shrink:0;
  -webkit-tap-highlight-color:transparent;
}
.pc-star:hover { transform:scale(1.08); color:#9B3F5F; box-shadow:0 12px 28px rgba(43,16,29,0.26); }
.pc-star:active { transform:scale(0.94); }
.pc-star.on    { background:linear-gradient(135deg,#FCF5F7,#F5EAEF); border-color:rgba(155,63,95,0.4); color:#9B3F5F; }

.pc-heart {
  display:flex; align-items:center; justify-content:center;
  width:4.35rem; height:4.35rem; border-radius:50%;
  border:none; background:linear-gradient(135deg,#9B3F5F 0%,#7F2948 55%,#5C1D33 100%);
  cursor:pointer; color:white;
  box-shadow:0 12px 30px rgba(155,63,95,0.45), 0 0 0 6px rgba(155,63,95,0.10), inset 0 2px 0 rgba(255,255,255,0.25);
  transition:transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease; flex-shrink:0;
  -webkit-tap-highlight-color:transparent;
}
.pc-heart:hover  { transform:scale(1.08); filter:brightness(1.06); box-shadow:0 16px 38px rgba(155,63,95,0.55), 0 0 0 8px rgba(155,63,95,0.12), inset 0 2px 0 rgba(255,255,255,0.25); }
.pc-heart:active { transform:scale(0.95); }
.pc-heart.sent   { background:linear-gradient(135deg,#4A1D30,#290F1B); box-shadow:0 10px 24px rgba(41,15,27,0.4), inset 0 2px 0 rgba(255,255,255,0.12); }

/* Action-buttons entrance — plays each time a new card slides in */
.pc-actions { animation:d-actions-in .4s ease-out both .1s; }
@keyframes d-actions-in { from{ opacity:0; transform:scale(0.94); } to{ opacity:1; transform:scale(1); } }

/* ── Swipe hint — an animated "swipe" affordance below the deck ── */
.d-hint {
  flex-shrink:0; display:flex; align-items:center; justify-content:center; gap:0.6rem;
  font-size:0.8rem; font-weight:800; color:#7F2948; letter-spacing:0.02em;
  margin:0.125rem 0 0; padding:0.5rem 1.35rem; border-radius:9999px; align-self:center;
  position:relative;
  background:linear-gradient(135deg,#ffffff,#FCF5F7);
  border:1.5px solid rgba(155,63,95,0.25);
  box-shadow:0 10px 26px rgba(155,63,95,0.15), inset 0 1px 0 rgba(255,255,255,0.95);
  backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px);
  animation:d-hint-float 2.6s cubic-bezier(.22,1,.36,1) infinite;
}
.d-hint::after {
  content:''; position:absolute; inset:-7px; border-radius:9999px; z-index:-1;
  background:radial-gradient(closest-side, rgba(155,63,95,0.18), transparent);
  filter:blur(7px); animation:d-hint-glow 2.6s ease-in-out infinite;
}
.d-hint-arrow {
  display:inline-flex; align-items:center; justify-content:center;
  width:1.8rem; height:1.8rem; border-radius:50%; line-height:0;
  background:linear-gradient(135deg,#9B3F5F 0%,#7F2948 100%); color:#fff;
  font-size:1rem; font-weight:900;
  box-shadow:0 5px 14px rgba(155,63,95,0.35), inset 0 1px 0 rgba(255,255,255,0.35);
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
.rp-week { font-size:0.5625rem; color:#887780; margin:0 0 0.375rem; }

/* Circular progress */
.rp-circ-wrap { display:flex; align-items:flex-start; gap:0.625rem; margin-bottom:0.5rem; }
.rp-circ-text { flex:1; min-width:0; }
.rp-circ-msg  { font-size:0.6875rem; font-weight:700; color:#3c3136; margin:0 0 0.125rem; }
.rp-circ-sub  { font-size:0.5625rem; color:#887780; line-height:1.4; margin:0; }
.rp-complete-btn {
  display:flex; align-items:center; justify-content:center;
  width:100%; height:2.5rem; border-radius:9999px; border:none;
  background:linear-gradient(135deg,#9B3F5F,#7F2948); color:white;
  font-size:0.6875rem; font-weight:700; letter-spacing:0.01em; cursor:pointer; text-decoration:none;
  box-shadow:0 8px 18px rgba(155,63,95,0.28), inset 0 1px 0 rgba(255,255,255,0.22);
  transition:filter 0.15s ease, transform 0.15s ease; margin-top:0.5rem;
}
.rp-complete-btn:hover { filter:brightness(1.06); transform:translateY(-1px); }
.rp-complete-btn:active { transform:translateY(0) scale(0.98); }

/* Avatars row */
.rp-avatars { display:flex; align-items:center; margin:0.375rem 0; }
.rp-avatar { width:2.125rem; height:2.125rem; border-radius:50%; border:2px solid white; overflow:hidden; background:#FCF5F7; margin-left:-0.5rem; flex-shrink:0; cursor:pointer; text-decoration:none; display:block; position:relative; transition:transform 0.18s ease, box-shadow 0.18s ease; }
.rp-avatar:first-child { margin-left:0; }
.rp-avatar img { width:100%; height:100%; object-fit:cover; }
.rp-avatar:hover { transform:scale(1.12); z-index:10; box-shadow:0 4px 12px rgba(155,63,95,0.22); }
.rp-avatar-more { display:flex; align-items:center; justify-content:center; font-size:0.625rem; font-weight:800; color:#9B3F5F; background:#FCF5F7; text-decoration:none; }
.rp-badge { display:inline-flex; align-items:center; justify-content:center; min-width:1.25rem; height:1.25rem; padding:0 0.3rem; border-radius:9999px; background:#7F2948; color:white; font-size:0.5rem; font-weight:700; }
.rp-link  { display:inline-flex; align-items:center; gap:0.2rem; font-size:0.5625rem; font-weight:800; color:#9B3F5F; text-decoration:none; margin-top:0.25rem; }
.rp-link:hover { color:#7F2948; }

.rp-title-bold { font-family:var(--font-heading); font-size:0.95rem; font-weight:800; color:#1a1015; margin:0; display:flex; align-items:center; gap:0.4rem; }
.rp-num-bold { font-family:var(--font-heading); font-size:1.15rem; font-weight:800; color:#1a1015; }
.rp-sub-text { font-size:0.7rem; font-weight:500; color:#776a6f; margin:0.35rem 0 0.85rem 0; }
.rp-view-btn {
  display:flex; align-items:center; justify-content:center;
  width:100%; padding:0.65rem; border-radius:9999px;
  background:linear-gradient(135deg,#FCF5F7,#F5EAEF); color:#7F2948;
  font-size:0.75rem; font-weight:800; text-decoration:none;
  margin-top:1rem; border:1px solid rgba(155,63,95,0.2);
  transition:all 0.18s ease;
}
.rp-view-btn:hover { border-color:rgba(155,63,95,0.4); transform:translateY(-1px); box-shadow:0 6px 14px rgba(155,63,95,0.14); }

/* Premium card */
.rp-prem { position:relative; overflow:hidden; border-radius:1.25rem; border:1px solid rgba(217,179,108,0.32); background:radial-gradient(12rem 8rem at 100% 0%, rgba(217,179,108,0.16), transparent 60%), linear-gradient(135deg,#fffaf3 0%,#FCF5F7 100%); padding:0.875rem; margin-bottom:0.625rem; box-shadow:0 4px 16px rgba(67,22,39,0.06), inset 0 1px 0 rgba(255,255,255,0.9); }
.rp-prem-title { font-family:var(--font-heading); font-size:0.875rem; font-weight:800; color:#3c3136; margin:0.375rem 0 0.125rem; }
.rp-prem-sub   { font-size:0.5625rem; color:#887780; margin:0; }
.rp-prem-link  { display:inline-flex; align-items:center; gap:0.2rem; font-size:0.625rem; font-weight:800; color:#9B3F5F; text-decoration:none; margin-top:0.375rem; }
.rp-upgrade-btn {
  display:flex; align-items:center; justify-content:center; gap:0.25rem;
  width:100%; margin-top:0.625rem; padding:0.55rem; border-radius:9999px;
  border:none; background:linear-gradient(135deg,#9B3F5F,#7F2948); color:white;
  font-size:0.625rem; font-weight:700; letter-spacing:0.02em; cursor:pointer; text-decoration:none;
  transition:filter 0.15s, transform 0.15s; box-shadow:0 6px 16px rgba(155,63,95,0.32), inset 0 1px 0 rgba(255,255,255,0.2);
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
.d-fd-close  { width:2rem; height:2rem; border-radius:50%; border:none; background:transparent; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#887780; transition:background 0.15s ease; }
.d-fd-close:hover { background:#FCF5F7; color:#9B3F5F; }
.d-fd-lbl    { display:block; font-size:0.5rem; font-weight:800; letter-spacing:0.12em; text-transform:uppercase; color:#9a8a90; margin:0.875rem 0 0.375rem; }
.d-fd-field  { width:100%; border-radius:0.85rem; border:1.5px solid #eadfd9; background:#faf6f3; padding:0.625rem 0.85rem; font-size:0.8125rem; color:#4c4145; outline:none; transition:border-color 0.18s, box-shadow 0.18s, background 0.18s; box-sizing:border-box; }
.d-fd-field:focus { border-color:#9B3F5F; background:white; box-shadow:0 0 0 3px rgba(155,63,95,0.12); }
.d-fd-grid   { display:grid; grid-template-columns:1fr 1fr; gap:0.625rem; }
.d-fd-foot   { display:flex; gap:0.625rem; margin-top:1.125rem; padding-top:0.75rem; border-top:1px solid #f0e7ea; }
.d-fd-reset  { display:inline-flex; align-items:center; gap:0.375rem; height:2.75rem; padding:0 1.1rem; border-radius:9999px; border:1.5px solid #eadfd9; background:white; font-size:0.75rem; font-weight:700; color:#6f5f66; cursor:pointer; flex-shrink:0; transition:border-color 0.18s, color 0.18s; }
.d-fd-reset:hover { border-color:rgba(155,63,95,0.45); color:#9B3F5F; }
.d-fd-apply  { flex:1; height:2.75rem; border-radius:9999px; border:none; background:linear-gradient(135deg,#9B3F5F 0%,#7F2948 55%,#5C1D33 100%); color:white; font-size:0.75rem; font-weight:700; letter-spacing:0.02em; cursor:pointer; box-shadow:0 8px 20px rgba(155,63,95,0.28), inset 0 1px 0 rgba(255,255,255,0.22); transition:filter 0.15s, transform 0.15s; }
.d-fd-apply:hover { filter:brightness(1.06); transform:translateY(-1px); }
.d-fd-apply:active { transform:translateY(0) scale(0.98); }
.d-toggle-row { display:flex; align-items:center; justify-content:space-between; border-radius:0.85rem; border:1.5px solid #efe3e6; padding:0.625rem 0.75rem; cursor:pointer; background:#faf6f3; width:100%; margin-top:0.375rem; transition:border-color 0.18s; }
.d-toggle-row:hover { border-color:rgba(155,63,95,0.3); }
.d-toggle-lbl { font-size:0.75rem; font-weight:600; color:#5c4e54; }
.d-toggle-track { position:relative; width:2.25rem; height:1.25rem; border-radius:9999px; transition:background 0.18s; flex-shrink:0; }
.d-toggle-thumb { position:absolute; top:0.125rem; height:1rem; width:1rem; border-radius:50%; background:white; box-shadow:0 1px 3px rgba(0,0,0,0.18); transition:transform 0.18s; }

/* ── More menu ── */
.d-more-menu { position:absolute; right:0.75rem; top:3rem; z-index:30; width:13rem; border-radius:1.25rem; background:rgba(255,255,255,0.97); border:1px solid rgba(67,22,39,0.08); box-shadow:0 20px 48px rgba(43,16,29,0.20), inset 0 1px 0 rgba(255,255,255,0.9); overflow:hidden; backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px); }
.d-more-item { display:flex; align-items:center; gap:0.625rem; width:100%; padding:0.625rem 1rem; font-size:0.75rem; font-weight:600; color:#5c4e54; background:none; border:none; cursor:pointer; transition:background 0.15s, color 0.15s; text-align:left; }
.d-more-item:hover { background:#FCF5F7; color:#9B3F5F; }
.d-more-item svg { color:#a5697c; flex-shrink:0; }
.d-more-item:hover svg { color:#9B3F5F; }

/* ── Skeleton ── */
.d-skel { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; z-index:20; }
.d-skel-card { width:100%; max-width:360px; height:100%; border-radius:1.5rem; border:1px solid #f0e7ea; background:white; overflow:hidden; }
.d-skel-photo { height:60%; background:linear-gradient(90deg,#f6ecef 25%,#FCF5F7 50%,#f6ecef 75%); background-size:200% 100%; animation:shimmer 1.6s infinite; }
.d-skel-body  { padding:0.875rem; }
.d-skel-line  { border-radius:9999px; background:linear-gradient(90deg,#f6ecef 25%,#FCF5F7 50%,#f6ecef 75%); background-size:200% 100%; animation:shimmer 1.6s infinite; margin-bottom:0.5rem; }
@keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

/* ── State screens & Empty Card ── */
.d-state { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:0.75rem; padding:1.5rem; text-align:center; }
.d-state-icon  { width:4.5rem; height:4.5rem; border-radius:1.5rem; background:linear-gradient(135deg,#FCF5F7,#F5EAEF); border:1px solid rgba(155,63,95,0.18); box-shadow:0 10px 24px rgba(155,63,95,0.14); display:flex; align-items:center; justify-content:center; }
.d-state-title { font-family:var(--font-heading); font-size:1rem; font-weight:800; color:#29242A; margin:0; }
.d-state-sub   { font-size:0.75rem; color:#887780; max-width:22rem; line-height:1.55; margin:0; }
.d-state-btn   { padding:0.6rem 1.5rem; border-radius:9999px; border:none; background:linear-gradient(135deg,#9B3F5F,#7F2948); color:white; font-size:0.75rem; font-weight:700; letter-spacing:0.01em; cursor:pointer; box-shadow:0 8px 18px rgba(155,63,95,0.28), inset 0 1px 0 rgba(255,255,255,0.18); transition:filter 0.15s, transform 0.15s; }
.d-state-btn:hover { filter:brightness(1.06); transform:translateY(-1px); }
.d-state-actions { display:flex; align-items:center; justify-content:center; gap:0.625rem; flex-wrap:wrap; margin-top:0.25rem; }
.d-state-btn-ghost { background:#fff; color:#9B3F5F; border:1.5px solid rgba(155,63,95,0.3); box-shadow:none; }
.d-state-btn-ghost:hover { background:#FCF5F7; filter:none; transform:translateY(-1px); }
.d-state-spin { width:2.75rem; height:2.75rem; border-radius:50%; border:3px solid #F5EAEF; border-top-color:#9B3F5F; animation:d-spin .8s linear infinite; }
@keyframes d-spin { to { transform:rotate(360deg); } }

/* Highlighted Empty State Card */
.d-empty-card {
  width:100%; max-width:440px;
  background:linear-gradient(165deg, #ffffff 0%, #FCF5F7 60%, #F8EEF2 100%);
  border:1.5px solid #E9DDE1;
  border-radius:2.25rem;
  padding:2.5rem 1.75rem;
  box-shadow:0 24px 60px rgba(41,36,42,0.10), 0 6px 18px rgba(41,36,42,0.04);
  display:flex; flex-direction:column; align-items:center; text-align:center;
  position:relative; overflow:hidden; margin:auto;
  animation:d-card-enter .4s cubic-bezier(.22,1,.36,1) both;
}
.d-empty-card-glow {
  position:absolute; inset:-30px;
  background:radial-gradient(circle at 50% 25%, rgba(155,63,95,0.10), transparent 70%);
  pointer-events:none;
}
.d-empty-badge {
  display:inline-flex; align-items:center; gap:0.35rem;
  padding:0.32rem 0.85rem; border-radius:9999px;
  background:rgba(255,255,255,0.85); border:1px solid #E9DDE1;
  color:#9B3F5F; font-size:0.6875rem; font-weight:700;
  margin-bottom:1rem; box-shadow:0 2px 6px rgba(155,63,95,0.05);
}
.d-empty-icon-box {
  width:4.75rem; height:4.75rem; border-radius:50%;
  background:linear-gradient(135deg,#ffffff,#FCF5F7);
  border:2px solid #E9DDE1;
  box-shadow:0 12px 28px rgba(155,63,95,0.14), inset 0 2px 0 rgba(255,255,255,0.95);
  display:flex; align-items:center; justify-content:center;
  margin-bottom:1.15rem; position:relative;
}
.d-empty-title {
  font-family:var(--font-heading); font-size:1.4rem; font-weight:800; color:#29242A;
  margin:0 0 0.45rem; line-height:1.25; letter-spacing:-0.01em;
}
.d-empty-desc {
  font-size:0.8125rem; color:#77686F; line-height:1.55; max-width:22rem; margin:0 0 1.5rem;
}
.d-empty-actions {
  display:flex; align-items:center; justify-content:center; gap:0.75rem;
  width:100%; max-width:20rem; flex-wrap:wrap; position:relative; z-index:2;
}
.d-empty-btn-primary {
  display:inline-flex; align-items:center; justify-content:center; gap:0.45rem;
  flex:1; min-width:8.5rem; padding:0.7rem 1.25rem; border-radius:9999px; border:none;
  background:linear-gradient(135deg,#9B3F5F 0%,#7F2948 100%); color:white;
  font-size:0.8125rem; font-weight:700; cursor:pointer;
  box-shadow:0 8px 20px rgba(155,63,95,0.28), inset 0 1px 0 rgba(255,255,255,0.22);
  transition:all 0.16s ease; text-decoration:none;
}
.d-empty-btn-primary:hover { filter:brightness(1.06); transform:translateY(-1px); box-shadow:0 10px 24px rgba(155,63,95,0.35); }
.d-empty-btn-secondary {
  display:inline-flex; align-items:center; justify-content:center; gap:0.45rem;
  flex:1; min-width:8.5rem; padding:0.7rem 1.25rem; border-radius:9999px;
  background:white; color:#7F2948; border:1.5px solid #E9DDE1;
  font-size:0.8125rem; font-weight:700; cursor:pointer;
  box-shadow:0 3px 10px rgba(67,22,39,0.04); transition:all 0.16s ease; text-decoration:none;
}
.d-empty-btn-secondary:hover { background:#FCF5F7; border-color:#9B3F5F; transform:translateY(-1px); }

/* ── Deck under-card (stack depth effect) ── */
.d-center-under {
  position:absolute; inset:0;
  width:100%; max-width:92vw; height:100%; min-height:0;
  margin:0 auto; pointer-events:none;
  will-change:transform, opacity;
}
@media(min-width:480px){ .d-center-under{max-width:400px;} }
@media(min-width:768px){ .d-center-under{max-width:440px;} }
@media(min-width:1024px){ .d-center-under{max-width:480px;} }
@media(min-width:1440px){ .d-center-under{max-width:520px;} }



/* ── Mobile immersive swipe deck (Tinder-style) ── */
@media(max-width:639px){
  .d-hint    { font-size:0.6875rem; padding:0.35rem 0.9rem; margin-top:0.125rem; }
  .d-card-area { min-height:0; max-height:none; }
  .d-center  { width:100%; max-width:none; }
  .pc-photo  { width:100%; height:100%; }
  .pc-img    { object-position:center 20%; }
  .pc-info {
    margin:0 0.5rem max(0.625rem, env(safe-area-inset-bottom)) 0.5rem;
    padding:0.875rem 1rem 0.75rem;
    border-radius:1.375rem;
    background:transparent;
  }
  .pc-gradient { background:linear-gradient(to bottom, transparent 0%, transparent 45%, rgba(15,7,12,0.30) 60%, rgba(15,7,12,0.62) 80%, rgba(15,7,12,0.88) 100%); }
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



/* ─────────────────────────────── ProfileCard ─────────────────────────────── */

function ProfileCard({
  profile, interested, shortlisted,
  onInterest, onShortlist, onPass, onMore,
  dragOffset, flingDir, isUnderCard, enterFrom,
}: {
  profile: Profile; interested: boolean; shortlisted: boolean;
  onInterest(id: string): void; onShortlist(id: string): void;
  onPass(id: string): void; onMore(id: string): void;
  dragOffset?: { x: number; y: number };
  flingDir?: 'left' | 'right' | null;
  isUnderCard?: boolean;
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

  const showLike = !isUnderCard && (flingDir === 'right' || (dragOffset && dragOffset.x > 15));
  const showPass = !isUnderCard && (flingDir === 'left' || (dragOffset && dragOffset.x < -15));
  const likeOpacity = flingDir === 'right' ? 1 : Math.min(1, Math.max(0, ((dragOffset?.x ?? 0) - 15) / 70));
  const passOpacity = flingDir === 'left' ? 1 : Math.min(1, Math.max(0, (-(dragOffset?.x ?? 0) - 15) / 70));

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

      {/* Green shade overlay on Swipe Right (LIKE) */}
      {showLike && (
        <div className="pc-shade pc-shade-like" style={{ opacity: likeOpacity }} />
      )}

      {/* Red shade overlay on Swipe Left (PASS) */}
      {showPass && (
        <div className="pc-shade pc-shade-pass" style={{ opacity: passOpacity }} />
      )}

      {/* Swipe Stamps */}
      {showLike && (
        <div className="pc-stamp pc-stamp-like" style={{ opacity: likeOpacity }}>
          <Heart size={24} fill="#16a34a" color="#16a34a" strokeWidth={0} />
          <span>LIKE</span>
        </div>
      )}
      {showPass && (
        <div className="pc-stamp pc-stamp-pass" style={{ opacity: passOpacity }}>
          <X size={26} color="#dc2626" strokeWidth={3.5} />
          <span>PASS</span>
        </div>
      )}

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
          <p className="pc-detail"><MapPin size={13} strokeWidth={2.2} className="pc-detail-icon text-[#E9829B]" /> {location}</p>
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
            <Star size={22} fill={shortlisted ? '#9B3F5F' : 'none'} color={shortlisted ? '#9B3F5F' : '#7F2948'} strokeWidth={shortlisted ? 0 : 2.2} />
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

/* ─────────────────────────── Daily Limit Modal ─────────────────────────── */

function DailyLimitModal({
  open,
  onClose,
  onShortlistCurrent,
}: {
  open: boolean;
  onClose(): void;
  onShortlistCurrent?(): void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[340px] bg-white rounded-3xl p-5 border border-rose-100 shadow-[0_24px_54px_rgba(53,19,32,0.18)] text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal
        aria-label="Daily Interest Limit Reached"
      >
        {/* Close button (matching sidebar subtle hover style) */}
        <button
          type="button"
          className="absolute top-3.5 right-3.5 w-7 h-7 rounded-full bg-[#fdfafb] hover:bg-rose-50 border border-rose-100 flex items-center justify-center text-[#443c40] hover:text-[#351320] transition-colors cursor-pointer"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="w-3.5 h-3.5" strokeWidth={1.85} />
        </button>

        {/* Support UI-style icon badge (matching Support category card icon containers) */}
        <div className="flex justify-center mt-0.5 mb-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-[#8e3d58] shadow-xs transition-transform hover:scale-105 duration-200">
            <Heart className="w-7 h-7 fill-[#8e3d58]/15 text-[#8e3d58]" strokeWidth={1.85} />
          </div>
        </div>

        {/* Website brand allowance pill */}
        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-rose-50 border border-rose-100 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#8e3d58]" />
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#8e3d58]">
            Daily Allowance Done
          </span>
        </div>

        {/* Title & description */}
        <h3 className="text-base font-bold text-[#351320] tracking-tight mb-1">
          Daily Interests Completed
        </h3>
        <p className="text-xs text-gray-600 leading-relaxed px-1 mb-3.5">
          You&apos;ve sent all your free interests for today. Upgrade to send unlimited likes and chat directly!
        </p>

        {/* Support Category Card style perks preview (matching Support cards & Member Sidebar icons) */}
        <div className="grid grid-cols-2 gap-2.5 mb-4 text-left">
          <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-rose-100 bg-[#fffbfc] hover:bg-rose-50/60 transition-colors group">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-[#8e3d58]">
              <Heart className="w-4 h-4 fill-[#8e3d58]/15 text-[#8e3d58] transition-transform duration-200 group-hover:scale-110" strokeWidth={1.85} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#351320] leading-tight truncate">Unlimited</p>
              <p className="text-[10px] text-gray-500 leading-tight truncate">Daily Likes</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-rose-100 bg-[#fffbfc] hover:bg-rose-50/60 transition-colors group">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-100 bg-rose-50 text-[#262626]">
              <MessageCircle className="w-4 h-4 text-[#262626] transition-transform duration-200 group-hover:scale-110" strokeWidth={1.85} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#351320] leading-tight truncate">Direct Chat</p>
              <p className="text-[10px] text-gray-500 leading-tight truncate">Connect Fast</p>
            </div>
          </div>
        </div>

        {/* Action buttons (Support page button color & sidebar icon styling) */}
        <div className="space-y-2">
          <Link
            href="/membership"
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-[#8e3d58] hover:bg-[#702d45] text-white font-bold text-xs shadow-md shadow-rose-200/60 transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            onClick={onClose}
          >
            <Crown className="w-3.5 h-3.5" strokeWidth={1.85} />
            <span>Upgrade to Premium</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5 opacity-90" strokeWidth={1.85} />
          </Link>

          {onShortlistCurrent && (
            <button
              type="button"
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-white text-[#351320] font-semibold text-xs border border-rose-200/80 shadow-xs hover:bg-rose-50/60 hover:border-[#8e3d58] transition-all cursor-pointer"
              onClick={() => {
                onShortlistCurrent();
                onClose();
              }}
            >
              <Bookmark className="w-3.5 h-3.5 text-[#8e3d58]" strokeWidth={1.85} />
              <span>Save to Shortlist Instead</span>
            </button>
          )}

          <button
            type="button"
            className="w-full pt-1.5 pb-0.5 text-[11px] font-semibold text-gray-500 hover:text-[#351320] transition-colors cursor-pointer"
            onClick={onClose}
          >
            Continue Browsing
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── RightPanel ─────────────────────────────── */

function RightPanel({ completion, visitors, matches, sentCount, passedCount, isPremium, planName }: {
  completion: number; isPremium: boolean; planName: string;
  sentCount: number; passedCount: number;
  visitors: { count: number; items?: SidebarMemberItem[]; photos?: string[] };
  matches: { count: number; items?: SidebarMemberItem[]; photos?: string[] };
}) {
  const visitorList: SidebarMemberItem[] = visitors.items && visitors.items.length > 0
    ? visitors.items
    : (visitors.photos || []).map((src) => ({ photo: src, href: '/visitors', name: 'Visitor' }));

  const matchList: SidebarMemberItem[] = matches.items && matches.items.length > 0
    ? matches.items
    : (matches.photos || []).map((src) => ({ photo: src, href: '/interests/received', name: 'Match' }));

  // Strict deduplication by unique key (href, photo url, or name)
  const seenMatchKeys = new Set<string>();
  const uniqueMatches: SidebarMemberItem[] = [];
  for (const m of matchList) {
    const key = (m.href && m.href !== '/profile' ? m.href : '') || (m.photo ? m.photo.split('?')[0] : '') || m.name.toLowerCase().trim();
    if (key && !seenMatchKeys.has(key)) {
      seenMatchKeys.add(key);
      uniqueMatches.push(m);
    }
  }

  const seenAllKeys = new Set<string>();
  const uniqueAllPeople: { item: SidebarMemberItem; label: string }[] = [];

  for (const m of uniqueMatches) {
    const key = (m.href && m.href !== '/profile' ? m.href : '') || (m.photo ? m.photo.split('?')[0] : '') || m.name.toLowerCase().trim();
    if (key && !seenAllKeys.has(key)) {
      seenAllKeys.add(key);
      uniqueAllPeople.push({ item: m, label: 'Matched with you' });
    }
  }

  for (const v of visitorList) {
    const key = (v.href && v.href !== '/profile' ? v.href : '') || (v.photo ? v.photo.split('?')[0] : '') || v.name.toLowerCase().trim();
    if (key && !seenAllKeys.has(key)) {
      seenAllKeys.add(key);
      uniqueAllPeople.push({ item: v, label: 'Viewed your profile' });
    }
  }

  return (
    <div className="space-y-3.5">
      {/* 1. Match Queue Stories Tray */}
      <div className="bg-white rounded-2xl p-3.5 border border-[#efefef] shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between mb-3 px-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#e11d48]" />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#a8989f]">Match Queue</h3>
          </div>
          <Link href="/interests/received" className="text-xs font-semibold text-[#e11d48] hover:text-[#be123c] transition-colors">
            View all
          </Link>
        </div>

        {/* Stories / Match Bubbles Row */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {/* New Likes Story Avatar */}
          <Link
            href="/interests/received"
            className="flex flex-col items-center gap-1 shrink-0 group"
            title={`${matches.count} New Matches`}
          >
            <div className="relative w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-[#e11d48] to-[#f43f5e] group-hover:scale-105 transition-transform shadow-xs">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                <Heart className="w-5 h-5 fill-[#e11d48] text-[#e11d48]" />
              </div>
              {matches.count > 0 && (
                <span className="absolute -bottom-0.5 -right-0.5 bg-[#e11d48] text-white text-[9px] font-bold px-1.5 rounded-full border-2 border-white">
                  {matches.count}
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-[#443c40]">Likes</span>
          </Link>

          {/* Visitors Story Avatar */}
          <Link
            href="/visitors"
            className="flex flex-col items-center gap-1 shrink-0 group"
            title={`${visitors.count} Profile Visitors`}
          >
            <div className="relative w-12 h-12 rounded-full p-0.5 bg-[#f0e8eb] border border-[#efefef] group-hover:border-[#262626] group-hover:scale-105 transition-all">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                <Eye className="w-5 h-5 text-[#262626]" strokeWidth={1.85} />
              </div>
              {visitors.count > 0 && (
                <span className="absolute -bottom-0.5 -right-0.5 bg-[#262626] text-white text-[9px] font-bold px-1.5 rounded-full border-2 border-white">
                  {visitors.count}
                </span>
              )}
            </div>
            <span className="text-[11px] font-medium text-[#443c40]">Visitors</span>
          </Link>

          {/* Individual Match / Viewer Avatars (Deduplicated) */}
          {uniqueAllPeople.slice(0, 4).map(({ item }, idx) => (
            <Link
              key={idx}
              href={item.href}
              className="flex flex-col items-center gap-1 shrink-0 group"
              title={`View ${item.name}`}
            >
              <div className="w-12 h-12 rounded-full p-0.5 bg-[#f0e8eb] border border-[#efefef] group-hover:border-[#e11d48] transition-all">
                <div className="w-full h-full rounded-full overflow-hidden bg-[#f7f4f5]">
                  <SmartImage src={item.photo} alt={item.name} className="w-full h-full object-cover" shape="circle" watermark={false} />
                </div>
              </div>
              <span className="text-[11px] font-medium text-[#443c40] truncate max-w-[3rem]">
                {item.name.split(' ')[0]}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* 2. Quick Activity Pills (Matching Member Sidebar Icons & Colors) */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/interests/received"
          className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#efefef] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:bg-[#f7f4f5] hover:border-[#dfd8dc] transition-all group"
        >
          <div className="flex items-center gap-2">
            <Heart className="w-4 h-4 text-[#e11d48] fill-[#e11d48]/15 group-hover:scale-110 transition-transform" strokeWidth={2} />
            <span className="text-xs font-semibold text-[#0f0f10]">Matches</span>
          </div>
          <span className="text-xs font-bold text-[#e11d48] bg-[#fff0f2] border border-[#fecdd3] px-2 py-0.5 rounded-full">
            {matches.count}
          </span>
        </Link>

        <Link
          href="/visitors"
          className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#efefef] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:bg-[#f7f4f5] hover:border-[#dfd8dc] transition-all group"
        >
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#262626] group-hover:scale-110 transition-transform" strokeWidth={1.85} />
            <span className="text-xs font-semibold text-[#0f0f10]">Visitors</span>
          </div>
          <span className="text-xs font-bold text-[#262626] bg-[#f7f4f5] border border-[#efefef] px-2 py-0.5 rounded-full">
            {visitors.count}
          </span>
        </Link>

        <Link
          href="/interests/sent"
          className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#efefef] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:bg-[#f7f4f5] hover:border-[#dfd8dc] transition-all group"
        >
          <div className="flex items-center gap-2">
            <Send className="w-4 h-4 text-[#262626] group-hover:scale-110 transition-transform" strokeWidth={1.85} />
            <span className="text-xs font-semibold text-[#0f0f10]">Sent Likes</span>
          </div>
          <span className="text-xs font-bold text-[#262626] bg-[#f7f4f5] border border-[#efefef] px-2 py-0.5 rounded-full">
            {sentCount}
          </span>
        </Link>

        <Link
          href="/interests/declined"
          className="flex items-center justify-between p-3 bg-white rounded-xl border border-[#efefef] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:bg-[#f7f4f5] hover:border-[#dfd8dc] transition-all group"
        >
          <div className="flex items-center gap-2">
            <X className="w-4 h-4 text-[#262626] group-hover:scale-110 transition-transform" strokeWidth={1.85} />
            <span className="text-xs font-semibold text-[#0f0f10]">Passed</span>
          </div>
          <span className="text-xs font-bold text-[#262626] bg-[#f7f4f5] border border-[#efefef] px-2 py-0.5 rounded-full">
            {passedCount}
          </span>
        </Link>
      </div>

      {/* 3. Messages & Conversations Peek */}
      <div className="bg-white rounded-2xl p-3.5 border border-[#efefef] shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <div className="flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4 text-[#262626]" strokeWidth={1.85} />
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#a8989f]">Direct Messages</h3>
          </div>
          <Link href="/messages" className="text-xs font-semibold text-[#e11d48] hover:text-[#be123c] transition-colors">
            Open Chat →
          </Link>
        </div>

        {uniqueAllPeople.length > 0 ? (
          <div className="space-y-1">
            {uniqueAllPeople.slice(0, 3).map(({ item, label }, idx) => (
              <Link
                key={idx}
                href="/messages"
                className="flex items-center justify-between p-2 rounded-xl hover:bg-[#f7f4f5] transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden bg-[#f7f4f5] shrink-0 border border-[#efefef]">
                    <SmartImage src={item.photo} alt={item.name} className="w-full h-full object-cover" shape="circle" watermark={false} />
                    <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border-2 border-white rounded-full" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0f0f10] truncate">{item.name}</p>
                    <p className="text-[10px] text-[#8c7a82] truncate">{label}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#e11d48] opacity-0 group-hover:opacity-100 transition-opacity">
                  Chat
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-xs text-[#8c7a82] text-center py-3">
            Swipe right on profiles to start chatting!
          </p>
        )}
      </div>

      {/* 4. Profile Completion Mini Bar */}
      {completion < 100 && (
        <div className="p-3.5 bg-white rounded-2xl border border-[#efefef] shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-[#0f0f10]">Profile Strength</span>
            <span className="text-xs font-bold text-[#e11d48]">{completion}%</span>
          </div>
          <div className="w-full h-1.5 bg-[#f4f0f2] rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-[#e11d48] to-[#f43f5e] rounded-full transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
          <Link
            href="/profile/edit"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#e11d48] hover:text-[#be123c] transition-colors"
          >
            Complete profile (+3x matches) <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* 5. Daily Match Tip & Insights */}
      <div className="p-3.5 bg-white rounded-2xl border border-[#efefef] shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#f7f4f5] border border-[#efefef] flex items-center justify-center shrink-0">
            <TrendingUp className="w-3.5 h-3.5 text-[#262626]" strokeWidth={1.85} />
          </div>
          <div>
            <p className="text-xs font-bold text-[#0f0f10] leading-tight">Daily Match Insight</p>
            <p className="text-[10px] text-[#8c7a82]">Profile optimization tip</p>
          </div>
        </div>
        <p className="text-[11px] text-[#443c40] leading-relaxed">
          Profiles with at least 3 photos & complete preferences get <strong className="text-[#e11d48] font-bold">5x more responses</strong>.
        </p>
        <Link
          href="/profile/edit"
          className="inline-flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold text-[#0f0f10] bg-[#f7f4f5] border border-[#efefef] hover:bg-[#efe9ec] hover:border-[#dfd8dc] transition-all"
        >
          <span>Boost Visibility</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

/* =============================== Skeleton =============================== */

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
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [tab, setTab] = useState<FeedTab>('all');
  const [filterOpen, setFilter] = useState(false);
  const [moreFor, setMoreFor] = useState<string | null>(null);
  const [dailyLimitModalOpen, setDailyLimitModalOpen] = useState(false);
  const [dailyInterestsDone, setDailyInterestsDone] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [flingDir, setFlingDir] = useState<'left' | 'right' | null>(null);
  const isAnimatingOutRef = useRef(false);
  const [hintGone, setHintGone] = useState(false);
  const interested = useRef(new Set<string>());
  const shortlisted = useRef(new Set<string>());
  const hidden = useRef(loadDismissedIds());
  const [dismissedVersion, setDismissedVersion] = useState(0);
  const [swipedHistory, setSwipedHistory] = useState<Profile[]>([]);

  const resetDismissed = useCallback(async () => {
    hidden.current.clear();
    saveDismissedIds(hidden.current);
    setSwipedHistory([]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(DISMISS_STORAGE_KEY);
        localStorage.removeItem(PASSED_IDS_KEY);
        localStorage.removeItem('mdp_discover_passed_profiles_v1');
      } catch {
        /* ignore */
      }
    }
    setPassedCount(0);
    setDragOffset({ x: 0, y: 0 });
    setFlingDir(null);
    setIsDragging(false);
    isAnimatingOutRef.current = false;

    // Reset backend passes if any
    void fetchApi('/passes/', { method: 'DELETE' }).catch(() => {});

    // Refresh deck profiles
    try {
      setLoading(true);
      const d = await getProfiles({ page_size: '12', ordering: '-created_at' });
      setProfiles(dedupeProfiles(d.results));
      setPage(1);
      setHasMore(d.next !== null);
    } catch {
      /* best effort */
    } finally {
      setLoading(false);
    }
    setDismissedVersion((v) => v + 1);
    showToast('Deck refreshed with available profiles', 'success');
  }, [showToast]);

  const ptrRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const [visitors, setVisitors] = useState<{ count: number; items: SidebarMemberItem[]; photos: string[] }>({ count: 0, items: [], photos: [] });
  const [matches, setMatches] = useState<{ count: number; items: SidebarMemberItem[]; photos: string[] }>({ count: 0, items: [], photos: [] });
  const [passedCount, setPassedCount] = useState<number>(0);
  const [sentLikesCount, setSentLikesCount] = useState<number>(0);


const dedupeProfiles = (list: Profile[]): Profile[] => {
  const seen = new Set<string>();
  return list.filter((p) => {
    const key = p.id || (p as unknown as Record<string, string>).user_id || p.name;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/* ── Load profiles ── */
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        setLoading(true);
        setError('');
        const d = await getProfiles({ page_size: '12', ordering: '-created_at' });
        if (!live) return;
        setProfiles(dedupeProfiles(d.results));
        setPage(1);
        setHasMore(d.next !== null);
      } catch (e: unknown) {
        if (live) setError(e instanceof Error ? e.message : 'Could not load profiles.');
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [focusVersion]);

  /* Refresh the deck when the tab regains focus */
  useEffect(() => {
    const refresh = () => setFocusVersion((n) => n + 1);
    const onFocus = () => {
      if (document.visibilityState === 'visible') refresh();
    };
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
        const [vd, incoming, outgoing, shortlists, passedList, entitlementsData] = await Promise.all([
          fetchApi<unknown>('/profile-visitors/').catch(() => null),
          fetchApi<unknown>('/interests/?type=incoming').catch(() => null),
          getInterests('outgoing').catch(() => []),
          getShortlists().catch(() => ({ count: 0, results: [] })),
          fetchPassedProfilesFromBackend().catch(() => getLocalPassedProfiles()),
          fetchApi<{ data?: { usage?: { interests_remaining_today?: number | null } }; usage?: { interests_remaining_today?: number | null } }>('/member/entitlements/').catch(() => null),
        ]);
        if (!live) return;

        const remainingToday = entitlementsData?.data?.usage?.interests_remaining_today ?? entitlementsData?.usage?.interests_remaining_today;
        if (remainingToday === 0) {
          setDailyInterestsDone(true);
        }

        const vs = Array.isArray((vd as { results?: unknown[] })?.results)
          ? (vd as { results: unknown[] }).results
          : Array.isArray(vd)
          ? vd
          : [];
        const visitorItems = vs
          .map((v) => extractMember(v, '/visitors'))
          .filter((m): m is SidebarMemberItem => Boolean(m?.photo));
        setVisitors({
          count: (vd as { total_unique_visitors?: number })?.total_unique_visitors ?? vs.length,
          items: visitorItems,
          photos: visitorItems.map((v) => v.photo),
        });

        const rs = Array.isArray((incoming as { results?: unknown[] })?.results)
          ? (incoming as { results: unknown[] }).results
          : Array.isArray(incoming)
          ? incoming
          : [];
        const matchItems = rs
          .map((r) => extractMember(r, '/interests/received'))
          .filter((m): m is SidebarMemberItem => Boolean(m?.photo));
        setMatches({
          count: rs.length,
          items: matchItems,
          photos: matchItems.map((m) => m.photo),
        });

        const outgoingList = Array.isArray(outgoing) ? outgoing : [];

        // Build set of liked profile IDs (mutually exclusive with passed)
        const likedIds = new Set<string>();
        for (const interest of outgoingList) {
          const receiverId = interest?.receiver?.id || interest?.receiver?.user_id || interest?.receiver_id || interest?.receiver?.pk;
          if (receiverId) {
            const sId = String(receiverId);
            interested.current.add(sId);
            likedIds.add(sId);
          }
        }
        setSentLikesCount(likedIds.size);

        // Sanitize local passed storage so liked profiles are never kept as passed
        cleanPassedAgainstLikes(likedIds);

        for (const profile of shortlists.results ?? []) {
          if (profile.id) shortlisted.current.add(profile.id);
        }

        const rawPassed = Array.isArray(passedList) ? passedList : getLocalPassedProfiles();
        // Strictly mutually exclusive: passed count only includes profiles that were NOT liked
        const truePassedList = rawPassed.filter((item) => item?.id && !likedIds.has(String(item.id)));
        for (const item of truePassedList) {
          if (item?.id) hidden.current.add(String(item.id));
        }
        setPassedCount(truePassedList.length);
        setDismissedVersion((v) => v + 1);
      } catch {
        /* best-effort */
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  /* Reset drag offset whenever filters change */
  useEffect(() => {
    setDragOffset({ x: 0, y: 0 });
    setFlingDir(null);
  }, [filters, tab]);

  /* ── Deck ── */
  const matchingProfiles = useMemo(
    () => profiles.filter((p) => matchesFilters(p, filters, tab)),
    [profiles, filters, tab]
  );

  const deck = useMemo(() => {
    return matchingProfiles.filter((p) => {
      const id = String(p.id);
      const userId = (p as unknown as Record<string, string>).user_id ? String((p as unknown as Record<string, string>).user_id) : '';
      const memberId = (p as unknown as Record<string, string>).member_id ? String((p as unknown as Record<string, string>).member_id) : '';

      // Exclude if already sent interest
      if (
        (id && interested.current.has(id)) ||
        (userId && interested.current.has(userId)) ||
        (memberId && interested.current.has(memberId))
      ) {
        return false;
      }

      // Exclude if disliked / passed or swiped in session
      if (
        (id && hidden.current.has(id)) ||
        (userId && hidden.current.has(userId)) ||
        (memberId && hidden.current.has(memberId))
      ) {
        return false;
      }

      return true;
    });
  }, [matchingProfiles, dismissedVersion]);

  const appendMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const np = page + 1;
      const d = await getProfiles({ page: String(np), page_size: '12', ordering: '-created_at' });
      setPage(np);
      setProfiles((cur) => dedupeProfiles([...cur, ...d.results]));
      setHasMore(d.next !== null);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : 'Could not load more.', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, loading, hasMore, showToast]);

  /* Pre-fetch next page when 5 or fewer cards remain */
  useEffect(() => {
    if (hasMore && !loading && deck.length <= 5 && deck.length > 0) {
      void appendMore();
    }
  }, [deck.length, hasMore, loading, appendMore]);

  /* Auto-refill when deck is initially empty but more pages exist on server */
  useEffect(() => {
    if (loading || !hasMore || deck.length > 0) return;
    void appendMore();
  }, [deck.length, hasMore, loading, appendMore]);

  /* ── Smooth Swipe Trigger ── */
  const triggerSwipe = useCallback(
    (dir: 'left' | 'right') => {
      if (isAnimatingOutRef.current) return;
      const currentCard = deck[0];
      if (!currentCard) return;

      isAnimatingOutRef.current = true;
      setFlingDir(dir);
      if (!hintGone) setHintGone(true);

      const cardId = String(currentCard.id);

      // Save action — liked and passed are mutually exclusive
      if (dir === 'right') {
        if (dailyInterestsDone) {
          setDailyLimitModalOpen(true);
          showToast('Daily interests completed for today. Upgrade to Premium for unlimited likes!', 'info');
          setDragOffset({ x: 0, y: 0 });
          setFlingDir(null);
          setIsDragging(false);
          isAnimatingOutRef.current = false;
          return;
        }

        // Like: remove from passed if previously passed
        const wasAlreadyPassed = getLocalPassedProfiles().some((p) => String(p.id) === cardId);
        if (wasAlreadyPassed) {
          removePassedProfile(cardId);
          setPassedCount((prev) => Math.max(0, prev - 1));
        }
        interested.current.add(cardId);
        hidden.current.add(cardId);
        saveDismissedIds(hidden.current);
        setSentLikesCount((prev) => prev + 1);
        // Optimistically show success, then roll back cleanly on limit/plan errors
        void sendInterest(currentCard.id).then(() => {
          showToast('Interest sent successfully.', 'success');
        }).catch((err: unknown) => {
          const fb = interestFeedback(err);
          if (fb.isDailyLimit) {
            setDailyInterestsDone(true);
            setDailyLimitModalOpen(true);
            showToast('Daily interests completed for today. Upgrade for unlimited likes!', 'info');
          } else if (fb.isMembershipRequired) {
            setDailyLimitModalOpen(true);
            showToast(fb.message, 'info');
          } else {
            showToast(fb.message, fb.tone);
          }
          // Roll back optimistic update cleanly
          interested.current.delete(cardId);
          hidden.current.delete(cardId);
          saveDismissedIds(hidden.current);
          setSentLikesCount((prev) => Math.max(0, prev - 1));
          setDismissedVersion((v) => v + 1);
        });
      } else {
        // Pass: remove from liked count if previously liked (edge case)
        const wasAlreadyLiked = interested.current.has(cardId);
        if (wasAlreadyLiked) {
          interested.current.delete(cardId);
          setSentLikesCount((prev) => Math.max(0, prev - 1));
        }
        savePassedProfile(currentCard);
        setPassedCount((prev) => (wasAlreadyLiked ? prev : prev + 1));
        hidden.current.add(cardId);
        saveDismissedIds(hidden.current);
      }

      // Smooth advance after fly-off animation
      window.setTimeout(() => {
        setSwipedHistory((prev) => [...prev.slice(-10), currentCard]);
        setFlingDir(null);
        setDragOffset({ x: 0, y: 0 });
        setIsDragging(false);
        isAnimatingOutRef.current = false;
        setDismissedVersion((v) => v + 1);
      }, 300);
    },
    [deck, hintGone, showToast]
  );

  const handleShortlist = useCallback(
    async (id: string) => {
      try {
        const r = await toggleShortlist(id);
        if (r.shortlisted) shortlisted.current.add(id);
        else shortlisted.current.delete(id);
        showToast(r.action === 'added' ? 'Added to shortlist' : 'Removed from shortlist', 'success');
      } catch {
        showToast('Shortlist could not be updated.', 'error');
      }
    },
    [showToast]
  );

  const handleHide = useCallback(
    (id: string) => {
      hidden.current.add(id);
      saveDismissedIds(hidden.current);
      showToast('Profile hidden.', 'success');
      triggerSwipe('left');
    },
    [showToast, triggerSwipe]
  );

  const handleBlock = useCallback(
    async (id: string) => {
      hidden.current.add(id);
      saveDismissedIds(hidden.current);
      try {
        await fetchApi('/blocks/', { method: 'POST', body: JSON.stringify({ profile_id: id }) });
      } catch {
        /* ignore */
      }
      showToast('Profile blocked.', 'success');
      triggerSwipe('left');
    },
    [showToast, triggerSwipe]
  );

  const handleReport = useCallback(
    async (id: string) => {
      hidden.current.add(id);
      saveDismissedIds(hidden.current);
      try {
        await fetchApi('/profile-reports/', {
          method: 'POST',
          body: JSON.stringify({ profile_id: id, reason: 'Reported from Discover' }),
        });
      } catch {
        /* ignore */
      }
      showToast('Report submitted.', 'success');
      triggerSwipe('left');
    },
    [showToast, triggerSwipe]
  );

  /* ── Keyboard Shortcuts ── */
  useEffect(() => {
    const p = deck[0];
    if (!p) return;
    const fn = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') triggerSwipe('right');
      else if (e.key === 'ArrowLeft') triggerSwipe('left');
      else if (e.key === 'ArrowUp') window.location.assign(profileHref(p));
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [deck, triggerSwipe]);

  /* ── Pointer Drag Handlers ── */
  const onPD = (e: React.PointerEvent) => {
    if (isAnimatingOutRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select, textarea, [role="button"], .pc-actions, .pc-more-btn')) return;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    ptrRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
    setIsDragging(true);
  };

  const onPM = (e: React.PointerEvent) => {
    const s = ptrRef.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    // Strictly lock vertical translation to 0 - only horizontal sliding is allowed
    setDragOffset({ x: dx, y: 0 });
  };

  const onPU = (e: React.PointerEvent) => {
    const s = ptrRef.current;
    ptrRef.current = null;
    setIsDragging(false);

    if (!s) {
      setDragOffset({ x: 0, y: 0 });
      return;
    }

    try {
      if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      }
    } catch {
      /* ignore */
    }

    const dx = e.clientX - s.x;
    const dt = Math.max(1, Date.now() - s.time);
    const vx = Math.abs(dx) / dt;

    const hasDistance = Math.abs(dx) > 75;
    const hasFlick = Math.abs(dx) > 30 && vx > 0.38;

    if (hasDistance || hasFlick) {
      triggerSwipe(dx > 0 ? 'right' : 'left');
    } else {
      setDragOffset({ x: 0, y: 0 });
    }
  };

  const onDoubleTap = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, a, [role="button"]')) return;
    const p = deck[0];
    if (p) window.location.assign(profileHref(p));
  };

  /* ── Derived & Stack calculations ── */
  const active = deck[0];
  const nextCard = deck[1] && deck[1].id !== active?.id ? deck[1] : undefined;

  const completion = typeof user?.completion_percentage === 'number' ? user.completion_percentage : 60;
  const planName = (user as unknown as Record<string, Record<string, string>>)?.active_membership?.plan_name || 'Free Plan';
  const isPremium = Boolean((user as unknown as Record<string, unknown>)?.is_premium);

  const dragProgress = Math.min(1, Math.abs(dragOffset.x) / 140);
  const underScale = 0.95 + dragProgress * 0.05;
  const underOpacity = 0.85 + dragProgress * 0.15;

  const centerTransform = useMemo(() => {
    if (isDragging) {
      return {
        transform: `translate3d(${dragOffset.x}px, 0, 0) rotate(${dragOffset.x * 0.038}deg)`,
        transition: 'none',
      };
    }
    if (flingDir === 'right') {
      return {
        transform: 'translate3d(min(850px, 140vw), 0, 0) rotate(16deg)',
        transition: 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease-out',
        opacity: 0,
      };
    }
    if (flingDir === 'left') {
      return {
        transform: 'translate3d(max(-850px, -140vw), 0, 0) rotate(-16deg)',
        transition: 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.32s ease-out',
        opacity: 0,
      };
    }
    // Elastic spring snap-back: strictly horizontal reset
    return {
      transform: 'translate3d(0, 0, 0) rotate(0deg)',
      transition: 'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)',
    };
  }, [isDragging, dragOffset.x, flingDir]);

  /* ── Render ── */
  return (
    <>
      <style>{CSS}</style>
      <div className="d-root discover-root">
        <div className="d-body">
          {/* Main */}
          <div className="d-main">
            {/* Card area */}
            <div
              className="d-card-area"
              onPointerDown={onPD}
              onPointerMove={onPM}
              onPointerUp={onPU}
              onPointerCancel={onPU}
              onDoubleClick={onDoubleTap}
            >


              {/* Next card under the active card for smooth stack effect */}
              {nextCard && (
                <div
                  className="d-center-under"
                  style={{
                    transform: `scale(${underScale})`,
                    opacity: underOpacity,
                    transition: isDragging ? 'none' : 'transform 0.32s ease, opacity 0.32s ease',
                    zIndex: 6,
                  }}
                >
                  <ProfileCard
                    profile={nextCard}
                    interested={interested.current.has(nextCard.id)}
                    shortlisted={shortlisted.current.has(nextCard.id)}
                    onInterest={() => {}}
                    onShortlist={() => {}}
                    onPass={() => {}}
                    onMore={() => {}}
                    isUnderCard
                  />
                </div>
              )}

              {/* Active top card */}
              {active && (
                <div
                  className="d-center"
                  style={{
                    ...centerTransform,
                    touchAction: 'none',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    zIndex: 10,
                  }}
                >
                  <ProfileCard
                    key={active.id}
                    profile={active}
                    interested={interested.current.has(active.id)}
                    shortlisted={shortlisted.current.has(active.id)}
                    onInterest={() => triggerSwipe('right')}
                    onShortlist={handleShortlist}
                    onPass={() => triggerSwipe('left')}
                    onMore={setMoreFor}
                    dragOffset={dragOffset}
                    flingDir={flingDir}
                  />
                  {moreFor === active.id && (
                    <MoreMenu
                      id={active.id}
                      onClose={() => setMoreFor(null)}
                      onBlock={handleBlock}
                      onReport={handleReport}
                      onHide={handleHide}
                    />
                  )}
                </div>
              )}

              {/* Initial Loading Skeleton */}
              {loading && profiles.length === 0 && (
                <div className="d-center" style={{ zIndex: 10 }}>
                  <Skeleton />
                </div>
              )}

              {/* Finding fresh matches state */}
              {loading && deck.length === 0 && profiles.length > 0 && (
                <div className="d-center" style={{ zIndex: 10 }}>
                  <div className="d-state">
                    <span className="d-state-spin" />
                    <h3 className="d-state-title">Finding fresh matches…</h3>
                    <p className="d-state-sub">Scanning the latest profiles for you.</p>
                  </div>
                </div>
              )}

              {/* Error state */}
              {!loading && error && profiles.length === 0 && (
                <div className="d-center" style={{ zIndex: 10 }}>
                  <div className="d-state">
                    <div className="d-state-icon"><X size={22} color="#9B3F5F" /></div>
                    <h3 className="d-state-title">Something went wrong</h3>
                    <p className="d-state-sub">{error}</p>
                    <button
                      type="button"
                      className="d-state-btn"
                      onClick={() => {
                        setProfiles([]);
                        setPage(1);
                        setHasMore(true);
                      }}
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}

              {/* Empty Deck state (when all profiles for current filter have been viewed) */}
              {!loading && !error && deck.length === 0 && (
                <div className="d-center flex items-center justify-center" style={{ zIndex: 10 }}>
                  <div className="d-empty-card">
                    <div className="d-empty-card-glow" />
                    <div className="d-empty-badge">
                      <span>Discover Feed</span>
                    </div>
                    <div className="d-empty-icon-box">
                      <Heart size={26} className="text-[#9B3F5F]" fill="none" strokeWidth={2.2} />
                    </div>
                    <h3 className="d-empty-title">You&apos;re All Caught Up</h3>
                    <p className="d-empty-desc">
                      You have reviewed all available profiles for your current filters. Adjust your criteria or search all members to discover fresh matches.
                    </p>
                    <div className="d-empty-actions">
                      <button
                        type="button"
                        className="d-empty-btn-primary"
                        onClick={() => {
                          setFilters(DEFAULT_FILTERS);
                          setTab('all');
                          resetDismissed();
                        }}
                      >
                        <RotateCcw size={15} />
                        <span>Reset Filters</span>
                      </button>
                      <Link href="/search" className="d-empty-btn-secondary">
                        <ArrowRight size={15} />
                        <span>Find Matches</span>
                      </Link>
                    </div>
                  </div>
                </div>
              )}


            </div>

            {/* Hint */}
            {active && (
              <div className={`d-hint${hintGone ? ' leaving' : ''}`}>
                <span className="d-hint-arrow d-hint-left">←</span>
                <span className="d-hint-text">Swipe • Double tap for profile</span>
                <span className="d-hint-arrow d-hint-right">→</span>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="d-right">
            <RightPanel
              completion={completion}
              visitors={visitors}
              matches={matches}
              sentCount={sentLikesCount}
              passedCount={passedCount}
              isPremium={isPremium}
              planName={planName}
            />
          </div>
        </div>

        <FilterDialog
          open={filterOpen}
          onClose={() => setFilter(false)}
          filters={filters}
          onApply={(f) => {
            setFilters(f);
          }}
          onReset={() => {
            setFilters(DEFAULT_FILTERS);
            setTab('all');
            resetDismissed();
          }}
        />

        <DailyLimitModal
          open={dailyLimitModalOpen}
          onClose={() => setDailyLimitModalOpen(false)}
          onShortlistCurrent={() => {
            if (deck[0]) void handleShortlist(deck[0].id);
          }}
        />
      </div>
    </>
  );
}
