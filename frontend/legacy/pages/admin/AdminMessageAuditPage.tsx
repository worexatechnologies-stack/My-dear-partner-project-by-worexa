'use client';

import { type UIEvent, useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Search, ShieldAlert } from 'lucide-react';
import { fetchApi } from '../../services/apiClient';

type Conversation = {
  id: string;
  member_a: { id: string; name: string; email?: string | null; phone?: string | null };
  member_b: { id: string; name: string; email?: string | null; phone?: string | null };
  started_at: string;
  last_activity: string;
  message_count: number;
  deleted_count: number;
  last_message: string;
};

type AuditMessage = {
  id: string;
  sender_name: string;
  receiver_name: string;
  text: string;
  status: string;
  message_type: string;
  created_at: string;
  deleted_at?: string | null;
  deletion_type?: string | null;
};

type AuditConversationResponse = {
  conversation?: Conversation;
  results: AuditMessage[];
  page: number;
  page_size: number;
  total: number;
  has_next: boolean;
};

const AUDIT_MESSAGE_PAGE_SIZE = 20;

function mergeAuditMessages(current: AuditMessage[], incoming: AuditMessage[]) {
  const unique = new Map<string, AuditMessage>();
  for (const message of current) unique.set(message.id, message);
  for (const message of incoming) unique.set(message.id, message);
  return [...unique.values()].sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at));
}

