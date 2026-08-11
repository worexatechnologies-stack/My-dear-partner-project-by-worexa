'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from '@/lib/router-compat';
import {
  AlertTriangle, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Download, FileText,
  Filter, Inbox, LoaderCircle, Paperclip, PhoneCall, Plus, RefreshCw,
  Search, Send, UserCheck, X, Image as ImageIcon, File as FileIcon, MessageSquare, Users, ShieldCheck, CornerDownLeft, Tag, ArrowRight, Lock, RotateCcw, Calendar, Trash2
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getTicketsV2,
  getTicketDetailV2,
  ticketActionV2,
  replyToTicketV2,
  getTicketMessagesV2,
  getQueueCountsV2,
  getUnreadCountsV2,
  getDashboardV2,
  markTicketReadV2,
  type SupportTicketV2,
  type SupportTicketReply,
  type QueueCounts,
  type PaginatedResult,
  type TimelineEvent,
  type AdminIdentity,
} from '../../services/adminService';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
  UNASSIGNED: 'bg-slate-100 text-slate-700 border border-slate-300',
  ASSIGNED: 'bg-sky-100 text-sky-800 border border-sky-300',
  IN_PROGRESS: 'bg-indigo-100 text-indigo-800 border border-indigo-300',
  WAITING_FOR_MEMBER: 'bg-amber-100 text-amber-800 border border-amber-300',
  WAITING_FOR_INTERNAL: 'bg-orange-100 text-orange-800 border border-orange-300',
  RESOLVED: 'bg-teal-100 text-teal-800 border border-teal-300',
  CLOSED: 'bg-slate-200 text-slate-700 border border-slate-300',
  REOPENED: 'bg-rose-100 text-rose-800 border border-rose-300',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700 border border-slate-300',
  NORMAL: 'bg-rose-100 text-rose-800 border border-rose-300',
  HIGH: 'bg-amber-100 text-amber-800 border border-amber-300',
  URGENT: 'bg-rose-100 text-rose-800 border border-rose-300 font-bold',
};

const QUEUES = [
  { key: 'all', label: 'All Tickets', icon: Inbox },
  { key: 'open', label: 'Open', icon: MessageSquare },
  { key: 'in_progress', label: 'In Progress', icon: LoaderCircle },
  { key: 'waiting_for_member', label: 'Waiting Member', icon: Clock },
  { key: 'waiting_for_internal', label: 'Waiting Internal', icon: Clock },
  { key: 'resolved', label: 'Resolved', icon: Check },
  { key: 'closed', label: 'Closed', icon: X },
  { key: 'reopened', label: 'Reopened', icon: AlertTriangle },
  { key: 'urgent', label: 'Urgent', icon: AlertTriangle },
  { key: 'overdue', label: 'Overdue', icon: AlertTriangle },
  { key: 'assigned_to_me', label: 'My Tickets', icon: UserCheck },
];

const PAGE_SIZE = 25;
const DEBOUNCE_MS = 400;

function formatFullDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentsView({ items }: { items: any[] }) {
  if (!items?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {items.map((att: any) => {
        const isImage = att.mime_type?.startsWith('image/');
        if (isImage) {
          return (
            <a key={att.id} href={att.download_url} target="_blank" rel="noreferrer"
              className="group relative overflow-hidden rounded-xl border border-slate-300 max-w-[200px] shadow-xs">
              <img src={att.download_url} alt={att.original_filename}
                className="max-h-32 w-full object-cover rounded-xl" />
              <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Download className="w-5 h-5 text-white" />
              </div>
            </a>
          );
        }
        return (
          <a key={att.id} href={att.download_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 border border-slate-300 text-xs text-slate-800 hover:bg-slate-200 transition-colors shadow-xs">
            <FileText className="w-4 h-4 text-rose-600" />
            <span className="truncate max-w-[150px] font-medium">{att.original_filename}</span>
          </a>
        );
      })}
    </div>
  );
}

type ViewMode = 'list' | 'detail' | 'both';

export default function AdminTicketsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { id: routeTicketId } = useParams<{ id?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, hasAdminPermission } = useAuth();

  const isSuperAdmin = user?.account_type === 'SUPER_ADMIN' || user?.is_superuser;
  const canViewAll = true;
  const canAssign = true;
  const canReply = true;
  const assignedOnly = false;

  // ── State ─────────────────────────────────────────────────────────
  const [tickets, setTickets] = useState<SupportTicketV2[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketV2 | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [queueCounts, setQueueCounts] = useState<QueueCounts | null>(null);

  const [currentQueue, setCurrentQueue] = useState(searchParams.get('queue') || 'all');
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [page, setPage] = useState(Number(searchParams.get('page')) || 1);
  const [sort, setSort] = useState(searchParams.get('sort') || '-created_at');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('date_from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('date_to') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isNote, setIsNote] = useState(false);
  const [replyAttachment, setReplyAttachment] = useState<File | undefined>();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const messagesRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);
  const pageScrollRef = useRef(0);

  const preservePageScroll = () => { pageScrollRef.current = window.scrollY; };
  const restorePageScroll = () => {
    if (pageScrollRef.current > 0) {
      const y = pageScrollRef.current;
      pageScrollRef.current = 0;
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  };

  // Determine view mode based on screen
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  useEffect(() => {
    const check = () => {
      const w = window.innerWidth;
      if (w < 768) setViewMode(selectedTicket ? 'detail' : 'list');
      else setViewMode('both');
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [selectedTicket]);

  // ── API Calls ─────────────────────────────────────────────────────
  const loadTickets = useCallback(async (p?: number) => {
    setLoading(true);
    setError('');
    try {
      const q = p ?? page;
      const res = await getTicketsV2({
        page: q,
        page_size: PAGE_SIZE,
        search: searchTerm || undefined,
        queue: currentQueue === 'all' ? undefined : currentQueue,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort,
      });
      setTickets(res.results);
      setTotalCount(res.count);
      setNumPages(res.num_pages);
    } catch (err: any) {
      setError(err?.message || 'Failed to load tickets.');
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, currentQueue, statusFilter, priorityFilter, dateFrom, dateTo, sort]);

  const loadQueueCounts = useCallback(async () => {
    try {
      const res = await getQueueCountsV2();
      setQueueCounts(res);
    } catch {}
  }, []);

  const loadDetail = useCallback(async (ticketId: string) => {
    setDetailLoading(true);
    try {
      const ticket = await getTicketDetailV2(ticketId);
      setSelectedTicket(ticket);
      const msgs = await getTicketMessagesV2(ticketId);
      setTimeline(msgs);
      markTicketReadV2(ticketId).catch(() => {});
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to load ticket details', tone: 'error' });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ── Effects ───────────────────────────────────────────────────────
  useEffect(() => { loadTickets(); loadQueueCounts(); }, [loadTickets, loadQueueCounts]);

  useEffect(() => {
    if (routeTicketId && routeTicketId !== selectedTicket?.id) {
      loadDetail(routeTicketId);
    }
  }, [routeTicketId, loadDetail]);

  useEffect(() => {
    restorePageScroll();
  }, [tickets]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [timeline]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // ── Search debounce ───────────────────────────────────────────────
  const onSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearchTerm(val);
      setPage(1);
    }, DEBOUNCE_MS);
  };

  // ── Handlers ──────────────────────────────────────────────────────
  const handleSelectTicket = (ticket: SupportTicketV2) => {
    preservePageScroll();
    setSelectedTicket(ticket);
    setTimeline([]);
    setReplyText('');
    setReplyAttachment(undefined);
    loadDetail(ticket.id);
    const root = location.pathname.startsWith('/super-admin') ? '/super-admin/support-tickets' : '/admin/support-tickets';
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', `${root}/${ticket.id}`);
    }
  };

  const handleQueueChange = (queueKey: string) => {
    setCurrentQueue(queueKey);
    setPage(1);
    setSelectedTicket(null);
    setTimeline([]);
    const params = new URLSearchParams();
    if (queueKey !== 'all') params.set('queue', queueKey);
    if (searchTerm) params.set('search', searchTerm);
    setSearchParams(params, { replace: true });
  };

  const handleBack = () => {
    setSelectedTicket(null);
    setTimeline([]);
    const root = location.pathname.startsWith('/super-admin') ? '/super-admin/support-tickets' : '/admin/support-tickets';
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', root);
    }
  };

  const handlePageChange = (newPage: number) => {
    preservePageScroll();
    setPage(newPage);
  };

  const handleTicketAction = async (action: string, extra: Record<string, string> = {}) => {
    if (!selectedTicket) return;
    setBusy(true);
    try {
      const res = await ticketActionV2(selectedTicket.id, action, extra);
      setToast({ message: res.status ? `Status updated to ${res.status}` : 'Action completed', tone: 'success' });
      await loadDetail(selectedTicket.id);
      await loadTickets();
      await loadQueueCounts();
    } catch (err: any) {
      setToast({ message: err?.message || 'Action failed', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || (!replyText.trim() && !replyAttachment)) return;
    setBusy(true);
    try {
      await replyToTicketV2(selectedTicket.id, replyText, isNote, replyAttachment);
      setReplyText('');
      setReplyAttachment(undefined);
      setToast({ message: isNote ? 'Internal note added.' : 'Reply sent successfully.', tone: 'success' });
      await loadDetail(selectedTicket.id);
      await loadTickets();
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to send reply.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const clearAllFilters = () => {
    setStatusFilter('');
    setPriorityFilter('');
    setDateFrom('');
    setDateTo('');
    setSearchInput('');
    setSearchTerm('');
    setPage(1);
  };

  // ── Pagination window ─────────────────────────────────────────────
  const pageWindow = useMemo(() => {
    const total = Math.max(numPages, 1);
    const current = Math.min(page, total);
    let start = Math.max(1, current - 2);
    const end = Math.min(total, start + 4);
    if (end - start < 4) start = Math.max(1, end - 4);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [numPages, page]);

  // ── Render helpers ─────────────────────────────────────────────────
  const renderSkeleton = () => (
    <div className="flex-1 flex flex-col p-4 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse flex flex-col gap-2 p-3.5 rounded-xl bg-slate-100 border border-slate-200">
          <div className="h-3.5 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-300 rounded w-2/3" />
          <div className="h-3 bg-slate-200 rounded w-1/4" />
        </div>
      ))}
    </div>
  );

  const renderTimelineMessage = (event: TimelineEvent) => {
    if (event.type === 'status_change') {
      return (
        <div className="flex justify-center my-3" key={event.id}>
          <div className="bg-slate-100 text-slate-700 text-xs px-3.5 py-1.5 rounded-full border border-slate-300 shadow-xs flex items-center gap-1.5">
            <RotateCcw className="w-3 h-3 text-rose-600" />
            <span>Status changed: <strong className="text-slate-900">{event.old_status}</strong> → <strong className="text-rose-600">{event.new_status}</strong></span>
            {event.reason ? <span className="text-slate-500">({event.reason})</span> : null}
            <span className="text-[10px] text-slate-400 ml-1">· {formatFullDate(event.created_at)}</span>
          </div>
        </div>
      );
    }

    const isStaff = event.sender?.type !== 'member' && event.type !== 'internal_note';
    const isNoteEvent = event.type === 'internal_note' || (event.type === 'note');

    return (
      <div key={event.id} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
        <div className={`max-w-[85%] sm:max-w-[75%] lg:max-w-[65%] ${isStaff ? 'order-1' : ''}`}>
          <div className={`flex items-center gap-2 mb-1 px-1 ${isStaff ? 'justify-end' : ''}`}>
            <span className={`text-[11px] font-bold ${
              isNoteEvent ? 'text-amber-800' : isStaff ? 'text-rose-700' : 'text-slate-800'
            }`}>
              {isNoteEvent ? '🔒 Internal Staff Note' : (event.sender?.name || 'Support Agent')}
            </span>
            <span className="text-[10px] text-slate-500">{formatFullDate(event.created_at)}</span>
          </div>
          <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-xs ${
            isNoteEvent
              ? 'bg-amber-50 border border-amber-300 text-amber-950'
              : isStaff
                ? 'bg-rose-50 border border-rose-200 text-slate-900'
                : 'bg-white border border-slate-200 text-slate-900 shadow-xs'
          }`}>
            <p className="whitespace-pre-wrap">{event.message}</p>
            {event.attachments && event.attachments.length > 0 && (
              <AttachmentsView items={event.attachments} />
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── Main Render ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold border flex items-center gap-2 animate-in fade-in slide-in-from-top-2 ${
          toast.tone === 'success'
            ? 'bg-emerald-800 text-white border-emerald-900'
            : 'bg-rose-800 text-white border-rose-900'
        }`}>
          {toast.tone === 'success' ? <Check className="w-4 h-4 text-emerald-300" /> : <AlertTriangle className="w-4 h-4 text-rose-300" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-white shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          {viewMode === 'detail' && (
            <button onClick={handleBack} className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 lg:hidden transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-xs">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Support Tickets</h1>
              <p className="text-[11px] text-slate-500">Triage, manage, assign, and respond to member inquiries</p>
            </div>
          </div>
          {!loading && (
            <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-2xs">
              {totalCount.toLocaleString()} tickets total
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { loadTickets(); loadQueueCounts(); }}
            title="Refresh tickets"
            className="p-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Queue Filter Pills Bar */}
      <div className="flex overflow-x-auto gap-2 px-5 py-2.5 border-b border-slate-200 bg-slate-100/70 shrink-0 scrollbar-thin">
        {QUEUES.map(q => {
          const count = queueCounts ? (queueCounts as any)[q.key] ?? 0 : 0;
          const isActive = currentQueue === q.key;
          return (
            <button key={q.key} onClick={() => handleQueueChange(q.key)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-rose-600 text-white font-bold shadow-xs border border-rose-700'
                  : 'bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-200 shadow-2xs'
              }`}>
              <q.icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              <span>{q.label}</span>
              {count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-800 border border-slate-200'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Workspace Area: Left List + Right Detail */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left List Pane */}
        {(viewMode !== 'detail') && (
          <div className="w-full md:w-80 lg:w-96 border-r border-slate-200 bg-white flex flex-col min-h-0 shrink-0 shadow-2xs">
            {/* Search & Advanced Filters Bar */}
            <div className="p-3 border-b border-slate-200 bg-slate-50/80 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={e => onSearchChange(e.target.value)}
                    placeholder="Search tickets by #, subject, member..."
                    className="w-full pl-9 pr-8 py-2 rounded-xl bg-white border border-slate-300 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600/30 transition-all shadow-2xs"
                  />
                  {searchInput && (
                    <button onClick={() => onSearchChange('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                    showFilters || statusFilter || priorityFilter || dateFrom || dateTo
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs'
                  }`}
                  title="Toggle advanced filters"
                >
                  <Filter className="w-4 h-4" />
                </button>
              </div>

              {/* Expanded Filters Drawer (Date Range, Status, Priority, Sort) */}
              {showFilters && (
                <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs space-y-2.5 animate-in fade-in slide-in-from-top-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-rose-600" /> Date From
                      </label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-rose-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-rose-600" /> Date To
                      </label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={e => { setDateTo(e.target.value); setPage(1); }}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:outline-none focus:border-rose-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                      <select
                        value={statusFilter}
                        onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:outline-none"
                      >
                        <option value="">All Statuses</option>
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="WAITING_FOR_MEMBER">Waiting Member</option>
                        <option value="WAITING_FOR_INTERNAL">Waiting Internal</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Priority</label>
                      <select
                        value={priorityFilter}
                        onChange={e => { setPriorityFilter(e.target.value); setPage(1); }}
                        className="w-full px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:outline-none"
                      >
                        <option value="">All Priorities</option>
                        <option value="LOW">Low</option>
                        <option value="NORMAL">Normal</option>
                        <option value="HIGH">High</option>
                        <option value="URGENT">Urgent</option>
                      </select>
                    </div>
                  </div>

                  {(statusFilter || priorityFilter || dateFrom || dateTo || searchTerm) && (
                    <button
                      onClick={clearAllFilters}
                      className="w-full py-1 text-center text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Ticket Cards List */}
            {loading ? renderSkeleton() : (
              <div className="flex-1 overflow-y-auto divide-y divide-slate-200">
                {error && (
                  <div className="p-6 text-center">
                    <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-600 mb-3">{error}</p>
                    <button onClick={() => loadTickets()} className="px-4 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors cursor-pointer">Retry</button>
                  </div>
                )}
                {!error && tickets.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <Inbox className="w-10 h-10 text-slate-400 mb-2" />
                    <p className="text-xs font-bold text-slate-700">No tickets found</p>
                    <p className="text-[11px] text-slate-500 mt-1">Try resetting filters or search term</p>
                  </div>
                )}
                {!error && tickets.map(ticket => {
                  const isSelected = selectedTicket?.id === ticket.id;
                  const isOverdue = ticket.is_overdue;
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => handleSelectTicket(ticket)}
                      className={`w-full text-left p-3.5 transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-rose-50/80 border-l-4 border-l-rose-600 shadow-2xs'
                          : 'hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-mono text-rose-600 font-bold">#{ticket.ticket_number}</span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${PRIORITY_COLORS[ticket.priority] || ''}`}>
                          {ticket.priority}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 line-clamp-1 mb-1">{ticket.subject}</p>
                      <p className="text-[11px] text-slate-600 line-clamp-1 mb-2">
                        <strong className="text-slate-800 font-semibold">{ticket.user?.full_name || 'Member'}:</strong>{' '}
                        {ticket.last_message_preview || ticket.message || ''}
                      </p>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${STATUS_COLORS[ticket.status] || ''}`}>
                          {ticket.status === 'UNASSIGNED' ? 'OPEN' : ticket.status.replace(/_/g, ' ')}
                        </span>
                        <div className="flex items-center gap-2 text-slate-500">
                          {isOverdue && <span className="text-rose-600 font-bold flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> Overdue</span>}
                          <span>{formatFullDate(ticket.last_reply_at || ticket.created_at)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}

                {/* Pagination */}
                {numPages > 1 && (
                  <div className="flex items-center justify-between p-3 border-t border-slate-200 bg-slate-50 text-xs">
                    <span className="text-slate-500 font-medium text-[11px]">
                      Page <strong>{page}</strong> of <strong>{numPages}</strong>
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handlePageChange(page - 1)} disabled={page <= 1}
                        className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 shadow-2xs transition-colors cursor-pointer">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      {pageWindow.map(p => (
                        <button key={p} onClick={() => handlePageChange(p)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                            p === page ? 'bg-rose-600 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}>
                          {p}
                        </button>
                      ))}
                      <button onClick={() => handlePageChange(page + 1)} disabled={page >= numPages}
                        className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-40 shadow-2xs transition-colors cursor-pointer">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Right Detail Pane */}
        {(viewMode !== 'list') && (
          <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
            {!selectedTicket ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 mb-3 shadow-xs">
                  <MessageSquare className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-sm font-bold text-slate-800 mb-1">No Ticket Selected</h3>
                <p className="text-xs text-slate-500 max-w-sm">Choose a ticket from the left list to view complete discussion history, manage status, and send public replies or private staff notes.</p>
              </div>
            ) : detailLoading ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <LoaderCircle className="w-8 h-8 animate-spin text-rose-600 mb-2" />
                <span className="text-xs text-slate-600 font-bold">Loading ticket conversation...</span>
              </div>
            ) : (
              <>
                {/* Header Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3.5 border-b border-slate-200 bg-white shrink-0 shadow-2xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <button onClick={handleBack} className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500 to-pink-700 flex items-center justify-center text-base font-bold text-white shrink-0 shadow-md">
                      {(selectedTicket.user?.full_name || 'M').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold text-slate-900 truncate">{selectedTicket.user?.full_name || 'Member'}</h2>
                      <p className="text-xs text-slate-500 truncate font-mono">
                        #{selectedTicket.ticket_number} · <span className="text-rose-600 font-bold">{selectedTicket.category_name}</span>
                      </p>
                    </div>
                  </div>

                  {/* Action Badges & Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${STATUS_COLORS[selectedTicket.status] || ''}`}>
                      {selectedTicket.status === 'UNASSIGNED' ? 'OPEN' : selectedTicket.status.replace(/_/g, ' ')}
                    </span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${PRIORITY_COLORS[selectedTicket.priority] || ''}`}>
                      {selectedTicket.priority}
                    </span>

                    {/* Status Action Buttons */}
                    {selectedTicket.status === 'RESOLVED' && (
                      <button
                        onClick={() => handleTicketAction('reopen', { reason: 'Reopened by support agent' })}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reopen Ticket
                      </button>
                    )}
                    {selectedTicket.status !== 'CLOSED' && selectedTicket.status !== 'RESOLVED' && (
                      <button
                        onClick={() => handleTicketAction('resolve', { summary: prompt('Resolution summary for member:') || 'Issue resolved.' })}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                      >
                        <Check className="w-3.5 h-3.5" /> Resolve
                      </button>
                    )}
                    {selectedTicket.status !== 'CLOSED' && (
                      <button
                        onClick={() => handleTicketAction('close', { reason: prompt('Reason for closing:') || 'Closed by admin.' })}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 border border-slate-300 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        Close
                      </button>
                    )}

                  </div>
                </div>

                {/* SLA & Assignee Banner */}
                <div className={`px-6 py-2.5 text-xs font-medium border-b flex flex-col gap-2 ${
                  selectedTicket.is_overdue
                    ? 'bg-rose-100 text-rose-900 border-rose-300'
                    : 'bg-white text-slate-600 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Created: <strong>{formatFullDate(selectedTicket.created_at)}</strong> ({timeAgo(selectedTicket.created_at)})</span>
                      {selectedTicket.sla_deadline && (
                        <span className="ml-3 font-semibold">SLA Deadline: {formatFullDate(selectedTicket.sla_deadline)}</span>
                      )}
                      {selectedTicket.is_overdue && <span className="font-bold text-rose-700 ml-1">(OVERDUE)</span>}
                    </div>
                    {selectedTicket.assigned_to && (
                      <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                        <UserCheck className="w-3.5 h-3.5 text-rose-600" />
                        <span>Assigned Agent: {selectedTicket.assigned_to.full_name}</span>
                      </div>
                    )}
                  </div>

                  {selectedTicket.resolved_by && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs flex items-center justify-between text-emerald-900 shadow-2xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <span className="font-bold">Resolved by: </span>
                          <span className="font-black text-emerald-950">{selectedTicket.resolved_by.full_name}</span>
                          {selectedTicket.resolved_by.admin_id && (
                            <span className="ml-1.5 px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-950 font-extrabold text-[10px]">
                              ID: {selectedTicket.resolved_by.admin_id}
                            </span>
                          )}
                          {selectedTicket.resolved_by.email && (
                            <span className="ml-2 font-medium text-emerald-800">
                              ({selectedTicket.resolved_by.email})
                            </span>
                          )}
                          {selectedTicket.resolved_by.mobile_number && (
                            <span className="ml-2 font-medium text-emerald-800">
                              · Ph: {selectedTicket.resolved_by.mobile_number}
                            </span>
                          )}
                        </div>
                      </div>
                      {selectedTicket.resolved_at && (
                        <span className="text-[11px] font-semibold text-emerald-700 shrink-0">
                          {formatFullDate(selectedTicket.resolved_at)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Messages Timeline Scroll Area */}
                <div ref={messagesRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                  {/* Initial Member Subject & Message */}
                  <div className="flex justify-start">
                    <div className="max-w-[85%] sm:max-w-[75%] lg:max-w-[65%]">
                      <div className="flex items-center gap-2 mb-1 px-1">
                        <span className="text-[11px] font-bold text-slate-800">{selectedTicket.user?.full_name || 'Member'}</span>
                        <span className="text-[10px] text-slate-500">{formatFullDate(selectedTicket.created_at)}</span>
                      </div>
                      <div className="rounded-2xl px-5 py-4 text-sm leading-relaxed bg-white border border-slate-200 text-slate-900 shadow-xs">
                        <p className="font-bold text-base text-slate-900 mb-2 pb-2 border-b border-slate-200">{selectedTicket.subject}</p>
                        <p className="whitespace-pre-wrap text-slate-800">{selectedTicket.message}</p>
                        {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                          <AttachmentsView items={selectedTicket.attachments} />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reply Timeline Events */}
                  {timeline.map(event => renderTimelineMessage(event))}
                </div>

                {/* Bottom Reply & Note Bar with File Preview & Remove Button */}
                <div className="border-t border-slate-200 bg-white p-4 shrink-0 shadow-lg">
                  {selectedTicket.status === 'CLOSED' ? (
                    <div className="flex items-center justify-between bg-slate-100 rounded-xl p-3 border border-slate-300 text-xs text-slate-700">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">This ticket is currently closed.</span>
                      </div>
                      <button
                        onClick={() => handleTicketAction('reopen', { reason: 'Reopened by support agent to reply' })}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors cursor-pointer shadow-xs"
                      >
                        Reopen & Reply
                      </button>
                    </div>
                  ) : canReply ? (
                    <form onSubmit={handleSendReply} className="space-y-3">
                      {/* Mode Selector Tabs */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsNote(false)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              !isNote
                                ? 'bg-rose-600 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                            }`}
                          >
                            <Send className="w-3 h-3" /> Public Reply
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsNote(true)}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              isNote
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                            }`}
                          >
                            <Lock className="w-3 h-3" /> Internal Staff Note
                          </button>
                        </div>
                      </div>

                      {/* File Attachment Selected Preview Box with REMOVE Button */}
                      {replyAttachment && (
                        <div className="flex items-center justify-between bg-rose-50 border border-rose-200 px-3.5 py-2 rounded-xl text-xs text-rose-900 animate-in fade-in slide-in-from-bottom-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileIcon className="w-4 h-4 text-rose-600 shrink-0" />
                            <span className="font-bold truncate max-w-[200px]">{replyAttachment.name}</span>
                            <span className="text-[10px] text-rose-700 bg-rose-200/60 px-1.5 py-0.5 rounded font-mono">
                              {formatFileSize(replyAttachment.size)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setReplyAttachment(undefined)}
                            className="px-2 py-1 rounded-lg bg-rose-200 hover:bg-rose-300 text-rose-900 font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                            title="Remove attached file"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-rose-700" /> Remove File
                          </button>
                        </div>
                      )}

                      {/* Text Input Row */}
                      <div className="flex items-end gap-3">
                        <div className="flex-1 relative">
                          <textarea
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                            placeholder={isNote ? 'Write an internal staff note (visible only to admins)...' : 'Type your reply to member...'}
                            rows={2}
                            className={`w-full px-4 py-3 rounded-2xl border text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 resize-none transition-all shadow-2xs ${
                              isNote
                                ? 'bg-amber-50/50 border-amber-300 focus:border-amber-600 focus:ring-amber-500/20'
                                : 'bg-white border-slate-300 focus:border-rose-600 focus:ring-rose-600/20'
                            }`}
                          />
                          <label
                            className="absolute right-3 bottom-3 p-1.5 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer transition-colors border border-slate-200 bg-white shadow-2xs"
                            title="Attach photo or document"
                          >
                            <Paperclip className="w-4 h-4 text-slate-600" />
                            <input
                              type="file"
                              accept=".jpeg,.jpg,.png,.webp,.pdf,.doc,.docx"
                              onChange={e => setReplyAttachment(e.target.files?.[0])}
                              className="hidden"
                            />
                          </label>
                        </div>

                        <button
                          type="submit"
                          disabled={busy || (!replyText.trim() && !replyAttachment)}
                          className={`px-5 py-3 rounded-2xl font-bold text-xs transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 ${
                            isNote
                              ? 'bg-amber-600 hover:bg-amber-700 text-white disabled:opacity-40 disabled:cursor-not-allowed'
                              : 'bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40 disabled:cursor-not-allowed'
                          }`}
                        >
                          {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          <span>{isNote ? 'Save Note' : 'Send Reply'}</span>
                        </button>
                      </div>
                    </form>
                  ) : null}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