export default function AdminMessageAuditPage() {
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rows, setRows] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<AuditMessage[]>([]);
  const [nextMessagePage, setNextMessagePage] = useState<number | null>(null);
  const [totalMessageCount, setTotalMessageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [error, setError] = useState('');
  const selectedConversationRef = useRef<string | null>(null);
  const conversationRequestRef = useRef(0);

  useEffect(() => {
    selectedConversationRef.current = selected?.id ?? null;
  }, [selected]);

  const loadConversations = async () => {
    if (!reason.trim()) {
      setError('Enter a legitimate access reason before searching retained messages.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ reason: reason.trim(), page_size: '50', status: statusFilter });
      if (search.trim()) params.set('search', search.trim());
      const response = await fetchApi<{ results: Conversation[] }>(`/admin/message-audit/conversations/?${params.toString()}`);
      setRows(response.results || []);
      setSelected(null);
      setMessages([]);
      setNextMessagePage(null);
      setTotalMessageCount(0);
    } catch (requestError: any) {
      setError(requestError?.message || 'Message audit search failed.');
    } finally {
      setLoading(false);
    }
  };

  const openConversation = useCallback(async (conversation: Conversation, silent = false) => {
    if (!reason.trim()) {
      if (!silent) setError('Enter a legitimate access reason before opening a conversation.');
      return;
    }
    if (!silent) setLoading(true);
    setError('');
    const requestNumber = ++conversationRequestRef.current;
    const isRefresh = selectedConversationRef.current === conversation.id;
    try {
      const params = new URLSearchParams({
        reason: reason.trim(),
        page: '1',
        page_size: String(AUDIT_MESSAGE_PAGE_SIZE),
        status: statusFilter,
      });
      const response = await fetchApi<AuditConversationResponse>(`/admin/message-audit/conversations/${conversation.id}/messages/?${params.toString()}`);
      if (requestNumber !== conversationRequestRef.current) return;
      const refreshedConversation = response.conversation || conversation;
      setSelected(refreshedConversation);
      setRows((current) => current.map((row) => row.id === refreshedConversation.id ? refreshedConversation : row));
      setMessages((current) => isRefresh ? mergeAuditMessages(current, response.results || []) : (response.results || []));
      setNextMessagePage((current) => isRefresh ? (current ?? (response.has_next ? 2 : null)) : (response.has_next ? 2 : null));
      setTotalMessageCount(response.total || 0);
    } catch (requestError: any) {
      if (!silent) setError(requestError?.message || 'Conversation audit could not be loaded.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [reason, statusFilter]);

  const loadOlderMessages = useCallback(async () => {
    const conversation = selected;
    const page = nextMessagePage;
    if (!conversation || !page || !reason.trim() || loadingOlderMessages) return;

    setLoadingOlderMessages(true);
    const requestNumber = ++conversationRequestRef.current;
    try {
      const params = new URLSearchParams({
        reason: reason.trim(),
        page: String(page),
        page_size: String(AUDIT_MESSAGE_PAGE_SIZE),
        status: statusFilter,
      });
      const response = await fetchApi<AuditConversationResponse>(`/admin/message-audit/conversations/${conversation.id}/messages/?${params.toString()}`);
      if (requestNumber !== conversationRequestRef.current || selectedConversationRef.current !== conversation.id) return;
      setMessages((current) => mergeAuditMessages(current, response.results || []));
      setNextMessagePage(response.has_next ? page + 1 : null);
      setTotalMessageCount(response.total || 0);
    } catch (requestError: any) {
      setError(requestError?.message || 'Older audit messages could not be loaded. Please try again.');
    } finally {
      setLoadingOlderMessages(false);
    }
  }, [loadingOlderMessages, nextMessagePage, reason, selected, statusFilter]);

  const handleAuditScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    const container = event.currentTarget;
    if (container.scrollHeight - container.scrollTop - container.clientHeight < 140) {
      void loadOlderMessages();
    }
  }, [loadOlderMessages]);

  useEffect(() => {
    if (!selected || !reason.trim()) return;
    const timer = window.setInterval(() => {
      void openConversation(selected, true);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [openConversation, reason, selected]);

  return (
    <main className="min-h-full bg-[#f6f8f7] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <p>Retained message content is restricted to legitimate safety, abuse, dispute, security, or legal investigations. Every search and message view is logged.</p>
          </div>
        </div>

        <header className="mt-6">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#bd304d]">Super Admin</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[#17232d]">Message audit</h1>
          <p className="mt-2 text-sm text-slate-500">Review retained conversations without changing the normal member chat experience.</p>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_180px_auto]">
            <label className="text-xs font-bold text-slate-600">
              Access reason <span className="text-rose-600">*</span>
              <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="User reported harassment" className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-[#267255]" />
            </label>
            <label className="text-xs font-bold text-slate-600">
              Search user, email, phone, ID, or text
              <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void loadConversations(); }} placeholder="Search conversations" className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm font-normal text-slate-800 outline-none focus:border-[#267255]" />
            </label>
            <label className="text-xs font-bold text-slate-600">
              Status
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-800 outline-none focus:border-[#267255]">
                <option value="all">All messages</option>
                <option value="active">Active</option>
                <option value="deleted">Deleted</option>
              </select>
            </label>
            <button type="button" onClick={() => void loadConversations()} disabled={loading} className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#245f4a] px-5 text-sm font-bold text-white disabled:opacity-60"><Search className="h-4 w-4" />Search</button>
          </div>
          {error && <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p>}
        </section>

        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4"><h2 className="font-extrabold text-[#17232d]">Conversations</h2><p className="mt-1 text-xs text-slate-500">{rows.length} result{rows.length === 1 ? '' : 's'}</p></div>
            <div className="divide-y divide-slate-100">
              {rows.map((conversation) => (
                <button key={conversation.id} type="button" onClick={() => void openConversation(conversation)} className={`w-full px-5 py-4 text-left transition hover:bg-[#f6faf8] ${selected?.id === conversation.id ? 'bg-[#eef7f3]' : ''}`}>
                  <div className="flex items-start justify-between gap-3"><p className="font-bold text-[#17232d]">{conversation.member_a.name} and {conversation.member_b.name}</p><span className="text-[10px] font-semibold text-slate-400">{conversation.message_count} msgs</span></div>
                  <p className="mt-1 truncate text-xs text-slate-500">{conversation.last_message || 'No message text'}</p>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">{conversation.deleted_count} deleted records</p>
                </button>
              ))}
              {!rows.length && <p className="px-5 py-10 text-center text-sm text-slate-400">Run a reasoned search to see conversations.</p>}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4"><div><h2 className="font-extrabold text-[#17232d]">Conversation audit</h2>{selected && <p className="mt-1 text-xs text-slate-500">{selected.member_a.name} and {selected.member_b.name} · Newest first · Updates every 15 seconds</p>}</div>{selected && <button type="button" onClick={() => void openConversation(selected)} disabled={loading} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-[#9ebbad] hover:text-[#267255] disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</button>}</div>
            <div onScroll={handleAuditScroll} className="max-h-[650px] space-y-3 overflow-y-auto p-5">
              {messages.length > 0 && <p className="text-center text-[11px] font-semibold text-slate-400">{loadingOlderMessages ? 'Loading older messages...' : nextMessagePage ? 'Scroll down to load older messages' : 'Beginning of this conversation'}</p>}
              {messages.map((message) => {
                const deleted = message.status === 'DELETED_FOR_EVERYONE';
                return <article key={message.id} className={`rounded-xl border p-4 ${deleted ? 'border-rose-200 bg-rose-50/60' : 'border-slate-100 bg-slate-50'}`}><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold text-[#17232d]">{message.sender_name || 'Deleted member'}</p><time className="text-[10px] text-slate-400">{new Date(message.created_at).toLocaleString()}</time></div><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">{message.text}</p>{deleted && <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-rose-700">{message.deletion_type || 'Deleted'}{message.deleted_at ? ` · ${new Date(message.deleted_at).toLocaleString()}` : ''}</p>}</article>;
              })}
              {!messages.length && <p className="py-16 text-center text-sm text-slate-400">Select a conversation to review its retained history.</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
